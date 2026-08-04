# Task M100 #69 최종 보고서

GitHub Issue: [#69](https://github.com/postmelee/codex-usage-profile/issues/69)
마일스톤: M100

## 작업 요약

- 대상 이슈: #69
- 마일스톤: M100
- 단계 수: 7개(Stage 1, 2, 3, 3.5, 3.6, 3.7, 4)
- 작업 목적: product와 Sites 전체 표면에 공통 semantic theme 계약과 접근 가능한
  `system | light | dark` appearance를 제공한다.

두 HTML entry의 React 실행 전 bootstrap, 공용 ThemeProvider, semantic CSS token과 Settings
Appearance control을 도입했다. Home, Marketing, owner/public Profile, Settings, device 승인,
Share Studio와 loading·empty·error·skeleton·heatmap·tooltip 상태가 resolved theme를 공유한다.
추가 승인된 Stage 3.5에서는 owner-only on-demand 카드 preview에 light/dark renderer를 연결하되
공개 카드와 R2 stable object는 기존 dark 계약을 유지했다.

## 변경 파일 목록과 영향 범위

| 경로 | 변경 요약 | 영향 범위 |
|---|---|---|
| `index.html`, `sites.html` | React 이전 no-flash theme bootstrap 적용 | product·Sites 첫 paint |
| `src/profile-ui/theme.js`, `ThemeProvider.jsx` | preference 정규화, safe storage, system 구독과 document 동기화 | 전역 appearance runtime |
| `src/styles.css` | dark 기준선을 보존한 semantic light/dark token과 전체 surface mapping | 모든 product·Sites UI |
| `src/profile-ui/SettingsPage.jsx` | 인증 상태와 무관한 native radio Appearance panel | Settings·keyboard 접근성 |
| `src/profile-ui/HomePage.jsx`, `CardProfilePage.jsx` | resolved theme 기반 owner-only 카드 preview | Home·owner Profile·Share Studio |
| `src/profile-card/`, `src/profile-backend/http.js`, `src/profile-api/client.js` | light/dark private renderer와 theme query 전달, 공개 dark 기본값 유지 | owner on-demand preview만 해당 |
| `src/profile-ui/messages.js` | en/ko appearance 문구 추가 | browser locale UI |
| `src/profile-ui/__tests__/theme.test.js`, 관련 단위 테스트 | bootstrap/runtime/storage/renderer 계약 검증 | 자동 회귀 |
| `tests/profile-ui.spec.js` | route·theme·first paint·mobile·keyboard·reduced-motion E2E | 브라우저 수용 기준 |
| `mydocs/plans/`, `mydocs/working/`, `mydocs/report/` | 승인 범위, 단계 근거와 최종 결과 기록 | 내부 Hyper-Waterfall 기록 |

`.openai/hosting.json`, package·lockfile, CLI, D1/R2 migration, runtime/media와 public static asset은
변경하지 않았다.

## 문서 위치 검증

| 파일 | 계획된 위치 | 실제 위치 | 결과 | 근거 |
|---|---|---|---|---|
| `task_m100_69.md` | `mydocs/plans/` | `mydocs/plans/task_m100_69.md` | OK | 승인 범위와 문서 위치 판단 기록 |
| `task_m100_69_impl.md` | `mydocs/plans/` | `mydocs/plans/task_m100_69_impl.md` | OK | Stage 실행·검증 계약 기록 |
| `task_m100_69_stage*.md` | `mydocs/working/` | `mydocs/working/task_m100_69_stage*.md` | OK | 7개 단계 보고서 보존 |
| `task_m100_69_report.md` | `mydocs/report/` | `mydocs/report/task_m100_69_report.md` | OK | 수용 기준과 잔여 위험 장기 보관 |
| 공식 제품 문서 | 변경 없음 | 변경 없음 | OK | 새 명령·공개 API·배포 절차가 없고 UI 안에서 발견 가능 |

## 변경 전·후 정량 비교

| 지표 | 변경 전 | 변경 후 |
|---|---|---|
| appearance preference | dark 고정 1종 | `system`, `light`, `dark` 3종 |
| resolved theme | dark 1종 | light·dark 2종, system runtime 변화 추종 |
| HTML no-flash bootstrap | 없음 | product·Sites 2개 entry 동일 계약 |
| Settings appearance 선택 | 없음 | native radio 3개, keyboard 선택 지원 |
| owner private 카드 theme | dark 기본 1종 | light·dark 2종, query 없는 요청은 dark 호환 |
| 전체 Node 검증 | 기존 기준 | 568건 중 562건 통과, 환경 조건부 6건 skip, 실패 0건 |
| 전체 Playwright 검증 | 기존 기준 | 64건 전체 통과 |
| 코드·작업 문서 diff | 해당 없음 | 40 files, +3,316 / -349 lines(Stage 4 commit 기준) |

## 검증 결과

| 수용 기준 | 결과 |
|---|---|
| 첫 방문 system theme와 runtime OS 변화 추종 | OK — bootstrap/runtime parity, media change와 system preference E2E 통과 |
| 명시 light/dark override 즉시 적용·device-local 보존 | OK — storage persistence, reload, context와 keyboard 선택 검증 통과 |
| product·Sites 첫 paint에서 반대 theme 방지 | OK — 두 entry bootstrap source·computed style 시점 검증 통과 |
| 전체 route·dialog semantic light/dark mapping | OK — Home, Marketing, Profile, Settings, device, Share Studio 대표 E2E 통과 |
| heatmap·tooltip·skeleton·card 효과·상태 대비 | OK — 5단계 heatmap, light tooltip, loading/error, beam/glare computed style 검증 통과 |
| mobile·keyboard·reduced-motion 유지 | OK — 전체 Playwright 시나리오 포함, 64건 통과 |
| owner-only themed preview와 공개 카드 호환 | OK — private light/dark URL·renderer 분리, query 없는/public 카드 dark 유지 테스트 통과 |
| Sites production artifact 계약 | OK — client 7, worker 2, migration 3, binding 3개 verifier 통과 |
| 제외 범위 보존 | OK — hosting manifest, package·lockfile, CLI, D1/R2 migration, runtime/media, public asset diff 없음 |
| 배포 경계 | OK — production deploy와 environment/access/secret 변경 미수행 |
| PR 준비 상태 | OK — `git diff --check` 통과, 최종 보고 커밋 전 작업트리 통제 |

### 단계별 검증 결과

- [Stage 1](../working/task_m100_69_stage1.md): appearance runtime, safe storage, 두 entry 초기 bootstrap 확정
- [Stage 2](../working/task_m100_69_stage2.md): semantic token inventory와 전체 surface light/dark 이관
- [Stage 3](../working/task_m100_69_stage3.md): Settings Appearance control, keyboard·system·persistence 검증
- [Stage 3.5](../working/task_m100_69_stage3_5.md): owner-only theme 카드 renderer·preview 연결, 공개 dark 호환 유지
- [Stage 3.6](../working/task_m100_69_stage3_6.md): light Profile heatmap tooltip surface 보정
- [Stage 3.7](../working/task_m100_69_stage3_7.md): Appearance panel 제목과 Home command surface 보정
- [Stage 4](../working/task_m100_69_stage4.md): Node 568건, Playwright 64건, 전체 build·Sites artifact 검증

## 잔여 위험과 후속 작업

### 잔여 위험

- `TEST_DATABASE_URL`과 `TEST_S3_*`가 필요한 기존 PostgreSQL·S3 통합 테스트 6건은 로컬 환경
  변수가 없어 조건부 skip되었다. #69 UI/theme 경로와 직접 관련되지 않으며 real workerd D1
  동시성 invariant 6건은 통과했다.
- production 환경의 실제 system theme 전환과 hosted visual smoke는 배포 후 release QA에서 확인해야
  한다. 이 타스크에서는 승인 범위에 따라 production deploy를 수행하지 않았다.
- 공개 stable card는 의도적으로 dark 단일 객체를 유지한다.

### 후속 작업 후보

- [#74](https://github.com/postmelee/codex-usage-profile/issues/74) — Profile 카드 customization,
  light/dark R2 이중 객체와 theme query 기반 공개 URL 복사

## 작업지시자 승인 요청

- Stage 4 승인과 최종 보고·PR 게시 지시에 따라 `publish/task69` 브랜치와 `devel` 대상 PR을
  생성한다. merge는 작업지시자 검토 후 별도로 수행한다.
