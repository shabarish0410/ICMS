import sys
import os
from sqlalchemy import inspect

# Add backend root to sys.path to allow imports from app
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.core.database import SessionLocal, get_engine, Base
from app.core.security import verify_password
from app.models import User, Role

def test_connection():
    print("=" * 60)
    print("🚀 SPARK INNOVATION CENTER - DATABASE & AUTH DIAGNOSTIC")
    print("=" * 60)
    print(f"Configured DATABASE_URL: {settings.DATABASE_URL}")
    
    try:
        engine = get_engine()
        
        # Test connection by creating tables if they don't exist!
        # This solves the empty database issue on Supabase.
        print("\nChecking schema and creating tables if missing...")
        Base.metadata.create_all(bind=engine)
        
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"✅ Connection: SUCCESS")
        print(f"📁 Tables found ({len(tables)}): {', '.join(tables)}")
    except Exception as e:
        print(f"❌ Connection: FAILED")
        print(f"Error detail: {e}")
        return

    # Check users
    print("\n" + "=" * 60)
    print("👤 USER & PASSWORD VERIFICATION TEST")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        users = db.query(User).all()
        if not users:
            print("⚠️ No users found in database.")
            print("   (Run your FastAPI server to automatically seed the admin user)")
            return
            
        print(f"Found {len(users)} user(s):")
        for u in users:
            role_name = u.role.name if u.role else f"Role ID: {u.role_id}"
            print(f"\n- IC Number: {u.ic_number}")
            print(f"  Name:      {u.full_name}")
            print(f"  Role:      {role_name}")
            print(f"  Active:    {u.is_active}")
            print(f"  Hash:      {u.password_hash[:15]}...")
            
            # Test default passwords based on role/details
            test_passwords = ["Admin@123", f"spark@{u.ic_number}"]
            print(f"  Verifying passwords:")
            for pwd in test_passwords:
                match = verify_password(pwd, u.password_hash)
                status_icon = "🔑 PASS" if match else "❌ FAIL"
                print(f"    - Attempt '{pwd}': {status_icon}")
                
    except Exception as e:
        print(f"❌ Query Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_connection()
