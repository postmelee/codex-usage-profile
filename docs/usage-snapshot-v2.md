# UsageSnapshot v2 Contract

`UsageSnapshot v2` is the shared JSON contract produced by local usage analyzers and consumed by Codex Usage Profile-compatible web services.

The contract intentionally separates local usage analysis from web account identity. A local analyzer owns usage fields such as token totals, token breakdown, model usage, and skill/plugin activity. A web service owns GitHub login data, profile visibility, submit tokens, devices, public URLs, and rendered card/profile view models.

## Producer And Consumer Boundary

| Component | Responsibility |
|---|---|
| `codex-usage-analyzer` | Reads local usage data, normalizes it, and emits a `UsageSnapshot v2` JSON object. |
| `codex-usage-profile` | Authenticates users, receives snapshots, stores latest public/private state, merges snapshots with GitHub profile data, and renders profile/card UI. |
| Product-specific wrappers | May call the analyzer SDK and submit the resulting snapshot to their own service. They must not add GitHub-facing fields into the analyzer snapshot. |

`UsageSnapshot v2` is the value submitted as `payload.snapshot`. Submit wrapper metadata such as `handle`, `visibility`, bearer token, device id, and service session is not part of this contract.

## Top-Level Shape

```json
{
  "schemaVersion": 2,
  "capturedAt": "2026-06-12T00:00:00.000Z",
  "producer": {
    "name": "codex-usage-analyzer",
    "version": "0.1.0"
  },
  "codexProfile": {
    "displayName": "postmelee",
    "username": "meleeisdeveloping",
    "planLabel": "Pro"
  },
  "usage": {
    "totalTokens": 10300000000,
    "peakDailyTokens": 703000000,
    "tokenBreakdown": {
      "inputTokens": 646900000,
      "outputTokens": 34500000,
      "cacheReadTokens": 10300000000,
      "cacheWriteTokens": 11000000,
      "reasoningTokens": null
    },
    "daily": []
  },
  "models": {
    "favoriteModel": null,
    "items": []
  },
  "activity": {
    "longestTaskDurationMs": 6780000,
    "currentStreakDays": 46,
    "longestStreakDays": 46,
    "fastModePercent": 55,
    "reasoningEffort": "xhigh",
    "reasoningEffortPercent": 76,
    "totalThreads": 1735
  },
  "skills": {
    "exploredCount": 49,
    "totalUsed": 3144,
    "topSkills": []
  },
  "plugins": {
    "topPlugins": []
  },
  "codexAssets": {
    "avatar": null,
    "pet": null
  },
  "extensions": {}
}
```

Top-level unknown fields are not allowed. Product-specific additions must live under `extensions` using a namespaced key such as `"tokenmon.cardHints"`.

## Required And Optional Fields

| Field | Required | Null allowed | Notes |
|---|---:|---:|---|
| `schemaVersion` | Yes | No | Literal number `2`. |
| `capturedAt` | Yes | No | ISO date-time string for local snapshot capture time. |
| `producer` | No | No | Analyzer metadata. Omit when unknown. |
| `codexProfile` | No | No | Optional Codex-side display hints, not GitHub identity. |
| `usage` | Yes | No | Token totals and per-day usage. |
| `models` | Yes | No | Stable object; use `favoriteModel: null`, `items: []` when unavailable. |
| `activity` | Yes | No | Stable object with nullable metrics. |
| `skills` | Yes | No | Stable object; use empty arrays or null counts when unavailable. |
| `plugins` | Yes | No | Stable object; use empty arrays when unavailable. |
| `codexAssets` | No | No | Optional Codex-side avatar/pet hints. |
| `extensions` | No | No | Namespaced non-core metadata only. |

Counts must be non-negative integers when present. Unknown numeric metrics must be `null`, not `0`, unless the analyzer can prove the value is zero.

## Usage Fields

```ts
interface UsageSummaryV2 {
  totalTokens: number;
  peakDailyTokens: number | null;
  tokenBreakdown: TokenBreakdownV2;
  daily: DailyUsageV2[];
}
```

| Field | Meaning |
|---|---|
| `totalTokens` | Primary lifetime token count used for profile totals and card HP-style displays. |
| `peakDailyTokens` | Highest observed daily token total, or `null` if unavailable. |
| `tokenBreakdown` | Aggregate input/output/cache/reasoning breakdown. |
| `daily` | Daily usage buckets in UTC `YYYY-MM-DD` dates. Empty array is allowed. |

### tokenBreakdown

```ts
interface TokenBreakdownV2 {
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  reasoningTokens: number | null;
}
```

`tokenBreakdown` is required, but each value may be `null`. Analyzer sources do not always expose all categories.

`totalTokens` is the canonical profile total. Consumers must not reject a snapshot only because `tokenBreakdown` values do not sum to `totalTokens`. Cached tokens, source-specific accounting, omitted categories, and deduplication can make strict equality invalid.

### daily

```ts
interface DailyUsageV2 extends TokenBreakdownV2 {
  date: string;
  totalTokens: number;
}
```

Daily rows use UTC `YYYY-MM-DD`. `totalTokens` is required for each row because heatmaps need a stable value. Breakdown values may be `null` per row.

## Model Usage Fields

```ts
interface ModelsV2 {
  favoriteModel: ModelUsageV2 | null;
  items: ModelUsageV2[];
}

interface ModelUsageV2 extends TokenBreakdownV2 {
  model: string;
  displayName: string | null;
  totalTokens: number | null;
  usageCount: number | null;
  basis: "tokens" | "usage_count" | "duration" | "unknown";
}
```

`favoriteModel` is the analyzer's best representative model. Prefer `basis: "tokens"` when token totals are available. Use `basis: "usage_count"` when only request/session counts are available. Use `null` when model usage cannot be derived.

