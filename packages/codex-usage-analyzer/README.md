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
  createSampleUsageSnapshotV2
} from "codex-usage-analyzer";

const snapshot = await analyzeUsage();
```

The current implementation is a contract-first skeleton. It returns a sample-backed `UsageSnapshot v2` object while the real local source parser is implemented in a later task.

## Boundary

The analyzer owns local usage fields such as token totals, token breakdown, model usage, skill usage, plugin usage, and activity statistics.

Web products own GitHub login, display name, avatar URL, bio, profile visibility, submit tokens, devices, public URLs, and rendered cards.
