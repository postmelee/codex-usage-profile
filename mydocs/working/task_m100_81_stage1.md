# Task #81 Stage 1 완료 보고서 — 사용자 중심 README 재구성

GitHub Issue: [#81](https://github.com/postmelee/codex-usage-profile/issues/81)
구현계획서: [`task_m100_81_impl.md`](../plans/task_m100_81_impl.md)
Stage: 1

## 단계 목적

저장소의 첫 공개 진입점인 `README.md`를 사용자 관점의 가치 제안, Quick start, 공유 표면, privacy/security 경계 순서로 재구성한다. 현재 production에서 사용할 수 있는 stable README card와 다음 배포 후보의 `/u/{handle}` 공유 페이지·social preview를 구분하고, 실제 production embed는 배포 smoke 이후에만 활성화할 수 있도록 comment placeholder로 둔다.

## 산출물

| 파일 | 변경 요약 |
|---|---|
| `README.md` | Website/npm/CI/MIT badge, production 안내, 비렌더링 card placeholder, Codex for Open Source Support, 사용자 Quick start, 공유 표면 상태표, requirements·CLI·privacy·개발·문서·license/trademark를 167줄로 재구성 |
| `mydocs/working/task_m100_81_stage1.md` | Stage 1 변경·검증·잔여 위험과 Stage 2 인계 기록 |

## 본문 변경 정도 / 본문 무손실 여부

README는 사용자 중심 정보 위계에 맞춰 241줄에서 167줄로 전면 재구성했다. 기존 장문의 Cloud Run POC, runtime 설정표, 세부 API 설명은 삭제된 기능 계약으로 만들지 않고 해당 공식 운영 문서 링크로 축약했다. 다음 핵심 사실은 유지했다.

- 공개 npm 버전 `0.1.1`과 canonical production origin
- analyzer의 Codex App Server `account/usage/read` 사용 경계
- GitHub 소유권, private-by-default, stable README URL·ETag 갱신 계약
- 1497x918 README PNG와 2400x1260 next-candidate social PNG의 역할
- MIT License와 비공식 community project Trademark Notice

현재 production에 배포되지 않은 `/u/{handle}` HTML·social preview는 `Next deployment`로 표시했으며, 상단 실제 embed marker는 HTML comment 내부에만 두었다.

## 검증 결과

실행 명령:

```bash
npm view codex-usage-profile version dist-tags --json
curl -fsSL 'https://img.shields.io/github/actions/workflow/status/postmelee/codex-usage-profile/publish-npm.yml?branch=devel&label=CI'
curl -fsSI 'https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site'
curl -fsSI 'https://www.npmjs.com/package/codex-usage-profile'
curl -fsSI 'https://developers.openai.com/community/codex-for-oss'
curl -fsSI 'https://github.com/postmelee/codex-usage-profile/actions/workflows/publish-npm.yml'
curl -fsSI 'https://registry.npmjs.org/codex-usage-profile/0.1.1'
rg -n 'Website|npm package|CI|License: MIT|PRODUCTION_CARD_URL|PRODUCTION_PROFILE_URL|Codex for Open Source|does not imply endorsement|1497x918|2400x1260|998x612' README.md
git diff --name-only
git diff --check
```

결과:

- OK — npm registry의 `version`과 `dist-tags.latest`는 모두 `0.1.1`이다.
- OK — CI badge SVG의 접근성 label과 title은 모두 `CI: passing`이다.
- OK — Website target은 HTTP 200, GitHub Actions workflow target은 HTTP 200, Codex for Open Source 공식 문서는 HTTP 200이다.
- OK — npm package page는 실제 브라우저에서 `codex-usage-profile - npm`, `0.1.1`, `Public`으로 렌더링됐다. 자동화 HEAD는 npmjs의 Cloudflare bot challenge로 403을 반환했으나, canonical `npmjs.com` redirect는 301이고 공식 registry의 `codex-usage-profile/0.1.1`은 HTTP 200으로 확인했다.
- OK — Website/npm/CI/MIT 4개 badge와 Support/non-endorsement 문구가 존재한다.
- OK — `<PRODUCTION_CARD_URL>`과 `<PRODUCTION_PROFILE_URL>`은 `README.md` 15~19행의 HTML comment 내부에만 있으며 활성 이미지가 아니다.
- OK — `1497x918`, `2400x1260`은 각각 정확한 용도로 존재하고 `998x612` 표현은 제거됐다.
- OK — README의 모든 상대 Markdown link 대상이 존재하고 Trademark Notice가 유지됐다.
- OK — 보고서 작성 전 tracked diff는 `README.md`에 한정됐고 `git diff --check`가 통과했다.

## 잔여 위험

- 실제 `/u/{handle}` share page와 social preview는 아직 production에 배포되지 않았다. Task #81에서는 placeholder를 활성화하거나 production 배포를 수행하지 않는다.
- npmjs가 자동화 HEAD 요청에 bot challenge를 반환할 수 있다. 사용자 브라우저 렌더링과 공식 registry package 존재는 별도로 확인했다.

## 다음 단계 영향

- Stage 2에서 `docs/readme-card.md`, `docs/sites-operations.md`, `docs/production-hosting.md`의 current production과 next deployment 상태를 README와 같은 용어로 정합화해야 한다.
- Stage 2는 제품 code, test, workflow, package manifest와 보호 문서를 수정하지 않는다.
- 실제 embed marker 교체와 Sites 배포는 Task #81 범위 밖의 후속 Issue로 유지한다.

## 승인 요청

- Stage 1 산출물과 검증 결과를 승인하면 Stage 2 공개 사용자·운영 문서 계약 정합화로 진행한다.
