import os
import csv
import sqlite3
from app.core.config import settings

import os
import csv
from app.core.config import settings

def export_to_csv():
    """Reads Supabase database and exports tables to Excel-compatible CSV files in backend directory."""
    try:
        from app.core.supabase import get_supabase
        supabase = get_supabase()
        
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
        os.makedirs(os.path.join(backend_dir, "exports"), exist_ok=True)

        for table in tables_to_export:
            # Fetch all rows from table
            res = supabase.table(table).select("*").execute()
            rows = res.data
            
            if not rows:
                continue

            # Get table structure (column headers)
            columns = list(rows[0].keys())

            # Write to CSV in the backend/exports directory
            csv_path = os.path.join(backend_dir, "exports", f"{table}_export.csv")
            with open(csv_path, mode="w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(columns)
                for row in rows:
                    writer.writerow([row.get(col) for col in columns])
            
        print("📊 Automatically exported database changes to CSV files successfully!")
    except Exception as e:
        print(f"Error during auto-exporting database to CSV: {e}")
