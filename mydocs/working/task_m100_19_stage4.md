# Task M100 #19 Stage 4 완료 보고서

GitHub Issue: [#19](https://github.com/postmelee/codex-usage-profile/issues/19)
구현계획서: [`task_m100_19_impl.md`](../plans/task_m100_19_impl.md)
Stage: 4

## 단계 목적

Stage 4의 목적은 README에서 `UsageSnapshot v2` 공식 계약 문서와 analyzer/profile 책임 경계를 연결하고, 후속 이슈가 이어받을 기준을 정리하는 것이다.

이번 단계에서는 README에 계약 문서 링크와 책임 분리 요약을 추가했다. 세부 계약은 `docs/usage-snapshot-v2.md`에 두고, README에는 개발자가 처음 확인해야 할 방향만 짧게 남겼다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `README.md` | `Usage Snapshot Contract` 섹션을 추가하고, analyzer는 usage snapshot만 생성하며 GitHub-facing fields는 web account/profile layer가 병합한다는 경계를 기록했다. Security 섹션에도 analyzer snapshot에서 GitHub-facing fields, session, token, device metadata를 제외해야 함을 보강했다. |
| `mydocs/working/task_m100_19_stage4.md` | Stage 4 검증 결과와 후속 handoff를 기록했다. |

## 본문 변경 정도 / 본문 무손실 여부

README에 신규 섹션과 보안 bullet 1개를 추가했다. 기존 개발 명령, runtime 설정, CLI auth flow, 보안 문구는 보존했다.

## 검증 결과

실행 명령:

```bash
npm test
npm run build
rg -n "(sk-[A-Za-z0-9_-]{10,}|gh[opsu]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|CODEX_ACCESS_TOKEN=|\"access_token\"\\s*:\\s*\"[^\"]{8,}|\"refresh_token\"\\s*:\\s*\"[^\"]{8,})" src docs README.md mydocs
rg -n --glob '!src/**/__tests__/**' --glob '!mydocs/working/**' --glob '!mydocs/plans/**' --glob '!mydocs/skills/**' --glob '!mydocs/manual/**' "(^|[^A-Za-z0-9])(sk-[A-Za-z0-9_-]{10,}|gh[opsu]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|CODEX_ACCESS_TOKEN=|\"access_token\"\\s*:\\s*\"[^\"]{8,}|\"refresh_token\"\\s*:\\s*\"[^\"]{8,})" src docs README.md mydocs
git status --short
git diff --check
```

결과:

- OK: `npm test` 결과 130개 테스트가 모두 통과했다.
- OK: `npm run build`가 성공했다.
- 확인: 계획서의 broad scan은 테스트 fixture, 기존 작업 문서의 검증 명령, `task-*` 문자열을 false positive로 출력했다.
- OK: 테스트/작업절차/계획서/작업보고서를 제외한 narrowed scan은 결과가 없었다.
- OK: `git diff --check`가 경고 없이 통과했다.
- 확인: `git status --short`는 Stage 4 README 변경과 기존 작업과 무관한 로컬 untracked 항목을 표시했다.

## 후속 handoff

- #20 analyzer 분리 작업은 `docs/usage-snapshot-v2.md`, `validateUsageSnapshotV2`, `UsageSnapshotV2` type declaration을 SDK/CLI output 기준으로 사용한다.
- #5 profile submit CLI는 analyzer output을 `UsageSnapshot v2`로 validate한 뒤 submit wrapper의 `payload.snapshot`으로 전송한다.
- #6 README card renderer는 web-owned GitHub profile record와 analyzer snapshot을 병합해 card view model을 만든다.
- #17 device-code login은 snapshot 구조와 무관한 auth API로 유지한다.
- #15 token/device 관리는 analyzer snapshot 내부 필드와 결합하지 않는다.

## 잔여 위험

- backend submit path는 아직 v1 snapshot validator를 사용한다. v2 submit 수용은 #5/#20 흐름에서 연결해야 한다.
- README는 계약 링크와 경계 요약만 담는다. 세부 필드 변경은 공식 계약 문서를 우선 갱신해야 한다.
- broad secret scan은 현재 test fixture와 작업 문서 때문에 false positive가 많다. 후속 task에서는 검증 명령을 더 좁힌 scan으로 개선하는 편이 좋다.

## 다음 단계 영향

- Stage 4까지 완료되면 #19의 구현 단계는 끝난다.
- 다음 절차는 `task-final-report`로 최종 보고서 작성, 오늘할일 완료 처리, 최종 검증, PR 게시를 진행하는 것이다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 #19 최종 보고 및 PR 게시 절차로 진행한다.
