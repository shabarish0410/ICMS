import sqlite3
import os

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "spark.db"))
print(f"Inspecting database: {db_path}")

if not os.path.exists(db_path):
    print("Database file does not exist!")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get list of tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = [row[0] for row in cursor.fetchall()]
print("\n--- List of Tables in spark.db ---")
for t in tables:
    print(f"- {t}")

# Get roles
print("\n--- Roles Seeded ---")
try:
    cursor.execute("SELECT id, name, description FROM roles;")
    for row in cursor.fetchall():
        print(f"Role ID {row[0]}: Name: {row[1]}, Description: {row[2]}")
except Exception as e:
    print(f"Error querying roles: {e}")

# Get users
print("\n--- Users Seeded ---")
try:
    cursor.execute("SELECT id, ic_number, full_name, email, role_id, is_active, is_profile_completed FROM users;")
    for row in cursor.fetchall():
        print(f"User ID {row[0]}: IC: {row[1]}, Name: {row[2]}, Email: {row[3]}, Role ID: {row[4]}, Active: {row[5]}, Profile Completed: {row[6]}")
except Exception as e:
    print(f"Error querying users: {e}")

conn.close()
