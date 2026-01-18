from utils.logger_old import get_logger
logger = get_logger("Processor")

def process_payment(order_id):
    # Dummy payment processing
    logger.log_event("info", f"Processing payment for {order_id}")
    return True