import random
import time
from utils.logger_old import get_logger

logger = get_logger("Processor")

# Payment provider configurations
PAYMENT_PROVIDERS = {
    "EUR": "stripe_eu",
    "USD": "stripe_us",
    "GBP": "stripe_uk",
}

# Simulated processing delays (in seconds)
PROCESSING_DELAY = 0.1


class PaymentResult:
    """Result of a payment processing attempt."""

    def __init__(self, success, transaction_id=None, error_message=None):
        self.success = success
        self.transaction_id = transaction_id
        self.error_message = error_message

    def to_dict(self):
        return {
            "success": self.success,
            "transaction_id": self.transaction_id,
            "error_message": self.error_message,
        }


def _generate_transaction_id():
    """Generate a unique transaction ID."""
    timestamp = int(time.time() * 1000)
    random_suffix = random.randint(1000, 9999)
    return f"TXN-{timestamp}-{random_suffix}"


def get_provider_for_currency(currency):
    """Get the appropriate payment provider for a currency."""
    return PAYMENT_PROVIDERS.get(currency, "stripe_default")


def process_payment(order_id, amount, currency="EUR"):
    """
    Process payment for an order.

    Args:
        order_id: The order identifier
        amount: Payment amount
        currency: Currency code (EUR, USD, GBP)

    Returns:
        PaymentResult object with success status and transaction details
    """
    logger.log_event(
        "info", f"Processing payment for order {order_id}: {amount} {currency}"
    )

    provider = get_provider_for_currency(currency)
    logger.log_event("debug", f"Using provider: {provider}")

    # Simulate processing delay
    time.sleep(PROCESSING_DELAY)

    # Simulate payment processing (95% success rate)
    if random.random() < 0.95:
        transaction_id = _generate_transaction_id()
        logger.log_event("info", f"Payment successful: {transaction_id}")
        return PaymentResult(success=True, transaction_id=transaction_id)
    else:
        error = "Payment declined by provider"
        logger.log_event("error", f"Payment failed for order {order_id}: {error}")
        return PaymentResult(success=False, error_message=error)


def refund_payment(transaction_id, amount):
    """
    Process a refund for a previous transaction.

    Args:
        transaction_id: Original transaction ID
        amount: Amount to refund

    Returns:
        PaymentResult object
    """
    logger.log_event("info", f"Processing refund for {transaction_id}: {amount}")

    # Simulate refund processing
    time.sleep(PROCESSING_DELAY)

    refund_id = f"REF-{transaction_id}"
    logger.log_event("info", f"Refund successful: {refund_id}")
    return PaymentResult(success=True, transaction_id=refund_id)
