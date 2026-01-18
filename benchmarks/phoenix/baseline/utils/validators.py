import re

# Supported currencies with their configurations
SUPPORTED_CURRENCIES = {
    "EUR": {"symbol": "€", "decimal_places": 2},
    "USD": {"symbol": "$", "decimal_places": 2},
    "GBP": {"symbol": "£", "decimal_places": 2},
}

# Item ID pattern: alphanumeric, exactly 4 characters
ITEM_ID_PATTERN = re.compile(r"^[A-Z0-9]{4}$")


def validate_order_data(data):
    """
    Basic validation that checks for required fields.
    Returns True if all required keys are present.
    """
    required = ["item_id", "quantity", "price", "currency"]
    return all(k in data for k in required)


def validate_item_id(item_id):
    """
    Validate item ID format.
    Must be exactly 4 alphanumeric characters (uppercase).
    """
    if not isinstance(item_id, str):
        return False, "item_id must be a string"

    if not ITEM_ID_PATTERN.match(item_id):
        return False, "item_id must be 4 alphanumeric characters (uppercase)"

    return True, None


def validate_quantity(quantity):
    """
    Validate quantity is a positive integer.
    """
    if not isinstance(quantity, int):
        return False, "quantity must be an integer"

    if quantity <= 0:
        return False, "quantity must be positive"

    return True, None


def validate_price(price):
    """
    Validate price is a positive number.
    """
    if not isinstance(price, (int, float)):
        return False, "price must be a number"

    if price <= 0:
        return False, "price must be positive"

    return True, None


def validate_currency(currency):
    """
    Validate currency is supported.
    """
    if not isinstance(currency, str):
        return False, "currency must be a string"

    if currency not in SUPPORTED_CURRENCIES:
        valid = ", ".join(SUPPORTED_CURRENCIES.keys())
        return False, f"currency must be one of: {valid}"

    return True, None


def validate_complete_order(data):
    """
    Perform complete validation of order data.

    Returns:
        tuple: (is_valid: bool, errors: list of error messages)
    """
    errors = []

    # Check required fields first
    if not validate_order_data(data):
        return False, ["Missing required fields: item_id, quantity, price, currency"]

    # Validate each field
    valid, error = validate_item_id(data.get("item_id"))
    if not valid:
        errors.append(error)

    valid, error = validate_quantity(data.get("quantity"))
    if not valid:
        errors.append(error)

    valid, error = validate_price(data.get("price"))
    if not valid:
        errors.append(error)

    valid, error = validate_currency(data.get("currency"))
    if not valid:
        errors.append(error)

    return len(errors) == 0, errors


def format_price(amount, currency):
    """Format a price with the appropriate currency symbol."""
    config = SUPPORTED_CURRENCIES.get(currency, {"symbol": "", "decimal_places": 2})
    formatted = f"{amount:.{config['decimal_places']}f}"
    return f"{config['symbol']}{formatted}"
