import { createOpencodeClient } from "@opencode-ai/sdk/v2/client";
import yaml from "js-yaml";
import {
  appendLogEntry,
  formatCliLine,
  formatTokenValue,
  truncateWithEllipsis,
  writeFileContents,
} from "./logger.js";
import {
  applyUsageEntry,
  buildUsageSummary,
  createEmptyUsageState,
  estimateTokens,
  extractUsageEntry,
  type MessageInfoLike,
  type SessionUsageState,
} from "./usage.js";
import type { RunConfig } from "./config.js";

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

interface SessionInfo {
  id: string;
  label: string;
  agent: string;
  modelId: string;
  isLead: boolean;
  subIndex: number;
}

export async function runEvaluation(
  config: RunConfig,
  logFile: string,
): Promise<RunMetrics> {
  const client = createOpencodeClient({
    baseUrl: config.baseUrl,
    responseStyle: "data",
    throwOnError: true,
  }) as any;
  const session = await createSession(client, config);
  const usageBySession = new Map<string, SessionUsageState>();
  const sessionInfoMap = new Map<string, SessionInfo>();
  const subagentSessionsByParent = new Map<string, Set<string>>();
  const startedAt = Date.now();
  let usageLineVisible = false;
  let subagentCounter = 0;

  // Register lead session
  const leadSessionId = session.id as string;
  sessionInfoMap.set(leadSessionId, {
    id: leadSessionId,
    label: "LEAD",
    agent: config.agent,
    modelId: config.model.id,
    isLead: true,
    subIndex: 0,
  });

  for (let index = 0; index < config.prompts.length; index += 1) {
    const prompt = config.prompts[index];
    const response = await sendPrompt(
      client,
      session.id as string,
      prompt,
      config,
    );
    const infos = extractMessageInfos(response);
    const assistantInfos = infos.filter((info) => info.role === "assistant");

    // Extract tool calls and render response
    const baseMessages = await fetchSessionMessages(
      client,
      session.id as string,
    );
    const baseToolCalls = extractToolCalls(baseMessages);
    const allMessages = await loadSessionMessageInfos(
      client,
      session.id as string,
      baseToolCalls,
      baseMessages,
    );
    const toolCalls = extractToolCalls(allMessages);
    const responseText = renderResponse(assistantInfos, response);

    // Build log entry with tool calls
    const logEntry = formatLogEntryWithTools(
      index + 1,
      prompt,
      responseText,
      toolCalls,
    );
    await appendLogEntry(logFile, logEntry);

    if (usageLineVisible) {
      process.stdout.write("\n");
    }

    // First: Register subagent sessions so we have labels available
    for (const toolCall of toolCalls) {
      if (toolCall.subagentSessionId) {
        const parentSessionId = toolCall.sessionID ?? session.id;
        const seen =
          subagentSessionsByParent.get(parentSessionId) ?? new Set<string>();
        if (!seen.has(toolCall.subagentSessionId)) {
          seen.add(toolCall.subagentSessionId);
          subagentCounter += 1;
          // Register subagent session with label
          if (!sessionInfoMap.has(toolCall.subagentSessionId)) {
            sessionInfoMap.set(toolCall.subagentSessionId, {
              id: toolCall.subagentSessionId,
              label: `SUB #${subagentCounter}`,
              agent: toolCall.subagentType ?? "task",
              modelId: config.model.id,
              isLead: false,
              subIndex: subagentCounter,
            });
          }
        }
        subagentSessionsByParent.set(parentSessionId, seen);
      }
    }

    // Output tool calls as separate lines with session label
    for (const toolCall of toolCalls) {
      const tcSessionId = toolCall.sessionID ?? leadSessionId;
      const tcSessionInfo = sessionInfoMap.get(tcSessionId);
      const tcLabel = tcSessionInfo?.label ?? "LEAD";
      console.log(
        formatCliLine(tcLabel, `TOOL: ${toolCall.name}`, toolCall.state || "running"),
      );
    }

    // Main prompt/response line uses LEAD label
    console.log(formatCliLine("LEAD", prompt, responseText));
    usageLineVisible = true;

    for (const info of allMessages) {
      if (!info.sessionID) {
        continue;
      }
      const entry = extractUsageEntry(info);
      if (!entry) continue;
      const usageState =
        usageBySession.get(info.sessionID) ?? createEmptyUsageState();
      applyUsageEntry(usageState, entry);
      usageBySession.set(info.sessionID, usageState);
    }

    // Estimate tool tokens from message parts
    for (const info of allMessages) {
      const sessionId = (info as any).sessionID ?? leadSessionId;
      const usageState =
        usageBySession.get(sessionId) ?? createEmptyUsageState();
      const toolTokens = extractToolTokenEstimates(info);
      usageState.estimatedToolOutputTokens += toolTokens.outputTokens;
      usageState.estimatedToolInputTokens += toolTokens.inputTokens;
      usageBySession.set(sessionId, usageState);
    }

    // Count tool calls per session (subagent registration already done above)
    for (const toolCall of toolCalls) {
      const sessionId = toolCall.sessionID ?? session.id;
      const usageState =
        usageBySession.get(sessionId) ?? createEmptyUsageState();
      usageState.toolCallCount += 1;
      if (toolCall.type === "task") {
        usageState.taskCallCount += 1;
      }
      if (toolCall.subagentSessionId) {
        const parentSessionId = toolCall.sessionID ?? session.id;
        const seen = subagentSessionsByParent.get(parentSessionId);
        if (seen && seen.has(toolCall.subagentSessionId)) {
          // Only count subagent once (already registered above)
          const parentState =
            usageBySession.get(parentSessionId) ?? createEmptyUsageState();
          if (parentState.subagentCount === 0) {
            parentState.subagentCount = seen.size;
            usageBySession.set(parentSessionId, parentState);
          }
        }
      }
      usageBySession.set(sessionId, usageState);
    }

    renderUsageSummary(usageBySession, sessionInfoMap, config);
  }

  const finishedAt = Date.now();
  const metrics: RunMetrics = {
    runId: config.runId,
    agent: config.agent,
    model: config.model,
    path: config.path,
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date(finishedAt).toISOString(),
    durationMs: finishedAt - startedAt,
    sessions: buildSessionMetrics(usageBySession, sessionInfoMap, config),
  };

  return metrics;
}

