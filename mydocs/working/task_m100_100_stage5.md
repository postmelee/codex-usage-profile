# Task #100 Stage 5 완료 보고서 — canonical README card 통합 검증과 문서 handoff

GitHub Issue: [#100](https://github.com/postmelee/codex-usage-profile/issues/100)
구현계획서: [`task_m100_100_impl.md`](../plans/task_m100_100_impl.md)
Stage: 5

## 단계 목적

README 카드의 공개 진실 원천을 query 없는 `publicCardUrl` 하나로 문서화하고,
저장된 테마·언어와 사용량 변경이 같은 URL의 이미지에 반영되는 전체 계약을
unit, E2E, production artifact와 local full-stack smoke로 통합 검증한다. 실제
배포 전 로컬 검증 범위에서 #102와 #104가 merge된 최신 `devel`을 반영하고,
#100 merge 뒤 Gate C가 이어받을 운영 확인 항목을 확정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `README.md` | README에는 query 없는 canonical URL 하나만 유지하고 설정·사용량 변경 시 같은 URL의 이미지가 갱신됨을 명시 |
| `docs/readme-card.md` | canonical·explicit URL 책임, additive v4 metadata, legacy fallback, settings commit·exact retry, D1-free public read 계약 기록 |
| `docs/production-hosting.md` | card/social publication id 정합성, partial/invalid fail-close, settings commit 순서와 이전 v4 reader rollback 호환성 기록 |
| `docs/sites-operations.md` | 배포 전후 queryless PNG·cache·ETag·대표 이미지, explicit variant, social authority, cleanup dry-run Gate와 rollback 절차 보강 |
| `scripts/smoke-sites-fullstack-local.mjs` | 같은 queryless URL에서 설정 변경과 사용량 재제출 뒤 PNG SHA-256·ETag가 각각 갱신되는 실제 Worker 흐름 추가 |
| `src/profile-runtime/sites/__tests__/full-stack.test.js` | smoke가 canonical update 2회와 총 62개 route를 검증하는지 고정 |
| `tests/profile-ui.spec.js` | Stage 4에서 추가한 이미지 복사 E2E assertion을 실제 영문 카탈로그 `Copied image`와 일치하도록 최소 보정 |
| `mydocs/orders/20260813.md` | Task #100을 Stage 5 완료·최종 보고서와 PR 게시 승인 대기로 갱신 |
| `mydocs/working/task_m100_100_stage5.md` | Stage 5 구현·검증·잔여 위험과 Task #84 handoff 기록 |

## 본문 변경 정도 / 본문 무손실 여부

README와 세 운영·사용자 문서는 기존 endpoint, cache, publication, 배포 절차를
유지하면서 Task #100의 canonical 대표 선택 계약만 필요한 위치에 추가·교체했다.
기존 explicit variant, private `404`, social fallback, owner-only 운영과 rollback
본문은 삭제하지 않았다. 제품 소스 동작은 바꾸지 않았고, E2E 검증에서 발견한
Stage 4 assertion의 영문 순서만 실제 메시지 카탈로그와 맞췄다.

## 검증 결과

실행 명령:

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run smoke:sites-fullstack:local
npm run cleanup:card-media -- --help
git diff --check
git status --short
```

결과:

- OK — #102와 #104가 merge된 `origin/devel` `01a8199`를 기준으로 Task #100을
  rebase했다. Share Studio의 #102 모바일 대상·X/Threads URL 변경과 #100의
  canonical/selected URL 분리를 함께 유지하고, #104의 Home/Profile 최근 업데이트
  표시를 보존했다.
- OK — Node test 800건 중 794건 통과, 실패 0, 환경 조건에 따른 skip 6건.
- OK — Playwright E2E 100건 전부 통과. Task #100 queryless canonical URL,
  #102 모바일 Share Studio, #104 최근 업데이트 슬롯을 같은 실행에서 검증했다.
- OK — production Sites full-stack build가 server/client artifact를 생성하고
  Vite manifest를 제거했다.
- OK — full-stack verifier가 hosted 모드, client 8개, Worker 2개, migration
  5개를 승인했다.
- OK — production verifier가 artifact 5,143,802 bytes, required binding 3개,
  migration 5개와 Worker 크기 제한을 승인했다.
- OK — local full-stack smoke가 62개 route, canonical update 2회,
  85,362-byte public PNG와 cold/publish/warm render를 한 Worker 런타임에서
  검증했다. publish 직후 queryless URL의 PNG·cache·ETag를 저장한 뒤 light/ko
  설정 저장과 새 사용량 재제출을 순서대로 실행했고, 두 번 모두 같은 URL의
  PNG SHA-256·ETag 변경, 이전 ETag 요청의 `200`, 현재 ETag 요청의 `304`, explicit
  light/ko 및 selector가 아닌 `v` query와의 bytes 일치를 확인했다.
- OK — cleanup CLI는 기본 dry-run, 90일 경과, owner/theme/locale별 최신 5개
  revision 보호와 `--apply` 삭제 직전 stable metadata 재검사를 안내했다. 삭제는
  실행하지 않았다.
- OK — `git diff --check` 통과. 검증용 의존성 symlink를 제거하고 기존 worktree
  `node_modules`를 복원한 뒤 Stage 5 보고서 갱신 외 작업 트리는 깨끗하다.

검증 환경 메모:

- Node·E2E·full-stack smoke는 로컬 프로세스와 workerd 포트를 허용한 범위에서
  직렬 실행했다. 리베이스 뒤 전체 검증은 단일 최종 코드 상태에서 완주했다.
- 기존 `.openai/hosting.json` project와 storage linkage를 보존한 채 build와
  local smoke만 수행했다. Stage 5 범위에 따라 Sites 배포, access 변경, 원격
  migration과 원격 cleanup은 실행하지 않았다.

## 잔여 위험

- production origin의 CDN·GitHub Camo 재검증 지연과 실제 R2/D1 상태는 로컬
  검증으로 대체할 수 없다. 실제 배포와 Gate C에서 같은 URL의 ETag·bytes 변경을
  다시 확인해야 한다.
- additive v4 metadata의 이전 reader 호환은 코드·artifact 계약으로 검증했지만,
  실제 saved version rollback은 별도 운영 승인 없이는 실행하지 않는다.

## 다음 단계 영향

- Task #84 worktree는 변경하지 않았다. #100 merge 뒤 #84가 최신 `devel`을
  반영하고 Gate C에서 queryless canonical URL의 content type, cache policy,
  ETag와 저장된 theme·locale bytes를 확인한다.
- 같은 Gate에서 설정 변경과 사용량 제출 뒤 URL은 유지되고 ETag·bytes만 갱신되는지,
  explicit dark/light × en/ko 하위 호환, card/social owner·publication id 정합성,
  cleanup dry-run 무삭제를 함께 확인한다.
- Stage 5 승인 뒤 `task-final-report` 절차로 최종 보고서, 최종 커밋,
  `publish/task100` push와 `devel` 대상 PR 게시를 진행한다.

## 승인 요청

- Stage 5 산출물과 검증 결과를 승인하면 최종 보고서와 PR 게시 단계로 진행한다.
