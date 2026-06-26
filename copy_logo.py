import shutil
import os

# Path to the newly uploaded actual Spark Logo
source_path = r"C:\Users\shaba\.gemini\antigravity\brain\465d584c-598f-4231-b9db-6199421c7f3d\media__1782496016727.jpg"
dest_dir = r"D:\ICMS\frontend\public"
dest_path = os.path.join(dest_dir, "logo.jpg")

print(f"Copying {source_path} to {dest_path}...")
try:
    os.makedirs(dest_dir, exist_ok=True)
    shutil.copy2(source_path, dest_path)
    print("✅ Successfully copied the REAL Spark Logo! Please refresh your browser.")
except Exception as e:
    print(f"❌ Failed to copy the logo: {e}")
