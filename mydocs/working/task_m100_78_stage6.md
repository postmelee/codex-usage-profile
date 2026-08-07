# Task #78 Stage 6 보고서 — Share Studio 액션 재구성과 통합 검증

GitHub Issue: [#78](https://github.com/postmelee/codex-usage-profile/issues/78)
구현계획서: [`task_m100_78_impl.md`](../plans/task_m100_78_impl.md)
Stage: 6

## 단계 목적

Share Studio의 공유 수단을 용도 순서로 재배치하고, 소셜 작성 창에 공유 링크를 전달한다. 사용자 문서를 갱신하고 전체 검증을 수행한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/shareStudio.js` | 공유 URL을 `/u/{handle}`로 변경, 소셜 intent에 링크 전달 |
| `src/profile-ui/ShareStudio.jsx` | 보조 액션 순서 재배치와 1차 액션 강조 |
| `src/profile-ui/messages.js` | 공유 링크 메시지 ko/en |
| `src/styles.css` | 1차 액션 강조, 배너 그림자를 토큰으로 교체 |
| `docs/readme-card.md` | 공유 흐름과 링크 미리보기 절 갱신 |
| `src/profile-ui/__tests__/shareStudio.test.js` | 공유 URL과 intent 파라미터 단언 갱신 |
| `tests/profile-ui.spec.js` | 인트로 모달 대응과 unavailable 문구 갱신 |

## 공유 수단 재배치

보조 영역 순서를 바꾸고 1차 액션을 시각적으로 강조했다.

| 순서 | 액션 | 값 |
|---|---|---|
| 1 | 공유 링크 | `https://{origin}/u/{handle}` |
| 2 | README Markdown | `![...](/u/{handle}/card.png?...)` |
| 3 | 이미지 URL | `/u/{handle}/card.png?...` |

`buildPublicProfileShareUrl`이 만들던 `/?profile={handle}`을 `/u/{handle}`로 바꿨다. Open Graph 메타데이터가 주입되는 경로는 후자뿐이므로, 이전 URL을 공유하면 링크 미리보기가 나오지 않는다.

소셜 intent에도 공유 링크를 넘긴다. X와 Reddit은 `url`, LinkedIn은 `shareUrl` 파라미터를 쓴다. 기존에는 문구만 전달하고 링크를 넣지 않아 사용자가 직접 붙여넣어야 했다.

## 소셜 버튼 직접 연결

기존에는 소셜 버튼을 누르면 `이미지 복사 → 작성 창 열기 → 붙여넣기` 3단계 안내 패널이 펼쳐졌다. 공유 링크가 없던 시절의 우회 경로였다. 공유 링크가 생겼으므로 버튼을 링크로 바꿔 해당 서비스의 작성 창이 바로 열리게 했다. 작성 창에는 로케일에 맞는 문구와 공유 링크가 채워진다.

`ShareInstructions` 컴포넌트는 삭제하지 않고 연결만 끊었다. 카카오톡처럼 URL 미리보기가 통하지 않는 표면에서 3단계 안내가 다시 필요할 수 있다. 보존 이유를 주석으로 남겼다.

`copyImage`는 안내 패널 대신 보조 액션 행에 `이미지 복사`로 다시 노출했다. 패널을 없애면서 접근 경로가 사라졌는데, 이미지 자체를 첨부하려는 사용자에게는 여전히 필요한 기능이다.

## 공유 대상 확장

X, LinkedIn, Reddit에 Threads와 Facebook을 추가해 다섯 곳이 되었다. 순서는 카드 공유가 잘 통하는 순으로 X, Threads, LinkedIn, Facebook, Reddit이다.

| 대상 | 작성 창 | 채워지는 값 |
|---|---|---|
| X | `x.com/intent/post` | `text`, `url` |
| Threads | `threads.net/intent/post` | `text`, `url` |
| LinkedIn | `linkedin.com/feed/` | `text`, `shareUrl` |
| Facebook | `facebook.com/sharer/sharer.php` | `u` |
| Reddit | `reddit.com/submit` | `title`, `url` |

Facebook의 sharer는 링크만 받는다. 플랫폼 정책상 문구를 미리 채울 수 없으므로 `u`만 전달한다. 나머지는 로케일에 맞는 문구가 함께 들어간다.

Threads와 Facebook 아이콘을 `BrandLogo`에 추가했다.

## 검증 결과

실행 명령:

```bash
npm test
npm run test:e2e
git diff --check
```

결과:

- OK. `npm test` 전체 679개 중 673 pass, 0 fail, 6 skipped
- OK. `npm run test:e2e` 64개 전부 통과
- OK. `git diff --check` 경고 없음

## e2e 실패와 처리

첫 실행에서 7건, 소셜 버튼 직접 연결 후 6건이 추가로 실패했다. 원본 코드 결함 1건을 빼면 모두 이번 task가 바꾼 계약을 기존 테스트가 그대로 단언하고 있어서였다.

- **원본 코드 결함 1건**: Stage 4에서 넣은 배너 그림자가 raw color였다. 테마 테스트가 `:root` 밖의 raw color를 금지한다. 기존 `--shadow-floating` 토큰으로 교체했다.
- **인트로 모달로 막힌 5건**: 모달이 매 진입마다 뜨고 `.app-frame`을 `inert`로 만들기 때문에 공개 프로필 본문 단언이 실패했다. 로케일에 무관한 `dismissCardIntro` 헬퍼를 추가해 각 테스트가 모달을 먼저 닫도록 했다. 닫기 버튼은 클래스로 찾는다.
- **unavailable 문구 변경 1건**: `Profile unavailable`에서 `This card cannot be shown`으로 바뀌었다. 새 문구와 카드 생성 CTA 존재를 단언하도록 갱신했다.
- **안내 패널 제거로 6건**: 소셜 버튼이 링크가 되면서 패널을 펼치는 단언이 모두 무효가 됐다. 패널 존재만 검증하던 "Korean third instruction step" 테스트는 삭제하고, 나머지는 패널 부재와 작성 창 링크 속성을 단언하도록 바꿨다. 공유 링크 복사 단언도 추가했다.

## 헤더 보정

작업지시자 요청으로 두 가지를 바꿨다.

- 헤더 왼쪽 브랜드명을 `Codex Usage`에서 `Codex Usage Profile`로 바꿨다. 홈 히어로 제목과 같은 이름이 되어 서비스 이름이 한 번에 읽힌다.
- 계정 메뉴 왼쪽에 프로젝트 GitHub 링크를 추가했다. 새 탭으로 열고 `rel="noopener noreferrer"`를 붙인다. 저장소 URL은 `ProfileShell`의 `PROJECT_GITHUB_URL` 상수로 둔다.

e2e에서 3건이 영향을 받아 갱신했다. 브랜드 문구 단언, 헤더에 링크가 늘면서 생긴 `Profile` 링크 이름 중복, 그리고 Tab 순서에 GitHub 링크가 끼어든 부분이다.

이후 두 가지를 더 보정했다.

- 헤더 좌우 여백이 1180px 기준이라 920px 콘텐츠 열과 어긋나 있었다. 헤더를 콘텐츠와 같은 920px 기준으로 바꿔 브랜드 왼쪽 가장자리가 본문 왼쪽과 정확히 맞는다. 1440px 뷰포트 실측에서 둘 다 260px이다.
- GitHub 링크가 계정 아바타 옆에 있어 사용자 본인의 GitHub로 오해될 수 있었다. 브랜드 이름 옆으로 옮기고 GitHub 마크 아이콘을 붙였다. 제품 정체성 영역에 놓이므로 프로젝트 저장소로 읽힌다.

헤더 여백은 920px 정렬이 답답해 보인다는 지적에 따라 이전 1180px 기준으로 되돌렸다. 헤더를 콘텐츠 열에 맞추면 브랜드와 본문 왼쪽이 정확히 정렬되지만 헤더 자체가 좁은 상자에 갇힌 느낌이 된다. 헤더는 chrome이므로 콘텐츠보다 넓게 두는 편이 낫다고 판단했다.

## 아이콘과 테마 전환

- **GitHub 마크가 라이트 모드에서 보이지 않았다.** 원인은 `.brand-logo`가 Share Studio 전용 색(`--share-action-text`, 흰색)과 20px 고정 크기를 전역으로 강제하고 있어서였다. 해당 규칙을 `.share-studio-action-icon .brand-logo`로 한정해 다른 위치에서는 부모 색과 지정 크기를 따르게 했다. 라이트 `rgb(95,96,99)`, 다크 `rgb(165,165,167)`로 양쪽 모두 대비를 확인했다.
- 손으로 그린 GitHub 경로가 부정확했다. 공식 octicon 16x16 마크로 교체하고, `BrandLogo`가 브랜드별 `viewBox`를 가질 수 있게 했다. 20x20 그리드에 16x16 아트워크를 우겨넣지 않는다.
- 계정 메뉴 왼쪽에 해/달 아이콘 테마 전환 버튼을 추가했다. 항상 명시적 preference를 설정하는 2단 토글이며, `system`을 포함한 3단 선택은 설명이 가능한 설정 화면에 그대로 둔다.

## 잔여 위험

- Workers와 Node 프로덕션 런타임의 실제 응답 대조는 배포 산출물이 필요해 아직 하지 않았다.
- Worker 소셜 렌더의 resvg 출력도 미확인이다.
- 투명 여백의 플랫폼 합성 색, 회전 애니메이션의 실제 재생은 실브라우저와 실플랫폼 확인이 남아 있다.
- 배포 후 X, Threads, 카카오톡 실측과 카카오 OG 캐시 초기화가 필요하다.

## 승인 요청

- Stage 6 산출물과 검증 결과를 승인하면 최종 보고서 작성과 PR 게시로 진행한다.
