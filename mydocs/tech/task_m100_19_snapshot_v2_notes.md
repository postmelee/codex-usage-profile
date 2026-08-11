# Task M100 #19 UsageSnapshot v2 요구사항 노트

## 목적

이 문서는 `UsageSnapshot v2` 공식 계약 문서 작성 전에 v1 계약, 현재 UI/API 소비 지점, 후속 analyzer/profile 분리 요구사항을 정리한 내부 기술 노트다.

결론부터 말하면 v2는 "로컬 사용량 분석 결과"와 "웹 서비스 계정/표시 정보"를 분리해야 한다. `codex-usage-analyzer`는 사용량 snapshot을 생성하고, `codex-usage-profile`은 GitHub 로그인에서 얻은 사용자 표시 정보와 snapshot을 병합한다.

## 현재 v1 계약 요약

| v1 field | 현재 의미 | 주요 소비 지점 | v2 판단 |
|---|---|---|---|
| `schemaVersion` | snapshot 계약 버전. 현재 `1` | validator, backend submit | v2는 `2`로 독립 정의 |
| `capturedAt` | snapshot 수집 시각 | heatmap 기준일, API 저장 | 유지. analyzer-owned |
| `profile.displayName` | 표시 이름 | profile header | GitHub 표시 정보와 충돌 가능. v2에서는 `codexProfile` 계열 optional 후보 |
| `profile.username` | profile handle | route fallback, header, backend handle 후보 | GitHub login handle과 분리 필요. analyzer-owned Codex profile 값이면 optional 후보 |
| `profile.planLabel` | plan pill | profile header | 유지 후보. analyzer-owned optional |
| `summary.totalTextTokens` | 누적 토큰 | profile stats, share card stats | v2에서는 `usage.totalTokens` 또는 `usage.textTokens`로 명확화 |
| `summary.peakTokens` | 최고 일 사용량 | profile stats, share card stats | v2 `usage.peakDailyTokens` 후보 |
| `summary.longestTaskDurationMs` | 최장 작업 시간 | profile stats | v2 `activity.longestTaskDurationMs` 후보 |
| `summary.currentStreakDays` | 현재 연속 기록 | profile stats, share card stats | v2 `activity.currentStreakDays` 후보 |
| `summary.longestStreakDays` | 최장 연속 기록 | profile stats, share card stats | v2 `activity.longestStreakDays` 후보 |
| `dailyUsage[]` | 일자별 토큰 사용량 | profile heatmap, share card heatmap | 유지하되 token breakdown 확장 가능 구조 필요 |
| `activityInsights.fastModePercent` | Fast Mode 비율 | Activity insights | 유지 후보 |
| `activityInsights.reasoningEffort` | 가장 많이 사용한 reasoning effort | Activity insights | 유지 후보. token reasoning count와 구분 필요 |
| `activityInsights.reasoningEffortPercent` | reasoning effort 비율 | Activity insights | 유지 후보 |
| `activityInsights.skillsExplored` | 사용한 unique skill 수 | Activity insights | 유지 후보 |
| `activityInsights.totalSkillsUsed` | 총 skill 실행 수 | Activity insights | 유지 후보 |
| `activityInsights.totalThreads` | 총 thread 수 | Activity insights | 유지 후보 |
| `topInvocations[]` | plugin/skill 사용량 순위 | Most used plugins | 유지하되 `topSkills`, `topPlugins`, `topInvocations` 중 공식 명칭 결정 필요 |
| `assets.avatar` | 화면용 avatar asset | profile header | GitHub avatar와 분리 필요. Codex avatar이면 optional 후보 |
| `assets.pet` | Codex pet/spritesheet asset | 향후 card/share 확장 | analyzer-owned optional 후보 |

## 현재 selector/API 책임 경계

| 영역 | 현재 동작 | v2 영향 |
|---|---|---|
| `selectProfileViewModel` | v1 snapshot에서 header, stats, token activity, insights, top invocations를 만든다. | v2용 view model selector는 web-owned GitHub profile record와 analyzer snapshot을 함께 받을 가능성이 높다. |
| `selectShareCardViewModel` | v1 snapshot에서 card header, 4개 stats, 26주 usage input을 만든다. | README card는 GitHub-facing fields와 usage fields 병합이 필요하다. |
| `normalizeCodexProfileSnapshot` | raw profile-like input을 v1 allowlist snapshot으로 변환한다. | analyzer repo로 이동하거나 analyzer SDK 내부 구현 후보가 된다. |
| `POST /api/snapshots/submit` | `{ capturedAt, handle, snapshot, visibility }` wrapper를 받는다. | wrapper의 `handle`/`visibility`는 web service submit metadata이고 snapshot v2 내부 field가 아니다. |
| public lookup | latest public snapshot record를 handle로 조회한다. | public handle은 GitHub/web account layer 소유로 유지한다. |
| security scan | submit payload와 snapshot에서 credential-like field/value를 차단한다. | v2에도 동일 원칙을 적용해야 한다. |

