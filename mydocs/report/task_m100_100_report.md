# Task #100 최종 보고서 — README 카드 고정 URL의 대표 설정 자동 반영

GitHub Issue: [#100](https://github.com/postmelee/codex-usage-profile/issues/100)
마일스톤: M100

## 작업 요약

- 대상 이슈: #100
- 마일스톤: M100 — v1.0 MVP
- 단계 수: 6개 Stage + Stage 6.1 production smoke 기록
- 작업 목적: README에 query 없는 고정 카드 URL 하나만 유지하면서 사용량과 저장된
  테마·언어 변경이 같은 URL의 대표 이미지에 자동 반영되도록 publication·API·UI
  계약을 정렬한다.

Task 시작 당시 Share Studio는 저장된 theme·locale을 query로 드러낸 explicit URL을
README에 복사해 설정 변경 때 링크 교체가 필요했다. Task #100은 publication authority가
대표 설정을 소유하도록 바꾸고 queryless URL을 canonical read로 전환했다. 작업지시자가
Stage 6에서 승인한 추가 보정에 따라 README 복사 결과는 기본 폭 50%의 GitHub-compatible
HTML image가 됐으며, 카드를 클릭하면 Camo 원본 대신 `/api/share/{handle}`로 이동한다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `src/profile-media/` | additive v4 canonical pair, memory·R2·S3 authority read/write, maintenance·failure·concurrency 정합성 | canonical/explicit media 선택, storage authority, cleanup·repair |
| `src/profile-card/`, `src/profile-backend/`, `src/profile-api/` | settings prepare → owner CAS → authority/social commit, exact retry, raw selector 전달, 공통 README 임베드 생성 | 설정 저장, usage refresh, GET/HEAD/304/404, API·CLI metadata |
| `src/profile-ui/`, `packages/codex-usage-profile-cli/` | canonical copy와 explicit preview/download 분리, 50% linked HTML 임베드 | Share Studio clipboard, PNG 저장·복사, CLI human/JSON output |
| `scripts/smoke-sites-fullstack-local.mjs`, `tests/`와 각 `__tests__/` | 같은 URL의 설정·사용량 갱신, adapter·transaction·UI·CLI 회귀 보강 | Node, Playwright, Worker·D1·R2 full-stack smoke |
| `README.md`, `docs/`, `mydocs/` | 사용자 예시, cache·ETag·운영·rollback 계약, 단계 증거와 계획 기록 | 사용자 안내, 운영 handoff, 리뷰·추적 문서 |

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `README.md` | 저장소 루트 | `README.md` | OK | 프로젝트 소개와 복사 예시는 루트 README에 유지 |
| README 카드 사용자 계약 | `docs/` | `docs/readme-card.md` | OK | canonical·explicit·HTML embed·Camo 사용자 흐름 기록 |
| production hosting 계약 | `docs/` | `docs/production-hosting.md` | OK | v4 metadata, commit·rollback·migration 계약 기록 |
| Sites 운영 계약 | `docs/` | `docs/sites-operations.md` | OK | 배포 전후 ETag·대표 설정·cleanup Gate 기록 |
| CLI 사용자 계약 | CLI package와 `docs/` | `packages/codex-usage-profile-cli/README.md`, `docs/cli-submit.md` | OK | API/CLI `readmeMarkdown`의 exact 출력 예시 기록 |
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_100*.md` | OK | 승인 범위·문서 위치·Stage 1~6 경계 기록 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_100_stage{1..6}.md` | OK | 각 Stage 구현·검증과 production smoke 증거 기록 |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_100_report.md` | OK | 중앙 최종 보고서 템플릿 위치와 일치 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| README image URL | 저장 선택에 따라 `theme`·`locale` query가 바뀜 | query 없는 `/u/{handle}/card.png` 하나 |
| 설정 변경 반영 | 새 explicit URL을 다시 복사·교체 | 같은 URL의 PNG·ETag 갱신 |
| publication canonical metadata | 없음, queryless는 dark/en 고정 | `canonicalTheme`·`canonicalLocale` 2개 additive field |
| v4 R2 owner object 수 | authority·representation·revision 합계 6 | 6, key·revision 구조 증가 없음 |
| README 기본 표시 폭 | 원본 1497px intrinsic width | 조절 가능한 `width="50%"` |
| README 카드 클릭 대상 | GitHub Camo raw image | `/api/share/{handle}` 서비스 공유 페이지 |
| 최종 자동 검증 | Task 전 수용 기준 미충족 | Node 803건 중 797 pass·6 skip, Playwright 100/100 |
| local full-stack smoke | 대표 설정·usage의 동일 URL 갱신 증거 없음 | route 62개, canonical update 2회 검증 |

Task 전체 diff는 최종 보고서 작성 전 기준 49개 파일, 2,963줄 추가, 253줄
삭제였다. 다수 추가 라인은 구현계획서·Stage 보고서와 adapter·concurrency·smoke
회귀 테스트다.

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| README·이미지 URL은 query 없는 canonical URL 사용 | OK — Share Studio unit/E2E와 production clipboard에서 selector query 없음 |
| usage submit 뒤 같은 URL의 bytes·ETag 갱신 | OK — local Worker smoke가 첫 publish 뒤 usage update를 포함해 canonical update 2회 검증 |
| theme·locale 저장 뒤 같은 URL이 새 대표 이미지 반환 | OK — memory·R2·S3·HTTP·E2E·production origin에서 light/en 대표 이미지 확인 |
| 새로고침·다른 client에서도 저장 대표 설정 유지 | OK — persisted authority read, E2E reload, production curl과 브라우저 reload가 같은 대표 이미지 사용 |
| explicit variant URL 하위 호환 | OK — theme-only·locale-only·두 selector 조합이 기존 dark/en 누락축 의미 유지 |
| canonical card와 social image의 대표 설정·publication 정합 | OK — 동일 publication id commit과 mismatch fail-close·exact retry 회귀 통과 |
| 중간 실패·경합에서 혼합 authority 방지 | OK — owner CAS 이전 authority 불변, winner-only commit, supersession과 retry 테스트 통과 |
| private·unpublished media 존재 비노출 | OK — canonical·variant·social GET/HEAD가 동일 404 경계를 유지 |
| cleanup·maintenance·restore가 canonical pair 보존 | OK — object count 6, digest·repair·restore와 cleanup dry-run 회귀 통과 |
| README 크기 조절과 서비스 클릭 링크 | OK — 50% HTML embed, `/api/share/{handle}` anchor를 GitHub renderer와 production clipboard에서 확인 |
| production 고정 PNG·Camo 수렴 | OK — Sites v32 게시, origin/Camo 143,666 bytes와 SHA-256 일치, Camo MISS·age 0 확인 |
| 전체 통합 검증 | OK — Node·Playwright·build·두 verifier·local smoke·diff check 전부 통과 |

Issue #100 원문의 `![Codex usage profile](...)` exact string 수용 기준은 Stage 6에서
작업지시자가 승인한 UX 보정으로 `<a><img width="50%" ... /></a>` exact string으로
대체됐다. image `src`의 queryless canonical URL이라는 핵심 수용 기준은 유지된다.

### 단계별 검증 결과

- Stage 1: [`task_m100_100_stage1.md`](../working/task_m100_100_stage1.md) — canonical selection 계약과 memory store, 25/25 및 media 회귀 통과.
- Stage 2: [`task_m100_100_stage2.md`](../working/task_m100_100_stage2.md) — R2·S3 authority metadata·failure·maintenance 정합화 통과.
- Stage 3: [`task_m100_100_stage3.md`](../working/task_m100_100_stage3.md) — settings transaction·exact retry·HTTP canonical 전환 통과.
- Stage 4: [`task_m100_100_stage4.md`](../working/task_m100_100_stage4.md) — canonical copy와 explicit preview/download 분리 unit·E2E 통과.
- Stage 5: [`task_m100_100_stage5.md`](../working/task_m100_100_stage5.md) — Node·E2E·production artifact·canonical update smoke 통과.
- Stage 6: [`task_m100_100_stage6.md`](../working/task_m100_100_stage6.md) — 50% linked HTML embed, Sites v32, GitHub renderer·Camo production smoke 통과.

최종 재검증 결과:

- `npm test -- --test-concurrency=1`: 803건 중 797 pass, 0 fail, 환경 조건 6 skip.
- `npm run test:e2e`: 100/100 pass.
- `npm run build:production`: server/client production artifact 생성 성공.
- `npm run verify:sites-fullstack`: client 8, Worker 2, migration 5, hosted mode 승인.
- `npm run verify:sites-production`: artifact 5,145,201 bytes, binding 3, migration 5 승인.
- `npm run smoke:sites-fullstack:local`: route 62, canonical update 2, public PNG 85,362 bytes.
- `npm run cleanup:card-media -- --help`: dry-run 기본·90일·최신 5 revision 보호·apply 재검사 안내 확인, 삭제 미실행.
- `git diff --check`: 경고 없음.

## 잔여 위험과 후속 작업

### 잔여 위험

- GitHub Camo의 재검증 시점은 GitHub가 관리한다. 이번 production 검증에서는 승인된
  exact Camo URL 한 건을 purge해 원본과 수렴시켰지만, 이후 대표 이미지 변경에서도
  즉시 갱신된다고 보장하지 않는다. purge는 장시간 지연 시에만 사용하는 운영 예외다.
- Postgres/S3 실제 endpoint 통합 6건은 환경 변수가 없어 skip됐다. canonical production인
  Sites D1·native R2와 local workerd full-stack 경로는 모두 검증됐다.
- GitHub Actions의 PR check는 PR 생성 뒤 실행되므로 이 보고서 작성 시점에는 결과가 없다.

### 후속 작업 후보

- #84의 release 운영 문서·Gate C가 남아 있다면 queryless canonical 대표 설정과
  linked HTML embed를 기준으로 유지한다.
- 새 theme·locale·effect, Animated GIF/Web Share는 Task #100 범위 밖이며 별도 이슈로
  추적한다.

## 작업지시자 승인 요청

- 최종 보고서와 수용 기준 검증 결과가 승인되어 `publish/task100` 게시와 `devel`
  대상 PR 생성 절차로 진행한다.
