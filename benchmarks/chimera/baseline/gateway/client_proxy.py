from core.order_manager import OrderManager
from utils.logger_old import get_logger

logger = get_logger("ClientProxy")
manager = OrderManager()

def submit_order_to_core(data):
    logger.log_event("info", "Proxying request to core manager")
    return manager.create_order(
        data['item_id'], 
        data['quantity'], 
        data['price'], 
        data.get('currency', 'EUR')
    )