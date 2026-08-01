# Task M100 #61 Stage 1 완료 보고서

GitHub Issue: [#61](https://github.com/postmelee/codex-usage-profile/issues/61)
구현계획서: [`task_m100_61_impl.md`](../plans/task_m100_61_impl.md)
Stage: 1

## 단계 목적

기존 `ProfileShell`의 topbar를 route별 제목 영역이 아닌 공통 제품 header로
정렬하고, 인증된 계정 menu에서 owner Profile에 직접 진입할 수 있도록 했다.
pointer와 keyboard 사용자가 같은 menu 순서와 focus 이동을 사용할 수 있게
하면서 기존 Home, Settings, logout과 인증 상태 계약은 유지했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/ProfileShell.jsx` | 모든 제품 route의 topbar brand를 `Codex Usage` Home link로 통일하고 중복 Home navigation 제거, 기존 route heading은 main의 임시 sr-only `h1`으로 보존 |
| `src/profile-ui/AccountMenu.jsx` | `Profile` menuitem 추가, Profile→Settings→Log out 순서와 open focus·방향키·Home/End·Escape·blur focus 계약 구현 |
| `src/styles.css` | 공통 brand link의 색상·장식·focus style 정렬, 제거된 중복 navigation style 삭제 |
| `tests/profile-ui.spec.js` | menu 순서·href·keyboard 순환·Escape 복원·Tab 이탈·외부 pointer 닫기와 비-Home brand 회귀 검증 |
| `mydocs/orders/20260802.md` | 날짜 전환 후 Task #61 Stage 1 완료·Stage 2 승인 대기 상태 기록 |
| `mydocs/working/task_m100_61_stage1.md` | Stage 1 구현·검증·잔여 위험 기록 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당하지 않는다. 공개 route,
app-owned GitHub OAuth, session, logout API, Settings href와 Home의 Share/card
동작은 변경하지 않았다. `ProfileShell`의 기존 `title`과 `pageHeading` prop은
Stage 2 전환 중인 owner/public Profile과 Settings의 heading 접근성을 유지하기
위해 main content의 sr-only `h1`으로 호환 보존했다.

계정 menu는 기존 `role=menu/menuitem`, `aria-expanded`와 logout error 상태를
유지한다. 새 `Profile` link는 `/profile`만 가리키며 auth 또는 API request를
추가하지 않는다. `.openai/hosting.json`, dependency manifest와 backend/runtime
파일은 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
npm run test:e2e -- --grep "account menu|Home stays readable|uses document scrolling"
npm run build
git diff --check
git diff origin/devel -- .openai/hosting.json
```

결과:

- OK — focused Playwright 3건 통과, 실패·skip 0건
- OK — mobile Home의 header 높이, brand/account/action Tab 순서와 horizontal
  overflow 없음 유지
- OK — account menu가 `Profile` → `Settings` → `Log out` 순서와 exact href를
  제공하고 open 시 첫 항목으로 focus
- OK — ArrowDown·ArrowUp 순환, Home·End 이동, Escape trigger focus 복원,
  Tab native 이탈과 외부 pointer 닫기 통과
- OK — Home과 기존 framed app surface에서 `Codex Usage` brand Home link와
  기존 scroll 동작 유지
- OK — Vite production client build 성공, 42 modules transformed
- OK — `git diff --check` 경고 없음
- OK — `.openai/hosting.json` diff 빈 출력; Sites linkage 무변경

초기 sandbox 내부 Playwright 실행은 local test server bind가 허용되지 않아
중단되었고, 동일 worktree와 의존성에서 local bind 권한으로 재실행해 위 3건이
모두 통과했다. 실패 또는 skip 상태로 남긴 검증은 없다.

## 잔여 위험

- owner/public Profile과 Settings는 Stage 2 전까지 기존 framed canvas를
  유지한다. 공통 brand만 먼저 적용했으며 fullscreen document scroll과 실제
  visual `h1` 정렬은 아직 완료하지 않았다.
- 현재 non-Home route의 page heading은 호환용 sr-only `h1`이다. Stage 2에서
  상태별 실제 content heading을 `h1`으로 올린 뒤 `ProfileShell`의 임시 heading
  책임을 제거해야 한다.
- dependency manifest를 변경하지 않았지만 clean install의 기존 lockfile
  audit에서 8건(낮음 1, 높음 7)이 보고되었다. 이번 UI Stage의 변경으로
  유입된 항목은 아니며 별도 dependency 보안 검토 범위다.
- production Sites save/deploy/access와 원격 데이터 작업은 수행하지 않았다.

## 다음 단계 영향

- Stage 2는 Stage 1의 `Codex Usage` brand link와 AccountMenu keyboard 계약을
  유지한 채 owner/public Profile과 Settings만 fullscreen canvas로 전환한다.
- `CardProfilePage`, `PublicProfilePage`, `SettingsPage`가 각각 상태별 단일
  visual `h1`을 소유하도록 바꾼 뒤 호환용 `ProfileShell.pageHeading`을 더 이상
  사용하지 않도록 정리한다.
- 기존 card/visibility/Share와 Settings account/token/device mutation은
  layout 변경과 분리해 그대로 보존한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 Profile·Settings page canvas
  정렬로 진행한다.
