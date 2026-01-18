from utils.logger_old import get_logger

logger = get_logger("TaxCalculator")

# Currency-specific adjustment rates for international transactions
CURRENCY_ADJUSTMENTS = {
    "USD": 0.05,
    "GBP": 0.03,
}


def calculate_total(base_price, tax_rate, currency="EUR"):
    """Calculate the final price including tax and currency adjustments."""
    logger.log_event("info", f"Calculating tax for {base_price} {currency}")

    # Apply currency-specific adjustment if applicable
    adjustment = CURRENCY_ADJUSTMENTS.get(currency, 0)
    if adjustment:
        adjusted_price = base_price - (base_price * adjustment)
    else:
        adjusted_price = base_price

    total = adjusted_price * (1 + tax_rate)
    return round(total, 2)
