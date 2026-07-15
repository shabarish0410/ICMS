import logging
import json
import traceback
import time
from typing import Optional, Any

# Ensure we log in structured format
class StructuredFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_obj = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "request_id"):
            log_obj["request_id"] = record.request_id
        if hasattr(record, "student_id"):
            log_obj["student_id"] = record.student_id
        if hasattr(record, "route"):
            log_obj["route"] = record.route
        if hasattr(record, "step"):
            log_obj["step"] = record.step
        if hasattr(record, "execution_time_ms"):
            log_obj["execution_time_ms"] = record.execution_time_ms
        if hasattr(record, "status"):
            log_obj["status"] = record.status
            
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
            
        return json.dumps(log_obj)

def get_structured_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = StructuredFormatter()
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    return logger

def log_step(
    logger: logging.Logger,
    level: int,
    message: str,
    request_id: str,
    student_id: Optional[int] = None,
    route: Optional[str] = None,
    step: Optional[str] = None,
    status: Optional[str] = None,
    start_time: Optional[float] = None,
    exc_info: bool = False
):
    extra: dict[str, Any] = {
        "request_id": request_id,
        "student_id": student_id,
        "route": route,
        "step": step,
        "status": status,
    }
    if start_time is not None:
        extra["execution_time_ms"] = round((time.monotonic() - start_time) * 1000, 2)
        
    logger.log(level, message, extra=extra, exc_info=exc_info)
