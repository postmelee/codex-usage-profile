# Task M100 #2 Snapshot 계약 기술 노트

## 조사 배경

최신 Codex Profile 화면과 공유 카드 이미지를 웹서비스에서 재현하려면 frontend, backend, CLI, README card renderer가 같은 데이터 계약을 사용해야 한다. 이번 task에서는 OpenAI/ChatGPT credential을 서버에 보내지 않고, 로컬 CLI가 정제한 profile snapshot만 업로드하는 구조를 기준으로 snapshot schema, raw Codex-like 응답 매핑, selector 책임 경계를 정리했다.

이 문서는 public API 문서가 아니라 후속 #3, #4, #5, #6 구현을 정렬하기 위한 내부 기술 노트다.

## 조사 질문

- Codex Profile 화면과 공유 카드가 공통으로 필요로 하는 snapshot field는 무엇인가?
- `/wham/profiles/me` 계열 raw 응답에서 어떤 field만 allowlist로 추출해야 하는가?
- 인증/토큰 정보가 snapshot에 섞이지 않도록 어떤 경계를 둬야 하는가?
- 후속 UI/API/CLI/PNG endpoint task는 어떤 selector를 기준으로 이어받아야 하는가?

## 조사 대상

| 대상 | 이유 | 위치 |
|---|---|---|
| Codex profile query bundle | raw profile 응답 매핑 확인 | `codex-extracted/webview/assets/profile-queries-Ccuj1gLs.js` |
| Codex profile/share card bundle | Profile 화면과 공유 카드 필요 field 확인 | `codex-extracted/webview/assets/profile-DFD9l1SG.js` |
| Stage 1 schema | 저장 가능한 snapshot shape 확인 | `src/profile-snapshot/schema.js` |
| Stage 2 normalizer | raw-to-snapshot allowlist 확인 | `src/profile-snapshot/normalize.js` |
| Stage 3 selectors | 후속 renderer/API가 사용할 view model 경계 확인 | `src/profile-snapshot/selectors.js` |

## 발견 내용

### Snapshot 최상위 구조

현재 schema version은 `1`이다. snapshot은 다음 최상위 field만 허용한다.

| Field | 의미 | 비고 |
|---|---|---|
| `schemaVersion` | snapshot 계약 버전 | 현재 `1` |
| `capturedAt` | 로컬 CLI가 snapshot을 수집한 시각 | ISO date-time string |
| `profile` | 표시 이름, username, plan label | avatar/pet asset은 `assets`에 둔다. |
| `summary` | Profile/Card stat 원천 | nullable non-negative integer |
| `dailyUsage` | 날짜별 token usage 원천 | `{ date, credits }[]` |
| `activityInsights` | Fast Mode, reasoning, skills, threads 지표 | Profile 화면용 |
| `topInvocations` | 가장 많이 사용한 plugin/skill | Profile 화면용 |
| `assets` | avatar/pet asset reference | raw credential/local private path 저장 금지 |

`validateProfileSnapshot`은 exact-key 방식으로 동작한다. 허용되지 않은 top-level 또는 nested field는 validation error가 된다.

### Raw Codex-like 응답 매핑

`normalizeCodexProfileSnapshot(raw, options)`는 raw 응답 전체를 저장하지 않고 아래 field만 읽는다.

| Raw field | Snapshot field | 변환 |
|---|---|---|
| `profile.display_name` | `profile.displayName` | trim, blank -> `null` |
| `profile.username` | `profile.username` | trim, blank -> `null` |
| `profile.profile_picture_url` | `assets.avatar` | remote URL asset으로 변환 |
| `profile.plan_label`, `profile.plan`, `account.plan_label`, `account.plan`, `options.planLabel` | `profile.planLabel` | known plan key는 display label로 변환 |
| `stats.lifetime_tokens` | `summary.totalTextTokens` | non-negative integer 또는 `null` |
| `stats.peak_daily_tokens` | `summary.peakTokens` | non-negative integer 또는 `null` |
| `stats.longest_running_turn_sec` | `summary.longestTaskDurationMs` | seconds -> milliseconds |
| `stats.current_streak_days` | `summary.currentStreakDays` | non-negative integer 또는 `null` |
| `stats.longest_streak_days` | `summary.longestStreakDays` | non-negative integer 또는 `null` |
| `stats.daily_usage_buckets[].start_date` | `dailyUsage[].date` | `YYYY-MM-DD` date |
| `stats.daily_usage_buckets[].tokens` | `dailyUsage[].credits` | non-negative integer |
| `stats.fast_mode_usage_percentage` | `activityInsights.fastModePercent` | 0-100 clamp 또는 `null` |
| `stats.most_used_reasoning_effort` | `activityInsights.reasoningEffort` | string 또는 `null` |
| `stats.most_used_reasoning_effort_percentage` | `activityInsights.reasoningEffortPercent` | 0-100 clamp 또는 `null` |
| `stats.unique_skills_used` | `activityInsights.skillsExplored` | non-negative integer 또는 `null` |
| `stats.total_skills_used` | `activityInsights.totalSkillsUsed` | non-negative integer 또는 `null` |
| `stats.total_threads` | `activityInsights.totalThreads` | non-negative integer 또는 `null` |
| `stats.top_invocations[]` | `topInvocations[]` | `plugin`/`skill` type만 유지 |
| `options.petAsset` | `assets.pet` | optional asset override |

