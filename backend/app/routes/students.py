from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.security import get_current_user, require_roles, hash_password
from app.models import User, Student, Role, Team, ActivityLog, Notification
from app.schemas import StudentCreate, StudentUpdate, StudentOut, PaginatedResponse
import math

router = APIRouter(prefix="/api/students", tags=["Students"])


@router.get("", response_model=PaginatedResponse)
def list_students(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str = Query("", description="Search by name or IC number"),
    department: str = Query("", description="Filter by department"),
    team_id: int = Query(None, description="Filter by team"),
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """List all students with search and filters (Admin only)."""
    q = db.query(Student).options(joinedload(Student.user), joinedload(Student.team))

    if search:
        q = q.join(User).filter(
            (User.full_name.ilike(f"%{search}%")) | (User.ic_number.ilike(f"%{search}%"))
        )
    if department:
        q = q.filter(Student.department == department)
    if team_id:
        q = q.filter(Student.team_id == team_id)

    total = q.count()
    students = q.offset((page - 1) * size).limit(size).all()

    return PaginatedResponse(
        items=[StudentOut.model_validate(s) for s in students],
        total=total, page=page, size=size, pages=math.ceil(total / size) if total else 0,
    )


@router.get("/{student_id}", response_model=StudentOut)
def get_student(
    student_id: int,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Get student by ID (Admin only)."""
    student = db.query(Student).options(
        joinedload(Student.user), joinedload(Student.team)
    ).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@router.post("", response_model=StudentOut, status_code=201)
def create_student(
    req: StudentCreate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Add a new student (Admin only). Creates user with default password."""
    existing = db.query(User).filter(User.ic_number == req.ic_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="IC Number already exists")

    student_role = db.query(Role).filter(Role.name == "student").first()
    if not student_role:
        raise HTTPException(status_code=500, detail="Student role not found")

    # Use custom password if provided, otherwise default to icms@{ic_number}
    if req.password:
        password_to_use = req.password
        must_change = False
        profile_completed = True
    else:
        password_to_use = f"icms@{req.ic_number}"
        must_change = True
        profile_completed = False

    user = User(
        ic_number=req.ic_number,
        password_hash=hash_password(password_to_use),
        full_name=req.full_name,
        role_id=student_role.id,
        is_active=True,
        is_profile_completed=profile_completed,
        must_change_password=must_change,
    )
    db.add(user)
    db.flush()

    student = Student(
        user_id=user.id,
        department=req.department,
        year=req.year,
        semester=req.semester,
        mentor_name=req.mentor_name,
        team_id=req.team_id,
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    # Send notification to new student
    notif = Notification(
        user_id=user.id,
        title="Welcome to ICMS!",
        message=f"Your account has been created. Login with IC: {req.ic_number}. Please change your password on first login.",
        notification_type="welcome",
    )
    db.add(notif)

    log = ActivityLog(user_id=current_user.id, action="student_created",
                      entity_type="student", entity_id=student.id)
    db.add(log)
    db.commit()

    return db.query(Student).options(
        joinedload(Student.user), joinedload(Student.team)
    ).filter(Student.id == student.id).first()


@router.put("/{student_id}", response_model=StudentOut)
def update_student(
    student_id: int,
    req: StudentUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Update student details (Admin only)."""
    student = db.query(Student).options(joinedload(Student.user)).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    update_data = req.model_dump(exclude_unset=True)

    if "full_name" in update_data and update_data["full_name"]:
        student.user.full_name = update_data.pop("full_name")
    if "is_active" in update_data:
        student.user.is_active = update_data.pop("is_active")

    for key, value in update_data.items():
        if hasattr(student, key):
            setattr(student, key, value)

    db.commit()
    db.refresh(student)
    return db.query(Student).options(
        joinedload(Student.user), joinedload(Student.team)
    ).filter(Student.id == student.id).first()


@router.delete("/{student_id}")
def delete_student(
    student_id: int,
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """Delete a student and their user account (Admin only)."""
    student = db.query(Student).options(joinedload(Student.user)).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    user = student.user
    db.delete(student)
    if user:
        db.delete(user)
    db.commit()
    return {"message": "Student deleted successfully"}


@router.get("/departments/list")
def list_departments(
    current_user: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    """List unique departments."""
    depts = db.query(Student.department).distinct().all()
    return [d[0] for d in depts if d[0]]


@router.get("/profile/self", response_model=StudentOut)
def get_self_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get own student profile (Student only)."""
    if not current_user.student:
        raise HTTPException(status_code=403, detail="Only students have a student profile")
    return db.query(Student).options(
        joinedload(Student.user), joinedload(Student.team)
    ).filter(Student.id == current_user.student.id).first()


@router.put("/profile/self", response_model=StudentOut)
def update_self_profile(
    req: StudentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update own profile (Student only)."""
    if not current_user.student:
        raise HTTPException(status_code=403, detail="Only students have a student profile")
    
    student = current_user.student
    update_data = req.model_dump(exclude_unset=True)
    
    # Allow student to update their department, year, semester, resume_url, resume_data
    allowed_keys = {"department", "year", "semester", "resume_url", "resume_data"}
    for key in allowed_keys:
        if key in update_data:
            setattr(student, key, update_data[key])
            
    # Also allow updating full_name on their User object
    if "full_name" in update_data and update_data["full_name"]:
        student.user.full_name = update_data["full_name"]
        
    db.commit()
    db.refresh(student)
    return db.query(Student).options(
        joinedload(Student.user), joinedload(Student.team)
    ).filter(Student.id == student.id).first()
