from utils.logger_old import get_logger

logger = get_logger("InventoryDB")

# Simulated database with stock levels and product metadata
STOCK = {
    "A100": {"quantity": 10, "name": "Widget Pro", "min_order": 1, "max_order": 5},
    "B200": {"quantity": 0, "name": "Gadget Basic", "min_order": 1, "max_order": 10},
    "C300": {"quantity": 5, "name": "Device Ultra", "min_order": 1, "max_order": 3},
    "D400": {"quantity": 100, "name": "Component X", "min_order": 10, "max_order": 50},
}

# Reservation tracking for pending orders
_reservations = {}


def get_stock_level(item_id):
    """Get current stock level for an item."""
    item = STOCK.get(item_id)
    if item is None:
        return None
    return item["quantity"]


def get_product_info(item_id):
    """Get product metadata."""
    return STOCK.get(item_id)


def check_and_reserve(item_id, quantity):
    """
    Check stock availability and reserve items for an order.
    Returns True if reservation successful, False otherwise.
    """
    logger.log_event("debug", f"Checking stock for {item_id}, quantity: {quantity}")

    item = STOCK.get(item_id)
    if item is None:
        logger.log_event("warning", f"Item {item_id} not found in inventory")
        return False

    # Check quantity constraints
    if quantity < item["min_order"]:
        logger.log_event(
            "warning", f"Quantity {quantity} below minimum {item['min_order']}"
        )
        return False

    if quantity > item["max_order"]:
        logger.log_event(
            "warning", f"Quantity {quantity} exceeds maximum {item['max_order']}"
        )
        return False

    # Check availability
    if item["quantity"] >= quantity:
        item["quantity"] -= quantity
        logger.log_event("info", f"Reserved {quantity} units of {item_id}")
        return True

    logger.log_event(
        "warning", f"Insufficient stock for {item_id}: {item['quantity']} available"
    )
    return False


def release_reservation(item_id, quantity):
    """Release a previously made reservation (e.g., on order cancellation)."""
    item = STOCK.get(item_id)
    if item:
        item["quantity"] += quantity
        logger.log_event("info", f"Released {quantity} units of {item_id}")
        return True
    return False


def get_available_items():
    """Get list of items with stock > 0."""
    return [
        {"item_id": item_id, "name": info["name"], "available": info["quantity"]}
        for item_id, info in STOCK.items()
        if info["quantity"] > 0
    ]
