# codex-usage-analyzer

`codex-usage-analyzer` is the local usage analyzer package for Codex Usage Profile-compatible products.

It reads local usage sources, normalizes usage information, and emits `UsageSnapshot v2` JSON. It does not own account identity, GitHub login, profile visibility, service tokens, devices, public URLs, or rendered card UI.

## Package Status

The package currently lives inside this repository as:

```text
packages/codex-usage-analyzer/
```

This workspace package is the export-ready staging area before creating a standalone `codex-usage-analyzer` GitHub repository.

The current implementation is contract-first:

- `analyzeUsage()` returns a sample-backed `UsageSnapshot v2`.
- `analyze --json` prints one validated snapshot JSON object to stdout.
- The canonical `UsageSnapshot v2` validator/type/fixture lives in the analyzer package.
- The real local source parser is a follow-up task.

## CLI Contract

```bash
npx codex-usage-analyzer@latest analyze --json
```

Local workspace smoke command:

```bash
node packages/codex-usage-analyzer/bin/codex-usage-analyzer.js analyze --json
```

CLI behavior:

| Behavior | Contract |
|---|---|
| Success stdout | One `UsageSnapshot v2` JSON object |
| Success stderr | Empty |
| Success exit code | `0` |
| Argument or analysis failure | Error/usage text on stderr, non-zero exit |
| JSON mode | stdout must remain parseable JSON |

## SDK Contract

```js
import {
  USAGE_SNAPSHOT_V2_SCHEMA_VERSION,
  analyzeUsage,
  assertUsageSnapshotV2,
  createSampleUsageSnapshotV2,
  isUsageSnapshotV2,
  sampleUsageSnapshotV2,
  validateUsageSnapshotV2
} from "codex-usage-analyzer";

const snapshot = assertUsageSnapshotV2(await analyzeUsage());
```

Public API:

| Export | Responsibility |
|---|---|
| `analyzeUsage(options?)` | Produces a `UsageSnapshot v2` object. Currently sample-backed until the real parser lands. |
| `createSampleUsageSnapshotV2(overrides?)` | Creates a sample snapshot for tests and wrapper smoke checks. |
| `validateUsageSnapshotV2(value)` | Returns `{ ok, errors }` without throwing. |
| `assertUsageSnapshotV2(value)` | Returns the snapshot or throws a `TypeError`. |
| `isUsageSnapshotV2(value)` | Boolean type guard. |
| `USAGE_SNAPSHOT_V2_SCHEMA_VERSION` | Literal `2`. |
| `sampleUsageSnapshotV2` | Canonical sample fixture. |

## Ownership Boundary

Analyzer-owned fields:

- total tokens
- token breakdown
- daily usage buckets
- favorite model and model usage
- activity statistics
- top skills
- top plugins
- optional Codex-side display hints

Web-service-owned fields:

- GitHub identity and profile data
- browser sessions
- CLI API tokens
- device ids
- public/private visibility
- public handles and URLs
- rendered profile/card view models
- README image endpoints and caching

The submitted snapshot should be sent as `payload.snapshot`. Wrapper metadata such as `handle`, `visibility`, authorization headers, and device metadata must remain outside the snapshot.

## Wrapper Compatibility

A product-specific CLI such as `tokenmon` can wrap this analyzer without forking it:

```js
import {
  analyzeUsage,
  assertUsageSnapshotV2
} from "codex-usage-analyzer";

async function submit() {
  const snapshot = assertUsageSnapshotV2(await analyzeUsage());

  await fetch("https://example.com/api/snapshots/submit", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${process.env.PRODUCT_CLI_TOKEN}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      snapshot,
      visibility: "public"
    })
  });
}
```

In that design, `npx tokenmon@latest submit` owns product login, submit token storage, card rendering, and product-specific APIs. It imports `codex-usage-analyzer` only to produce and validate the local usage snapshot.

## Profile Integration

`codex-usage-profile` should consume analyzer output rather than reimplement local usage analysis:

1. The user signs in to the web service with GitHub.
2. The CLI obtains a service-specific submit token.
3. The CLI calls `analyzeUsage()` from `codex-usage-analyzer`.
4. The CLI validates the result with `assertUsageSnapshotV2()`.
5. The CLI submits `{ snapshot }` to the profile service with its bearer token.
6. The web service merges the stored GitHub account/profile record with the analyzer snapshot for public profile and README image rendering.

## Standalone Repository Timing

The standalone `codex-usage-analyzer` GitHub repository should be created after this workspace package is merged and before the profile submit CLI depends on it.

Recommended order:

1. Merge the workspace package and contract tests.
2. Bootstrap the standalone analyzer repository from `packages/codex-usage-analyzer/`.
3. Add repository metadata, CI, release policy, and parser implementation issues.
4. Point `codex-usage-profile` submit CLI work at the standalone package or a pinned git dependency.
5. Publish to npm after the parser and submit flow pass an end-to-end smoke test.

## Non-Goals

This package does not:

- perform GitHub OAuth
- issue or store submit tokens
- own public profile handles
- render cards or images
- update GitHub README files
- upload raw credential files
- expose local private paths
