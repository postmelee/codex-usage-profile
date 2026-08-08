# Task #81 최종 보고서 — 사용자 중심 README와 공개 문서·GitHub 메타데이터 정합화

GitHub Issue: [#81](https://github.com/postmelee/codex-usage-profile/issues/81)
마일스톤: M100

## 작업 요약

- 대상 이슈: #81
- 마일스톤: M100
- 단계 수: 3
- 작업 목적: 새 배포·마케팅 전에 README, 공개 사용자·운영 문서와 GitHub repository metadata의 가치 제안, URL 역할, 배포 상태를 사용자 관점으로 정합화한다.

## 변경 파일 목록과 영향 범위

| 경로·외부 상태 | 변경 요약 | 영향 범위 |
|---|---|---|
| `README.md` | Website/npm/CI/MIT badge, 가치 제안, comment image placeholder, Codex for Open Source Support, Quick start, 공유 표면과 privacy/security 경계 재구성 | GitHub 방문자, 신규 사용자, 마케팅 진입점 |
| `docs/readme-card.md` | 1497x918 README card와 2400x1260 social preview 정정, current production과 next deployment 사용자 흐름·URL 분리 | 사용자 공유·카드 계약 |
| `docs/sites-operations.md` | `/u/{handle}` canonical/OG document와 `social.png`의 owner-only/public smoke, cutover 승격 조건 추가 | Sites 배포·검증·rollback 운영 |
| `docs/production-hosting.md` | Task #74·#78 누적 후보, contract v3 projection/social media의 local·PR 검증과 production 미배포 상태 명시 | architecture·production baseline |
| GitHub repository metadata | description과 homepage를 승인된 공개 값으로 적용 | GitHub 검색·공유·홈페이지 진입 |
| `mydocs/plans/task_m100_81.md`, `task_m100_81_impl.md` | 범위, 문서 위치, 3개 Stage와 검증·rollback 계획 기록 | 내부 작업 추적 |
| `mydocs/working/task_m100_81_stage1.md`~`stage3.md` | 단계별 산출물, 검증과 다음 단계 인계 기록 | 내부 검토 증적 |
| `mydocs/report/task_m100_81_report.md` | 전체 수용 기준, 정량 비교, 잔여 위험과 후속 작업 기록 | 최종 보고·PR 검토 |
| `mydocs/orders/20260808.md` | #81 상태를 완료로 갱신 | 오늘할일 보드 |

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `README.md` | 저장소 루트 | 저장소 루트 | OK | 사용자·마케팅 기본 공개 진입점 |
| `docs/readme-card.md` | `docs/` | `docs/` | OK | 카드·공유·cache 사용자 계약의 기존 진실 원천 |
| `docs/sites-operations.md` | `docs/` | `docs/` | OK | 제품별 Sites 배포·smoke·rollback 운영 문서 |
| `docs/production-hosting.md` | `docs/` | `docs/` | OK | current production baseline과 다음 후보의 architecture 진실 원천 |
| GitHub description/homepage | GitHub repository metadata | GitHub repository metadata | OK | 파일 밖 공개 검색·공유 표면 |
| Task #81 계획·보고 문서 | `mydocs/plans`, `mydocs/working`, `mydocs/report` | 계획된 각 내부 경로 | OK | 공식 제품 문서가 아닌 Issue별 승인·검증 기록 |

신규 공식 문서 루트나 `mydocs/manual` 제품 문서는 만들지 않았다.

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| README 분량 | 241줄 | 167줄 |
| 세 공개 `docs/` 문서 합계 | 842줄 | 896줄 |
| README 상단 badge | 0개 | 4개 (Website/npm/CI/MIT) |
| 공개 README/docs의 `998x612` 표현 | 2건 | 0건 |
| 이미지 크기 계약 | README와 문서에 998x612 혼재 | README 1497x918, social preview 2400x1260 |
| GitHub description/homepage | 빈 문자열 2개 | 승인값 2개 적용 |
| 제품 code/package/workflow diff | 0개 | 0개 |
| 단계 보고서 | 0개 | 3개 |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| 사용자 중심 README 정보 위계와 reference 프로젝트형 badge | OK — Website/npm/CI/MIT 4개 badge, 가치 제안, Quick start, 공유 표면, privacy/security, 문서·license 순서로 재구성 |
| 실제 이미지 배포 전 placeholder 비렌더링 | OK — `<PRODUCTION_CARD_URL>`과 `<PRODUCTION_PROFILE_URL>`이 HTML comment 내부에 유지 |
| Codex for Open Source Support와 non-endorsement | OK — 공식 프로그램 링크와 maintainer support/비보증 문구 동시 표기 |
| current production과 next deployment 구분 | OK — saved version 7의 `/?profile={handle}`·stable card와 후보의 `/u/{handle}`·`social.png`·Share Studio를 모든 대상 문서에서 분리 |
| 이미지 크기와 URL 역할 정합성 | OK — README card 1497x918, social preview 2400x1260, `998x612` 0건 |
| Sites 운영 smoke와 cutover 계약 | OK — OG/canonical, social GET/HEAD/304, private/missing fail-closed와 배포 뒤 canonical 승격 조건 기록 |
| production hosting baseline 보존 | OK — saved version 7, source `745be1d6b00b9b97afe5e36f0bbf691e3def8ff0`, access/environment 표 값 무변경 |
| GitHub repository metadata | OK — description과 homepage가 승인된 exact 값에 일치 |
| production 무변경 | OK — `/healthz` HTTP 200, `/u/postmelee` HTTP 307과 `Location: /` 유지; Sites/D1/R2 mutation 없음 |
| npm·CI 공개 상태 | OK — npm `version`/`latest` 0.1.1, CI badge `CI: passing` |
| 공개 문서 상대 link | OK — README와 수정한 세 문서의 모든 렌더링 대상 상대 link 존재 |
| 범위 보호 | OK — 제품 code, test, workflow, package manifest와 보호 문서 diff 없음 |
| Git diff 정합성 | OK — 단계별·통합 `git diff --check` 통과 |

### 단계별 검증 결과

- Stage 1: [사용자 중심 README 재구성](../working/task_m100_81_stage1.md) — 4개 badge, Support, Quick start, placeholder와 배포 상태 검증
- Stage 2: [공개 사용자·운영 문서 계약 정합화](../working/task_m100_81_stage2.md) — URL 역할, 크기, Sites smoke, production 표와 보호 범위 검증
- Stage 3: [GitHub 공개 메타데이터 적용과 통합 검증](../working/task_m100_81_stage3.md) — metadata exact-match, production 200/307 baseline, npm·CI·link 통합 검증

## 잔여 위험과 후속 작업

### 잔여 위험

- Task #74·#78 누적 후보의 `/u/{handle}` canonical share document, 2400x1260 social preview와 Share Studio는 아직 production에 배포되지 않았다.
- README 상단 실제 카드 이미지는 의도적으로 comment placeholder다. 지금 활성화하면 미배포 URL 또는 임시 프로필을 마케팅 표면에 노출할 수 있다.
- npmjs는 자동화 HEAD 요청에 Cloudflare bot challenge를 반환할 수 있다. 실제 브라우저 렌더링과 공식 registry package `0.1.1`은 별도로 확인했다.

### 후속 작업 후보

- Task #74·#78 누적 candidate를 별도 배포 Issue에서 owner-only saved version으로 배포하고 migration/readiness, OG/social/private/missing smoke를 수행한다.
- public cutover가 통과하면 README의 `<PRODUCTION_CARD_URL>`·`<PRODUCTION_PROFILE_URL>`을 실제 프로필 embed로 교체한다.
- 배포 뒤 GitHub/Open Graph/Kakao/X 링크 미리보기와 캐시 갱신을 점검하고 마케팅 공개를 진행한다.

## 작업지시자 승인 요청

- 작업지시자는 Stage 3 완료 뒤 최종 보고 및 PR 게시 절차 진행을 승인했다. 이 보고서와 오늘할일 갱신을 커밋한 뒤 `publish/task81` push와 `devel` 대상 Open PR을 생성한다.
