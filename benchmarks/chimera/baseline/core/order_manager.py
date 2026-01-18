from core.inventory_db import check_and_reserve
from core.tax_calculator import calculate_total
from utils.logger_old import get_logger

logger = get_logger("OrderManager")

class OrderManager:
    def __init__(self):
        self.orders = []

    def create_order(self, item_id, quantity, price, currency="EUR"):
        if check_and_reserve(item_id, quantity):
            tax_rate = 0.19 if currency == "EUR" else 0.08
            final_amount = calculate_total(price * quantity, tax_rate, currency)
            order = {"id": len(self.orders) + 1, "status": "CREATED", "amount": final_amount}
            self.orders.append(order)
            logger.log_event("info", f"Order {order['id']} created")
            return order
        return None