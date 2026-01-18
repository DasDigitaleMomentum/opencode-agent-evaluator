#!/usr/bin/env bash
#
# run-phoenix-test.sh - Run a Phoenix benchmark test
#
# Usage:
#   ./scripts/run-phoenix-test.sh [phase]
#
# Examples:
#   ./scripts/run-phoenix-test.sh          # Run full benchmark
#   ./scripts/run-phoenix-test.sh phase1   # Run only phase 1
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Configuration
TESTBED_NAME="phoenix-test"
BASELINE="phoenix/baseline"
AGENT="build"
MODEL="google:antigravity-gemini-3-flash"
MODEL_CTX="1000000"
MODEL_OUTPUT="65536"

# Determine which config to use
PHASE="${1:-full}"
if [[ "$PHASE" == "full" ]]; then
    CONFIG="benchmarks/phoenix/full_benchmark.yaml"
else
    CONFIG="benchmarks/phoenix/phases/${PHASE}.yaml"
fi

if [[ ! -f "$REPO_ROOT/$CONFIG" ]]; then
    echo "Error: Config not found: $CONFIG"
    echo "Available phases: full, phase0, phase1, phase2, phase3, phase4"
    exit 1
fi

echo "=== Phoenix Benchmark Test ==="
echo "Agent:   $AGENT"
echo "Model:   $MODEL"
echo "Phase:   $PHASE"
echo "Config:  $CONFIG"
echo ""

# Setup/Reset testbed
echo ">>> Setting up testbed: $TESTBED_NAME"
if "$SCRIPT_DIR/testbed.sh" list 2>/dev/null | grep -q "^$TESTBED_NAME$"; then
    echo "    Resetting existing testbed..."
    "$SCRIPT_DIR/testbed.sh" reset "$TESTBED_NAME"
else
    echo "    Creating new testbed..."
    "$SCRIPT_DIR/testbed.sh" create "$TESTBED_NAME" -b "$BASELINE"
fi
echo ""

# Check OpenCode server
echo ">>> Checking OpenCode server..."
if ! curl -s http://127.0.0.1:4096/health >/dev/null 2>&1; then
    echo "Error: OpenCode TUI not running on port 4096"
    echo "Start it with: cd testbeds/$TESTBED_NAME && opencode"
    exit 1
fi
echo "    Server OK"
echo ""

# Run benchmark
echo ">>> Running benchmark..."
cd "$REPO_ROOT"

export TESTBED_PATH="$REPO_ROOT/testbeds/$TESTBED_NAME"
export AGENT
export MODEL
export MODEL_CTX
export MODEL_OUTPUT

node dist/index.js -c "$CONFIG"

echo ""
echo "=== Done ==="
echo "Results: out/phoenix-${PHASE}-${AGENT}-${MODEL//:/'-'}/metrics.yaml"
