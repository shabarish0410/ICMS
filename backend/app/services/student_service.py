import math
import io
import csv
import time
import uuid
import threading
import logging
import pandas as pd
import pdfplumber
from typing import List, Dict, Any, Optional

from app.core.supabase import get_supabase
from app.core.security import hash_password
from app.core.exceptions import NotFoundError, ValidationError, BusinessLogicError, PermissionDeniedError
from app.schemas import StudentCreate, StudentUpdate

logger = logging.getLogger("icms.students")

# ─── In-memory Job Store ─────────────────────────────────────────────────────
_import_jobs: dict = {}
_jobs_lock = threading.Lock()

MAX_ROWS = 10000
BATCH_SIZE = 500  # rows per Supabase batch insert


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    with _jobs_lock:
        return _import_jobs.get(job_id)


def set_job(job_id: str, data: Dict[str, Any]) -> None:
    with _jobs_lock:
        _import_jobs[job_id] = data


def run_bulk_import(job_id: str, rows: List[Dict[str, Any]], student_role_id: int) -> None:
    """
    Background thread: processes all rows in batches of BATCH_SIZE,
    updates job state for polling by the frontend.
    """
    supabase = get_supabase()
    total = len(rows)
    started_at = time.time()

    existing_res = supabase.table("users").select("ic_number").execute()
    existing_ics = {u["ic_number"] for u in (existing_res.data or [])}

    success_count = 0
    skipped_count = 0
    failed_count = 0
    error_rows = []

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
        existing_ics.add(ic) 
        valid_rows.append((idx + 2, row, ic))

    total_valid = len(valid_rows)
    processed = 0

    for batch_start in range(0, total_valid, BATCH_SIZE):
        batch = valid_rows[batch_start: batch_start + BATCH_SIZE]
        users_to_insert = []
        batch_meta = []

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
            set_job(job_id, {**get_job(job_id), "processed": processed + failed_count + skipped_count})
            continue

        try:
            user_res = supabase.table("users").insert(users_to_insert).execute()
            inserted_users = user_res.data or []
            ic_to_uid = {u["ic_number"]: u["id"] for u in inserted_users}

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

        set_job(job_id, {
            **get_job(job_id),
            "status": "processing",
            "processed": processed + skipped_count + failed_count,
            "success": success_count,
            "skipped": skipped_count,
            "failed": failed_count,
            "elapsed": elapsed,
        })

    elapsed = round(time.time() - started_at, 1)
    set_job(job_id, {
        **get_job(job_id),
        "status": "done",
        "processed": total,
        "success": success_count,
        "skipped": skipped_count,
        "failed": failed_count,
        "elapsed": elapsed,
        "error_rows": error_rows,
    })
    logger.info(f"Import job {job_id} done: {success_count} ok, {skipped_count} skipped, {failed_count} failed in {elapsed}s")


def list_students(page: int, size: int, search: str, department: str, team_id: Optional[int]) -> Dict[str, Any]:
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

    return {
        "items": students,
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total else 0
    }


def list_departments() -> List[str]:
    supabase = get_supabase()
    res = supabase.table("students").select("department").execute()
    depts = list(set([d["department"] for d in res.data if d.get("department")]))
    return depts


def get_available_students(page: int, size: int, search: str, department: str, year: Optional[int], section: str, exclude_assigned: bool) -> Dict[str, Any]:
    supabase = get_supabase()
    query = supabase.table("students").select("*, user:users(*)", count="exact")

    if department:
        query = query.eq("department", department)
    if year:
        query = query.eq("year", year)
    if section:
        query = query.eq("section", section)
    if exclude_assigned:
        query = query.is_("team_id", "null")

    res = query.execute()
    all_students = res.data or []

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

    return {
        "items": paginated,
        "total": total,
        "page": page,
        "size": size,
        "pages": math.ceil(total / size) if total else 0
    }


def get_self_profile(current_user: dict) -> Dict[str, Any]:
    student_data = current_user.get("student")
    if not student_data:
        raise PermissionDeniedError("Only students have a student profile")
    student_id = student_data[0]["id"] if isinstance(student_data, list) else student_data["id"]
    supabase = get_supabase()
    res = supabase.table("students").select("*, user:users(*), team:teams!students_team_id_fkey(*)").eq("id", student_id).execute()
    if not res.data:
        raise NotFoundError("Profile not found")
    return res.data[0]


def update_self_profile(current_user: dict, req: StudentUpdate) -> Dict[str, Any]:
    student_data = current_user.get("student")
    if not student_data:
        raise PermissionDeniedError("Only students have a student profile")
    student_id = student_data[0]["id"] if isinstance(student_data, list) else student_data["id"]
    user_id = current_user["id"]
    supabase = get_supabase()
    
    update_data = req.model_dump(exclude_unset=True)
    student_updates = {}
    allowed_keys = {
        "department", "year", "semester", "resume_url", "resume_data",
        "linkedin_url", "github_url", "portfolio_url", "skills", "bio", 
        "achievements", "certifications"
    }
    for key in allowed_keys:
        if key in update_data:
            student_updates[key] = update_data[key]
            
    if "full_name" in update_data and update_data["full_name"]:
        supabase.table("users").update({"full_name": update_data["full_name"]}).eq("id", user_id).execute()
        
    if student_updates:
        supabase.table("students").update(student_updates).eq("id", student_id).execute()
        
    final_res = supabase.table("students").select("*, user:users(*), team:teams!students_team_id_fkey(*)").eq("id", student_id).execute()
    return final_res.data[0]


