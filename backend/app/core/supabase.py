from pathlib import Path
from supabase import create_client
import os
from dotenv import load_dotenv

# Load backend/.env explicitly so env vars are available regardless of the working directory.
BASE_DIR = Path(__file__).resolve().parent.parent
DOTENV_PATH = BASE_DIR / ".env"
if DOTENV_PATH.exists():
    load_dotenv(DOTENV_PATH)
else:
    load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError(
        "Supabase configuration is missing. Ensure backend/.env contains SUPABASE_URL and SUPABASE_SERVICE_KEY."
    )

# The backend MUST use the Service Role Key to bypass RLS and perform admin operations
supabase = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
)

def get_supabase():
    return supabase
