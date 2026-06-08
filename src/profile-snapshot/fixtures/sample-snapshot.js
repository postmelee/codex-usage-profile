import { PROFILE_SNAPSHOT_SCHEMA_VERSION } from "../schema.js";

export const sampleProfileSnapshot = Object.freeze({
  schemaVersion: PROFILE_SNAPSHOT_SCHEMA_VERSION,
  capturedAt: "2026-06-06T08:22:18.000Z",
  profile: {
    displayName: "postmelee",
    username: "meleeisdeveloping",
    planLabel: "Pro"
  },
  summary: {
    totalTextTokens: 10300000000,
    peakTokens: 703000000,
    longestTaskDurationMs: 6780000,
    currentStreakDays: 46,
    longestStreakDays: 46
  },
  dailyUsage: [
    { date: "2026-05-24", credits: 42000000 },
    { date: "2026-05-25", credits: 71000000 },
    { date: "2026-05-26", credits: 128000000 },
    { date: "2026-05-27", credits: 98000000 },
    { date: "2026-05-28", credits: 144000000 },
    { date: "2026-05-29", credits: 203000000 },
    { date: "2026-05-30", credits: 266000000 },
    { date: "2026-05-31", credits: 118000000 },
    { date: "2026-06-01", credits: 314000000 },
    { date: "2026-06-02", credits: 703000000 },
    { date: "2026-06-03", credits: 184000000 },
    { date: "2026-06-04", credits: 226000000 },
    { date: "2026-06-05", credits: 309000000 },
    { date: "2026-06-06", credits: 158000000 }
  ],
  activityInsights: {
    fastModePercent: 55,
    reasoningEffort: "xhigh",
    reasoningEffortPercent: 76,
    skillsExplored: 49,
    totalSkillsUsed: 3144,
    totalThreads: 1735
  },
  topInvocations: [
    {
      type: "skill",
      pluginId: null,
      pluginName: null,
      skillId: "pr-merge-cleanup",
      skillName: "pr-merge-cleanup",
      usageCount: 563
    },
    {
      type: "skill",
      pluginId: null,
      pluginName: null,
      skillId: "task-start",
      skillName: "task-start",
      usageCount: 436
    },
    {
      type: "skill",
      pluginId: null,
      pluginName: null,
      skillId: "task-register",
      skillName: "task-register",
      usageCount: 404
    },
    {
      type: "skill",
      pluginId: null,
      pluginName: null,
      skillId: "task-final-report",
      skillName: "task-final-report",
      usageCount: 314
    },
    {
      type: "skill",
      pluginId: null,
      pluginName: null,
      skillId: "task-stage-report",
      skillName: "task-stage-report",
      usageCount: 304
    }
  ],
  assets: {
    avatar: {
      kind: "remote-url",
      url: "https://example.com/codex-profile-avatar.png",
      assetRef: null,
      contentType: "image/png"
    },
    pet: {
      kind: "spritesheet",
      url: "https://example.com/codex-pet-spritesheet.png",
      assetRef: "codex-pet:example",
      contentType: "image/png"
    }
  }
});
