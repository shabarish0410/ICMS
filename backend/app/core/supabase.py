from supabase import create_client
import os
from dotenv import load_dotenv

# Ensure .env is loaded (useful if running scripts directly)
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# The backend MUST use the Service Role Key to bypass RLS and perform admin operations
supabase = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
)

def get_supabase():
    return supabase
