# Task #39 Stage 4.1 보고서 — PR 리뷰 차단 크래시와 접근성 보정

GitHub Issue: [#39](https://github.com/postmelee/codex-usage-profile/issues/39)
Pull Request: [#143](https://github.com/postmelee/codex-usage-profile/pull/143)
구현계획서: [`task_m100_39_impl.md`](../plans/task_m100_39_impl.md)
Stage: 4.1

## 단계 목적

PR #143 리뷰에서 확인된 문자열·malformed `shareRevision`의 렌더 타임 크래시를
차단하고, 최신 `devel`의 Task #141 카드 지오메트리 상수와 GIF 출력 계약을 결합했다.
같은 리뷰의 진행률 live region과 X·Reddit disclosure 접근성 제안도 현재 범위에서 함께
보정하고 전체 회귀를 다시 검증했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/gifExport.js` | GIF source key revision을 공용 `parsePublicShareRevision` 계약으로 정규화 |
| `src/profile-card/gif-animation.js` | GIF logical width·height·radius를 social card 공용 geometry 상수에서 파생 |
| `src/profile-ui/ShareStudio.jsx`, `shareStudio.js` | 진행률 낭독을 25% 단위로 제한하고 X·Reddit 안내를 disclosure 패턴으로 교정 |
| `src/profile-ui/__tests__/gifExport.test.js`, `shareStudio.test.js` | 문자열·malformed revision과 진행률 quantization 단위 회귀 추가 |
| `tests/profile-ui.spec.js` | 닫힌 dialog의 문자열 revision, 안내 패널 토글·ARIA 연결 브라우저 회귀 추가 |
| `mydocs/plans/task_m100_39_impl.md` | 승인된 Stage 4.1 범위·검증·커밋 계약 기록 |
| `mydocs/working/task_m100_39_stage4_1.md` | 리뷰 대응, 검증과 보류 제안 기록 |
| `mydocs/report/task_m100_39_report.md` | 최종 결과와 최신 전체 검증 수치 갱신 |
| `mydocs/orders/20260828.md` | #39 Stage 4.1 완료와 devel의 #141 완료 행을 함께 보존 |

## 본문 변경 정도 / 본문 무손실 여부

`origin/devel`을 merge했으며 수동 충돌은 `mydocs/orders/20260828.md` 한 건뿐이었다.
#39와 #141 행을 모두 보존했고, `docs/readme-card.md`와 Task #141 렌더러 변경은 Git의
자동 병합 결과를 유지했다. Task #141이 도입한 social card geometry 값은 기존 GIF 값과
동일해 출력 preset이나 golden beam asset의 픽셀 계약은 바뀌지 않았다.

차단 수정은 새 fallback을 만들지 않고 형제 공개 URL 경로가 이미 쓰는 parser를 재사용했다.
canonical 숫자 문자열은 safe integer로 정규화하고 malformed 값은 `null` source key로
격리하므로 Share Studio가 닫힌 렌더에서도 page subtree를 중단하지 않는다.

비차단 제안 중 공용 geometry 결합, 진행률 낭독 축소, disclosure ARIA는 이번 단계에
포함했다. 중복 media-query hook 정리, 참조되지 않는 renderer 제거, GIF binary sub-block
skip 최적화는 동작 변경·별도 구조 판단이 필요하고 현재 실측 병목도 아니므로 범위 밖으로
유지했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-ui/__tests__/gifExport.test.js src/profile-ui/__tests__/shareStudio.test.js src/profile-card/__tests__/gif-animation.test.js src/profile-card/__tests__/gif-encoder.test.js src/profile-card/__tests__/gif-beam-frames.test.js
npm run test:e2e -- --grep "Share Studio"
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run smoke:sites-fullstack:local
git diff --check
```

결과:

- OK — GIF·Share Studio 대상 Node test 41개 전부 통과.
- OK — Share Studio 대상 Chromium E2E 21개 전부 통과.
- OK — 전체 Node test 917개 중 911개 통과, 실패 없음, 환경 의존 PostgreSQL·S3
  6개 skip.
- OK — 전체 Chromium E2E 109개 전부 통과.
- OK — production server 63 modules, client 1,839 modules build 통과. GIF Worker
  30.56KB와 beam asset 2,450.74KB를 별도 asset으로 유지했다.
- OK — Sites fullstack 산출물 14개 client file, 6개 migration, 2개 worker file 검증 통과.
- OK — local fullstack smoke 67 routes, canonical update 2개, public PNG 85,391 bytes 통과.
- OK — `git diff --check` 출력 없음.

## 잔여 위험

- 실제 X·Reddit 게시물 업로드는 외부 게시 동작이므로 수행하지 않았다.
- 60초 timeout은 capability failure나 비정상적으로 느린 환경을 종료하기 위한 보수적
  안전 경계다. 리뷰 실측과 현재 회귀에서 timeout에 근접한다는 증거는 없었다.
- media-query hook 공용화, dead renderer 제거, binary parser 최적화는 이번 차단 수정과
  분리해 필요성과 영향 범위를 별도 평가할 수 있다.

## 다음 단계 영향

- Stage 4.1 소스·문서·검증을 한 개의 merge 단계 커밋으로 묶어 `publish/task39`를
  갱신한다.
- PR #143의 fixed-SHA 문서 링크와 검증 수치를 새 head로 갱신하고 리뷰 댓글에 대응
  결과를 남긴 뒤 재검토를 기다린다.
- PR merge, Issue #39 close, 배포와 실제 SNS 게시는 이번 단계에서 수행하지 않는다.

## 승인 요청

- 작업지시자가 2026-08-28 Stage 4.1 구현과 PR 갱신을 승인했다. 검증된 단계 커밋과
  PR 리뷰 대응을 게시한 뒤 merge 승인을 기다린다.
