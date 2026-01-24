#!/usr/bin/env npx tsx
/**
 * Analyze benchmark runs from metrics.yaml files
 * 
 * Usage:
 *   npx tsx scripts/analyze-runs.ts [output-dir]
 *   npx tsx scripts/analyze-runs.ts ./out
 * 
 * Outputs a summary table with:
 * - Model Name
 * - Agent Name
 * - Input/Output/Cache Tokens (aggregated)
 * - Total Tokens
 * - Tool Calls (Lead / Total)
 * - Number of Subagents
 * - Context Used
 * - Duration
 */

import * as fs from "fs";
import * as path from "path";
import yaml from "js-yaml";

interface SessionMetrics {
    label: string;
    agent: string;
    modelId: string;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalReasoningTokens: number;
    totalCacheReadTokens: number;
    totalCacheWriteTokens: number;
    totalTokens: number;
    totalCost: number;
    actualUsageTokens: number;
    contextWindow: number;
    outputLimit: number;
    contextUsedTokens: number | null;
    contextAvailableTokens: number | null;
    toolCallCount: number;
    taskCallCount: number;
    subagentCount: number;
    estimatedToolOutputTokens: number;
    estimatedToolInputTokens: number;
}

interface RunMetrics {
    runId: string;
    agent: string;
    model: {
        id: string;
        providerId: string;
        modelId: string;
        contextWindow: number;
        outputLimit: number;
    };
    path: string;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    sessions: Record<string, SessionMetrics>;
}

interface AggregatedRun {
    runId: string;
    dirName: string; // Directory name (more reliable for distinguishing runs)
    modelId: string;
    modelName: string;
    agentName: string;
    startedAt: string;
    // Token counts (aggregated across all sessions)
    totalInputTokens: number;
    totalOutputTokens: number;
    totalReasoningTokens: number;
    totalCacheReadTokens: number;
    totalCacheWriteTokens: number;
    // Computed aggregations
    computedTokens: number; // In + Out + Reasoning (no cache)
    totalTokensWithCache: number; // In + Out + Reasoning + Cache
    // Tool calls
    leadToolCalls: number;
    subagentToolCalls: number;
    totalToolCalls: number;
    // Subagents
    subagentCount: number;
    // Context
    contextWindow: number;
    leadContextUsed: number; // Context used by lead session only
    // Duration
    durationMs: number;
    durationFormatted: string;
    // Cost
    totalCost: number;
}

function findMetricsFiles(dir: string): string[] {
    const files: string[] = [];

    function walk(currentDir: string) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                // Skip backup and node_modules
                if (entry.name !== "backup" && entry.name !== "node_modules") {
                    walk(fullPath);
                }
            } else if (entry.name === "metrics.yaml") {
                files.push(fullPath);
            }
        }
    }

    walk(dir);
    return files;
}

interface ParsedMetrics {
    metrics: RunMetrics;
    dirName: string;
}

function parseMetrics(filePath: string): ParsedMetrics | null {
    try {
        const content = fs.readFileSync(filePath, "utf-8");
        const metrics = yaml.load(content) as RunMetrics;
        if (!metrics || !metrics.runId || !metrics.sessions) {
            console.warn(`Skipping invalid metrics file: ${filePath}`);
            return null;
        }
        // Extract directory name from path
        const dirName = path.basename(path.dirname(filePath));
        return { metrics, dirName };
    } catch (error) {
        console.warn(`Failed to parse ${filePath}: ${error}`);
        return null;
    }
}

function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
    }
    return `${minutes}m ${remainingSeconds}s`;
}

function formatNumber(n: number): string {
    if (n >= 1_000_000) {
        return `${(n / 1_000_000).toFixed(2)}M`;
    }
    if (n >= 1_000) {
        return `${(n / 1_000).toFixed(1)}K`;
    }
    return n.toString();
}

