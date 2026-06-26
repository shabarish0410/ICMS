from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from app.core.security import get_current_user, require_roles, hash_password
from app.core.supabase import get_supabase
from app.schemas import StudentCreate, StudentUpdate, StudentOut, PaginatedResponse
from typing import List
import math
import io
import pandas as pd
import pdfplumber

router = APIRouter(prefix="/api/students", tags=["Students"])

@router.get("", response_model=PaginatedResponse)
def list_students(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str = Query("", description="Search by name or IC number"),
    department: str = Query("", description="Filter by department"),
    team_id: int = Query(None, description="Filter by team"),
    current_user: dict = Depends(require_roles("admin"))
):
    """List all students with search and filters (Admin only)."""
    supabase = get_supabase()
    
    # We fetch students along with their user details
    query = supabase.table("students").select("*, user:users(*), team:teams!students_team_id_fkey(*)", count="exact")
    
    if department:
        query = query.eq("department", department)
    if team_id:
        query = query.eq("team_id", team_id)
        
    # Supabase textSearch for user table is a bit tricky via joins, so we'll fetch then filter if there's a search term
    # Pagination via range
    res = query.range((page - 1) * size, page * size - 1).execute()
    
    students = res.data
    total = res.count if res.count is not None else 0
    
    # In-memory search fallback if needed, but ideally we'd use RPC. 
    # For now, simple filter since the user count isn't massive.
    if search:
        search_lower = search.lower()
        students = [
            s for s in students 
            if (s.get("user") and (search_lower in s["user"].get("full_name", "").lower() or search_lower in s["user"].get("ic_number", "").lower()))
        ]
        total = len(students)
        # Apply pagination manually after filtering
        students = students[(page - 1) * size : page * size]

    return PaginatedResponse(
        items=students,
        total=total, page=page, size=size, pages=math.ceil(total / size) if total else 0,
    )


@router.get("/{student_id}", response_model=StudentOut)
def get_student(
    student_id: int,
    current_user: dict = Depends(require_roles("admin"))
):
    """Get student by ID (Admin only)."""
    supabase = get_supabase()
    res = supabase.table("students").select("*, user:users(*), team:teams!students_team_id_fkey(*)").eq("id", student_id).execute()
    
    if not res.data:
        raise HTTPException(status_code=404, detail="Student not found")
        
    return res.data[0]


@router.post("", response_model=StudentOut, status_code=201)
def create_student(
    req: StudentCreate,
    current_user: dict = Depends(require_roles("admin"))
):
    """Add a new student (Admin only). Creates user with default password."""
    supabase = get_supabase()
    
    # Check if IC exists
    existing = supabase.table("users").select("id").eq("ic_number", req.ic_number).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="IC Number already exists")

    # Get student role
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

    # Notification
    supabase.table("notifications").insert({
        "user_id": user_id,
        "title": "Welcome to Spark Innovation Center!",
        "message": f"Your account has been created. Login with IC: {req.ic_number}. Please change your password on first login.",
        "notification_type": "welcome",
    }).execute()

    # Activity Log
    supabase.table("activity_logs").insert({
        "user_id": current_user["id"],
        "action": "student_created",
        "entity_type": "student",
        "entity_id": student_id
    }).execute()

    # Fetch complete student
    final_res = supabase.table("students").select("*, user:users(*), team:teams!students_team_id_fkey(*)").eq("id", student_id).execute()
    return final_res.data[0]


@router.put("/{student_id}", response_model=StudentOut)
def update_student(
    student_id: int,
    req: StudentUpdate,
    current_user: dict = Depends(require_roles("admin"))
):
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
def delete_student(
    student_id: int,
    current_user: dict = Depends(require_roles("admin"))
):
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
def bulk_delete_students(
    student_ids: List[int],
    current_user: dict = Depends(require_roles("admin"))
):
    """Bulk delete students and their associated user accounts."""
    if not student_ids:
        raise HTTPException(status_code=400, detail="No student IDs provided")
        
    supabase = get_supabase()
    
    # 1. Get all user IDs for these students
    students = supabase.table("students").select("user_id").in_("id", student_ids).execute()
    user_ids = [s["user_id"] for s in students.data if s.get("user_id")]
    
    if not user_ids:
        raise HTTPException(status_code=404, detail="No matching students found")

    # 2. Delete students (actually Supabase cascade delete from users might handle this, but let's be explicit)
    supabase.table("students").delete().in_("id", student_ids).execute()
    
    # 3. Delete users
    supabase.table("users").delete().in_("id", user_ids).execute()
    
    return {"message": f"Successfully deleted {len(student_ids)} students"}


