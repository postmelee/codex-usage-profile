# Task #92 Stage 1 완료보고서 — 재현과 회귀 계약 확정

- GitHub Issue: [#92](https://github.com/postmelee/codex-usage-profile/issues/92)
- 구현계획서: [`task_m100_92_impl.md`](../plans/task_m100_92_impl.md)
- Stage: 1

## 단계 목적

모바일 Safari·Chrome에서 발견된 공유 카드 과대 확대와 계정 메뉴 터치 활성화 소실을 제품 소스 변경 없이 자동화 가능한 회귀 계약으로 재현하고, 기존 자동 검증이 놓친 원인을 수치로 고정한다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `tests/profile-ui.spec.js` | E2E origin 격리 지원, 모바일 Share Studio unsafe-scale known failure, null-relatedTarget 계정 메뉴 known failure 추가 |
| `mydocs/working/task_m100_92_stage1.md` | Stage 1 재현 수치, 검증 결과, Stage 2·3 입력 계약 기록 |

## 본문 변경 정도 / 본문 무손실 여부

제품 소스와 사용자·공개 문서는 변경하지 않았다. 기존 E2E의 기본 origin은 `http://127.0.0.1:5173`으로 유지하고, 다른 로컬 서비스와 포트가 충돌하는 경우에만 `PROFILE_E2E_ORIGIN`으로 동일 테스트를 격리할 수 있게 했다. 기존 테스트의 의미와 기본 기대값은 보존했다.

## 재현 결과

### 모바일 공유 카드 전환

- 390 × 844, touch/mobile context에서 홈 source rect를 실제 기기 증상에 해당하는 불안전한 크기로 주입했다.
- 현재 구현은 source/target 배율의 상한이나 첫 프레임 뷰포트 경계를 검사하지 않는다.
- 측정 결과:
  - `scaleX = 2.985`
  - `scaleY = 2.985`
  - `withinViewport = false`
- 수용 조건은 `scaleX = scaleY = 1`, `withinViewport = true`로 고정했다.
- 기존 모바일 테스트는 애니메이션이 끝난 뒤 최종 레이아웃만 확인하므로 이 결함을 잡지 못했다.
- Stage 2에서 capability·사각형 안전성 판정과 scale 없는 중심점 이동을 구현하면 known-failure annotation을 제거한다.

### 모바일 계정 메뉴

- 390 × 844, touch/mobile context에서 첫 메뉴 항목이 포커스된 뒤 실제 `blur()`로 `relatedTarget = null` 경로를 재현했다.
- 현재 동기 blur handler가 메뉴를 즉시 닫아 다음 tick의 `menuCount`가 `0`이 됐다.
- 수용 조건은 활성화 전 `menuCount = 1`이며, 그 다음 Profile 터치가 `/?view=profile`로 이동하는 것으로 고정했다.
- 기존 모바일 테스트는 href 존재만 확인하고 실제 터치 활성화를 수행하지 않아 결함을 잡지 못했다.
- Stage 3에서 다음 animation frame의 실제 포커스 검사로 보정하면 known-failure annotation을 제거한다.

## 검증 결과

기본 `5173` 포트가 다른 로컬 프로젝트에서 사용 중이므로 그 프로세스는 변경하지 않고, 임시 Playwright 설정으로 #92 worktree 서버를 `5182`에 격리했다. 테스트 내용과 기본 origin 계약은 동일하다.

실행 명령:

```bash
PROFILE_E2E_ORIGIN=http://127.0.0.1:5182 \
  npx playwright test tests/profile-ui.spec.js \
  --config=/private/tmp/task92-playwright.config.mjs \
  --grep "Task #92|account menu exposes Profile|card owner can publish" \
  --workers=1
git diff --check
```

결과:

- OK — 4개 테스트 통과
  - 2개 known failure가 기대한 원인과 수치로 실패해 Playwright가 통과 처리
  - 계정 메뉴 키보드 기준선 통과
  - 데스크톱 카드 공유 공간 전환 기준선 통과
- OK — `git diff --check` 경고 없음
- 참고 — 격리 전 실행은 다른 프로젝트가 점유한 `5173`을 `reuseExistingServer`로 잘못 재사용해 실패했으며, #92 코드 또는 제품 동작 실패가 아님을 페이지 스냅샷과 서버 cwd로 확인했다.

## 잔여 위험

- Chromium 모바일 에뮬레이션은 실제 Safari·Chrome의 동적 viewport와 이벤트 타이밍을 완전히 복제하지 않는다. 이번 계약은 실제 기기에서 관찰된 입력 조건을 결정적으로 재현하는 안전성 테스트다.
- known-failure annotation은 결함을 문서화하지만 제품을 보정하지 않는다. 각각 Stage 2와 Stage 3에서 제거해야 한다.
- 정상 모바일 rect에서는 최종 레이아웃 기준선이 통과한다. 실제 기기에서 간헐적으로 발생하는 불안전한 rect의 생성 시점 자체는 Stage 2 안전 판정과 Stage 4 실제 기기 실측으로 추가 확인한다.

## 다음 단계 영향

- Stage 2는 source/target rect가 유효하다는 사실만으로 FLIP을 허용하지 말고 입력 capability, scale, 시작 프레임 경계를 모두 판정해야 한다.
- coarse pointer 또는 불안전한 rect에서는 target 크기 `scale(1)`을 유지한 채 source·target 중심점 사이를 이동한다.
- 중심점 이동도 뷰포트 안전 조건을 만족하지 않으면 target 위치 진입으로 정착한다.
- 열기와 닫기 모두 같은 안전 판정을 사용해야 모바일에서 역방향 확대가 재발하지 않는다.
- 계정 메뉴 보정은 Stage 3 범위이므로 Stage 2에서는 제품 메뉴 코드를 수정하지 않는다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 모바일 공유 카드 공간 전환 보정으로 진행한다.
