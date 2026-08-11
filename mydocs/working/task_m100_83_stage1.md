# Task #83 Stage 1 보고서 — production artifact local-path 보정

GitHub Issue: [#83](https://github.com/postmelee/codex-usage-profile/issues/83)
구현계획서: [`task_m100_83_impl.md`](../plans/task_m100_83_impl.md)
Stage: 1

## 단계 목적

Cloudflare Vite plugin이 build 중 사용하는 `dist/server/.vite/manifest.json`을 조기에 건드리지 않으면서, 전체 build가 성공한 뒤 production artifact에서만 제거한다. production verifier의 absolute-path·credential·secret 차단 계약은 유지하고, production과 alternate local-smoke output 모두 같은 finalization 경계를 거치도록 한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `scripts/finalize-sites-fullstack-artifact.mjs` | Vite build 뒤 exact `server/.vite/manifest.json`만 제거하고 빈 `.vite` directory를 정리하는 finalizer와 CLI를 추가했다. output/server/metadata symlink와 비정상 file type은 거부하며 경로·manifest 내용은 출력하지 않는다. |
| `scripts/__tests__/finalize-sites-fullstack-artifact.test.js` | manifest 제거, 부재 no-op, unexpected metadata 보존, symlink manifest/directory 거부와 Worker runtime 파일 바이트 보존 5건을 검증한다. |
| `package.json` | `build:sites-fullstack`의 Vite 성공 뒤 finalizer를 실행하도록 canonical build chain을 연결했다. |
| `scripts/smoke-sites-fullstack-local.mjs` | alternate `dist-sites-fullstack-local-smoke` output을 finalizer CLI의 exact 인자로 전달한다. |
| `mydocs/orders/20260808.md` | #83 진행 상태를 Stage 1 완료·Stage 2 승인 대기로 갱신했다. |

## 본문 변경 정도 / 본문 무손실 여부

코드 작업이므로 문서 본문 무손실 여부는 해당 없다. 제품 UI, Worker route, renderer, OAuth/CLI, D1/R2, migration, public API와 cache header는 변경하지 않았다. 기존 `verify-sites-fullstack-artifact.mjs`와 `verify-sites-production-artifact.mjs`도 수정하지 않아 독립 보안 경계를 그대로 유지했다.

Cloudflare plugin은 Worker build manifest를 읽어 imported asset을 client output으로 이동하므로 build hook 내부에서는 manifest를 유지한다. 최종 `wrangler.json`, Worker entry와 emitted JS/Wasm/font가 manifest를 runtime에서 참조하지 않는 것을 확인한 뒤 npm build chain의 마지막 명령에서만 제거했다.

## 검증 결과

실행 명령:

```bash
node --test \
  scripts/__tests__/finalize-sites-fullstack-artifact.test.js \
  scripts/__tests__/verify-sites-fullstack-artifact.test.js \
  scripts/__tests__/verify-sites-production-artifact.test.js
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm run smoke:sites-fullstack:local
test ! -e dist/server/.vite/manifest.json
test ! -e dist-sites-fullstack-local-smoke/server/.vite/manifest.json
rg -n '/Users/|/home/[^/[:space:]]+/|[A-Za-z]:\\\\Users\\\\' \
  dist dist-sites-fullstack-local-smoke
git diff --check
```

결과:

- OK — finalizer와 두 artifact verifier focused test 22개가 통과했다.
- OK — production build가 Worker·client build 뒤 `manifestRemoved=true`, `preservedEntryCount=0`으로 종료됐다.
- OK — full-stack verifier는 client file 7개, Worker file 2개, migration 5개와 hosted linkage를 확인했다.
- OK — production verifier는 artifact 4,869,362 bytes, Worker raw 3,973,716 bytes, gzip 2,159,965 bytes와 exact binding/migration/security 계약을 확인했다.
- OK — production과 local-smoke output 모두 `.vite/manifest.json`이 없고 절대 사용자 경로 검색 결과가 0건이다.
- OK — 두 output 모두 최종 `dist/server` runtime file 8개를 유지했다.
- OK — local full-stack smoke가 OAuth·CLI·migration readiness·D1/R2·card/OG를 포함한 42개 route를 통과했다.
- OK — `git diff --check`가 경고 없이 통과했다.

## 잔여 위험

- canonical `npm run build:production`과 local full-stack smoke는 finalizer를 항상 실행하지만, 개발자가 Vite config를 직접 호출하면 post-build 정리가 생략될 수 있다. Stage 2는 canonical build command로 exact candidate와 package archive를 만들고 archive 자체를 다시 검사한다.
- Cloudflare plugin이 향후 `.vite`에 manifest 외 파일을 추가하면 finalizer는 해당 파일을 삭제하지 않는다. 현재 build는 preserved entry 0건이며, 새로운 entry는 production verifier와 Stage 2 archive scan에서 검토한다.
- 원격 Sites package helper가 최종 archive에 어떤 entry를 포함하는지는 아직 local `dist/` 검증만으로 확정하지 않았다. Stage 2에서 package archive의 파일 목록과 금지 문자열을 별도로 검사한다.

## 다음 단계 영향

- Stage 2는 이 Stage commit의 clean checkout에서 전체 test/E2E/build/verifier를 실행한다.
- Sites helper가 만든 임시 archive에서 `.vite/manifest.json`, 절대 경로, credential·secret·fixture token과 migration `1..5` exact set을 확인한다.
- Stage 2까지 원격 Site, access, environment, D1/R2와 saved version은 변경하지 않는다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 exact local candidate와 archive preflight로 진행한다.
