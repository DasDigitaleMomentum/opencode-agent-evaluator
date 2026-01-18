# Phoenix Project - Order Management System

## Overview
This system handles order processing, stock management, tax calculation, and payment handling.
Phoenix is a testbed project for evaluating LLM coding agents on realistic software engineering tasks.

## Architecture
- `gateway/`: External API layer with authentication and request routing.
- `core/`: Business logic including order management, tax calculation, and inventory.
- `utils/`: Common utilities, logging infrastructure, and validators.

## Usage
Run tests via `pytest tests/`.

## Demo
To test the system in live mode without the test suite:

```bash
python run_demo.py
```

## Known Issues
See `OPTI_SPEC.md` for the complete list of optimization tasks and known issues to resolve.
