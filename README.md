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

## Setup

```bash
npm install
npm run build
```

## Usage

1. Copy `config.example.yaml` to `config.yaml`
2. Point it to your running OpenCode server
3. Run it:

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
