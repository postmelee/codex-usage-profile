# Task #113 최종 결과 보고 — Community Standards와 외부 기여·보안 신고 흐름

GitHub Issue: [#113](https://github.com/postmelee/codex-usage-profile/issues/113)
마일스톤: M100

## 작업 요약

- 대상 이슈: #113
- 마일스톤: M100 — v1.0 MVP
- 단계 수: 4
- 작업 목적: GitHub Community Standards가 요구하는 공개 정책과 실제 외부 기여·Discussion·private security reporting 흐름을 구축하고, merge 후 100% 판정 gate를 정의한다.
- 완료 범위: Discussion 3건·pin 2건, PVR 활성화, 영문 community 문서, README 기여 진입점, 외부 Issue forms·chooser·PR template, 통합 검증 handoff.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `README.md` | `Development` 앞에 짧은 영문 Contributing 진입점과 exact Discussion·issue chooser 링크 추가 | 공개 README 독자 |
| `CODE_OF_CONDUCT.md` | Contributor Covenant 2.0과 승인된 private enforcement email 추가 | 모든 community 참여자 |
| `CONTRIBUTING.md` | 질문·아이디어·bug·feature·security routing, Node 20 개발 절차, `devel` PR 정책 추가 | 외부 contributor |
| `SECURITY.md` | 최신 release 지원 범위와 GitHub PVR canonical 신고 절차 추가 | 보안 연구자·사용자 |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | 재현 가능한 bug와 privacy confirmation을 받는 form 추가 | Issue 제출자·maintainer |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | 구체화된 feature와 초기 customization idea를 분리하는 form 추가 | 제안자·maintainer |
| `.github/ISSUE_TEMPLATE/config.yml` | blank issue 비활성화와 Q&A·Ideas·PVR contact link 추가 | Issue chooser 이용자 |
| `.github/ISSUE_TEMPLATE/task.yml` | body를 보존한 채 maintainer-only 이름·설명으로 명확화 | 내부 task 등록자 |
| `.github/PULL_REQUEST_TEMPLATE/external-contribution.md` | 외부 contributor용 Summary·Validation·Checklist template 추가 | 외부 PR 작성자 |
| `mydocs/plans/task_m100_113*.md` | 문서 위치·정책 불변식·4단계 구현과 검증 계획 기록 | 내부 작업 추적 |
| `mydocs/working/task_m100_113_stage*.md` | Stage 1~4 원격 mutation·문서·template·통합 검증 결과 기록 | 내부 검토·감사 |
| `mydocs/orders/20260822.md`, `mydocs/orders/20260823.md` | 날짜별 작업 상태와 완료 시각 기록 | 내부 작업 보드 |
| `mydocs/report/task_m100_113_report.md` | 수용 기준, 정량 결과와 merge 후 live gate 통합 | 장기 결과 기록 |

GitHub remote 산출물:

- [Discussion #114 — Welcome to Codex Usage Profile Discussions](https://github.com/postmelee/codex-usage-profile/discussions/114), Announcements, pinned
- [Discussion #115 — Share Your Profile Card Customization Ideas](https://github.com/postmelee/codex-usage-profile/discussions/115), Ideas, pinned
- [Discussion #116 — Show Us Your Codex Usage Profile](https://github.com/postmelee/codex-usage-profile/discussions/116), Show and tell, unpinned
- GitHub Private Vulnerability Reporting: enabled

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `README.md` | 저장소 root | 저장소 root | OK | 짧은 공개 contribution entrypoint |
| `CONTRIBUTING.md` | 저장소 root | 저장소 root | OK | GitHub supported community file 위치 |
| `CODE_OF_CONDUCT.md` | 저장소 root | 저장소 root | OK | GitHub supported Contributor Covenant 위치 |
| `SECURITY.md` | 저장소 root | 저장소 root | OK | GitHub Security tab 지원 위치 |
| `.github/ISSUE_TEMPLATE/*.yml` | `.github/ISSUE_TEMPLATE/` | 계획 경로 | OK | Issue form·chooser canonical 위치 |
| `.github/PULL_REQUEST_TEMPLATE/external-contribution.md` | `.github/PULL_REQUEST_TEMPLATE/` | 계획 경로 | OK | 기존 default maintainer template과 분리 |
| Discussion 3건 | GitHub Discussions | #114~#116 | OK | API와 GitHub UI에서 category·본문 확인 |
| 계획·단계·최종 보고 | `mydocs/plans`, `mydocs/working`, `mydocs/report` | 계획 경로 | OK | 중앙 문서 구조 규칙과 일치 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | Task #113 결과 |
|---|---|---|
| GitHub Discussions | 0건 | 3건 |
| Pinned Discussions | 0건 | 2건 (#114, #115) |
| Private Vulnerability Reporting | disabled | enabled |
| Root community policy files | Code of Conduct·Contributing·Security 없음 | 3개 추가 |
| 공개 external Issue forms | 0개 | bug·feature 2개 추가, maintainer task body 보존 |
| Issue chooser contact links | 0개 | Q&A·Ideas·PVR 3개 |
| 외부 PR template | 없음 | 1개 추가 |
| Task branch 변경 | 없음 | 최종 보고 전 17경로, 1,364 insertions·2 deletions |
| 공개 릴리스 scan blocker | 0 | 0 (`ok: true`) |
| Community Profile live baseline | 57% | merge 전 57%; merge 후 100% gate |

Community Profile의 마지막 행은 default branch 반영 전후 비교가 아니다. GitHub가 `devel`만 평가하므로 100%는 PR merge 후 API로 별도 확인한다.

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| Discussion 3건과 category·본문 | OK — GraphQL `totalCount: 3`, #114 Announcements, #115 Ideas, #116 Show and tell |
| Welcome·customization pin, Show and tell unpinned | OK — GitHub UI Pinned Discussions에 #114·#115만 표시 |
| Private security reporting | OK — PVR API `enabled: true`, SECURITY·chooser가 advisory URL 사용 |
| Contributor Covenant 무손실 | OK — GitHub 지원 v2.0 body와 contact placeholder 치환 외 byte 단위 일치 |
| 행동강령·보안 신고 역할 분리 | OK — enforcement email과 PVR 경로를 별도 문서·intake로 분리 |
| 공개 기여 routing | OK — Q&A, Discussion #115, bug·feature form, `devel` PR 경로 연결 |
| Issue form·chooser schema | OK — 네 YAML parse, field type·ID·required checkbox·label 검사 통과 |
| maintainer workflow 비회귀 | OK — `task.yml` body와 `.github/pull_request_template.md` 보존 |
| 공개 링크와 정보 경계 | OK — local Markdown link 16개 존재, placeholder·credential·private usage 없음 |
| 공개 릴리스 surface | OK — `ok: true`, `blockerCount: 0`, review 69건은 기존 refs·fixture·metadata |
| Task #113 범위 | OK — community·작업 문서만 포함, 제품 코드·배포 파일 변경 없음 |
| 최신 `devel` mergeability | OK — Task #108 merge 2 commit 뒤이지만 merge-tree conflict marker 없음 |
| Community Standards 100% | PENDING — merge 후 live gate; 현재 default branch baseline 57% |

### 단계별 검증 결과

- Stage 1: [`task_m100_113_stage1.md`](../working/task_m100_113_stage1.md) — Discussion 3건·pin 2건과 PVR 활성화
- Stage 2: [`task_m100_113_stage2.md`](../working/task_m100_113_stage2.md) — 공개 정책 3개와 README 기여 진입점
- Stage 3: [`task_m100_113_stage3.md`](../working/task_m100_113_stage3.md) — 외부 Issue forms·chooser·PR template
- Stage 4: [`task_m100_113_stage4.md`](../working/task_m100_113_stage4.md) — 허용 diff·public scan·remote/UI 통합 검증

## 잔여 위험과 후속 작업

### 잔여 위험

- Community Profile, Issue chooser와 Security Policy 인식은 default branch merge 전에는 live 검증할 수 없다.
- GitHub cache 때문에 merge 직후 Community Profile 갱신이 지연될 수 있다.
- 현재 branch는 최신 `origin/devel`보다 2 commit 뒤지만 merge-tree는 clean하다. PR 생성 후 GitHub mergeability와 CI를 다시 확인한다.

### 후속 작업 후보

- PR merge 후 #113에서 다음 live gate를 확인한다.
  1. `community/profile` health 100%
  2. code of conduct, contributing, issue template non-null
  3. bug·feature·maintainer form과 Q&A·Ideas·PVR contact link 렌더링
  4. Security tab policy와 private vulnerability report button
  5. default branch README Contributing과 external PR template 링크
- 위 gate가 모두 통과하기 전에는 #113을 닫거나 Community Standards 100% 완료를 선언하지 않는다.

## 작업지시자 승인 요청

- 최종 보고와 Open PR 검증 결과를 검토하고 merge 여부를 승인한다. merge 후 live gate가 통과하면 #113 close와 branch·worktree 정리를 진행한다.
