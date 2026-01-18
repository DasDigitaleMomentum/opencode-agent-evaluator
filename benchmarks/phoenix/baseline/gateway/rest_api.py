from gateway.auth import verify_token, check_rate_limit
from gateway.client_proxy import (
    submit_order_to_core,
    get_order_from_core,
    cancel_order_in_core,
    list_orders_from_core,
)
from gateway.request_utils import (
    format_response,
    format_error,
    HTTP_OK,
    HTTP_CREATED,
    HTTP_BAD_REQUEST,
    HTTP_UNAUTHORIZED,
    HTTP_NOT_FOUND,
)
from utils.logger_old import get_logger

logger = get_logger("RestAPI")


def _check_auth(token):
    """Check authentication and rate limiting."""
    if not verify_token(token):
        return format_error("Unauthorized", HTTP_UNAUTHORIZED)

    if not check_rate_limit(token):
        return format_error("Rate limit exceeded", 429)

    return None


def post_order(token, order_data):
    """
    Create a new order.

    Args:
        token: API authentication token
        order_data: Order details (item_id, quantity, price, currency)

    Returns:
        API response dict
    """
    auth_error = _check_auth(token)
    if auth_error:
        return auth_error

    logger.log_event("info", f"POST /orders - Creating order")

    # Basic validation (Phase 4 will improve this)
    required = ["item_id", "quantity", "price"]
    missing = [f for f in required if f not in order_data]
    if missing:
        return format_error(
            f"Missing required fields: {', '.join(missing)}", HTTP_BAD_REQUEST
        )

    order = submit_order_to_core(order_data)
    if order:
        return format_response(order, HTTP_CREATED, "Order created successfully")

    return format_error("Out of stock or invalid item", HTTP_BAD_REQUEST)


def get_order(token, order_id):
    """
    Get an order by ID.

    Args:
        token: API authentication token
        order_id: Order identifier

    Returns:
        API response dict
    """
    auth_error = _check_auth(token)
    if auth_error:
        return auth_error

    logger.log_event("debug", f"GET /orders/{order_id}")

    order = get_order_from_core(order_id)
    if order:
        return format_response(order, HTTP_OK)

    return format_error(f"Order {order_id} not found", HTTP_NOT_FOUND)


def delete_order(token, order_id):
    """
    Cancel an order.

    Args:
        token: API authentication token
        order_id: Order identifier

    Returns:
        API response dict
    """
    auth_error = _check_auth(token)
    if auth_error:
        return auth_error

    logger.log_event("info", f"DELETE /orders/{order_id}")

    order = cancel_order_in_core(order_id)
    if order:
        return format_response(order, HTTP_OK, "Order cancelled")

    return format_error(f"Cannot cancel order {order_id}", HTTP_BAD_REQUEST)


def get_orders(token, status=None):
    """
    List all orders, optionally filtered by status.

    Args:
        token: API authentication token
        status: Optional status filter

    Returns:
        API response dict
    """
    auth_error = _check_auth(token)
    if auth_error:
        return auth_error

    logger.log_event("debug", f"GET /orders (status={status})")

    orders = list_orders_from_core(status)
    return format_response(orders, HTTP_OK)
