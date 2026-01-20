#!/usr/bin/env bash
#
# run-benchmark.sh - Run a benchmark test with testbed management
#
# Usage:
#   ./scripts/run-benchmark.sh [options] [phase]
#
# Options:
#   -p, --project <name>   Project to test: phoenix (default) or chimera
#   -a, --agent <agent>    Agent to use (default: build)
#   -m, --model <model>    Model string (e.g. "google:gemini-2.5-pro")
#   -t, --tag <tag>        Tag to append to output directory (e.g. "with-plugin")
#   -c, --continue         Continue with existing testbed (no reset)
#   -r, --reset            Force reset testbed before running
#   -n, --name <name>      Custom testbed name (default: {project}-test)
#   -h, --help             Show this help
#
# Examples:
#   ./scripts/run-benchmark.sh                     # Phoenix full benchmark
#   ./scripts/run-benchmark.sh phase1              # Phoenix phase 1 only
#   ./scripts/run-benchmark.sh -a coder -m google:gemini-2.5-pro phase1
#   ./scripts/run-benchmark.sh -p chimera          # Chimera full benchmark
#   ./scripts/run-benchmark.sh -c phase2           # Continue with phase 2
#   ./scripts/run-benchmark.sh -r phase1           # Reset and run phase 1
#   ./scripts/run-benchmark.sh -p chimera -c full  # Chimera full, continue
#   ./scripts/run-benchmark.sh -t no-plugin phase1 # Tag output: phase1-no-plugin
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Defaults
PROJECT="phoenix"
TESTBED_NAME=""
MODE="auto"  # auto, continue, reset
PHASE="full"
TAG=""

# Model configuration
AGENT="build"
MODEL="google:antigravity-gemini-3-flash"
MODEL_CTX="1000000"
MODEL_OUTPUT="65536"

usage() {
    sed -n '3,24p' "$0" | sed 's/^# //' | sed 's/^#//'
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -p|--project)
            PROJECT="$2"
            shift 2
            ;;
        -a|--agent)
            AGENT="$2"
            shift 2
            ;;
        -m|--model)
            MODEL="$2"
            shift 2
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -c|--continue)
            MODE="continue"
            shift
            ;;
        -r|--reset)
            MODE="reset"
            shift
            ;;
        -n|--name)
            TESTBED_NAME="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        -*)
            echo "Unknown option: $1"
            usage
            ;;
        *)
            PHASE="$1"
            shift
            ;;
    esac
done

# Validate project
if [[ "$PROJECT" != "phoenix" && "$PROJECT" != "chimera" ]]; then
    echo "Error: Unknown project '$PROJECT'. Use 'phoenix' or 'chimera'."
    exit 1
fi

# Set testbed name if not specified
if [[ -z "$TESTBED_NAME" ]]; then
    TESTBED_NAME="${PROJECT}-test"
fi

BASELINE="${PROJECT}/baseline"

# Determine config file
if [[ "$PHASE" == "full" ]]; then
    CONFIG="benchmarks/${PROJECT}/full_benchmark.yaml"
else
    CONFIG="benchmarks/${PROJECT}/phases/${PHASE}.yaml"
fi

if [[ ! -f "$REPO_ROOT/$CONFIG" ]]; then
    echo "Error: Config not found: $CONFIG"
    if [[ "$PROJECT" == "phoenix" ]]; then
        echo "Available phases: full, phase0, phase1, phase2, phase3, phase4"
    else
        echo "Available phases: full, phase0, phase1, phase2, phase3"
    fi
    exit 1
fi

echo "=== Benchmark Test ==="
echo "Project: $PROJECT"
echo "Phase:   $PHASE"
echo "Agent:   $AGENT"
echo "Model:   $MODEL"
echo "Testbed: $TESTBED_NAME"
echo "Mode:    $MODE"
if [[ -n "$TAG" ]]; then
    echo "Tag:     $TAG"
fi
echo ""

# Testbed management
TESTBED_PATH="$REPO_ROOT/testbeds/$TESTBED_NAME"
TESTBED_EXISTS=false

if [[ -d "$TESTBED_PATH" ]]; then
    TESTBED_EXISTS=true
fi

case "$MODE" in
    auto)
        if $TESTBED_EXISTS; then
            echo ">>> Testbed exists, resetting..."
            "$SCRIPT_DIR/testbed.sh" -b "$BASELINE" reset "$TESTBED_NAME"
        else
            echo ">>> Creating testbed..."
            "$SCRIPT_DIR/testbed.sh" -b "$BASELINE" create "$TESTBED_NAME"
        fi
        ;;
    continue)
        if $TESTBED_EXISTS; then
            echo ">>> Continuing with existing testbed..."
        else
            echo ">>> Testbed doesn't exist, creating..."
            "$SCRIPT_DIR/testbed.sh" -b "$BASELINE" create "$TESTBED_NAME"
        fi
        ;;
    reset)
        if $TESTBED_EXISTS; then
            echo ">>> Force resetting testbed..."
            "$SCRIPT_DIR/testbed.sh" -b "$BASELINE" reset "$TESTBED_NAME"
        else
            echo ">>> Creating testbed..."
            "$SCRIPT_DIR/testbed.sh" -b "$BASELINE" create "$TESTBED_NAME"
        fi
        ;;
esac
echo ""

# Check OpenCode server
echo ">>> Checking OpenCode server..."
if ! curl -s http://127.0.0.1:4096/health >/dev/null 2>&1; then
    echo ""
    echo "Error: OpenCode TUI not running on port 4096"
    echo ""
    echo "Start it with:"
    echo "  cd $TESTBED_PATH && opencode"
    echo ""
    exit 1
fi
echo "    Server OK"
echo ""

# Run benchmark
echo ">>> Running benchmark..."
echo ""
cd "$REPO_ROOT"

export TESTBED_PATH
export AGENT
export MODEL
export MODEL_CTX
export MODEL_OUTPUT
export RUN_TAG="$TAG"

node dist/index.js -c "$CONFIG"

# Show results location
SAFE_MODEL="${MODEL//:/-}"
if [[ -n "$TAG" ]]; then
    RESULT_DIR="${PROJECT}-${PHASE}-${AGENT}-${SAFE_MODEL}-${TAG}"
else
    RESULT_DIR="${PROJECT}-${PHASE}-${AGENT}-${SAFE_MODEL}"
fi
echo ""
echo "=== Done ==="
echo "Results: out/${RESULT_DIR}/metrics.yaml"