export async function writeMetrics(
  metricsFile: string,
  metrics: RunMetrics,
): Promise<void> {
  const contents = yaml.dump(metrics, { noRefs: true });
  await writeFileContents(metricsFile, contents);
}

async function createSession(
  client: any,
  config: RunConfig,
): Promise<{ id: string }> {
  if (!client?.session?.create) {
    throw new Error("OpenCode SDK client missing session.create");
  }
  const session = await client.session.create({
    directory: config.path,
  });
  if (!session || typeof session.id !== "string") {
    throw new Error("OpenCode SDK did not return session id");
  }
  return session as { id: string };
}

async function sendPrompt(
  client: any,
  sessionId: string,
  prompt: string,
  config: RunConfig,
): Promise<unknown> {
  if (!client?.session?.prompt) {
    throw new Error("OpenCode SDK client missing session.prompt");
  }
  return client.session.prompt({
    sessionID: sessionId,
    directory: config.path,
    agent: config.agent,
    model: {
      providerID: config.model.providerId,
      modelID: config.model.modelId,
    },
    parts: [{ type: "text", text: prompt }],
  });
}

function extractMessageInfos(response: unknown): MessageInfoLike[] {
  if (!response) {
    throw new Error("Prompt response is empty");
  }
  if (Array.isArray(response)) {
    return response as MessageInfoLike[];
  }
  if (typeof response === "object") {
    const record = response as Record<string, unknown>;
    // Handle { info: {...}, parts: [...] } format from SDK v2
    const info = record.info;
    if (info && typeof info === "object" && "id" in info) {
      const infoRecord = info as Record<string, unknown>;
      const parts = record.parts;
      // Merge info and parts for unified processing
      return [{ ...infoRecord, parts } as MessageInfoLike];
    }
    const messages = record.messages;
    if (Array.isArray(messages)) {
      return messages as MessageInfoLike[];
    }
    const message = record.message;
    if (message && typeof message === "object") {
      return [message as MessageInfoLike];
    }
    if (typeof record.id === "string") {
      return [record as MessageInfoLike];
    }
  }
  throw new Error("Unsupported prompt response shape");
}

