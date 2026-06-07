export declare const PROFILE_SNAPSHOT_SCHEMA_VERSION: 1;

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

export interface NormalizeCodexProfileSnapshotOptions {
  capturedAt?: string | Date;
  planLabel?: string | null;
  avatarAsset?: SnapshotAsset | null;
  petAsset?: SnapshotAsset | null;
}

export declare function validateProfileSnapshot(value: unknown): ProfileSnapshotValidationResult;

export declare function assertProfileSnapshot(value: unknown): ProfileSnapshot;

export declare function isProfileSnapshot(value: unknown): value is ProfileSnapshot;

export declare function normalizeCodexProfileSnapshot(
  raw: unknown,
  options?: NormalizeCodexProfileSnapshotOptions
): ProfileSnapshot;
