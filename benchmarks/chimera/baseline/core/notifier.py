from utils.logger_old import get_logger
logger = get_logger("Notifier")

def send_update(order_id, status):
    logger.log_event("info", f"Notification: Order {order_id} is now {status}")