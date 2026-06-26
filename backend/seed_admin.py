import sys
import os

# Add backend directory to path so we can import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.supabase import get_supabase
from app.core.security import hash_password

def seed_admin():
    supabase = get_supabase()
    
    # 1. Ensure roles exist
    print("Checking roles...")
    roles_res = supabase.table("roles").select("*").execute()
    existing_roles = [r["name"] for r in roles_res.data]
    
    if "admin" not in existing_roles:
        print("Creating admin role...")
        supabase.table("roles").insert({"name": "admin", "description": "Full system access"}).execute()
        
    if "student" not in existing_roles:
        print("Creating student role...")
        supabase.table("roles").insert({"name": "student", "description": "Student access"}).execute()
        
    # Get admin role id
    admin_role_res = supabase.table("roles").select("id").eq("name", "admin").execute()
    admin_role_id = admin_role_res.data[0]["id"]
    
    # 2. Check if admin exists
    admin_res = supabase.table("users").select("*").eq("ic_number", "IC0000001").execute()
    if admin_res.data:
        print("Admin user already exists! Deleting and recreating for testing...")
        supabase.table("users").delete().eq("ic_number", "IC0000001").execute()
        
    # 3. Create Admin
    print("Creating admin user (IC0000001 / Admin@123)...")
    new_admin = {
        "ic_number": "IC0000001",
        "password_hash": hash_password("Admin@123"),
        "full_name": "Dr. Rajesh Kumar",
        "email": "admin@spark.edu",
        "mobile": "9876543210",
        "role_id": admin_role_id,
        "is_active": True,
        "is_profile_completed": True,
        "must_change_password": False
    }
    
    res = supabase.table("users").insert(new_admin).execute()
    if res.data:
        print("✅ Admin user created successfully!")
        print("IC Number: IC0000001")
        print("Password: Admin@123")
    else:
        print("❌ Failed to create admin user.")

if __name__ == "__main__":
    seed_admin()
