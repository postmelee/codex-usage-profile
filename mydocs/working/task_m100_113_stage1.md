# Task #113 Stage 1 완료 보고 — Discussion과 private security entrypoint 구축

GitHub Issue: [#113](https://github.com/postmelee/codex-usage-profile/issues/113)
구현계획서: [`task_m100_113_impl.md`](../plans/task_m100_113_impl.md)
Stage: 1

## 단계 목적

외부 사용자가 참여할 초기 Discussion 3건을 승인된 카테고리와 영문 본문으로 게시하고, Welcome과 customization 글을 저장소 Discussions 상단에 고정한다. 보안 취약점을 공개 Issue가 아닌 private channel로 접수할 수 있도록 GitHub Private Vulnerability Reporting을 활성화한다.

이번 Stage는 저장소 공개 문서를 변경하기 전에 exact Discussion URL과 PVR enabled 상태를 확보하는 단계다. 생성 전 live 조회에서 Discussion은 0건, PVR은 `enabled: false`였으며 중복 mutation 없이 필요한 상태만 추가했다.

## 산출물

| 파일 또는 원격 상태 | 변경 요약 |
|---|---|
| [Discussion #114](https://github.com/postmelee/codex-usage-profile/discussions/114) | `Announcements`에 `Welcome to Codex Usage Profile Discussions` 게시, 저장소 전체 pin 적용 |
| [Discussion #115](https://github.com/postmelee/codex-usage-profile/discussions/115) | `Ideas`에 `Share Your Profile Card Customization Ideas` 게시, 저장소 전체 pin 적용 |
| [Discussion #116](https://github.com/postmelee/codex-usage-profile/discussions/116) | `Show and tell`에 `Show Us Your Codex Usage Profile` 게시, pin 미적용 |
| GitHub Private Vulnerability Reporting | REST endpoint를 `enabled: false`에서 `enabled: true`로 전환 |
| `mydocs/orders/20260822.md` | 8월 22일 종료 시점의 Stage 1 원격 적용·pin 승인 대기 상태 기록 |
| `mydocs/orders/20260823.md` | 날짜 전환 후 Stage 1 완료·Stage 2 승인 대기 상태 기록 |
| `mydocs/working/task_m100_113_stage1.md` | 원격 mutation, 검증, 잔여 위험과 다음 단계 handoff 기록 |

원격 식별자:

| Discussion | Node ID | Category | URL |
|---|---|---|---|
| #114 | `D_kwDOSxxUA84Aoruh` | Announcements | `https://github.com/postmelee/codex-usage-profile/discussions/114` |
| #115 | `D_kwDOSxxUA84Aorui` | Ideas | `https://github.com/postmelee/codex-usage-profile/discussions/115` |
| #116 | `D_kwDOSxxUA84Aoruj` | Show and tell | `https://github.com/postmelee/codex-usage-profile/discussions/116` |

## 본문 변경 정도 / 본문 무손실 여부

- 승인된 Discussion 콘텐츠 계약에 따라 세 본문을 신규 작성했으며 기존 Discussion 본문은 없었다.
- GraphQL create mutation 응답과 후속 전체 조회의 `body`가 작성한 원문과 일치했다.
- 생성 후 제목, 카테고리, 본문을 수정하거나 삭제하지 않았다.
- #114와 #115는 기본 `Blue mint gradient background`로 저장소 전체 pin만 적용했다.
- #116은 `Pin discussion` 동작이 가능한 상태로 남아 있고 `Unpin discussion`은 없어 미고정 상태임을 확인했다.
- 저장소의 README, community policy와 GitHub template 본문은 이번 Stage에서 변경하지 않았다.

## 검증 결과

실행 명령:

```bash
gh api graphql -f query='query { repository(owner:"postmelee", name:"codex-usage-profile") { discussions(first:100,orderBy:{field:CREATED_AT,direction:ASC}) { totalCount nodes { id number title url body category { name slug } } } } }'
gh api repos/postmelee/codex-usage-profile/private-vulnerability-reporting
git diff --check
```

결과:

- **OK — Discussion 개수·중복**: `totalCount: 3`이며 계획한 세 제목만 각각 한 번 존재한다.
- **OK — 카테고리**: #114 `Announcements`, #115 `Ideas`, #116 `Show and tell`로 일치한다.
- **OK — 본문**: GraphQL 후속 조회가 세 privacy warning과 승인된 영문 본문을 손실 없이 반환했다.
- **OK — PVR**: REST endpoint가 `{"enabled":true}`를 반환했다.
- **OK — diff**: `git diff --check`가 출력 없이 exit 0으로 통과했다.

수동/UI 검증:

- **OK — pin 결과**: Discussions 홈의 `Pinned Discussions`에 #114와 #115만 표시된다.
- **OK — #114**: pin 완료 alert 뒤 admin control이 `Edit pinned discussion`과 `Unpin discussion`으로 전환됐다.
- **OK — #115**: pin 완료 alert, `Unpin discussion: 1`, `Edit pinned discussion: 1`을 확인했다.
- **OK — #116 미고정**: `Pin discussion: 1`, `Unpin discussion: 0`을 확인했다.
- **OK — 렌더링**: 세 글의 제목, 목록, 문단과 privacy warning이 GitHub Discussion 화면에 정상 표시됐다.

## 잔여 위험

- GitHub GraphQL에는 Discussion pin mutation과 `Discussion.isPinned` 조회 field가 없어 pin 상태는 GitHub UI를 통해서만 검증했다.
- PVR은 활성화됐지만 canonical 사용 안내인 `SECURITY.md`는 Stage 2와 PR merge 전까지 default branch에 없다.
- Community Profile은 default branch의 community health 파일을 평가하므로 현재 health 57%는 이 Stage의 완료 판정 대상이 아니다.
- 원격 Discussion과 PVR 상태는 Git commit으로 원자적으로 되돌릴 수 없다. 이후 단계에서는 위 URL과 현재 enabled 상태를 재사용하며 중복 mutation을 하지 않는다.

## 다음 단계 영향

- Stage 2 README와 CONTRIBUTING의 customization link는 [Discussion #115](https://github.com/postmelee/codex-usage-profile/discussions/115)를 exact 진실 원천으로 사용한다.
- Welcome·Show and tell 안내가 필요할 때 각각 [#114](https://github.com/postmelee/codex-usage-profile/discussions/114), [#116](https://github.com/postmelee/codex-usage-profile/discussions/116)을 사용한다.
- `SECURITY.md`와 issue chooser security contact는 `https://github.com/postmelee/codex-usage-profile/security/advisories/new`를 canonical PVR 경로로 사용한다.
- Stage 2에서는 Contributor Covenant enforcement contact로 승인된 `meleeisdeveloping@gmail.com`을 사용한다.
- 날짜가 2026-08-23으로 전환되어 다음 Stage 상태는 `mydocs/orders/20260823.md`에서 이어간다.

## 승인 요청

- Stage 1의 Discussion 3건, pin 2건, PVR 활성화와 검증 결과를 승인하면 Stage 2 공개 커뮤니티 정책과 README 기여 경로 작성으로 진행한다.
