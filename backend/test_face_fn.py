import asyncio
from app.core.security import create_access_token
from app.core.supabase import get_supabase
from app.routes.face import update_face
from app.schemas import FaceUpdateRequest
import base64
from unittest.mock import patch

supabase = get_supabase()
res = supabase.table("users").select("id").eq("role_id", 2).limit(1).execute()
user_id = res.data[0]["id"]
current_user = {"id": user_id, "role": {"name": "student"}, "student": [{"id": 1}]}

# 100 chars
base64_img = "data:image/jpeg;base64,/9j/4AAQSkZJRg==" + "A" * 100

req = FaceUpdateRequest(image_base64=base64_img, password="wrongpassword")

print("Calling update_face...")
try:
    with patch('app.routes.face.pwd_context.verify', return_value=True), \
         patch('app.routes.face.validate_face_image', return_value={"valid": True, "reason": "OK"}), \
         patch('app.routes.face.generate_face_embedding', return_value=[0.1]*512), \
         patch('app.routes.face.upload_image_to_drive', return_value=("file123", "url123")):
        
        update_face(req, current_user)
        print("Success!")
except Exception as e:
    import traceback
    traceback.print_exc()
