# Project Specification: Chimera System Optimization

## 1. Project Overview
The **Chimera Project** is a backend service for processing orders including inventory management and tax calculation. The system is functional but suffers from technical debt (legacy logging), a critical rounding error in international transactions, and lacks an interface for business analytics.

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
**Problem:** Automated tests report failures in the international orders module.
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