@router.post("/bulk-import")
async def bulk_import_students(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_roles("admin"))
):
    """Import students via CSV/Excel upload."""
    if not file.filename.endswith(('.csv', '.xlsx', '.pdf')):
        raise HTTPException(status_code=400, detail="Only CSV, Excel, or PDF files are allowed.")
        
    contents = await file.read()
    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        elif file.filename.endswith('.pdf'):
            with pdfplumber.open(io.BytesIO(contents)) as pdf:
                all_data = []
                for page in pdf.pages:
                    table = page.extract_table()
                    if table:
                        all_data.extend(table)
                if not all_data:
                    raise ValueError("No tabular data found in PDF")
                # Assume first row is header
                df = pd.DataFrame(all_data[1:], columns=all_data[0])
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    # Clean headers
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    
    required_cols = {"ic_number", "full_name", "department", "year"}
    if not required_cols.issubset(set(df.columns)):
        missing = required_cols - set(df.columns)
        raise HTTPException(status_code=400, detail=f"Missing required columns: {', '.join(missing)}")

    supabase = get_supabase()
    
    # Get student role
    role_res = supabase.table("roles").select("id").eq("name", "student").execute()
    if not role_res.data:
        raise HTTPException(status_code=500, detail="Student role not found in database")
    student_role_id = role_res.data[0]["id"]
    
    # Fetch existing IC numbers to avoid duplicates
    existing_users = supabase.table("users").select("ic_number").execute()
    existing_ics = {u["ic_number"] for u in existing_users.data}

    success_count = 0
    skipped_count = 0
    errors = []

    for idx, row in df.iterrows():
        try:
            ic = str(row["ic_number"]).strip()
            if pd.isna(ic) or ic in ('', 'nan', 'None'):
                errors.append(f"Row {idx+2}: IC Number is empty")
                continue
                
            if ic in existing_ics:
                skipped_count += 1
                errors.append(f"Row {idx+2}: IC {ic} already exists (skipped)")
                continue

            full_name = str(row["full_name"]).strip()
            department = str(row.get("department", "")).strip()
            year = int(row["year"]) if not pd.isna(row.get("year")) else 1
            semester = int(row["semester"]) if "semester" in row and not pd.isna(row["semester"]) else None
            mentor = str(row["mentor_name"]).strip() if "mentor_name" in row and not pd.isna(row["mentor_name"]) else None
            
            # Default password
            password_to_use = f"spark@{ic}"
            
            # Create user
            new_user = {
                "ic_number": ic,
                "password_hash": hash_password(password_to_use),
                "full_name": full_name,
                "role_id": student_role_id,
                "is_active": True,
                "is_profile_completed": False,
                "must_change_password": True,
            }
            user_res = supabase.table("users").insert(new_user).execute()
            if not user_res.data:
                errors.append(f"Row {idx+2}: Failed to create user")
                continue
            
            user_id = user_res.data[0]["id"]
            
            # Create student
            new_student = {
                "user_id": user_id,
                "department": department,
                "year": year,
                "semester": semester,
                "mentor_name": mentor,
                "team_id": None # Link via UI or separate process later
            }
            supabase.table("students").insert(new_student).execute()
            
            existing_ics.add(ic)
            success_count += 1
            
        except Exception as e:
            errors.append(f"Row {idx+2}: Error - {str(e)}")

    return {
        "message": f"Import complete. Imported {success_count}, Skipped {skipped_count}",
        "success": success_count,
        "skipped": skipped_count,
        "errors": errors[:50] # return top 50 errors
    }


@router.get("/departments/list")
def list_departments(
    current_user: dict = Depends(require_roles("admin"))
):
    """List unique departments."""
    supabase = get_supabase()
    res = supabase.table("students").select("department").execute()
    # Unique departments
    depts = list(set([d["department"] for d in res.data if d.get("department")]))
    return depts


@router.get("/profile/self", response_model=StudentOut)
def get_self_profile(
    current_user: dict = Depends(get_current_user)
):
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
def update_self_profile(
    req: StudentUpdate,
    current_user: dict = Depends(get_current_user)
):
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
