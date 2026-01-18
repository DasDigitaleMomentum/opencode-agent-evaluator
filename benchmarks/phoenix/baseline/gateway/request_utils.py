from datetime import datetime

# HTTP status codes
HTTP_OK = 200
HTTP_CREATED = 201
HTTP_BAD_REQUEST = 400
HTTP_UNAUTHORIZED = 401
HTTP_NOT_FOUND = 404
HTTP_INTERNAL_ERROR = 500


def format_response(data, code=200, message=None):
    """
    Format an API response with consistent structure.

    Args:
        data: Response payload (can be dict, list, or string)
        code: HTTP status code
        message: Optional message for the response

    Returns:
        Formatted response dict
    """
    response = {
        "status": code,
        "timestamp": datetime.now().isoformat(),
    }

    if code >= 400:
        response["error"] = data if isinstance(data, str) else str(data)
        if message:
            response["message"] = message
    else:
        response["result"] = data
        if message:
            response["message"] = message

    return response


def format_error(error_message, code=400, details=None):
    """
    Format an error response.

    Args:
        error_message: Main error message
        code: HTTP status code
        details: Optional list of detailed error messages

    Returns:
        Formatted error response dict
    """
    response = {
        "status": code,
        "error": error_message,
        "timestamp": datetime.now().isoformat(),
    }

    if details:
        response["details"] = details

    return response


def format_validation_error(errors):
    """
    Format a validation error response.

    Args:
        errors: List of validation error messages

    Returns:
        Formatted validation error response
    """
    return format_error(
        error_message="Validation failed",
        code=HTTP_BAD_REQUEST,
        details=errors,
    )


def parse_pagination(params, default_limit=20, max_limit=100):
    """
    Parse pagination parameters from request.

    Args:
        params: Dict of query parameters
        default_limit: Default page size
        max_limit: Maximum allowed page size

    Returns:
        Tuple of (offset, limit)
    """
    try:
        offset = int(params.get("offset", 0))
        limit = int(params.get("limit", default_limit))
    except (ValueError, TypeError):
        offset = 0
        limit = default_limit

    offset = max(0, offset)
    limit = min(max(1, limit), max_limit)

    return offset, limit
