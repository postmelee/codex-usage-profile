# Task #83 Stage 4.5 완료 보고서 — 프로필 loading/ready 전환 정합화

GitHub Issue: [#83](https://github.com/postmelee/codex-usage-profile/issues/83)
구현계획서: [`task_m100_83_impl.md`](../plans/task_m100_83_impl.md)
Stage: 4.5

## 단계 목적

Stage 4.4 owner-only saved version 직접 확인에서 공유 카드 깜빡임 제거는 승인됐지만,
공통 profile Skeleton과 ready profile의 내부 box 높이가 달라 아래 section일수록 위치가
어긋나는 회귀를 확인했다. Stage 4.5는 loading placeholder를 실제 profile의 identity,
stats, heatmap, card section 구조와 정렬하고, 데이터 준비 뒤 정보가 갑자기 나타나지
않도록 짧은 content reveal을 추가하는 단계다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/ProfileLoadingSkeleton.jsx` | 통계 value/label, heatmap month label, card heading을 포함한 ready-equivalent 중립 Skeleton 구조 추가 |
| `src/profile-ui/CardProfilePage.jsx` | 소유자 ready profile에 content reveal stage 계약 적용 |
| `src/profile-ui/PublicProfilePage.jsx` | 공개·private preview ready profile에 같은 content reveal stage 계약 적용 |
| `src/styles.css` | 실제 line box·divider·52×7 heatmap sizing·month/option·card heading 간격 정렬과 0/40/80/120ms reveal, reduced-motion 즉시 상태 추가 |
| `tests/profile-ui.spec.js` | loading/ready 주요 bounding box 2px 허용 오차, reveal timing·최종 상태와 reduced-motion 회귀 검증 추가 |
| `mydocs/plans/task_m100_83.md`, `mydocs/plans/task_m100_83_impl.md` | Stage 4.5 발견 근거, 범위, 문서 위치, 구현·검증·중단 경계 기록 |
| `mydocs/orders/20260811.md` | Stage 4.5 version 22 owner-only 배포·hosted smoke와 사용자 직접 확인 대기 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

코드 변경 단계이므로 문서 본문 무손실 여부는 해당하지 않는다. loading DOM은 실제
identity·usage를 포함하지 않고 기존 접근성 heading을 유지한다. profile API 호출,
owner/public card resource key와 readiness/cache, media URL·ETag, D1/R2 publication,
Sites access와 공유 motion 계약은 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
npx playwright test -c /private/tmp/task83-playwright-stage45.config.js --grep "loading geometry matches|moves from a neutral loading|content reveal settles"
npm test -- --test-concurrency=1
npx playwright test -c /private/tmp/task83-playwright-stage45.config.js
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

결과:

- 집중 Playwright E2E: 3/3 통과
- 전체 Node 검증: 726개 중 720개 통과, 6개 환경 조건 skip, 실패 0
- 전체 Playwright E2E: 74/74 통과
- geometry: avatar, name, handle, stats, activity, heatmap grid, option, card section top,
  card heading과 preview top/height가 loading/ready 사이 2px 이내로 일치
- reveal: identity→stats→activity→card에 `profile-content-enter` 360ms와
  `0/40/80/120ms` delay 적용, 520ms 뒤 opacity `1`·translation `0` 확인
- reduced motion: 네 content unit의 animation-name `none`, opacity `1`, transform `none`
- identity-free loading: 실제 profile identity 비노출, stat 5개·activity 7행·month/option·
  card-local Skeleton 유지
- 생산 빌드: server 60 modules, client 1,828 modules, manifest 제거와 보존 대상 0 확인
- full-stack verifier: client 8, worker 2, migration 5, raw 3,998,349 bytes,
  gzip 2,165,728 bytes, `ok: true`
- production verifier: artifact 6,230,783 bytes, bindings 3, migration 5와 동일 Worker
  크기, `ok: true`
- `git diff --check`: 이상 없음

원격 owner-only 재배포 및 hosted smoke:

- exact source: `0cea83436e5347eb73fcb1ccc221fdbd169ab9ed`
- Sites saved version: 22, archive 6,256,640 bytes / 29 files
- 접근 경계: custom owner 1명, workspace/tenant group 0개, external visitor 0명,
  access revision 56, environment revision 85
- hosted asset: `app-Dz_i5LBA.js`, `index-SEqwN1Iq.css`
- owner profile 진입 직후 공통 Skeleton 1개, ready 뒤 reveal stage 1개 확인
- ready stage: identity, stats, activity, card가 `profile-content-enter` 360ms와
  `0/40/80/120ms` delay를 유지하고 최종 opacity `1`, translation `0`으로 정착
- owner card bitmap 2개가 complete 상태와 유효 natural size를 유지
- Share Studio 재진입 45 frame 동안 image 누락·미완료·숨김 0건, source 변경 0건
- protected `/api/share/postmelee`: `200`, canonical OG/social metadata와 version 22 JS/CSS
  asset 응답 확인

전체 Node 검증의 real-workerd D1 fixture는 localhost listen이 허용된 검증 환경에서
실행했다. Playwright package browser revision 대신 설치된 Chrome channel을 사용했고,
same-origin fixture를 유지하도록 5187 transport의 임시 테스트 사본만 사용했다. 제품
코드와 assertion은 바꾸지 않았고 임시 사본은 검증 직후 삭제했다.

## 잔여 위험

- version 22 owner-only 재배포와 자동 hosted smoke는 완료했다. 실제 화면에서의 Skeleton
  위치와 reveal 지각 품질은 작업지시자 직접 확인 승인이 남아 있다.
- content reveal은 initial ready stage mount에서만 실행한다. 후속 카드 설정·visibility
  저장은 같은 stage DOM을 유지하므로 animation을 다시 시작하지 않는다.
- public access 전환과 X·Threads·카카오톡 실측은 Task #84 Gate C 범위이며 이번 단계에
  포함하지 않는다.

## 다음 단계 영향

- source commit과 saved version 22의 exact SHA 일치를 유지하고 배포 결과는 document-only
  후속 commit으로 기록한다.
- 작업지시자가 version 22의 Skeleton 위치·micro cascade와 공유 무깜빡임을 직접 확인해
  승인한 뒤에만 `task-final-report`를 재개한다.

## 승인 요청

- saved version 22에서 `/?view=profile`의 Skeleton 위치와 ready micro cascade, 공유 버튼
  모달의 무깜빡임을 직접 확인하고 Stage 4.5 owner-only smoke 완료 여부를 승인한다.
