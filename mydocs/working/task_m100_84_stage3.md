# Task #84 Stage 3 보고서 — exact-main owner-only saved version과 protected smoke

GitHub Issue: [#84](https://github.com/postmelee/codex-usage-profile/issues/84)
구현계획서: [`task_m100_84_impl.md`](../plans/task_m100_84_impl.md)
Stage: 3

## 단계 목적

merged main의 exact source를 새 production artifact로 만들고 기존 Sites project에
saved version 1개로 저장한 뒤, access를 owner-only로 유지한 채 D1 readiness,
maintenance 복원, OAuth·packed CLI·owner/public profile·card/media 계약을
검증한다. 이 Stage는 Gate C 입력을 확정하는 단계이며 Site access를 public으로
전환하거나 X·Threads·카카오톡 외부 미리보기를 실행하지 않는다.

## 산출물

| 파일·원격 산출물 | 변경 요약 |
|---|---|
| Sites saved version 24 | exact main `0c804733e41988467ecd7fbd8e6a152cbfc2fad0`과 22-file production archive를 저장 |
| Sites owner-only deployment | version 24를 maintenance 검증용 revision 86과 safe baseline revision 87로 private deploy |
| `mydocs/working/task_m100_84_stage3.md` | exact source, 배포, protected smoke, cleanup과 Gate C 경계 기록 |
| `mydocs/orders/20260812.md` | #84를 Stage 3 완료 및 Gate C 승인 대기 상태로 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

제품 source와 승인된 구현계획서 본문은 변경하지 않았다. merged main의 detached
clean worktree에서 dependency, test, build와 archive를 재생성했고 task branch에는
이 단계 보고서와 오늘할일만 반영한다. 원격에서는 기존 project linkage와 access
revision을 유지하면서 saved version 1개, 두 private deployment, temporary
maintenance environment와 protected smoke state만 변경했다. 단기 source
credential, maintenance token, Sites bypass token과 CLI service token은 문서,
Git config, URL과 source에 기록하지 않았고 사용 직후 폐기했다.

## 검증 결과

실행 명령:

```bash
npm ci
npm test -- --test-concurrency=1
npm run test:e2e
npx playwright test --config=playwright.stage3b.config.js
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm audit --omit=dev
npm run sites:profile-maintenance -- readiness \
  --origin https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site
git diff --check
git status --short
```

결과:

- **OK — exact source**: origin/main과 Sites source branch는
  `0c804733e41988467ecd7fbd8e6a152cbfc2fad0`, tree
  `64e7fdb89c0ed1e3cceed44d56007c5c19064eff`로 일치했다. source push는
  per-command authentication만 사용했고 원격 ref exact-match 뒤 version을
  저장했다.
- **OK — dependency와 Node 검증**: `npm ci`는 127 packages를 설치했다.
  Node test 727개 중 721개가 통과했고 환경 조건부 6개만 skip, 실패는
  0개였다. production dependency audit는 취약점 0개였다.
- **OK — E2E 75/75**: 최초 exact command는 다른 사용자 프로젝트가
  `127.0.0.1:5173`을 점유한 상태에서 `reuseExistingServer`가 그 페이지를
  재사용해 실패했다. 해당 프로세스를 변경하지 않고 검증 전용 포트 5184와
  포트 기대값만 임시 정합화해 동일 exact-main suite 75개를 모두 통과시켰고,
  임시 설정과 기대값 변경은 즉시 되돌렸다.
- **OK — production artifact**: build finalizer는
  `manifestRemoved=true`, `preservedEntryCount=0`으로 완료됐다.
  full-stack verifier는 client 8개, Worker 2개, migration 5개와 Worker raw
  3,998,544 bytes를 확인했다. production verifier는 artifact 5,120,248 bytes,
  binding 3개와 migration 5개를 확인했다.
- **OK — package와 saved version**: local tar는 regular file 22개,
  2,857,360 bytes, SHA-256
  `69d8dd6b6d7bd971920fc79cecbc0af918ac5268c42266c0c44870e28b24b5ed`였다.
  Sites가 저장한 version 24는 source exact main, archive file 22개,
  5,140,480 bytes와 content hash
  `sha256:d0bdefedaf7db7bd493f521fbabdf472ae4643f09837bd49fa423bf23cd04d48`를
  기록했다.
- **OK — owner-only deploy와 readiness**: access는 revision 56,
  `custom`, owner 1명, group 0개, external visitor 0명으로 유지됐다.
  version 24의 environment revision 86 private deployment가 성공한 상태에서
  read-only readiness는
  `expectedVersions == appliedVersions == [1,2,3,4,5]`,
  `ready=true`였다. migrate, repair, schema downgrade와 data deletion은
  실행하지 않았다.
- **OK — safe baseline 복원**: readiness 직후 operator secret을 제거하고
  maintenance `disabled`, service `normal`인 revision 87을 같은 version
  24로 private deploy했다. 보호 요청에서 root와 `/healthz`는 `200`,
  operator route는 generic `404`였다.
- **OK — OAuth/session**: 기존 owner session의 settings와 profile을 확인하고
  logout 뒤 anonymous settings로 전환되는 것을 검증했다. GitHub OAuth
  재로그인은 원래 root-query settings로 복귀했고 owner 계정과 public
  visibility를 다시 불러왔다. account menu의 프로필 이동은 홈으로 떨어지지
  않고 canonical `/?view=profile` owner 화면을 열었다.
- **OK — packed CLI 0.1.1**: exact-main workspace tarball 13 files,
  14,831 bytes를 임시 cache/config에서 실행했다. owner-only access를 바꾸지
  않는 loopback bridge로 device login, approval, Contract v1 submit
  `accepted`, status 반영을 확인했다. 새 server token은 settings에서
  폐기한 뒤 status가 revoked로 거부됐고 local logout 뒤 credential file은
  0개였다. bridge, tarball, cache와 temporary config는 제거했다.
- **OK — owner profile·settings·card**: owner profile과 card avatar/image가
  decode 완료 상태로 렌더됐고 Share Studio는 이미 준비된 blob card를
  사용했다. dark/light와 en/ko를 각각 저장해 1497×918 preview를 확인한 뒤
  baseline dark/en으로 원복했다.
- **OK — publish/unpublish**: public baseline에서 owner/public SPA와
  `/api/share/{handle}` handoff를 확인했다. private 전환 뒤 owner preview는
  유지되고 card/social media는 `404`였으며, republish 뒤 card, social과
  public profile JSON이 다시 `200`이었다. 최종 visibility는 public이다.
- **OK — card/social/cache**: query 없는 dark 호환과 dark/light × en/ko
  card가 GET `200`, HEAD `200`, If-None-Match `304`, matching ETag,
  `public, no-cache, must-revalidate`, 1497×918을 반환했다. social image도
  같은 GET/HEAD/304 계약과 2400×1260을 반환했다.
- **OK — canonical metadata와 locale**: crawler `/api/share/{handle}`은
  self canonical, matching `og:url`, revisioned personalized
  `og:image`, `summary_large_image`를 반환했다. saved locale ko에서
  `og:locale=ko_KR`, baseline en 원복 뒤 `og:locale=en_US`를 확인했다.
- **OK — observability와 비용 경계**: 최근 error-only 12 events는 이 Stage가
  의도적으로 발생시킨 private/public card, revoked status와 닫힌 operator의
  bounded `404/410`이며 paired Worker outcome은 모두 `ok`였다. 5xx,
  credential·identity·usage body 노출, plan upgrade와 결제 요구는 없었다.
- **OK — cleanup과 최종 원격 상태**: version 24/source exact main,
  environment revision 87, access revision 56을 재확인했다. temporary
  maintenance/source credential, operator secret, packed CLI token/local
  credential, bridge, build archive와 detached worktree를 모두 정리했다.

## 잔여 위험

- Site access는 여전히 owner-only이므로 anonymous/crawler의 실제 public
  reachability, privacy/non-enumeration, X·Threads·카카오톡 preview는 아직
  검증되지 않았다. 이는 명시적 Gate C 승인 뒤 Stage 4에서만 실행한다.
- 이번 protected CLI submit의 최신 usage revision과 device record 1개는
  Gate C 재현 기준으로 남아 있다. temporary API token과 session은
  폐기·정리됐으며 raw usage와 device identifier는 보고서에 기록하지 않았다.
- version 23은 immediate application rollback, version 17은 Gate B
  pre-correction reference, version 7은 최초 production baseline이다. rollback은
  owner-only deployment만 허용하고 schema downgrade와 data deletion은 하지 않는다.
- main release CI·branch protection은 #89, Gate C 이후 README·public
  metadata·공개 문서 정합화는 #90의 비차단 후속이다.

## 다음 단계 영향

- Stage 4 Gate C 입력은 version 24/source exact main, owner-only access
  revision 56, environment revision 87, D1 migration exact 1..5,
  health `200`, operator `404`, dark/en public profile baseline이다.
- Gate C 직전 같은 source/version/access/environment/readiness를 다시
  read-only 대조한 뒤에만 access를 public으로 바꾼다.
- public 전환 후 privacy·route·media·cache 전체 matrix와
  `/api/share/{handle}`의 X·Threads·카카오톡 preview를 발행 없이 실측한다.
  stop trigger가 발생하면 먼저 owner-only로 복원하고 version 24 또는
  application 회귀 시 version 23을 private deploy한다.

## 승인 요청

- Stage 3 산출물과 protected smoke 결과를 승인하고 별도로
  **Gate C 승인**하면 Stage 4 public access cutover와 SNS 실측으로 진행한다.
