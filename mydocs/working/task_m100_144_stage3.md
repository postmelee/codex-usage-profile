# Task #144 Stage 3 완료보고서 — Stage5 owner-only 통합 후보 검증

GitHub Issue: [#144](https://github.com/postmelee/codex-usage-profile/issues/144)
구현계획서: [`task_m100_144_impl.md`](../plans/task_m100_144_impl.md)
Stage: 3

## 단계 목적

Stage 2.2에서 확정한 exact main
`6d3e600d2d33bb7a50147075d013ddd9b945d0b1`을 owner-only Stage5에 저장·배포하고,
migration `1..6`, maintenance 안전 종료, CLI·Profile·카드·social·GIF/PNG와
publish/unpublish 경계를 검증한다. production과 npm registry는 변경하지 않는다.

## 산출물

| 항목 | 변경 요약 |
|---|---|
| Stage5 source | configured source repository의 `main`을 exact main `6d3e600...`으로 갱신했다. |
| Stage5 saved version 40 | exact-main production artifact를 저장했다. provider content hash는 `sha256:1d9c2226798eab629f973d5e1461333cfb4ae9d3f18757342aabf8bd79069a7d`다. |
| Stage5 private deployment | maintenance-on migration과 maintenance-off 최종 배포가 성공했고 final environment revision은 131이다. |
| migration/readiness | expected/applied migration이 모두 `[1,2,3,4,5,6]`, newly applied `[]`, ready 상태다. |
| synthetic CLI/Profile | packed CLI `0.1.4` login/status/submit/logout, private preview와 임시 publish/unpublish를 검증했다. |
| 카드·social·GIF/PNG | README 고정 URL, dark/light media geometry·pixel·metadata, 라이트 GIF와 PNG 실제 다운로드를 검증했다. |
| 검증 자격 증명 정리 | smoke CLI 토큰을 서버에서 폐기하고 로컬 credential·임시 package/preload/smoke 파일을 제거했다. SIWC bypass는 사용 토큰을 재회전해 무효화하고 replacement 값을 보관하지 않았다. |
| `mydocs/orders/20260901.md` | Stage 3 완료와 Stage 4 승인 대기 상태를 반영했다. |

## 본문 변경 정도 / 본문 무손실 여부

제품 source, migration, CLI package, lockfile와 tracked hosting manifest는 변경하지 않았다. Task #144
branch에는 이 보고서와 오늘할일만 추가한다. Stage5 remote source/version/environment/deployment와 승인된
검증용 profile visibility·card setting·submit/token 상태만 변경했다.

- exact main: `6d3e600d2d33bb7a50147075d013ddd9b945d0b1`
- exact main tree: `5b3c52e384c3e057902fac5221121243393e13fe`
- replacement application rollback: saved version 39/source
  `0af8439bfa9f97e1eb199a94d0930c1e9b47a7d5`
- final Stage5: saved version 40, custom owner-only access revision 62,
  environment revision 131
- final application profile: 원래 상태인 `public`, `light`, `en`
- 기존 D1/R2 row, account, device, 기존 token/session과 active deletion operation은 삭제·수정하지 않았다.

## source·artifact·배포 결과

- clean exact-main worktree에서 `npm ci`, production build와 full-stack verifier를 통과했다.
- build는 Worker 63 modules와 client 1,839 modules를 변환했고 full-stack artifact는 client 15 files,
  Worker 2 files, migration 6개를 포함했다.
- production artifact 크기는 10,901,144 bytes다.
- Stage5 archive는 8,549,101 bytes, SHA-256
  `bcf8fba97383a6454c356dca2af55ae07052f2839f0ede0ec335d636a5289b5b`다.
- saved version 40은 source `6d3e600...`, provider archive 30 files/10,926,080 bytes이며 local archive와
  같은 exact source에서 생성됐다.
- 최종 private deployment `appgdep_6a96b53c3d0081919bd70e026f5fcbf1`은 saved version 40과
  environment revision 131로 `succeeded`다.
- owner-only SIWC gate 때문에 유지보수 CLI의 maintenance bearer만으로는 operator route에 도달하지
  못했다. 작업지시자 승인 뒤 identity-less bypass를 추가해 요청했고, 사용 직후 회전했다.
- 첫 외부 요청은 sandbox DNS `ENOTFOUND`에서 application mutation 전에 끝났다. environment는 즉시
  disabled/token-absent로 복구했고, 승인된 network 재실행에서 migrate/readiness를 완료했다.
- migration 결과는 applied `[1,2,3,4,5,6]`, newly applied `[]`; readiness는 expected/applied
  `[1,2,3,4,5,6]`, `ready=true`다.
- 최종 `/healthz`는 `200`, maintenance operator route는 generic `404`다.

## synthetic smoke 결과

실행·확인 항목:

```text
packed codex-usage-profile@0.1.4 + isolated credential directory
explicit Stage5 --server login/status/submit/logout
authenticated Profile, private preview, temporary publish/unpublish
README fixed share/card URL equality
card dark/light × en/ko GET·HEAD·If-None-Match
fixed/current/stale/invalid share metadata와 5 crawler user agent
light/dark social PNG pixel·geometry·ETag
Share Studio light GIF/PNG generation·save
ffprobe GIF frame/timing/dimension inspection
Sites access/environment/version와 errors-only Worker log audit
git diff --check
```

결과:

- OK — isolated device login, status와 submit을 통과했다. submit은 `accepted`, non-idempotent였고
  profile은 public을 유지했다.
- OK — submit 전후 README Markdown은 byte 단위로 동일했다. fixed `/api/share/{handle}`와 queryless
  `/u/{handle}/card.png`를 유지했다.
- OK — Share Studio의 X·Threads·LinkedIn·Facebook·Reddit target 다섯 개가 같은 최신 revision URL을
  사용했다. 실제 provider 게시·초안 저장·cache purge는 수행하지 않았다.
- OK — queryless와 dark/light × en/ko 카드 5개는 `1497×918` PNG, cache revalidation, HEAD와
  `304`를 통과했다. selector-free `v` query도 canonical ETag를 바꾸지 않았다.
- OK — light social은 `2400×1260`; canvas/padding은 `[243,245,247,255]`, outline은
  `[208,215,222,255]`, card 안쪽은 `[255,255,255,255]`였다.
- OK — dark social은 같은 `2400×1260`에서 외곽 sample alpha가 모두 0이고 alpha coverage bounds가
  `minX=240, minY=41, maxX=2159, maxY=1218`로 light card geometry와 일치했다.
- OK — fixed share와 Twitter, LinkedIn, Facebook, Threads, Reddit crawler 문서는 같은 metadata를
  반환했다. current revision은 canonical/og/twitter token이 일치했고 stale revision은 current로
  수렴했으며 invalid revision은 `404`로 personalized document를 만들지 않았다.
- OK — 임시 비공개 상태에서 public profile API, queryless·4개 selector 카드와 social 7개 route가
  모두 `404`였다. fixed/revision share는 generic metadata와 packaged sample GET/HEAD로 닫혔다.
- OK — 최종 재게시 뒤 profile/card/social은 원래 `public + light/en` 상태다. README도 초기 값과
  동일하다.
- OK — 라이트 GIF download는 `998×612`, 20 fps, 96 frames, 4.8 seconds, 6,212,844 bytes,
  GIF89a signature와 15,000,000-byte 상한을 통과했다. SHA-256은
  `64e44f4482f6a3710e6278e76db4f295a58cd21b9c3902c3adc664f27c157503`이다.
- OK — 네 시점 GIF frame에서 같은 고정 card geometry와 왼쪽→위→오른쪽→아래로 이동하는 light
  Ocean Border Beam을 시각 확인했다.
- OK — PNG save는 `1497×918`, 146,796 bytes, PNG signature를 통과했다. SHA-256은
  `b63b0173039c7ddb5b1246142f652d382c12ba913d0542b84e7e239e80dbad8a`다.
- OK — smoke가 Downloads에 만든 GIF/PNG는 복구 가능한 휴지통으로 이동했다. 임시 package,
  preload, credential, frame과 HTTP smoke 파일은 제거했다.
- OK — 새 CLI token을 폐기해 active token count를 `2/3 → 1/3`으로 복원했다. isolated logout 뒤
  status는 `No credential found. Run login first.`로 종료했다.
- OK — 빠른 light/dark 원복 시 페이지 이동으로 `PATCH /api/profile/card-settings` 두 건이
  Worker에서 `canceled`됐다. 해당 요청은 error/5xx 없이 취소됐고, 페이지를 유지해
  `카드 설정을 저장했습니다.`를 확인한 재저장·재게시 뒤 public media authority를 다시 검증했다.
- OK — 최근 errors-only Worker log 30건은 info level, 5xx 0, credential/Authorization marker 0이다.
  outcome은 정상 28건과 위 의도한 canceled PATCH 2건이다.
- OK — Stage5 final access는 custom owner-only revision 62, owner 1명·group/external 0명이다.
  environment revision 131은 maintenance disabled·service normal·maintenance token absent다.
- OK — production은 public access revision 10, saved version 5/source `27e8705...`, environment
  revision 12를 유지했다. npm registry도 `latest=0.1.4`, version `0.1.4`로 mutation이 없다.

## 잔여 위험

- owner-only Stage5의 CLI/operator 요청은 Sites SIWC gate와 application credential을 함께 요구한다.
  현재 connector는 bypass create/rotate만 제공하고 명시적 revoke는 제공하지 않는다. 이번에 사용한
  값은 회전으로 무효화했고 replacement 값은 출력·저장하지 않았지만, 다음 작업도 같은 경계를
  사전 Gate로 다뤄야 한다.
- card setting 저장 완료 전에 화면을 이동하면 Worker 요청이 canceled될 수 있다. 원복 판정은 radio의
  local 상태가 아니라 success status, queryless card, explicit variant와 social revision까지 확인해야 한다.
- 실제 X/Threads/LinkedIn/Facebook/Reddit provider preview는 owner-only Stage5에서 게시하지 않았다.
  application target URL·crawler metadata·image response만 검증했다.
- production은 아직 saved version 5/source `27e8705...`다. Task #146 light GIF 변경은 production traffic에
  반영되지 않았다.

## 다음 단계 영향

- Stage 4는 exact main `6d3e600...`의 release checkpoint/provenance를 확인한다. npm package
  `0.1.4`는 이미 게시됐으므로 tag·registry를 다시 publish하지 않는다.
- Stage 5 production 승격은 Stage5에서 검증한 같은 main tree와 production target archive만 사용한다.
- production 배포 전 current public access revision 10, version 5/source `27e8705...`, environment
  revision 12와 maintenance disabled·token absent baseline을 다시 읽기 전용으로 확인한다.
- production hosted smoke에서도 실제 SNS 게시 없이 light social pixel, GIF 1회 생성과 원래
  visibility/card setting 복원을 success status까지 기다린다.

## 승인 요청

- Stage5 saved version 40, migration/readiness, owner-only synthetic smoke와 최종 안전 원복 결과를
  승인하면 Stage 4 release checkpoint/provenance 확인으로 진행한다.
