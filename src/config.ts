import fs from "node:fs/promises"
import path from "node:path"
import yaml from "js-yaml"

export interface ModelConfig {
  id: string
  providerId: string
  modelId: string
  contextWindow: number
  outputLimit: number
}

export interface RunConfig {
  runId: string
  agent: string
  model: ModelConfig
  path: string
  outputDir: string
  prompts: string[]
  baseUrl: string
}

export interface CliOverrides {
  agent?: string
  modelOverride?: string
  path?: string
  baseUrl?: string
}

export async function loadRunConfig(configPath: string, overrides: CliOverrides): Promise<RunConfig> {
  const absolutePath = path.resolve(configPath)
  const raw = await fs.readFile(absolutePath, "utf-8")
  const expanded = expandEnvVariables(raw)
  const parsed = yaml.load(expanded)
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Config YAML must contain a mapping object")
  }
  const config = parseRunConfig(parsed as Record<string, unknown>)
  return applyOverrides(config, overrides)
}

/**
 * Expands environment variables in a string.
 * Supports:
 *   ${VAR}          - replaced with env value, error if not set
 *   ${VAR:-default} - replaced with env value, or default if not set
 *   ${VAR:-}        - replaced with env value, or empty string if not set
 *   ${VAR:+suffix}  - replaced with suffix if VAR is set, empty string if not
 *                     (suffix can contain nested ${} expressions)
 */
function expandEnvVariables(content: string): string {
  // First pass: handle ${VAR:+suffix} syntax with proper brace matching
  content = expandConditionalSuffix(content)

  // Second pass: handle ${VAR} and ${VAR:-default} syntax
  const defaultPattern = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)(?::-([^}]*))?\}/g

  return content.replace(defaultPattern, (match, varName: string, defaultValue?: string) => {
    const value = process.env[varName]

    if (value !== undefined) {
      return value
    }

    if (defaultValue !== undefined) {
      return defaultValue
    }

    throw new Error(`Environment variable ${varName} is not set and has no default value`)
  })
}

/**
 * Expands ${VAR:+suffix} patterns where suffix can contain nested ${} expressions.
 * Uses manual parsing to properly match braces.
 */
function expandConditionalSuffix(content: string): string {
  const marker = "${"
  let result = ""
  let i = 0

  while (i < content.length) {
    const markerPos = content.indexOf(marker, i)
    if (markerPos === -1) {
      result += content.slice(i)
      break
    }

    // Add content before the marker
    result += content.slice(i, markerPos)

    // Try to parse ${VAR:+suffix} pattern
    const parsed = parseConditionalSuffix(content, markerPos)
    if (parsed) {
      const value = process.env[parsed.varName]
      if (value !== undefined && value !== "") {
        // Variable is set - recursively expand the suffix
        result += expandEnvVariables(parsed.suffix)
      }
      // If variable not set, add nothing (empty string)
      i = parsed.endPos
    } else {
      // Not a :+ pattern, just add the marker and continue
      result += marker
      i = markerPos + marker.length
    }
  }

  return result
}

/**
 * Parses a ${VAR:+suffix} pattern starting at pos, handling nested braces.
 * Returns null if not a :+ pattern.
 */
function parseConditionalSuffix(content: string, pos: number): { varName: string; suffix: string; endPos: number } | null {
  // Must start with ${
  if (content.slice(pos, pos + 2) !== "${") return null

  // Find the variable name
  let i = pos + 2
  const varNameStart = i
  while (i < content.length && /[a-zA-Z0-9_]/.test(content[i])) {
    i++
  }
  const varName = content.slice(varNameStart, i)
  if (!varName || !/^[a-zA-Z_]/.test(varName)) return null

  // Check for :+ operator
  if (content.slice(i, i + 2) !== ":+") return null
  i += 2

  // Parse the suffix, counting braces to find the matching }
  const suffixStart = i
  let braceDepth = 1

  while (i < content.length && braceDepth > 0) {
    if (content.slice(i, i + 2) === "${") {
      braceDepth++
      i += 2
    } else if (content[i] === "}") {
      braceDepth--
      if (braceDepth === 0) break
      i++
    } else {
      i++
    }
  }

  if (braceDepth !== 0) return null // Unbalanced braces

  const suffix = content.slice(suffixStart, i)
  return { varName, suffix, endPos: i + 1 } // +1 to skip the closing }
}

function parseRunConfig(raw: Record<string, unknown>): RunConfig {
  return {
    runId: requireNonEmptyString(raw.runId, "runId"),
    agent: requireNonEmptyString(raw.agent, "agent"),
    model: parseModelConfig(raw.model),
    path: requireNonEmptyString(raw.path, "path"),
    outputDir: requireNonEmptyString(raw.outputDir, "outputDir"),
    prompts: requireStringArray(raw.prompts, "prompts"),
    baseUrl: requireNonEmptyString(raw.baseUrl, "baseUrl"),
  }
}

function parseModelConfig(raw: unknown): ModelConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("model must be an object")
  }
  const model = raw as Record<string, unknown>
  const id = requireNonEmptyString(model.id, "model.id")
  const parsed = parseModelId(id, "model.id")
  return {
    id,
    providerId: parsed.providerId,
    modelId: parsed.modelId,
    contextWindow: requirePositiveNumber(model.contextWindow, "model.contextWindow"),
    outputLimit: requirePositiveNumber(model.outputLimit, "model.outputLimit"),
  }
}

function applyOverrides(config: RunConfig, overrides: CliOverrides): RunConfig {
  const next = { ...config }
  if (overrides.agent) {
    next.agent = overrides.agent
  }
  if (overrides.path) {
    next.path = overrides.path
  }
  if (overrides.modelOverride) {
    const parsed = parseModelId(overrides.modelOverride, "model override")
    next.model = { ...next.model, id: parsed.id, providerId: parsed.providerId, modelId: parsed.modelId }
  }
  if (overrides.baseUrl) {
    next.baseUrl = overrides.baseUrl
  }
  return next
}

function parseModelId(value: string, label: string): { id: string; providerId: string; modelId: string } {
  const [providerId, modelId] = value.split(":")
  if (!providerId || !modelId) {
    throw new Error(`${label} must be in providerId:modelId format`)
  }
  return { id: value, providerId, modelId }
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}

function requirePositiveNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number`)
  }
  return value
}

function requireStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty array of strings`)
  }
  const normalized = value.map((entry) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`${label} must contain non-empty strings`)
    }
    return entry
  })
  return normalized
}
