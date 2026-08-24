# GitHub README 카드

Codex Usage Profile은 GitHub 계정 정보와 Codex 사용량을 서버에서 병합해 1497x918 PNG 카드를 제공한다. 사용자는 query 없는 공개 이미지 URL을 포함한 HTML 임베드를 한 번만 GitHub README에 넣으면 된다. 이후 사용량 제출이나 카드 테마·언어 설정 저장이 성공하면 같은 이미지 URL이 저장된 대표 카드로 갱신된다. 기본 표시 폭은 `50%`이고 README Markdown의 클릭 대상도 고정 `/api/share/{handle}`를 유지하므로 새 submit이나 설정 저장 뒤 Markdown을 교체할 필요가 없다.

> [!IMPORTANT]
> Task #84 Gate C는 saved version 24를 public으로 전환했고, Task #101은 공개 validation version 33에서 fixed README와 revision share 계약을 검증했다. Task #108은 `codex-usage-profile.meleeisdeveloping.chatgpt.site`를 canonical production으로 공개하고 CLI `0.1.3`을 배포했다. README Markdown은 항상 fixed `/api/share/{handle}` href와 query 없는 `/u/{handle}/card.png` src를 유지한다. **공유 링크 복사**와 X·LinkedIn·Threads·Facebook·Reddit만 `/api/share/{handle}/r/{revision}`을 사용한다.

## #84 공개 전환 뒤 사용자 흐름

1. 웹사이트에서 **Sign in with GitHub**을 선택한다.
2. 로그인 후 `/?view=profile`에서 GitHub 이름, 사용자명, 아바타가 반영된 private preview를 확인한다.
3. CLI `submit`으로 Codex 사용량을 전송한다. credential이 없으면 browser 승인을 먼저 진행하고 같은 명령에서 제출을 계속한다. 사용량이 아직 없으면 카드 게시가 활성화되지 않는다.
4. **Publish card**를 선택해 프로필을 public으로 전환한다.
5. **Share**에서 stable image URL 또는 README Markdown을 복사해 GitHub profile이나 repository README에 삽입한다.

```html
<a href="https://codex-usage-profile.meleeisdeveloping.chatgpt.site/api/share/octocat"><img width="50%" src="https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/octocat/card.png" alt="Codex usage profile" /></a>
```

표시 크기를 바꾸려면 복사한 코드에서 `width="50%"`만 `40%`, `300px`처럼 조절한다. 이미지 `src`와 클릭 대상 `href`는 그대로 둔다.

Private으로 되돌리면 공개 카드 endpoint가 즉시 `404`를 반환한다. 이미 README에 삽입된 이미지는 다음 재요청부터 표시되지 않는다.

### 검증된 공개 validation의 공유 흐름

아래 흐름은 Task #84 Gate C와 Task #101 saved version 33 공개 validation에서
검증됐다.

1. `/?view=profile`의 **Card appearance**에서 공개 카드 기본 테마와 언어를 선택해 저장한다.
2. 상단 **Share**에서 Share Studio를 연다. 보조 영역은 용도 순서로 **공유 링크**, **README Markdown**, **이미지 URL**을 제공한다. 유효한 profile timestamp가 있으면 **공유 링크**만 최신 `/api/share/{handle}/r/{revision}`을 사용한다. README Markdown은 fixed `/api/share/{handle}` 클릭 대상과 query 없는 `/u/{handle}/card.png` 이미지 URL을 항상 유지한다. 화면 미리보기와 primary action의 **저장**, **이미지 복사**는 현재 저장된 테마·언어의 명시적 변형을 사용한다.
3. SNS에는 Share Studio가 복사한 `https://{origin}/api/share/{handle}/r/{revision}` 공유 링크를 붙여넣는다. X, Threads, LinkedIn, Facebook, Reddit은 모두 같은 revision URL을 받는다. timestamp가 없거나 유효하지 않은 legacy profile만 기존 `/api/share/{handle}`로 안전하게 폴백한다.
4. 데스크톱 Share Studio는 X, Threads, LinkedIn, Facebook, Reddit과 저장을 primary action으로 제공한다. 모바일 실행 환경에서는 X, Threads, Reddit과 저장 네 action을 한 줄로 제공하며, viewport가 좁은 데스크톱은 여섯 action을 유지한다.
5. SNS 버튼은 해당 서비스의 작성 화면을 공유 링크와 함께 연다. X와 Threads에는 현지화된 문구와 링크를 전달하지만 provider API나 OAuth로 자동 게시하지 않으며, 서비스가 미리 입력된 내용을 반영하는지는 보장하지 않는다. Facebook과 LinkedIn은 모바일 앱에서 작성 화면과 내용 자동 입력을 안정적으로 열 수 없어 모바일 primary action에서 제외한다. 필요하면 **공유 링크**를 복사해 원하는 앱에 직접 붙여넣는다.
6. README에는 **README Markdown**을 사용한다. 표시 크기는 복사 결과의 `width`만 바꾸고, 이미지를 직접 첨부할 때만 Share Studio의 **이미지 복사** 안내를 따른다.

