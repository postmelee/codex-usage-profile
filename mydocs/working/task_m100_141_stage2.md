# Task #141 Stage 2 보고서 — renderer 갱신과 라이트 social publication 정합화

GitHub Issue: [#141](https://github.com/postmelee/codex-usage-profile/issues/141)
구현계획서: [`task_m100_141_impl.md`](../plans/task_m100_141_impl.md)
Stage: 2

## 단계 목적

Stage 1에서 변경한 light social renderer를 새 source contract로 구분하고, 이미 공개된 light
profile이 기존 refresh 경로에서 stable media identity를 유지한 채 새 social bytes로 교체되는지
검증한다. 사용자 문서에는 social-only light canvas/outline 동작만 최소 반영한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-card/renderer.js` | native renderer version을 `codex-share-card-3`으로 갱신 |
| `src/profile-card/worker-renderer.js` | Worker renderer version을 `codex-share-card-3-resvg-wasm-1`로 갱신 |
| `src/profile-card/service-core.js` | service fallback renderer version을 native version과 같은 `codex-share-card-3`으로 갱신 |
| `src/profile-card/__tests__/service.test.js` | 이전/native/fallback version의 source digest 분리 계약 검증 |
| `src/profile-card/__tests__/worker-renderer.test.js` | 이전 Worker/native/새 Worker version의 distinct source digest 검증 |
| `src/profile-media/__tests__/social-card-publication.test.js` | 공개 light profile의 renderer bytes 변경 후 stable refresh 회귀 추가 |
| `docs/readme-card.md` | light social의 opaque neutral canvas와 subtle outline, README/dark 제외 범위 안내 |
| `mydocs/orders/20260828.md` | Stage 2 완료와 Stage 3 승인 대기 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

renderer version 상수와 테스트·사용자 안내만 변경했다. 카드 renderer 구현, social surface/frame
수치, publication service, media-store contract/schema, social key, public route와 Open Graph document는
수정하지 않았다. standalone card bytes가 같더라도 구현 contract가 바뀐 사실은 새 source digest로
구분된다. 기존 공개 light profile refresh는 `cards/v2/public/{handle}/social.png`와 publication ID를
그대로 유지하면서 새 body·revision·etag를 기록한다.

## 검증 결과

구현계획서 지정 명령:

```bash
node --test src/profile-card/__tests__/service.test.js src/profile-card/__tests__/worker-renderer.test.js src/profile-media/__tests__/social-card-publication.test.js
rg -n "social image|2400x1260|light" docs/readme-card.md
git diff --check
```

결과:

- OK — 지정 Node test 35개 통과, 실패·skip 없음.
- OK — native/default version은 `codex-share-card-3`, Worker version은
  `codex-share-card-3-resvg-wasm-1`이며 이전 contract와 source digest가 다름을 확인했다.
- OK — 기존 공개 light profile의 refresh에서 social key와 publication ID가 유지되고 body,
  revision, etag가 새 renderer output으로 변경됨을 확인했다.
- OK — 문서 검색에서 personalized social image `2400x1260`, light canvas/outline 및
  README `card.png`·dark 제외 범위를 확인했다.
- OK — `git diff --check` 출력 없음.

추가 회귀 명령:

```bash
node --test src/profile-card/__tests__/social-canvas.test.js src/profile-card/__tests__/social-renderer.test.js
git diff --exit-code -- src/profile-media/media-store-contract.js src/profile-runtime/open-graph.js .openai/hosting.json
```

결과:

- OK — Stage 1 layout/surface/native·Worker SVG 회귀 21개 통과.
- OK — media contract, Open Graph route document와 hosting config 변경 없음.

## 잔여 위험

- 전체 Node test, production build와 Sites full-stack artifact verifier는 Stage 3에서 실행한다.
- native Canvas와 resvg 대표 PNG의 전체 bounds·alpha·색상 대조 및 승인 시제품과의 수동 확인은
  Stage 3에 남아 있다.
- production 배포와 외부 SNS crawler cache 갱신은 승인 범위 밖이므로 수행하지 않았다.

## 다음 단계 영향

- Stage 3는 제품 source와 공식 문서를 수정하지 않고 native/Worker dark·light social 및 standalone
  PNG를 렌더링해 dimensions, bounds, alpha와 representative colors를 비교한다.
- 전체 test/build/verifier와 제외 path 검사를 통과해야 최종 보고 단계로 진입할 수 있다.

## 승인 요청

- Stage 2의 renderer version/source digest, stable light social refresh와 공식 문서 변경을 승인하면
  Stage 3 통합 회귀와 시각 QA로 진행한다.