async function fetchSessionMessages(
  client: any,
  sessionId: string,
): Promise<MessageInfoLike[]> {
  if (!client?.session?.messages) {
    throw new Error("OpenCode SDK client missing session.messages");
  }
  const response = await client.session.messages({ sessionID: sessionId });
  return extractSessionMessages(response);
}

async function loadSessionMessageInfos(
  client: any,
  sessionId: string,
  toolCalls: ToolCallInfo[],
  baseMessages?: MessageInfoLike[],
): Promise<MessageInfoLike[]> {
  const messageInfos =
    baseMessages ?? (await fetchSessionMessages(client, sessionId));
  const seenSessions = new Set<string>([sessionId]);
  const subagentSessionIds = toolCalls
    .map((toolCall) => toolCall.subagentSessionId)
    .filter(
      (subagentId): subagentId is string => typeof subagentId === "string",
    );

  for (const subagentSessionId of subagentSessionIds) {
    if (seenSessions.has(subagentSessionId)) continue;
    const subagentMessages = await fetchSessionMessages(
      client,
      subagentSessionId,
    );
    if (subagentMessages.length > 0) {
      messageInfos.push(...subagentMessages);
    }
    seenSessions.add(subagentSessionId);
  }

  return messageInfos;
}

function normalizeMessageRecord(record: unknown): MessageInfoLike | null {
  if (!record || typeof record !== "object") {
    return null;
  }
  const asRecord = record as Record<string, unknown>;
  const info = asRecord.info;
  if (info && typeof info === "object" && "id" in info) {
    const infoRecord = info as Record<string, unknown>;
    const parts = asRecord.parts;
    return { ...infoRecord, parts } as MessageInfoLike;
  }
  if (typeof asRecord.id === "string") {
    return asRecord as MessageInfoLike;
  }
  return record as MessageInfoLike;
}

function extractSessionMessages(response: unknown): MessageInfoLike[] {
  if (!response) {
    return [];
  }
  if (Array.isArray(response)) {
    return response
      .map((item) => normalizeMessageRecord(item))
      .filter((item): item is MessageInfoLike => Boolean(item));
  }
  if (typeof response === "object") {
    const record = response as Record<string, unknown>;
    const data = record.data;
    if (Array.isArray(data)) {
      return data
        .map((item) => normalizeMessageRecord(item))
        .filter((item): item is MessageInfoLike => Boolean(item));
    }
    const messages = record.messages;
    if (Array.isArray(messages)) {
      return messages
        .map((item) => normalizeMessageRecord(item))
        .filter((item): item is MessageInfoLike => Boolean(item));
    }
    const message = record.message;
    if (message && typeof message === "object") {
      const normalized = normalizeMessageRecord(message);
      return normalized ? [normalized] : [];
    }
    const info = record.info;
    if (info && typeof info === "object" && "id" in info) {
      const infoRecord = info as Record<string, unknown>;
      const parts = record.parts;
      return [{ ...infoRecord, parts } as MessageInfoLike];
    }
  }
  return [];
}

function renderResponse(infos: MessageInfoLike[], fallback: unknown): string {
  if (infos.length === 0) {
    return truncateWithEllipsis(JSON.stringify(fallback), 2000);
  }
  return infos.map((info) => renderMessageInfo(info)).join("\n---\n");
}