#84 공개 전환 뒤 private으로 전환하면 README card와 social image는 같은 존재
비노출 `404`를 반환한다. fixed와 revision share HTML은 모두 비공개와 미존재를
구분하지 않는 기본 메타데이터와 unavailable 화면으로 닫힌다.

## 검증된 공유 링크와 링크 미리보기

#84 Gate C 뒤 `https://{origin}/api/share/{handle}`은
README Markdown의 고정 클릭 대상이자 기존 공개 프로필 화면으로 계속 동작한다.
Share Studio의 **공유 링크**와 다섯 SNS 버튼이 사용하는
`https://{origin}/api/share/{handle}/r/{revision}`은 같은 화면을 표시하면서 SNS가
새 문서 cache identity로 인식할 수 있게 한다.
Sites가 `/api/` prefix를 Worker에 전달하고 서버가 이 문서의 `<head>`에 handle별
Open Graph와 Twitter Card 메타데이터를 주입한다. fixed 계약은 Task #83의 제한
public smoke, revision 계약은 Task #101의 공개 validation에서 검증됐다. root query는 정적 asset으로 처리되고 extension 없는
`/u/{handle}`은 public front door에서 `/`로 redirect되므로 공유 링크로 배포하지
않는다.

revision은 owner `updatedAt`과 usage `uploadedAt` 중 최신 시각의 epoch milliseconds다.
따라서 Share Studio가 복사하거나 SNS 작성 창에 전달하는 revision URL 문자열에는 최신 공개
profile·usage 갱신 시각이 millisecond 정밀도로 보인다. 이는 crawler cache identity를 분리하기
위해 수용한 공개 계약이며 credential·owner id나 과거 카드 snapshot을 뜻하지 않는다.
현재 revision과 일치하는 요청은 요청 URL을 `canonical`·`og:url`로 사용하고 이미지
URL에도 같은 token을 넣는다. 과거 revision 요청은 snapshot이 아니며 `200` 현재
문서를 반환하면서 최신 revision canonical·이미지로 수렴한다. 별도 카드 history나
최근 revision 보존 DB는 만들지 않는다. 형식이 잘못된 revision은 공개 문서 route로
취급하지 않는다.

| 항목 | 값 |
|---|---|
| `og:title` | `{handle}'s Codex card` |
| `og:description` | 서비스 안내 문구 (`?locale`에 따라 한국어/영어) |
| `og:image` | 정합한 social object: `https://{origin}/u/{handle}/social.png?v={revision}`; legacy/missing: `https://{origin}/assets/codex-social-sample.png` |
| 이미지 크기 | 2400x1260 (1.91:1 미리보기 규격의 2배 해상도) |
| `twitter:card` | `summary_large_image` |

소셜 이미지는 handle당 하나만 유지하며 소유자가 저장한 카드 테마와 언어를 그대로 반영한다. D1 공개 projection 뒤 README authority와 social object의 owner/publication id가 일치할 때만 개인화 URL을 선언한다. 기존 publication에 social object가 없거나 metadata가 불일치하거나 media read가 실패하면 실제 계정을 변경하거나 R2에 즉석 쓰기하지 않고 저장소에 포함된 2400x1260 sample을 선언한다. 카드 설정을 저장하거나 사용량을 다시 제출하면 social object가 갱신되고 Share Studio의 다음 공유 URL revision도 바뀐다. `?locale`은 링크 미리보기의 문구에만 영향을 주고 이미지는 바꾸지 않는다.

README용 `/u/{handle}/card.png`는 legacy version 7부터 사용하는 1497x918
원본이며 public validation에서도 URL이나 응답 계약이 달라지지 않는다. query 없는
요청은 publication에 저장된 대표 테마·언어를 따르므로 설정을 바꿔도 README
Markdown을 교체할 필요가 없다.

비공개 handle과 존재하지 않는 handle은 구분 없이 사이트 기본 메타데이터와 packaged sample로 폴백한다. legacy public profile은 handle별 title/canonical을 유지하되 sample image를 사용한다. fallback은 실제 사용자 handle의 media object에 의존하지 않으므로 응답으로 private/missing handle 존재 여부를 알 수 없다.

