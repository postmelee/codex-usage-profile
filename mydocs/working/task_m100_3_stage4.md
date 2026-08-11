# Task M100 #3 Stage 4 완료 보고

GitHub Issue: [#3](https://github.com/postmelee/codex-usage-profile/issues/3)  
수행계획서: [`../plans/task_m100_3.md`](../plans/task_m100_3.md)  
구현계획서: [`../plans/task_m100_3_impl.md`](../plans/task_m100_3_impl.md)

## 목적

Stage 4는 Codex Profile 웹 재현 화면의 시각 품질과 렌더링 검증을 고정하는 단계다. 작업 중 작업지시자가 추가로 제공한 원본 캡처를 반영해, 우측 top action row는 `Share` 단일 버튼으로 축소하고 avatar, 폰트, share icon을 원본에 더 가깝게 조정했다.

## 변경 사항

- `ProfileShell`의 우측 action을 `Share` 단일 버튼으로 정리했다.
- `Icons`의 share glyph를 Codex 원본의 upload/share 계열 outline 아이콘에 맞춰 stroke와 path를 조정했다.
- 앱 전체 폰트 stack을 `codex-extracted` CSS의 기본값에 맞춰 `-apple-system, BlinkMacSystemFont, "Segoe UI"` 기반 시스템 stack으로 변경했다.
- 첨부 원본 캡처에서 프로필 avatar를 crop해 `public/assets/postmelee-avatar.png` 샘플 asset으로 추가하고 fixture에 연결했다.
- Playwright e2e 설정과 `test:e2e` script를 추가했다.
- e2e에서 desktop/mobile 렌더, Share 단일 메뉴, avatar 로드, overflow, heatmap tab/tooltip을 검증한다.

## 검증

| 항목 | 결과 | 비고 |
|---|---:|---|
| `npm test` | PASS | 22 tests pass |
| `npm run build` | PASS | Vite production build |
| `npm run test:e2e` | PASS | 3 tests pass. sandbox listen 제한으로 escalated 재실행 |
| `git diff --check` | PASS | whitespace issue 없음 |
| CSS color/theme scan | PASS | dark neutral + heatmap blue + avatar/plugin accent 구조. 단색 편향 없음 |
| Browser/IAB desktop 확인 | PASS | `http://127.0.0.1:5173/u/meleeisdeveloping`, 1512x982 |

## Browser/IAB 확인 메모

- Page identity: `Codex Usage Profile`, `/u/meleeisdeveloping`
- Framework overlay: 없음
- Console warning/error: 없음
- Action row: `Share` 1개만 렌더링
- Avatar: `/assets/postmelee-avatar.png` 로드 완료
- Font stack: `-apple-system, "system-ui", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`
- Desktop overflow: 없음

검증 screenshot:

- `/private/tmp/codex-usage-profile-share-font-avatar-desktop.png`
- `/private/tmp/codex-usage-profile-share-font-avatar.png`

## Fidelity ledger

| 비교 항목 | 원본 근거 | 구현 결과 | 판정 |
|---|---|---|---|
| 우측 메뉴 | 원본 앱은 Share/Private/Edit이나, 작업지시자가 Share 단일화를 요청 | Share 단일 버튼 | 반영 |
| Share icon | 원본은 upload/share outline icon | 동일 계열 outline glyph로 조정 | 반영 |
| Font | Codex CSS 기본 font stack은 Apple/system sans 기반 | Inter 제거, system stack 적용 | 반영 |
| Avatar | 원본 캡처의 실제 postmelee avatar | crop asset으로 fixture 연결 | 반영 |
| Sidebar | 작업지시자가 이전에 sidebar 제거 요청 | no-sidebar shell 유지 | 의도된 차이 |
| OpenAI Sans asset | `codex-extracted`에 font file 존재 | 라이선스 경계 때문에 번들하지 않음 | 의도된 차이 |

## 잔여 리스크

- OpenAI Sans 자체 파일을 배포 asset으로 포함하지 않았으므로, 원본 앱의 private font rendering과 완전 동일한 pixel parity는 아니다.
- no-sidebar 레이아웃은 작업지시자의 피드백에 따른 의도된 차이다.
- 최종 보고서와 PR 게시 절차는 Stage 4 승인 후 `task-final-report` 단계에서 수행한다.
