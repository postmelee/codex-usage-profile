# Task M100 #37 Stage 1 완료보고서

GitHub Issue: [#37](https://github.com/postmelee/codex-usage-profile/issues/37)
구현계획서: [`task_m100_37_impl.md`](../plans/task_m100_37_impl.md)
Stage: 1

## 단계 목적

Cloud Run 제품 runtime이 사용할 배포 설정 계약을 순수 parser로 분리하고, 제품 Home과 optional marketing mirror가 공유할 수 있는 marketing component 경계를 만든다. 동시에 marketing 전용 bundle이 backend, account, native renderer와 secret 설정을 포함하지 않는지 자동 검사할 수 있는 Stage 1 artifact를 마련한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `.gitignore` | 독립 marketing 빌드 산출물 `dist-marketing/` 제외 |
| `package.json` | Cloud Run 및 marketing build 책임을 분리한 script 추가 |
| `src/profile-runtime/deployment-config.js` | host, port, canonical origin, runtime/store mode 검증과 production file-store fail-closed 계약 추가 |
| `src/profile-runtime/__tests__/deployment-config.test.js` | development, Cloud Run production, invalid origin/port/host/mode 8개 시나리오 검증 |
| `src/profile-runtime/config.js` | deployment config loader 공개 |
| `src/profile-marketing/marketing-config.js` | sample card, CTA, Quickstart, 다국어 copy 입력을 실제 account 상태와 분리 |
| `src/profile-marketing/__tests__/marketing-config.test.js` | app URL 보안, fallback, localized copy와 fixture 독립성 5개 시나리오 검증 |
| `src/profile-marketing/MarketingLanding.jsx` | Hero, card preview, Quickstart와 Cloud Run CTA를 공유 가능한 presentational component로 추출 |
| `src/profile-marketing/sites-entry.jsx` | product router 없이 marketing component만 렌더링하는 browser entry 추가 |
| `src/profile-ui/HomePage.jsx` | 기존 account/profile/share 상태를 product slot으로 유지하며 shared marketing layout 합성 |
| `src/profile-ui/homeOnboarding.js` | 기존 Home Quickstart 상수를 marketing config의 호환 re-export로 전환 |
| `vite.sites.config.js` | backend와 분리된 marketing entry bundle 설정 |
| `scripts/verify-marketing-artifact.mjs` | server/native/account/API/secret 문자열 유입 차단 검사 추가 |

신규 구현은 총 836줄이다. `HomePage.jsx`와 `homeOnboarding.js`는 중복 presentation 및 상수를 제거해 기존 본문을 208줄 줄였고, product 상태 처리와 share 동작은 유지했다.

## 본문 변경 정도 / 본문 무손실 여부

- 기존 Home의 API 요청, account 상태, publish/private 변경, share dialog와 personalized sample 처리는 `HomePage`에 그대로 남겼다.
- Hero, card animation, Quickstart DOM과 CSS class는 shared marketing component로 이동했으며 의도적인 시각 변경은 없다.
- 기존 `HOME_SUBMIT_COMMAND`, `HOME_QUICKSTART_STEPS` import 계약은 compatibility re-export로 보존했다.
- 작업지시자가 `http://127.0.0.1:5173`의 API 포함 runtime을 직접 확인하고 기존 화면과 동일함을 승인했다.

## 검증 결과

구현계획서의 Stage 1 명령:

```bash
node --test src/profile-runtime/__tests__/deployment-config.test.js src/profile-marketing/__tests__/marketing-config.test.js
npm run build
npm run build:marketing
node scripts/verify-marketing-artifact.mjs
git diff --check
```

결과:

- OK: focused Node test 13개 통과, 실패 0개.
- OK: product Vite build 38 modules, marketing Vite build 19 modules 성공.
- OK: marketing artifact의 inspectable browser file 3개에서 server/native/account/API/secret 금지 패턴이 발견되지 않음.
- OK: `git diff --check` 통과.

추가 검증:

```bash
npm test
npm exec playwright test -- --config /private/tmp/task37-playwright.config.mjs tests/profile-ui.spec.js
```

- OK: 전체 Node test 285개 통과, 실패 0개.
- OK: Home/share/public profile Playwright E2E 13개 통과, 실패 0개.
- OK: desktop, mobile, short viewport screenshot 생성 및 작업지시자 직접 시각 승인 완료.

## 잔여 위험

- Stage 1의 marketing build는 dependency boundary 검사용 browser bundle이다. Sites manifest, hosting plugin, HTML/Worker-compatible output과 실제 preview는 Stage 4에서 검증한다.
- 실행 가능한 production `start` script는 Vite middleware 없는 production server가 아직 없으므로 Stage 2에서 server와 함께 추가한다. 현재 `build:cloud-run`은 product static artifact만 생성한다.
- production mode는 file store를 거부하지만 external store 구현은 아직 연결하지 않았다. provider adapter 경계는 Stage 3 범위다.

## 다음 단계 영향

- Stage 2 production server는 `loadProfileDeploymentConfig`를 startup 전에 호출하고 `PORT`, `0.0.0.0`, production HTTPS와 external store 요구를 적용해야 한다.
- `start` script는 Stage 2 production server가 health/static/API/PNG/SIGTERM smoke를 통과한 뒤 연결한다.
- Cloud Run product build는 `npm run build:cloud-run`, optional marketing mirror bundle은 `npm run build:marketing`으로 계속 분리한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 Cloud Run container POC로 진행한다.
