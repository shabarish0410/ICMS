from app.core.supabase import get_supabase

def test():
    try:
        supabase = get_supabase()
        res = supabase.table("users").select("*, role:roles(id, name), student:students(*)").limit(1).execute()
        print("Success:", len(res.data))
    except Exception as e:
        print("Error:", str(e))

if __name__ == "__main__":
    test()
