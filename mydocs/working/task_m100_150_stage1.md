# Task #150 Stage 1 보고서 — 첨부 canvas 계약과 PNG 저장 분리

GitHub Issue: [#150](https://github.com/postmelee/codex-usage-profile/issues/150)
구현계획서: [`task_m100_150_impl.md`](../plans/task_m100_150_impl.md)
Stage: 1

## 단계 목적

stable 카드 PNG와 첨부용 PNG의 계약을 분리하고, 카드 내부 좌표·크기·종횡비를 바꾸지 않은 채 X 등 불투명 배경에서 드러나던 투명 모서리를 제거한다. 첨부 출력은 공식 Codex App 이미지와 같은 `998×612`를 사용하며, 다크와 라이트는 surface와 라이트 outline만 다르게 적용한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/attachment-canvas.js` | `499×306` logical, scale 2, `998×612`, radius 64의 첨부 preset과 다크·라이트 불투명 surface 합성 함수를 추가했다. |
| `src/profile-card/__tests__/attachment-canvas.test.js` | 치수·종횡비·canvas 크기·전 픽셀 alpha·theme별 corner/outline·내부 기하 동등성을 검증하고 대표 PNG 생성을 지원한다. |
| `src/profile-ui/pngExport.js` | same-origin PNG를 제한적으로 fetch·decode한 뒤 공통 canvas에 합성하고 PNG Blob으로 인코딩하는 abort 가능 브라우저 경로를 추가했다. |
| `src/profile-ui/__tests__/pngExport.test.js` | source key, 다크·라이트 Blob, `998×612`, alpha, URL/크기 제한, encode 실패와 abort 정리를 검증한다. |
| `src/profile-ui/ShareStudio.jsx` | 직접 stable URL을 저장하던 링크를 첨부용 PNG 생성 버튼으로 교체하고 중복 실행, cache, abort, object URL 해제와 실패 toast를 연결했다. |
| `src/profile-ui/messages.js` | PNG 저장 실패 안내를 영문·한글로 추가했다. |
| `src/profile-ui/shareStudio.js` | Share Studio copy 계약에 `imageSaveFailed`를 추가했다. |
| `src/profile-ui/__tests__/shareStudio.test.js` | 영문·한글 PNG 저장 실패 문구를 검증한다. |
| `src/profile-ui/__tests__/cardStyleSettings.test.js` | Save PNG만 Blob 경로를 사용하고 stable URL 직접 저장 링크가 남지 않는지 검증한다. |
| `tests/profile-ui.spec.js` | 실제 브라우저 download의 파일명·PNG signature·`998×612`·전체 alpha 255·네 모서리 색을 검증하고 버튼 역할 변경을 회귀했다. |
| `mydocs/orders/20260902.md` | Stage 1 완료와 시제품 승인 대기 상태를 기록했다. |

대표 시제품:

- `/private/tmp/task150-stage1/attachment-dark.png`
- `/private/tmp/task150-stage1/attachment-light.png`

두 파일 모두 `998×612`이고 동일 source를 같은 bounds에 그렸다. 다크는 전체 canvas를 `#181818`로 채웠고 별도 outline을 추가하지 않았다. 라이트는 모서리를 `#F3F5F7`로 채우고 `2px #D0D7DE` outline을 1px inset으로 그렸다.

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당하지 않는다. stable `card.png` renderer, OG social renderer, GIF encoder·golden asset은 수정하지 않았다. 이미지 URL·README·미리보기·이미지 복사는 기존 stable/localized URL을 유지하고, 사용자가 누르는 Save PNG만 첨부용 Blob 경로로 분리했다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-card/__tests__/attachment-canvas.test.js src/profile-ui/__tests__/pngExport.test.js src/profile-ui/__tests__/shareStudio.test.js
npx playwright test tests/profile-ui.spec.js --grep "Task #150|Share Studio.*PNG"
npm run build:production
git diff --check
```

결과:

- OK — Node 집중 테스트 25개 모두 통과했다.
- OK — Playwright 집중 시나리오 2개 모두 통과했다. 실제 다운로드 PNG의 파일명, signature, `998×612`, alpha min/max 255, 다크 네 모서리 `rgba(24,24,24,255)`를 확인했다.
- OK — production server 63 modules, client 1841 modules가 빌드되고 full-stack artifact finalize가 완료됐다.
- OK — `git diff --check` 경고가 없다.
- OK — 대표 다크·라이트 PNG의 전 픽셀 alpha가 255이며, 라이트 상단 중앙 outline이 `rgba(208,215,222,255)`이다.
- OK — source 직접 축소 control과 비교한 내부 영역은 다크·라이트 모두 최대 RGB 오차 3 이하, RMSE 0.1 미만으로 content bounds와 비율이 보존됐다.
- OK — 변경 파일 목록에 stable renderer, social renderer, GIF encoder와 golden asset이 없다.

## 잔여 위험

- 브라우저 비동기 생성 후 download 동작은 Chromium E2E로 검증했다. 브라우저가 Canvas 2D, `createImageBitmap`, `toBlob`을 지원하지 않으면 fallback 없이 오류 toast를 표시한다.
- GIF는 Stage 1 범위 밖이므로 아직 기존 투명 모서리 계약을 유지한다.
- 라이트 surface·outline의 최종 시각 판단은 작업지시자의 시제품 승인이 필요하다.

## 다음 단계 영향

- Stage 2는 승인된 `attachment-canvas.js`를 GIF Worker source 합성에도 재사용한다.
- GIF의 width/height/scale/radius는 Stage 1 preset을 참조하되 96 frame, 20fps, 4.8초, 기존 golden과 motion phase는 변경하지 않는다.
- GIF encoder의 transparency flag와 reserved transparent palette entry를 제거하고 모든 frame의 alpha 255를 검증한다.

## 승인 요청

- Stage 1 산출물, 검증 결과와 다크·라이트 시제품을 승인하면 Stage 2의 불투명 GIF encoder 및 기존 모션 동등성 구현으로 진행한다.
