# codex-usage-analyzer

`codex-usage-analyzer` is the local usage analysis package that emits `UsageSnapshot v2` JSON.

This directory is a temporary workspace compatibility copy inside `codex-usage-profile`.

The standalone repository is:

```text
https://github.com/postmelee/codex-usage-analyzer
```

The standalone repository is the canonical distribution target. This workspace copy remains until the profile submit CLI can safely depend on a published package or a pinned GitHub dependency.

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

The standalone repository has been created from this package root with a clean initial import.

Follow-up work should decide when `codex-usage-profile` stops using this workspace copy:

- npm semver dependency after parser and submit smoke verification
- pinned GitHub dependency before npm publish, if needed
- workspace copy until the profile submit flow no longer needs local package stability

npm publishing, release automation, and the real local source parser remain follow-up work.