플랫폼은 미리보기를 자체 서버에 캐시하므로 기존 fixed URL이나 이미 게시된 revision의 미리보기는 한동안 남을 수 있다. 새 revision URL은 X·LinkedIn을 포함한 새 작성 화면의 cache identity를 분리하지만 최초 이미지 처리 시간을 즉시 완료하도록 보장하지 않는다. 카카오는 [OG 캐시 관리 도구](https://developers.kakao.com/tool)로 초기화할 수 있다.

소셜 공유 action은 provider API나 OAuth를 호출해 이미지를 자동 업로드 또는 게시하지 않는다. 브라우저 Clipboard API와 각 서비스의 작성 화면만 사용하며, 작성 창에는 공개 공유 링크만 전달한다. private preview URL이나 credential은 외부 provider query에 넣지 않는다.

## CLI 연결

현재 공개된 CLI package의 사용자 명령은 다음과 같다.

```bash
npx codex-usage-profile@latest submit
```

현재 public `@latest=0.1.3` CLI는 canonical production origin을 기본값으로 사용한다. 첫 GitHub browser 승인 후 service origin과 submit credential이 로컬에 저장되며, 이후에는 같은 stable device id로 명령을 실행할 수 있다. stage5와 local 같은 대체 환경은 `--server {origin}`을 명시한다.

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

공개 HTML과 JSON은 owner/latest Account Usage visibility와 handle 일치 조건을 사용한다. 공개 PNG는 publish 시 생성된 stable media object만 읽고 structured store나 on-demand renderer를 조회하지 않는다. 아래 표의 legacy public baseline과 현재 public validation surface를 혼용하지 않는다.

| Surface | URL | 상태 | 역할 |
|---|---|---|---|
| legacy 공개 화면 | `/?profile={handle}` | version 7 public baseline | 공개 카드와 사용량 요약을 표시하지만 initial HTML은 정적이므로 SNS 공유 URL로 승격하지 않는다. |
| fixed 공유 | `/api/share/{handle}` | README·하위 호환 | README Markdown의 고정 클릭 대상과 기존 링크를 유지하며 self canonical 현재 문서를 제공한다. |
| revision 공유 | `/api/share/{handle}/r/{revision}` | 공유 링크·SNS 대상 | **공유 링크 복사**와 다섯 SNS 버튼에만 사용한다. 최신 revision은 self canonical, stale revision은 `200` 현재 metadata로 수렴한다. |
| 공개 JSON | `/api/profiles/public/{handle}` | public validation 검증 | 화면에 필요한 GitHub identity와 Account Usage allowlist만 반환한다. |
| README PNG | `/u/{handle}/card.png` | public validation 검증 | README에 삽입하는 1497x918 stable image endpoint다. |
| social PNG | `/u/{handle}/social.png` | public validation 검증 | 정합한 publication의 2400x1260 링크 미리보기 이미지다. object가 없는 legacy publication 자체는 계속 404이고 HTML metadata만 packaged sample로 닫힌다. |

profile이 private이거나, owner 또는 usage가 없거나, 요청 handle이 현재 owner handle과 일치하지 않으면 공개 JSON은 `404`를 반환한다. Publish가 완료되지 않았거나 private 전환으로 stable object가 제거됐거나 locale metadata/revision이 불완전하면 공개 PNG도 owner 존재 여부를 노출하지 않는 동일한 `404`를 반환한다. R2 provider·timeout·bucket 장애는 내부 storage 정보를 포함하지 않는 `503 media_unavailable`과 `Retry-After: 5`를 반환하므로 일시 장애를 미published 결과로 캐시하지 않는다. 공개 HTML은 로그인 여부를 노출하지 않는 unavailable 상태를 표시한다.

공개 JSON은 공개 share 문서와 같은 입력에서 계산한 epoch millisecond `shareRevision`을 제공한다.
raw owner `updatedAt`, owner id와 storage revision·digest·path는 계속 반환하지 않는다. 향후 공개
profile 화면에서 Share Studio를 열더라도 이 계산값을 사용하면 카드 설정만 바뀐 경우에도 서버
canonical과 같은 revision URL을 만들 수 있다.

현재 공개 프로필과 카드는 Account Usage Contract v1이 제공하는 누적/최대 토큰, 최장 작업, 연속 기록과 일별 버킷만 지원한다. favorite model, token breakdown, skill/plugin ranking은 이 계약에 없으므로 현재 제품 화면에 표시하지 않는다.

## URL, 테마와 언어

README 복사는 fixed 공유 페이지와 stable 이미지 URL을 한 HTML 임베드로 조합한다.

```html
<a href="https://codex-usage-profile.meleeisdeveloping.chatgpt.site/api/share/{handle}"><img width="50%" src="https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/{handle}/card.png" alt="Codex usage profile" /></a>
```

`href`와 `src`는 모두 query 없는 고정 URL이다. submit이나 카드 설정 저장으로 공유 revision이 바뀌어도 README Markdown 결과는 완전히 동일하다.

```text
https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/{handle}/card.png
```

publication authority는 `canonicalTheme`과 `canonicalLocale`을 함께 저장한다.
query 없는 요청은 이 대표 pair가 가리키는 기존 immutable revision을 읽는다.
Profile 설정을 저장하면 pair와 같은 publication id의 social object가 갱신되므로
URL은 그대로이고 응답 이미지와 ETag만 새 설정을 반영한다.

특정 변형을 직접 조회해야 하는 consumer를 위해 explicit selector는 하위
호환으로 유지한다. `theme` 또는 `locale` 중 하나라도 있으면 explicit mode이며
누락한 축은 기존 기본값 dark/en을 사용한다.

```text
https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/{handle}/card.png?theme=dark
https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/{handle}/card.png?theme=light
https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/{handle}/card.png?locale=ko
https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/{handle}/card.png?theme=dark&locale=ko
https://codex-usage-profile.meleeisdeveloping.chatgpt.site/u/{handle}/card.png?theme=light&locale=ko
```

production이 지원하는 테마는 `dark`, `light`, 언어는 `en`, `ko`다. `v` 같은 다른
query만 있는 요청은 selector가 아니므로 canonical 대표 이미지를 유지한다.
Share Studio는 explicit URL을 미리보기·저장·PNG 복사에만 사용하고 README
Markdown과 이미지 URL에는 승격하지 않는다.

#84 공개 전환 뒤 최초 **Publish card**는 dark/light × en/ko 네 immutable revision을 모두 생성한다.
dark stable object가 publication authority이며 light stable object와 네 revision을
같은 publication id로 연결한다. 네 변형 준비와 authority commit이 끝나기 전에는
public visibility를 노출하지 않는다. canonical pair가 모두 없는 기존 v4와 contract
v3 publication은 dark/en으로 읽는다. pair가 하나만 없거나 값이 유효하지 않으면
추측해서 복구하지 않고 `404`로 fail-close한다.

공개 상태의 설정 저장은 네 immutable revision과 social render 결과를 먼저
준비하고 owner 설정 CAS 전에는 stable/social authority를 바꾸지 않는다. owner
CAS 성공 뒤 committed owner `updatedAt`, latest usage `uploadedAt`과 준비 snapshot이
같을 때만 storage ETag 조건부로 stable과 social authority를 같은 publication id에
commit한다. 더 최신 설정·사용량이 앞섰으면 이전 요청은 `superseded`로 끝난다.
DB 설정은 저장됐지만 media commit이 실패하면 같은 설정을 다시 저장해 authority를
복구할 수 있다. prepare storage 오류와 post-commit `superseded`는 내부 provider
메시지를 숨긴 `503 media_unavailable`, `Retry-After: 5`로 응답한다. authority가 이미
새 publication으로 교체된 뒤 supersede되면 같은 publication id의 social object를
먼저 수렴시키고 재시도를 요청한다.

## 자동 갱신 방식

공개 카드 응답은 다음 cache contract를 사용한다.

```text
Content-Type: image/png
Cache-Control: public, no-cache, must-revalidate
ETag: "..."
```

- CLI submit이 변경된 최신 사용량을 저장하면 public owner의 카드 콘텐츠 hash와 ETag가 바뀐다. exact retry도 누락된 publication을 복구하지만 콘텐츠가 같으면 같은 ETag를 유지한다.
- 공개 설정 저장 뒤 media commit이 실패해도 같은 theme·locale PATCH를 다시 보내면 저장된 owner/latest usage 기준으로 canonical card와 social object를 수렴시킨다.
- 브라우저나 이미지 프록시는 기존 URL을 다시 요청할 때 `If-None-Match`로 검증한다.
- 콘텐츠가 같으면 `304 Not Modified`, 달라지면 새 PNG와 ETag를 받는다.
- README 이미지 URL에는 timestamp나 무작위 query를 붙일 필요가 없다. SNS 공유 문서는 query 대신 Share Studio가 계산한 revision path를 사용한다.

서버의 `no-cache`는 저장 금지가 아니라 사용 전 재검증을 의미한다. 따라서 동일 URL을 유지하면서 최신 이미지를 제공할 수 있다.

public card GET/HEAD는 R2 stable authority와 immutable revision만 읽는다. queryless
대표 이미지를 결정하기 위해 D1, owner/usage record 또는 on-demand renderer를
조회하지 않는다.

## GitHub Camo

GitHub는 README의 외부 이미지 `src`를 Camo proxy URL로 바꾸므로 원본 endpoint가 갱신된 뒤에도 README 반영이 지연될 수 있다. 바깥 fixed `<a href>`와 이미지의 `width`는 유지되므로 카드를 클릭하면 Camo 원본 화면이 아니라 서비스 공유 페이지로 이동한다.

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
