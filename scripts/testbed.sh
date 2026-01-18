#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REALWORLD_DIR="$REPO_ROOT/benchmarks"
DEFAULT_BASELINE="chimera/baseline"
BASELINE_NAME=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

resolve_testbed_root() {
    # Check environment variable first
    if [[ -n "${TESTBED_ROOT:-}" ]]; then
        echo "$TESTBED_ROOT"
        return 0
    fi

    # Default to ./testbeds in repo root
    echo "$REPO_ROOT/testbeds"
}

TESTBED_ROOT="$(resolve_testbed_root)"
if [[ -z "$TESTBED_ROOT" ]]; then
    log_error "Resolved testbed root is empty"
fi
mkdir -p "$TESTBED_ROOT"
TESTBED_ROOT="$(cd "$TESTBED_ROOT" && pwd)"
SNAPSHOTS_DIR="$TESTBED_ROOT/.snapshots"

usage() {
    cat <<EOF
Usage: $(basename "$0") [options] <command> [arguments]

Options:
    -b, --baseline <name>      Baseline project to use (default: chimera/baseline)
                               Available: chimera/baseline, phoenix/baseline

Environment:
    TESTBED_ROOT               Optional override; defaults to ./testbeds

Commands:
    create <name>                 Create a new testbed from baseline
    reset <name>                  Reset testbed to baseline state
    diff <name>                   Show differences between testbed and baseline
    clean <name>                  Remove a testbed
    snapshot <name> <checkpoint>  Save current testbed state as checkpoint
    restore <name> <checkpoint>   Restore testbed from checkpoint
    list                          List all testbeds and snapshots
    compare <name> <checkpoint>   Compare testbed with a snapshot
    baselines                     List available baseline projects

Examples:
    $(basename "$0") create run1
    $(basename "$0") -b phoenix_project create run1
    $(basename "$0") --baseline phoenix_project reset run1
    $(basename "$0") diff run1
    $(basename "$0") snapshot run1 before-refactor
    $(basename "$0") restore run1 before-refactor
    $(basename "$0") compare run1 before-refactor
    $(basename "$0") clean run1
    $(basename "$0") baselines
EOF
    exit 1
}

ensure_baseline() {
    if [[ ! -d "$BASELINE_DIR" ]]; then
        log_error "Baseline directory not found: $BASELINE_DIR"
    fi
}

get_testbed_path() {
    local name="$1"
    echo "$TESTBED_ROOT/$name"
}

get_snapshot_path() {
    local name="$1"
    local checkpoint="$2"
    echo "$SNAPSHOTS_DIR/$name/$checkpoint"
}

# ============================================================================
# Commands
# ============================================================================

