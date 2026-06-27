import requests
import json

base_url = "http://127.0.0.1:8000/api/auth"

def test_flow():
    print("1. Testing /login endpoint...")
    try:
        res = requests.post(
            f"{base_url}/login",
            json={"ic_number": "admin", "password": "password123"}
        )
        print(f"Login Status: {res.status_code}")
        print(f"Login Response: {res.text}")
        
        if res.status_code != 200:
            print("Login failed, aborting flow test.")
            return

        data = res.json()
        token = data.get("access_token")
        print(f"Extracted Token: {token[:20]}..." if token else "No token found!")
        
        print("\n2. Testing /me endpoint...")
        headers = {"Authorization": f"Bearer {token}"}
        res2 = requests.get(f"{base_url}/me", headers=headers)
        print(f"Me Status: {res2.status_code}")
        print(f"Me Response: {res2.text}")
        
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_flow()
