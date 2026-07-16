import asyncio
import os
import sys
import time
from unittest.mock import patch, MagicMock, AsyncMock

# Add backend to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.schemas import FaceRegisterRequest
from app.services.face.registration import register_face

async def _mock_run_in_executor(loop, func, *args):
    """Mocks run_in_executor to add slight latency but otherwise return fake data."""
    await asyncio.sleep(0.01) # Simulate IO/CPU time
    
    fname = func.__name__
    if fname == "get_existing_face_metadata": return {}
    if fname == "decode_base64_image": return b"fake_bytes"
    if fname == "compress_image": return b"compressed_bytes"
    if fname == "hash_image": return f"hash_{time.time()}"
    if fname == "detect_and_validate_face": 
        return {"valid": True, "aligned_face": b"fake", "confidence": 0.99, "quality_score": 95}
    if fname == "validate_liveness_metrics":
        return {"passed": True, "reason": "OK"}
    if fname == "generate_face_embedding": return [0.1]*512
    if fname == "upload_face_image": 
        return {"file_id": f"drv_{time.time()}", "web_view_link": "link", "direct_download_link": "link", "upload_size_bytes": 1024}
    if fname == "save_face_registration": return 1
    if fname == "verify_face_registration": return True
    if fname == "delete_face_image": return None
    
    return None

async def run_concurrent_load_test(num_requests=20):
    print(f"Starting load test with {num_requests} concurrent face registrations...")
    
    req = FaceRegisterRequest(image_base64="valid_base64_string_that_is_at_least_100_characters_long_012345678901234567890123456789012345678901234567890")
    
    # We patch run_in_executor to avoid needing real models/DB during the test script
    # We're testing the pipeline's async orchestration and locking mechanics.
    with patch('asyncio.events.AbstractEventLoop.run_in_executor', side_effect=_mock_run_in_executor):
        with patch('app.services.face.registration.get_supabase'):
            with patch('app.services.face.registration.check_idempotency', return_value=None):
                with patch('app.services.face.registration.set_idempotency', return_value=None):
                    start_time = time.time()
                    
                    tasks = []
                    for i in range(num_requests):
                        mock_user = {"id": f"uuid-{i}", "student": {"id": i}, "role": {"name": "student"}}
                        task = asyncio.create_task(register_face(req, mock_user, idempotency_key=f"load-{i}"))
                        tasks.append(task)
                    
                    results = await asyncio.gather(*tasks, return_exceptions=True)
            
            duration = time.time() - start_time
            print(f"Completed {num_requests} requests in {duration:.2f} seconds.")
            
            success_count = sum(1 for r in results if isinstance(r, dict) and r.get("success"))
            error_count = num_requests - success_count
            
            print(f"Successes: {success_count}")
            print(f"Errors: {error_count}")
            
            if error_count > 0:
                print("First error encountered:", next(r for r in results if not isinstance(r, dict) or not r.get("success")))
            
            assert success_count == num_requests, "Not all requests succeeded!"
            print("Load test passed! All concurrency handled safely.")

if __name__ == '__main__':
    asyncio.run(run_concurrent_load_test(20))
