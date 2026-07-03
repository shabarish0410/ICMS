import sys
import os
import asyncio

# Setup paths for local testing
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.core.supabase import get_supabase
from app.core.security import hash_password

supabase = get_supabase()

def test_insert():
    print("Testing user insert...")
    # Get student role
    role_res = supabase.table("roles").select("id").eq("name", "student").execute()
    if not role_res.data:
        print("Student role not found")
        return
    role_id = role_res.data[0]["id"]
    
    ic = "IC9999991"
    
    users_to_insert = [{
        "ic_number": ic,
        "password_hash": hash_password(ic),
        "full_name": "Test Student",
        "email": None,
        "mobile": None,
        "role_id": role_id,
        "is_active": True,
        "is_profile_completed": False,
        "must_change_password": True,
    }]
    
    try:
        user_res = supabase.table("users").insert(users_to_insert).execute()
        print("User insert success:", user_res.data)
        
        uid = user_res.data[0]["id"]
        
        students_to_insert = [{
            "user_id": uid,
            "department": "CSM",
            "year": 3,
            "semester": 5,
            "section": None,
            "mentor_name": None,
            "team_id": None,
        }]
        
        student_res = supabase.table("students").insert(students_to_insert).execute()
        print("Student insert success:", student_res.data)
        
        # Cleanup
        supabase.table("students").delete().eq("user_id", uid).execute()
        supabase.table("users").delete().eq("id", uid).execute()
        
    except Exception as e:
        print("ERROR:", str(e))

if __name__ == "__main__":
    test_insert()
