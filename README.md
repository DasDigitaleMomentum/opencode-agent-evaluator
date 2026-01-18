# OpenCode Agent Evaluator

A simple CLI tool to benchmark OpenCode AI agent runs. I built this to compare different agent setups and see where tokens actually go.

## What it does

- Sends prompts to an OpenCode server and tracks everything
- Shows token usage per session (input, output, reasoning, cache)
- Labels sessions as LEAD, SUB #1, SUB #2 etc. so you can follow the flow
- Estimates how many tokens go into tool calls vs. actual reasoning
- Outputs structured YAML metrics for further analysis

## Why?

I wanted to understand how efficient different sub-agent scenarios are. A setup that burns most tokens on tool calls is usually not great. This tool helps spot that.

## Prerequisites

- Node.js 18+
- A running OpenCode TUI instance (the evaluator connects to its built-in web server)

## Setup

```bash
npm install
npm run build
```

## Usage

1. **Start OpenCode TUI** in your target project directory:
   ```bash
   cd /path/to/your/project
   opencode
   ```
   This starts the TUI with a built-in web server on port 4096.

   > **Important:** Do NOT use `opencode serve` - the evaluator requires the full TUI web server, not the headless API server. The headless server has a different response format that is incompatible with this tool.

2. Create a `config.yaml` (see example below)

3. Run the evaluator:
   ```bash
   node dist/index.js -c config.yaml
   ```

## Config

```yaml
runId: "my-test-run"
agent: "plan"
model:
  id: "google:gemini-2.5-flash"
  contextWindow: 1000000
  outputLimit: 65536
path: "/path/to/your/project"
outputDir: "./out"
baseUrl: "http://127.0.0.1:4096"
prompts:
  - "Your prompt here"
```

## Output

Results go into `out/{runId}/`:
- `metrics.yaml` - structured token usage per session
- `log.txt` - full conversation log

## Benchmarks

This repository includes two benchmark projects for evaluating AI coding agents:

### Available Benchmarks

| Project   | Phases | Description                                      |
| --------- | ------ | ------------------------------------------------ |
| **Chimera** | 0-3    | Order processing backend (DE) - Bugfix, Logging, Hooks |
| **Phoenix** | 0-4    | Order processing backend (EN) - adds Input Validation  |

### Running a Benchmark

```bash
# 1. Create a testbed from a baseline project
./scripts/testbed.sh create my-test -b chimera/baseline

# 2. Start OpenCode TUI in the testbed directory
cd testbeds/my-test && opencode

# 3. Run the full benchmark (in another terminal)
TESTBED_PATH=$(pwd)/testbeds/my-test node dist/index.js -c benchmarks/chimera/full_benchmark.yaml

# Or run individual phases:
node dist/index.js -c benchmarks/chimera/phases/phase1.yaml
```

### Testbed Management

```bash
./scripts/testbed.sh create <name> [-b baseline]  # Create new testbed
./scripts/testbed.sh reset <name>                 # Reset to baseline
./scripts/testbed.sh diff <name>                  # Show changes
./scripts/testbed.sh snapshot <name> <checkpoint> # Save checkpoint
./scripts/testbed.sh restore <name> <checkpoint>  # Restore checkpoint
./scripts/testbed.sh clean <name>                 # Remove testbed
./scripts/testbed.sh baselines                    # List available baselines
```

### Benchmark Structure

```
benchmarks/
├── chimera/
│   ├── baseline/           # Project source (OPTI_SPEC.md included)
│   ├── full_benchmark.yaml # Run all phases
│   └── phases/
│       ├── phase0.yaml     # Project exploration
│       ├── phase1.yaml     # Bugfix
│       ├── phase2.yaml     # Logging refactoring
│       └── phase3.yaml     # Hook system
└── phoenix/
    ├── baseline/
    ├── full_benchmark.yaml
    └── phases/
        ├── phase0.yaml
        ├── phase1.yaml
        ├── phase2.yaml
        ├── phase3.yaml
        └── phase4.yaml     # Input validation
```

## License

MIT
