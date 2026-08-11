# Task #83 Stage 4.6 완료 보고서 — 프로필 reveal 공간 이동·stagger 제거

GitHub Issue: [#83](https://github.com/postmelee/codex-usage-profile/issues/83)
구현계획서: [`task_m100_83_impl.md`](../plans/task_m100_83_impl.md)
Stage: 4.6

## 단계 목적

Stage 4.5 owner-only saved version 직접 확인에서 ready content가 6px 아래에서 위로
정착하고 identity, stats, activity, card가 순차적으로 나타나 Skeleton과 ready content의
좌표·전환이 어긋나 보이는 잔여 회귀를 확인했다. Stage 4.6은 loading/ready geometry를
유지하면서 공간 이동과 stagger를 제거해 모든 ready 영역이 같은 위치와 시점에서 opacity로
나타나게 하는 단계다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/styles.css` | profile content reveal의 6px translation과 40/80/120ms delay를 제거하고 전 영역에 동일한 360ms opacity 전환 유지 |
| `tests/profile-ui.spec.js` | owner profile의 active/final transform `none`, 네 영역 delay `0s`, geometry·최종 opacity 계약 검증 |
| `mydocs/plans/task_m100_83.md`, `mydocs/plans/task_m100_83_impl.md` | Stage 4.6 발견 근거, 동시 reveal 범위, 검증·배포 중단 경계 기록 |
| `mydocs/orders/20260811.md` | Stage 4.6 로컬 확인과 owner-only 배포 준비 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

코드 변경 단계이므로 문서 본문 무손실 여부는 해당하지 않는다. profile API와 로딩 상태,
Skeleton markup·geometry, card resource/cache/readiness, 공유 motion, D1/R2 publication,
Sites access 계약은 변경하지 않았다. ready stage에 이미 적용된 opacity animation의 공간
성분과 요소별 delay만 제거했다.

## 검증 결과

실행 명령:

```bash
npx playwright test --grep "loading geometry matches ready content"
npm test -- --test-concurrency=1
npx playwright test
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

결과:

- 집중 Playwright E2E: 1/1 통과
- 작업지시자 로컬 preview 직접 확인: owner profile의 Skeleton 교체 뒤 공간 이동 없음과
  네 영역 동시 reveal 승인
- 전체 Node 검증: 726개 중 720개 통과, 6개 환경 조건 skip, 실패 0
- 전체 Playwright E2E: 74/74 통과
- reveal 실행 중: identity, stats, activity, card 모두 `profile-content-enter` 360ms,
  animation delay `0s`, transform `none`
- reveal 완료 뒤: 네 영역 모두 opacity `1`, transform `none`
- loading/ready 주요 bounding box: 기존 2px 허용 오차 계약 유지
- reduced motion: animation 제거, opacity `1`, transform `none` 즉시 상태 유지
- 생산 빌드: server 60 modules, client 1,828 modules, consumed manifest 제거 확인
- full-stack verifier: client 8, worker 2, migration 5, raw 3,998,349 bytes,
  gzip 2,165,728 bytes, `ok: true`
- production verifier: artifact 6,230,513 bytes, bindings 3, migration 5와 동일 Worker
  크기, `ok: true`
- `git diff --check`: 이상 없음

전체 Node 검증의 real-workerd D1 fixture는 localhost listen이 허용된 검증 환경에서
실행했다. Playwright package browser revision 대신 설치된 Chrome을 사용했고, 다른 로컬
앱의 5173 포트와 충돌하지 않도록 same-origin fixture URL만 5178로 바꾼 임시 테스트 사본을
사용했다. 제품 코드와 assertion은 바꾸지 않았고 임시 사본은 검증 직후 삭제했다.

## 잔여 위험

- 로컬 지각 품질 확인은 승인됐다. exact source owner-only saved version 배포와 hosted
  Skeleton/ready smoke는 이 커밋 다음에 수행한다.
- public access 전환과 X·Threads·카카오톡 실측은 Task #84 Gate C 범위이며 이번 단계에
  포함하지 않는다.

## 다음 단계 영향

- Stage 4.6 커밋을 exact source로 owner-only 재배포하고 protected owner profile에서
  delay `0s`, transform `none`, 최종 opacity `1`을 확인한다.
- hosted smoke 통과 뒤 최종 보고서와 `publish/task83` PR 게시 절차를 재개한다.

## 승인 요청

- 작업지시자가 로컬 preview를 확인하고 배포·마무리를 지시했으므로 Stage 4.6 산출물의
  owner-only 배포 및 Task #83 최종 보고 절차 진입 승인을 반영한다.
