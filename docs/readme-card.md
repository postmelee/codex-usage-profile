# GitHub README 카드

Codex Usage Profile은 GitHub 계정 정보와 Codex 사용량을 서버에서 병합해 1497x918 PNG 카드를 제공한다. 사용자는 한 번 복사한 공개 이미지 URL을 GitHub README에 유지할 수 있고, 이후 사용량 제출이 성공하면 같은 URL이 최신 카드로 다시 렌더링된다.

> [!IMPORTANT]
> 검증된 public baseline은 saved version 7의 private preview, publish/unpublish, stable README card와 `/?profile={handle}` 공개 화면이다. 현재 Site는 Gate B blocker 복원 뒤 saved version 16, custom owner-only 상태다. 다음 후보의 canonical `/api/share/{handle}`, social preview, 카드 theme 선택과 Share Studio는 아직 production smoke를 통과하지 않았다. root query는 정적 `index.html`, extension 없는 `/u/{handle}`은 `/` redirect로 확인됐으므로 공유 링크로 사용하지 않는다. 이 절의 다음 배포 기능은 후보가 owner-only 재검증과 별도 public Gate를 통과할 때까지 production CTA로 사용하지 않는다.

## 현재 production 사용자 흐름

1. 웹사이트에서 **Sign in with GitHub**을 선택한다.
2. 로그인 후 `/profile`에서 GitHub 이름, 사용자명, 아바타가 반영된 private preview를 확인한다.
3. CLI `submit`으로 Codex 사용량을 전송한다. credential이 없으면 browser 승인을 먼저 진행하고 같은 명령에서 제출을 계속한다. 사용량이 아직 없으면 카드 게시가 활성화되지 않는다.
4. **Publish card**를 선택해 프로필을 public으로 전환한다.
5. **Share**에서 stable image URL 또는 README Markdown을 복사해 GitHub profile이나 repository README에 삽입한다.

```md
![Codex usage profile](https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/u/octocat/card.png)
```

Private으로 되돌리면 공개 카드 endpoint가 즉시 `404`를 반환한다. 이미 README에 삽입된 이미지는 다음 재요청부터 표시되지 않는다.

### 다음 배포 후보의 공유 흐름

아래 흐름은 Task #74·#78 누적 후보가 owner-only 및 public smoke를 통과한 뒤 활성화한다.

1. `/profile`의 **Card appearance**에서 공개 카드 기본 테마와 언어를 선택해 저장한다.
2. 상단 **Share**에서 Share Studio를 연다. 보조 영역은 용도 순서로 **공유 링크**, **README Markdown**, **이미지 URL**을 제공하며 **저장**으로 PNG를 내려받을 수 있다.
3. SNS에는 `https://{origin}/api/share/{handle}` 공유 링크를 붙여넣는다. X, Threads, 카카오톡 등은 이 문서의 링크 미리보기에 카드 이미지와 설명을 표시한다.
4. X, LinkedIn 또는 Reddit 버튼은 해당 서비스의 작성 창을 공유 링크와 함께 연다. provider API나 OAuth로 자동 게시하지 않는다.
5. README에는 **README Markdown**을 사용하고, 이미지를 직접 첨부할 때만 Share Studio의 **이미지 복사** 안내를 따른다.

후보 배포 뒤 private으로 전환하면 README card와 social image는 같은 존재 비노출 `404`를 반환한다. `/api/share/{handle}` HTML은 비공개와 미존재를 구분하지 않는 기본 메타데이터와 unavailable 화면으로 닫힌다.

## 다음 배포 후보의 공유 링크와 링크 미리보기

후보 배포와 production smoke가 완료되면 `https://{origin}/api/share/{handle}`은 카드 소유자의 canonical 공개 프로필 화면이자 SNS 링크 미리보기 대상이 된다. Sites가 `/api/` prefix를 Worker에 전달하고 서버가 이 문서의 `<head>`에 handle별 Open Graph와 Twitter Card 메타데이터를 주입한다. root query는 정적 asset으로 처리되고 extension 없는 `/u/{handle}`은 public front door에서 `/`로 redirect되므로 공유 링크로 배포하지 않는다.

| 항목 | 값 |
|---|---|
| `og:title` | `{handle}'s Codex card` |
| `og:description` | 서비스 안내 문구 (`?locale`에 따라 한국어/영어) |
| `og:image` | 정합한 social object: `https://{origin}/u/{handle}/social.png?v={revision}`; legacy/missing: `https://{origin}/assets/codex-social-sample.png` |
| 이미지 크기 | 2400x1260 (1.91:1 미리보기 규격의 2배 해상도) |
| `twitter:card` | `summary_large_image` |

소셜 이미지는 handle당 하나만 유지하며 소유자가 저장한 카드 테마와 언어를 그대로 반영한다. D1 공개 projection 뒤 README authority와 social object의 owner/publication id가 일치할 때만 개인화 URL을 선언한다. 기존 publication에 social object가 없거나 metadata가 불일치하거나 media read가 실패하면 실제 계정을 변경하거나 R2에 즉석 쓰기하지 않고 저장소에 포함된 2400x1260 sample을 선언한다. 카드 설정을 저장하거나 사용량을 다시 제출하면 같은 개인화 URL의 이미지가 갱신된다. `?locale`은 링크 미리보기의 문구에만 영향을 주고 이미지는 바꾸지 않는다.

