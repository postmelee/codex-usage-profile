# Task #141 구현계획서 — 라이트 카드 소셜 썸네일의 플랫폼별 경계 대비 보정

수행계획서: [`task_m100_141.md`](task_m100_141.md)
GitHub Issue: [#141](https://github.com/postmelee/codex-usage-profile/issues/141)
마일스톤: M100

## 승인된 결정과 구현 해석

- 라이트 소셜 PNG에만 `#F3F5F7` 불투명 캔버스와 논리 `1px`, 실제 출력 `2px`의
  `#D0D7DE` 카드 테두리를 적용한다.
- `computeSocialCanvasLayout()`의 기존 상수와 계산은 수정하지 않는다. 논리 캔버스는
  `1200×630`, 출력은 `2400×1260`, 카드는 `960×588.6973947895792`, 위치는
  `x=120`, `y=20.65130260521039`, scale은 `1.9238476953907815`를 유지한다.
- 출력 카드의 계산상 위치는 `x=240`, `y≈41.3026`, `width=1920`,
  `height≈1177.3948`이며, anti-alias를 포함한 관찰 가능한 경계는 승인 시제품과 라이브
  다크 출력에서 확인한 `x=240–2159`, `y=41–1218`, `1920×1178`로 고정한다.
- 테두리는 기존 카드 body 안에 넣지 않는다. social canvas 좌표에서 card transform과 같은
  bounds/radius를 사용해 body 뒤에 그린다.
- 다크 social은 현재의 투명 padding과 무테두리 표현을 유지하고, standalone card PNG/SVG는
  light/dark 모두 현재 출력 계약을 유지한다.
- native Canvas와 production Worker SVG는 같은 shared surface/frame 수치를 사용하되 rasterizer
  차이로 인한 exact byte equality는 요구하지 않는다.
- 공식 사용자 문서는 기존 `docs/readme-card.md`만 필요한 문장을 최소 갱신한다. 구현 좌표와
  픽셀 검사 세부는 단계 보고서에 남긴다.
- publication refresh는 기존 stable social key와 media schema를 유지한다. 저장된 object는 다음
  publish/settings/usage refresh에서 새 bytes·revision·etag로 교체되며 production 배포나 cache
  purge는 수행하지 않는다.

## 단계 개요

| Stage | 제목 | 주요 산출 | 검증 |
|---|---|---|---|
| 1 | 소셜 surface 계약과 renderer parity | `social-canvas.js`, native/Worker renderer, renderer tests | light surface·border·geometry, dark/README 무회귀 |
| 2 | renderer version·publication refresh와 공식 문서 | renderer/service version, publication tests, `docs/readme-card.md` | source digest·stable social refresh·문서 정합성 |
| 3 | 통합 회귀와 시각 QA | 대표 dark/light 출력, 전체 test/build/verifier, Stage 보고 | bounds·alpha·색상 대조와 전체 회귀 |
| 3.2 | PR 리뷰 radius 결합 보강 | native/Worker 공통 radius 소비, corner overhang 회귀, import 정렬 | light outline이 dark card geometry 밖으로 돌출하지 않음 |

## 문서 위치 확인

| 파일 | 수행계획서상 선택 위치 | Stage 산출물 경로 | 일치 여부 | 비고 |
|---|---|---|---|---|
| 수행·구현계획서 | `mydocs/plans/` | `mydocs/plans/task_m100_141*.md` | OK | 승인 범위와 Stage 경계 |
| 단계 보고서 | `mydocs/working/` | `mydocs/working/task_m100_141_stage*.md` | OK | 각 Stage source와 같은 commit |
| 최종 보고서 | `mydocs/report/` | `mydocs/report/task_m100_141_report.md` | OK | 모든 Stage 승인 뒤 작성 |
| 소셜 이미지 사용자 안내 | `docs/` | `docs/readme-card.md` | OK | 기존 공식 card/share 문서의 light social 표현만 최소 갱신 |

## 공통 픽셀 계약

| 항목 | 계약 |
|---|---|
| 논리 canvas | `1200×630` |
| 출력 canvas | `2400×1260`, scale `2` |
| card logical source | `499×306`, ratio `499:306` |
| social card logical bounds | `x=120`, `y≈20.6513026052`, `w=960`, `h≈588.6973947896` |
| social card output bounds | 계산상 `x=240`, `y≈41.3026`, `w=1920`, `h≈1177.3948` |
| 관찰 가능한 card bounds | `x=240–2159`, `y=41–1218`, `1920×1178` |
| light canvas | opaque `#F3F5F7` |
| light border | logical `1px`, output `2px`, `#D0D7DE` |
| light border radius | inset을 반영한 `32 × layout.scale` 기반 |
| dark canvas/border | transparent padding, border 없음 |
| standalone card | `1497×918`, 기존 rounded corner alpha와 body 유지 |

## Stage 1 — 소셜 surface 계약과 renderer parity

### 진입 조건

- 수행계획서와 본 구현계획서의 공통 픽셀 계약, 3개 Stage와 제외 범위가 승인됐다.
- `local/task141` worktree에는 task-start와 구현계획서 commit만 있고 clean하다.

### 산출물

수정:

- `src/profile-card/social-canvas.js`
- `src/profile-card/renderer.js`
- `src/profile-card/worker-renderer.js`
- `src/profile-card/__tests__/social-canvas.test.js`
- `src/profile-card/__tests__/social-renderer.test.js`
- `src/profile-card/__tests__/worker-renderer.test.js` — Worker standalone 무회귀가 추가로 필요한 경우
- `mydocs/orders/20260828.md`

신규:

- `mydocs/working/task_m100_141_stage1.md`

`src/profile-card/theme.js`, card body 내부 좌표와 `public/assets/codex-social-sample.png`는
변경하지 않는다.

### 변경 내용

1. `social-canvas.js`에 light social 전용 background, border color, logical border width와
   card logical radius를 공유 상수로 정의한다.
2. light/dark 적용 조건과 layout에서 outline 좌표를 파생하는 작은 helper를 둔다. outline은
   centered stroke가 기존 card bounds 밖으로 나가지 않도록 `borderWidth / 2`만큼 inset하고
   width/height/radius에도 같은 inset을 반영한다.
3. 기존 `SOCIAL_*` dimensions, padding, aspect ratio와 `computeSocialCanvasLayout()`의 계산식·
   반환값은 수정하지 않는다. 기존 layout test의 exact 기대값도 유지한다.
4. native `renderProfileSocialCardPng`는 light일 때 output scale이 적용된 context에서 전체 logical
   canvas를 `#F3F5F7`로 먼저 채운다. 기존 translate/scale/drawCard를 그대로 실행한 뒤 context를
   복원하고 shared outline을 `#D0D7DE`, logical `1px`로 stroke한다.
5. native dark 경로는 background fill과 outline을 호출하지 않아 현재 transparent pixels를 유지한다.
   `renderProfileCardPng`와 `drawCardBackground`는 변경하지 않는다.
6. Worker social SVG는 light일 때 root SVG 안에서 card `<g>` 앞에 full-canvas background `<rect>`,
   `<g>` 뒤에 shared outline `<rect fill="none">`를 둔다. dark SVG는 기존 `<g>`만 유지한다.
7. Worker의 `createWorkerProfileCardBody()`를 바꾸지 않아 기존 card SVG body가 social SVG에
   그대로 포함되는 계약을 유지한다.
8. `social-canvas.test.js`에서 기존 layout exact 값과 aspect ratio가 변하지 않았음을 유지하고,
   light surface/outline helper의 색·inset·radius 파생값과 dark no-surface를 검증한다.
9. `social-renderer.test.js`를 다음 계약으로 보정한다.
   - light canvas corner와 padding은 `#F3F5F7`, alpha 255
   - straight edge의 border 영역은 `#D0D7DE`, logical 1px/output 2px
   - card 안쪽 대표 픽셀은 기존 light card background/content를 유지
   - 관찰 가능한 card bounds는 `x=240–2159`, `y=41–1218`
   - dark padding과 rounded corner 바깥은 기존처럼 alpha 0
   - Worker light SVG의 markup 순서는 background → card group → outline이며 dark에는 surface markup 없음
   - Worker social SVG가 standalone card body를 변경 없이 재사용
10. targeted 검증 통과 뒤 `task-stage-report`로 source, 테스트, 오늘할일과 Stage 1 보고서를
    한 commit으로 묶고 Stage 2 승인을 요청한다.

### 검증

```bash
node --test src/profile-card/__tests__/social-canvas.test.js src/profile-card/__tests__/social-renderer.test.js src/profile-card/__tests__/worker-renderer.test.js
git diff --check
```

### 완료·중단 조건

- 완료: native/Worker light surface와 outline, exact geometry, dark transparent padding과 standalone card
  무회귀가 targeted test로 고정되고 모두 통과한다.
- 중단: 기존 layout 상수·card body 좌표·theme palette를 바꾸거나 native/Worker 중 한 경로만 다른
  geometry를 사용해야 한다면 구현을 멈추고 계획 보정 승인을 요청한다.

### 커밋

```text
Task #141 Stage 1: 라이트 소셜 surface와 renderer parity 보정
```

## Stage 2 — renderer version·publication refresh와 공식 문서

### 진입 조건

- Stage 1 source·테스트·보고서가 commit되고 작업지시자가 Stage 2 진행을 승인했다.

### 산출물

수정:

- `src/profile-card/renderer.js`
- `src/profile-card/worker-renderer.js`
- `src/profile-card/service-core.js`
- `src/profile-card/__tests__/service.test.js`
- `src/profile-card/__tests__/worker-renderer.test.js`
- `src/profile-media/__tests__/social-card-publication.test.js`
- `docs/readme-card.md`
- `mydocs/orders/20260828.md`

신규:

- `mydocs/working/task_m100_141_stage2.md`

media-store schema, social key, public route와 Open Graph document는 변경하지 않는다.

### 변경 내용

1. native renderer version을 `codex-share-card-3`, Worker renderer version을
   `codex-share-card-3-resvg-wasm-1`, service fallback renderer version을
   `codex-share-card-3`으로 함께 올려 새 renderer source contract를 구분한다.
2. 같은 owner/usage/theme/locale에서 이전 `codex-share-card-2`와 새 renderer version의 source
   digest가 다르고, native와 Worker version이 각각 명시적으로 digest에 반영됨을 테스트한다.
3. standalone card bytes는 시각적으로 바뀌지 않더라도 renderer implementation contract가 변경된
   사실을 version으로 추적한다. version 차이만으로 media schema나 route를 변경하지 않는다.
4. `social-card-publication.test.js`에 이미 공개된 light profile의 social renderer bytes가 바뀐 뒤
   기존 refresh를 다시 실행하는 회귀를 추가한다. stable social key와 publication identity는 유지되고
   body, revision, etag만 새 output으로 갱신되는지 확인한다.
5. 기존 theme/locale settings refresh, CAS failure, concurrent winner와 unpublish test를 유지해
   surface 변경이 publication authority를 우회하지 않음을 확인한다.
6. `docs/readme-card.md`의 personalized social image 설명에 다음 사용자-facing 경계만 최소 반영한다.
   - social image는 계속 `2400×1260`이며 저장된 theme/locale을 따른다.
   - light social image는 흰색 기반 플랫폼에서도 카드 경계가 보이도록 opaque neutral canvas와
     subtle outline을 사용한다.
   - README `card.png`와 dark social 표현은 이 변경 대상이 아니다.
7. targeted service/publication test와 문서 검색을 통과한 뒤 `task-stage-report`로 source, 공식 문서,
   오늘할일과 Stage 2 보고서를 한 commit으로 묶고 Stage 3 승인을 요청한다.

### 검증

```bash
node --test src/profile-card/__tests__/service.test.js src/profile-card/__tests__/worker-renderer.test.js src/profile-media/__tests__/social-card-publication.test.js
rg -n "social image|2400x1260|light" docs/readme-card.md
git diff --check
```

### 완료·중단 조건

- 완료: renderer version/source digest와 existing-public light social refresh가 테스트로 고정되고,
  공식 문서가 실제 light-only 출력 계약과 일치한다.
- 중단: media contract version, storage key, D1/R2 schema, public URL 또는 automatic deployment가
  필요하면 범위를 확장하지 않고 별도 승인 요청을 한다.

### 커밋

```text
Task #141 Stage 2: renderer 갱신과 라이트 social publication 정합화
```

## Stage 3 — 통합 회귀와 시각 QA

### 진입 조건

- Stage 2 보고서와 renderer version·publication·문서 계약이 승인됐다.
- Stage 1~2 source와 보고서가 commit되어 working tree가 clean하다.

### 산출물

수정:

- `mydocs/orders/20260828.md`

신규:

- `mydocs/working/task_m100_141_stage3.md`

제품 source와 공식 문서는 Stage 3에서 수정하지 않는다. 검증 실패 해결에 source 변경이 필요하면
해당 Stage 보정 또는 구현계획 변경 승인을 먼저 받는다. 대표 렌더 산출물은 `/private/tmp`에 만들고
저장소에는 추가하지 않는다.

### 실행 순서

1. native와 Worker renderer로 같은 fixture의 dark/light social PNG를 각각 렌더링한다.
2. 네 이미지의 canvas dimensions, card bounds, aspect ratio와 representative background/card pixels를
   script로 대조한다.
3. light native/Worker에서 outer pixel alpha 255, `#F3F5F7` canvas와 `#D0D7DE` edge를 확인하고,
   dark native/Worker padding alpha 0을 확인한다.
4. standalone light/dark card PNG의 `1497×918`, rounded corner alpha와 대표 content pixel을 확인한다.
5. 승인 시제품과 representative light output을 나란히 수동 확인하되 생성형 보정이나 image resize를
   검증 원본에 적용하지 않는다.
6. 전체 Node test를 순차 실행하고 production build와 Sites full-stack artifact verifier를 실행한다.
7. task diff가 승인된 renderer/test/docs/task 문서 경로에만 한정되고, layout constants, card body,
   media schema, public routes와 hosting config가 바뀌지 않았는지 path/semantic diff로 확인한다.
8. `task-stage-report`로 전체 검증 결과와 오늘할일을 commit하고 최종 보고 단계 승인을 요청한다.

### 검증

```bash
npm test -- --test-concurrency=1
npm run build:production
npm run verify:sites-fullstack
git diff --exit-code origin/devel...HEAD -- src/profile-card/theme.js src/profile-runtime/open-graph.js src/profile-media/media-store-contract.js .openai/hosting.json
git diff --check
git status --short
```

### 완료·중단 조건

- 완료: pixel 대조, 전체 Node test, production build, Sites verifier와 제외 path 검사가 모두 통과한다.
- 중단: dark/README geometry 또는 alpha 회귀, native/Worker 불일치, 전체 회귀 실패나 제외 path 변경이
  발견되면 Stage를 완료 처리하지 않고 원인과 보정 범위를 보고한다.

### 커밋

```text
Task #141 Stage 3: 소셜 썸네일 통합 회귀와 시각 QA 완료
```

## Stage 3.2 — PR 리뷰 radius 결합 보강

### 진입 조건

- PR #142의 리뷰 기준 commit은 `5c32a876cddb047931f65591278c5ffaf83b7d6b`이며 현재
  light/dark 출력, 전체 test와 CI는 통과 상태다.
- 작업지시자가 같은 스레드에서 권장 처리안인 공통 radius 상수화, 모서리 불일치 회귀와
  import 정렬 진행을 승인했다.

### 산출물

수정:

- `src/profile-card/renderer.js`
- `src/profile-card/worker-renderer.js`
- `src/profile-card/__tests__/social-canvas.test.js`
- `src/profile-card/__tests__/social-renderer.test.js`
- `src/profile-card/__tests__/worker-renderer.test.js`
- `mydocs/plans/task_m100_141_impl.md`
- `mydocs/report/task_m100_141_report.md`
- `mydocs/orders/20260828.md`

신규:

- `mydocs/working/task_m100_141_stage3_2.md`

라이트 golden PNG와 새 public asset은 추가하지 않는다. golden은 현재 correctness를 막는 결함이
아니고 바이너리 byte baseline 유지 정책을 별도로 결정해야 하므로 후속 후보로 남긴다.

### 실행 순서

1. `social-canvas.js`가 이미 export하는 `SOCIAL_CARD_LOGICAL_RADIUS`를 native와 Worker renderer가
   직접 import해 card body radius에도 사용한다.
2. native `roundRect(..., 32)`와 Worker `rx="32"` 리터럴을 공통 상수로 교체한다. surface outline
   계산도 같은 상수를 계속 사용하므로 단일 변경으로 body와 outline이 함께 움직이게 한다.
3. native/Worker 실제 light social에서 neutral canvas와 다른 모든 픽셀이 동일 renderer의 dark
   card alpha geometry 안에 포함되는지 전수 검사해 corner outline 돌출을 차단한다.
4. 리뷰에서 지적된 named import 순서를 정렬한다.
5. targeted renderer test, 전체 Node test, production build와 Sites verifier를 재실행한다.
6. Stage 3.2 보고서, 최종 보고서와 오늘할일을 갱신하고 source와 한 commit으로 묶는다.
7. `publish/task141`을 갱신하고 PR #142 본문·리뷰 대응 근거를 새 HEAD와 검증 결과에 맞춘다.

### 검증

```bash
node --test src/profile-card/__tests__/renderer.test.js src/profile-card/__tests__/social-canvas.test.js src/profile-card/__tests__/social-renderer.test.js src/profile-card/__tests__/worker-renderer.test.js
npm test -- --test-concurrency=1
npm run build:production
npm run verify:sites-fullstack
git diff --check
```

### 완료·중단 조건

- 완료: native/Worker card body와 social outline이 하나의 radius 상수를 소비하고, light shape의
  dark alpha geometry 밖 돌출 픽셀이 0이며 전체 검증이 통과한다.
- 중단: 공통 상수화로 PNG bounds·bytes 외 공개 계약이 바뀌거나 golden/public asset 추가가
  필수라면 범위를 확장하지 않고 다시 승인 요청한다.

### 커밋

```text
Task #141 [Stage 3.2]: 카드 radius 결합과 모서리 회귀 보강
```

## 검증

- 각 Stage 검증 명령은 단계 보고서 작성 전에 실행하고 실패한 Stage는 완료 처리하지 않는다.
- geometry 검증은 성공 이미지의 인상만 보지 않고 layout exact 값과 output pixel bounds를 함께 판정한다.
- light surface 검증은 corner/background alpha·RGB, straight-edge border와 card 내부 pixel을 구분한다.
- dark 무회귀는 padding/corner alpha와 absence of surface markup을 함께 확인한다.
- standalone card 무회귀는 dimensions, rounded corner alpha와 social-only markup 부재를 확인한다.
- native/Worker는 semantic surface와 bounds parity를 요구하고 rasterizer별 exact PNG byte equality는
  요구하지 않는다.
- publication 검증은 stable key·publication ID와 새 body/revision/etag를 함께 판정한다.
- 계획 밖 layout, card body, media schema, route, hosting 변경이 필요하면 구현계획서를 먼저 갱신하고
  작업지시자 승인을 받는다.
- production 배포, remote Site 변경, external cache purge와 실제 SNS 게시를 수행하지 않는다.

## 커밋

- Stage source, `mydocs/working/task_m100_141_stage{N}.md`와 오늘할일 갱신을 각 Stage commit으로
  함께 묶는다.
- 커밋 메시지는 다음을 사용한다.
  - `Task #141 Stage 1: 라이트 소셜 surface와 renderer parity 보정`
  - `Task #141 Stage 2: renderer 갱신과 라이트 social publication 정합화`
  - `Task #141 Stage 3: 소셜 썸네일 통합 회귀와 시각 QA 완료`
  - `Task #141 [Stage 3.2]: 카드 radius 결합과 모서리 회귀 보강`

## 단계 의존성

- Stage 1은 shared surface/frame과 renderer geometry의 유일한 구현 Stage다.
- Stage 2는 Stage 1의 pixel contract 승인 뒤 renderer version·publication·공식 문서를 정합화한다.
- Stage 3은 Stage 2 승인 뒤 source 수정 없이 전체 회귀와 시각 QA를 수행한다.
- Stage 3.2는 PR 리뷰 승인 뒤 card body/outline radius 결합과 corner overhang 회귀만 보강한다.
- 각 Stage는 `task-stage-report` 커밋과 작업지시자 승인 없이는 다음 Stage로 넘어가지 않는다.

## 위험과 대응

- **stroke bounds 확대**: shared inset outline을 사용하고 exact output bounds test로 차단한다.
- **SVG/Canvas corner 차이**: 동일한 float geometry와 straight-edge/region pixel 검증을 사용한다.
- **dark/README 오염**: light social condition과 social-only surface 함수에 한정하고 alpha/markup test로 차단한다.
- **version 과잉 무효화**: 새 renderer version은 source digest만 구분하며 schema/key/route를 건드리지 않는다.
- **저장된 social object 지연**: 기존 refresh에서 revision/etag가 갱신됨을 검증하고 배포·purge는 제외한다.
- **공식 문서 과잉 설명**: 사용자에게 필요한 light preview 차이만 기록하고 내부 좌표는 task 문서에 둔다.

## 승인 요청 사항

- 공통 픽셀 계약과 light-only surface/outline의 concrete 구현 순서
- Stage 1 renderer/test, Stage 2 version/publication/docs, Stage 3 통합 QA의 산출물·검증·커밋 경계
- PR #142 리뷰 후 Stage 3.2의 공통 radius, corner overhang 회귀와 import 정렬 범위
- renderer version을 `codex-share-card-3` / `codex-share-card-3-resvg-wasm-1`로 올리는 결정
- stable social key와 media schema를 유지하고 다음 기존 refresh에서 새 bytes를 반영하는 경계
- `docs/readme-card.md`의 light social 사용자 안내만 최소 갱신하는 문서 위치

승인되면 Stage 1 구현을 시작하고, 완료 후 `task-stage-report`로 검증·보고·커밋한 뒤 Stage 2
진행 승인을 요청한다.
