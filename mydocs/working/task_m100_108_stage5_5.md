# Task #108 Stage 5.5 중간 보고 — Gate F2 production 비파괴 전체 흐름

GitHub Issue: [#108](https://github.com/postmelee/codex-usage-profile/issues/108)
구현계획서: [`task_m100_108_impl.md`](../plans/task_m100_108_impl.md)
Stage: 5.5 / Gate F2 non-destructive

## 단계 목적

Gate F1에서 exact `main`과 migration 1–6으로 맞춘 canonical production에서 OAuth 세션,
공개 profile/card/share, 공개 npm CLI 기본 origin 제출, 고정 README와 revision 공유 계약,
다섯 SNS target·crawler metadata를 실제 사용자 흐름으로 확인한다. 외부 SNS 글과 production
account deletion은 실행하지 않는다.

## 산출물

| 산출물 | 결과 |
|---|---|
| production OAuth/session | 기존 세션 로딩, logout, GitHub OAuth 재로그인이 모두 정상 동작했다. |
| clean `@latest` CLI | 격리된 XDG 설정에서 기본 origin login/status/submit을 확인했다. |
| fixed README contract | submit 전후 README Markdown이 완전히 동일했다. |
| revision share contract | 공유 revision과 X·LinkedIn·Threads·Facebook·Reddit target이 새 revision으로 함께 바뀌었다. |
| crawler preview | X·LinkedIn·Meta crawler User-Agent가 새 revision의 OG/Twitter metadata와 이미지를 200으로 받았다. |
| credential cleanup | 검증용 API token을 서버에서 폐기하고 격리된 로컬 credential·임시 디렉터리를 제거했다. |
| final isolation | production의 exact-main/public/migration 경계와 Stage5 owner-only/version/operation 불변을 재확인했다. |

## 본문 변경 정도 / 본문 무손실 여부

제품 source와 공식 사용자·운영 문서는 수정하지 않았다. production에는 새 집계 사용량 제출 1건과
OAuth session 재발급만 발생했다. 기존 공개 계정·카드·usage와 D1/R2 object는 삭제하지 않았다.
SNS intent URL은 읽기만 했고 X·LinkedIn·Threads·Facebook·Reddit에 글을 게시하지 않았다.

CLI credential은 repository 밖 임시 XDG 설정에 mode `0600`으로 저장했다. 값은 읽거나 문서화하지
않았고 검증 뒤 서버 token을 폐기한 다음 CLI logout으로 로컬 credential을 삭제했다. 사용자 측
추적되지 않은 `packages/.DS_Store`는 수정·삭제·커밋하지 않았다.

## 실제 사용자 흐름 결과

### OAuth와 공개 profile

- production origin에서 로그인된 `@postmelee` owner profile과 공개 카드가 정상 로드됐다.
- 계정 메뉴 logout 뒤 로그인 필요 상태가 확인됐다.
- GitHub OAuth login을 다시 실행하면 production settings로 복귀하고 owner session이 복원됐다.
- API token UI는 검증 종료 뒤 `0/3`이다.

### 공개 npm CLI

- npm dist-tag: `latest=0.1.3`
- 별도 `--server` 없이 production 기본 origin으로 기기 login 성공
- login credential file permission: `0600`
- submit 결과: `accepted`, `idempotent=false`
- submit capturedAt: `2026-08-24T10:39:11.820Z`
- submit 뒤 status latestUsage가 같은 capturedAt/uploadedAt을 반환
- 검증용 token은 폐기됐고 D1의 해당 row도 revoked 상태다.

### README와 revision 공유 계약

submit 전후 README Markdown은 아래 stable URL을 그대로 사용해 완전히 동일했다.

- href: `/api/share/postmelee`
- img src: `/u/postmelee/card.png`

revision은 다음과 같이 변경됐다.

- submit 전: `1787546241667`
- submit 후: `1787567964615`

새 revision은 공유 스튜디오의 X·LinkedIn·Threads·Facebook·Reddit target에 모두 같은
`/api/share/postmelee/r/1787567964615`로 반영됐다. 고정 README share route와 card image는
각각 HTML 200, PNG 200을 유지했다.

### SNS crawler metadata

X, LinkedIn, Meta crawler User-Agent로 새 revision route를 조회한 결과가 모두 HTML 200이었다.

- canonical·`og:url`: revision share URL과 일치
- `og:image`·`og:image:secure_url`: `social.png?v=1787567964615`
- `twitter:card`: `summary_large_image`
- `twitter:image`: 같은 revision image URL
- revision social image: PNG 200

## 최종 live 경계

production:

- active/public saved version 3
- source `dfc80d0b867bdb6a9afc002439d478ffb0aa38dd`
- access revision 10, environment revision 4
- maintenance disabled, service normal, operator token key absent
- D1 migration exact `[1,2,3,4,5,6]`
- `account_deletion_operations` 0건
- API token active 0건
- root 200, `/healthz` 200, anonymous `/api/auth/me` 401
- unauthenticated maintenance POST generic 404

Stage5:

- owner-only/custom saved version 36
- source `dfc80d0b867bdb6a9afc002439d478ffb0aa38dd`
- access revision 62, environment revision 119
- maintenance disabled, service normal, operator token key absent
- D1 migration exact `[1,2,3,4,5,6]`
- 기존 deletion operation 1건은 `structured`, lease 없음으로 불변
- Stage5 mutation 0건; live recovery·data disposal은 계속 #125 범위

## 검증 결과

```bash
npm run build:production
npm run verify:sites-fullstack
npm run verify:sites-production
npm view codex-usage-profile@0.1.3 version dist.integrity dist.tarball --json
npm view codex-usage-profile dist-tags --json
npm run scan:public-release
git diff --check
git status --short
```

- `build:production`: 성공
- `verify:sites-fullstack`: `ok=true`, migration file 6개
- `verify:sites-production`: `ok=true`, production project·binding·migration 일치
- npm: `0.1.3`, `latest=0.1.3`
- public release scan: `ok=true`, blocker 0
- working tree: 사용자 측 `packages/.DS_Store` 외 신규 변경 없음

## 잔여 위험과 승인 경계

- **통과 — 비파괴 공개 흐름**: production login/session/logout, CLI submit, public profile/card,
  fixed README, revision share와 SNS preview metadata는 공개·마케팅 전 비파괴 Gate를 충족한다.
- **미실행 — production account deletion E2E**: disposable production owner가 없고 repository 밖
  mode `0600` export·exact plan digest/count도 만들지 않았으므로 기존 `@postmelee` owner를
  삭제하지 않았다. 계정 삭제 성공을 추정하거나 주장하지 않는다.
- 작업지시자는 2026-08-24 Stage5 #122 검증과 #125 handoff를 근거로 production deletion E2E를
  공개 차단 조건에서 제외하는 risk acceptance를 명시 승인했다. production 삭제 성공을 수행·추정한
  것으로 기록하지 않으며, disposable identity가 생기면 별도 파괴적 승인 절차를 다시 적용한다.

## 다음 단계 영향

승인된 risk acceptance를 구현계획서와 Stage 5 최종 보고서에 반영하고 Stage 6 진입 승인을
요청한다. production 계정·D1/R2와 Stage5에는 추가 변경을 만들지 않는다.