### 보안 경계

서버 저장 가능 payload는 `ProfileSnapshot` validation을 통과한 값으로 제한한다. 다음 raw 정보는 snapshot에 포함하지 않는다.

- OpenAI/ChatGPT access token
- refresh token
- `~/.codex/auth.json` 원문 또는 직렬화 값
- raw credential blob
- raw Codex response 전체
- private local filesystem path

Stage 2 테스트는 raw input에 token-like field를 주입하고, serialized snapshot에 secret 값이 남지 않는지 검증한다. grep match는 보안 테스트와 계획/보고서 설명에만 남아야 한다.

### Selector 책임 경계

Selector는 rendering을 하지 않고, snapshot에서 후속 task가 사용할 source data와 key/label/value 형태만 반환한다.

| Selector | 소비자 | 책임 |
|---|---|---|
| `selectProfileViewModel` | #3 Profile UI | header, 5개 stat, token activity source, activity insights, most used invocations |
| `selectShareCardViewModel` | #6 README card endpoint | header, 4개 card stat, 26주 usage source |
| `selectProfileStats` | #3 Profile UI | Lifetime tokens, Peak tokens, Longest task, Current streak, Longest streak |
| `selectShareCardStats` | #6 Card renderer | Lifetime tokens, Peak day, Current streak, Longest streak |
| `selectProfileTokenActivity` | #3 Profile UI | daily/weekly/cumulative chart 계산용 source data |
| `selectShareCardUsageInput` | #6 Card renderer | 26주 card grid 계산용 source data |
| `selectMostUsedInvocations` | #3 Profile UI | usage count 내림차순 plugin/skill 목록 |

Daily/Weekly/Cumulative heatmap level 계산은 #3 UI task에서 처리한다. Codex 공유 카드의 26주 level 계산과 Canvas PNG renderer는 #6에서 처리한다.

## 결정

- Snapshot schema는 exact-key runtime validator로 검증한다.
- Raw Codex-like 응답은 normalizer allowlist를 통해서만 snapshot으로 변환한다.
- 외부 dependency 없이 ESM module, Node 내장 test, `.d.ts` 타입 계약으로 시작한다.
- UI와 card renderer는 raw snapshot을 직접 해석하지 않고 selector를 우선 사용한다.
- 이 문서는 공식 사용자/API 문서로 승격하지 않고 `mydocs/tech/` 내부 기술 노트로 둔다.

## 비결정 / 보류

- Public API 문서 루트는 아직 선택하지 않는다. #4 pairing API 또는 별도 문서 task에서 판단한다.
- 실제 CLI가 Codex 데이터를 어디서 어떻게 수집할지는 #5에서 결정한다.
- avatar/pet asset upload/cache 정책은 #4/#5/#6에서 결정한다.
- Codex UI와 동일한 chart/card level 색상 계산은 #3/#6에서 구현한다.
- TypeScript compiler 기반 source 전환은 #3 이후 app/toolchain 선택 시 다시 판단한다.

## 적용 영향

- #3은 `selectProfileViewModel`을 기준으로 최신 Codex Profile 화면을 구현한다.
- #4는 upload/store API가 `ProfileSnapshot` validator를 통과한 payload만 저장하도록 한다.
- #5는 raw Codex-like data를 서버로 보내지 않고 `normalizeCodexProfileSnapshot` 결과만 push한다.
- #6은 `selectShareCardViewModel`을 기준으로 README PNG endpoint와 cache header 전략을 구현한다.

## 참고 링크

- [Issue #2](https://github.com/postmelee/codex-usage-profile/issues/2)
- [수행계획서](../plans/task_m100_2.md)
- [구현계획서](../plans/task_m100_2_impl.md)