cmd_create() {
    local name="${1:-}"
    [[ -z "$name" ]] && log_error "Missing testbed name. Usage: create <name>"

    ensure_baseline
    local testbed_path
    testbed_path="$(get_testbed_path "$name")"

    if [[ -d "$testbed_path" ]]; then
        log_error "Testbed '$name' already exists. Use 'reset' to restore or 'clean' first."
    fi

    log_info "Creating testbed '$name' from baseline..."
    mkdir -p "$testbed_path"
    cp -r "$BASELINE_DIR"/* "$testbed_path/"

    # Remove __pycache__ directories
    find "$testbed_path" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

    log_success "Testbed created at: $testbed_path"
}

cmd_reset() {
    local name="${1:-}"
    [[ -z "$name" ]] && log_error "Missing testbed name. Usage: reset <name>"

    ensure_baseline
    local testbed_path
    testbed_path="$(get_testbed_path "$name")"

    if [[ ! -d "$testbed_path" ]]; then
        log_warn "Testbed '$name' does not exist. Creating new one..."
        cmd_create "$name"
        return
    fi

    log_info "Resetting testbed '$name' to baseline..."
    rm -rf "$testbed_path"
    mkdir -p "$testbed_path"
    cp -r "$BASELINE_DIR"/* "$testbed_path/"

    # Remove __pycache__ directories
    find "$testbed_path" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

    log_success "Testbed '$name' reset to baseline state"
}

cmd_diff() {
    local name="${1:-}"
    [[ -z "$name" ]] && log_error "Missing testbed name. Usage: diff <name>"

    ensure_baseline
    local testbed_path
    testbed_path="$(get_testbed_path "$name")"

    if [[ ! -d "$testbed_path" ]]; then
        log_error "Testbed '$name' does not exist"
    fi

    log_info "Comparing testbed '$name' with baseline..."
    echo ""

    # Create temp directories without __pycache__ for clean diff
    local tmp_baseline tmp_testbed
    tmp_baseline=$(mktemp -d)
    tmp_testbed=$(mktemp -d)

    cp -r "$BASELINE_DIR"/* "$tmp_baseline/"
    cp -r "$testbed_path"/* "$tmp_testbed/"

    find "$tmp_baseline" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find "$tmp_testbed" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

    # Generate diff
    if diff -rq "$tmp_baseline" "$tmp_testbed" > /dev/null 2>&1; then
        echo -e "${GREEN}No differences found. Testbed matches baseline.${NC}"
    else
        echo -e "${YELLOW}=== Summary of changes ===${NC}"
        diff -rq "$tmp_baseline" "$tmp_testbed" 2>/dev/null | \
            sed "s|$tmp_baseline|baseline|g" | \
            sed "s|$tmp_testbed|testbed/$name|g" || true

        echo ""
        echo -e "${YELLOW}=== Detailed diff ===${NC}"
        diff -ru "$tmp_baseline" "$tmp_testbed" 2>/dev/null | \
            sed "s|$tmp_baseline|baseline|g" | \
            sed "s|$tmp_testbed|testbed/$name|g" || true
    fi

    rm -rf "$tmp_baseline" "$tmp_testbed"
}

cmd_clean() {
    local name="${1:-}"
    [[ -z "$name" ]] && log_error "Missing testbed name. Usage: clean <name>"

    local testbed_path
    testbed_path="$(get_testbed_path "$name")"
    local snapshot_path="$SNAPSHOTS_DIR/$name"

    if [[ ! -d "$testbed_path" ]] && [[ ! -d "$snapshot_path" ]]; then
        log_error "Testbed '$name' does not exist"
    fi

    log_info "Removing testbed '$name'..."

    if [[ -d "$testbed_path" ]]; then
        rm -rf "$testbed_path"
        log_success "Removed testbed directory"
    fi

    if [[ -d "$snapshot_path" ]]; then
        rm -rf "$snapshot_path"
        log_success "Removed associated snapshots"
    fi

    log_success "Testbed '$name' cleaned up"
}

cmd_snapshot() {
    local name="${1:-}"
    local checkpoint="${2:-}"
    [[ -z "$name" ]] && log_error "Missing testbed name. Usage: snapshot <name> <checkpoint>"
    [[ -z "$checkpoint" ]] && log_error "Missing checkpoint name. Usage: snapshot <name> <checkpoint>"

    local testbed_path
    testbed_path="$(get_testbed_path "$name")"

    if [[ ! -d "$testbed_path" ]]; then
        log_error "Testbed '$name' does not exist"
    fi

    local snapshot_path
    snapshot_path="$(get_snapshot_path "$name" "$checkpoint")"

    if [[ -d "$snapshot_path" ]]; then
        log_error "Snapshot '$checkpoint' already exists for testbed '$name'"
    fi

    log_info "Creating snapshot '$checkpoint' for testbed '$name'..."
    mkdir -p "$snapshot_path"
    cp -r "$testbed_path"/* "$snapshot_path/"

    # Remove __pycache__ directories
    find "$snapshot_path" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

    # Save metadata
    echo "$(date -Iseconds)" > "$snapshot_path/.snapshot_time"

    log_success "Snapshot saved at: $snapshot_path"
}

cmd_restore() {
    local name="${1:-}"
    local checkpoint="${2:-}"
    [[ -z "$name" ]] && log_error "Missing testbed name. Usage: restore <name> <checkpoint>"
    [[ -z "$checkpoint" ]] && log_error "Missing checkpoint name. Usage: restore <name> <checkpoint>"

    local testbed_path
    testbed_path="$(get_testbed_path "$name")"
    local snapshot_path
    snapshot_path="$(get_snapshot_path "$name" "$checkpoint")"

    if [[ ! -d "$snapshot_path" ]]; then
        log_error "Snapshot '$checkpoint' does not exist for testbed '$name'"
    fi

    log_info "Restoring testbed '$name' from snapshot '$checkpoint'..."

    rm -rf "$testbed_path"
    mkdir -p "$testbed_path"
    cp -r "$snapshot_path"/* "$testbed_path/"
    rm -f "$testbed_path/.snapshot_time"

    log_success "Testbed '$name' restored from snapshot '$checkpoint'"
}

cmd_compare() {
    local name="${1:-}"
    local checkpoint="${2:-}"
    [[ -z "$name" ]] && log_error "Missing testbed name. Usage: compare <name> <checkpoint>"
    [[ -z "$checkpoint" ]] && log_error "Missing checkpoint name. Usage: compare <name> <checkpoint>"

    local testbed_path
    testbed_path="$(get_testbed_path "$name")"
    local snapshot_path
    snapshot_path="$(get_snapshot_path "$name" "$checkpoint")"

    if [[ ! -d "$testbed_path" ]]; then
        log_error "Testbed '$name' does not exist"
    fi

    if [[ ! -d "$snapshot_path" ]]; then
        log_error "Snapshot '$checkpoint' does not exist for testbed '$name'"
    fi

    log_info "Comparing testbed '$name' with snapshot '$checkpoint'..."

    if [[ -f "$snapshot_path/.snapshot_time" ]]; then
        echo -e "${BLUE}Snapshot created:${NC} $(cat "$snapshot_path/.snapshot_time")"
    fi
    echo ""

    # Create temp directories without __pycache__ and metadata
    local tmp_snapshot tmp_testbed
    tmp_snapshot=$(mktemp -d)
    tmp_testbed=$(mktemp -d)

    cp -r "$snapshot_path"/* "$tmp_snapshot/"
    cp -r "$testbed_path"/* "$tmp_testbed/"

    find "$tmp_snapshot" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find "$tmp_testbed" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    rm -f "$tmp_snapshot/.snapshot_time"

    if diff -rq "$tmp_snapshot" "$tmp_testbed" > /dev/null 2>&1; then
        echo -e "${GREEN}No differences found. Testbed matches snapshot.${NC}"
    else
        echo -e "${YELLOW}=== Summary of changes ===${NC}"
        diff -rq "$tmp_snapshot" "$tmp_testbed" 2>/dev/null | \
            sed "s|$tmp_snapshot|snapshot/$checkpoint|g" | \
            sed "s|$tmp_testbed|testbed/$name|g" || true

        echo ""
        echo -e "${YELLOW}=== Detailed diff ===${NC}"
        diff -ru "$tmp_snapshot" "$tmp_testbed" 2>/dev/null | \
            sed "s|$tmp_snapshot|snapshot/$checkpoint|g" | \
            sed "s|$tmp_testbed|testbed/$name|g" || true
    fi

    rm -rf "$tmp_snapshot" "$tmp_testbed"
}

cmd_list() {
    log_info "Available testbeds and snapshots:"
    echo ""

    if [[ ! -d "$TESTBED_ROOT" ]] || [[ -z "$(ls -A "$TESTBED_ROOT" 2>/dev/null | grep -v "^\.snapshots$" || true)" ]]; then
        echo "  No testbeds found."
    else
        echo -e "${BLUE}Testbeds:${NC}"
        for dir in "$TESTBED_ROOT"/*/; do
            if [[ -d "$dir" ]] && [[ "$(basename "$dir")" != ".snapshots" ]]; then
                local name
                name="$(basename "$dir")"
                echo "  - $name"
            fi
        done
    fi

    echo ""

    if [[ ! -d "$SNAPSHOTS_DIR" ]] || [[ -z "$(ls -A "$SNAPSHOTS_DIR" 2>/dev/null || true)" ]]; then
        echo "  No snapshots found."
    else
        echo -e "${BLUE}Snapshots:${NC}"
        for testbed_dir in "$SNAPSHOTS_DIR"/*/; do
            if [[ -d "$testbed_dir" ]]; then
                local testbed_name
                testbed_name="$(basename "$testbed_dir")"
                for snap_dir in "$testbed_dir"/*/; do
                    if [[ -d "$snap_dir" ]]; then
                        local snap_name
                        snap_name="$(basename "$snap_dir")"
                        local snap_time=""
                        if [[ -f "$snap_dir/.snapshot_time" ]]; then
                            snap_time=" ($(cat "$snap_dir/.snapshot_time"))"
                        fi
                        echo "  - $testbed_name/$snap_name$snap_time"
                    fi
                done
            fi
        done
    fi
}

