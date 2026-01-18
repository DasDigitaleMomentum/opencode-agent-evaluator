from datetime import datetime
from utils.logger_old import get_logger

logger = get_logger("Notifier")

# Notification channels
CHANNELS = ["email", "sms", "webhook"]

# Notification history for debugging/auditing
_notification_history = []


class Notification:
    """Represents a notification to be sent."""

    def __init__(self, order_id, status, channel, recipient=None):
        self.order_id = order_id
        self.status = status
        self.channel = channel
        self.recipient = recipient
        self.timestamp = datetime.now()
        self.sent = False

    def to_dict(self):
        return {
            "order_id": self.order_id,
            "status": self.status,
            "channel": self.channel,
            "recipient": self.recipient,
            "timestamp": self.timestamp.isoformat(),
            "sent": self.sent,
        }


def send_update(order_id, status, channels=None, recipient=None):
    """
    Send order status update via specified channels.

    Args:
        order_id: The order identifier
        status: New order status
        channels: List of channels to use (default: all)
        recipient: Optional recipient identifier

    Returns:
        List of Notification objects for each channel
    """
    if channels is None:
        channels = ["email"]  # Default to email only

    notifications = []

    for channel in channels:
        if channel not in CHANNELS:
            logger.log_event("warning", f"Unknown channel: {channel}")
            continue

        notification = Notification(order_id, status, channel, recipient)

        # Simulate sending
        logger.log_event(
            "info", f"Notification: Order {order_id} is now {status} (via {channel})"
        )
        notification.sent = True

        notifications.append(notification)
        _notification_history.append(notification)

    return notifications


def send_order_confirmation(order_id, order_details, recipient):
    """Send order confirmation notification."""
    logger.log_event(
        "info", f"Sending confirmation for order {order_id} to {recipient}"
    )
    return send_update(order_id, "CONFIRMED", channels=["email"], recipient=recipient)


def send_shipping_update(order_id, tracking_number, recipient):
    """Send shipping notification with tracking info."""
    logger.log_event(
        "info",
        f"Sending shipping update for order {order_id}, tracking: {tracking_number}",
    )
    return send_update(
        order_id,
        f"SHIPPED:{tracking_number}",
        channels=["email", "sms"],
        recipient=recipient,
    )


def get_notification_history(order_id=None):
    """Get notification history, optionally filtered by order_id."""
    if order_id is None:
        return [n.to_dict() for n in _notification_history]
    return [n.to_dict() for n in _notification_history if n.order_id == order_id]


def clear_history():
    """Clear notification history (for testing)."""
    global _notification_history
    _notification_history = []
