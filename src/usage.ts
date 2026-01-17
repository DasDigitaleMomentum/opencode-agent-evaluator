export interface TokenBreakdown {
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface UsageEntry extends TokenBreakdown {
  messageId: string;
  timestamp: number;
  cost: number;
  combinedTokens: number;
  hasContextUsage: boolean;
}

export interface SessionUsageState {
  entries: Record<string, UsageEntry>;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalReasoningTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  totalCost: number;
  actualUsageTokens: number;
  latestMessageId?: string;
  toolCallCount: number;
  taskCallCount: number;
  subagentCount: number;
  // Estimated tokens consumed by tool calls (not included in totals above)
  estimatedToolOutputTokens: number; // Tokens to generate tool call arguments
  estimatedToolInputTokens: number; // Tokens from tool responses
}

export interface MessageInfoLike {
  id?: string;
  sessionID?: string;
  role?: string;
  tokens?: {
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: {
      read?: number;
      write?: number;
    };
  };
  cost?: number;
  summary?: boolean;
  time?: {
    created?: number;
  };
}

export interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalReasoningTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  totalCost: number;
  actualUsageTokens: number;
  contextWindow: number;
  outputLimit: number;
  contextAvailableTokens: number | null;
  toolCallCount: number;
  taskCallCount: number;
  subagentCount: number;
  estimatedToolOutputTokens: number;
  estimatedToolInputTokens: number;
}

export function createEmptyUsageState(): SessionUsageState {
  return {
    entries: {},
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalReasoningTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheWriteTokens: 0,
    totalCost: 0,
    actualUsageTokens: 0,
    latestMessageId: undefined,
    toolCallCount: 0,
    taskCallCount: 0,
    subagentCount: 0,
    estimatedToolOutputTokens: 0,
    estimatedToolInputTokens: 0,
  };
}

/**
 * Estimate token count from a string using ~4 characters per token heuristic.
 * This is a rough approximation for tool call arguments and responses.
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}

export function extractUsageEntry(info: MessageInfoLike): UsageEntry | null {
  if (!info || info.role !== "assistant") return null;
  if (typeof info.id !== "string" || info.id.length === 0) return null;
  const tokens = info.tokens;
  if (!tokens) return null;
  const inputTokens = tokens.input ?? 0;
  const outputTokens = tokens.output ?? 0;
  const reasoningTokens = tokens.reasoning ?? 0;
  const cacheReadTokens = tokens.cache?.read ?? 0;
  const cacheWriteTokens = tokens.cache?.write ?? 0;
  if (
    inputTokens === 0 &&
    outputTokens === 0 &&
    reasoningTokens === 0 &&
    cacheReadTokens === 0 &&
    cacheWriteTokens === 0
  ) {
    return null;
  }
  const combinedTokens = info.summary
    ? outputTokens
    : inputTokens +
      outputTokens +
      reasoningTokens +
      cacheReadTokens +
      cacheWriteTokens;
  return {
    messageId: info.id,
    input: inputTokens,
    output: outputTokens,
    reasoning: reasoningTokens,
    cacheRead: cacheReadTokens,
    cacheWrite: cacheWriteTokens,
    combinedTokens,
    cost: info.cost ?? 0,
    timestamp: info.time?.created ?? Date.now(),
    hasContextUsage: inputTokens + cacheReadTokens + cacheWriteTokens > 0,
  };
}

export function applyUsageEntry(
  state: SessionUsageState,
  entry: UsageEntry,
): void {
  state.entries[entry.messageId] = entry;
  state.totalInputTokens += entry.input;
  state.totalOutputTokens += entry.output;
  state.totalReasoningTokens += entry.reasoning;
  state.totalCacheReadTokens += entry.cacheRead;
  state.totalCacheWriteTokens += entry.cacheWrite;
  state.totalCost += entry.cost;
  if (
    !state.latestMessageId ||
    entry.timestamp >= (state.entries[state.latestMessageId]?.timestamp ?? 0)
  ) {
    state.latestMessageId = entry.messageId;
    state.actualUsageTokens = entry.combinedTokens;
  }
}

export function buildUsageSummary(
  state: SessionUsageState,
  contextWindow: number,
  outputLimit: number,
): UsageSummary {
  const latestEntry = state.latestMessageId
    ? state.entries[state.latestMessageId]
    : undefined;
  const latestHasContextUsage = latestEntry?.hasContextUsage ?? false;
  const actualUsageTokens = state.actualUsageTokens;
  let contextAvailableTokens: number | null = null;
  if (contextWindow > 0) {
    if (latestHasContextUsage && actualUsageTokens > 0) {
      contextAvailableTokens = Math.max(
        contextWindow - (actualUsageTokens + outputLimit),
        0,
      );
    } else {
      contextAvailableTokens = contextWindow;
    }
  }
  return {
    totalInputTokens: state.totalInputTokens,
    totalOutputTokens: state.totalOutputTokens,
    totalReasoningTokens: state.totalReasoningTokens,
    totalCacheReadTokens: state.totalCacheReadTokens,
    totalCacheWriteTokens: state.totalCacheWriteTokens,
    totalCost: state.totalCost,
    actualUsageTokens,
    contextWindow,
    outputLimit,
    contextAvailableTokens,
    toolCallCount: state.toolCallCount,
    taskCallCount: state.taskCallCount,
    subagentCount: state.subagentCount,
    estimatedToolOutputTokens: state.estimatedToolOutputTokens,
    estimatedToolInputTokens: state.estimatedToolInputTokens,
  };
}