cmd_baselines() {
    log_info "Available baseline projects:"
    echo ""

    if [[ ! -d "$REALWORLD_DIR" ]]; then
        echo "  No baselines found (realworld directory missing)."
        return
    fi

    for dir in "$REALWORLD_DIR"/*/; do
        if [[ -d "$dir" ]]; then
            local name
            name="$(basename "$dir")"
            local marker=""
            if [[ "$name" == "$DEFAULT_BASELINE" ]]; then
                marker=" ${GREEN}(default)${NC}"
            fi
            echo -e "  - $name$marker"
        fi
    done
}

resolve_baseline() {
    local name="${1:-$DEFAULT_BASELINE}"
    local baseline_path="$REALWORLD_DIR/$name"
    
    if [[ ! -d "$baseline_path" ]]; then
        log_error "Baseline '$name' not found in $REALWORLD_DIR"
    fi
    
    echo "$baseline_path"
}

# ============================================================================
# Main
# ============================================================================

[[ $# -lt 1 ]] && usage

# Parse options
while [[ $# -gt 0 ]]; do
    case "$1" in
        -b|--baseline)
            if [[ -z "${2:-}" ]]; then
                log_error "Missing argument for $1"
            fi
            BASELINE_NAME="$2"
            shift 2
            ;;
        -h|--help|help)
            usage
            ;;
        -*)
            log_error "Unknown option: $1. Use 'help' for usage."
            ;;
        *)
            break
            ;;
    esac
done

[[ $# -lt 1 ]] && usage

# Set BASELINE_DIR based on selected baseline
BASELINE_DIR="$(resolve_baseline "${BASELINE_NAME:-$DEFAULT_BASELINE}")"

command="$1"
shift

case "$command" in
    create)   cmd_create "$@" ;;
    reset)    cmd_reset "$@" ;;
    diff)     cmd_diff "$@" ;;
    clean)    cmd_clean "$@" ;;
    snapshot) cmd_snapshot "$@" ;;
    restore)  cmd_restore "$@" ;;
    compare)  cmd_compare "$@" ;;
    list)     cmd_list "$@" ;;
    baselines) cmd_baselines "$@" ;;
    help|-h|--help) usage ;;
    *)        log_error "Unknown command: $command. Use 'help' for usage." ;;
esac
