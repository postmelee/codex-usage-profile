export declare const PROFILE_SNAPSHOT_SCHEMA_VERSION: 1;

export * from "./v2-types.js";

export interface ProfileSnapshot {
  schemaVersion: typeof PROFILE_SNAPSHOT_SCHEMA_VERSION;
  capturedAt: string;
  profile: SnapshotProfile;
  summary: SnapshotSummary;
  dailyUsage: SnapshotDailyUsageBucket[];
  activityInsights: SnapshotActivityInsights;
  topInvocations: SnapshotInvocation[];
  assets: SnapshotAssets;
}

export interface SnapshotProfile {
  displayName: string | null;
  username: string | null;
  planLabel: string | null;
}

export interface SnapshotSummary {
  totalTextTokens: number | null;
  peakTokens: number | null;
  longestTaskDurationMs: number | null;
  currentStreakDays: number | null;
  longestStreakDays: number | null;
}

export interface SnapshotDailyUsageBucket {
  date: string;
  credits: number;
}

export interface SnapshotActivityInsights {
  fastModePercent: number | null;
  reasoningEffort: string | null;
  reasoningEffortPercent: number | null;
  skillsExplored: number | null;
  totalSkillsUsed: number | null;
  totalThreads: number | null;
}

export interface SnapshotInvocation {
  type: "plugin" | "skill";
  pluginId: string | null;
  pluginName: string | null;
  skillId: string | null;
  skillName: string | null;
  usageCount: number;
}

export interface SnapshotAssets {
  avatar: SnapshotAsset | null;
  pet: SnapshotAsset | null;
}

export interface SnapshotAsset {
  kind: "remote-url" | "data-url" | "uploaded-asset" | "codex-asset" | "spritesheet";
  url: string | null;
  assetRef: string | null;
  contentType: string | null;
}

export interface ProfileSnapshotValidationResult {
  ok: boolean;
  errors: string[];
}

export interface SnapshotStatSelection {
  key: keyof SnapshotSummary;
  label: string;
  value: number | null;
}

export interface ProfileHeaderSelection {
  displayName: string | null;
  username: string | null;
  planLabel: string | null;
  avatarAsset: SnapshotAsset | null;
  petAsset: SnapshotAsset | null;
}

export interface ProfileTokenActivitySelection {
  capturedAt: string;
  dailyUsage: SnapshotDailyUsageBucket[];
}

export interface ShareCardUsageInputSelection {
  todayIso: string;
  startDateIso: string;
  dayCount: number;
  dailyUsage: SnapshotDailyUsageBucket[];
}

export interface ProfileViewModelSelection {
  header: ProfileHeaderSelection;
  stats: SnapshotStatSelection[];
  tokenActivity: ProfileTokenActivitySelection;
  activityInsights: SnapshotActivityInsights;
  mostUsedInvocations: SnapshotInvocation[];
}

export interface ShareCardViewModelSelection {
  header: ProfileHeaderSelection;
  stats: SnapshotStatSelection[];
  usage: ShareCardUsageInputSelection;
}

export interface NormalizeCodexProfileSnapshotOptions {
  capturedAt?: string | Date;
  planLabel?: string | null;
  avatarAsset?: SnapshotAsset | null;
  petAsset?: SnapshotAsset | null;
}

export interface ShareCardUsageInputOptions {
  todayIso?: string;
}

export interface MostUsedInvocationsOptions {
  limit?: number;
}

export declare function validateProfileSnapshot(value: unknown): ProfileSnapshotValidationResult;

export declare function assertProfileSnapshot(value: unknown): ProfileSnapshot;

export declare function isProfileSnapshot(value: unknown): value is ProfileSnapshot;

export declare function normalizeCodexProfileSnapshot(
  raw: unknown,
  options?: NormalizeCodexProfileSnapshotOptions
): ProfileSnapshot;

export declare function selectProfileViewModel(
  snapshot: ProfileSnapshot
): ProfileViewModelSelection;

export declare function selectShareCardViewModel(
  snapshot: ProfileSnapshot,
  options?: ShareCardUsageInputOptions
): ShareCardViewModelSelection;

export declare function selectProfileHeader(
  snapshot: ProfileSnapshot
): ProfileHeaderSelection;

export declare function selectProfileStats(
  snapshot: ProfileSnapshot
): SnapshotStatSelection[];

export declare function selectShareCardStats(
  snapshot: ProfileSnapshot
): SnapshotStatSelection[];

export declare function selectProfileTokenActivity(
  snapshot: ProfileSnapshot
): ProfileTokenActivitySelection;

export declare function selectShareCardUsageInput(
  snapshot: ProfileSnapshot,
  options?: ShareCardUsageInputOptions
): ShareCardUsageInputSelection;

export declare function selectActivityInsights(
  snapshot: ProfileSnapshot
): SnapshotActivityInsights;

export declare function selectMostUsedInvocations(
  snapshot: ProfileSnapshot,
  options?: MostUsedInvocationsOptions
): SnapshotInvocation[];