`items` should be sorted descending by the metric named in `basis` when possible.

## Activity Fields

```ts
interface ActivityV2 {
  longestTaskDurationMs: number | null;
  currentStreakDays: number | null;
  longestStreakDays: number | null;
  fastModePercent: number | null;
  reasoningEffort: string | null;
  reasoningEffortPercent: number | null;
  totalThreads: number | null;
}
```

Percent values must be numbers from `0` to `100`. `reasoningEffort` is a source label such as `"xhigh"` and must not be confused with `tokenBreakdown.reasoningTokens`.

## Skill And Plugin Fields

```ts
interface SkillsV2 {
  exploredCount: number | null;
  totalUsed: number | null;
  topSkills: UsageRankingItemV2[];
}

interface PluginsV2 {
  topPlugins: UsageRankingItemV2[];
}

interface UsageRankingItemV2 {
  id: string;
  name: string | null;
  displayName: string | null;
  usageCount: number;
}
```

`topSkills` is the canonical source for skill-based product UI, including card attack mappings. `topPlugins` is the canonical source for plugin ranking UI.

If a source only provides a mixed invocation list, the analyzer should split items by type. If the type is unknown, omit the item rather than guessing.

Plugin/skill icon URLs are not part of v2. Consumers should enrich ranking items through web-side metadata lookup.

## Codex Profile And Asset Hints

```ts
interface CodexProfileV2 {
  displayName: string | null;
  username: string | null;
  planLabel: string | null;
}

interface CodexAssetsV2 {
  avatar: SnapshotAssetV2 | null;
  pet: SnapshotAssetV2 | null;
}

interface SnapshotAssetV2 {
  kind: "remote-url" | "data-url" | "uploaded-asset" | "codex-asset" | "spritesheet";
  url: string | null;
  assetRef: string | null;
  contentType: string | null;
}
```

These fields are optional display hints from the local Codex profile context. Web services may ignore them or use them as fallback when GitHub-facing profile data is unavailable.

## GitHub-Facing Fields Are Excluded

The following fields belong to the web service account/profile layer, not to `UsageSnapshot v2`:

| Field category | Examples |
|---|---|
| GitHub account identity | GitHub numeric id, login, profile URL |
| GitHub display data | avatar URL, display name, bio |
| visibility and routing | public/private visibility, canonical public handle |
| service auth | browser session, CLI API token, device id |

Renderers that need GitHub data must merge a stored GitHub profile record with the analyzer snapshot after submit.

## Credential And Secret Exclusion

Snapshots must not contain credential or session material. Producers should not emit these values, and consumers should reject payloads that contain them.

Forbidden examples:

- OAuth access tokens or refresh tokens
- API keys and bearer tokens
- local auth file contents
- raw credential blobs
- service session ids
- CLI API tokens
- private local filesystem paths

This rule applies to field names and nested values. An analyzer should emit only normalized usage data, not raw source objects.

## v1 Compatibility

| v1 field | v2 field |
|---|---|
| `summary.totalTextTokens` | `usage.totalTokens` |
| `summary.peakTokens` | `usage.peakDailyTokens` |
| `summary.longestTaskDurationMs` | `activity.longestTaskDurationMs` |
| `summary.currentStreakDays` | `activity.currentStreakDays` |
| `summary.longestStreakDays` | `activity.longestStreakDays` |
| `dailyUsage[].credits` | `usage.daily[].totalTokens` |
| `activityInsights.fastModePercent` | `activity.fastModePercent` |
| `activityInsights.reasoningEffort` | `activity.reasoningEffort` |
| `activityInsights.reasoningEffortPercent` | `activity.reasoningEffortPercent` |
| `activityInsights.skillsExplored` | `skills.exploredCount` |
| `activityInsights.totalSkillsUsed` | `skills.totalUsed` |
| `activityInsights.totalThreads` | `activity.totalThreads` |
| `topInvocations[type=skill]` | `skills.topSkills[]` |
| `topInvocations[type=plugin]` | `plugins.topPlugins[]` |
| `assets.avatar` | `codexAssets.avatar` |
| `assets.pet` | `codexAssets.pet` |

The existing v1 validator should remain separate. Consumers should introduce a dedicated v2 validator and an explicit v1-to-v2 migration or view-model adapter instead of silently accepting both shapes as the same type.

## Minimal Valid Snapshot

```json
{
  "schemaVersion": 2,
  "capturedAt": "2026-06-12T00:00:00.000Z",
  "usage": {
    "totalTokens": 0,
    "peakDailyTokens": null,
    "tokenBreakdown": {
      "inputTokens": null,
      "outputTokens": null,
      "cacheReadTokens": null,
      "cacheWriteTokens": null,
      "reasoningTokens": null
    },
    "daily": []
  },
  "models": {
    "favoriteModel": null,
    "items": []
  },
  "activity": {
    "longestTaskDurationMs": null,
    "currentStreakDays": null,
    "longestStreakDays": null,
    "fastModePercent": null,
    "reasoningEffort": null,
    "reasoningEffortPercent": null,
    "totalThreads": null
  },
  "skills": {
    "exploredCount": null,
    "totalUsed": null,
    "topSkills": []
  },
  "plugins": {
    "topPlugins": []
  }
}
```

## Product Wrapper Guidance

Product-specific CLIs such as a card-focused wrapper should import the analyzer SDK, receive a `UsageSnapshot v2`, and submit that snapshot to their service. They may add product-specific submit wrapper fields outside `snapshot`, but they must not mutate the analyzer snapshot with GitHub-facing fields, tokens, device data, or rendered UI-only values.
