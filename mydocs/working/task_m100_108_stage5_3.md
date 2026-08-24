# Task #108 Stage 5.3 중간 보고 — Gate F0 production parity read-only preflight

GitHub Issue: [#108](https://github.com/postmelee/codex-usage-profile/issues/108)
구현계획서: [`task_m100_108_impl.md`](../plans/task_m100_108_impl.md)
Stage: 5.3 / Gate F0

## 단계 목적

Task #122 종료 상태와 production baseline을 변경 없이 대조하고, 최신 exact `main`에서
production target archive를 새로 생성해 Gate F1의 공개 배포·migration 6 입력을 고정한다.
이 단계는 credential 발급, saved version 생성, 배포, access/environment 변경과 D1/R2 쓰기를
수행하지 않는다.

## 산출물

| 산출물 | 결과 |
|---|---|
| Stage5 read-only handoff | owner-only version 36, exact `main`, migration 1–6과 안전 환경을 재확인했다. |
| production read-only baseline | public version 2, 이전 source, migration 1–5와 안전 환경을 재확인했다. |
| production Gate F1 candidate | exact `main` production archive의 project/origin/binding/migration·digest 검증을 완료했다. |
| 계획·오늘할일 | Gate E를 #125로 분리하고 Gate F0/F1/F2 승인 경계를 상위·구현계획과 오늘할일에 일치시켰다. |

검증용 detached worktree와 archive는 Gate F0 종료 뒤 삭제했다. Gate F1에서는 승인 시점의
exact `main`을 다시 확인하고 새 archive를 다시 생성하며 이번 검증 archive를 재사용하지 않는다.

## 본문 변경 정도 / 본문 무손실 여부

제품 source와 공식 사용자·운영 문서는 수정하지 않았다. 변경은 Task #108 상위·구현계획,
오늘할일과 본 중간 보고에 한정된다. Task #122 source가 포함된 exact `main`은
`dfc80d0b867bdb6a9afc002439d478ffb0aa38dd`, tree는
`a9148ff2c38df90e6629c63a20b93c0292880ab3`이며 production candidate도 이 source에서 만들었다.

## 검증 결과

실행 범주:

```bash
git rev-parse origin/main origin/devel HEAD
npm ci --ignore-scripts
npm run package:sites-target -- --target production --expected-project-id {live_production_project} --source-sha {exact_main} --archive {external_archive} --package-helper {approved_sites_package_helper}
npm run verify:sites-fullstack
npm run verify:sites-production
npm run scan:public-release
npm view codex-usage-profile dist-tags versions --json
git diff --check
git status --short
```

Sites read-only 검증:

- production·stage5 `get_site`, `list_site_versions`, `get_environment_variables`
- production·stage5 `read_database_overview`, `schema_migrations` bounded row read
- stage5 `account_deletion_operations` bounded row read
- production·stage5 anonymous root·health HTTP status

결과:

- **OK — production baseline**: Site는 active/public, version 2/source
  `fae45095ddfe24a3fb03c4ec91a6e2a20900e005`, access revision 10, environment revision 2다.
  migration은 exact `[1,2,3,4,5]`이고 `account_deletion_operations` table이 아직 없다.
  maintenance는 disabled, service는 normal이며 operator token key는 없다. anonymous root와
  health는 200이다.
- **OK — Stage5 handoff**: Site는 active/custom owner-only, version 36/source exact `main`,
  access revision 62, environment revision 119다. migration은 exact `[1,2,3,4,5,6]`이고
  기존 account deletion operation 1건은 `structured`, lease 없음으로 유지됐다. maintenance는
  disabled, service는 normal이며 operator token key는 없다. anonymous root와 health는 401이다.
- **OK — resource boundary**: production과 Stage5는 서로 다른 Site project를 사용하고 각
  logical `DB` binding을 가진다. production은 12개, Stage5는 migration 6의 operation table을
  포함한 13개 application table을 누락·절단 없이 반환했다. raw row·secret 값은 기록하지 않았다.
- **OK — exact production candidate**: archive는 3,105,684 bytes, SHA-256
  `0b51eb555653f44accb30317a87afcd42e4bfc763aa56b02fe96d5c8b0d4bc42`, manifest SHA-256
  `5e94a6eec90fde18ee45e4e714851a2fdae44ef06c0e3dba19890ef14d4ca335`다. canonical production
  project/origin, `DB`·`PROFILE_MEDIA`, Worker `ASSETS`, ordered migration `0001`~`0006`, archive
  재추출과 credential·절대 path 검사를 모두 통과했다.
- **OK — artifact verifier**: full-stack artifact는 client 12 files, Worker 2 files,
  migration 6 files다. production verifier는 artifact 5,409,933 bytes와 binding 3개를 확인했다.
- **OK — public release scan**: 3,058 blobs, blocker 0이다. 기존 review 69건과 synthetic
  credential/binary info만 남았다.
- **OK — npm baseline**: registry는 `latest=0.1.3`이고 공개 version은 0.1.0~0.1.3이다.
  Stage 5에서 npm 재게시가 필요하지 않다.
- **OK — remote mutation 0**: source credential, saved version, deployment, access/environment,
  D1/R2와 Stage5 operation을 변경하지 않았다.

## Gate F1 exact 입력

Gate F1은 다음 범위를 하나의 운영 변경 창으로 실행하되 각 mutation은 작업지시자의 별도
명시 승인 뒤에만 시작한다.

1. 실행 직전 `origin/main`이 Gate F0 exact source와 같은지 확인한다. 다르면 새 source와
   archive 증적을 다시 제시하고 중단한다.
2. exact `main` production archive를 새로 생성하고 source credential을 요청별 authorization
   header로만 사용해 saved version 1개를 만든다.
3. production public access는 유지하되 temporary maintenance mode와 일회성 operator secret을
   설정한 뒤 승인된 saved version을 배포한다.
4. authenticated readiness가 expected 1–6/applied 1–5일 때만 migration 6을 한 번 적용한다.
5. expected/applied 1–6과 operation table을 확인한 뒤 operator secret을 제거하고 maintenance
   disabled·service normal·public 상태로 복구한다.

source/archive mismatch, environment credential의 비노출 전달 실패, readiness drift,
migration 실패 또는 예상 밖 production data 변화가 있으면 maintenance 상태에서 중단하고
관찰 결과를 보고한다. migration 6 적용 전에는 이전 saved version application rollback이
가능하지만, migration 적용 뒤 새 production deletion operation이 생기면 임의 rollback하지 않는다.

## 잔여 위험과 승인 경계

- production은 현재 공개 서비스다. Gate F1 배포와 temporary maintenance는 사용자 요청에
  영향을 줄 수 있으므로 Gate F0 통과가 자동 승인이 아니다.
- migration 6은 additive지만 live D1 write다. 공개 배포 승인과 분리해 exact apply 승인을 받는다.
- Gate F2의 disposable production account 삭제는 별도 파괴적 승인 대상이다. test owner를
  확정할 수 없으면 기존 owner를 삭제하지 않고 Stage 5 완료를 주장하지 않는다.
- Stage5 live recovery·data disposal은 #125 범위다. #108은 Stage5 state를 계속 변경하지 않는다.
- `packages/.DS_Store`는 작업지시자 측 추적되지 않은 파일로 판단해 수정·삭제·커밋하지 않는다.

## 다음 단계 영향

Gate F1 승인 전에는 production saved version·deployment·environment·D1/R2를 변경하지 않는다.
승인되면 exact-main production deploy와 migration 6, final safe environment 복구까지만 수행하고
결과를 보고한다. production full user-flow와 destructive account deletion smoke는 Gate F2로
분리한다.

