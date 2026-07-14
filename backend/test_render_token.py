import requests
from app.core.security import create_access_token

# Generate a valid token using FastAPI's secret key
token = create_access_token({"sub": "335", "role": "student"})

print("Generated Token:", token)

url = "https://spark-innovation.onrender.com/api/notifications/unread-count"
headers = {
    "Authorization": f"Bearer {token}"
}

print(f"Testing {url} on Render...")
try:
    res = requests.get(url, headers=headers)
    print("Status:", res.status_code)
    print("Response:", res.text)
except Exception as e:
    print("Failed:", e)
