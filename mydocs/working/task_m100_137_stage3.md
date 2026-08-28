# Task #137 Stage 3 보고서 — exact-main Stage5 owner-only 검증

GitHub Issue: [#137](https://github.com/postmelee/codex-usage-profile/issues/137)
구현계획서: [`task_m100_137_impl.md`](../plans/task_m100_137_impl.md)
Stage: 3

## 단계 목적

Stage 2에서 고정한 exact `main`을 owner-only Stage5에 저장·배포하고 migration 1–6, maintenance
복원, CLI·UI 핵심 흐름과 공개/비공개 경계를 검증한다. production과 npm registry는 변경하지 않는다.

## 산출물

| 항목 | 변경 요약 |
|---|---|
| Stage5 source | exact `main` `27e8705fdc152534a4e4b726cac32f625a3c7763`을 configured source repository에 push했다. |
| Stage5 saved version 38 | exact main archive를 저장했다. content hash는 `sha256:17df85f1c5243f942e7aa8c88ef893250fa1b442a7bade55a4acd7e585e6d996`이다. |
| Stage5 private deployment | maintenance-on·off 배포가 모두 성공했고 최종 environment revision은 121이다. |
| Stage5 migration/readiness | expected/applied migration이 모두 `[1,2,3,4,5,6]`이고 ready 상태임을 확인했다. |
| synthetic smoke | 격리된 CLI login/status/submit, private preview, 임시 publish/unpublish, README·revision share 계약과 media 응답을 확인했다. |
| 검증 자격 증명 정리 | 이번 검증에서 만든 최신 CLI 토큰 1개와 격리된 로컬 credential·임시 파일을 제거했다. 기존 토큰과 기존 브라우저 세션은 유지했다. |
| `mydocs/orders/20260825.md` | Stage 3 완료와 Stage 4 승인 대기 상태를 반영했다. |

## 본문 변경 정도 / 본문 무손실 여부

제품 source와 tracked target manifest는 변경하지 않았다. Stage5 remote source/save/environment/deployment와
검증용 계정 상태만 계획된 범위에서 변경했다. 임시 공개 검증 뒤 프로필을 비공개로 복원했으며 기존
D1/R2 데이터, 기존 토큰, 기존 세션은 삭제하거나 수정하지 않았다. production과 npm registry는
Stage 2 baseline을 유지한다.

## 검증 결과

실행·확인 항목:

```text
Sites source/version/archive/deployment provenance 대조
maintenance migrate/readiness 및 maintenance-off 재배포
/healthz, operator route, recent errors-only Worker log 확인
격리 CLI login/status/submit/logout
private preview, 임시 publish/unpublish, README/share/media 계약 확인
Stage5·production access/version/environment read-only 재확인
git diff --check
git status --short
```

결과:

- OK — saved version 38의 source SHA는 exact main `27e8705`와 같고 archive digest도 저장된 값과
  일치한다.
- OK — maintenance-on·off private deployment가 모두 `succeeded`이며 최종 environment revision 121은
  `PROFILE_MAINTENANCE_MODE=disabled`, `PROFILE_SERVICE_MODE=normal`, maintenance token absent 상태다.
- OK — migration readiness의 expected/applied가 순서까지 `[1,2,3,4,5,6]`으로 일치한다.
- OK — Stage5 access revision 62는 custom owner-only, owner 1명·group/external 0명으로 유지됐다.
- OK — `/healthz` 200, operator route 404를 확인했다. 최근 errors-only log에는 의도한 비공개/invalid
  경계의 404만 있고 5xx·Worker failure는 없었다.
- OK — packed CLI `0.1.4`를 격리된 credential 경로와 explicit Stage5 origin으로 login한 뒤
  status·submit을 완료했다. submit은 accepted/non-idempotent였고, logout 뒤에는
  `No credential found. Run login first.`로 종료했다.
- OK — submit 전후 README Markdown은 완전히 동일했고 고정 `/api/share/{handle}` href와 query 없는
  `/u/{handle}/card.png` img를 유지했다.
- OK — 공유 링크와 X·LinkedIn·Threads·Facebook·Reddit target은 모두 같은 새 revision route를
  사용했다. fixed/stale/invalid revision, GET·HEAD·304와 PNG/ETag 계약도 통과했다.
- OK — 임시 공개 smoke 뒤 profile visibility를 private로 복원했다. private 상태에서 personalized
  public profile/card/social은 404, fallback share sample은 200이었다.
- OK — 검증 중 만든 최신 CLI 토큰만 폐기해 active token 수가 2개에서 기존 1개로 복원됐다. 격리된
  로컬 credential과 임시 package/preload/smoke 파일도 제거했다.
- OK — production은 public access revision 10, saved version 4, environment revision 6,
  maintenance disabled·service normal·maintenance token absent를 유지해 mutation 0건이다.
- OK — 작업지시자와 범위를 재조정해 이미 통과한 광범위 card/share smoke 이후 추가 카드 설정 조합과
  SNS 반복 검증은 수행하지 않았다. Task #134 변경 표면은 Stage 1 단위·E2E 검증과 위 핵심 live smoke로
  판정했다.

## 잔여 위험

- npm `0.1.4` tag·trusted publish·registry `latest` 승격은 아직 수행하지 않았다.
- production은 아직 version 4의 이전 source를 실행한다. Stage 5에서는 exact-main 배포 안전 Gate와
  변경 표면 중심의 최소 smoke가 필요하다.
- 로그인했지만 사용량이 없는 새 계정 화면은 Stage 1 E2E에서 검증했다. 기존 Stage5 owner에는 usage가
  있어 remote fresh-owner 상태를 다시 만들기 위한 데이터 삭제·새 계정 생성은 수행하지 않았다.

## 다음 단계 영향

- Stage 4는 exact main `27e8705`에서 annotated tag `codex-usage-profile-v0.1.4`를 push하고 GitHub
  Actions의 Node 20·22·24 검증과 npm trusted publish stage를 확인해야 한다.
- npm 웹 2FA 승인은 작업지시자가 직접 수행한다. 게시 전까지 production은 변경하지 않는다.
- Stage 5 production smoke는 source/version, migration/maintenance/health 안전 Gate를 유지하되 UI·CLI
  검증은 Task #134 변경 표면으로 좁힌다.

## 승인 요청

- Stage 3의 exact-main Stage5 검증과 원상복구 결과를 승인하면 Stage 4 npm tag push Gate로 진행한다.
