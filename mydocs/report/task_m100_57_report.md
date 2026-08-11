# Task M100 #57 최종 보고서

GitHub Issue: [#57](https://github.com/postmelee/codex-usage-profile/issues/57)
마일스톤: M100

## 작업 요약

- 대상 이슈: #57
- 마일스톤: M100
- 단계 수: 4
- 작업 목적: PATH에 별도 Codex CLI가 없어도 표준 macOS
  ChatGPT/Codex 앱 번들을 자동 탐색하는 public CLI patch를 provenance와
  함께 게시한다.

profile CLI에 별도 resolver를 중복 구현하지 않고 공개
`codex-usage-analyzer@0.4.1`을 exact dependency로 채택했다. package
version을 `0.1.1`로 올리고 lock/verifier/local smoke를 강화한 뒤
immutable tag와 trusted publisher staged publishing으로 npm에 공개했다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `packages/codex-usage-profile-cli/package.json`, `src/cli.js` | CLI `0.1.1`, analyzer exact `0.4.1` 채택 | public CLI version과 usage source |
| `package-lock.json` | analyzer registry URL·integrity·engine exact 고정 | 재현 가능한 dependency graph |
| `packages/codex-usage-profile-cli/test/cli.test.js` | public version assertion | CLI 회귀 |
| `scripts/verify-npm-release.mjs`, 관련 test | release expected metadata와 drift reject 갱신 | npm 공급망 fail-close |
| `scripts/smoke-npm-package-local.mjs`, 관련 test | installed analyzer contract와 drift 검사 추가 | packed package 격리 smoke |
| `README.md`, package README | `0.1.1`, 표준 macOS app fallback과 자동화 pin 안내 | 사용자 설치·첫 실행 |
| `docs/cli-submit.md`, `docs/codex-usage-analyzer.md` | executable lookup, troubleshooting과 책임 경계 갱신 | 사용자·통합 계약 |
| `docs/npm-release.md` | Gate B, actual tag/run/provenance/integrity와 production 결과 | maintainer release 운영 |
| `mydocs/plans/task_m100_57*.md` | 승인된 수행·구현 계획 | 작업 추적 |
| `mydocs/working/task_m100_57_stage*.md` | Stage 1~4 변경·검증·승인 근거 | 단계별 장기 증적 |
| `mydocs/orders/20260729.md`, `20260730.md` | 진행 및 완료 상태 | 오늘할일 |

Sites/backend/UI와 #55 skeleton은 수정하지 않았다. Account Usage Contract
v1, submit payload/header, credential storage, production service origin과
public/private visibility 계약도 변경하지 않았다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `README.md` | 저장소 root | 저장소 root | OK | 첫 실행 entrypoint 유지 |
| `packages/codex-usage-profile-cli/README.md` | package root | package root | OK | npm tarball 사용자 안내 유지 |
| `docs/cli-submit.md` | 공식 `docs/` | 공식 `docs/` | OK | CLI 요구사항·troubleshooting 진실 원천 |
| `docs/codex-usage-analyzer.md` | 공식 `docs/` | 공식 `docs/` | OK | active analyzer 책임 경계 |
| `docs/npm-release.md` | 공식 `docs/` | 공식 `docs/` | OK | immutable release 운영 기록 |
| task 계획·단계·최종 보고 | 표준 `mydocs/` | `mydocs/plans`, `working`, `report` | OK | 이슈별 산출물과 제품 문서 분리 |

새 공식 문서 루트나 `mydocs/manual` 제품 문서는 만들지 않았다.

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| public CLI | `0.1.0` | `0.1.1`, `latest` |
| exact analyzer dependency | `0.2.0` | `0.4.1` |
| Codex executable 후보 | PATH 1개 | PATH 우선 + macOS 표준 앱 4개 |
| local tarball smoke | 기존 CLI 경계 | analyzer contract 포함 6개 경계 |
| package artifact | `0.1.0` 13 files | `0.1.1` 13 files, 14,451/50,500 bytes |
| CLI test | 46건 | 46/46 통과 |
| root test | 493건 | 487 통과, 6 external 설정 부재 skip, 실패 0 |
| public scanner | blocker 0, 승인 review 12 | blocker 0, 동일 review 12 |
| 공개 CLI production audit | 취약점 0 | 취약점 0 |
| 전체 task diff | 해당 없음 | 21 files, +1,408/-46 |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| analyzer exact version·registry integrity·MIT·Node engine 고정 | OK — manifest, lockfile, verifier와 registry metadata 일치 |
| PATH 우선과 네 macOS 표준 앱 fallback, 후보 부재 fail-close | OK — upstream 9 tests, installed source 대조와 sanitized actual smoke 통과 |
| Account Usage Contract v1과 privacy/credential 경계 불변 | OK — CLI 46 tests, allowlist actual smoke와 production output 확인 |
| immutable candidate와 public artifact 일치 | OK — 13 files, SHA-1 `4eeafe6d095f923f5bd0501c7639a649e9fa65cf`, reviewed SHA-512 일치 |
| trusted publisher provenance와 CI | OK — Actions run `30518613039`, Node 20/22/24와 staged publish 성공 |
| public exact/`@latest` 실행 | OK — 둘 다 CLI `0.1.1` 반환 |
| PATH prefix 없는 production submit/status | OK — submit accepted, v1 metadata 반영, visibility `private` 유지 |
| 전체 회귀 | OK — root 493건 중 487 pass, configured external Postgres/S3 6 skip, fail 0 |
| public surface | OK — scanner blocker 0, 기존 승인 review 12, 신규 범위 이탈 없음 |
| 문서와 source 상태 | OK — `git diff --check`, release verifier와 격리 smoke 통과 |

### 단계별 검증 결과

- [Stage 1](../working/task_m100_57_stage1.md): CLI `0.1.1`, analyzer exact
  `0.4.1`, lock/verifier contract와 production audit 확정
- [Stage 2](../working/task_m100_57_stage2.md): installed analyzer contract,
  lookup 순서, sanitized macOS bundle fallback과 fail-close 검증
- [Stage 3](../working/task_m100_57_stage3.md): 공식 문서, 전체 preflight와
  immutable candidate digest·Gate B exact 값 확정
- [Stage 4](../working/task_m100_57_stage4.md): annotated tag, provenance
  public release, registry/attestation과 prefix 없는 production smoke 완료

## 잔여 위험과 후속 작업

### 잔여 위험

- `0.1.1` artifact와 tag는 immutable이다. 결함은 같은 version을
  덮어쓰지 않고 새 patch와 provenance로 복구해야 한다.
- app bundle fallback은 analyzer `0.4.1`의 네 macOS 표준 후보에
  한정된다. 비표준 설치는 공식 Codex CLI를 PATH에 노출해야 한다.
- published `0.1.1` package README는 candidate 시점의 “prepared for
  provenance publishing” 표현을 immutable tarball 안에 보존한다. 기능과
  registry 상태에는 영향이 없으며 다음 patch에서만 변경할 수 있다.
- production smoke는 기존 owner의 private profile을 사용했다. visibility
  변경이나 공개 카드 게시 흐름은 이번 patch에서 반복하지 않았다.

### 후속 작업 후보

- Issue #55: loading card에서 기존 owner card가 잠깐 노출되지 않도록
  skeleton animation 구현. Task #57 PR merge와 cleanup 뒤 시작한다.

## 작업지시자 승인 요청

- 최종 보고서와 수용 기준 검증 결과를 승인하면 `publish/task57`
  브랜치와 `devel` 대상 PR을 게시한다.
