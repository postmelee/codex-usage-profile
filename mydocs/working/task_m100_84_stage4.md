# Task #84 Stage 4 보고서 — Gate C public 전환과 SNS 실측

GitHub Issue: [#84](https://github.com/postmelee/codex-usage-profile/issues/84)
구현계획서: [`task_m100_84_impl.md`](../plans/task_m100_84_impl.md)
Stage: 4

## 단계 목적

Stage 3에서 검증한 exact-main production version과 migration readiness를 다시
대조한 뒤 Sites access를 public으로 전환한다. 공개 상태에서 privacy,
non-enumeration, OAuth, packed CLI, profile/card/media/cache 계약을 재검증하고
X·Threads·카카오톡 미리보기를 실제 게시 없이 확인한다. stop trigger가 없으면
public 상태를 유지해 Stage 5 운영 문서 현행화의 기준선으로 확정한다.

## 산출물

| 파일·원격 산출물 | 변경 요약 |
|---|---|
| Sites public access revision 57 | production version 24와 environment revision 87을 그대로 유지한 채 access만 public으로 전환 |
| SNS 미리보기 실측 | app-generated X·Threads intent와 카카오톡 공유 디버거에서 canonical handoff와 card preview 확인 |
| `mydocs/working/task_m100_84_stage4.md` | Gate C cutover, 공개 matrix, privacy, OAuth·CLI, SNS와 최종 안전 상태 기록 |
| `mydocs/orders/20260812.md` | #84를 Stage 4 완료 및 Stage 5 승인 대기 상태로 갱신 |

## 본문 변경 정도 / 본문 무손실 여부

제품 source, migration, README와 공개 문서는 변경하지 않았다. Stage 3의 saved
version 24와 environment revision 87을 재사용했고 새 version 저장이나 deployment,
source push는 없었다. 원격 변경은 승인된 Gate C 범위의 access revision 56에서
57로의 public 전환, 공개 프로필의 일시적인 비공개·재공개, 카드 기본 모양과
언어의 검증용 저장·원복, 검증용 CLI token의 생성·폐기로 한정했다. SNS 게시물은
발행하지 않았고 카카오톡 캐시 초기화도 실행하지 않았다.

## 검증 결과

실행 명령·절차:

```bash
git fetch origin --prune
git rev-parse origin/main origin/devel
node <Gate C public/profile/share/card/social matrix verifier>
npm pack
npx <packed tarball> login
npx <packed tarball> submit
npx <packed tarball> status --json
npx <packed tarball> logout
git diff --check
git status --short
```

브라우저·운영 검증:

- GitHub OAuth logout → login → root-query owner profile 복귀
- owner Share Studio publish → unpublish → owner preview → republish
- X와 Threads의 app-generated share intent 미리보기 확인 후 닫기
- 카카오톡 URL 메타정보 관리에서 canonical share URL 디버그
- Sites access, environment, saved version과 error-only Worker logs 재대조

결과:

- **OK — Gate C 입력 무변경**: origin/main과 Sites version 24 source는
  `0c804733e41988467ecd7fbd8e6a152cbfc2fad0`로 일치했다. version 24는 archive
  22 files, 5,140,480 bytes, content hash
  `sha256:d0bdefedaf7db7bd493f521fbabdf472ae4643f09837bd49fa423bf23cd04d48`를
  유지했다. environment revision 87의 maintenance `disabled`, service
  `normal`도 바뀌지 않았다.
- **OK — public access cutover**: owner-only access revision 56에서 public
  revision 57로 전환했다. 직후와 최종 대조 모두 root와 `/healthz`는 `200`,
  닫힌 operator route는 generic `404`, version 24와 environment revision 87은
  그대로였다.
- **OK — 공개 route·metadata**: public profile JSON, root-query profile SPA,
  canonical `/api/share/{handle}`는 `200`이었다. share 문서는 self canonical과
  matching `og:url`, revisioned social image, `og:locale=en_US`,
  `summary_large_image`를 반환했다.
- **OK — card/social/cache matrix**: query 없는 호환 card와 dark/light × en/ko
  4종은 모두 GET `200`, HEAD `200`, If-None-Match `304`, matching ETag,
  `public, no-cache, must-revalidate`, 1497×918이었다. social image도 같은
  GET/HEAD/304 계약과 2400×1260을 반환했다.
- **OK — privacy와 non-enumeration**: 공개 프로필을 일시 비공개로 바꾸면 owner
  preview는 유지되고 public profile JSON, card와 social media는 `404`였다.
  private handle과 존재하지 않는 handle은 앱 fallback 관점에서 같은 일반
  unavailable 계약을 제공했고 republish 뒤 공개 route가 모두 복원됐다.
- **OK — 카드 설정 원복**: light/ko를 저장해 한국어 locale과 공개 card 반영을
  확인한 뒤 production 기준인 dark/en으로 되돌렸다. 최종 share locale은
  `en_US`, 공개 visibility는 public이다.
- **OK — OAuth 복귀**: logout 뒤 anonymous profile을 확인하고 GitHub OAuth로
  다시 로그인했다. callback은 원래 root-query profile로 돌아왔으며 owner menu와
  profile을 정상 복원했다.
- **OK — packed CLI 수명주기**: package 0.1.1, 13 files, 14,831 bytes를 격리된
  cache/config에서 실행했다. device login 승인, Contract v1 submit `accepted`,
  public status를 확인했다. 새 token 폐기 뒤 status는 revoked로 거부됐고 local
  logout 뒤 credential file은 0개였다. tarball, cache와 temporary config는
  제거했다.
- **OK — X 실측**: 앱이 만든 정확한 share intent에서 link card가 표시됐고
  게시하지 않았다. X는 canonical URL에 대해 이전 집계의 personalized 이미지를
  보여줬지만 현재 origin social image와 metadata는 최신 revision이었다. 제품
  응답 결함이 아닌 플랫폼 canonical cache 지연으로 분류해 public을 유지했다.
- **OK — Threads 실측**: 앱이 만든 share intent에서 현재 최신 집계의 card
  preview를 확인했고 게시하지 않았다.
- **OK — 카카오톡 실측**: 공유 디버거는 canonical share URL, 제목, 설명,
  `og:url`, revisioned `og:image`, site name을 앱 응답과 동일하게 읽었다.
  preview에는 현재 최신 card가 표시됐고 캐시 초기화나 메시지 발행은 하지 않았다.
- **OK — observability**: 최근 error-only 62 events는 intentional missing/private,
  닫힌 operator와 revoked CLI 검증에서 발생한 bounded `404/410`이었다. paired
  Worker outcome은 모두 `ok`였고 5xx와 exception은 0개였다. quota, upgrade와
  결제 요구도 없었다.
- **OK — 최종 안전 상태**: Site는 active, public access revision 57, version 24,
  environment revision 87이다. root와 health는 `200`, operator는 `404`, public
  profile/share/card/social은 `200`이며 canonical, locale과 cache 기준선이 모두
  복원돼 있다.

## 잔여 위험

- X의 canonical link card에는 이전 personalized image가 남아 있다. origin의
  revisioned metadata와 최신 image는 정상이므로 플랫폼 cache 전파 지연으로
  기록한다. cache reset을 위해 URL 계약을 다시 바꾸거나 public 상태를 되돌리는
  조치는 하지 않는다.
- Sites description에는 아직 owner-only nonproduction 문구가 있고 README·공개
  문서의 production URL과 운영 절차도 현행화가 필요하다. 이는 #90 맥락을 반영한
  Stage 5 승인 범위이며 Stage 4에서는 변경하지 않았다.
- owner settings에는 기존 active token 1개와 device audit record 3개가 남아 있다.
  이 Stage에서 만든 disposable CLI credential은 모두 폐기·삭제됐고 신규 device
  record 1개만 비밀이 아닌 감사 흔적으로 남았다. UI에 삭제 수단이 없으므로
  Stage 5에서는 파괴적인 DB 삭제 없이 상태만 경계해 문서화한다.
- main release CI와 branch protection 위험은 후속 Issue #89에서 추적한다.

## 다음 단계 영향

- Stage 5 시작 기준선은 public access revision 57, production version 24,
  environment revision 87, source exact main, maintenance `disabled`, service
  `normal`, dark/en 공개 프로필이다.
- Stage 5에서는 read-only 최종 상태 확인, Sites production 운영 문서와 README
  card/production URL의 현행화, 임시 산출물 cleanup 확인, 최종 보고서와 PR 게시를
  수행한다.
- Stage 5에서 두 번째 release, 새 version 저장·deployment, migration 실행,
  source 변경은 하지 않는다. 새 제품 결함은 기존 범위에 섞지 않고 후속 Issue로
  분리한다.

## 승인 요청

- Stage 4 public cutover와 SNS 실측 결과를 승인하면 Stage 5 정리, 운영 문서
  현행화와 최종 보고로 진행한다.
