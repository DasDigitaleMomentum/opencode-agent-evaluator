"""Tests for API endpoints."""

import pytest
from gateway.rest_api import post_order, get_order, delete_order, get_orders
from gateway.client_proxy import reset_order_manager
from core.inventory_db import STOCK


@pytest.fixture(autouse=True)
def reset_state():
    """Reset state before each test."""
    reset_order_manager()
    STOCK["A100"]["quantity"] = 10
    STOCK["B200"]["quantity"] = 0
    STOCK["C300"]["quantity"] = 5
    STOCK["D400"]["quantity"] = 100
    yield


def test_api_unauthorized():
    """Test that invalid token returns 401."""
    res = post_order("wrong-token", {})
    assert res["status"] == 401


def test_api_missing_fields():
    """Test that missing required fields returns 400."""
    res = post_order("secret-api-token", {"item_id": "A100"})
    assert res["status"] == 400
    assert "Missing" in res.get("error", "")


def test_api_create_order_success():
    """Test successful order creation."""
    order_data = {
        "item_id": "A100",
        "quantity": 1,
        "price": 50.0,
        "currency": "EUR",
    }
    res = post_order("secret-api-token", order_data)
    assert res["status"] == 201
    assert "result" in res
    assert res["result"]["item_id"] == "A100"


def test_api_create_order_out_of_stock():
    """Test order creation fails when out of stock."""
    order_data = {
        "item_id": "B200",
        "quantity": 1,
        "price": 25.0,
        "currency": "EUR",
    }
    res = post_order("secret-api-token", order_data)
    assert res["status"] == 400


def test_api_get_order():
    """Test retrieving an order by ID."""
    # Create an order first
    order_data = {
        "item_id": "A100",
        "quantity": 1,
        "price": 50.0,
        "currency": "EUR",
    }
    create_res = post_order("secret-api-token", order_data)
    order_id = create_res["result"]["id"]

    # Retrieve it
    get_res = get_order("secret-api-token", order_id)
    assert get_res["status"] == 200
    assert get_res["result"]["id"] == order_id


def test_api_get_order_not_found():
    """Test retrieving non-existent order returns 404."""
    res = get_order("secret-api-token", 99999)
    assert res["status"] == 404


def test_api_list_orders():
    """Test listing all orders."""
    # Create some orders
    for i in range(3):
        post_order(
            "secret-api-token",
            {
                "item_id": "A100",
                "quantity": 1,
                "price": 10.0,
            },
        )

    res = get_orders("secret-api-token")
    assert res["status"] == 200
    assert len(res["result"]) == 3
