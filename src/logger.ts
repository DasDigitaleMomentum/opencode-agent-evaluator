import fs from "node:fs/promises"
import path from "node:path"

export interface LogPaths {
  logFile: string
  metricsFile: string
}

export async function ensureOutputPaths(outputDir: string, runId: string): Promise<LogPaths> {
  const safeRunId = sanitizeForPath(runId)
  const resolvedDir = path.resolve(outputDir, safeRunId)
  await fs.mkdir(resolvedDir, { recursive: true })
  return {
    logFile: path.join(resolvedDir, "log.txt"),
    metricsFile: path.join(resolvedDir, "metrics.yaml"),
  }
}

/**
 * Sanitizes a string for use in file paths.
 * Replaces characters that are problematic on Windows or in URLs.
 */
function sanitizeForPath(value: string): string {
  return value.replace(/[:<>"|?*]/g, "-")
}

export async function appendLogEntry(logFile: string, entry: string): Promise<void> {
  await fs.appendFile(logFile, entry)
}

export async function writeFileContents(filePath: string, contents: string): Promise<void> {
  await fs.writeFile(filePath, contents)
}

export function formatCliLine(label: string, prompt: string, response: string): string {
  const promptStr = ensureString(prompt);
  const responseStr = ensureString(response);
  
  // Single line format with truncation
  const promptShort = truncateWithEllipsis(promptStr.replace(/\n/g, " "), 60);
  const responseShort = truncateWithEllipsis(responseStr.replace(/\n/g, " "), 80);
  
  return `${label}: ${promptShort} -> ${responseShort}`;
}

function ensureString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function truncateWithEllipsis(value: unknown, maxLength: number): string {
  const str = ensureString(value);
  if (str.length <= maxLength) return str;
  if (maxLength <= 3) return str.slice(0, maxLength);
  return `${str.slice(0, maxLength - 3)}...`;
}

export function formatTokenValue(value: number): string {
  return value.toLocaleString("en-US");
}
