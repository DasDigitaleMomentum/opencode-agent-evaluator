import hashlib
import time
from utils.logger_old import get_logger

logger = get_logger("Auth")

# Valid API tokens (in production, these would be in a secure store)
VALID_TOKENS = {
    "secret-api-token": {"user_id": "user_001", "role": "admin", "expires": None},
    "readonly-token": {"user_id": "user_002", "role": "reader", "expires": None},
}

# Rate limiting: track request counts per token
_request_counts = {}
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 100  # requests per window


def verify_token(token):
    """
    Verify that a token is valid.

    Args:
        token: API token string

    Returns:
        True if valid, False otherwise
    """
    if not token or not isinstance(token, str):
        logger.log_event("warning", "Invalid token format")
        return False

    token_info = VALID_TOKENS.get(token)
    if token_info is None:
        logger.log_event("warning", "Unknown token attempted")
        return False

    # Check expiration
    if token_info.get("expires") and time.time() > token_info["expires"]:
        logger.log_event("warning", f"Expired token for user {token_info['user_id']}")
        return False

    logger.log_event("debug", f"Token verified for user {token_info['user_id']}")
    return True


def get_token_info(token):
    """Get information about a token (user_id, role, etc.)."""
    return VALID_TOKENS.get(token)


def check_permission(token, required_role):
    """
    Check if a token has the required role.

    Args:
        token: API token
        required_role: Required role (e.g., "admin", "reader")

    Returns:
        True if permitted, False otherwise
    """
    token_info = VALID_TOKENS.get(token)
    if not token_info:
        return False

    user_role = token_info.get("role", "")

    # Admin has all permissions
    if user_role == "admin":
        return True

    return user_role == required_role


def check_rate_limit(token):
    """
    Check if a token has exceeded the rate limit.

    Returns:
        True if within limits, False if exceeded
    """
    current_time = time.time()
    window_start = current_time - RATE_LIMIT_WINDOW

    if token not in _request_counts:
        _request_counts[token] = []

    # Clean old requests
    _request_counts[token] = [t for t in _request_counts[token] if t > window_start]

    # Check limit
    if len(_request_counts[token]) >= RATE_LIMIT_MAX:
        logger.log_event("warning", f"Rate limit exceeded for token")
        return False

    # Record this request
    _request_counts[token].append(current_time)
    return True


def hash_token(token):
    """Hash a token for secure storage/logging."""
    return hashlib.sha256(token.encode()).hexdigest()[:16]
