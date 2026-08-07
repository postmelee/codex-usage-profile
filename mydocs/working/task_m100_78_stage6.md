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

## 검증 결과

실행 명령:

```bash
npm test
npm run test:e2e
git diff --check
```

결과:

- OK. `npm test` 전체 679개 중 673 pass, 0 fail, 6 skipped
- OK. `npm run test:e2e` 65개 전부 통과
- OK. `git diff --check` 경고 없음

## e2e 실패 7건과 처리

첫 실행에서 7건이 실패했다. 모두 이번 task가 바꾼 계약을 기존 테스트가 그대로 단언하고 있어서였다.

- **원본 코드 결함 1건**: Stage 4에서 넣은 배너 그림자가 raw color였다. 테마 테스트가 `:root` 밖의 raw color를 금지한다. 기존 `--shadow-floating` 토큰으로 교체했다.
- **인트로 모달로 막힌 5건**: 모달이 매 진입마다 뜨고 `.app-frame`을 `inert`로 만들기 때문에 공개 프로필 본문 단언이 실패했다. 로케일에 무관한 `dismissCardIntro` 헬퍼를 추가해 각 테스트가 모달을 먼저 닫도록 했다. 닫기 버튼은 클래스로 찾는다.
- **unavailable 문구 변경 1건**: `Profile unavailable`에서 `This card cannot be shown`으로 바뀌었다. 새 문구와 카드 생성 CTA 존재를 단언하도록 갱신했다.

## 잔여 위험

- Workers와 Node 프로덕션 런타임의 실제 응답 대조는 배포 산출물이 필요해 아직 하지 않았다.
- Worker 소셜 렌더의 resvg 출력도 미확인이다.
- 투명 여백의 플랫폼 합성 색, 회전 애니메이션의 실제 재생은 실브라우저와 실플랫폼 확인이 남아 있다.
- 배포 후 X, Threads, 카카오톡 실측과 카카오 OG 캐시 초기화가 필요하다.

## 승인 요청

- Stage 6 산출물과 검증 결과를 승인하면 최종 보고서 작성과 PR 게시로 진행한다.
