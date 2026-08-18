# Task #101 Stage 5 보고서 — 전체 회귀 검증과 비배포 PR handoff

GitHub Issue: [#101](https://github.com/postmelee/codex-usage-profile/issues/101)
구현계획서: [`task_m100_101_impl.md`](../plans/task_m100_101_impl.md)
Stage: 5

## 단계 목적

Stage 1~4에서 구현·실측·현행화한 revision share 계약을 전체 Node·Playwright 회귀와 production
Sites artifact로 최종 검증한다. Stage 3의 공개 validation 배포 상태가 그대로 유지되는지 읽기
전용으로 확인하고, 제품 소스나 원격 상태를 추가 변경하지 않은 채 최종 보고·PR 절차에 넘길 수 있는
비배포 handoff를 만드는 구현계획 Stage 5다.

## 산출물

| 파일·대상 | 변경 요약 |
|---|---|
| `mydocs/working/task_m100_101_stage5.md` | 전체 회귀, artifact, validation site 무변경 확인과 최종 handoff 경계를 기록한다. |
| `mydocs/orders/20260813.md` | #101 비고를 Stage 5 완료·최종 보고 승인 대기로 갱신한다. |
| `local/task101` production artifact | 현재 exact source를 새로 build하고 full-stack artifact verifier로 검사했다. 배포하지 않았다. |
| `codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site` | site·version·access·environment를 읽기 전용으로 확인했다. 원격 mutation은 수행하지 않았다. |

Stage 5에서는 제품 소스·테스트·공식 문서를 추가 수정하지 않았다.

## 본문 변경 정도 / 본문 무손실 여부

Stage 4 최종 계약을 그대로 보존했다. README Markdown은 fixed `/api/share/{handle}` href와 query
없는 `/u/{handle}/card.png` src를 유지하고, 공유 링크 복사와 X·LinkedIn·Threads·Facebook·Reddit만
최신 revision URL을 사용한다. matching·stale·invalid revision, private·missing 비열거, runtime·SPA
착지와 provider 지연 문서도 최종 코드와 일치함을 대조했다.

`README.md`, 새 canonical production site, DB·OAuth·CLI origin, #84 파일·브랜치, 사용자 데이터와
외부 SNS 게시물은 변경하지 않았다. Sites saved version·access·environment도 변경하지 않았다.

## 검증 결과

구현계획서 지정 명령:

```bash
npm test -- --test-concurrency=1
npm run test:e2e
npm run build:production
npm run verify:sites-fullstack
git diff --check
git status --short
```

결과:

- OK — 전체 Node test 823개: 817 pass, 6 environment-conditional skip, 0 fail,
  약 20.1초. PostgreSQL 연결이 필요한 6개만 `TEST_DATABASE_URL` 부재로 계획된 skip이었다.
- OK — 전체 Playwright 101개 통과, 약 1.6분. fixed README Markdown과 submit 뒤 공유 링크·다섯
  SNS revision 동시 갱신 시나리오를 포함했다.
- OK — production Sites full-stack build 통과. Vite server 62 modules, client 1,834 modules를
  build하고 artifact를 정상 finalize했다.
- OK — Sites artifact verifier가 client files 8개, migrations 5개, worker files 2개,
  worker raw 4,012,893 bytes, compressed 2,168,229 bytes를 검사하고 `ok: true`를 반환했다.
- OK — `git diff --check` 경고 없음. 검증용 임시 dependency link를 제거한 뒤 worktree에 의도하지
  않은 파일이 없음을 확인했다.

첫 Node 실행은 worktree의 검증용 dependency link가 제거된 상태여서 card font fixture가
`ENOENT`로 실패했고, sandbox 안의 Miniflare listener가 준비 상태에서 멈췄다. 제품 소스는 수정하지
않고 main checkout의 동일 lockfile dependency를 worktree에 임시 연결하고 local listener를 허용해
지정 명령 전체를 다시 실행했다. 최종 실행은 위 결과처럼 실패 없이 통과했으며 임시 연결은 제거했다.

## validation site 무변경 확인

Sites connector의 read-only site·version·environment 조회 결과:

| 항목 | Stage 3 기준 | Stage 5 확인 | 판정 |
|---|---|---|---|
| project | `appgprj_6a62f58721788191a7cd82f37320f244` | 일치 | 유지 |
| live URL | `https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site` | 일치 | 유지 |
| saved version | 33 | 33 | 유지 |
| source | `53a7132630dcb6f43459880d79730e10e2b59d6e` | 일치 | 유지 |
| access | public, revision 59 | public, revision 59 | 유지 |
| environment | revision 89 | revision 89, 같은 9개 key 구성 | 유지 |
| rollback | version 32, source `6cf2bab664e5a1f0b1e6051cc35887721c307e99` | version history에 동일 | 유지 |

secret 값은 조회 결과에 노출하거나 보고서에 기록하지 않았다. site version 저장·배포, access update,
environment update와 다른 Sites project 조회·변경은 수행하지 않았다.

## 잔여 위험

- 외부 provider의 crawler·image processing 시간은 통제할 수 없다. Stage 3에서 X 약 11초,
  Threads 약 10초 지연이 관찰됐고 새 revision URL도 즉시 표시 SLA를 보장하지 않는다.
- 과거 revision은 snapshot이 아니며 현재 metadata로 수렴한다. 별도 DB history나 최근 카드 버전
  보존 로직은 없다.
- PostgreSQL 통합 테스트 6개는 `TEST_DATABASE_URL`이 없는 로컬 환경에서 계획대로 skip됐다.
  #101 변경은 D1·Sites production path를 대상으로 하며 해당 skip을 새로 만들지 않았다.
- 새 canonical production origin과 현재 stage5의 테스트 전용 전환은 후속 migration Issue에서
  별도 승인, 배포·rollback과 데이터 폐기 계획이 필요하다.

## 다음 단계 영향

- Stage 5 승인 뒤에만 `task-final-report` 절차로 `mydocs/report/task_m100_101_report.md`를 작성한다.
- 최종 보고 절차에서 publish branch push와 `devel` 대상 PR을 준비하되, 새 canonical production
  migration은 범위에 포함하지 않고 후속 Issue로 명시한다.
- Stage 5 자체는 비배포 handoff이므로 현재 stage5 saved version 33과 원격 설정을 그대로 유지한다.

## 승인 요청

- Stage 5 전체 회귀·artifact 검증, validation site 무변경 확인과 비배포 handoff를 승인하면 별도
  최종 보고·PR 게시 절차로 진행한다.
