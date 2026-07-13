# codex-usage-analyzer Integration

[`codex-usage-analyzer`](https://github.com/postmelee/codex-usage-analyzer) is the standalone upstream reader used by the product-specific `codex-usage-profile` CLI.

Version `0.2.x` starts the installed Codex app-server, calls the documented `account/usage/read` method, and returns Account Usage Contract v1. It does not scan retained local sessions or directly read authentication files, tokens, keychains, prompts, responses, or tool data.

## Current Dependency

The profile CLI declares a normal npm semver dependency:

```json
{
  "dependencies": {
    "codex-usage-analyzer": "^0.2.0"
  }
}
```

The repository no longer contains a workspace compatibility copy. `package-lock.json` must resolve the dependency to the npm registry with version, tarball URL, and integrity rather than to `packages/codex-usage-analyzer`.

## SDK Contract

```js
import {
  ACCOUNT_USAGE_CONTRACT_VERSION,
  CodexUsageError,
  readAccountUsage
} from "codex-usage-analyzer";

try {
  const document = await readAccountUsage({ timeoutMs: 30_000 });
  console.log(document.contractVersion === ACCOUNT_USAGE_CONTRACT_VERSION);
} catch (error) {
  if (error instanceof CodexUsageError) {
    console.error(error.code);
  }
}
```

Relevant exports:

| Export | Responsibility |
|---|---|
| `readAccountUsage(options?)` | Calls Codex app-server and returns one Account Usage Contract document |
| `ACCOUNT_USAGE_CONTRACT_VERSION` | Current literal contract version `1` |
| `ACCOUNT_USAGE_SUMMARY_FIELDS` | Stable summary field allowlist |
| `CodexUsageError` | Safe error carrying a documented `code` |
| `CODEX_USAGE_ERROR_CODES` | Analyzer error code constants |

The analyzer timeout range is 1 to 120000 milliseconds. The profile CLI aligns its `--timeout` range to this boundary.

## Account Usage Contract v1

```json
{
  "contractVersion": 1,
  "capturedAt": "2026-07-11T00:00:00.000Z",
  "summary": {
    "lifetimeTokens": 1234567890,
    "peakDailyTokens": 45600000,
    "longestRunningTurnSec": 754,
    "currentStreakDays": 3,
    "longestStreakDays": 21
  },
  "dailyUsageBuckets": [
    {
      "startDate": "2026-07-10",
      "tokens": 123456
    }
  ]
}
```

All values above are synthetic. Summary fields are always present and can be non-negative safe integers or `null`. `dailyUsageBuckets` can be `null`, an empty array, or an array of source-dated rows. Consumers must preserve `null` as unavailable and must not timezone-rebucket `startDate`.

The profile CLI validates the complete exact-key document again before submission. The HTTP body is the document itself, not `{ snapshot }` and not an identity wrapper.

## Responsibility Boundary

| Concern | Analyzer | Profile CLI and service |
|---|---|---|
| Start Codex app-server | Yes | No |
| Call `account/usage/read` | Yes | No |
| Normalize account usage | Yes | Validate again before storage |
| GitHub login and identity | No | Browser OAuth and owner records |
| Issue/store/revoke submit token | No | Yes |
| Device metadata | No | Product request headers |
| Profile visibility | No | Web owner setting |
| Card rendering and cache | No | Stable PNG endpoint and ETag |

Never add the following to the analyzer document:

- GitHub name, login, avatar, email or provider user id
- service handle, visibility, profile URL, image URL or README Markdown
- service token, session, device id or device name
- OpenAI/Codex/GitHub credentials or local credential paths

The downstream binds a valid write to the owner encoded in its own Bearer token. It never accepts a body-supplied owner id or username.

## Authentication Requirements

The analyzer requires:

- Node.js 20 or newer
- a recent Codex CLI available as `codex` on `PATH`
- a ChatGPT-backed Codex sign-in supporting `account/usage/read`

API-key-only and Bedrock authentication do not provide this account usage method. The analyzer delegates authentication to Codex and never asks the profile service to receive a Codex credential.

## Error Mapping

The profile CLI maps every analyzer code to a fixed safe message:

| Code | User action |
|---|---|
| `INVALID_TIMEOUT` | Use a timeout from 1 to 120000ms |
| `CODEX_NOT_FOUND` | Install/update Codex and verify `PATH` |
| `APP_SERVER_START_FAILED` | Check that Codex can start app-server |
| `APP_SERVER_EXITED` | Retry after checking the local Codex installation |
| `APP_SERVER_TIMEOUT` | Check connectivity and retry |
| `APP_SERVER_PROTOCOL_ERROR` | Update Codex and analyzer |
| `APP_SERVER_RPC_ERROR` | Confirm a compatible ChatGPT-backed login |
| `INVALID_ACCOUNT_USAGE_RESPONSE` | Update Codex and analyzer; upstream data was rejected |

Unknown exceptions become a generic analyzer failure. Raw RPC data, app-server stderr, filesystem paths, credentials, and original exception messages are not forwarded to CLI output.

## Downstream Flow

```text
installed Codex -> app-server account/usage/read
                -> codex-usage-analyzer Account Usage Contract v1
                -> codex-usage-profile CLI exact validation
                -> POST /api/account-usage/submit
                -> token-bound GitHub owner usage
                -> stable profile card URL and ETag
```

Detailed product commands and privacy behavior are in [CLI login and submit](cli-submit.md). README image caching is documented in [README card](readme-card.md).

## Legacy UsageSnapshot v2

This repository still contains an internal `UsageSnapshot v2` compatibility contract for the older full-profile preview and snapshot API. It is no longer exported by or submitted through `codex-usage-analyzer@0.2.x`, and the new CLI does not send it. New account usage integration must use Account Usage Contract v1.