function renderMessageInfo(info: MessageInfoLike): string {
  const parts = (info as any).parts;
  if (Array.isArray(parts)) {
    const rendered = parts
      .map((part) => renderPart(part))
      .filter((text) => text.length > 0);
    if (rendered.length > 0) {
      return rendered.join("\n");
    }
  }
  const content = (info as any).content ?? (info as any).text ?? "";
  if (typeof content === "string" && content.length > 0) {
    return content;
  }
  return JSON.stringify(info);
}

function renderPart(part: any): string {
  if (!part || typeof part !== "object") {
    return String(part);
  }
  if (part.type === "text") {
    return normalizeText(part.text);
  }
  if (part.type === "reasoning") {
    return `REASONING: ${normalizeText(part.text)}`;
  }
  if (part.type === "tool") {
    const toolName = part.name ?? part.tool ?? part.toolName ?? "unknown";
    const state = part.state;
    // Extract meaningful state info
    let stateStr = "";
    if (typeof state === "string") {
      stateStr = state;
    } else if (state && typeof state === "object") {
      // Extract status and output summary
      const status = state.status ?? state.state ?? "done";
      const output = state.output;
      if (typeof output === "string" && output.length > 0) {
        const outputPreview = truncateWithEllipsis(output.replace(/\n/g, " "), 80);
        stateStr = `${status}: ${outputPreview}`;
      } else {
        stateStr = status;
      }
    }
    return `TOOL[${toolName}]: ${stateStr}`;
  }
  if (part.type === "file") {
    const name = part.filename ?? part.path ?? "unknown";
    return `FILE ${name}`;
  }
  if (part.type === "step-start" || part.type === "step-finish") {
    return ""; // Skip step markers in output
  }
  if (typeof part.text === "string") {
    return part.text;
  }
  return JSON.stringify(part);
}

function normalizeText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((segment) => normalizeTextSegment(segment)).join("");
  }
  return JSON.stringify(value);
}

function normalizeTextSegment(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "text" in value) {
    const textValue = (value as { text?: unknown }).text;
    return typeof textValue === "string" ? textValue : "";
  }
  return "";
}

function formatLogEntry(
  index: number,
  prompt: string,
  response: string,
): string {
  const timestamp = new Date().toISOString();
  return [
    `[${timestamp}] Prompt #${index}`,
    "PROMPT:",
    prompt,
    "RESPONSE:",
    response,
    "",
  ].join("\n");
}

interface ToolCallInfo {
  name: string;
  callID: string;
  state: string;
  sessionID?: string;
  type: "tool" | "task" | "agent";
  subagentSessionId?: string;
  subagentType?: string;
  // Estimated tokens
  argumentsText?: string;
  outputText?: string;
}

function extractSubagentSessionId(part: any): string | undefined {
  const metadataSessionId =
    part?.state?.metadata?.sessionId ??
    part?.state?.metadata?.sessionID ??
    part?.metadata?.sessionId ??
    part?.metadata?.sessionID;
  if (typeof metadataSessionId === "string" && metadataSessionId.length > 0) {
    return metadataSessionId;
  }
  const output = part?.state?.output;
  if (typeof output === "string") {
    const match = output.match(
      /<task_metadata>[\s\S]*?session_id:\s*(\S+)[\s\S]*?<\/task_metadata>/,
    );
    if (match?.[1]) return match[1];
  }
  return undefined;
}

