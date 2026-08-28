# Task #39 Stage 2 보고서 — browser Worker 생성 pipeline

GitHub Issue: [#39](https://github.com/postmelee/codex-usage-profile/issues/39)
구현계획서: [`task_m100_39_impl.md`](../plans/task_m100_39_impl.md)
Stage: 2

## 단계 목적

Stage 1의 결정적 frame renderer·encoder·binary inspector를 브라우저 전용 module
Worker 실행 경로에 연결했다. same-origin public PNG를 Worker 안에서 fetch·decode한
뒤 96 frame을 순차 생성하고, 검증된 GIF `ArrayBuffer` 하나만 main thread로
transfer하도록 했다. main thread에는 finite-state controller를 두어 한 작업 잠금,
진행률, 취소, timeout, stale message 차단과 Blob URL 생명주기를 담당하게 했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-ui/gifExport.js` | `idle/generating/ready/error` controller, versioned source key, capability check, one-job lock, progress, retry·cancel·timeout, Blob URL 재사용·폐기 구현 |
| `src/profile-ui/gifExport.worker.js` | same-origin PNG allowlist/fetch/decode, high-quality OffscreenCanvas 2배 rasterize, 순차 GIF encode, bounded progress와 transferable completion 구현 |
| `src/profile-ui/__tests__/gifExport.test.js` | capability·source·progress·stale job·cancel·timeout·error·Blob lifecycle와 4개 실제 카드 조합 검증 |
| `src/profile-card/gif-binary.js` | 검증된 metadata에서 Worker transfer용 compact metadata 생성 함수 추가 |
| `mydocs/orders/20260827.md` | Stage 2 완료와 Stage 3 승인 대기 상태 반영 |
| `mydocs/working/task_m100_39_stage2.md` | Stage 2 산출물·검증·잔여 위험 기록 |

신규 Worker/controller/test 코드는 총 1,391줄이다.

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 기존 Share Studio와 PNG
생성·저장·공유 UI는 수정하거나 새 controller를 import하지 않았다. GIF bytes는
브라우저 메모리와 현재 dialog session의 object URL에만 존재하며 server, D1, R2,
Cache Storage, IndexedDB와 localStorage에 저장하거나 전송하지 않는다.

Stage 2 구현은 계획된 main↔Worker message contract를 유지한다. Worker는
`generate` 하나만 받고 첫 frame·매 4 frame·완료 시점에만 progress를 전송한다.
main controller는 Worker metadata를 신뢰하지 않고 전달받은 bytes를 다시 binary
검증한 뒤에만 `image/gif` Blob과 object URL을 만든다.

## 검증 결과

실행 명령:

```bash
node --test src/profile-card/__tests__/gif-animation.test.js src/profile-card/__tests__/gif-encoder.test.js src/profile-card/__tests__/gif-binary.test.js src/profile-ui/__tests__/gifExport.test.js
npm run build:production
git diff --check
```

결과:

- OK — Stage 1 회귀와 Stage 2를 합친 19개 테스트 통과, 실패·skip 없음.
- OK — server 63 modules, client 1,835 modules production build 통과.
- OK — `git diff --check` 출력 없음.
- OK — 동일 source 중복 generate는 Worker를 추가 생성하지 않고 ready object URL을
  재사용한다.
- OK — source 변경, cancel, retry, 60초 timeout과 dispose에서 Worker terminate와
  object URL revoke 호출 수를 검증했다.
- OK — stale job/message, 비단조 progress, malformed/15MB 이상 output은 폐기되며
  invalid output에서 Blob이 생성되지 않는다.
- OK — unsafe/cross-origin source, redirect origin, non-2xx, non-PNG, empty,
  10MB 초과, decode/context 실패를 typed error로 검증했다.
- OK — progress는 `1, 4, 8, …, 96` frame만 전송하고 complete bytes 하나를
  transfer list로 전달한다.
- OK — dark/light × en/ko 대표 avatar 카드 네 조합이 모두 998×612·96 frame
  binary invariant와 15MB 상한을 통과했다.
- OK — Worker entry를 browser ESM으로 독립 bundle했으며 결과는 54.7KB였다.

## 잔여 위험

- Worker와 controller는 실제 browser API와 같은 test double 및 browser target
  bundle로 검증했지만, 제품 UI에서 Worker가 실제 생성·저장까지 실행되는 E2E는
  Stage 3 연결 후 확인해야 한다.
- 인코딩 시간과 메모리 사용량은 사용자 장치 성능에 따라 달라질 수 있다. 60초
  timeout과 terminate 경계는 고정했지만 저사양 데스크톱 실측은 통합 QA가 필요하다.
- mobile PNG-only, 접근성 copy, 진행률 표시, retry와 dialog close 연동은 Stage 3
  범위이므로 현재 UI에서는 GIF controller가 아직 노출되지 않는다.

## 다음 단계 영향

- Stage 3는 desktop Share Studio session마다 controller 하나를 만들고 unmount에서
  `dispose()`해야 한다.
- source key는 selected image URL, share revision, theme, locale와 preset version을
  포함해 만들고 변경 시 `synchronizeSource()`로 이전 Worker/URL을 폐기해야 한다.
- preview는 계속 static PNG를 사용하며 ready 상태에서만
  `codex-usage-profile.gif` download link에 `blobUrl`을 연결한다.
- `unsupported`, `source_failed`, `encode_failed`, `invalid_output`, `too_large`,
  `timed_out`을 사용자용 ko/en copy와 retry 동작으로 매핑해야 한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3 Share Studio GIF 생성·저장 UX로
  진행한다.
