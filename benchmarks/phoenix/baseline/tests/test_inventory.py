"""Tests for inventory management functionality."""

import pytest
from core.inventory_db import (
    check_and_reserve,
    release_reservation,
    get_stock_level,
    get_product_info,
    get_available_items,
    STOCK,
)


@pytest.fixture(autouse=True)
def reset_stock():
    """Reset stock levels before each test."""
    STOCK["A100"]["quantity"] = 10
    STOCK["B200"]["quantity"] = 0
    STOCK["C300"]["quantity"] = 5
    STOCK["D400"]["quantity"] = 100
    yield


def test_check_and_reserve_success():
    """Test successful reservation."""
    initial = get_stock_level("A100")
    assert check_and_reserve("A100", 1) is True
    assert get_stock_level("A100") == initial - 1


def test_check_and_reserve_out_of_stock():
    """Test reservation fails when out of stock."""
    assert check_and_reserve("B200", 1) is False


def test_check_and_reserve_unknown_item():
    """Test reservation fails for unknown item."""
    assert check_and_reserve("XXXX", 1) is False


def test_check_and_reserve_exceeds_max_order():
    """Test reservation fails when exceeding max order quantity."""
    # A100 has max_order of 5
    assert check_and_reserve("A100", 10) is False


def test_release_reservation():
    """Test releasing a reservation restores stock."""
    initial = get_stock_level("A100")
    check_and_reserve("A100", 2)
    assert get_stock_level("A100") == initial - 2

    release_reservation("A100", 2)
    assert get_stock_level("A100") == initial


def test_get_product_info():
    """Test getting product metadata."""
    info = get_product_info("A100")
    assert info is not None
    assert info["name"] == "Widget Pro"
    assert "min_order" in info
    assert "max_order" in info


def test_get_available_items():
    """Test listing items with stock."""
    available = get_available_items()
    item_ids = [item["item_id"] for item in available]

    assert "A100" in item_ids
    assert "B200" not in item_ids  # Out of stock
    assert "C300" in item_ids
