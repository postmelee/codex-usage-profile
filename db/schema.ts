// Cloudflare binding declarations and the canonical ordered D1 migration list.
// Runtime code intentionally uses raw prepared statements instead of an ORM.

export interface ProfileSitesBindings {
  DB: D1Database;
  PROFILE_MEDIA?: R2Bucket;
  ASSETS: Fetcher;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  PUBLIC_BASE_URL?: string;
}

export const PROFILE_D1_BINDING = "DB";

export const PROFILE_D1_MIGRATIONS = Object.freeze([
  Object.freeze({
    version: 1,
    name: "profile_backend",
    file: "db/migrations/0001_profile_backend.sql"
  }),
  Object.freeze({
    version: 2,
    name: "account_usage_rate_limits",
    file: "db/migrations/0002_account_usage_rate_limits.sql"
  }),
  Object.freeze({
    version: 3,
    name: "cli_login_intent",
    file: "db/migrations/0003_cli_login_intent.sql"
  }),
  Object.freeze({
    version: 4,
    name: "card_style",
    file: "db/migrations/0004_card_style.sql"
  })
]);
