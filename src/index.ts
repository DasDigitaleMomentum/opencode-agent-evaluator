#!/usr/bin/env node
import { Command } from "commander"
import { loadRunConfig } from "./config.js"
import { ensureOutputPaths } from "./logger.js"
import { runEvaluation, writeMetrics } from "./sdk-runner.js"

const program = new Command()

program
  .name("agent-evaluator")
  .description("Evaluate OpenCode agent runs")
  .requiredOption("-c, --config <path>", "Path to run YAML config")
  .option("--agent <agent>", "Override agent name")
  .option("--model <provider:model>", "Override model with providerId:modelId")
  .option("--path <path>", "Override run path")
  .option("--base-url <url>", "Override OpenCode server base URL")

program.parse(process.argv)

const options = program.opts()

const overrides = {
  agent: options.agent as string | undefined,
  modelOverride: options.model as string | undefined,
  path: options.path as string | undefined,
  baseUrl: options.baseUrl as string | undefined,
}

try {
  const config = await loadRunConfig(options.config as string, overrides)
  const paths = await ensureOutputPaths(config.outputDir, config.runId)
  const metrics = await runEvaluation(config, paths.logFile)
  await writeMetrics(paths.metricsFile, metrics)
  process.stdout.write("\n")
  console.log(`Metrics written to ${paths.metricsFile}`)
} catch (error) {
  if (error instanceof Error) {
    console.error(`Error: ${error.message}`)
    console.error(error.stack)
  } else {
    console.error(`Error: ${String(error)}`)
  }
  process.exit(1)
}
