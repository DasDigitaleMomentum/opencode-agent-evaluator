from utils.logger_old import get_logger

logger = get_logger("InventoryDB")

STOCK = {"A100": 10, "B200": 0, "C300": 5}

def check_and_reserve(item_id, quantity):
    logger.log_event("debug", f"Checking stock for {item_id}")
    if STOCK.get(item_id, 0) >= quantity:
        STOCK[item_id] -= quantity
        return True
    return False