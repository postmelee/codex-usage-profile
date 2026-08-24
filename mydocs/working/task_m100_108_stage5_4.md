# Task #108 Stage 5.4 중간 보고 — Gate F1 production exact-main 배포와 migration 6

GitHub Issue: [#108](https://github.com/postmelee/codex-usage-profile/issues/108)
구현계획서: [`task_m100_108_impl.md`](../plans/task_m100_108_impl.md)
Stage: 5.4 / Gate F1

## 단계 목적

Gate F0에서 고정한 latest exact `main` production artifact를 기존 public Site에 배포하고,
temporary maintenance 환경에서 D1 migration 6을 한 번 적용한다. 적용 뒤 operator secret을
제거하고 maintenance disabled·service normal·public 상태로 복구한다.

## 산출물

| 산출물 | 결과 |
|---|---|
| production saved version 3 | exact `main` source와 migration 1–6을 포함한 27-file archive를 저장했다. |
| maintenance deployment | environment revision 3의 maintenance 상태로 version 3 배포를 완료했다. |
| production migration 6 | pending migration 6만 새로 적용하고 readiness expected/applied 1–6을 확인했다. |
| final safe deployment | environment revision 4에서 operator secret 제거, maintenance disabled·service normal로 같은 version을 다시 배포했다. |
| Stage5 isolation | Stage5 version/access/environment/migration과 기존 deletion operation이 모두 불변임을 확인했다. |

## 본문 변경 정도 / 본문 무손실 여부

제품 source와 공식 사용자·운영 문서는 수정하지 않았다. 배포 source는 exact `main`
`dfc80d0b867bdb6a9afc002439d478ffb0aa38dd`이며 Gate F1 직전 fetch에서도 Gate F0 이후
변경되지 않았다. source write credential과 maintenance token은 요청별 header·Sites secret으로만
사용했고 URL, Git config, 파일, 출력과 문서에 저장하지 않았다.

검증용 detached worktree와 archive는 배포·최종 검증 뒤 삭제했다. 사용자 측 추적되지 않은
`packages/.DS_Store`는 수정·삭제·커밋하지 않았다.

## 원격 변경 결과

production saved version 3:

- source: `dfc80d0b867bdb6a9afc002439d478ffb0aa38dd`
- Sites content hash:
  `sha256:fb262880766b9543f39c97be44909f2dc1b94a5ce024783afe360cc282740f47`
- archive: 27 files, 5,437,440 bytes
- local candidate: 3,105,674 bytes, SHA-256
  `e1d5cd2a1d721cc38bd793c28eded931eaef6efed834251a89e5855a2d24cbb9`
- manifest SHA-256:
  `5e94a6eec90fde18ee45e4e714851a2fdae44ef06c0e3dba19890ef14d4ca335`

배포:

- maintenance deployment `appgdep_6a8c1b8127bc8191a9cfed95ee350aa2`: succeeded,
  environment revision 3
- final safe deployment `appgdep_6a8c1ba7da408191b37c3a4aa3aa5211`: succeeded,
  environment revision 4
- public access revision 10 유지
- canonical origin 유지:
  `https://codex-usage-profile.meleeisdeveloping.chatgpt.site`

## 검증 결과

실행 범주:

```bash
git fetch origin
npm ci --ignore-scripts
npm run package:sites-target -- --target production --expected-project-id {live_production_project} --source-sha {exact_main} --archive {external_archive} --package-helper {approved_sites_package_helper}
npm run sites:profile-maintenance -- migrate --origin https://codex-usage-profile.meleeisdeveloping.chatgpt.site
npm run sites:profile-maintenance -- readiness --origin https://codex-usage-profile.meleeisdeveloping.chatgpt.site
git diff --check
git status --short
```

Sites 변경·검증 순서:

1. exact `main`을 Sites source branch에 요청별 authorization header로 push했다.
2. saved version 3을 만들었다.
3. `PROFILE_MAINTENANCE_MODE=enabled`, `PROFILE_SERVICE_MODE=maintenance`와 일회성
   `PROFILE_MAINTENANCE_TOKEN` secret을 environment revision 3에 설정했다.
4. version 3을 기존 public access에 배포하고 terminal success를 확인했다.
5. protected migrate를 실행해 `newlyAppliedVersions=[6]`, `appliedVersions=[1..6]`을 확인했다.
6. readiness에서 expected/applied `[1,2,3,4,5,6]`, `ready=true`를 확인했다.
7. token을 제거하고 maintenance disabled·service normal인 environment revision 4로 바꾼 뒤
   같은 version 3을 다시 배포했다.

최종 결과:

- **OK — exact production deployment**: production은 active/public version 3이며 source가
  exact `main`과 일치한다. access revision은 10으로 유지됐다.
- **OK — migration 6**: `schema_migrations`는 exact `[1,2,3,4,5,6]`, application table은
  누락·절단 없이 13개이고 `account_deletion_operations`가 존재한다.
- **OK — no destructive operation**: production deletion operation row는 0건이다. Gate F1은
  계정·session·token·usage·card·R2 object를 삭제하지 않았다.
- **OK — final safe environment**: revision 4, maintenance disabled, service normal,
  operator token key absent다.
- **OK — public route boundary**: anonymous root·health는 200, `/api/auth/me`는 401,
  무인증 maintenance POST는 generic 404다.
- **OK — Stage5 mutation 0**: owner-only/custom version 36, access revision 62,
  environment revision 119, migration 1–6과 기존 structured operation 1건·lease 없음이
  Gate F0와 같다.

## 잔여 위험과 승인 경계

- Gate F1은 service parity와 migration만 검증했다. OAuth login→CLI submit→publish→README/
  revision share→다섯 SNS의 최신 exact-main 전체 사용자 흐름은 Gate F2에 남는다.
- production account deletion end-to-end는 disposable test owner, 외부 `0600` export와 exact
  plan digest/count가 확인된 경우에만 별도 파괴적 승인을 받아야 한다.
- disposable identity를 확정할 수 없으면 기존 production owner를 삭제하지 않으며 destructive
  smoke 성공을 주장하지 않는다.
- Stage5 live recovery·data disposal은 계속 #125 범위이며 #108 Gate F2와 독립이다.

## 다음 단계 영향

Gate F2 승인 전에는 production environment, D1/R2, identity와 Stage5를 더 변경하지 않는다.
Gate F2는 우선 production의 non-destructive 전체 사용자 흐름을 검증하고, destructive account
deletion은 exact 대상·export·plan을 제시한 뒤 다시 별도 승인받는다.

