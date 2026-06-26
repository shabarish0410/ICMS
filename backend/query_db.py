import sqlite3
import os

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "spark.db"))
print(f"Connecting to database: {db_path}\n")

if not os.path.exists(db_path):
    print("Database file spark.db does not exist!")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get users
print("=== Users in database ===")
try:
    cursor.execute("SELECT id, ic_number, full_name, email, role_id, is_active FROM users;")
    rows = cursor.fetchall()
    if not rows:
        print("No users found.")
    for row in rows:
        print(f"ID: {row[0]} | IC: {row[1]} | Name: {row[2]} | Email: {row[3]} | Role ID: {row[4]} | Active: {row[5]}")
except Exception as e:
    print(f"Error querying users: {e}")

# Get students
print("\n=== Students in database ===")
try:
    cursor.execute("SELECT id, user_id, department, year, semester, mentor_name FROM students;")
    rows = cursor.fetchall()
    if not rows:
        print("No students found.")
    for row in rows:
        print(f"ID: {row[0]} | User ID: {row[1]} | Dept: {row[2]} | Year: {row[3]} | Sem: {row[4]} | Mentor: {row[5]}")
except Exception as e:
    print(f"Error querying students: {e}")

conn.close()
