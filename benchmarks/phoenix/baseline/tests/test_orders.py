"""Tests for order management functionality."""

import pytest
from core.order_manager import OrderManager
from core.inventory_db import STOCK


@pytest.fixture(autouse=True)
def reset_stock():
    """Reset stock levels before each test."""
    STOCK["A100"]["quantity"] = 10
    STOCK["B200"]["quantity"] = 0
    STOCK["C300"]["quantity"] = 5
    STOCK["D400"]["quantity"] = 100
    yield


def test_domestic_order_total():
    """Test that EUR orders are calculated correctly with 19% tax."""
    manager = OrderManager()
    order = manager.create_order("A100", 1, 100.0, "EUR")
    assert order is not None
    assert order["amount"] == 119.0


def test_international_order_total():
    """Test that USD orders are calculated correctly with 8% tax."""
    manager = OrderManager()
    order = manager.create_order("C300", 1, 100.0, "USD")
    assert order is not None
    # USD orders should have 8% tax applied to base price
    assert order["amount"] == 108.0


def test_gbp_order_total():
    """Test that GBP orders are calculated correctly with 20% tax."""
    manager = OrderManager()
    order = manager.create_order("A100", 1, 100.0, "GBP")
    assert order is not None
    # GBP orders should have 20% tax
    assert order["amount"] == 120.0


def test_create_order_out_of_stock():
    """Test that creating an order for out-of-stock item returns None."""
    manager = OrderManager()
    order = manager.create_order("B200", 1, 50.0, "EUR")
    assert order is None


def test_order_has_required_fields():
    """Test that order contains all required fields."""
    manager = OrderManager()
    order = manager.create_order("A100", 2, 25.0, "EUR")
    assert order is not None
    assert "id" in order
    assert "status" in order
    assert "amount" in order
    assert "item_id" in order
    assert "quantity" in order


def test_order_status_is_created():
    """Test that new orders have CREATED status."""
    manager = OrderManager()
    order = manager.create_order("A100", 1, 50.0, "EUR")
    assert order["status"] == "CREATED"


def test_cancel_order():
    """Test cancelling an order."""
    manager = OrderManager()
    order = manager.create_order("A100", 1, 50.0, "EUR")
    cancelled = manager.cancel_order(order["id"])
    assert cancelled is not None
    assert cancelled["status"] == "CANCELLED"


def test_update_order_status():
    """Test updating order status."""
    manager = OrderManager()
    order = manager.create_order("A100", 1, 50.0, "EUR")
    updated = manager.update_order_status(order["id"], "PROCESSING")
    assert updated is not None
    assert updated["status"] == "PROCESSING"
