# Task M100 #20 Stage 4 보고서

GitHub Issue: [#20](https://github.com/postmelee/codex-usage-profile/issues/20)
구현계획서: [`task_m100_20_impl.md`](../plans/task_m100_20_impl.md)
Stage: 4

## 단계 목적

Stage 4는 `codex-usage-analyzer` SDK/CLI boundary, wrapper compatibility, profile integration, standalone repository split timing을 공식 문서와 README에 연결하는 단계다.

이번 단계에서는 workspace package가 후속 standalone repository로 이동할 수 있는 handoff와, `tokenmon` 같은 wrapper CLI가 analyzer SDK를 감싸는 방법을 문서화했다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `docs/codex-usage-analyzer.md` | analyzer package status, CLI contract, SDK contract, ownership boundary, wrapper compatibility, profile integration, standalone repository timing, non-goals를 공식 문서로 추가했다. |
| `README.md` | Analyzer Package 섹션을 추가해 workspace package 위치, CLI smoke command, contract-first 상태, 공식 analyzer 문서 링크를 연결했다. |
| `packages/codex-usage-analyzer/README.md` | SDK public exports, wrapper submit 예시, wrapper metadata exclusion, repository split timing을 보강했다. |
| `docs/usage-snapshot-v2.md` | analyzer SDK/CLI boundary 문서 링크를 추가했다. |
| `mydocs/working/task_m100_20_stage4.md` | Stage 4 완료 보고서와 검증 결과를 작성했다. |

## 본문 변경 정도 / 본문 무손실 여부

- 신규 공식 문서 `docs/codex-usage-analyzer.md` 162 lines를 추가했다.
- root README에는 짧은 analyzer package 안내 섹션만 추가했다.
- 기존 `UsageSnapshot v2` 문서는 analyzer 문서 링크만 추가해 계약 본문을 보존했다.
- package README는 기존 CLI/SDK/Boundary 내용을 유지하면서 public exports와 split timing을 보강했다.
- 코드 변경은 없다.

## 검증 결과

실행 명령:

```bash
node packages/codex-usage-analyzer/bin/codex-usage-analyzer.js analyze --json
npm test
npm run build
git status --short
git diff --check
```

결과:

- OK — analyzer CLI smoke command가 `UsageSnapshot v2` JSON을 stdout에 출력했다.
- OK — root `npm test` 136개 테스트 통과.
- OK — `npm run build` 통과.
- OK — `git diff --check` 경고 없음.
- OK — `git status --short`에서 Stage 4 문서 변경만 확인했다.

## 잔여 위험

- analyzer는 아직 sample-backed skeleton이다. 실제 local source parser는 후속 작업에서 구현해야 한다.
- standalone `codex-usage-analyzer` GitHub repository는 아직 생성하지 않았다. #20 merge 이후, #5 submit CLI 본격 구현 전에 별도 bootstrap 작업으로 진행하는 것이 적절하다.
- npm publish automation과 package repository metadata는 standalone repository bootstrap 이후 확정해야 한다.

## 다음 단계 영향

- 최종 보고서에서는 #20 산출물이 workspace package, canonical v2 contract module, compatibility re-export, wrapper documentation까지 완료했음을 정리한다.
- 후속 standalone repository bootstrap 작업은 `packages/codex-usage-analyzer/`를 시작점으로 삼으면 된다.
- #5 profile submit CLI는 analyzer SDK를 호출하고 profile service submit API로 전송하는 wrapper로 구현하면 된다.
- `tokenmon` 같은 별도 제품은 analyzer SDK를 import하고 자체 login/submit/card rendering을 소유하는 구조로 갈 수 있다.

## 승인 요청

- Stage 4 산출물과 검증 결과를 승인하면 최종 보고서 작성과 PR 게시 준비로 진행한다.
