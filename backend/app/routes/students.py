"""
Bulk Student Import — Job-based background processing system.
Supports up to 5000 records per CSV/Excel file with progress tracking.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from app.core.security import get_current_user, require_roles, hash_password
from app.core.supabase import get_supabase
from app.schemas import StudentCreate, StudentUpdate, StudentOut, PaginatedResponse
from typing import List
import math
import io
import csv
import time
import uuid
import threading
import logging
import pandas as pd
import pdfplumber

logger = logging.getLogger("icms.students")

router = APIRouter(prefix="/api/students", tags=["Students"])

# ─── In-memory Job Store ─────────────────────────────────────────────────────
# Stores import job state keyed by job_id (UUID string)
_import_jobs: dict = {}
_jobs_lock = threading.Lock()

MAX_ROWS = 10000
BATCH_SIZE = 500  # rows per Supabase batch insert
MAX_FILE_BYTES = 20 * 1024 * 1024  # 20 MB


def _get_job(job_id: str) -> dict:
    with _jobs_lock:
        return _import_jobs.get(job_id)


def _set_job(job_id: str, data: dict):
    with _jobs_lock:
        _import_jobs[job_id] = data


# ─── Background Worker ────────────────────────────────────────────────────────

def _run_import(job_id: str, rows: list[dict], student_role_id: int):
    """
    Background thread: processes all rows in batches of BATCH_SIZE,
    updates job state in _import_jobs for polling by the frontend.
    """
    supabase = get_supabase()
    total = len(rows)
    started_at = time.time()

    # Fetch all existing IC numbers once upfront
    existing_res = supabase.table("users").select("ic_number").execute()
    existing_ics: set = {u["ic_number"] for u in (existing_res.data or [])}

    success_count = 0
    skipped_count = 0
    failed_count = 0
    error_rows: list[dict] = []

    # Build list of valid rows to insert, skip duplicates immediately
    valid_rows = []
    for idx, row in enumerate(rows):
        raw_ic = str(row.get("ic_number", "")).strip()
        if raw_ic.endswith(".0"):
            raw_ic = raw_ic[:-2]
            
        ic = raw_ic
        if not ic or ic.lower() in ("nan", "none", ""):
            error_rows.append({**row, "__row__": idx + 2, "__error__": "IC Number is empty"})
            failed_count += 1
            continue
        if ic in existing_ics:
            error_rows.append({**row, "__row__": idx + 2, "__error__": f"Duplicate IC: {ic}"})
            skipped_count += 1
            continue
        existing_ics.add(ic)  # prevent intra-file duplicates
        valid_rows.append((idx + 2, row, ic))

    total_valid = len(valid_rows)
    processed = 0

    # Process in batches
    for batch_start in range(0, total_valid, BATCH_SIZE):
        batch = valid_rows[batch_start: batch_start + BATCH_SIZE]
        users_to_insert = []
        batch_meta = []  # (row_num, row_dict, ic) for student insert

        for row_num, row, ic in batch:
            try:
                full_name = str(row.get("full_name", "")).strip() or ic
                email = str(row.get("email", "")).strip()
                phone_number = str(row.get("phone_number", "")).strip()
                department = str(row.get("department", "")).strip() or "General"
                section = str(row.get("section", "")).strip()
                year_val = row.get("year")
                year = int(float(year_val)) if year_val and str(year_val).lower() not in ("nan", "none", "") else 1
                semester_val = row.get("semester")
                semester = int(float(semester_val)) if semester_val and str(semester_val).lower() not in ("nan", "none", "") else None
                mentor_val = row.get("mentor_name")
                mentor = str(mentor_val).strip() if mentor_val and str(mentor_val).lower() not in ("nan", "none", "") else None
                
                # Check for custom password in row
                custom_pass = str(row.get("password", "")).strip()
                pass_to_hash = custom_pass if custom_pass and custom_pass.lower() not in ("nan", "none", "") else f"spark@{ic}"

                users_to_insert.append({
                    "ic_number": ic,
                    "password_hash": hash_password(pass_to_hash),
                    "full_name": full_name,
                    "email": email if email else None,
                    "mobile": phone_number if phone_number else None,
                    "role_id": student_role_id,
                    "is_active": True,
                    "is_profile_completed": False,
                    "must_change_password": True,
                })
                batch_meta.append((row_num, row, ic, department, year, semester, mentor, section))
            except Exception as e:
                error_rows.append({**row, "__row__": row_num, "__error__": str(e)})
                failed_count += 1

        if not users_to_insert:
            processed += len(batch)
            _set_job(job_id, {**_get_job(job_id), "processed": processed + failed_count + skipped_count})
            continue

        try:
            # ✅ Bulk insert all users in one Supabase call
            user_res = supabase.table("users").insert(users_to_insert).execute()
            inserted_users = user_res.data or []

            # Map IC → user_id from result
            ic_to_uid: dict = {u["ic_number"]: u["id"] for u in inserted_users}

            # Build student records
            students_to_insert = []
            for row_num, row, ic, department, year, semester, mentor, section in batch_meta:
                uid = ic_to_uid.get(ic)
                if uid:
                    students_to_insert.append({
                        "user_id": uid,
                        "department": department,
                        "year": year,
                        "semester": semester,
                        "mentor_name": mentor,
                        "team_id": None,
                    })
                else:
                    error_rows.append({**row, "__row__": row_num, "__error__": "User insert failed (no ID returned)"})
                    failed_count += 1

            if students_to_insert:
                supabase.table("students").insert(students_to_insert).execute()
                success_count += len(students_to_insert)

        except Exception as e:
            logger.error(f"Batch insert failed for job {job_id}: {e}")
            for row_num, row, ic, *_ in batch_meta:
                error_rows.append({**row, "__row__": row_num, "__error__": f"Batch error: {str(e)}"})
                failed_count += len(batch_meta)

        processed = batch_start + len(batch)
        elapsed = round(time.time() - started_at, 1)

        _set_job(job_id, {
            **_get_job(job_id),
            "status": "processing",
            "processed": processed + skipped_count + failed_count,
            "success": success_count,
            "skipped": skipped_count,
            "failed": failed_count,
            "elapsed": elapsed,
        })

    elapsed = round(time.time() - started_at, 1)
    _set_job(job_id, {
        **_get_job(job_id),
        "status": "done",
        "processed": total,
        "success": success_count,
        "skipped": skipped_count,
        "failed": failed_count,
        "elapsed": elapsed,
        "error_rows": error_rows,
    })
    logger.info(f"Import job {job_id} done: {success_count} ok, {skipped_count} skipped, {failed_count} failed in {elapsed}s")


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("", response_model=PaginatedResponse)
def list_students(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=1000),
    search: str = Query("", description="Search by name or IC number"),
    department: str = Query("", description="Filter by department"),
    team_id: int = Query(None, description="Filter by team"),
    current_user: dict = Depends(require_roles("admin"))
):
    """List all students with search and filters (Admin only)."""
    supabase = get_supabase()
    query = supabase.table("students").select("*, user:users(*), team:teams!students_team_id_fkey(*)", count="exact")

    if department:
        query = query.eq("department", department)
    if team_id:
        query = query.eq("team_id", team_id)

    res = query.range((page - 1) * size, page * size - 1).execute()
    students = res.data
    total = res.count if res.count is not None else 0

    if search:
        search_lower = search.lower()
        students = [
            s for s in students
            if (s.get("user") and (search_lower in s["user"].get("full_name", "").lower() or search_lower in s["user"].get("ic_number", "").lower()))
        ]
        total = len(students)
        students = students[(page - 1) * size: page * size]

    return PaginatedResponse(
        items=students,
        total=total, page=page, size=size, pages=math.ceil(total / size) if total else 0,
    )


@router.get("/departments/list")
def list_departments(current_user: dict = Depends(require_roles("admin"))):
    """List unique departments."""
    supabase = get_supabase()
    res = supabase.table("students").select("department").execute()
    depts = list(set([d["department"] for d in res.data if d.get("department")]))
    return depts


@router.get("/available", response_model=PaginatedResponse)
def get_available_students(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=1000),
    search: str = Query("", description="Search by name, IC, or email"),
    department: str = Query("", description="Filter by department"),
    year: int = Query(None, description="Filter by year"),
    section: str = Query("", description="Filter by section"),
    exclude_assigned: bool = Query(True, description="Exclude students who already have a team"),
    current_user: dict = Depends(require_roles("admin"))
):
    """Get active students for team assignment."""
    supabase = get_supabase()
    
    # We select users directly filtering by is_active=True using inner join string representation
    # But PostgREST doesn't support deep filtering on nested objects easily for booleans without special syntax.
    # We will fetch and filter in Python for complex searches to guarantee safety.
    query = supabase.table("students").select("*, user:users(*)", count="exact")

    if department:
        query = query.eq("department", department)
    if year:
        query = query.eq("year", year)
    if section:
        query = query.eq("section", section)
    if exclude_assigned:
        query = query.is_("team_id", "null")

    # Fetch more rows to allow for in-memory filtering of user.is_active and search
    res = query.execute()
    all_students = res.data or []

    # Filter active and search term
    filtered_students = []
    search_lower = search.lower().strip()
    
    for s in all_students:
        u = s.get("user")
        if not u or not u.get("is_active"):
            continue
            
        if search_lower:
            name = (u.get("full_name") or "").lower()
            ic = (u.get("ic_number") or "").lower()
            email = (u.get("email") or "").lower()
            
            if search_lower not in name and search_lower not in ic and search_lower not in email:
                continue
                
        filtered_students.append(s)

    total = len(filtered_students)
    paginated = filtered_students[(page - 1) * size : page * size]

    return PaginatedResponse(
        items=paginated,
        total=total, page=page, size=size, pages=math.ceil(total / size) if total else 0,
    )


@router.get("/profile/self", response_model=StudentOut)
def get_self_profile(current_user: dict = Depends(get_current_user)):
    """Get own student profile (Student only)."""
    if not current_user.get("student") or len(current_user["student"]) == 0:
        raise HTTPException(status_code=403, detail="Only students have a student profile")
    student_id = current_user["student"][0]["id"]
    supabase = get_supabase()
    res = supabase.table("students").select("*, user:users(*), team:teams!students_team_id_fkey(*)").eq("id", student_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return res.data[0]


@router.put("/profile/self", response_model=StudentOut)
def update_self_profile(req: StudentUpdate, current_user: dict = Depends(get_current_user)):
    """Update own profile (Student only)."""
    if not current_user.get("student") or len(current_user["student"]) == 0:
        raise HTTPException(status_code=403, detail="Only students have a student profile")
    student_id = current_user["student"][0]["id"]
    user_id = current_user["id"]
    supabase = get_supabase()
    update_data = req.model_dump(exclude_unset=True)
    student_updates = {}
    allowed_keys = {"department", "year", "semester", "resume_url", "resume_data"}
    for key in allowed_keys:
        if key in update_data:
            student_updates[key] = update_data[key]
    if "full_name" in update_data and update_data["full_name"]:
        supabase.table("users").update({"full_name": update_data["full_name"]}).eq("id", user_id).execute()
    if student_updates:
        supabase.table("students").update(student_updates).eq("id", student_id).execute()
    final_res = supabase.table("students").select("*, user:users(*), team:teams!students_team_id_fkey(*)").eq("id", student_id).execute()
    return final_res.data[0]


@router.get("/import-status/{job_id}")
def get_import_status(job_id: str, current_user: dict = Depends(require_roles("admin"))):
    """Poll the status of a background import job."""
    job = _get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    # Return all fields except the full error_rows list (too large for polling)
    return {k: v for k, v in job.items() if k != "error_rows"}


@router.get("/import-errors/{job_id}")
def download_import_errors(job_id: str, current_user: dict = Depends(require_roles("admin"))):
    """Download a CSV of failed rows from a completed import job."""
    job = _get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    if job.get("status") != "done":
        raise HTTPException(status_code=400, detail="Import job is not yet complete")

    error_rows: list[dict] = job.get("error_rows", [])
    if not error_rows:
        raise HTTPException(status_code=404, detail="No errors to download")

    output = io.StringIO()
    all_keys = list({k for row in error_rows for k in row.keys()})
    # Ensure meta columns are first
    priority = ["__row__", "__error__"]
    fieldnames = priority + [k for k in all_keys if k not in priority]

    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(error_rows)
    output.seek(0)

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=import_errors_{job_id[:8]}.csv"}
    )


@router.post("/bulk-import")
async def bulk_import_students(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_roles("admin"))
):
    """
    Start a background CSV/Excel import job.
    Returns a job_id immediately — poll /import-status/{job_id} for progress.
    Supports up to 5000 rows per file.
    """
    filename = file.filename or ""
    if not (filename.endswith(".csv") or filename.endswith(".xlsx") or filename.endswith(".pdf")):
        raise HTTPException(status_code=400, detail="Only CSV (.csv), Excel (.xlsx), or PDF files are allowed.")

    contents = await file.read()
    if len(contents) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {MAX_FILE_BYTES // 1024 // 1024} MB.")

    # Parse file
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents), dtype=str)
        elif filename.endswith(".pdf"):
            with pdfplumber.open(io.BytesIO(contents)) as pdf:
                all_data: list = []
                for page in pdf.pages:
                    table = page.extract_table()
                    if table:
                        all_data.extend(table)
                if not all_data:
                    raise ValueError("No tabular data found in PDF")
                df = pd.DataFrame(all_data[1:], columns=all_data[0])
        else:
            df = pd.read_excel(io.BytesIO(contents), dtype=str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    # Normalise headers and strip UTF-8 BOM
    df.columns = [str(c).strip().replace('\ufeff', '').lower().replace(" ", "_") for c in df.columns]

    required_cols = {"ic_number", "full_name", "department", "year"}
    missing = required_cols - set(df.columns)
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {', '.join(sorted(missing))}. Found: {', '.join(df.columns.tolist())}")

    if len(df) > MAX_ROWS:
        raise HTTPException(status_code=400, detail=f"File contains {len(df)} rows. Maximum allowed is {MAX_ROWS}.")

    if len(df) == 0:
        raise HTTPException(status_code=400, detail="The file contains no data rows.")

    # Get student role ID
    supabase = get_supabase()
    role_res = supabase.table("roles").select("id").eq("name", "student").execute()
    if not role_res.data:
        raise HTTPException(status_code=500, detail="Student role not found in database")
    student_role_id = role_res.data[0]["id"]

    # Create job entry
    job_id = str(uuid.uuid4())
    rows = df.to_dict(orient="records")
    _set_job(job_id, {
        "job_id": job_id,
        "status": "processing",
        "total": len(rows),
        "processed": 0,
        "success": 0,
        "skipped": 0,
        "failed": 0,
        "elapsed": 0,
        "filename": filename,
        "error_rows": [],
    })

    # Start background thread (FastAPI BackgroundTasks work post-response)
    background_tasks.add_task(_run_import, job_id, rows, student_role_id)

    return {
        "job_id": job_id,
        "total": len(rows),
        "message": f"Import started for {len(rows)} records. Poll /api/students/import-status/{job_id} for progress.",
    }


@router.get("/{student_id}", response_model=StudentOut)
def get_student(student_id: int, current_user: dict = Depends(require_roles("admin"))):
    """Get student by ID (Admin only)."""
    supabase = get_supabase()
    res = supabase.table("students").select("*, user:users(*), team:teams!students_team_id_fkey(*)").eq("id", student_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Student not found")
    return res.data[0]


@router.post("", response_model=StudentOut, status_code=201)
def create_student(req: StudentCreate, current_user: dict = Depends(require_roles("admin"))):
    """Add a new student (Admin only). Creates user with default password."""
    supabase = get_supabase()
    existing = supabase.table("users").select("id").eq("ic_number", req.ic_number).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="IC Number already exists")
    role_res = supabase.table("roles").select("id").eq("name", "student").execute()
    if not role_res.data:
        raise HTTPException(status_code=500, detail="Student role not found")
    student_role_id = role_res.data[0]["id"]

    if req.password:
        password_to_use = req.password
        must_change = False
        profile_completed = True
    else:
        password_to_use = f"spark@{req.ic_number}"
        must_change = True
        profile_completed = False

    new_user = {
        "ic_number": req.ic_number,
        "password_hash": hash_password(password_to_use),
        "full_name": req.full_name,
        "role_id": student_role_id,
        "is_active": True,
        "is_profile_completed": profile_completed,
        "must_change_password": must_change,
    }
    user_res = supabase.table("users").insert(new_user).execute()
    if not user_res.data:
        raise HTTPException(status_code=500, detail="Failed to create user")
    user_id = user_res.data[0]["id"]

    new_student = {
        "user_id": user_id,
        "department": req.department,
        "year": req.year,
        "semester": req.semester,
        "mentor_name": req.mentor_name,
        "team_id": req.team_id,
    }
    student_res = supabase.table("students").insert(new_student).execute()
    student_id = student_res.data[0]["id"]

    supabase.table("notifications").insert({
        "user_id": user_id,
        "title": "Welcome to Spark Innovation Center!",
        "message": f"Your account has been created. Login with IC: {req.ic_number}. Please change your password on first login.",
        "notification_type": "welcome",
    }).execute()

    supabase.table("activity_logs").insert({
        "user_id": current_user["id"],
        "action": "student_created",
        "entity_type": "student",
        "entity_id": student_id
    }).execute()

    final_res = supabase.table("students").select("*, user:users(*), team:teams!students_team_id_fkey(*)").eq("id", student_id).execute()
    return final_res.data[0]


@router.put("/{student_id}", response_model=StudentOut)
def update_student(student_id: int, req: StudentUpdate, current_user: dict = Depends(require_roles("admin"))):
    """Update student details (Admin only)."""
    supabase = get_supabase()
    student_res = supabase.table("students").select("*, user:users(*)").eq("id", student_id).execute()
    if not student_res.data:
        raise HTTPException(status_code=404, detail="Student not found")
    student = student_res.data[0]
    user_id = student["user_id"]

    update_data = req.model_dump(exclude_unset=True)
    user_updates = {}
    student_updates = {}

    if "full_name" in update_data:
        user_updates["full_name"] = update_data.pop("full_name")
    if "is_active" in update_data:
        user_updates["is_active"] = update_data.pop("is_active")

    for key, value in update_data.items():
        student_updates[key] = value

    if user_updates:
        supabase.table("users").update(user_updates).eq("id", user_id).execute()
    if student_updates:
        supabase.table("students").update(student_updates).eq("id", student_id).execute()

    final_res = supabase.table("students").select("*, user:users(*), team:teams!students_team_id_fkey(*)").eq("id", student_id).execute()
    return final_res.data[0]


@router.delete("/{student_id}")
def delete_student(student_id: int, current_user: dict = Depends(require_roles("admin"))):
    """Delete a student and their user account (Admin only)."""
    supabase = get_supabase()
    student_res = supabase.table("students").select("user_id").eq("id", student_id).execute()
    if not student_res.data:
        raise HTTPException(status_code=404, detail="Student not found")
    user_id = student_res.data[0]["user_id"]
    supabase.table("students").delete().eq("id", student_id).execute()
    supabase.table("users").delete().eq("id", user_id).execute()
    return {"message": "Student deleted successfully"}


@router.delete("/bulk/delete")
def bulk_delete_students(student_ids: List[int], current_user: dict = Depends(require_roles("admin"))):
    """Bulk delete students and their associated user accounts."""
    if not student_ids:
        raise HTTPException(status_code=400, detail="No student IDs provided")
    supabase = get_supabase()
    students = supabase.table("students").select("user_id").in_("id", student_ids).execute()
    user_ids = [s["user_id"] for s in students.data if s.get("user_id")]
    if not user_ids:
        raise HTTPException(status_code=404, detail="No matching students found")
    supabase.table("students").delete().in_("id", student_ids).execute()
    supabase.table("users").delete().in_("id", user_ids).execute()
    return {"message": f"Successfully deleted {len(student_ids)} students"}
