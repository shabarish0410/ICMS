from fastapi import APIRouter, Depends, Query, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from app.core.security import get_current_user, require_roles
from app.schemas import StudentCreate, StudentUpdate, StudentOut, PaginatedResponse
from app.services import student_service
from typing import List
import io

router = APIRouter(prefix="/api/students", tags=["Students"])

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
    return student_service.list_students(page, size, search, department, team_id)


@router.get("/departments/list")
def list_departments(current_user: dict = Depends(require_roles("admin"))):
    """List unique departments."""
    return student_service.list_departments()


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
    return student_service.get_available_students(page, size, search, department, year, section, exclude_assigned)


@router.get("/profile/self", response_model=StudentOut)
def get_self_profile(current_user: dict = Depends(get_current_user)):
    """Get own student profile (Student only)."""
    return student_service.get_self_profile(current_user)


@router.put("/profile/self", response_model=StudentOut)
def update_self_profile(req: StudentUpdate, current_user: dict = Depends(get_current_user)):
    """Update own profile (Student only)."""
    return student_service.update_self_profile(current_user, req)


@router.get("/import-status/{job_id}")
def get_import_status(job_id: str, current_user: dict = Depends(require_roles("admin"))):
    """Poll the status of a background import job."""
    return student_service.get_import_status(job_id)


@router.get("/import-errors/{job_id}")
def download_import_errors(job_id: str, current_user: dict = Depends(require_roles("admin"))):
    """Download a CSV of failed rows from a completed import job."""
    csv_str = student_service.prepare_import_errors(job_id)
    return StreamingResponse(
        io.BytesIO(csv_str.encode()),
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
    contents = await file.read()
    
    # We enforce file size limit at router layer before passing bytes to service
    MAX_FILE_BYTES = 20 * 1024 * 1024
    from app.core.exceptions import ValidationError
    if len(contents) > MAX_FILE_BYTES:
        raise ValidationError(f"File too large. Maximum size is {MAX_FILE_BYTES // 1024 // 1024} MB.")

    job_id, count = student_service.initiate_bulk_import(contents, filename, background_tasks)
    return {
        "job_id": job_id,
        "total": count,
        "message": f"Import started for {count} records. Poll /api/students/import-status/{job_id} for progress.",
    }


@router.get("/{student_id}", response_model=StudentOut)
def get_student(student_id: int, current_user: dict = Depends(require_roles("admin"))):
    """Get student by ID (Admin only)."""
    return student_service.get_student_by_id(student_id)


@router.post("", response_model=StudentOut, status_code=201)
def create_student(req: StudentCreate, current_user: dict = Depends(require_roles("admin"))):
    """Add a new student (Admin only). Creates user with default password."""
    return student_service.create_student(req, current_user)


@router.put("/{student_id}", response_model=StudentOut)
def update_student(student_id: int, req: StudentUpdate, current_user: dict = Depends(require_roles("admin"))):
    """Update student details (Admin only)."""
    return student_service.admin_update_student(student_id, req)


@router.delete("/{student_id}")
def delete_student(student_id: int, current_user: dict = Depends(require_roles("admin"))):
    """Delete a student and their user account (Admin only)."""
    student_service.delete_student(student_id)
    return {"message": "Student deleted successfully"}


@router.delete("/bulk/delete")
def bulk_delete_students(student_ids: List[int], current_user: dict = Depends(require_roles("admin"))):
    """Bulk delete students and their associated user accounts."""
    count = student_service.bulk_delete_students(student_ids)
    return {"message": f"Successfully deleted {count} students"}
