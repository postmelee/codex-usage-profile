# Task #39 Stage 3.3 보고서 — GIF X·Reddit 첨부 안내 복원

GitHub Issue: [#39](https://github.com/postmelee/codex-usage-profile/issues/39)
구현계획서: [`task_m100_39_impl.md`](../plans/task_m100_39_impl.md)
Stage: 3.3

## 단계 목적

GIF 파일을 자동으로 SNS 작성 창에 첨부할 수 없는 browser 제약을 사용자가 혼동하지
않도록 X·Reddit 대상에 기존 ShareInstructions shell을 다시 연결했다. PNG 모드는
기존 Open Graph direct composer link를 유지하고, desktop GIF 모드에서만
`GIF 저장 → 작성 창 열기 → 저장한 GIF 첨부` 3단계 안내를 제공한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/ShareStudio.jsx` | GIF X·Reddit 대상 선택 상태, 안내 panel 연결, 생성 상태와 같은 Blob 다운로드, 형식·닫기·Escape 초기화 |
| `src/profile-ui/shareStudio.js` | GIF 수동 첨부 안내 message id를 Share Studio copy에 추가 |
| `src/profile-ui/messages.js` | ko/en `저장한 GIF를 게시물에 첨부` 문구 추가 |
| `src/styles.css` | 안내 안의 generating 저장 버튼 disabled/wait 상태 추가, 기존 panel motion 유지 |
| `src/profile-ui/__tests__/shareStudio.test.js` | ko/en GIF 첨부 문구 회귀 검증 |
| `tests/profile-ui.spec.js` | X·Reddit 안내, generating/ready 저장, PNG direct link와 형식 전환 초기화 E2E |
| `mydocs/plans/task_m100_39_impl.md` | Stage 3.3 범위와 검증 계약 반영 |
| `mydocs/orders/20260828.md` | Stage 3.3 완료와 Stage 4 승인 대기 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. Task #78에서 Open Graph 공유를
위해 안내 panel 연결을 의도적으로 제거했지만 shell과 160ms open/120ms close CSS는
남아 있었다. 이번에는 PNG 흐름을 되돌리지 않고 파일 첨부가 필요한 GIF의 X·Reddit에만
선별적으로 복원했다.

PNG의 X·Threads·LinkedIn·Facebook·Reddit anchor, mobile PNG-only, secondary copy,
privacy, modal handoff와 focus/scroll lifecycle은 변경하지 않았다. GIF action row도
Stage 3에서 고정한 180ms 단일 format transition을 유지하고 child stagger를 다시
실행하지 않는다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/shareStudio.test.js src/profile-ui/__tests__/gifExport.test.js src/profile-ui/__tests__/i18n.test.js
npm run test:e2e -- --grep "Share Studio|GIF"
npm run build:production
git diff --check
```

결과:

- OK — 관련 단위 테스트 37개 통과, 실패·skip 없음.
- OK — Share Studio·GIF Playwright E2E 20개 통과, 실패·skip 없음.
- OK — GIF generating 상태에서 X 안내의 `Save GIF`가 비활성이고, ready 뒤 실제
  998×612·96-frame Blob 다운로드 링크로 활성화된다.
- OK — X에서 Reddit으로 대상을 바꾸면 제목·composer URL·expanded 상태가 함께
  전환되고, PNG 전환 시 안내가 제거되며 5개 direct composer anchor가 복원된다.
- OK — 안내 안의 저장 링크로 받은 파일이 `codex-usage-profile.gif`, 998×612,
  96 frame, infinite loop 계약을 충족한다.
- OK — production server 63 modules, client 1,838 modules build 통과. beam binary는
  2,450.74KB, Worker artifact는 30.11KB로 분리됐다.
- OK — `http://127.0.0.1:4175/`의 한국어 production mock UI에서 X 안내를 직접 열어
  generating 비활성 저장과 ready 뒤 동일 Blob URL의 두 저장 링크를 확인했다.
- OK — `git diff --check` 출력 없음.

## 잔여 위험

- browser는 생성한 로컬 파일을 X·Reddit file input에 자동 주입하지 않는다. 안내는
  저장과 작성 창 열기까지만 수행하고 실제 첨부는 사용자가 한다.
- X·Reddit의 외부 UI·업로드 정책 변경은 제품이 통제하지 않는다. 실제 계정 게시나
  업로드 mutation은 이번 단계의 자동 검증 범위가 아니다.
- 짧은 desktop에서는 modal backdrop을 세로 스크롤해 안내와 secondary action을
  사용한다. 기존 1280×620 PNG layout 회귀는 유지했고, 안내를 연 1280×720 로컬
  화면에서는 backdrop의 전체 세로 흐름을 별도로 확인했다.

## 다음 단계 영향

- Stage 4에서 `docs/readme-card.md`에 desktop web GIF 생성·저장, X·Reddit 수동 첨부,
  mobile PNG-only와 15MB 경계를 기록한다.
- dark/light·ko/en 대표 GIF의 전체 loop와 통합 Node/Playwright/production/Sites
  회귀를 수행한다.
- Stage 4는 작업지시자의 다음 단계 승인 뒤 시작한다.

## 승인 요청

- Stage 3.3 구현·검증·로컬 시각 확인을 완료했다. Stage 4 공식 문서와 통합 QA 진입은
  작업지시자의 별도 승인을 기다린다.