## v2 field ownership

### Analyzer-owned usage fields

`codex-usage-analyzer`가 생성해야 하는 후보:

| field group | 후보 field | 필요 이유 | required 후보 |
|---|---|---|---|
| contract metadata | `schemaVersion`, `capturedAt`, `producer` | 계약 버전, 수집 시각, analyzer 식별 | `schemaVersion`, `capturedAt` required |
| source metadata | `source.kind`, `source.client`, `source.timezone`, `source.range` | 데이터 출처와 집계 범위 설명 | optional |
| token totals | `usage.totalTokens`, `usage.textTokens` | 프로필 HP/누적 토큰/대표 수치 | `usage.totalTokens` required 후보 |
| token breakdown | `usage.tokenBreakdown.inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `reasoningTokens` | tokscale-style breakdown, card footer | object required, 값은 nullable 후보 |
| daily usage | `usage.daily[]` | profile heatmap, README card heatmap, streak 계산 | array required 후보 |
| peak usage | `usage.peakDailyTokens` | Codex profile stat | optional 또는 nullable |
| model usage | `models.favoriteModel`, `models.items[]` | favorite model, model별 사용량 | optional group 후보 |
| activity stats | `activity.longestTaskDurationMs`, `currentStreakDays`, `longestStreakDays`, `totalThreads` | profile stat/insights | optional 또는 nullable |
| mode/reasoning insights | `activity.fastModePercent`, `activity.reasoningEffort`, `activity.reasoningEffortPercent` | Codex profile insights | optional 또는 nullable |
| skills/plugins | `skills.exploredCount`, `skills.totalUsed`, `skills.top[]`, `plugins.top[]`, `invocations.top[]` | top skill attack/card mapping, profile list | arrays required-empty 또는 optional 후보 |
| Codex display hints | `codexProfile.displayName`, `codexProfile.username`, `codexProfile.planLabel`, `codexAssets.avatar`, `codexAssets.pet` | Codex profile-like page fidelity | optional |

### Web-owned GitHub-facing fields

`codex-usage-profile` 또는 향후 product web service가 GitHub login/profile API에서 관리해야 하는 field:

| field | 이유 |
|---|---|
| GitHub login/handle | public URL, account identity, README owner mapping |
| GitHub display name | 카드/프로필 표시명으로 사용 가능 |
| GitHub avatar URL | user profile image |
| GitHub bio | tokenmon류 카드 우측 하단 설명 등 product UI용 |
| GitHub profile URL | 외부 링크 |
| GitHub numeric id | owner mapping |
| OAuth/session/token metadata | 인증/보안 영역이며 analyzer snapshot에 넣지 않음 |
| profile visibility | public/private 정책이며 submit wrapper/store 영역 |
| CLI token/device metadata | settings/token management 영역 |

### Derived view-model fields

저장 snapshot에 넣기보다 web selector/card renderer에서 계산하는 후보:

| derived field | 계산 원천 |
|---|---|
| formatted token labels | raw token counts |
| heatmap levels | `usage.daily[]`와 mode |
| card HP | `usage.totalTokens` |
| card attack 1/2 | `skills.top[]` 또는 `invocations.top[]` 상위 2개 |
| card footer token breakdown label | `usage.tokenBreakdown` |
| profile stat order/labels | selector policy |
| plugin/skill icon URL | plugin metadata enrichment 또는 web asset lookup |

### Excluded fields

v2 snapshot에 들어오면 안 되는 후보:

| field category | 예 |
|---|---|
| OAuth token | GitHub/OpenAI access token, refresh token |
| local auth source | local auth file content, raw credential blob |
| environment token | API key, bearer token, token-like environment assignment |
| service token | CLI API token, session id, CSRF token |
| GitHub-facing profile data | GitHub avatar, bio, profile URL |
| private local path | 사용자 로컬 파일시스템 절대 경로 |

## v2 구조 후보

Stage 2에서 확정할 후보 구조는 다음 방향이 적절하다.

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
    "daily": [
      {
        "date": "2026-06-06",
        "totalTokens": 158000000,
        "inputTokens": null,
        "outputTokens": null,
        "cacheReadTokens": null,
        "cacheWriteTokens": null,
        "reasoningTokens": null
      }
    ]
  },
  "models": {
    "favoriteModel": {
      "model": "gpt-5-codex",
      "basis": "tokens",
      "value": 1000000
    },
    "items": [
      {
        "model": "gpt-5-codex",
        "totalTokens": 1000000,
        "inputTokens": null,
        "outputTokens": null,
        "cacheReadTokens": null,
        "cacheWriteTokens": null,
        "reasoningTokens": null
      }
    ]
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
    "top": [
      {
        "id": "pr-merge-cleanup",
        "name": "pr-merge-cleanup",
        "usageCount": 563
      }
    ]
  },
  "plugins": {
    "top": []
  },
  "codexAssets": {
    "avatar": null,
    "pet": null
  }
}
```

