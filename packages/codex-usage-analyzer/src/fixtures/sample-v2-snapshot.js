import { USAGE_SNAPSHOT_V2_SCHEMA_VERSION } from "../snapshot/v2-schema.js";

export const sampleUsageSnapshotV2 = Object.freeze({
  schemaVersion: USAGE_SNAPSHOT_V2_SCHEMA_VERSION,
  capturedAt: "2026-06-12T00:00:00.000Z",
  producer: {
    name: "codex-usage-analyzer",
    version: "0.1.0"
  },
  codexProfile: {
    displayName: "postmelee",
    username: "meleeisdeveloping",
    planLabel: "Pro"
  },
  usage: {
    totalTokens: 10300000000,
    peakDailyTokens: 703000000,
    tokenBreakdown: {
      inputTokens: 646900000,
      outputTokens: 34500000,
      cacheReadTokens: 10300000000,
      cacheWriteTokens: 11000000,
      reasoningTokens: null
    },
    daily: [
      {
        date: "2026-06-06",
        totalTokens: 158000000,
        inputTokens: null,
        outputTokens: null,
        cacheReadTokens: null,
        cacheWriteTokens: null,
        reasoningTokens: null
      }
    ]
  },
  models: {
    favoriteModel: {
      model: "gpt-5-codex",
      displayName: "GPT-5 Codex",
      totalTokens: 7000000000,
      usageCount: null,
      basis: "tokens",
      inputTokens: null,
      outputTokens: null,
      cacheReadTokens: null,
      cacheWriteTokens: null,
      reasoningTokens: null
    },
    items: [
      {
        model: "gpt-5-codex",
        displayName: "GPT-5 Codex",
        totalTokens: 7000000000,
        usageCount: null,
        basis: "tokens",
        inputTokens: null,
        outputTokens: null,
        cacheReadTokens: null,
        cacheWriteTokens: null,
        reasoningTokens: null
      }
    ]
  },
  activity: {
    longestTaskDurationMs: 6780000,
    currentStreakDays: 46,
    longestStreakDays: 46,
    fastModePercent: 55,
    reasoningEffort: "xhigh",
    reasoningEffortPercent: 76,
    totalThreads: 1735
  },
  skills: {
    exploredCount: 49,
    totalUsed: 3144,
    topSkills: [
      {
        id: "pr-merge-cleanup",
        name: "pr-merge-cleanup",
        displayName: "pr-merge-cleanup",
        usageCount: 563
      }
    ]
  },
  plugins: {
    topPlugins: []
  },
  codexAssets: {
    avatar: {
      kind: "remote-url",
      url: "/assets/postmelee-avatar.png",
      assetRef: null,
      contentType: "image/png"
    },
    pet: null
  },
  extensions: {
    "codexUsageAnalyzer.fixture": {
      note: "sample-backed skeleton"
    }
  }
});
