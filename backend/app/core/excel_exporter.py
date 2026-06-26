import os
import csv
import sqlite3
from app.core.config import settings

def export_to_csv():
    """Reads SQLite database and exports tables to Excel-compatible CSV files in backend directory."""
    db_url = settings.DATABASE_URL
    if db_url.startswith("sqlite:///"):
        db_path = db_url.replace("sqlite:///", "")
        if not os.path.isabs(db_path):
            backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            db_path = os.path.abspath(os.path.join(backend_root, db_path))
    else:
        # Export logic currently tailored for local SQLite setup
        return

    if not os.path.exists(db_path):
        print(f"Database file not found at {db_path}, skipping CSV export.")
        return

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # List of tables to track and export
        tables_to_export = [
            "users", 
            "students", 
            "teams", 
            "projects", 
            "attendance", 
            "activity_logs"
        ]
        
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

        for table in tables_to_export:
            # Get table structure (column headers)
            cursor.execute(f"PRAGMA table_info({table});")
            columns = [col[1] for col in cursor.fetchall()]

            # Fetch all rows from table
            cursor.execute(f"SELECT * FROM {table};")
            rows = cursor.fetchall()

            # Write to CSV in the backend directory
            csv_path = os.path.join(backend_dir, f"{table}_export.csv")
            with open(csv_path, mode="w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(columns)
                writer.writerows(rows)
            
        conn.close()
        print("📊 Automatically exported database changes to CSV files successfully!")
    except Exception as e:
        print(f"Error during auto-exporting database to CSV: {e}")
