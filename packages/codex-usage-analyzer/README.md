# codex-usage-analyzer

`codex-usage-analyzer` is the local usage analysis package that emits `UsageSnapshot v2` JSON.

This package is currently scaffolded as a workspace package inside `codex-usage-profile`. It is designed to move to its own repository after the SDK, CLI, and contract tests are stable.

## CLI

```bash
npx codex-usage-analyzer@latest analyze --json
```

The `--json` mode writes a single `UsageSnapshot v2` object to stdout. Errors and usage text are written to stderr.

## SDK

```js
import {
  analyzeUsage,
  assertUsageSnapshotV2,
  createSampleUsageSnapshotV2,
  validateUsageSnapshotV2
} from "codex-usage-analyzer";

const snapshot = await analyzeUsage();
assertUsageSnapshotV2(snapshot);
```

The current implementation is a contract-first skeleton. It returns a sample-backed `UsageSnapshot v2` object while the real local source parser is implemented in a later task.

Public exports:

- `analyzeUsage(options?)`
- `createSampleUsageSnapshotV2(overrides?)`
- `validateUsageSnapshotV2(value)`
- `assertUsageSnapshotV2(value)`
- `isUsageSnapshotV2(value)`
- `USAGE_SNAPSHOT_V2_SCHEMA_VERSION`
- `sampleUsageSnapshotV2`

## Boundary

The analyzer owns local usage fields such as token totals, token breakdown, model usage, skill usage, plugin usage, and activity statistics.

Web products own GitHub login, display name, avatar URL, bio, profile visibility, submit tokens, devices, public URLs, and rendered cards.

Product-specific wrappers can call this SDK and submit the resulting snapshot to their own service:

```js
import {
  analyzeUsage,
  assertUsageSnapshotV2
} from "codex-usage-analyzer";

const snapshot = assertUsageSnapshotV2(await analyzeUsage());
await submitToProductService({ snapshot });
```

Wrapper metadata such as bearer tokens, device ids, account handles, visibility, GitHub bio, GitHub avatar URLs, and card-only rendering hints must stay outside the analyzer snapshot.

## Repository Split

This package is expected to move to a standalone `codex-usage-analyzer` repository after the workspace package is merged and before the profile submit CLI depends on it.

The standalone repository should keep this package root as its starting point, then add repository metadata, CI, release policy, and eventually npm publish automation.
