from gateway.auth import verify_token
from gateway.client_proxy import submit_order_to_core
from gateway.request_utils import format_response

def post_order(token, order_data):
    if not verify_token(token):
        return format_response("Unauthorized", 401)
    
    order = submit_order_to_core(order_data)
    if order:
        return format_response(order, 201)
    return format_response("Out of stock", 400)