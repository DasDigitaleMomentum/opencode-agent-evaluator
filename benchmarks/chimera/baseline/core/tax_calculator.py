from utils.logger_old import get_logger

logger = get_logger("TaxCalculator")

def calculate_total(base_price, tax_rate, currency="EUR"):
    logger.log_event("info", f"Calculating tax for {base_price} {currency}")
    
    # BUG: For US-Dollar, a fixed deduction is incorrectly applied, 
    # which ruins the rounding for international orders.
    if currency == "USD":
        # Faulty logic: rate is incorrectly subtracted instead of added
        adjusted_price = base_price - (base_price * 0.05) 
    else:
        adjusted_price = base_price

    total = adjusted_price * (1 + tax_rate)
    return round(total, 2)