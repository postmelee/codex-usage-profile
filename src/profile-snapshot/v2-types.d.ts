export declare const USAGE_SNAPSHOT_V2_SCHEMA_VERSION: 2;

export interface UsageSnapshotV2 {
  schemaVersion: typeof USAGE_SNAPSHOT_V2_SCHEMA_VERSION;
  capturedAt: string;
  producer?: UsageSnapshotProducerV2;
  codexProfile?: UsageSnapshotCodexProfileV2;
  usage: UsageSummaryV2;
  models: UsageModelsV2;
  activity: UsageActivityV2;
  skills: UsageSkillsV2;
  plugins: UsagePluginsV2;
  codexAssets?: UsageCodexAssetsV2;
  extensions?: Record<string, unknown>;
}

export interface UsageSnapshotProducerV2 {
  name: string;
  version: string;
}

export interface UsageSnapshotCodexProfileV2 {
  displayName: string | null;
  username: string | null;
  planLabel: string | null;
}

export interface UsageSummaryV2 {
  totalTokens: number;
  peakDailyTokens: number | null;
  tokenBreakdown: UsageTokenBreakdownV2;
  daily: UsageDailyV2[];
}

export interface UsageTokenBreakdownV2 {
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  reasoningTokens: number | null;
}

export interface UsageDailyV2 extends UsageTokenBreakdownV2 {
  date: string;
  totalTokens: number;
}

export interface UsageModelsV2 {
  favoriteModel: UsageModelV2 | null;
  items: UsageModelV2[];
}

export interface UsageModelV2 extends UsageTokenBreakdownV2 {
  model: string;
  displayName: string | null;
  totalTokens: number | null;
  usageCount: number | null;
  basis: "tokens" | "usage_count" | "duration" | "unknown";
}

export interface UsageActivityV2 {
  longestTaskDurationMs: number | null;
  currentStreakDays: number | null;
  longestStreakDays: number | null;
  fastModePercent: number | null;
  reasoningEffort: string | null;
  reasoningEffortPercent: number | null;
  totalThreads: number | null;
}

export interface UsageSkillsV2 {
  exploredCount: number | null;
  totalUsed: number | null;
  topSkills: UsageRankingItemV2[];
}

export interface UsagePluginsV2 {
  topPlugins: UsageRankingItemV2[];
}

export interface UsageRankingItemV2 {
  id: string;
  name: string | null;
  displayName: string | null;
  usageCount: number;
}

export interface UsageCodexAssetsV2 {
  avatar: UsageSnapshotAssetV2 | null;
  pet: UsageSnapshotAssetV2 | null;
}

export interface UsageSnapshotAssetV2 {
  kind: "remote-url" | "data-url" | "uploaded-asset" | "codex-asset" | "spritesheet";
  url: string | null;
  assetRef: string | null;
  contentType: string | null;
}

export interface UsageSnapshotV2ValidationResult {
  ok: boolean;
  errors: string[];
}

export declare function validateUsageSnapshotV2(value: unknown): UsageSnapshotV2ValidationResult;

export declare function assertUsageSnapshotV2(value: unknown): UsageSnapshotV2;

export declare function isUsageSnapshotV2(value: unknown): value is UsageSnapshotV2;
