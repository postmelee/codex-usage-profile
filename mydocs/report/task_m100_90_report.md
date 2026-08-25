# Task #90 최종 보고서 — 공개 README·문서와 GitHub metadata 정합화

GitHub Issue: [#90](https://github.com/postmelee/codex-usage-profile/issues/90)
마일스톤: M100

## 작업 요약

- 대상 이슈: #90
- 마일스톤: M100
- 단계 수: 5
- 작업 목적: canonical production 공개와 마케팅 시작 전에 README, npm 사용자 안내,
  공식 문서 navigation과 GitHub 기본 진입면을 한 사용자 계약으로 정렬한다.

신규 사용자가 GitHub README 첫 화면에서 실제 카드, 제품 가치와 한 줄 submit 명령을 바로
확인하도록 공개 정보를 재구성했다. README Markdown은 fixed queryless href/src를 유지하고,
복사 공유 링크와 X·LinkedIn·Threads·Facebook·Reddit만 revision URL을 사용한다는 계약을 root,
npm과 사용자 가이드에서 일치시켰다. 승인된 source를 `devel`과 `main`에 승격한 뒤 GitHub homepage를
canonical production으로, default branch를 `main`으로 전환했다. 작업지시자 요청에 따라 repository
description은 기존 문구를 그대로 보존했다.

## 변경 파일 목록과 영향 범위

| 경로/원격 상태 | 변경 요약 | 영향 범위 |
|---|---|---|
| `README.md` | 가치 제안, 실제 카드, Quick start, 사용자 기능과 안전 경계 중심으로 재구성 | GitHub 첫 방문자와 마케팅 진입면 |
| `packages/codex-usage-profile-cli/README.md` | 기본 production submit, browser approval, 결과·privacy·automation 안내 정리 | npm package 사용자 |
| `docs/README.md` | audience와 language를 표시한 공식 문서 index 추가 | 사용자·기여자·maintainer navigation |
| `docs/cli-submit.md` | login·submit·credential·오류 복구 중심 영어 사용자 가이드로 보정 | CLI 사용자 지원 |
| `docs/readme-card.md` | fixed README와 revision social share 계약, cache 설명 정리 | README/SNS 공유 사용자 |
| `CONTRIBUTING.md` | 개발 명령은 유지하고 maintainer 문서 진입점 보강 | 기여자 |
| `scripts/__tests__/public-readme-contract.test.js` | 승인된 optional star prompt 문구를 contract expectation과 일치 | 공개 README 회귀 검증 |
| `mydocs/plans/task_m100_90*.md` | Stage, 문서 위치, release/metadata Gate와 rollback 계약 기록 | 내부 작업 추적 |
| `mydocs/working/task_m100_90_stage*.md` | Stage 1~5 산출물·검증·원격 상태 기록 | 내부 단계 감사 |
| `mydocs/report/task_m100_90_report.md` | 전체 수용 기준과 잔여 위험 정리 | 내부 최종 감사 |
| GitHub repository metadata | homepage production, default branch `main`, description 보존 | 공개 repository 기본 진입면 |

과거 작업 보고서의 개인 절대경로 literal은 의미와 timestamp를 보존한 채 환경 중립 표현으로만
최소 보정했다. 제품 source, package version·lockfile, Sites manifest와 durable data는 변경하지 않았다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| 사용자 첫 화면 | `README.md` | `README.md` | OK | repository root와 GitHub 기본 branch에서 렌더 |
| npm 사용자 안내 | package-local README | `packages/codex-usage-profile-cli/README.md` | OK | npm artifact에 포함되는 canonical package 문서 |
| 공식 문서 index | `docs/README.md` | `docs/README.md` | OK | public docs root에 audience/language index 배치 |
| CLI 사용자 가이드 | `docs/cli-submit.md` | `docs/cli-submit.md` | OK | 사용자 지원 문서를 기존 stable path에 유지 |
| README/SNS 가이드 | `docs/readme-card.md` | `docs/readme-card.md` | OK | 외부 링크를 깨지 않고 기존 stable path에 유지 |
| 기여자 안내 | `CONTRIBUTING.md` | `CONTRIBUTING.md` | OK | 개발·maintainer navigation을 contributor entry에 유지 |
| 계획·단계·최종 보고 | `mydocs/` | `mydocs/plans`, `mydocs/working`, `mydocs/report` | OK | 제품 문서와 분리된 Hyper-Waterfall 내부 기록 |

제품/사용자 문서는 계획서에서 선택한 root와 `docs/`에만 두었고 `mydocs/manual`에는 추가하지 않았다.
한국어 Hyper-Waterfall 기록과 영어 public product surface도 분리했다.

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---:|---:|
| root README 줄 수 | 172 | 109 |
| npm README 줄 수 | 119 | 96 |
| CLI user guide 줄 수 | 329 | 207 |
| README card guide 줄 수 | 256 | 148 |
| 공식 docs index | 없음 | 36줄 |
| 네 핵심 사용자 문서 합계 | 876줄 | 560줄 |
| 필수 공개 진입 문서 local link missing | 기준 inventory 0 | 5개 파일, 0 |
| public release blocker | 0 | 0 |
| npm package | `0.1.3`, entry 14 | 동일 |
| GitHub default branch | `devel` | `main` |
| GitHub homepage | stage5 URL | canonical production URL |
| GitHub description | 기존 문구 | 동일 |

핵심 사용자 문서는 316줄, 약 36% 줄이면서 submit, publish, fixed README, revision sharing,
privacy와 troubleshooting 계약은 유지했다.

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| README 첫 화면에서 실제 카드·가치·시작 명령 확인 | OK — GitHub root의 `main` README가 title → value → 50% live card → badges/CTA → Quick start 순서로 렌더 |
| root/package/guide production·CLI·share 계약 일치 | OK — production origin, `@latest submit`, fixed href/src와 revision share 표현 일치 |
| 사용자/기여자/maintainer navigation 분리 | OK — root는 사용자 문서만, CONTRIBUTING과 docs index는 역할별 문서 제공 |
| public English와 Hyper-Waterfall Korean locale 분리 | OK — 네 사용자 문서 한국어 0건, `mydocs/` locale 유지 |
| GitHub metadata production/main 정합성 | OK — homepage production, default branch `main`, description exact 보존 |
| 공개 URL과 금지 표현/개인 경로 | OK — root/health/share/card 정상 응답, operator 404, 금지 표현과 current-tree 개인 절대경로 0건 |
| production/npm/durable data 불변 | OK — Sites version 3, access revision 10, environment revision 4, npm `0.1.3`; data mutation 없음 |
| build와 npm artifact | OK — Vite 1,834 modules build, package entry 14와 shasum exact |
| 공개 release scan | OK — blocker 0, review 71; review는 승인된 immutable history/test fixture 범주 |
| 변경 관련 contract tests | OK — README contract와 submit/card ETag 대상 8/8 통과 |
| Markdown link integrity | OK — 5개 공개 진입 문서 missing 0 |
| Git hygiene | OK — `git diff --check` 통과, 최종 보고서 작성 전 worktree clean |

### 단계별 검증 결과

- [Stage 1](../working/task_m100_90_stage1.md): 공개 surface inventory, audience/language와
  fixed README·revision share 계약 및 release/metadata Gate를 확정했다.
- [Stage 2](../working/task_m100_90_stage2.md): root/npm README와 두 사용자 가이드를 canonical
  production 사용자 흐름으로 보정했다.
- [Stage 3](../working/task_m100_90_stage3.md): official docs index, contributor navigation과 공개
  tree 위생을 정리했다.
- [Stage 4](../working/task_m100_90_stage4.md): PR #128과 #129를 통해 approved source의
  `devel → main` exact 승격과 실제 GitHub render를 검증했다.
- [Stage 5](../working/task_m100_90_stage5.md): GitHub homepage/default branch를 전환하고
  description 보존, production/npm/Sites 불변성과 공개 화면을 최종 확인했다.

원격 검증은 PR #128과 #129의 Node 20/22/24 package verifier SUCCESS, `main` merge
`4d1252f9988f39bdbe07f148c93ce4e9d620e35a`, production root/share/card `200`, health `200`,
operator `404`를 포함한다. GitHub repository root는 `main` branch와 production About URL을
실제로 표시한다.

## 잔여 위험과 후속 작업

### 잔여 위험

- GitHub Camo와 SNS/CDN preview는 외부 캐시 정책 때문에 origin 갱신 뒤에도 지연될 수 있다.
  revision URL은 새 social post의 cache identity를 분리하지만 즉시 처리 SLA를 보장하지 않는다.
- 전체 `node --test`는 Node 24 로컬 환경에서 `d1-concurrency.test.js` 구간이 완료되지 않아
  중단했다. Task #90 변경 관련 테스트 8개, build, npm verifier, public scan과 계획된 모든 수용
  기준은 별도 검증으로 통과했다.
- public scanner review 71건은 immutable Git history와 합성 credential fixture 범주다. blocker는
  0이며 현재 공개 source에 신규 secret이나 개인 경로가 없다.

### 후속 작업 후보

- 로컬 Node 24 전체 test runner의 `d1-concurrency.test.js` 장시간 정지를 별도 이슈로 재현하고,
  CI timeout과 로컬 실행 안정성을 점검한다.
- 마케팅 시작 뒤 사용자 피드백과 SNS별 preview fetch 시간을 관찰하되 Task #90 공개 계약과
  분리해 추적한다.

## 작업지시자 승인 요청

- 최종 보고서와 수용 기준 검증 결과를 승인하고 `publish/task90 → devel` PR을 리뷰·merge한다.
- PR merge가 확인된 뒤 Issue #90 close와 branch/worktree 정리는 `pr-merge-cleanup` 절차로 수행한다.
