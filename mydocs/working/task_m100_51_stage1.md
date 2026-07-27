# Task #51 Stage 1 보고서 — canonical Sites build와 production origin 계약

GitHub Issue: [#51](https://github.com/postmelee/codex-usage-profile/issues/51)
구현계획서: [`task_m100_51_impl.md`](../plans/task_m100_51_impl.md)
Stage: 1

## 단계 목적

Sites production packaging 입력을 `dist/`로 통일하고, 저장된 credential의
origin binding을 약화하지 않으면서 공개 후보 Site를 CLI의 기본 service origin으로
고정한다. 기존 Cloud Run, marketing Sites와 local full-stack smoke 경로는 유지한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `.gitignore` | production `dist/`와 분리된 local smoke 산출물 경로를 무시한다. |
| `package.json` | `build:production`을 `build:sites-fullstack`의 명시적 alias로 추가한다. |
| `vite.sites-fullstack.config.js` | production output을 `dist/`, local smoke output을 기존 전용 경로로 분리하고 Worker package 이름을 `server`로 고정한다. |
| `build/sites-fullstack-vite-plugin.js` | fingerprinted Worker bundle을 `dist/server/index.js` ESM entry로 연결하고 packaged config의 `main`을 정규화한다. |
| `scripts/verify-sites-fullstack-artifact.mjs` | 기본 `dist/`와 고정된 `server/index.js` package 계약을 검증한다. |
| `scripts/__tests__/verify-sites-fullstack-artifact.test.js` | production Sites directory shape fixture를 반영한다. |
| `scripts/smoke-sites-fullstack-local.mjs` | local smoke Worker root를 전용 output의 `server/`로 맞춘다. |
| `packages/codex-usage-profile-cli/src/config.js` | 승인된 production Site origin을 단일 exported constant로 정의한다. |
| `packages/codex-usage-profile-cli/src/cli.js` | 기본 origin을 적용하고 help에 기본 service를 표시한다. |
| `packages/codex-usage-profile-cli/src/index.js` | 기본 service origin constant를 package surface로 export한다. |
| `packages/codex-usage-profile-cli/test/config.test.js` | 기본 origin과 origin 선택 우선순위를 고정한다. |
| `packages/codex-usage-profile-cli/test/cli.test.js` | help, 기본 origin, env 및 CLI override 동작을 검증한다. |

구현계획서에서 필요 시 신규로 두었던 별도 production verifier test는 기존
`verify-sites-fullstack-artifact.test.js`가 같은 계약을 직접 검증하도록 확장해
추가하지 않았다. `smoke-hosting-matrix.mjs`와 CLI integration test source는 기존
동작으로 요구사항을 충족해 수정하지 않고 회귀 검증만 수행했다.

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 기존 `build`,
`build:cloud-run`, `build:sites`, local full-stack smoke와 Cloud Run fallback
의미는 유지했다. CLI origin 선택은
`--server > CODEX_USAGE_PROFILE_URL > stored credential origin > production default`
순서이며, 다른 origin으로 file credential을 보내지 않는 기존 방어도 유지했다.
Site metadata, runtime environment, OAuth app, access policy와 원격 배포 상태는
변경하지 않았다.

## 검증 결과

실행 명령:

```bash
node --test packages/codex-usage-profile-cli/test/config.test.js
node --test packages/codex-usage-profile-cli/test/cli.test.js
node --test packages/codex-usage-profile-cli/test/integration.test.js
node --test scripts/__tests__/verify-sites-fullstack-artifact.test.js
npm run build:production
npm run verify:sites-fullstack
npm run build
npm run build:cloud-run
npm run build:sites
npm run smoke:hosting-matrix
npm pack --dry-run --workspace packages/codex-usage-profile-cli
npm run smoke:sites-fullstack:local
npm test
git diff --check
```

결과:

- OK — CLI 대상 테스트 19개 통과. 기본 production origin, explicit override,
  stored credential origin 우선순위와 cross-origin credential 거부를 확인했다.
- OK — artifact verifier 테스트 5개 통과.
- OK — `build:production`이 `dist/client`, `dist/server/index.js`,
  `dist/server/wrangler.json`, `dist/.openai/hosting.json`과 D1 migration 2개를
  생성했다.
- OK — production artifact 검증 결과 client file 7개, Worker JS file 2개,
  migration 2개, Worker raw 3,823,996 bytes, gzip 2,129,825 bytes였다.
- OK — Sites packaging helper가 최종 `dist/`를 saved-version archive 입력으로
  패키징했다. 검증용 임시 archive는 확인 뒤 삭제했다.
- OK — 기존 `build`, `build:cloud-run`, `build:sites`가 모두 통과했다.
- OK — hosting matrix에서 Cloud Run canonical, Sites sample mirror와 fallback이
  모두 정상으로 확인됐다.
- OK — local full-stack smoke가 route 15개를 검증했다.
- OK — CLI package dry-run은 13 files, package 14.2 kB, unpacked 49.8 kB였고
  registry publish는 수행하지 않았다.
- OK — 전체 테스트 438개 중 432개 통과, 6개 환경 의존 테스트 스킵,
  실패 0개였다. D1/Miniflare 테스트는 샌드박스 로컬 소켓 제약을 피한 정상
  로컬 런타임에서 완료했다.
- OK — `git diff --check` 통과.

## 잔여 위험

- `npm ci`가 기존 dependency tree의 audit 결과로 low 1개, high 6개를
  보고했다. Stage 1은 lockfile과 dependency version을 변경하지 않았으며,
  임의의 audit fix는 범위 밖이라 적용하지 않았다.
- CLI 기본 origin은 현재 owner-only Site를 가리킨다. 공개 접근 전환 전에는
  일반 사용자가 ChatGPT access gate를 만나며, 이는 Stage 5/6 승인 전까지
  의도된 상태다.
- production D1/R2 lifecycle과 안전한 운영 도구는 아직 구현되지 않았다.
  Stage 2 승인 전에는 원격 data mutation이나 maintenance를 수행할 수 없다.

## 다음 단계 영향

- Stage 2는 검증된 `dist/` package 계약과 CLI production origin을 전제로
  D1/R2 lifecycle, retention, account deletion과 default-disabled maintenance
  surface를 구현한다.
- Stage 2에서도 Site deployment, OAuth app, access policy와 실제 원격 data는
  변경하지 않는다. 원격 candidate 작업은 별도 Gate A가 있는 Stage 4까지
  진행하지 않는다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2로 진행한다.
