# Task M100 #57 Stage 4 완료보고서

GitHub Issue: [#57](https://github.com/postmelee/codex-usage-profile/issues/57)
구현계획서: [`task_m100_57_impl.md`](../plans/task_m100_57_impl.md)
Stage: 4

## 단계 목적

Stage 3에서 고정한 immutable `codex-usage-profile@0.1.1` candidate를
승인된 commit과 annotated tag로 게시했다. GitHub Actions의 Node
20/22/24 검증, trusted publisher staged package와 maintainer 2FA를 거쳐
public npm version을 생성하고 registry, provenance, clean execution과
production submit/status를 검증했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `README.md` | public `0.1.1`과 PATH prefix 불필요 상태 반영 |
| `docs/cli-submit.md` | immutable public `0.1.1`과 production smoke 상태 반영 |
| `docs/npm-release.md` | exact tag, Actions run, tarball, provenance와 production 결과 기록 |
| `mydocs/orders/20260730.md` | Stage 4 완료와 단계 승인 대기 상태 기록 |
| `mydocs/working/task_m100_57_stage4.md` | release와 production 검증 결과 기록 |

published npm tarball에 포함된 package README와 package source는 Stage 3
tag 이후 수정하지 않았다. Stage 4 문서 commit은 release tag보다 뒤에
위치하며 immutable package artifact의 내용이나 digest를 변경하지 않는다.

## release 결과

| 항목 | exact 결과 |
|---|---|
| source commit | `4093f3813ee88ac1abad31c21a6bf8bb58f09383` |
| annotated tag | `codex-usage-profile-v0.1.1`, source commit을 직접 가리킴 |
| package | public `codex-usage-profile@0.1.1` |
| dependency | exact `codex-usage-analyzer@0.4.1` |
| Actions | [`30518613039`](https://github.com/postmelee/codex-usage-profile/actions/runs/30518613039), success |
| verify matrix | Node 20, 22, 24 모두 success |
| publish path | GitHub OIDC trusted publisher → npm staged package → maintainer 2FA 승인 |
| tarball | `codex-usage-profile-0.1.1.tgz`, 13 files, packed 14,451 bytes, unpacked 50,500 bytes |
| SHA-1 | `4eeafe6d095f923f5bd0501c7639a649e9fa65cf` |
| SHA-512 | `sha512-jj6jOdl0sH8om39rD5WTN2g3YiZ2LyuDMnOl+haUQXr1PigezLuQKmZJwAJLGFHp44kBAoipcP6W65LZTabsoQ==` |
| dist-tag | `latest=0.1.1` |
| provenance source | repository, `publish-npm.yml`, release tag, source commit와 run이 exact 일치 |

npm attestation의 package subject와 SHA-512는 reviewed candidate와
일치했다. SLSA provenance는 GitHub-hosted builder, `npm-publish`
environment, exact tag와 Actions run을 가리킨다. 장기 npm token 또는
GitHub environment publish secret은 사용하지 않았다.

## production smoke

저장소와 분리한 실행 위치에서 다음 사용자 명령을 별도 PATH prefix 없이
검증했다.

```bash
npx --yes codex-usage-profile@0.1.1 --version
npx --yes codex-usage-profile@latest --version
npx --yes codex-usage-profile@latest submit --json
npx --yes codex-usage-profile@latest status --json
```

결과:

- exact version과 `@latest`는 모두 `0.1.1`을 실행했다.
- submit은 `accepted`였고 Account Usage Contract v1만 전송했다.
- status는 방금 제출된 latest usage의 contract/capture/upload metadata를
  인식했다.
- owner handle과 profile URL은 기존 계정과 일치했다.
- profile visibility는 `private`를 유지했다. publish/unpublish 또는 public
  card 범위는 변경하지 않았다.
- prompt, response, tool data, raw usage aggregate, Codex/OpenAI credential,
  GitHub OAuth credential와 local session file은 전송·출력·보고하지 않았다.

source repository root에는 같은 이름의 private workspace가 있으므로
public `npx` clean execution은 저장소 밖의 격리 위치에서 수행했다. 이는
일반 npm 사용자의 실행 조건이며 public package bin과 tarball 자체의
문제가 아니다.

## 검증 결과

실행·확인 항목:

```bash
npm view codex-usage-profile@0.1.1 \
  name version dependencies bin dist.shasum dist.integrity \
  dist.fileCount dist.unpackedSize gitHead --json
npm view codex-usage-profile dist-tags --json
npm run verify:npm-release
npm run smoke:npm-package:local
npm run scan:public-release
npm audit --workspace packages/codex-usage-profile-cli --omit=dev --json
git diff --check
```

- OK — registry metadata의 version, bin, exact analyzer dependency,
  `gitHead`, file count, unpacked size와 digest가 Gate B 값과 일치했다.
- OK — `latest`는 `0.1.1`을 가리킨다.
- OK — Actions Node 20/22/24 verify와 staged publish job이 모두
  success였다.
- OK — release verifier는 reviewed 13-file tarball과 exact digest를
  재현했다.
- OK — isolated local tarball smoke 6개 경계가 통과했다.
- OK — public release scanner는 blocker 0, 기존 Gate A 공개 승인 review
  12를 유지했고 신규 승인 범위 이탈이 없었다.
- OK — 공개 CLI workspace의 production dependency audit 결과는
  vulnerability 0건이다.
- OK — prefix 없는 production submit/status와 visibility 불변이
  확인됐다.

## 본문 변경 정도 / 본문 무손실 여부

기존 `0.1.0` bootstrap/provenance/recovery 이력과 immutable 정책은
삭제하거나 재작성하지 않았다. Account Usage Contract v1, service origin,
identity-free 전송, credential, backend/Sites와 UI 계약도 변경하지 않았다.

문서 변경은 Stage 3 candidate 상태를 실제 public `0.1.1` 결과로
전환하고 exact release 증적을 추가한 범위에 한정한다.

## 잔여 위험

- `0.1.1`과 tag는 immutable이다. 이후 결함은 같은 version을 수정하지
  않고 별도 patch와 provenance로 복구해야 한다.
- standard app fallback은 analyzer `0.4.1`이 고정한 네 macOS 후보만
  지원한다. 비표준 설치는 공식 Codex CLI를 PATH에 노출해야 한다.
- npm package tarball의 README는 immutable candidate 시점의
  “prepared for provenance publishing” 문구를 보존한다. package 기능,
  version, 설치 명령과 registry 상태에는 영향을 주지 않으며 다음 patch
  candidate에서 현재 release 표현으로 갱신할 수 있다.
- 이번 smoke는 기존 owner credential과 private profile을 사용했다.
  visibility를 변경하지 않았고 공개 카드 흐름을 재실행하지 않았다.

## 다음 단계 영향

- Stage 4 승인 뒤 `task-final-report` 절차로 최종 보고서를 작성하고
  `publish/task57` branch와 `devel` 대상 PR을 준비한다.
- PR merge와 `pr-merge-cleanup` 완료 전에는 #55 skeleton task를
  시작하지 않는다.

## 승인 요청

- public `0.1.1` release, provenance와 production smoke 결과를 승인하면
  Task #57 최종 보고서와 PR 게시 단계로 진행한다.
