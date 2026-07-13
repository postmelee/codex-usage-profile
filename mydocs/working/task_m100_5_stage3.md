# Task M100 #5 Stage 3 단계 보고서

GitHub Issue: [#5](https://github.com/postmelee/codex-usage-profile/issues/5)
구현계획서: [`task_m100_5_impl.md`](../plans/task_m100_5_impl.md)
Stage: 3

## 단계 목적

CLI를 registry `codex-usage-analyzer@0.2.x`의 `readAccountUsage()`에 연결하고, identity-free Account Usage Contract를 token owner의 downstream endpoint로 제출한다. device metadata는 header로 분리하고 analyzer·network·HTTP 오류와 성공 출력을 credential 및 내부 revision이 노출되지 않도록 제한한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `packages/codex-usage-profile-cli/package.json` | `codex-usage-analyzer@^0.2.0` runtime dependency 추가 |
| `package-lock.json` | local workspace link를 registry `0.2.0` tarball·integrity로 전환 |
| `packages/codex-usage-analyzer/**` | 중복 local analyzer workspace 제거 |
| `src/profile-snapshot/v2-schema.js` | 기존 UsageSnapshot v2 validator를 저장소 내부 legacy profile 계약으로 이전 |
| `src/profile-snapshot/v2-types.d.ts` | UsageSnapshot v2 타입을 저장소 내부 소유로 이전 |
| `src/profile-snapshot/fixtures/sample-v2-snapshot.js` | 외부 analyzer fixture re-export를 내부 fixture로 이전 |
| `packages/codex-usage-profile-cli/src/submit.js` | analyzer 호출, complete contract 검증, 단일 ambiguity retry, analyzer·HTTP safe error mapping 구현 |
| `packages/codex-usage-profile-cli/src/output.js` | human·JSON 성공 출력 allowlist, credential·owner id·private revision 제거 구현 |
| `packages/codex-usage-profile-cli/src/service-client.js` | exact document submit과 product device header 전달 구현 |
| `packages/codex-usage-profile-cli/src/cli.js` | credential 부재 시 login 후 submit 연속 실행, stable device id, analyzer 연결 구현 |
| `packages/codex-usage-profile-cli/src/config.js` | analyzer 계약과 timeout 상한을 120초로 정렬 |
| `packages/codex-usage-profile-cli/src/credentials.js` | 환경 token을 저장하지 않는 device-only metadata state 지원 |
| `packages/codex-usage-profile-cli/test/*.test.js` | deep-equal body, 오류 코드, redaction, auto-login, accepted/idempotent, ETag와 privacy 통합 테스트 추가 |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당하지 않는다. 이전 local analyzer의 UsageSnapshot v2 기능은 profile 호환 계층 내부로 같은 구현과 타입을 이동해 기존 동작을 보존했다. 외부 analyzer는 Account Usage Contract reader 역할만 담당하며 GitHub identity와 downstream metadata를 다루지 않는다.

## 검증 결과

실행 명령:

```bash
npm install
node --test packages/codex-usage-profile-cli/test/*.test.js
node --test src/profile-backend/__tests__/account-usage-submit.test.js src/profile-backend/__tests__/http.test.js
node --test src/profile-card/__tests__/service.test.js
npm test
npm run build
npm ls codex-usage-analyzer
git diff --check
```

결과:

- OK: lockfile과 dependency tree가 registry `codex-usage-analyzer@0.2.0`을 가리킴
- OK: CLI unit·integration 테스트 40개 통과
- OK: Account Usage backend·HTTP 테스트 33개 통과
- OK: card service 테스트 7개 통과
- OK: 전체 단위·통합 테스트 255개 통과
- OK: Vite production build 성공
- OK: whitespace 오류 없음

## 잔여 위험

- 실제 로컬 Codex app-server를 실행하는 analyzer smoke는 사용자 환경에 접근하는 opt-in 검증이므로 Stage 5에서 수행한다.
- network ambiguity retry는 동일 document를 한 번만 재전송하며 두 번 모두 실패하면 결과 불명을 명시한다. 운영 관측성은 배포 환경에서 별도 구성해야 한다.
- package 기본 production service URL은 아직 없어 Stage 4 문서에서도 `--server` 또는 환경변수가 필요하다.
- registry publish와 packed CLI 설치 검증은 Stage 4·5 범위다.

## 다음 단계 영향

- Stage 4 문서는 `npx codex-usage-profile login|submit|status|logout`과 service URL 설정, token 저장·privacy 경계를 설명해야 한다.
- 성공 submit은 profile URL, stable card URL, README Markdown을 반환하며 private revision은 사용자 출력에 포함되지 않는다.
- `dailyUsageBuckets: null`과 모든 nullable summary 값은 analyzer document부터 renderer까지 그대로 유지된다.
- GitHub image proxy cache delay 때문에 submit 직후 README 이미지 반영이 지연될 수 있음을 문서에 명시해야 한다.

## 승인 요청

- Stage 3 산출물과 검증 결과를 승인하면 Stage 4 package 전환과 사용자 문서 구현으로 진행한다.
