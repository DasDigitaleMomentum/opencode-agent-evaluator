# Chimera Project - Order Management System

## Overview
This system handles order processing, stock management, and tax calculation.

## Architecture
- `gateway/`: External API and Request Handling.
- `core/`: Business logic and persistence.
- `utils/`: Common utilities and legacy logging.

## Usage
Run tests via `pytest tests/`.

## Execution & Demo
Um das System im Live-Modus zu testen, ohne die Test-Suite zu nutzen, kann die API-Simulation gestartet werden:

```bash
python run_demo.py
