# Task M100 #37 Stage 4 보고서

GitHub Issue: [#37](https://github.com/postmelee/codex-usage-profile/issues/37)
구현계획서: [`task_m100_37_impl.md`](../plans/task_m100_37_impl.md)
Stage: 4

## 단계 목적

Cloud Run 제품 runtime과 분리된 Sites marketing mirror POC를 만든다. Sites artifact는 sample card, Hero, Quickstart와 Cloud Run 이동 CTA만 제공하며 account, API, session, 사용자별 route, provider credential과 durable storage를 포함하지 않는다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `.openai/hosting.json` | D1/R2 binding을 비활성화한 Sites hosting manifest 추가 |
| `sites.html` | sample-only marketing mirror 전용 Vite entry 추가 |
| `build/sites-vite-plugin.js` | Sites client/Worker/manifest와 허용된 sample asset만 조립하는 build plugin 추가 |
| `src/profile-marketing/sites-config.js` | Cloud Run canonical CTA와 Sites public environment allowlist 검증 구현 |
| `src/profile-marketing/sites-worker.js` | static asset 제공과 GET/HEAD shell fallback만 담당하는 Worker-compatible ESM 구현 |
| `src/profile-marketing/sites-entry.jsx` | Sites 전용 config를 사용하도록 marketing entry 연결 |
| `src/profile-marketing/__tests__/sites-config.test.js` | manifest, public env, CTA와 Worker fallback 계약 테스트 추가 |
| `vite.sites.config.js` | `dist-sites` 독립 output과 명시적 sample asset build 경계 구성 |
| `scripts/verify-marketing-artifact.mjs` | server/API/account/session/secret/runtime usage와 사용자 fixture 유입 차단 강화 |
| `tests/profile-ui.spec.js` | API 요청 부재, CTA, desktop/mobile layout과 privacy 경계 E2E 추가 |
| `package.json` | Sites build/preview script와 marketing build alias 정리 |
| `.gitignore`, `.dockerignore` | Sites 독립 build output 제외 |

## 본문 변경 정도 / 본문 무손실 여부

기존 Cloud Run 제품 화면과 backend 동작은 변경하지 않았다. Stage 1에서 분리한 공용 marketing component와 CSS를 그대로 사용하고, Sites는 product router나 account loader를 포함하지 않는 별도 entry와 output으로 구성했다. 신규 dependency가 없어 `package-lock.json`은 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-marketing/__tests__/sites-config.test.js src/profile-marketing/__tests__/marketing-config.test.js
npm run build:sites
node scripts/verify-marketing-artifact.mjs
npm run test:e2e -- --grep "Marketing|Home"
git diff --check
```

결과:

- OK: Sites/marketing config와 Worker 계약 테스트 11개 통과
- OK: Vite 8 Sites production build 통과, client/Worker/manifest를 `dist-sites`에 생성
- OK: verifier가 허용된 sample-only Sites 파일 6개만 확인
- OK: Marketing/Home Playwright E2E 10개 통과
- OK: marketing mirror가 `/api/**` 요청 없이 sample card와 Quickstart를 렌더링함
- OK: CTA가 token, OAuth state와 사용자 식별자 없이 configured Cloud Run root로 이동함
- OK: 1280x900과 390x844에서 overflow, clipping과 mobile tilt 비활성화 확인
- OK: 브라우저 console warning/error 없음
- OK: 작업지시자가 `http://127.0.0.1:4174/` production preview를 직접 확인하고 시각 승인함
- OK: `git diff --check` 통과

## 잔여 위험

- 실제 Sites project 생성, remote publish, event submission URL과 access level은 검증하지 않았다.
- production Sites CTA에는 `VITE_CANONICAL_APP_URL`로 실제 Cloud Run HTTPS origin을 주입해야 한다. 값이 없으면 production CTA는 의도적으로 비활성화된다.
- Sites runtime과 hosting 계약은 현재 public beta 동작 및 정책 변경 영향을 받을 수 있다.
- Sites는 제품 backend의 가용성, 인증, 제출, publish/share 또는 사용자 card 제공을 대체하지 않는다.
- Neon/R2 실제 adapter와 Cloud Run remote production deployment는 이 단계 범위가 아니다.

## 다음 단계 영향

- Stage 5에서는 Cloud Run canonical product를 먼저 full test/build/container smoke하고, Sites artifact를 별도 비차단 경로로 검증해야 한다.
- marketing mirror 비교 시 account/product action을 제외하고 동일 sample fixture의 Hero, card ratio, Quickstart와 CTA만 비교한다.
- remote resource 또는 Sites publish가 필요하면 별도 승인을 받은 뒤 local 결과와 구분해 기록한다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 Stage 5로 진행한다.
