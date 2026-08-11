# Task #74 최종 보고서 — 카드 테마 커스터마이징과 light/dark R2 변형 저장

GitHub Issue: [#74](https://github.com/postmelee/codex-usage-profile/issues/74)
마일스톤: M100

## 작업 요약

- 대상 이슈: #74
- 마일스톤: M100
- 단계 수: 6개 Stage와 Stage 4.1 UX 보정
- 작업 목적: owner가 카드의 light/dark 테마와 en/ko 언어를 저장하고, 네 PNG 변형 중 선택한 URL을 기존 dark 카드 호환성을 유지한 채 공유하도록 한다.

버전된 `cardStyle`과 preset registry를 durable owner 설정으로 추가하고, 공개 media
contract를 dark/light × en/ko 네 representation을 갖는 v4로 확장했다. 기존 query 없는
dark URL과 stable key는 authority 및 하위 호환 경로로 유지했다. Profile에는 실제 카드
미리보기, 테마·언어 draft/save, 저장 전 공유 시 자동 저장, 선택 URL 기반 Share Studio를
연결했다. Rotate/Pulse와 animated GIF는 확장 경계만 마련하고 실제 기능은 #39로 분리했다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `db/migrations/0004_card_style.sql`, `db/migrations/0005_card_locale.sql` | D1 owner 카드 스타일·언어 additive column과 기본값 | 신규·기존 owner migration, 이전 saved version rollback |
| `src/profile-backend/postgres/migrations/0003_*`, `0004_*` | Postgres 동등 schema와 up/down migration | tested fallback adapter |
| `src/profile-card/presentation.js` 및 renderer/theme | canonical style, registry, digest, light/dark 결정적 PNG | native/Worker renderer와 future effect 확장 경계 |
| `src/profile-backend/*`, D1/Postgres store | atomic card settings, API 응답 URL map, 신규 OAuth owner 기본값 | owner API, CAS, maintenance export/restore |
| `src/profile-media/*` | media contract v4, 네 representation publication, dual stable authority와 cleanup | memory, native R2, S3-compatible adapter |
| `src/profile-runtime/sites/*` | Sites binding, maintenance readiness·repair·exact cleanup | production candidate와 rollback 운영 |
| `src/profile-ui/CardProfilePage.jsx`, `CardStyleSettings.jsx`, `ShareStudio.jsx` | Profile 미리보기·테마/언어 저장·저장 후 공유 | owner UX, 접근성, 선택 URL 공유 |
| `src/profile-ui/cardShare.js`, `publicProfileRoutes.js` | locale/theme query 독립 정규화와 unsafe URL 차단 | README/URL/PNG/public profile 하위 호환 |
| `tests/`, `src/**/__tests__`, `scripts/__tests__` | schema·media·publication·UI·artifact 회귀 검증 | 전체 Node, E2E와 배포 후보 계약 |
| `docs/readme-card.md` | 네 카드 변형과 query 없는 dark URL 사용법 | 사용자·외부 통합자 |
| `docs/production-hosting.md` | media v4 authority, retention, migration·rollback | 유지보수자·운영자 |
| `docs/sites-operations.md` | candidate package, smoke, export·restore·cleanup 순서 | Sites 운영자 |
| `mydocs/plans/`, `mydocs/working/`, `mydocs/report/` | 승인 계획, 여섯 단계 결과와 최종 수용 근거 | 하이퍼-워터폴 작업 기록 |

전체 변경은 `devel` 대비 84개 파일, 5,330줄 추가, 674줄 삭제다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| README 카드 사용법 | `docs/readme-card.md` | `docs/readme-card.md` | OK | 계획된 기존 사용자 문서에 theme·locale URL 계약만 증분 반영 |
| production media 계약 | `docs/production-hosting.md` | `docs/production-hosting.md` | OK | R2 authority·retention·rollback의 기존 진실 원천 유지 |
| Sites 운영 절차 | `docs/sites-operations.md` | `docs/sites-operations.md` | OK | migration·export·restore·smoke 절차를 기존 운영 문서에 반영 |
| 수행·구현 계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_74*.md` | OK | 승인 판단과 단계 계약을 제품 문서와 분리 |
| 단계·최종 보고서 | `mydocs/working/`, `mydocs/report/` | 계획된 동일 경로 | OK | 단계 검증과 최종 수용 근거를 작업 문서로 보관 |

`mydocs/manual`이나 새 공식 문서 루트는 만들지 않았다.

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| owner 공개 카드 설정 | 저장 없음, dark/en 고정 | versioned `cardStyle` light/dark + `cardLocale` en/ko 원자적 저장 |
| materialized PNG 변형 | locale 2개 기반 dark publication | dark/light × en/ko 4개 representation |
| 공개 stable object | dark stable 1개 | dark authority 1개 + 검증된 light stable 1개 |
| D1 migration allowlist | `0001`~`0003` | `0001`~`0005` |
| 대표 공유 URL | query 없는 dark URL | 저장된 theme·locale 명시 URL, 기존 query 없는 dark URL 병행 |
| 전체 Node 검증 | Task 시작 전 기준 없음 | 607건 중 601 pass, 0 fail, 환경 의존 6 skip |
| 전체 브라우저 E2E | Task 시작 전 기준 없음 | Playwright 65/65 pass |
| 변경 규모 | 해당 없음 | 84 files, +5,330 / -674 lines |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| owner 설정이 durable store와 API에서 canonical하게 저장·복원된다 | OK — memory/file/D1 real-workerd 및 store/API contract 통과 |
| 공개 media가 네 변형을 같은 publication authority 아래 fail-closed로 제공한다 | OK — publication, R2/S3-compatible contract, partial failure·concurrency 검증 통과 |
| query 없는 기존 URL은 dark와 cache/ETag 계약을 유지한다 | OK — v3 legacy reader, v4 dark authority, GET/HEAD/304와 URL regression 통과 |
| private/unpublished 변형은 404, provider 장애는 generic 503이다 | OK — HTTP/media contract와 E2E 통과 |
| Profile 설정·미리보기·저장·공유가 일관되고 접근 가능하다 | OK — keyboard/mobile/reduced-motion 포함 Playwright 65건 통과 |
| cleanup·maintenance가 digest/count 불일치에서 삭제 없이 중단한다 | OK — exact plan, authority recheck, export/restore/repair 검증 통과 |
| production artifact가 다섯 migration과 필수 binding만 포함한다 | OK — 두 verifier 모두 `ok: true`, secret·credential·local path 검사 통과 |
| PR 준비 상태가 clean하다 | OK — production build, `git diff --check`, clean worktree 확인 |

### 단계별 검증 결과

- Stage 1: [task_m100_74_stage1.md](../working/task_m100_74_stage1.md) — owner 설정·migration·API 108건 중 106 pass, 환경 의존 2 skip.
- Stage 2: [task_m100_74_stage2.md](../working/task_m100_74_stage2.md) — media theme identity와 authority serving 87건 중 86 pass, 0 fail.
- Stage 3: [task_m100_74_stage3.md](../working/task_m100_74_stage3.md) — publication·maintenance·cleanup, media 67건 중 65 pass와 gated 2 skip.
- Stage 4: [task_m100_74_stage4.md](../working/task_m100_74_stage4.md) — Profile 설정·저장 UI Node 92 pass, Playwright 2 pass, build 통과.
- Stage 4.1: 저장 전 공유가 설정을 먼저 저장하고 실패 시 Share Studio를 열지 않는 UX 보정과 E2E를 추가했다.
- Stage 5: [task_m100_74_stage5.md](../working/task_m100_74_stage5.md) — 선택 URL·Share Studio·공개 카드 Node 58건, Playwright 10건 통과.
- Stage 6: [task_m100_74_stage6.md](../working/task_m100_74_stage6.md) — 전체 Node 601 pass, Playwright 65 pass, production build와 두 artifact verifier 통과.

## 잔여 위험과 후속 작업

### 잔여 위험

- `TEST_DATABASE_URL`이 없어 PostgreSQL seed, concurrency/failure injection, migration up/down/up, adapter, media concurrency 5건은 최종 전체 검증에서 skip됐다.
- `TEST_S3_*`가 없어 원격 S3 integration 1건은 skip됐다. 같은 계약의 memory, file, real-workerd D1, local Miniflare와 fake S3 contract는 통과했다.
- 실제 production D1 migration, Sites saved version 배포, R2 네 변형 생성과 공개 smoke는 수행하지 않았다. 별도 Gate에서 export→migrate→deploy→smoke→rollback 순서를 승인받아야 한다.
- 이전 saved version rollback은 additive schema와 보존된 query 없는 dark stable object를 전제로 하므로 원격 배포 전후 exact smoke가 필요하다.

### 후속 작업 후보

- [#39](https://github.com/postmelee/codex-usage-profile/issues/39) — versioned preset registry에 Rotate/Pulse preview와 bounded animated GIF/WebP pre-generation을 additive format으로 구현한다. 현재 PNG URL과 Share Studio는 필수 fallback으로 유지한다.
- production 배포 Gate — gated PostgreSQL/S3 검증, D1 migration `0001`~`0005`, Sites candidate 배포와 네 PNG 원격 smoke를 실행한다.

## 작업지시자 승인 요청

- 최종 보고서와 수용 기준 검증 결과를 승인하면 `publish/task74` 원격 push와 `devel` 대상 PR 게시 절차로 진행한다.
- 이 승인은 production migration·배포·공개 전환을 포함하지 않는다.
