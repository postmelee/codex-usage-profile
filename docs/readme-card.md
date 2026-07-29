# GitHub README 카드

Codex Usage Profile은 GitHub 계정 정보와 Codex 사용량을 서버에서 병합해 998x612 PNG 카드를 제공한다. 사용자는 한 번 복사한 공개 이미지 URL을 GitHub README에 유지할 수 있고, 이후 사용량 제출이 성공하면 같은 URL이 최신 카드로 다시 렌더링된다.

## 사용자 흐름

1. 웹사이트에서 **Sign in with GitHub**을 선택한다.
2. 로그인 후 `/profile`에서 GitHub 이름, 사용자명, 아바타가 반영된 private preview를 확인한다.
3. CLI `submit`으로 Codex 사용량을 전송한다. credential이 없으면 browser 승인을 먼저 진행하고 같은 명령에서 제출을 계속한다. 사용량이 아직 없으면 카드 게시가 활성화되지 않는다.
4. **Publish card**를 선택해 프로필을 public으로 전환한다.
5. 상단 **Share**에서 Share Studio를 열고 stable 이미지 URL 또는 README Markdown을 복사하거나 **저장**으로 PNG를 내려받는다.
6. X, LinkedIn 또는 Reddit을 선택하면 Share Studio가 PNG 이미지 복사와 browser 작성 창 열기를 안내한다. 복사한 이미지는 열린 게시물 작성 창에 직접 붙여넣는다.
7. Markdown을 GitHub profile 또는 repository README에 삽입한다.

```md
![Codex usage profile](https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/u/octocat/card.png)
```

Private으로 되돌리면 공개 카드 endpoint는 즉시 `404`를 반환한다. 이미 README에 삽입된 이미지는 다음 재요청부터 표시되지 않는다.

소셜 공유 action은 provider API나 OAuth를 호출해 이미지를 자동 업로드 또는 게시하지 않는다. 브라우저 Clipboard API와 각 서비스의 작성 화면만 사용하며 private preview URL이나 credential을 외부 provider query에 전달하지 않는다.

## CLI 연결

현재 공개된 CLI package의 사용자 명령은 다음과 같다.

```bash
npx codex-usage-profile@latest submit
```

CLI는 production Sites origin을 기본값으로 사용한다. 첫 GitHub browser 승인 후 service origin과 submit credential이 로컬에 저장되며, 이후에는 같은 stable device id로 명령을 실행할 수 있다.

```bash
npx codex-usage-profile@latest status
npx codex-usage-profile@latest submit
```

source checkout에서는 다음 bin을 사용한다.

```bash
node packages/codex-usage-profile-cli/bin/codex-usage-profile.js submit \
  --server http://127.0.0.1:5177
```

상세한 로그인, credential 위치, 환경변수와 문제 해결은 [CLI 로그인과 사용량 제출](cli-submit.md)을 참고한다.

## Submit API 계약

CLI는 설치된 `codex-usage-analyzer` package의 Account Usage Contract v1 document를 wrapper 없이 그대로 전송한다.

```http
POST /api/account-usage/submit
Authorization: Bearer <service-submit-token>
Content-Type: application/json
x-codex-usage-profile-device-id: <stable-device-id>
x-codex-usage-profile-device-name: <display-name>
```

body에는 `contractVersion`, `capturedAt`, `summary`, `dailyUsageBuckets`만 존재한다. GitHub identity, visibility, device, URL, credential은 body에 포함되지 않는다.

- 새로운 revision은 `201 accepted`를 반환한다.
- 같은 timestamp와 같은 document의 재시도는 중복 저장 없이 `200 unchanged`를 반환한다.
- 오래된 timestamp 또는 같은 timestamp의 다른 내용은 `409`로 거부한다.
- 성공 응답은 Profile URL, card URL과 README Markdown을 반환하지만 CLI는 opaque revision을 사용자 출력에서 제거한다.
- valid submit은 token에 연결된 owner의 latest usage와 device submit 시각을 갱신한다. visibility는 기존 웹 profile 설정을 유지한다.
- public owner의 accepted submit과 exact retry는 usage 저장 transaction 뒤 현재 owner/latest usage를 다시 확인하고 stable card를 갱신한다.
- usage는 저장됐지만 public media 갱신이 실패하면 `503 media_unavailable`과 `Retry-After`를 반환한다. CLI가 안내하는 대로 같은 submit을 다시 실행하면 저장된 usage와 credential을 바꾸지 않고 publication을 안전하게 재시도한다.

## 공개 프로필 경계

공개 HTML과 JSON은 owner/latest Account Usage visibility와 handle 일치 조건을 사용한다. 공개 PNG는 publish 시 생성된 stable media object만 읽고 structured store나 on-demand renderer를 조회하지 않는다.

| Surface | URL | 역할 |
|---|---|---|
| 공개 프로필 | `/?profile={handle}` | Sites에서 공개 카드와 사용량 요약을 표시하는 canonical HTML URL이다. |
| 공개 JSON | `/api/profiles/public/{handle}` | 화면에 필요한 GitHub identity와 Account Usage allowlist만 반환한다. |
| 공개 PNG | `/u/{handle}/card.png` | README에 삽입하는 안정적인 이미지 endpoint다. |