def get_import_status(job_id: str) -> Dict[str, Any]:
    job = get_job(job_id)
    if not job:
        raise NotFoundError("Import job not found")
    return {k: v for k, v in job.items() if k != "error_rows"}


def prepare_import_errors(job_id: str) -> str:
    job = get_job(job_id)
    if not job:
        raise NotFoundError("Import job not found")
    if job.get("status") != "done":
        raise ValidationError("Import job is not yet complete")

    error_rows = job.get("error_rows", [])
    if not error_rows:
        raise NotFoundError("No errors to download")

    output = io.StringIO()
    all_keys = list({k for row in error_rows for k in row.keys()})
    priority = ["__row__", "__error__"]
    fieldnames = priority + [k for k in all_keys if k not in priority]

    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(error_rows)
    output.seek(0)
    return output.getvalue()


def initiate_bulk_import(file_contents: bytes, filename: str, background_tasks) -> str:
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(file_contents), dtype=str)
        elif filename.endswith(".pdf"):
            with pdfplumber.open(io.BytesIO(file_contents)) as pdf:
                all_data: list = []
                for page in pdf.pages:
                    table = page.extract_table()
                    if table:
                        all_data.extend(table)
                if not all_data:
                    raise ValueError("No tabular data found in PDF")
                df = pd.DataFrame(all_data[1:], columns=all_data[0])
        else:
            df = pd.read_excel(io.BytesIO(file_contents), dtype=str)
    except Exception as e:
        raise ValidationError(f"Failed to parse file: {str(e)}")

    df.columns = [str(c).strip().replace('\ufeff', '').lower().replace(" ", "_") for c in df.columns]

    required_cols = {"ic_number", "full_name", "department", "year"}
    missing = required_cols - set(df.columns)
    if missing:
        raise ValidationError(f"Missing required columns: {', '.join(sorted(missing))}. Found: {', '.join(df.columns.tolist())}")

    if len(df) > MAX_ROWS:
        raise ValidationError(f"File contains {len(df)} rows. Maximum allowed is {MAX_ROWS}.")

    if len(df) == 0:
        raise ValidationError("The file contains no data rows.")

    supabase = get_supabase()
    role_res = supabase.table("roles").select("id").eq("name", "student").execute()
    if not role_res.data:
        raise BusinessLogicError("Student role not found in database")
    student_role_id = role_res.data[0]["id"]

    job_id = str(uuid.uuid4())
    rows = df.to_dict(orient="records")
    set_job(job_id, {
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

    background_tasks.add_task(run_bulk_import, job_id, rows, student_role_id)
    
    return job_id, len(rows)


def get_student_by_id(student_id: int) -> Dict[str, Any]:
    supabase = get_supabase()
    res = supabase.table("students").select("*, user:users(*), team:teams!students_team_id_fkey(*)").eq("id", student_id).execute()
    if not res.data:
        raise NotFoundError("Student not found")
    return res.data[0]


def create_student(req: StudentCreate, current_user: dict) -> Dict[str, Any]:
    supabase = get_supabase()
    existing = supabase.table("users").select("id").eq("ic_number", req.ic_number).execute()
    if existing.data:
        raise ValidationError("IC Number already exists")
        
    role_res = supabase.table("roles").select("id").eq("name", "student").execute()
    if not role_res.data:
        raise BusinessLogicError("Student role not found")
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
        raise BusinessLogicError("Failed to create user")
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


def admin_update_student(student_id: int, req: StudentUpdate) -> Dict[str, Any]:
    supabase = get_supabase()
    student_res = supabase.table("students").select("*, user:users(*)").eq("id", student_id).execute()
    if not student_res.data:
        raise NotFoundError("Student not found")
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


def delete_student(student_id: int) -> None:
    supabase = get_supabase()
    student_res = supabase.table("students").select("user_id").eq("id", student_id).execute()
    if not student_res.data:
        raise NotFoundError("Student not found")
    user_id = student_res.data[0]["user_id"]
    supabase.table("students").delete().eq("id", student_id).execute()
    supabase.table("users").delete().eq("id", user_id).execute()


def bulk_delete_students(student_ids: List[int]) -> int:
    if not student_ids:
        raise ValidationError("No student IDs provided")
    supabase = get_supabase()
    students = supabase.table("students").select("user_id").in_("id", student_ids).execute()
    user_ids = [s["user_id"] for s in students.data if s.get("user_id")]
    if not user_ids:
        raise NotFoundError("No matching students found")
    supabase.table("students").delete().in_("id", student_ids).execute()
    supabase.table("users").delete().in_("id", user_ids).execute()
    return len(student_ids)
