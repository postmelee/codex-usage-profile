# Documentation

Start with the [project README](../README.md) if you want to create and share a profile. The documents below are grouped by audience so product usage, contribution contracts, and privileged operations do not appear to be the same workflow.

## User guides

These English guides describe the public product and require no repository checkout.

| Document | Language | Purpose |
|---|---|---|
| [CLI login and usage submit](cli-submit.md) | English | Sign in, submit usage, manage the local credential, automate submissions, and recover from common errors |
| [GitHub README card and social sharing](readme-card.md) | English | Publish a card, embed its fixed README URL, choose theme and language, and understand social-preview caching |

## Contributor and integration guides

These English documents are for people changing the repository or integrating with its data contracts.

| Document | Language | Purpose |
|---|---|---|
| [Contributing](../CONTRIBUTING.md) | English | Development setup, validation baseline, issue and pull-request workflow |
| [codex-usage-analyzer integration](codex-usage-analyzer.md) | English | Analyzer dependency boundary and Account Usage Contract v1 |
| [UsageSnapshot v2 contract](usage-snapshot-v2.md) | English | Legacy compatibility contract; not the current CLI submission format |

## Maintainer operations

These Korean-language documents describe privileged release and hosting operations. They are not required for normal product use or an ordinary external contribution.

| Document | Language | Purpose |
|---|---|---|
| [npm release operations](npm-release.md) | Korean | Immutable package release, provenance, approval, and recovery procedure |
| [Production Hosting Architecture](production-hosting.md) | Korean | Canonical hosting architecture, durable-resource boundaries, and fallback decisions |
| [Sites operations](sites-operations.md) | Korean | Sites build, deployment, migration, access, recovery, and operational verification runbook |

## Internal project records

Hyper-Waterfall plans, stage reports, daily orders, and maintainer evidence live under `mydocs/`. They preserve project decisions and execution history but are not product documentation or a requirement for external contributors.