profile이 private이거나, owner 또는 usage가 없거나, 요청 handle이 현재 owner handle과 일치하지 않으면 공개 JSON은 `404`를 반환한다. Publish가 완료되지 않았거나 private 전환으로 stable object가 제거됐거나 locale metadata/revision이 불완전하면 공개 PNG도 owner 존재 여부를 노출하지 않는 동일한 `404`를 반환한다. R2 provider·timeout·bucket 장애는 내부 storage 정보를 포함하지 않는 `503 media_unavailable`과 `Retry-After: 5`를 반환하므로 일시 장애를 미published 결과로 캐시하지 않는다. 공개 HTML은 로그인 여부를 노출하지 않는 unavailable 상태를 표시한다.

현재 공개 프로필과 카드는 Account Usage Contract v1이 제공하는 누적/최대 토큰, 최장 작업, 연속 기록과 일별 버킷만 지원한다. favorite model, token breakdown, skill/plugin ranking은 이 계약에 없으므로 현재 제품 화면에 표시하지 않는다.

## URL과 언어

기본 영문 카드는 query가 없는 고정 URL을 사용한다.

```text
https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/u/{handle}/card.png
```

한국어 카드는 `locale=ko`를 추가한다.

```text
https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/u/{handle}/card.png?locale=ko
```

현재 지원 언어는 `en`, `ko`다. 지원하지 않는 locale은 영문으로 렌더링된다. README에 삽입한 URL은 계정 visibility 또는 언어를 바꿀 때만 수정하면 된다.

최초 **Publish card**는 영문/한국어 immutable revision을 모두 생성한 뒤 하나의 stable publication metadata로 연결한다. 영문은 stable object body, 한국어는 metadata가 가리키는 immutable body를 제공한다. 두 locale 준비가 모두 끝나기 전에는 public visibility를 노출하지 않는다.

## 자동 갱신 방식

공개 카드 응답은 다음 cache contract를 사용한다.

```text
Content-Type: image/png
Cache-Control: public, no-cache, must-revalidate
ETag: "..."
```

- CLI submit이 변경된 최신 사용량을 저장하면 public owner의 카드 콘텐츠 hash와 ETag가 바뀐다. exact retry도 누락된 publication을 복구하지만 콘텐츠가 같으면 같은 ETag를 유지한다.
- 브라우저나 이미지 프록시는 기존 URL을 다시 요청할 때 `If-None-Match`로 검증한다.
- 콘텐츠가 같으면 `304 Not Modified`, 달라지면 새 PNG와 ETag를 받는다.
- URL에 timestamp나 무작위 query를 붙일 필요가 없다.

서버의 `no-cache`는 저장 금지가 아니라 사용 전 재검증을 의미한다. 따라서 동일 URL을 유지하면서 최신 이미지를 제공할 수 있다.

## GitHub Camo

GitHub는 README의 외부 이미지를 Camo proxy로 제공하므로 원본 endpoint가 갱신된 뒤에도 README 반영이 지연될 수 있다.

1. 먼저 원본 카드 URL을 브라우저에서 열어 최신 이미지와 `Cache-Control`을 확인한다.
2. README를 다시 불러오고 잠시 기다린다.
3. 지연이 계속될 때만 GitHub가 변환한 `https://camo.githubusercontent.com/...` URL에 다음 명령을 사용한다.

```bash
curl -X PURGE 'https://camo.githubusercontent.com/...'
```

Camo purge는 모든 GitHub 사용자의 재요청을 유발하므로 드물게 사용해야 한다. 자세한 절차는 [GitHub의 익명화된 URL 문서](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-anonymized-urls)를 따른다.

## 데이터 책임과 인증

| 데이터 | 진실 원천 | 웹 서비스에 전달되는 값 |
|---|---|---|
| 이름, GitHub 사용자명, 아바타 | GitHub OAuth | 카드 identity |
| 누적/최대 토큰, 최장 작업, 연속 기록, 일별 버킷 | Codex App Server `account/usage/read` | Account Usage Contract v1 카드 usage |
| 공개 여부 | 웹 서비스 owner profile | 공개 endpoint 접근 제어 |

Codex App Server의 [`account/usage/read`](https://developers.openai.com/codex/app-server#7-token-usage-chatgpt)는 ChatGPT 기반 Codex 인증에서 토큰 활동 요약과 일별 버킷을 제공한다. API key-only와 Bedrock 인증은 이 method를 지원하지 않는다. CLI는 이 결과만 제출하며 GitHub 이름, 아바타, OAuth credential을 usage payload에 포함하지 않는다.

웹 서비스는 Codex/OpenAI 비밀번호, 로컬 인증 파일 또는 원본 ChatGPT credential을 요구하지 않는다. GitHub OAuth access token은 로그인한 사용자를 확인하는 데만 사용하고 profile store에 기록하지 않는다.

## 상표 고지

이 프로젝트는 비공식 커뮤니티 프로젝트이며 OpenAI의 제휴, 보증 또는 승인을 받은 제품이 아니다. 카드에서는 제품을 설명하기 위한 `Codex` 텍스트만 사용하고 OpenAI 또는 Codex 로고를 재구성한 그래픽을 포함하지 않는다.
