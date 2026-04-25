from django.core.exceptions import (
    ObjectDoesNotExist,
    PermissionDenied,
    ValidationError as DjangoValidationError,
)
from rest_framework import status
from rest_framework.exceptions import (
    APIException,
    AuthenticationFailed,
    MethodNotAllowed,
    NotAuthenticated,
    NotFound,
    ParseError,
    PermissionDenied as DRFPermissionDenied,
    Throttled,
    UnsupportedMediaType,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


_STATUS_CODE_MAP = {
    ValidationError: status.HTTP_422_UNPROCESSABLE_ENTITY,
    NotAuthenticated: status.HTTP_401_UNAUTHORIZED,
    AuthenticationFailed: status.HTTP_401_UNAUTHORIZED,
    DRFPermissionDenied: status.HTTP_403_FORBIDDEN,
    NotFound: status.HTTP_404_NOT_FOUND,
    MethodNotAllowed: status.HTTP_405_METHOD_NOT_ALLOWED,
    ParseError: status.HTTP_400_BAD_REQUEST,
    UnsupportedMediaType: status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
    Throttled: status.HTTP_429_TOO_MANY_REQUESTS,
}

_ERROR_CODE_MAP = {
    ValidationError: "VALIDATION_ERROR",
    NotAuthenticated: "NOT_AUTHENTICATED",
    AuthenticationFailed: "AUTHENTICATION_FAILED",
    DRFPermissionDenied: "PERMISSION_DENIED",
    NotFound: "NOT_FOUND",
    MethodNotAllowed: "METHOD_NOT_ALLOWED",
    ParseError: "PARSE_ERROR",
    UnsupportedMediaType: "UNSUPPORTED_MEDIA_TYPE",
    Throttled: "THROTTLED",
}


def _normalize_details(detail):
    """Recursively convert ErrorDetail / nested structures to plain Python types."""
    if isinstance(detail, list):
        return [_normalize_details(item) for item in detail]
    if isinstance(detail, dict):
        return {key: _normalize_details(value) for key, value in detail.items()}
    return str(detail)


def _build_error_response(code: str, message: str, details, http_status: int) -> Response:
    body = {
        "success": False,
        "error": {
            "code": code,
            "message": message,
            "details": details if details not in (None, [], {}, "") else {},
        },
    }
    return Response(body, status=http_status)


def custom_exception_handler(exc, context):
    # Let DRF convert Django built-ins first (e.g. Http404, PermissionDenied)
    response = drf_exception_handler(exc, context)

    # ── Django native exceptions not yet converted ──────────────────────────
    if response is None:
        if isinstance(exc, ObjectDoesNotExist):
            return _build_error_response(
                code="NOT_FOUND",
                message="The requested resource was not found.",
                details={},
                http_status=status.HTTP_404_NOT_FOUND,
            )
        if isinstance(exc, PermissionDenied):
            return _build_error_response(
                code="PERMISSION_DENIED",
                message="You do not have permission to perform this action.",
                details={},
                http_status=status.HTTP_403_FORBIDDEN,
            )
        if isinstance(exc, DjangoValidationError):
            details = _normalize_details(
                exc.message_dict if hasattr(exc, "message_dict") else exc.messages
            )
            return _build_error_response(
                code="VALIDATION_ERROR",
                message="Invalid data.",
                details=details,
                http_status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        # Unhandled exception — let Django's 500 machinery take over
        return None

    # ── DRF exceptions ───────────────────────────────────────────────────────
    exc_type = type(exc)

    # Resolve code and status, falling back to APIException defaults
    if exc_type in _ERROR_CODE_MAP:
        code = _ERROR_CODE_MAP[exc_type]
        http_status = _STATUS_CODE_MAP[exc_type]
    elif isinstance(exc, APIException):
        code = (exc.default_code or "ERROR").upper()
        http_status = exc.status_code
    else:
        code = "SERVER_ERROR"
        http_status = status.HTTP_500_INTERNAL_SERVER_ERROR

    # Build a human-readable top-level message and a details payload
    raw_detail = exc.detail if hasattr(exc, "detail") else str(exc)

    if isinstance(raw_detail, dict):
        # Field-level validation errors: keep full map in details, generic message
        message = "Invalid input. Please check the details field for more information."
        details = _normalize_details(raw_detail)
    elif isinstance(raw_detail, list):
        # Non-field errors list: first item as message
        normalized = _normalize_details(raw_detail)
        message = normalized[0] if normalized else "An error occurred."
        details = normalized[1:] if len(normalized) > 1 else {}
    else:
        message = str(raw_detail)
        details = {}

    # Special-case Throttled to include wait time
    if isinstance(exc, Throttled) and exc.wait is not None:
        details = {"wait_seconds": int(exc.wait)}

    return _build_error_response(
        code=code,
        message=message,
        details=details,
        http_status=http_status,
    )


# ── Convenience custom exception classes ────────────────────────────────────

class AccountLocked(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_code = "ACCOUNT_LOCKED"
    default_detail = "Your account has been temporarily locked due to too many failed login attempts."


class EmailNotVerified(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_code = "EMAIL_NOT_VERIFIED"
    default_detail = "Please verify your email address before continuing."


class AgentAccessDenied(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_code = "AGENT_ACCESS_DENIED"
    default_detail = "You do not have access to this agent."


class AgentAccessExpired(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_code = "AGENT_ACCESS_EXPIRED"
    default_detail = "Your access to this agent has expired."
