# Task M100 #2 Stage 2 완료 보고서

GitHub Issue: [#2](https://github.com/postmelee/codex-usage-profile/issues/2)
구현계획서: [`task_m100_2_impl.md`](../plans/task_m100_2_impl.md)
Stage: 2

## 단계 목적

Stage 2의 목적은 Codex-like raw profile 응답에서 저장 가능한 allowlist field만 추출해 Stage 1 snapshot schema로 정규화하는 것이다. 특히 raw input에 access token, refresh token, auth file, credential 유사 field가 포함돼도 output snapshot에 복사되지 않는 보안 경계를 테스트로 고정했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `src/profile-snapshot/normalize.js` | Codex raw profile 응답을 profile snapshot으로 변환하는 `normalizeCodexProfileSnapshot` 구현 |
| `src/profile-snapshot/__tests__/normalize.test.js` | raw 응답 매핑, token-like field 미복사, nullish field 기본값, unsupported invocation filtering 테스트 추가 |
| `src/profile-snapshot/index.js` | normalizer public export 추가 |
| `src/profile-snapshot/types.d.ts` | normalizer option과 함수 declaration 추가 |
| `mydocs/orders/20260608.md` | Stage 2 완료 보고 승인 대기 상태로 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

코드 신규 추가와 declaration 확장 단계다. Stage 1 schema validator API는 보존했고, normalizer는 Stage 1의 exact-key snapshot schema를 통과하는 output만 반환한다.

## 검증 결과

실행 명령:

```bash
npm test
rg -n "access_token|refresh_token|auth.json|CODEX_ACCESS_TOKEN" src mydocs
git diff --check
```

결과:

- OK: `npm test` 통과
  - Node 내장 `node --test`
  - tests 9
  - pass 9
  - fail 0
- OK: `git diff --check` 통과
- OK: secret grep 확인
  - match는 normalizer 보안 테스트와 계획/보고서의 정책 설명에서만 발생했다.
  - `src/profile-snapshot/normalize.js` production code에는 금지 field명이 없다.
  - `normalize.test.js`는 raw input에 token-like field를 주입하고 serialized snapshot에 secret 값이 없음을 검증한다.

## 잔여 위험

- normalizer는 Codex-like raw 응답의 현재 추출 코드 매핑을 기준으로 한다. 실제 CLI 수집 단계에서 raw shape가 다르면 Stage 2 mapping을 보정해야 한다.
- `planLabel`은 raw profile/account field 또는 option에서 정규화한다. 실제 Codex app의 account/workspace label 계산과 완전히 동일한지는 #5 CLI 또는 #3 UI 단계에서 추가 확인이 필요하다.
- invalid date bucket은 schema assertion에서 실패하도록 둔 상태다. CLI에서 부분 실패를 허용할지, 전체 업로드를 실패시킬지는 #5에서 정책을 정해야 한다.

## 다음 단계 영향

- Stage 3 selector는 `normalizeCodexProfileSnapshot` output과 Stage 1 fixture를 입력으로 삼아 Profile 화면 5개 stat과 Card 4개 stat을 꺼내면 된다.
- Stage 3에서 공유 카드 26주 input selector를 만들 때 `dailyUsage`의 `date`/`credits` shape는 Stage 2 normalizer가 보장한다.
- Stage 4 내부 계약 문서에는 Stage 2 raw-to-snapshot mapping과 secret allowlist 경계를 그대로 기록해야 한다.

## 승인 요청

- Stage 2 산출물과 검증 결과를 승인하면 Stage 3으로 진행한다.
