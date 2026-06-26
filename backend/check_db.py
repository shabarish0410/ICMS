"""Quick diagnostic script to check database state."""
import os
import sys

# Check if icms.db exists in expected locations
backend_dir = os.path.dirname(os.path.abspath(__file__))
possible_paths = [
    os.path.join(backend_dir, "icms.db"),
    os.path.join(backend_dir, "spark.db"),
    os.path.join(os.path.dirname(backend_dir), "icms.db"),
]

print("=== Database File Check ===")
for p in possible_paths:
    exists = os.path.exists(p)
    print(f"  {p}: {'EXISTS' if exists else 'NOT FOUND'}")

# Check .env
env_path = os.path.join(backend_dir, ".env")
print(f"\n=== .env file ({env_path}) ===")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if "DATABASE" in line or "CORS" in line:
                print(f"  {line.strip()}")
else:
    print("  .env NOT FOUND!")

# Check .db_cleaned
lock_path = os.path.join(backend_dir, "app", ".db_cleaned")
print(f"\n=== Lock file ===")
print(f"  {lock_path}: {'EXISTS' if os.path.exists(lock_path) else 'NOT FOUND (good - will trigger fresh setup)'}")

# Try importing the database module to see resolved URL
print("\n=== Resolved DATABASE_URL ===")
try:
    sys.path.insert(0, backend_dir)
    os.chdir(backend_dir)
    from app.core.database import DATABASE_URL
    print(f"  {DATABASE_URL}")
except Exception as e:
    print(f"  Error: {e}")

# If DB exists, check users
db_path = os.path.join(backend_dir, "icms.db")
if os.path.exists(db_path):
    import sqlite3
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT ic_number, full_name, is_active FROM users")
        users = cursor.fetchall()
        print(f"\n=== Users in DB ({len(users)} total) ===")
        for u in users:
            print(f"  IC: {u[0]} | Name: {u[1]} | Active: {u[2]}")
    except Exception as e:
        print(f"\n=== Users table error: {e}")
    conn.close()
else:
    print(f"\n=== No icms.db found - cannot check users ===")
