# Task #144 Stage 4 완료보고서 — Production baseline과 saved version 준비

GitHub Issue: [#144](https://github.com/postmelee/codex-usage-profile/issues/144)
구현계획서: [`task_m100_144_impl.md`](../plans/task_m100_144_impl.md)
Stage: 4

## 단계 목적

Stage 3에서 검증한 exact main
`6d3e600d2d33bb7a50147075d013ddd9b945d0b1`을 production target으로 다시
materialize·검증하고 configured source repository에 push한 뒤 saved version으로 고정한다. 기존
production version 5와 access·environment·migration을 rollback baseline으로 보존하며 public traffic에는
아직 배포하지 않는다.

## 산출물

| 항목 | 변경 요약 |
|---|---|
| production source | configured source repository의 `main`을 `27e8705...`에서 exact main `6d3e600...`으로 fast-forward했다. |
| production saved version 6 | exact-main production artifact를 저장했다. provider content hash는 `sha256:6f905edbff7b7b5ea49a84c5f05bd6843319a59bda4fd47b44d0cabfdbfa53f4`다. |
| rollback baseline | version 5/source `27e8705...`, public access revision 10, environment revision 12와 migration `[1,2,3,4,5,6]`을 보존했다. |
| live 미변경 증적 | live HTML은 기존 `app-BhsP8yO6.js`를 계속 참조하고 exact-main 후보 `app-CYHDJQqV.js`는 아직 제공하지 않는다. |
| `mydocs/orders/20260901.md` | Stage 4 완료와 Stage 5 public deployment 승인 대기 상태를 반영했다. |

## 본문 변경 정도 / 본문 무손실 여부

제품 source, migration, npm package, lockfile, tracked hosting manifest와 공식 production 운영 문서는 수정하지
않았다. Task #144 branch에는 이 보고서와 오늘할일만 추가한다. production remote에서는 configured source
branch와 saved version 하나만 변경했고 deployment, access policy, environment, D1/R2 data에는 mutation을
수행하지 않았다.

- exact main: `6d3e600d2d33bb7a50147075d013ddd9b945d0b1`
- exact main tree: `5b3c52e384c3e057902fac5221121243393e13fe`
- 직전 live/rollback application: saved version 5/source
  `27e8705fdc152534a4e4b726cac32f625a3c7763`
- 새 배포 후보: saved version 6/source `6d3e600...`
- access: public revision 10, owner 1명·group 0명·external visitor 0명
- environment: revision 12, maintenance disabled·service normal·operator secret absent
- data: migration `[1,2,3,4,5,6]`, active account deletion operation 0건

## source·artifact·saved version 결과

- clean exact-main worktree에서 production target을 materialize하고 build·full-stack·production artifact
  verifier를 통과했다.
- production build는 Worker 63 modules와 client 1,839 modules를 변환했다. full-stack artifact는 client
  15 files, Worker 2 files, migration 6개이며 production artifact 크기는 10,901,144 bytes다.
- local production archive는 8,549,123 bytes, SHA-256
  `9c59329536cdad99226dd8357a3e81077290882ddd0487b0d47143adf1b7d1f8`이다.
- 같은 exact source로 Stage5 target도 다시 materialize했다. 두 archive를 풀어 비교한 결과
  `.openai/hosting.json`의 project ID 외에는 Worker, client, migration과 binding 구조가 byte 단위로
  같다. 두 manifest 모두 logical binding `DB`/`PROFILE_MEDIA`를 사용한다.
- short-lived repo-scoped credential은 per-command Git 인증에만 사용하고 출력·파일·Git config에
  저장하지 않았다. production source `main`의 push 전 SHA는 `27e8705...`, push 후 SHA는 exact main
  `6d3e600...`이다.
- saved version 6은 exact source `6d3e600...`, provider archive 30 files/10,926,080 bytes와 content hash
  `sha256:6f905edbff7b7b5ea49a84c5f05bd6843319a59bda4fd47b44d0cabfdbfa53f4`를 반환했다.

## 검증 결과

실행·확인 항목:

```text
production access/version/environment/D1 baseline read-only 확인
schema migration 1..6과 active deletion 0건 확인
exact-main production target materialize·build·package
Stage5 target 재생성과 target identity 외 unpacked tree 비교
configured source branch fast-forward push 전후 remote HEAD 대조
saved version source/archive provenance 대조
saved version 생성 후 access/environment/migration/deletion 재확인
live HTML asset identity, /healthz와 닫힌 operator route 확인
npm release verifier와 public release surface scan
git diff --check
```

결과:

- OK — production preflight는 public revision 10, version 5/source `27e8705...`, environment revision 12,
  maintenance disabled·service normal·operator secret absent였다.
- OK — migration은 순서까지 `[1,2,3,4,5,6]`, active deletion operation은 0건이다. 후보도 같은 migration
  집합을 포함하므로 version 5는 schema-compatible application rollback 후보다.
- OK — production archive는 canonical production project/origin, exact main source, Worker entry,
  logical `DB`/`PROFILE_MEDIA`와 migration 1–6을 포함한다.
- OK — Stage5와 production unpacked product tree는 target project ID 외에 차이가 없다. 따라서 Stage 3에서
  검증한 제품·animation·media tree를 production identity로만 전환한 후보임을 확인했다.
- OK — production source remote `main`은 fast-forward 뒤 exact main과 일치한다.
- OK — saved version 6의 source SHA와 provider archive metadata가 재조회 결과까지 일치한다.
- OK — save 뒤 access revision 10, environment revision 12, migration 1–6, active deletion 0건이 모두
  유지됐다. deploy API는 호출하지 않았다.
- OK — live HTML의 기존 client asset `app-BhsP8yO6.js`와 후보의 `app-CYHDJQqV.js`가 달라 public
  traffic이 version 5에 남아 있음을 독립 확인했다. final `/healthz`는 `200`, 비인증 maintenance operator
  route는 generic `404`다.
- OK — npm release verifier는 immutable `codex-usage-profile@0.1.4`의 14 files, 17,614 packed bytes,
  63,363 unpacked bytes와 기존 SHA-1/SHA-512를 재확인했다. npm publish·tag mutation은 수행하지 않았다.
- OK — public release scan은 blocker 0건이다. 기존 review 73건은 현재 repository 이력·승인된 binary와
  test fixture 범주이며 새 source 변경에서 추가된 blocker가 없다.

## 잔여 위험

- production configured source와 saved version 6은 exact main이지만 public traffic은 의도적으로 아직
  version 5를 실행한다. 실제 사용자는 Stage 5 배포 전까지 Task #146 라이트 카드 GIF 보정을 받지 않는다.
- saved version 6의 실제 hosted runtime·migration·authenticated UI/media는 Stage5에서만 검증했다. production은
  Stage 5에서 maintenance Gate, 같은 migration 집합, public deployment와 비파괴 smoke를 다시 통과해야 한다.
- application rollback 후보는 version 5다. schema는 호환되지만 Stage 5 중 active deletion operation이나
  data drift가 생기면 자동 rollback하지 않고 새 관찰값과 compatibility를 다시 제시해야 한다.

## 다음 단계 영향

- Stage 5는 saved version 6만 사용하고 source/archive를 다시 만들거나 새 version을 추가하지 않는다.
- public access revision 10을 유지한 채 maintenance-on 배포, migration/readiness, maintenance-off 재배포를
  수행하고 final environment를 disabled·normal·operator secret absent로 복원해야 한다.
- production smoke는 실제 SNS 게시 없이 변경 표면 중심으로 수행한다. light social pixel과 GIF 1회 생성,
  README 고정 URL, visibility/card setting 원복을 success status와 public media까지 확인해야 한다.
- Stage 5 완료 뒤에만 `docs/production-hosting.md`의 현재 production version/source/artifact/environment와
  실제 release 이력을 최소 갱신한다.

## 승인 요청

- production source push와 saved version 6 생성, rollback/live 미변경 결과를 승인하면 Stage 5 public
  deployment와 비파괴 production smoke로 진행한다.
