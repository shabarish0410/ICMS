from typing import Any, Dict, Optional

class ICMSException(Exception):
    """Base class for all custom ICMS exceptions."""
    def __init__(self, message: str, status_code: int = 500, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.status_code = status_code
        self.details = details
        super().__init__(self.message)

class NotFoundError(ICMSException):
    """Exception raised when a resource is not found."""
    def __init__(self, message: str = "Resource not found", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=404, details=details)

class PermissionDeniedError(ICMSException):
    """Exception raised when the user lacks required permissions."""
    def __init__(self, message: str = "Permission denied", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=403, details=details)

class ValidationError(ICMSException):
    """Exception raised for data validation errors."""
    def __init__(self, message: str = "Validation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=400, details=details)

class BusinessLogicError(ICMSException):
    """Exception raised when a business rule is violated."""
    def __init__(self, message: str, status_code: int = 400, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=status_code, details=details)
