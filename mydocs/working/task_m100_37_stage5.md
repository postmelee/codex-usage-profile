# Task M100 #37 Stage 5 보고서

GitHub Issue: [#37](https://github.com/postmelee/codex-usage-profile/issues/37)
구현계획서: [`task_m100_37_impl.md`](../plans/task_m100_37_impl.md)
Stage: 5

## 단계 목적

Cloud Run을 제품의 단일 canonical runtime으로 우선 검증하고, Sites marketing mirror가 sample-only 정적 산출물과 Cloud Run root CTA만 제공하는지 통합 검증한다. 두 호스트의 공용 landing UI가 desktop/mobile에서 같은 시각 계약을 유지하는지 확인하고, 어느 한쪽 프로세스의 종료가 다른 쪽 가용성에 영향을 주지 않는 경계를 고정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `scripts/smoke-hosting-matrix.mjs` | Cloud Run 기동 전후와 Sites 실행 중 health/API/frontend 독립성, CTA origin, 비밀값 비노출을 검증하는 로컬 hosting matrix smoke를 추가했다. |
| `tests/profile-ui.spec.js` | 제품 Home과 Sites mirror의 desktop/mobile 시각 지표 일치, mobile CTA 크기와 hero 하단 여백을 회귀 검증한다. |
| `src/profile-marketing/MarketingLanding.jsx` | Sites CTA에 전용 스타일 식별자를 추가했다. |
| `src/styles.css` | mobile CTA를 desktop과 같은 고정 크기로 유지하고 hero 하단 여백을 안정화했다. |
| `docs/production-hosting.md` | Stage 5 로컬 검증 범위와 원격 배포 미검증 경계를 기록했다. |
| `package.json` | hosting matrix smoke 실행 명령을 등록했다. |
| `mydocs/orders/20260721.md` | Stage 5 완료와 최종 보고/PR 승인 대기 상태를 반영했다. |

## 본문 변경 정도 / 본문 무손실 여부

제품 API, account/session, 카드 데이터 계약은 변경하지 않았다. Cloud Run과 Sites의 기존 구현을 통합 검증하는 스크립트와 회귀 테스트를 추가했고, 공유 landing의 mobile CTA 크기와 hero 여백만 작업지시자의 시각 승인 결과에 맞춰 조정했다.

## 검증 결과

실행 명령:

```bash
npm test
npm run build:cloud-run
docker build -t codex-usage-profile:task37 .
node scripts/smoke-cloud-run-container.mjs codex-usage-profile:task37
npm run build:sites
node scripts/verify-marketing-artifact.mjs
node scripts/smoke-hosting-matrix.mjs
npm run test:e2e
git diff --check
```

결과:

- `npm test`: 305개 통과, 실패 0개.
- `npm run build:cloud-run`: 38개 모듈 production build 통과.
- Docker image build와 container smoke 통과. 실제 컨테이너의 health, frontend, anonymous API 응답을 확인했다.
- `npm run build:sites`: 22개 모듈 marketing build 통과.
- marketing artifact verifier: sample-only 파일 6개와 비밀값·계정 데이터 부재 확인.
- hosting matrix smoke: Sites 실행 전·중·종료 후 Cloud Run 정상 동작, 별도 origin CTA와 API 비노출 확인.
- `npm run test:e2e`: desktop/mobile 및 제품/Sites 회귀 15개 통과.
- `git diff --check`: 통과.
- 로컬 제품 앱과 Sites preview의 desktop/mobile 화면을 직접 비교했고, mobile CTA를 desktop과 같은 크기로 유지하며 hero 하단 여백을 고정한 최종 화면을 작업지시자가 승인했다.

## 잔여 위험

- 실제 Cloud Run, Neon, R2, Sites 원격 리소스를 생성하거나 배포하지 않았다.
- Neon 영속 store와 R2 media adapter, schema migration, multi-instance concurrency는 구현하지 않았다.
- production secret 주입, custom domain, observability, alerting, abuse protection은 검증하지 않았다.
- 현재 hosting matrix는 로컬 POC 검증이며 production readiness 선언이 아니다.

## 다음 단계 영향

- Stage 5는 구현계획서의 마지막 구현 단계다.
- 다음 절차는 최종 보고서 작성, 전체 변경 최종 검증, `publish/task37` 게시와 PR 생성이다.
- 실제 provider 배포와 Neon/R2 구현은 별도 이슈에서 진행해야 한다.

## 승인 요청

- Stage 5 산출물과 검증 결과를 승인하면 Task #37 최종 보고와 PR 게시 절차로 진행한다.
