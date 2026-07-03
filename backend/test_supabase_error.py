import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.core.supabase import get_supabase
from app.core.security import hash_password

supabase = get_supabase()

def test_insert():
    try:
        role_res = supabase.table("roles").select("id").eq("name", "student").execute()
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
        
        user_res = supabase.table("users").insert(users_to_insert).execute()
        
        # Cleanup
        supabase.table("users").delete().eq("ic_number", ic).execute()
        with open("error_output.txt", "w") as f:
            f.write("SUCCESS")
            
    except Exception as e:
        with open("error_output.txt", "w") as f:
            f.write("ERROR: " + str(e))

if __name__ == "__main__":
    test_insert()