function extractToolCalls(infos: MessageInfoLike[]): ToolCallInfo[] {
  const toolCalls: ToolCallInfo[] = [];
  for (const info of infos) {
    const parts = (info as any).parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (part?.type === "tool") {
        const toolName = part.tool ?? part.name ?? "unknown";
        const type = toolName === "task" ? "task" : "tool";
        // Extract arguments text for token estimation
        const argsText = extractToolArgumentsText(part);
        const outputText = extractToolOutputText(part);
        toolCalls.push({
          name: toolName,
          callID: part.callID ?? "",
          state: part.state ?? "unknown",
          sessionID: part.sessionID,
          type,
          subagentSessionId:
            type === "task" ? extractSubagentSessionId(part) : undefined,
          subagentType: type === "task" ? extractSubagentType(part) : undefined,
          argumentsText: argsText,
          outputText: outputText,
        });
      }
      // Also track agent parts (sub-agent spawns)
      if (part?.type === "agent") {
        toolCalls.push({
          name: `agent:${part.name ?? "unknown"}`,
          callID: part.id ?? "",
          state: "spawned",
          sessionID: part.sessionID,
          type: "agent",
        });
      }
    }
  }
  return toolCalls;
}

function extractToolArgumentsText(part: any): string {
  // Tool arguments are what the model generates (output tokens)
  const args = part?.args ?? part?.arguments ?? part?.input ?? {};
  if (typeof args === "string") return args;
  if (typeof args === "object") {
    try {
      return JSON.stringify(args);
    } catch {
      return "";
    }
  }
  return "";
}

function extractToolOutputText(part: any): string {
  // Tool output/response is what comes back (input tokens)
  const output = part?.state?.output ?? part?.output ?? part?.result ?? "";
  if (typeof output === "string") return output;
  if (typeof output === "object") {
    try {
      return JSON.stringify(output);
    } catch {
      return "";
    }
  }
  return "";
}

function extractSubagentType(part: any): string | undefined {
  const subagentType =
    part?.args?.subagent_type ??
    part?.arguments?.subagent_type ??
    part?.state?.metadata?.agentType ??
    part?.metadata?.agentType;
  return typeof subagentType === "string" ? subagentType : undefined;
}

interface ToolTokenEstimate {
  outputTokens: number; // Tokens to generate tool call arguments
  inputTokens: number; // Tokens from tool responses
}

function extractToolTokenEstimates(info: MessageInfoLike): ToolTokenEstimate {
  const parts = (info as any).parts;
  let outputTokens = 0;
  let inputTokens = 0;
  if (!Array.isArray(parts)) {
    return { outputTokens, inputTokens };
  }
  for (const part of parts) {
    if (part?.type === "tool") {
      const argsText = extractToolArgumentsText(part);
      const resultText = extractToolOutputText(part);
      outputTokens += estimateTokens(argsText);
      inputTokens += estimateTokens(resultText);
    }
  }
  return { outputTokens, inputTokens };
}

function formatLogEntryWithTools(
  index: number,
  prompt: string,
  response: string,
  toolCalls: ToolCallInfo[],
): string {
  const timestamp = new Date().toISOString();
  const lines = [`[${timestamp}] Prompt #${index}`, "PROMPT:", prompt];
  if (toolCalls.length > 0) {
    lines.push("TOOL CALLS:");
    for (const tc of toolCalls) {
      lines.push(
        `  - ${tc.name} (${tc.state})${tc.sessionID ? ` [session: ${tc.sessionID}]` : ""}`,
      );
    }
  }
  lines.push("RESPONSE:", response, "");
  return lines.join("\n");
}

