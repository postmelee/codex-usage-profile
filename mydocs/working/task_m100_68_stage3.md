# Task M100 #68 Stage 3 완료보고서

- GitHub Issue: [#68](https://github.com/postmelee/codex-usage-profile/issues/68)
- 수행계획서: [`task_m100_68_impl.md`](../plans/task_m100_68_impl.md)
- 완료 단계: Stage 3 — Profile·히트맵·공유 흐름 locale 통합

## 목적

Stage 2에서 도입한 공통 locale 계층을 Profile, 공개 Profile, 토큰 활동 히트맵, 카드 상태·동작, Share Studio까지 확장한다. 브라우저 locale과 `languagechange` 이벤트를 단일 진실 원천으로 사용하면서 기존 사용자 데이터, 공개 상태, 카드 렌더링 및 공유 동작은 그대로 유지한다.

## 산출물

| 구분 | 파일 | 결과 |
| --- | --- | --- |
| 메시지·포맷터 | `src/profile-ui/messages.js`, `src/profile-ui/formatters.js` | Profile·히트맵·공유 문구와 숫자·날짜·기간 포맷을 영어/한국어로 통합 |
| Profile UI | `AccountUsageProfile.jsx`, `ProfileHeader.jsx`, `ProfileStats.jsx`, `ActivityInsights.jsx`, `CardProfilePage.jsx`, `PublicProfilePage.jsx` | owner/public Profile의 상태·통계·카드·가시성·오류 문구 locale 연동 |
| 히트맵 | `TokenActivityChart.jsx`, `heatmap.js` | 일별·주간·누적 모드, 월 라벨, 툴팁, exact token count locale 연동 |
| 공유 흐름 | `ShareStudio.jsx`, `shareStudio.js`, `cardShare.js` | 공통 locale resolver와 메시지 카탈로그를 통한 Share Studio 및 카드 URL 연동 |
| 검증 | `src/profile-ui/__tests__/formatters.test.js`, `cardShare.test.js`, `tests/profile-ui.spec.js` | 포맷터 단위 검증과 Profile·히트맵·공유 E2E locale 회귀 검증 추가 |

## 구현 결과

1. Profile 전 영역이 `useLocale`과 공통 메시지 카탈로그를 사용하도록 변경했다. 브라우저 언어가 한국어이면 한국어를, 그 외에는 영어 fallback을 사용한다.
2. 통계 숫자, 날짜, 기간, 연속 기록, reasoning 표기와 히트맵 툴팁을 locale-aware formatter로 통합했다. exact token count는 반올림 없이 유지된다.
3. 히트맵의 locale이 변경될 때 이전 언어의 tooltip 상태가 남지 않도록 source key에 locale을 포함했다.
4. Share Studio의 독립 문구 테이블을 제거하고 공통 메시지 ID adapter로 치환했다. X, LinkedIn, Reddit 같은 고유명사와 사용자 데이터는 번역하지 않는다.
5. 한국어 카드 URL에는 `?locale=ko`를 유지하고 영어 및 fallback URL에서는 locale query를 제거한다. `languagechange` 이후에도 사용자 identity, usage, visibility, publication 상태는 보존된다.

## 호환성 및 변경하지 않은 범위

- Profile backend, CLI, Sites hosting 설정, 공개 payload 계약은 변경하지 않았다.
- 카드 renderer와 정적 sample asset은 변경하지 않았다.
- publish/unpublish mutation, Share Studio animation 및 destination 동작은 변경하지 않았다.
- 서버가 반환하는 임의 오류 문구를 그대로 노출하지 않고, 기존 상태 코드에 대응하는 locale 문구만 표시한다.

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| `node --test src/profile-ui/__tests__/cardShare.test.js src/profile-ui/__tests__/formatters.test.js src/profile-ui/__tests__/heatmap.test.js src/profile-ui/__tests__/profileRoutes.test.js src/profile-ui/__tests__/publicProfileRoutes.test.js src/profile-ui/__tests__/shareStudio.test.js` | 25/25 통과 |
| `npm test` | 550건 중 544 통과, 6 환경 의존 skip, 실패 0 |
| `npm run test:e2e -- --grep "locale profile\|locale heatmap\|locale share"` | 3/3 통과 |
| `npm run test:e2e` | 53/53 통과 |
| `npm run build` | 성공, 1,819 modules transformed |
| `git diff --check` | 통과 |
| 제한 범위 diff 확인 | renderer, 정적 asset, backend, CLI/package, hosting 설정 변경 없음 |

환경 의존 skip 6건은 기존과 동일하다. PostgreSQL 동시성 5건은 `TEST_DATABASE_URL`, S3 1건은 `TEST_S3_*`가 없어 skip되었다.

## 잔여 위험

- Stage 4의 전역 활성 문구 literal audit와 모든 route의 fallback·`languagechange` artifact QA는 아직 수행하지 않았다.
- 실제 Sites production artifact와 배포 환경 검증은 이번 단계 범위가 아니며, 배포나 hosting 설정 변경도 수행하지 않았다.
- 환경 의존 PostgreSQL/S3 검증은 해당 테스트 환경이 준비될 때 별도로 실행해야 한다.

## 다음 단계

Stage 4에서 전역 활성 UI literal audit, fallback 및 실시간 언어 변경 회귀, 전체 artifact QA를 수행한다. Stage 4는 작업지시자 승인 후에만 시작한다.

## 승인 요청

Task #68 Stage 4 진행 승인을 요청한다.
