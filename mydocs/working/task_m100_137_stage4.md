# Task #137 Stage 4 보고서 — npm 0.1.4 provenance 게시 검증

GitHub Issue: [#137](https://github.com/postmelee/codex-usage-profile/issues/137)
구현계획서: [`task_m100_137_impl.md`](../plans/task_m100_137_impl.md)
Stage: 4

## 단계 목적

Stage 3에서 검증한 exact main에 immutable annotated tag를 만들고 npm trusted publisher와
maintainer 2FA를 거쳐 `codex-usage-profile@0.1.4`를 공개한다. registry artifact·provenance와 clean
`npx` 동작이 승인된 Stage 1 후보와 같은지 확인하며 production Site는 변경하지 않는다.

## 산출물

| 항목 | 변경 요약 |
|---|---|
| `codex-usage-profile-v0.1.4` | exact main `27e8705fdc152534a4e4b726cac32f625a3c7763`을 가리키는 annotated tag를 생성·push했다. |
| Actions run `32864371385` | Node 20·22·24 verify와 npm staged publish가 성공했다. |
| `codex-usage-profile@0.1.4` | maintainer 2FA 승인 뒤 public registry에 게시되고 `latest=0.1.4`가 됐다. |
| `docs/npm-release.md` | 실측 source/tag/run/tarball/integrity/provenance와 clean registry smoke를 기록했다. |
| `mydocs/orders/20260825.md` | Stage 4 완료와 Stage 5 production 승인 대기 상태를 반영했다. |

## 본문 변경 정도 / 본문 무손실 여부

`docs/npm-release.md`의 기존 `0.1.0`~`0.1.3` immutable 이력과 운영 절차는 보존했다. 현재 상태의
`0.1.4` 후보 문구만 public/latest 상태로 바꾸고 별도 실측 결과 섹션을 추가했다. 제품 source,
workflow, package artifact와 production Site는 수정하지 않았다.

## 검증 결과

실행 명령:

```bash
git rev-parse codex-usage-profile-v0.1.4^{}
gh run view 32864371385 --json status,conclusion,headSha,headBranch,url,jobs
npm view codex-usage-profile@0.1.4 version dist-tags dependencies repository dist --json
npm pack codex-usage-profile@0.1.4 --json --ignore-scripts
# npm attestation publish/provenance payload의 subject·source·tag·workflow·run 대조
env XDG_CONFIG_HOME={isolated} npm_config_cache={isolated} npx --yes codex-usage-profile@0.1.4 --version
env XDG_CONFIG_HOME={isolated} npm_config_cache={isolated} npx --yes codex-usage-profile@0.1.4 --help
env XDG_CONFIG_HOME={isolated} npm_config_cache={isolated} npx --yes codex-usage-profile@0.1.4 status --json
env XDG_CONFIG_HOME={isolated} npm_config_cache={isolated} npx --yes codex-usage-profile@latest --version
env XDG_CONFIG_HOME={isolated} npm_config_cache={isolated} npx --yes codex-usage-profile@latest --help
env XDG_CONFIG_HOME={isolated} npm_config_cache={isolated} npx --yes codex-usage-profile@latest status --json
git diff --check
git status --short
```

결과:

- OK — annotated tag의 peeled commit은 exact main `27e8705`와 같다.
- OK — Actions run `32864371385`에서 Node 20·22·24 package test, exact candidate verifier와 local
  tarball smoke가 모두 성공했다.
- OK — tokenless `npm stage publish`가 성공했고 작업지시자의 npm 2FA 승인 뒤
  `codex-usage-profile@0.1.4`가 public, `latest=0.1.4`가 됐다.
- OK — dependency는 exact `codex-usage-analyzer@0.4.1`, repository directory는
  `packages/codex-usage-profile-cli`로 유지된다.
- OK — registry tarball은 14 files, packed 17,614 bytes, unpacked 63,363 bytes, SHA-1
  `5bf1d4918ab362d7a33a2fcb04c48df356535ed3`, SHA-512
  `sha512-uYnMSdVTUm+srtIAWlCiLVk9TpRInGb3LTfn6R82uZXoSUMuHA6uEpd+jRtT/T1zmA7U+iyEKCaFjMcc7zRxsg==`로
  Stage 1 승인 후보와 완전히 같다.
- OK — publish attestation과 SLSA provenance의 package subject digest가 registry SHA-512와 같고
  exact repository, tag, source commit, workflow와 run `32864371385`를 가리킨다.
- OK — 격리 환경의 exact `@0.1.4`와 `@latest`는 모두 version `0.1.4`, 동일한 command/help와
  canonical production 기본 origin을 제공했다. credential-free status는 둘 다
  `No credential found. Run login first.`로 안전 종료했다.
- OK — production은 Stage 3에서 확인한 public version 4/environment revision 6 baseline 이후 이
  Stage에서 mutation 0건이다.

## 잔여 위험

- npm package는 public이지만 production Site는 아직 이전 version 4 source를 실행한다. 사용자의 새
  CLI 기능을 canonical origin에서 완전히 활성화하려면 Stage 5 exact-main production 배포가 필요하다.
- 실제 production login/stale credential recovery/submit은 Stage 5 배포 뒤 변경 표면 중심으로
  검증해야 한다.

## 다음 단계 영향

- Stage 5는 public access revision 10을 유지한 채 exact main `27e8705` source/archive를 saved version으로
  고정하고 maintenance/migration/health 안전 Gate 뒤 배포해야 한다.
- production 사용자 smoke는 범위를 재조정해 source/version, migration/maintenance/health와 Task #134
  변경 표면만 확인한다. 카드 설정 조합과 SNS 반복 회귀는 추가 수행하지 않는다.

## 승인 요청

- Stage 4 npm 게시·provenance·registry smoke 결과를 승인하면 Stage 5 production source push와 saved
  version 생성 Gate로 진행한다.