function renderUsageSummary(
  usageBySession: Map<string, SessionUsageState>,
  sessionInfoMap: Map<string, SessionInfo>,
  config: RunConfig,
): void {
  // Sort sessions: LEAD first, then SUB #1, #2, etc.
  const sortedEntries = Array.from(usageBySession.entries()).sort(
    ([idA], [idB]) => {
      const infoA = sessionInfoMap.get(idA);
      const infoB = sessionInfoMap.get(idB);
      if (infoA?.isLead) return -1;
      if (infoB?.isLead) return 1;
      return (infoA?.subIndex ?? 999) - (infoB?.subIndex ?? 999);
    },
  );

  console.log("\n" + "─".repeat(80));
  console.log("USAGE SUMMARY");
  console.log("─".repeat(80));

  for (const [sessionId, state] of sortedEntries) {
    const sessionInfo = sessionInfoMap.get(sessionId) ?? {
      label: sessionId.slice(0, 12),
      agent: "unknown",
      modelId: config.model.id,
    };
    const summary = buildUsageSummary(
      state,
      config.model.contextWindow,
      config.model.outputLimit,
    );

    const label = sessionInfo.label.padEnd(8);
    const agent = `[${sessionInfo.agent}]`.padEnd(10);
    
    const toolTokens = summary.estimatedToolOutputTokens + summary.estimatedToolInputTokens;
    
    const line1 = [
      `${label} ${agent}`,
      `in: ${formatTokenValue(summary.totalInputTokens).padStart(8)}`,
      `out: ${formatTokenValue(summary.totalOutputTokens).padStart(6)}`,
      `reason: ${formatTokenValue(summary.totalReasoningTokens).padStart(6)}`,
    ].join("  ");

    const ctxLeft =
      summary.contextAvailableTokens === null
        ? "n/a"
        : formatTokenValue(summary.contextAvailableTokens);
    
    const line2 = [
      `         cache: ${formatTokenValue(summary.totalCacheReadTokens)}/${formatTokenValue(summary.totalCacheWriteTokens)}`,
      `tools: ${summary.toolCallCount}`,
      `tasks: ${summary.taskCallCount}`,
      `subs: ${summary.subagentCount}`,
      `tool-tokens: ~${formatTokenValue(toolTokens)}`,
      `ctx-left: ${ctxLeft}`,
    ].join("  ");

    console.log(line1);
    console.log(line2);
  }
  console.log("─".repeat(80));
}

function buildSessionMetrics(
  usageBySession: Map<string, SessionUsageState>,
  sessionInfoMap: Map<string, SessionInfo>,
  config: RunConfig,
): Record<string, SessionMetrics> {
  const entries: Record<string, SessionMetrics> = {};

  // Sort sessions: LEAD first, then SUB #1, #2, etc.
  const sortedEntries = Array.from(usageBySession.entries()).sort(
    ([idA], [idB]) => {
      const infoA = sessionInfoMap.get(idA);
      const infoB = sessionInfoMap.get(idB);
      if (infoA?.isLead) return -1;
      if (infoB?.isLead) return 1;
      return (infoA?.subIndex ?? 999) - (infoB?.subIndex ?? 999);
    },
  );

  for (const [sessionId, state] of sortedEntries) {
    const sessionInfo = sessionInfoMap.get(sessionId) ?? {
      label: sessionId,
      agent: "unknown",
      modelId: config.model.id,
    };
    const summary = buildUsageSummary(
      state,
      config.model.contextWindow,
      config.model.outputLimit,
    );
    // Use session ID as key, keep label as field for readability
    entries[sessionId] = {
      label: sessionInfo.label,
      agent: sessionInfo.agent,
      modelId: sessionInfo.modelId,
      totalInputTokens: summary.totalInputTokens,
      totalOutputTokens: summary.totalOutputTokens,
      totalReasoningTokens: summary.totalReasoningTokens,
      totalCacheReadTokens: summary.totalCacheReadTokens,
      totalCacheWriteTokens: summary.totalCacheWriteTokens,
      totalTokens: summary.totalTokens,
      totalCost: summary.totalCost,
      actualUsageTokens: summary.actualUsageTokens,
      contextWindow: summary.contextWindow,
      outputLimit: summary.outputLimit,
      contextUsedTokens: summary.contextUsedTokens,
      contextAvailableTokens: summary.contextAvailableTokens,
      toolCallCount: summary.toolCallCount,
      taskCallCount: summary.taskCallCount,
      subagentCount: summary.subagentCount,
      estimatedToolOutputTokens: summary.estimatedToolOutputTokens,
      estimatedToolInputTokens: summary.estimatedToolInputTokens,
    };
  }
  return entries;
}