## required/optional 기준 후보

| field | Stage 2 추천 |
|---|---|
| `schemaVersion` | required literal `2` |
| `capturedAt` | required ISO date-time |
| `producer` | optional object |
| `codexProfile` | optional object |
| `usage.totalTokens` | required non-negative integer |
| `usage.tokenBreakdown` | required object |
| `usage.tokenBreakdown.*` | nullable non-negative integer |
| `usage.daily` | required array, empty 허용 |
| `models` | optional object |
| `models.favoriteModel` | nullable 또는 optional |
| `models.items` | optional array |
| `activity` | required object with nullable fields 또는 optional object 중 Stage 2에서 결정 |
| `skills.top`, `plugins.top` | arrays, empty 허용 |
| `codexAssets` | optional object |

required를 너무 넓히면 analyzer source가 일부 값을 못 구할 때 submit이 막힌다. 따라서 "구조는 존재하되 값은 null 가능"과 "그룹 자체 optional" 중 어느 쪽이 consumer에 더 단순한지 Stage 2에서 결정한다.

## v1 호환과 migration 후보

| v1 | v2 후보 | migration 방향 |
|---|---|---|
| `summary.totalTextTokens` | `usage.totalTokens` 또는 `usage.textTokens` | v2 selector에서 profile stat으로 매핑 |
| `summary.peakTokens` | `usage.peakDailyTokens` | 이름 명확화 |
| `summary.longestTaskDurationMs` | `activity.longestTaskDurationMs` | activity group으로 이동 |
| `dailyUsage[].credits` | `usage.daily[].totalTokens` | `credits` 대신 token 단위 명시 |
| `activityInsights.*` | `activity.*` | 일부 이름 유지 |
| `topInvocations[]` | `skills.top[]`, `plugins.top[]`, `invocations.top[]` | Stage 2에서 단일/분리 구조 결정 |
| `assets.avatar` | `codexAssets.avatar` | GitHub avatar와 구분 |
| `assets.pet` | `codexAssets.pet` | 유지 |

v1과 v2를 한 validator에 섞기보다 `validateProfileSnapshot`은 v1 유지, `validateUsageSnapshotV2`를 별도 export하는 쪽이 안전하다.

## 후속 이슈 handoff

| Issue | handoff |
|---|---|
| #20 | analyzer SDK/CLI는 v2 snapshot을 생성하고 validate할 수 있어야 한다. |
| #17 | device-code login은 snapshot 구조와 무관한 auth API로 유지한다. |
| #14 | account menu/settings shell은 GitHub-facing fields와 session state를 보여준다. |
| #5 | profile submit CLI는 analyzer v2 output을 받아 submit wrapper로 전송한다. |
| #15 | token/device 관리는 analyzer field와 결합하지 않는다. |
| #6 | README card renderer는 web-owned GitHub profile record와 v2 snapshot을 병합한다. |
| #8 | plugin/skill icon metadata는 v2 usage ranking을 enrichment하는 web-side lookup으로 다루는 편이 안전하다. |

## Stage 2 결정 필요 사항

- `totalTokens`와 `textTokens`를 둘 다 둘지, `totalTokens` 하나로 시작할지.
- `tokenBreakdown`의 합계가 `totalTokens`와 항상 일치해야 하는지, source별 차이를 허용할지.
- `activity` 그룹을 required object로 둘지 optional object로 둘지.
- skills/plugins를 분리할지 `invocations.top[]` 단일 배열로 둘지.
- Codex profile 표시 힌트를 analyzer snapshot에 포함할지, 웹 UI가 GitHub profile을 우선하도록 완전히 optional로 둘지.
- v2 runtime skeleton에서 extension field를 완전히 금지할지, `extensions` namespace만 허용할지.
