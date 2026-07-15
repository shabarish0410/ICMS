import time
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger("icms.request")

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()
        
        # Extract client IP safely
        client_ip = request.client.host if request.client else "Unknown"
        
        # Log incoming request
        logger.info(f"Incoming Request: {request.method} {request.url.path} from IP: {client_ip}")

        try:
            response = await call_next(request)
            process_time = (time.time() - start_time) * 1000
            
            # Log outgoing response
            logger.info(f"Completed Request: {request.method} {request.url.path} - Status: {response.status_code} - Time: {process_time:.2f}ms")
            
            # Optionally add process time header
            response.headers["X-Process-Time"] = str(process_time)
            
            return response
            
        except Exception as exc:
            process_time = (time.time() - start_time) * 1000
            logger.error(f"Failed Request: {request.method} {request.url.path} - Exception: {str(exc)} - Time: {process_time:.2f}ms")
            raise exc