function aggregateRun(parsed: ParsedMetrics): AggregatedRun {
    const { metrics, dirName } = parsed;
    const sessions = Object.values(metrics.sessions);
    const leadSession = sessions.find(s => s.label === "LEAD");
    const subagentSessions = sessions.filter(s => s.label !== "LEAD");

    // Aggregate totals
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalReasoningTokens = 0;
    let totalCacheReadTokens = 0;
    let totalCacheWriteTokens = 0;
    let totalToolCalls = 0;
    let totalCost = 0;

    for (const session of sessions) {
        totalInputTokens += session.totalInputTokens;
        totalOutputTokens += session.totalOutputTokens;
        totalReasoningTokens += session.totalReasoningTokens;
        totalCacheReadTokens += session.totalCacheReadTokens;
        totalCacheWriteTokens += session.totalCacheWriteTokens;
        totalToolCalls += session.toolCallCount;
        totalCost += session.totalCost;
    }

    // Compute aggregations
    const computedTokens = totalInputTokens + totalOutputTokens + totalReasoningTokens;
    const totalTokensWithCache = computedTokens + totalCacheReadTokens;

    // Calculate subagent tool calls
    const leadToolCalls = leadSession?.toolCallCount ?? 0;
    const subagentToolCalls = totalToolCalls - leadToolCalls;

    // Lead context used
    const leadContextUsed = leadSession?.contextUsedTokens ?? 0;

    return {
        runId: metrics.runId,
        dirName,
        modelId: metrics.model.id,
        modelName: metrics.model.modelId,
        agentName: metrics.agent,
        startedAt: metrics.startedAt,
        totalInputTokens,
        totalOutputTokens,
        totalReasoningTokens,
        totalCacheReadTokens,
        totalCacheWriteTokens,
        computedTokens,
        totalTokensWithCache,
        leadToolCalls,
        subagentToolCalls,
        totalToolCalls,
        subagentCount: subagentSessions.length,
        contextWindow: metrics.model.contextWindow,
        leadContextUsed,
        durationMs: metrics.durationMs,
        durationFormatted: formatDuration(metrics.durationMs),
        totalCost,
    };
}

