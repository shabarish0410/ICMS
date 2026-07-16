import asyncio
import os
import sys
import unittest
from unittest.mock import patch, AsyncMock, MagicMock

# Add backend to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.schemas import FaceRegisterRequest
from app.services.face.registration import _run_pipeline_async, register_face
from app.core.exceptions import ValidationError, BusinessLogicError

class TestFaceFailures(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_user = {"id": "test-uuid", "student": {"id": 123}, "role": {"name": "student"}}
        self.req = FaceRegisterRequest(image_base64="valid_base64_string_that_is_at_least_100_characters_long_012345678901234567890123456789012345678901234567890")

    @patch('app.services.face.registration.decode_base64_image')
    @patch('app.services.face.registration.get_existing_face_metadata', return_value={})
    async def test_1_decode_failure(self, mock_get_existing, mock_decode):
        mock_decode.side_effect = ValueError("Invalid base64")
        with self.assertRaises(ValidationError) as ctx:
            await register_face(self.req, self.mock_user)
        self.assertIn("Image decode failed", str(ctx.exception))

    @patch('app.services.face.registration.decode_base64_image', return_value=b"fake")
    @patch('app.services.face.registration.compress_image', return_value=b"fake")
    @patch('app.services.face.registration.hash_image', return_value="hash")
    @patch('app.services.face.registration.detect_and_validate_face')
    @patch('app.services.face.registration.get_existing_face_metadata', return_value={})
    async def test_2_validation_failure(self, mock_get, mock_validate, *args):
        mock_validate.return_value = {"valid": False, "reason": "Face too blurred"}
        with self.assertRaises(ValidationError) as ctx:
            await register_face(self.req, self.mock_user)
        self.assertIn("Face too blurred", str(ctx.exception))

    @patch('app.services.face.registration.decode_base64_image', return_value=b"fake")
    @patch('app.services.face.registration.compress_image', return_value=b"fake")
    @patch('app.services.face.registration.hash_image', return_value="hash")
    @patch('app.services.face.registration.detect_and_validate_face')
    @patch('app.services.face.registration.generate_face_embedding')
    @patch('app.services.face.registration.get_existing_face_metadata', return_value={})
    async def test_3_embedding_failure(self, mock_get, mock_embed, mock_validate, *args):
        mock_validate.return_value = {"valid": True, "aligned_face": b"fake", "confidence": 0.99, "quality_score": 90}
        mock_embed.return_value = None
        with self.assertRaises(BusinessLogicError) as ctx:
            await register_face(self.req, self.mock_user)
        self.assertEqual(ctx.exception.status_code, 422)

    @patch('app.services.face.registration.decode_base64_image', return_value=b"fake")
    @patch('app.services.face.registration.compress_image', return_value=b"fake")
    @patch('app.services.face.registration.hash_image', return_value="hash")
    @patch('app.services.face.registration.detect_and_validate_face')
    @patch('app.services.face.registration.generate_face_embedding', return_value=[0.1]*512)
    @patch('app.services.face.registration.upload_face_image')
    @patch('app.services.face.registration.get_existing_face_metadata', return_value={})
    async def test_4_drive_failure(self, mock_get, mock_upload, mock_embed, mock_validate, *args):
        mock_validate.return_value = {"valid": True, "aligned_face": b"fake", "confidence": 0.99, "quality_score": 90}
        mock_upload.side_effect = RuntimeError("Drive API timeout")
        with self.assertRaises(BusinessLogicError) as ctx:
            await register_face(self.req, self.mock_user)
        self.assertEqual(ctx.exception.status_code, 502)

    @patch('app.services.face.registration.decode_base64_image', return_value=b"fake")
    @patch('app.services.face.registration.compress_image', return_value=b"fake")
    @patch('app.services.face.registration.hash_image', return_value="hash")
    @patch('app.services.face.registration.detect_and_validate_face')
    @patch('app.services.face.registration.generate_face_embedding', return_value=[0.1]*512)
    @patch('app.services.face.registration.upload_face_image', return_value={"file_id": "drv123", "web_view_link": "link", "direct_download_link": "link", "upload_size_bytes": 100})
    @patch('app.services.face.registration.save_face_registration')
    @patch('app.services.face.registration.delete_face_image')
    @patch('app.services.face.registration.get_existing_face_metadata', return_value={})
    async def test_5_db_failure_triggers_rollback(self, mock_get, mock_delete, mock_save, mock_upload, mock_embed, mock_validate, *args):
        mock_validate.return_value = {"valid": True, "aligned_face": b"fake", "confidence": 0.99, "quality_score": 90}
        mock_save.side_effect = Exception("Supabase constraint violation")
        with self.assertRaises(BusinessLogicError) as ctx:
            await register_face(self.req, self.mock_user)
        self.assertEqual(ctx.exception.status_code, 500)
        # Verify rollback was called for the new file id
        mock_delete.assert_called_once_with("drv123")

    @patch('app.services.face.registration.check_idempotency')
    async def test_6_idempotency(self, mock_check):
        mock_check.return_value = {"status": "completed", "result_json": {"success": True, "cached": True}}
        res = await register_face(self.req, self.mock_user, idempotency_key="ik123")
        self.assertTrue(res["success"])
        self.assertTrue(res["cached"])

if __name__ == '__main__':
    unittest.main()
