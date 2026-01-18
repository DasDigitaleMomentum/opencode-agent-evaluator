import json

from gateway.rest_api import post_order


def run_sample_flow():
    """Run a sample order flow to demonstrate the system."""
    print("--- Starting Phoenix Demo Flow ---")

    # Sample order data
    token = "secret-api-token"
    order_payload = {
        "item_id": "A100",
        "quantity": 2,
        "price": 49.99,
        "currency": "EUR",
    }

    print(f"Submitting order for item {order_payload['item_id']}...")
    response = post_order(token, order_payload)

    print(f"API Response: {json.dumps(response, indent=2)}")
    print("--- Demo Flow Completed ---")


if __name__ == "__main__":
    run_sample_flow()
