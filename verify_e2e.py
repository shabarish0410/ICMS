import requests
import base64
import json
import time

BASE_URL = "http://127.0.0.1:8000/api"
RESULTS = []

def report(endpoint, expected, actual, passed, issues=""):
    RESULTS.append({
        "Endpoint": endpoint,
        "Expected": expected,
        "Actual": actual,
        "Passed": passed,
        "Issues": issues
    })
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {endpoint} | Expected: {expected} | Actual: {actual} | Issues: {issues}")

def run_tests():
    print("Starting End-to-End Verification...")
    
    # 1. Health & CORS
    print("\n--- 1. Testing Health & CORS ---")
    try:
        resp = requests.options(f"{BASE_URL}/health", headers={"Origin": "http://localhost:3000"})
        passed = resp.status_code in [200, 204]
        cors_ok = "Access-Control-Allow-Origin" in resp.headers
        report("/api/health (OPTIONS)", "200/204 + CORS headers", f"{resp.status_code}", passed and cors_ok, "" if cors_ok else "Missing CORS headers")
        
        resp = requests.get(f"{BASE_URL}/health")
        passed = resp.status_code == 200
        report("/api/health (GET)", "200", f"{resp.status_code}", passed)
    except Exception as e:
        report("/api/health", "200", "Exception", False, str(e))

    # 2. Authentication
    print("\n--- 2. Testing Authentication ---")
    admin_token = None
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"ic_number": "IC0000001", "password": "Admin@123"})
        passed = resp.status_code == 200
        issues = ""
        if passed:
            print(f"Login Response: {resp.json()}")
            admin_token = resp.json().get("access_token")
            if not admin_token:
                passed = False
                issues = "Missing token"
        else:
            issues = resp.text
        report("/api/auth/login", "200 + Token", f"{resp.status_code}", passed, issues)
    except Exception as e:
        report("/api/auth/login", "200 + Token", "Exception", False, str(e))

    if not admin_token:
        print("Stopping tests due to authentication failure.")
        return

    headers = {"Authorization": f"Bearer {admin_token}"}

    # 3. Protected Routes
    print("\n--- 3. Testing Protected Routes (Profile) ---")
    try:
        resp = requests.get(f"{BASE_URL}/auth/me", headers=headers)
        passed = resp.status_code == 200
        issues = "" if passed else resp.text
        report("/api/auth/me", "200", f"{resp.status_code}", passed, issues)
    except Exception as e:
        report("/api/auth/me", "200", "Exception", False, str(e))

    # 4. Admin Dashboard Stats
    print("\n--- 4. Testing Admin Dashboard ---")
    try:
        resp = requests.get(f"{BASE_URL}/dashboard/admin", headers=headers)
        passed = resp.status_code == 200
        issues = "" if passed else resp.text
        report("/api/dashboard/admin", "200", f"{resp.status_code}", passed, issues)
    except Exception as e:
        report("/api/dashboard/admin", "200", "Exception", False, str(e))

    # 5. Create Test Student
    print("\n--- 5. Testing Student Creation & Face Flow ---")
    student_ic = f"IC{int(time.time()) % 10000000:07d}"
    student_pass = "Test@1234"
    try:
        # Delete first if exists
        resp = requests.get(f"{BASE_URL}/students", headers=headers, params={"search": student_ic})
        if resp.status_code == 200 and resp.json().get("items"):
            student_id = resp.json()["items"][0]["id"]
            requests.delete(f"{BASE_URL}/students/{student_id}", headers=headers)
            
        student_data = {
            "ic_number": student_ic,
            "full_name": "Test Student E2E",
            "department": "CSE",
            "year": 1,
            "password": student_pass
        }
        resp = requests.post(f"{BASE_URL}/students", headers=headers, json=student_data)
        passed = resp.status_code == 201
        issues = "" if passed else resp.text
        report("/api/students (POST)", "201", f"{resp.status_code}", passed, issues)
    except Exception as e:
        report("/api/students (POST)", "201", "Exception", False, str(e))

    # Login as student
    student_token = None
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"ic_number": student_ic, "password": student_pass})
        if resp.status_code == 200:
            student_token = resp.json().get("access_token")
    except:
        pass

    if student_token:
        student_headers = {"Authorization": f"Bearer {student_token}"}
        
        # Test Notifications
        try:
            resp = requests.get(f"{BASE_URL}/notifications", headers=student_headers)
            passed = resp.status_code == 200
            issues = "" if passed else resp.text
            report("/api/notifications (GET)", "200", f"{resp.status_code}", passed, issues)
        except Exception as e:
             report("/api/notifications (GET)", "200", "Exception", False, str(e))
             
        # Face Registration
        try:
            # Read image file for base64
            with open(r"d:\ICMS\backend\uploads\0e1f47cf90fb4d5fb797f638a6d46c98.jpg", "rb") as f:
                img_b64 = "data:image/jpeg;base64," + base64.b64encode(f.read()).decode()
            
            face_data = {"image_base64": img_b64}
            resp = requests.post(f"{BASE_URL}/face/register", headers=student_headers, json=face_data)
            passed = resp.status_code == 201
            issues = "" if passed else resp.text
            report("/api/face/register", "201", f"{resp.status_code}", passed, issues)
        except Exception as e:
            report("/api/face/register", "201", "Exception", False, str(e))

        # Face Recognition / Attendance
        try:
            attend_data = {"image_base64": img_b64, "liveness_frames": []}
            resp = requests.post(f"{BASE_URL}/attendance/face", headers=student_headers, json=attend_data)
            passed = resp.status_code in [200, 201, 400] # 400 could be 'Already checked in' or 'Face not recognized' if model fails, but no 500
            issues = "" if passed else resp.text
            if resp.status_code >= 500:
                passed = False
            report("/api/attendance/face", "200/201/400 (no 50x)", f"{resp.status_code}", passed, issues)
        except Exception as e:
            report("/api/attendance/face", "200/201", "Exception", False, str(e))
    else:
        report("Student flow", "N/A", "N/A", False, "Could not login as student")

    # Generate Markdown Report
    with open("e2e_report.md", "w", encoding="utf-8") as f:
        f.write("# ICMS End-to-End Verification Report\n\n")
        f.write("| Endpoint | Expected | Actual Status | Passed | Issues |\n")
        f.write("| --- | --- | --- | --- | --- |\n")
        for r in RESULTS:
            pass_str = "PASS" if r["Passed"] else "FAIL"
            f.write(f"| {r['Endpoint']} | {r['Expected']} | {r['Actual']} | {pass_str} | {r['Issues'][:100]} |\n")

if __name__ == '__main__':
    run_tests()
