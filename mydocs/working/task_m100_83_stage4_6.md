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

원격 owner-only 재배포 및 hosted smoke:

- saved version 23은 exact source
  `c030339d848f961c54358d9d3523b340bed09670`, archive 29파일·6,256,640 bytes로
  저장하고 private deployment가 `succeeded`임을 확인했다.
- current Site는 custom owner-only access revision 56을 유지하고 latest saved
  version이 23임을 다시 조회했다.
- protected owner profile의 identity, stats, activity, card 네 영역은 모두
  `profile-content-enter`, duration `0.36s`, delay `0s`, transform `none`, 최종
  opacity `1`이었다.
- owner card와 공유 dialog의 image는 complete 상태와 1497x918 intrinsic size를
  유지했고, inactive Skeleton은 opacity `0`·animation `none`이었다.
- direct share document는 query를 제외한 canonical, `summary_large_image`, versioned
  social image를 선언했고 intro dialog의 card도 complete·ready 상태로 나타났다.

전체 Node 검증의 real-workerd D1 fixture는 localhost listen이 허용된 검증 환경에서
실행했다. Playwright package browser revision 대신 설치된 Chrome을 사용했고, 다른 로컬
앱의 5173 포트와 충돌하지 않도록 same-origin fixture URL만 5178로 바꾼 임시 테스트 사본을
사용했다. 제품 코드와 assertion은 바꾸지 않았고 임시 사본은 검증 직후 삭제했다.

## 잔여 위험

- public access 전환과 X·Threads·카카오톡 최종 실측은 Task #84 Gate C 범위이며 이번
  단계에 포함하지 않는다.
- 외부 SNS scraper의 장기 cache와 투명 PNG 합성 색은 provider가 결정하므로 application
  source만으로 보장하지 않는다.

## 다음 단계 영향

- version 23 owner-only hosted smoke까지 통과했으므로 최종 보고서와
  `publish/task83` PR 게시 절차를 진행한다.
- #84는 Task #83 PR merge·cleanup 뒤 version 23 exact source를 선행 증적으로 사용해
  `devel → main`, Gate C public 전환과 최종 SNS 실측을 수행한다.

## 승인 요청

- 작업지시자의 로컬 preview 확인과 배포·마무리 지시를 반영해 Stage 4.6 owner-only
  배포·hosted smoke를 완료했고 Task #83 최종 보고 절차로 진입한다.