function extractRunTag(dirName: string): string {
    // Extract a meaningful tag from directory name like:
    // "phoenix-full-build-openai-gpt-5.2-codex" -> "build / gpt-5.2"
    // "phoenix-full-build-openai-gpt-5.2-codexlegacy" -> "build / gpt-5.2-legacy"
    // "phoenix-full-build-openai-gpt-5.2-codex-dcp" -> "build / gpt-5.2 -dcp"
    // "phoenix-full-build-openai-gpt-5.2-codexlegacy-dcp" -> "build / gpt-5.2-legacy -dcp"
    // "phoenix-full-Sisyphus-google-antigravity-claude-opus-4-5-thinking" -> "Sisyphus / claude-opus-4.5"
    // "phoenix-full-build-google-gemini-3-flash-preview-${RUN_TAG" -> "build / gemini-3-flash (legacy)"

    // Remove common prefix
    let id = dirName.replace(/^phoenix-full-/, "");

    // Handle broken ${RUN_TAG in directory name - these are legacy runs
    if (id.includes("${")) {
        id = id.replace(/-\$\{.*$/, "");
    }
    const isBrokenTag = dirName.includes("${");

    // Known patterns: agent-provider-model[-suffix]
    // Examples:
    //   build-openai-gpt-5.2-codex
    //   build-openai-gpt-5.2-codexlegacy
    //   build-openai-gpt-5.2-codex-dcp
    //   build-openai-gpt-5.2-codexlegacy-dcp
    //   Sisyphus-google-antigravity-claude-opus-4-5-thinking
    //   delegator-google-gemini-3-flash-preview

    // Check for -dcp suffix
    let hasDcp = false;
    if (id.endsWith("-dcp")) {
        hasDcp = true;
        id = id.replace(/-dcp$/, "");
    }

    // Try to match known patterns
    let agent = "";
    let model = "";

    // Pattern: agent-openai-gpt-5.2-codex[legacy]
    const openaiMatch = id.match(/^(\w+)-openai-(.+)$/);
    if (openaiMatch) {
        agent = openaiMatch[1];
        model = openaiMatch[2];
        // Normalize model names - keep codex in name
        model = model.replace("gpt-5.2-codexlegacy", "gpt-5.2-codex-legacy");
    }

    // Pattern: agent-google-model
    const googleMatch = id.match(/^(\w+)-google-(.+)$/);
    if (googleMatch) {
        agent = googleMatch[1];
        model = googleMatch[2];
        // Normalize model names
        model = model.replace("antigravity-claude-opus-4-5-thinking", "claude-opus-4.5");
        model = model.replace("gemini-3-flash-preview", "gemini-3-flash");
    }

    if (agent && model) {
        let result = `${agent} / ${model}`;
        if (hasDcp) result += " -dcp";
        if (isBrokenTag) result += " (legacy)";
        return result;
    }

    // Fallback: return cleaned id
    return id;
}


function printMarkdownTable(runs: AggregatedRun[]): void {
    console.log("\n## Benchmark Results Summary\n");

    // Table header - sorted by Total (descending)
    console.log("| Run Tag | Total | Computed (in+out+rsn) | Cache | Lead Ctx | Tools (L/S) | Subs | Duration |");
    console.log("|---------|-------|-----------------------|-------|----------|-------------|------|----------|");

    // Sort by totalTokensWithCache descending (highest first)
    const sorted = [...runs].sort((a, b) => b.totalTokensWithCache - a.totalTokensWithCache);

    for (const run of sorted) {
        const tag = extractRunTag(run.dirName);
        // Tools: Lead / Subagent
        const toolCallStr = `${run.leadToolCalls}/${run.subagentToolCalls}`;
        const leadCtxStr = run.leadContextUsed > 0
            ? formatNumber(run.leadContextUsed)
            : "-";

        console.log(`| ${tag} | ${formatNumber(run.totalTokensWithCache)} | ${formatNumber(run.computedTokens)} | ${formatNumber(run.totalCacheReadTokens)} | ${leadCtxStr} | ${toolCallStr} | ${run.subagentCount} | ${run.durationFormatted} |`);
    }
}

function printDetailedJson(runs: AggregatedRun[]): void {
    console.log("\n## Detailed Results (JSON)\n");
    console.log("```json");
    console.log(JSON.stringify(runs, null, 2));
    console.log("```");
}

function main() {
    const outputDir = process.argv[2] || "./out";
    const absoluteDir = path.resolve(outputDir);

    if (!fs.existsSync(absoluteDir)) {
        console.error(`Output directory not found: ${absoluteDir}`);
        process.exit(1);
    }

    console.log(`Analyzing runs in: ${absoluteDir}\n`);

    const metricsFiles = findMetricsFiles(absoluteDir);
    console.log(`Found ${metricsFiles.length} metrics files\n`);

    const runs: AggregatedRun[] = [];

    for (const file of metricsFiles) {
        const metrics = parseMetrics(file);
        if (metrics) {
            const aggregated = aggregateRun(metrics);
            runs.push(aggregated);
        }
    }

    if (runs.length === 0) {
        console.log("No valid runs found.");
        return;
    }

    printMarkdownTable(runs);

    // Also output as YAML for further processing
    const outputPath = path.join(absoluteDir, "analysis-summary.yaml");
    const yamlOutput = yaml.dump({
        analyzedAt: new Date().toISOString(),
        totalRuns: runs.length,
        runs: runs.map(r => ({
            ...r,
            // Remove formatted fields for clean YAML
            durationFormatted: undefined,
        })),
    }, { noRefs: true });

    fs.writeFileSync(outputPath, yamlOutput);
    console.log(`\nSaved detailed analysis to: ${outputPath}`);
}

main();
