# Task #83 Stage 4 완료 보고서

GitHub Issue: [#83](https://github.com/postmelee/codex-usage-profile/issues/83)
구현계획서: [`task_m100_83_impl.md`](../plans/task_m100_83_impl.md)
Stage: 4

## 단계 목적

Stage 3.9 exact source를 제한된 시간 동안 public으로 전환해 anonymous·private·
missing 경계, canonical OG/Twitter, README/social media와 cache/revision 신선도를
실측하고, 종료 즉시 owner-only·private·revoked·disposable cleanup baseline으로
복원하는 단계다.

Gate B 뒤 발견해 Stage 3.10에서 보정한 Sites 소유자 `/profile` 경로도 새 exact
source의 owner-only saved version과 실제 OAuth 복귀로 재검증한다. Stage 3.10은
public profile/cache/OG/media source를 변경하지 않았으므로 전체 public Gate B는
반복하지 않는다.

## 산출물

| 파일·상태 | 변경 요약 |
|---|---|
| Sites saved version 17 | source `4541e3be7fc1dce6d7e54bbe01ce279d1ceba05f`의 최종 Gate B, cache/revision·OG/social 실측과 즉시 owner-only 원복 |
| Sites saved version 18 | source `e431cc88ba73b02341a170fe5c38117d4552e42a`의 owner profile query route 집중 smoke와 최종 safe baseline |
| `docs/sites-operations.md` | 현재 saved version/access/environment, version 17 Gate B와 version 18 owner-only 운영 기준 반영 |
| `docs/production-hosting.md` | hosted migration·media·cache 검증 결과와 #84 전 current architecture 상태 반영 |
| `docs/readme-card.md` | 검증된 후보와 아직 공개되지 않은 CTA를 분리하고 canonical share 상태 정합화 |
| `mydocs/plans/task_m100_83.md`, `mydocs/plans/task_m100_83_impl.md` | Stage 4·3.10 완료 결과, cache 판단과 #84 handoff 기록 |
| `mydocs/orders/20260811.md` | Stage 4 완료·최종 보고 승인 대기 상태 반영 |

## 본문 변경 정도 / 본문 무손실 여부

이 단계에서는 제품 source, API, media, cache header와 D1/R2 계약을 변경하지 않았다.
공식 문서의 기존 구조와 운영 절차를 보존하고, version 16 이전 상태 문구를 실제
version 17 Gate B와 version 18 owner-only 기준선으로 최소 갱신했다. README
placeholder와 production CTA는 활성화하지 않았다.

X가 투명 여백을 흰색으로 합성한 실제 미리보기는 카드 내용과 비율이 정상이며
provider 렌더링 규칙에 해당하므로 asset을 보정하지 않았다.

## 검증 결과

실행 명령:

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
git diff --check
```

원격 검증:

- saved version/source와 access/environment read-only snapshot
- protected migration readiness 및 health/operator route
- Gate B anonymous/private/missing, README/social, OG/Twitter와 cache/revision 시계열
- version 18 protected owner profile, 메뉴/CTA와 실제 OAuth 복귀
- Gate B 뒤 disposable cleanup과 최종 owner-only access gate

결과:

- 전체 Node 검증: 712개 중 706개 통과, 6개 환경 조건 skip, 실패 0
- Playwright E2E: 66/66 통과
- production build: production manifest 제거 확인, 보존 대상 0
- full-stack verifier: client 8, worker 2, migration 5, raw 3,993,020 bytes,
  gzip 2,164,490 bytes 확인
- production verifier: artifact 5,095,565 bytes, bindings 3, migration 5 및
  동일 Worker 크기 확인
- Gate B: anonymous landing, private API와 private/missing media 비노출,
  canonical/OG/Twitter, packaged fallback, README dark/light × en/ko,
  personalized social GET/HEAD/304와 publish/unpublish 통과
- cache/revision: 관찰 범위에서 shared-cache HIT나 stale `Age` 증거 없음.
  application revision과 media ETag는 submit·publish 상태에 맞춰 즉시 갱신됐고
  private/missing 및 handle 간 혼합도 없어 release blocker 아님
- 실제 링크 카드: 작업지시자가 제공한 X 작성 화면에서 카드 이미지와 문구의 정상
  노출 확인. 흰색 여백은 투명 픽셀의 provider 합성 결과로 판단
- version 18 owner route: protected `/?view=profile`, 계정 메뉴와 공개 CTA,
  GitHub OAuth `redirect_to` 복귀 통과
- D1 readiness: `appliedVersions == expectedVersions == [1,2,3,4,5]`
- 최종 remote: saved version 18, access revision 56의 custom owner-only,
  owner 1명·추가 user/group 0명, environment revision 85, maintenance disabled,
  operator secret absent, service normal
- 최종 경계: protected health `200`, operator route `404`; anonymous root와 owner
  query는 Sites access gate에서 `401`
- disposable owner/session/token/D1/R2/local credential 정리 완료
- `git diff --check`: 이상 없음

## 잔여 위험

- permanent public Gate C, `devel`→`main` 릴리스와 README 실제 이미지 교체는 #84
  범위다. 현재 Site는 의도적으로 owner-only다.
- 외부 SNS scraper의 장기 cache, 투명 픽셀 합성 색과 재수집 시간은 provider가
  제어한다. X 실제 미리보기와 application 신선도는 통과했으므로 코드 보정이나
  cache 최적화 이슈를 #84 선행조건으로 만들지 않는다.
- 기존 로컬 CLI credential은 cleanup 과정에서 revoke됐다. 새 production token을
  재발급해 상태를 만들지 않았고, `profileUrl=/?view=profile` 계약은 exact source의
  Node/E2E 검증으로 고정했다.
- version 7은 legacy public 비교·비상 rollback 근거로만 남아 있다. 현재 Sites
  owner-only access gate가 anonymous 접근을 차단한다.

## 다음 단계 영향

- Stage 4 승인 뒤 `task-final-report` 절차로 전체 수용 기준, exact application SHA와
  #84 선행조건을 최종 보고서에 정리한다.
- 최종 보고서·오늘할일 완료 처리·최종 커밋 뒤 `publish/task83`을 push하고 `devel`
  대상 PR을 생성한다.
- #84는 #83 PR merge, issue close와 `pr-merge-cleanup` 완료 뒤에만 시작한다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 최종 보고서 작성과 PR 게시 절차로
  진행한다.
