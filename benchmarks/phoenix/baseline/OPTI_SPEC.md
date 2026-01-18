# Project Specification: Phoenix System Optimization

## 1. Project Overview
The **Phoenix Project** is a backend service for processing orders including inventory management, tax calculation, and payment handling. The system is functional but suffers from technical debt (legacy logging), a critical calculation error in international transactions, missing input validation, and lacks an interface for business analytics.

## 2. Phase 0: Project Exploration
**Status:** Preparation  
**Requirements:**
1. Analyze the project structure and identify all relevant modules.
2. Create an overview document `docs/overview.md` containing:
   - One line per source file with a brief description
   - A summary section describing the main functionality
3. This document serves as a reference for subsequent phases.

## 3. Phase 1: Quality Assurance & Bugfix
**Status:** Critical  
**Problem:** Automated tests report failures in the international orders module. The system produces incorrect totals for non-EUR transactions.
**Requirements:**
1. Locate the root cause of the failing test in `tests/test_orders.py`.
2. Fix the logic error without breaking correct calculation of domestic orders (EUR).
3. Validate the fix by running the complete test suite successfully.

## 4. Phase 2: Logging Infrastructure Refactoring
**Status:** Maintenance  
**Problem:** The current logging system (`utils/logger_old.py`) is proprietary, inflexible, and bloats the code through manual instantiation in every file.
**Requirements:**
1. Introduce the standard Python `logging` module.
2. Create a central configuration in `utils/logging_config.py`.
3. Replace the `LegacyLogger` with the standard logger in **all** project modules.
4. The goal is unified log output across all layers (Gateway, Core, Utils).

## 5. Phase 3: Extension – Implementation of Reporting Interface
**Status:** Feature Request  
**Requirements:**
Management needs a way to pass completed orders to external analytics tools.
1. Define an interface (base class) named `OrderHook` in a new module `core/hooks.py`.
2. Implement a concrete hook `AnalyticsHook` that writes order data (ID, amount, status) to a file `analytics_events.json`.
3. Integrate this hook system into `OrderManager` so that each hook is automatically triggered upon successful order creation.
4. The integration must be extensible (Open-Closed Principle) so that additional hooks can be added later.

## 6. Phase 4: Input Validation & Error Handling
**Status:** Security  
**Problem:** The API gateway accepts malformed requests without proper validation. Invalid data propagates through the system causing silent failures or incorrect behavior.
**Requirements:**
1. Extend `utils/validators.py` with comprehensive validation:
   - Validate that `quantity` is a positive integer
   - Validate that `price` is a positive number
   - Validate that `currency` is one of the supported currencies (EUR, USD, GBP)
   - Validate that `item_id` matches the expected format (alphanumeric, 4 characters)
2. Implement a custom `ValidationError` exception class in `utils/exceptions.py`.
3. Update `gateway/rest_api.py` to validate incoming requests and return proper error responses (HTTP 400) with descriptive messages.
4. Ensure all validation errors are logged and do not expose internal implementation details to clients.
