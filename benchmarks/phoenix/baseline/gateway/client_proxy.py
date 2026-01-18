from core.order_manager import OrderManager
from utils.logger_old import get_logger

logger = get_logger("ClientProxy")

# Singleton instance for order management
_manager = None


def get_order_manager():
    """Get or create the OrderManager singleton."""
    global _manager
    if _manager is None:
        _manager = OrderManager()
    return _manager


def reset_order_manager():
    """Reset the order manager (for testing)."""
    global _manager
    _manager = None


def submit_order_to_core(data):
    """
    Submit an order to the core order management system.

    Args:
        data: Order data dict with item_id, quantity, price, currency

    Returns:
        Order dict if successful, None otherwise
    """
    logger.log_event("info", "Proxying order request to core manager")

    manager = get_order_manager()
    return manager.create_order(
        data["item_id"],
        data["quantity"],
        data["price"],
        data.get("currency", "EUR"),
    )


def get_order_from_core(order_id):
    """
    Get an order by ID from the core system.

    Args:
        order_id: Order identifier

    Returns:
        Order dict if found, None otherwise
    """
    logger.log_event("debug", f"Fetching order {order_id} from core")
    manager = get_order_manager()
    return manager.get_order(order_id)


def update_order_in_core(order_id, status):
    """
    Update an order's status in the core system.

    Args:
        order_id: Order identifier
        status: New status

    Returns:
        Updated order dict if successful, None otherwise
    """
    logger.log_event("info", f"Updating order {order_id} status to {status}")
    manager = get_order_manager()
    return manager.update_order_status(order_id, status)


def cancel_order_in_core(order_id):
    """
    Cancel an order in the core system.

    Args:
        order_id: Order identifier

    Returns:
        Cancelled order dict if successful, None otherwise
    """
    logger.log_event("info", f"Cancelling order {order_id}")
    manager = get_order_manager()
    return manager.cancel_order(order_id)


def list_orders_from_core(status=None):
    """
    List orders from the core system.

    Args:
        status: Optional status filter

    Returns:
        List of order dicts
    """
    manager = get_order_manager()
    if status:
        return manager.get_orders_by_status(status)
    return manager.get_all_orders()
