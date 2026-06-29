from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from app.core.security import get_current_user, require_roles
from app.core.supabase import get_supabase
from app.schemas import TeamCreate, TeamUpdate, TeamOut, PaginatedResponse
from app.utils.actions import log_admin_action, broadcast_notification
import math
import io
import pandas as pd
import pdfplumber

router = APIRouter(prefix="/api/teams", tags=["Teams"])


@router.get("", response_model=PaginatedResponse)
def list_teams(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=1000),
    search: str = Query(""),
    current_user: dict = Depends(get_current_user)
):
    """List all teams."""
    supabase = get_supabase()
    
    query = supabase.table("teams").select("*", count="exact")
    if search:
        query = query.ilike("name", f"%{search}%")
        
    res = query.range((page - 1) * size, page * size - 1).execute()
    teams = res.data
    total = res.count if res.count is not None else 0
    
    items = []
    for t in teams:
        member_res = supabase.table("students").select("id", count="exact").eq("team_id", t["id"]).execute()
        t["member_count"] = member_res.count if member_res.count is not None else 0
        items.append(t)

    return PaginatedResponse(
        items=items, total=total, page=page, size=size,
        pages=math.ceil(total / size) if total else 0,
    )


@router.get("/{team_id}", response_model=TeamOut)
def get_team(
    team_id: int, 
    current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    res = supabase.table("teams").select("*").eq("id", team_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Team not found")
        
    team = res.data[0]
    member_res = supabase.table("students").select("id", count="exact").eq("team_id", team["id"]).execute()
    team["member_count"] = member_res.count if member_res.count is not None else 0
    return team


@router.post("", response_model=TeamOut, status_code=201)
def create_team(
    req: TeamCreate, 
    current_user: dict = Depends(require_roles("admin"))
):
    supabase = get_supabase()
    existing = supabase.table("teams").select("id").eq("name", req.name).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Team name already exists")
        
    new_team = req.model_dump(exclude={"student_ids"})
    res = supabase.table("teams").insert(new_team).execute()
    
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create team")
        
    team = res.data[0]
    
    if req.student_ids:
        if len(req.student_ids) != len(set(req.student_ids)):
            supabase.table("teams").delete().eq("id", team["id"]).execute()
            raise HTTPException(status_code=400, detail="Duplicate students in the selection")

        students_res = supabase.table("students").select("id, team_id, user:users(is_active)").in_("id", req.student_ids).execute()
        found_ids = {s["id"] for s in (students_res.data or [])}
        for s_id in req.student_ids:
            if s_id not in found_ids:
                supabase.table("teams").delete().eq("id", team["id"]).execute()
                raise HTTPException(status_code=400, detail=f"Student ID {s_id} does not exist")
        for s in students_res.data:
            if not s.get("user", {}).get("is_active"):
                supabase.table("teams").delete().eq("id", team["id"]).execute()
                raise HTTPException(status_code=400, detail=f"Student ID {s['id']} is not active")
            if s.get("team_id"):
                supabase.table("teams").delete().eq("id", team["id"]).execute()
                raise HTTPException(status_code=400, detail=f"Student ID {s['id']} is already in another team")

        supabase.table("students").update({"team_id": team["id"]}).in_("id", req.student_ids).execute()
        
    team["member_count"] = len(req.student_ids) if req.student_ids else 0
    
    log_admin_action(current_user["id"], "create", "teams", team["id"], new_value=team)
    broadcast_notification("Team Created", f"Team '{team['name']}' has been created.")
    
    return team


@router.post("/bulk-import")
async def bulk_import_teams(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_roles("admin"))
):
    """Import teams via CSV/Excel upload."""
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
                df = pd.DataFrame(all_data[1:], columns=all_data[0])
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    # Clean headers
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    
    if "name" not in df.columns:
        raise HTTPException(status_code=400, detail="Missing required column: name")

    supabase = get_supabase()
    
    # Fetch existing team names to avoid duplicates
    existing_teams_res = supabase.table("teams").select("name").execute()
    existing_names = {t["name"].lower() for t in existing_teams_res.data}

    success_count = 0
    skipped_count = 0
    errors = []

    for idx, row in df.iterrows():
        try:
            name = str(row["name"]).strip()
            if pd.isna(name) or name in ('', 'nan', 'None'):
                errors.append(f"Row {idx+2}: Team Name is empty")
                continue
                
            if name.lower() in existing_names:
                skipped_count += 1
                errors.append(f"Row {idx+2}: Team '{name}' already exists (skipped)")
                continue

            desc = str(row["description"]).strip() if "description" in row and not pd.isna(row["description"]) else None
            dept = str(row["department"]).strip() if "department" in row and not pd.isna(row["department"]) else None
            mentor = str(row["mentor_name"]).strip() if "mentor_name" in row and not pd.isna(row["mentor_name"]) else None
            
            new_team = {
                "name": name,
                "description": desc,
                "department": dept,
                "mentor_name": mentor,
            }
            
            res = supabase.table("teams").insert(new_team).execute()
            if not res.data:
                errors.append(f"Row {idx+2}: Failed to create team '{name}'")
                continue
            
            existing_names.add(name.lower())
            success_count += 1
            
        except Exception as e:
            errors.append(f"Row {idx+2}: Error - {str(e)}")

    return {
        "message": f"Import complete. Imported {success_count}, Skipped {skipped_count}",
        "success": success_count,
        "skipped": skipped_count,
        "errors": errors[:50]
    }


@router.put("/{team_id}", response_model=TeamOut)
def update_team(
    team_id: int, 
    req: TeamUpdate, 
    current_user: dict = Depends(require_roles("admin"))
):
    supabase = get_supabase()
    existing = supabase.table("teams").select("*").eq("id", team_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Team not found")
        
    update_data = req.model_dump(exclude_unset=True, exclude={"student_ids"})
    if update_data:
        res = supabase.table("teams").update(update_data).eq("id", team_id).execute()
        team = res.data[0]
    else:
        team = existing.data[0]
        
    if req.student_ids is not None:
        if len(req.student_ids) != len(set(req.student_ids)):
            raise HTTPException(status_code=400, detail="Duplicate students in the selection")

        students_res = supabase.table("students").select("id, team_id, user:users(is_active)").in_("id", req.student_ids).execute()
        found_ids = {s["id"] for s in (students_res.data or [])}
        for s_id in req.student_ids:
            if s_id not in found_ids:
                raise HTTPException(status_code=400, detail=f"Student ID {s_id} does not exist")
        for s in students_res.data:
            if not s.get("user", {}).get("is_active"):
                raise HTTPException(status_code=400, detail=f"Student ID {s['id']} is not active")
            if s.get("team_id") and s.get("team_id") != team_id:
                raise HTTPException(status_code=400, detail=f"Student ID {s['id']} is already in another team")

        supabase.table("students").update({"team_id": None}).eq("team_id", team_id).execute()
        if req.student_ids:
            supabase.table("students").update({"team_id": team_id}).in_("id", req.student_ids).execute()
    
    member_res = supabase.table("students").select("id", count="exact").eq("team_id", team["id"]).execute()
    team["member_count"] = member_res.count if member_res.count is not None else 0
    
    log_admin_action(current_user["id"], "update", "teams", team["id"], old_value=existing.data[0], new_value=team)
    broadcast_notification("Team Updated", f"Team '{team['name']}' has been updated.")
    
    return team


@router.delete("/{team_id}")
def delete_team(
    team_id: int, 
    current_user: dict = Depends(require_roles("admin"))
):
    supabase = get_supabase()
    existing = supabase.table("teams").select("id").eq("id", team_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Team not found")
        
    supabase.table("teams").delete().eq("id", team_id).execute()
    log_admin_action(current_user["id"], "delete", "teams", team_id, old_value=existing.data[0])
    return {"message": "Team deleted successfully"}


@router.get("/{team_id}/members")
def get_team_members(
    team_id: int, 
    current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    res = supabase.table("students").select("*, user:users(*)").eq("team_id", team_id).execute()
    
    members = []
    for s in res.data:
        user_info = s.get("user", {})
        members.append({
            "id": s["id"],
            "user_id": s["user_id"],
            "name": user_info.get("full_name"),
            "ic_number": user_info.get("ic_number"),
            "department": s.get("department")
        })
    return members
