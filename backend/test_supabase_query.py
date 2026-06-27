import sys
import os

# Add backend directory to sys.path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from app.core.supabase import get_supabase

def test():
    try:
        supabase = get_supabase()
        # Test the exact query
        res = supabase.table("users").select("*, role:roles(id, name)").limit(1).execute()
        with open("test_output.txt", "w") as f:
            f.write("Success! Data: " + str(res.data))
    except Exception as e:
        import traceback
        with open("test_output.txt", "w") as f:
            f.write("Error: " + str(e) + "\n" + traceback.format_exc())

if __name__ == "__main__":
    test()
