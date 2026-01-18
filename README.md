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

## License

MIT
