from core.inventory_db import check_and_reserve

def test_inventory_check():
    assert check_and_reserve("A100", 1) is True
    assert check_and_reserve("B200", 1) is False