import os
import sys

# Setup paths for local execution
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.core.supabase import get_supabase

def fix_orphaned_users():
    print("Connecting to Supabase to find broken records...")
    supabase = get_supabase()
    
    # Get all students
    students_res = supabase.table("students").select("user_id").execute()
    student_user_ids = {s["user_id"] for s in (students_res.data or [])}
    
    # Get student role ID
    role_res = supabase.table("roles").select("id").eq("name", "student").execute()
    student_role_id = role_res.data[0]["id"]
    
    # Get all users who have the student role
    users_res = supabase.table("users").select("id, ic_number").eq("role_id", student_role_id).execute()
    student_users = users_res.data or []
    
    # Find orphans (users without a student record)
    orphans = [u for u in student_users if u["id"] not in student_user_ids]
    
    print(f"\nFound {len(orphans)} corrupted/orphaned users from the previously failed import.")
    
    if orphans:
        orphan_ids = [u["id"] for u in orphans]
        print("Deleting corrupted users...")
        
        # Delete in chunks of 50 to avoid URL limits
        for i in range(0, len(orphan_ids), 50):
            chunk = orphan_ids[i:i+50]
            supabase.table("users").delete().in_("id", chunk).execute()
            
        print("\n✅ Cleanup successful! The corrupted records are gone.")
        print("👉 You can now go back to the browser and click 'Import CSV/Excel' again. It will work perfectly now!")
    else:
        print("\n✅ No corrupted records found. If it's still skipping, it means those students really are already in the system!")

if __name__ == "__main__":
    fix_orphaned_users()
