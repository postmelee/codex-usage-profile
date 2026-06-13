# codex-usage-analyzer

`codex-usage-analyzer` is the local usage analyzer package for Codex Usage Profile-compatible products.

It reads local usage sources, normalizes usage information, and emits `UsageSnapshot v2` JSON. It does not own account identity, GitHub login, profile visibility, service tokens, devices, public URLs, or rendered card UI.

## Package Status

The standalone repository now exists at:

```text
https://github.com/postmelee/codex-usage-analyzer
```

The `codex-usage-profile` repository still keeps a workspace compatibility copy at:

```text
packages/codex-usage-analyzer/
```

The standalone repository is the canonical distribution target for the analyzer package. The workspace copy remains in this repository until the profile submit CLI can safely depend on a published package or a pinned GitHub dependency.

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

## Standalone Repository

The standalone repository was bootstrapped from the workspace package with a clean initial import:

```text
https://github.com/postmelee/codex-usage-analyzer
```

Current profile integration state:

1. The standalone repository is public and starts from the analyzer package root.
2. The profile repository keeps `packages/codex-usage-analyzer/` as a temporary compatibility copy.
3. Submit CLI work can continue against the local workspace copy without relying on npm publishing.
4. A follow-up task should switch profile dependencies to one of the supported external forms.

Dependency transition options:

| Option | When to use | Tradeoff |
|---|---|---|
| npm semver dependency | After analyzer parser and submit flow pass end-to-end smoke tests | Best consumer experience, requires publish/release policy |
| pinned GitHub dependency | Before npm publish, when profile needs to consume standalone source directly | Avoids npm release, but couples install to GitHub network availability |
| temporary workspace copy | During M100 profile submit implementation | Stable local tests, but source can drift from standalone repo |

The preferred long-term path is npm semver dependency after the analyzer parser and submit flow are verified.

## Non-Goals

This package does not:

- perform GitHub OAuth
- issue or store submit tokens
- own public profile handles
- render cards or images
- update GitHub README files
- upload raw credential files
- expose local private paths
