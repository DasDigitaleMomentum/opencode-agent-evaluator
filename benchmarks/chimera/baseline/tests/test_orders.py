from core.order_manager import OrderManager

def test_domestic_order_total():
    manager = OrderManager()
    order = manager.create_order("A100", 1, 100.0, "EUR")
    # 100 + 19% = 119.0
    assert order['amount'] == 119.0

def test_international_order_total():
    manager = OrderManager()
    # BUG TRIGGER: USD calculation in tax_calculator.py is broken
    order = manager.create_order("C300", 1, 100.0, "USD")
    # Expected: 100 + 8% = 108.0
    # Actual will be different due to the 0.05 logic error
    assert order['amount'] == 108.0