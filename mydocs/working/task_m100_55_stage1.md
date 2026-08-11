# Task #55 Stage 1 보고서 — 운영자 카드 config와 전환 상태 계약

GitHub Issue: [#55](https://github.com/postmelee/codex-usage-profile/issues/55)
구현계획서: [`task_m100_55_impl.md`](../plans/task_m100_55_impl.md)
Stage: 1

## 단계 목적

anonymous 랜딩의 운영자 stable public card와 static sample fallback을
same-origin config 계약으로 고정하고, 이후 Home 통합에서 이미지 ready 전
source 교체와 stale 응답을 막을 수 있도록 순수 전환 상태 계약을 만든다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-marketing/marketing-config.js` | 기본 운영자 handle `postmelee`, 지원 locale, stable card URL builder와 strict handle 검증 추가 |
| `src/profile-marketing/__tests__/marketing-config.test.js` | 기본 URL, locale, external/query/path/uppercase handle 거부 검증 추가 |
| `src/profile-marketing/__tests__/sites-config.test.js` | Sites config도 운영자 card와 static fallback 계약을 함께 반환하는지 확인 |
| `src/profile-ui/homeCardTransition.js` | visible/pending/generation을 분리한 immutable begin/resolve/reject/reset 상태 전환 추가 |
| `src/profile-ui/__tests__/homeCardTransition.test.js` | stale generation, 단일 fallback, logout reset, storage 미접근과 URL fail-close 검증 추가 |
| `mydocs/orders/20260730.md` | Stage 1 완료와 Stage 2 승인 대기 상태 반영 |
| `mydocs/working/task_m100_55_stage1.md` | Stage 1 구현·검증 결과 기록 |

## 본문 변경 정도 / 본문 무손실 여부

기존 marketing copy, CTA, sample asset, public route와 backend API 동작은
변경하지 않았다. config 반환값에는 공개 운영자 handle만 추가했고, 새 전환
모듈은 아직 Home render 경로와 연결하지 않아 현재 사용자 UI 동작은
그대로 유지된다. Sites project, D1/R2 linkage, 환경 변수와 browser storage는
변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test \
  src/profile-marketing/__tests__/marketing-config.test.js \
  src/profile-ui/__tests__/homeCardTransition.test.js

node --test \
  src/profile-marketing/__tests__/marketing-config.test.js \
  src/profile-marketing/__tests__/sites-config.test.js \
  src/profile-ui/__tests__/homeCardTransition.test.js

git diff --check
```

결과:

- OK — 구현계획서 지정 unit test 12건 통과
- OK — Sites config 회귀를 포함한 확장 unit test 18건 통과
- OK — invalid handle, external/protocol-relative URL, raw·encoded traversal,
  malformed encoding을 fail-close
- OK — current generation만 commit하며 operator failure 뒤 static sample
  fallback은 한 번만 수행
- OK — logout reset 직후 owner source가 제거되고 local/session storage를
  읽지 않음
- OK — `git diff --check` 통과

## 잔여 위험

- 전환 계약은 아직 `HomePage`와 `MarketingLanding`에 연결되지 않아 실제
  preload/decode, slow session, logout race 동작은 Stage 2 E2E에서 검증해야
  한다.
- skeleton veil, motion, `aria-busy`와 reduced-motion 처리는 Stage 3
  범위다.

## 다음 단계 영향

- Stage 2는 이 단계의 same-origin source와 generation 계약을 그대로
  사용해 이미지 `load`/`decode()` 완료 뒤에만 visible card를 교체한다.
- logout 시 `resetHomeCardTransition`을 먼저 적용해 이전 owner source와
  pending generation을 무효화해야 한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2로 진행한다.
