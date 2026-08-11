# Task M100 #5 Stage 4 단계 보고서

GitHub Issue: [#5](https://github.com/postmelee/codex-usage-profile/issues/5)
구현계획서: [`task_m100_5_impl.md`](../plans/task_m100_5_impl.md)
Stage: 4

## 단계 목적

`codex-usage-profile` CLI를 npm package로 배포할 수 있는 파일 경계와 metadata를 정의하고, 사용자가 GitHub login부터 analyzer 실행, Account Usage 제출, profile 및 README card 확인까지 수행할 수 있는 Quickstart와 보안 경계를 문서화한다. 현재 Account Usage Contract v1 경로와 legacy UsageSnapshot v2 호환 경로를 구분해 standalone analyzer와 downstream service의 책임이 섞이지 않도록 한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `packages/codex-usage-profile-cli/package.json` | npm metadata, public publish 설정, bin/source/README/LICENSE allowlist 정의 |
| `packages/codex-usage-profile-cli/README.md` | package requirements, Quickstart, command, 전송 범위와 credential 정책 추가 |
| `packages/codex-usage-profile-cli/LICENSE` | 배포 package에 포함할 MIT license 추가 |
| `docs/cli-submit.md` | login, submit, status, logout, local/tarball 실행, endpoint, 오류 처리와 보안 경계 문서화 |
| `README.md` | MVP 흐름, Account Usage Contract v1, 개발 실행, 인증·보안 및 상세 문서 진입점으로 재구성 |
| `docs/codex-usage-analyzer.md` | npm `codex-usage-analyzer@0.2.x` SDK와 downstream ownership 경계로 갱신 |
| `docs/readme-card.md` | 실제 CLI command, submit endpoint, ETag 기반 stable card 갱신 흐름 반영 |
| `docs/usage-snapshot-v2.md` | legacy compatibility 계약임을 명시하고 현재 analyzer 계약과 분리 |
| `mydocs/orders/20260713.md` | Task #5 Stage 4 진행 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

사용자 문서는 현재 구현을 진실 원천으로 삼아 재작성했다. 이전 UsageSnapshot v2 계약 본문과 schema는 호환 경로를 위해 보존했으며, 문서 머리말과 책임 주체 표현만 legacy 계약으로 한정했다. CLI command, endpoint, contract version, credential 저장 위치와 privacy 설명은 구현 및 테스트와 일치하도록 갱신했다.

## 검증 결과

실행 명령:

```bash
npm_config_cache=/private/tmp/cup-npm-cache npm pack --dry-run --workspace packages/codex-usage-profile-cli --json
node packages/codex-usage-profile-cli/bin/codex-usage-profile.js --help
npm ls codex-usage-analyzer --workspace packages/codex-usage-profile-cli
rg -n "(ghp_[A-Za-z0-9]|github_pat_|sk-[A-Za-z0-9]|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|CODEX_ACCESS_TOKEN=.{8,}|CUP_API_TOKEN=.{8,})" packages/codex-usage-profile-cli --glob '!test/**'
npm test
npm run build
git diff --check
```

결과:

- OK: dry-run tarball은 13개 파일, 13,253 bytes이며 `LICENSE`, `README.md`, `bin`, `package.json`, `src`만 포함
- OK: test, `.env`, credential, runtime store, fixture와 bundled dependency가 tarball에서 제외됨
- OK: bin mode `0755`와 shebang을 유지하고 `--help` command가 정상 실행됨
- OK: CLI workspace가 registry `codex-usage-analyzer@0.2.0`을 해석함
- OK: package source에서 credential·private key 형태의 실제 secret pattern이 검출되지 않음
- OK: 전체 단위·통합 테스트 255개 통과
- OK: Vite production build 성공
- OK: whitespace 오류 없음

기본 사용자 npm cache에는 이 저장소와 무관한 root-owned entry가 있어 pack 명령이 실패했으므로, 제품 파일을 수정하거나 권한을 우회하지 않고 isolated temporary cache로 동일 dry-run을 검증했다.

## 잔여 위험

- npm registry publish는 이번 task 범위에서 실행하지 않았고 package README도 아직 배포되지 않은 상태임을 명시한다.
- 기본 production service URL이 확정되지 않아 현재 Quickstart는 `--server` 또는 `CODEX_USAGE_PROFILE_URL` 설정이 필요하다.
- tarball을 실제 설치한 CLI, browser device approval, 로컬 Codex app-server와 실제 analyzer 응답을 잇는 smoke는 Stage 5에서 수행한다.
- GitHub README image proxy cache는 stable URL의 ETag가 변경되어도 사용자 화면 반영이 지연될 수 있다.

## 다음 단계 영향

- Stage 5는 dry-run과 동일한 package를 tarball로 설치해 `login -> submit -> status -> profile/card` 흐름을 검증한다.
- 실제 analyzer smoke는 사용자의 ChatGPT-backed Codex 인증을 사용하므로 명시적 opt-in 환경에서 수행한다.
- smoke 전후 stdout, stderr, credential file permission, runtime store와 repository diff를 검사해 raw token이나 local path가 남지 않는지 확인한다.
- 검증 완료 후 npm publish 및 production service URL 확정은 별도 release 결정으로 남긴다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 Stage 5 end-to-end smoke와 최종 보안 QA로 진행한다.