README용 `/u/{handle}/card.png`는 현재 production에서도 사용하는 1497x918 원본이며 후보 배포로 URL이나 응답이 달라지지 않는다.

비공개 handle과 존재하지 않는 handle은 구분 없이 사이트 기본 메타데이터와 packaged sample로 폴백한다. legacy public profile은 handle별 title/canonical을 유지하되 sample image를 사용한다. fallback은 실제 사용자 handle의 media object에 의존하지 않으므로 응답으로 private/missing handle 존재 여부를 알 수 없다.

플랫폼은 미리보기를 자체 서버에 캐시하므로 카드를 갱신해도 기존 미리보기가 한동안 남을 수 있다. 카카오는 [OG 캐시 관리 도구](https://developers.kakao.com/tool)로 초기화할 수 있다.

소셜 공유 action은 provider API나 OAuth를 호출해 이미지를 자동 업로드 또는 게시하지 않는다. 브라우저 Clipboard API와 각 서비스의 작성 화면만 사용하며, 작성 창에는 공개 공유 링크만 전달한다. private preview URL이나 credential은 외부 provider query에 넣지 않는다.

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

공개 HTML과 JSON은 owner/latest Account Usage visibility와 handle 일치 조건을 사용한다. 공개 PNG는 publish 시 생성된 stable media object만 읽고 structured store나 on-demand renderer를 조회하지 않는다. 아래 표의 `현재`와 `다음 배포`를 혼용하지 않는다.

| Surface | URL | 상태 | 역할 |
|---|---|---|---|
| 현재 공개 화면 | `/?profile={handle}` | 현재 production | saved version 7에서 공개 카드와 사용량 요약을 표시하지만 initial HTML은 정적이므로 SNS 공유 URL로 승격하지 않는다. |
| canonical 공유 | `/api/share/{handle}` | 다음 배포 | Worker가 initial HTML에 handle별 OG/Twitter metadata를 주입하고 owner-only·public smoke 뒤 공유 링크로 승격한다. |
| 공개 JSON | `/api/profiles/public/{handle}` | 현재 production | 화면에 필요한 GitHub identity와 Account Usage allowlist만 반환한다. |
| README PNG | `/u/{handle}/card.png` | 현재 production | README에 삽입하는 1497x918 stable image endpoint다. |
| social PNG | `/u/{handle}/social.png` | 다음 배포 | 정합한 publication의 2400x1260 링크 미리보기 이미지다. object가 없는 legacy publication 자체는 계속 404이고 HTML metadata만 packaged sample로 닫힌다. |

profile이 private이거나, owner 또는 usage가 없거나, 요청 handle이 현재 owner handle과 일치하지 않으면 공개 JSON은 `404`를 반환한다. Publish가 완료되지 않았거나 private 전환으로 stable object가 제거됐거나 locale metadata/revision이 불완전하면 공개 PNG도 owner 존재 여부를 노출하지 않는 동일한 `404`를 반환한다. R2 provider·timeout·bucket 장애는 내부 storage 정보를 포함하지 않는 `503 media_unavailable`과 `Retry-After: 5`를 반환하므로 일시 장애를 미published 결과로 캐시하지 않는다. 공개 HTML은 로그인 여부를 노출하지 않는 unavailable 상태를 표시한다.

현재 공개 프로필과 카드는 Account Usage Contract v1이 제공하는 누적/최대 토큰, 최장 작업, 연속 기록과 일별 버킷만 지원한다. favorite model, token breakdown, skill/plugin ranking은 이 계약에 없으므로 현재 제품 화면에 표시하지 않는다.

## URL, 테마와 언어

현재 production에서 query 없는 URL은 기존 README와 consumer를 위한 영문 카드를 제공한다.

```text
https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/u/{handle}/card.png
```

한국어 카드는 현재 production에서 `?locale=ko`로 선택한다.

```text
https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/u/{handle}/card.png?locale=ko
```

다음 배포 후보에서는 테마를 `theme=dark|light`, 한국어를 `locale=ko`로 명시한다.
영어는 locale query를 생략하며 Profile에서 저장한 선택은 Share Studio가 아래
조합 중 하나로 복사한다.

```text
https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/u/{handle}/card.png?theme=dark
https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/u/{handle}/card.png?theme=light
https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/u/{handle}/card.png?theme=dark&locale=ko
https://codex-usage-profile-stage5.meleeisdeveloping.chatgpt.site/u/{handle}/card.png?theme=light&locale=ko
```

후보가 지원하는 테마는 `dark`, `light`, 언어는 `en`, `ko`다. Profile 설정을
저장하면 대표 URL만 바뀌며 기존 query 없는 URL의 bytes가 light로 바뀌지는 않는다.
이미 README에 삽입한 카드의 모양을 바꾸려면 후보 배포 뒤 Share Studio에서 새 대표
URL 또는 Markdown을 복사해 교체한다.

후보 배포 뒤 최초 **Publish card**는 dark/light × en/ko 네 immutable revision을 모두 생성한다.
dark stable object가 publication authority이며 light stable object와 네 revision을
같은 publication id로 연결한다. 네 변형 준비와 authority commit이 끝나기 전에는
public visibility를 노출하지 않는다. 기존 contract v3 dark publication은 query 없는
dark URL에 한해 계속 읽을 수 있다.

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
