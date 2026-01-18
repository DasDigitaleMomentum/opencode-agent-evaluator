def validate_order_data(data):
    required = ["item_id", "quantity", "price", "currency"]
    return all(k in data for k in required)