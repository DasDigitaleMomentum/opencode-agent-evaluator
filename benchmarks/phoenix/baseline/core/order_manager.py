from datetime import datetime
from core.inventory_db import check_and_reserve, release_reservation
from core.tax_calculator import calculate_total
from core.notifier import send_update
from utils.logger_old import get_logger

logger = get_logger("OrderManager")

# Tax rates per currency
TAX_RATES = {
    "EUR": 0.19,
    "USD": 0.08,
    "GBP": 0.20,
}


class Order:
    """Represents an order in the system."""

    def __init__(self, order_id, item_id, quantity, amount, currency):
        self.id = order_id
        self.item_id = item_id
        self.quantity = quantity
        self.amount = amount
        self.currency = currency
        self.status = "CREATED"
        self.created_at = datetime.now()
        self.updated_at = datetime.now()

    def to_dict(self):
        return {
            "id": self.id,
            "item_id": self.item_id,
            "quantity": self.quantity,
            "amount": self.amount,
            "currency": self.currency,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class OrderManager:
    """Manages order lifecycle including creation, updates, and cancellation."""

    def __init__(self):
        self.orders = []
        self._order_counter = 0

    def _next_order_id(self):
        self._order_counter += 1
        return self._order_counter

    def create_order(self, item_id, quantity, price, currency="EUR"):
        """
        Create a new order.

        Args:
            item_id: Product identifier
            quantity: Number of items
            price: Unit price
            currency: Currency code (EUR, USD, GBP)

        Returns:
            Order dict if successful, None if out of stock
        """
        if check_and_reserve(item_id, quantity):
            tax_rate = TAX_RATES.get(currency, 0.19)
            final_amount = calculate_total(price * quantity, tax_rate, currency)

            order = Order(
                order_id=self._next_order_id(),
                item_id=item_id,
                quantity=quantity,
                amount=final_amount,
                currency=currency,
            )
            self.orders.append(order)
            logger.log_event(
                "info", f"Order {order.id} created for {quantity}x {item_id}"
            )

            # Send notification
            send_update(order.id, order.status)

            return order.to_dict()

        logger.log_event("warning", f"Failed to create order: {item_id} out of stock")
        return None

    def get_order(self, order_id):
        """Get order by ID."""
        for order in self.orders:
            if order.id == order_id:
                return order.to_dict()
        return None

    def update_order_status(self, order_id, new_status):
        """Update the status of an existing order."""
        for order in self.orders:
            if order.id == order_id:
                old_status = order.status
                order.status = new_status
                order.updated_at = datetime.now()
                logger.log_event(
                    "info", f"Order {order_id} status: {old_status} -> {new_status}"
                )
                send_update(order_id, new_status)
                return order.to_dict()
        return None

    def cancel_order(self, order_id):
        """Cancel an order and release reserved inventory."""
        for order in self.orders:
            if order.id == order_id:
                if order.status in ("CREATED", "PENDING"):
                    release_reservation(order.item_id, order.quantity)
                    order.status = "CANCELLED"
                    order.updated_at = datetime.now()
                    logger.log_event("info", f"Order {order_id} cancelled")
                    send_update(order_id, "CANCELLED")
                    return order.to_dict()
                else:
                    logger.log_event(
                        "warning",
                        f"Cannot cancel order {order_id} in status {order.status}",
                    )
                    return None
        return None

    def get_orders_by_status(self, status):
        """Get all orders with a specific status."""
        return [order.to_dict() for order in self.orders if order.status == status]

    def get_all_orders(self):
        """Get all orders."""
        return [order.to_dict() for order in self.orders]
