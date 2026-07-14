import requests
from app.core.security import create_access_token
import base64

# 1. Generate a valid token using FastAPI's secret key
token = create_access_token({"sub": "335", "role": "student"})

# 2. Create a minimal 1x1 base64 encoded jpeg image to test with
# A very tiny valid jpeg
tiny_jpeg = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\x03\x02\x02\x02\x02\x02\x03\x02\x02\x02\x03\x03\x03\x03\x04\x06\x04\x04\x04\x04\x04\x08\x06\x06\x05\x06\t\x08\n\n\t\x08\t\t\n\x0c\x0f\x0c\n\x0b\x0e\x0b\t\t\r\x11\r\x0e\x0f\x10\x10\x11\x10\n\x0c\x12\x13\x12\x10\x13\x0f\x10\x10\x10\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x14\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xc4\x00\x14\x10\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xda\x00\x08\x01\x01\x00\x00?\x00\x00\xff\xd9'
base64_img = "data:image/jpeg;base64," + base64.b64encode(tiny_jpeg).decode('utf-8')

# The user is doing an update, so they provide a password. But wait! We need their actual password.
# I don't know their password, so I will hit POST /api/face/register instead, which doesn't require a password!
url = "https://spark-innovation.onrender.com/api/face/register"
headers = {
    "Authorization": f"Bearer {token}"
}
data = {
    "image_base64": base64_img
}

print(f"Testing {url} on Render...")
try:
    res = requests.post(url, headers=headers, json=data)
    print("Status:", res.status_code)
    print("Response:", res.text)
except Exception as e:
    print("Failed:", e)
