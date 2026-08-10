import sys, os, requests

sys.path.insert(0, r'd:\ICMS\backend')
from dotenv import load_dotenv
load_dotenv(r'd:\ICMS\backend\.env')

SUPABASE_URL = "https://fjdmijjsixtbamhwourc.supabase.co"
ANON_KEY = os.getenv('SUPABASE_ANON_KEY')

# Dummy session UUID
session_id = "00000000-0000-0000-0000-000000000000"
ic_number = "s"

headers = {
    "Authorization": f"Bearer {ANON_KEY}",
    "apikey": ANON_KEY,
    "Content-Type": "application/json"
}

print(f"Calling {SUPABASE_URL}/functions/v1/webauthn-auth-options...")

res = requests.post(
    f"{SUPABASE_URL}/functions/v1/webauthn-auth-options",
    headers=headers,
    json={"session_id": session_id, "ic_number": ic_number},
    timeout=10
)

print(f"Status: {res.status_code}")
print(f"Response: {res.text}")
