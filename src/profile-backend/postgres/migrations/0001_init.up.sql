-- Structured store schema for the profile backend (store contract v1).
--
-- Design notes:
-- * Timestamps are ISO-8601 UTC text. The application layer owns every time
--   comparison, and text keeps round-trips byte-identical with the
--   memory/file contract fixtures. ISO-8601 UTC text with a fixed format
--   also sorts chronologically, so retention queries can still compare
--   lexicographically against an ISO parameter.
-- * NOT NULL follows the contract's requireFields sets exactly; every other
--   column is nullable to accept historical file-store data as-is.
-- * Referential integrity stays application-owned (no foreign keys): the
--   contract mandates only the unique keys below, and rows are never
--   deleted by the current application.
-- * No raw secret columns exist: CLI tokens and device codes are stored as
--   digests only, and GitHub OAuth access tokens are never persisted.

CREATE TABLE owners (
  id text PRIMARY KEY,
  auth_provider text NOT NULL,
  provider_user_id text NOT NULL,
  github_login text,
  display_name text,
  avatar_url text,
  profile_url text,
  handle text NOT NULL,
  visibility text,
  created_at text,
  updated_at text,
  CONSTRAINT owners_provider_identity_key UNIQUE (auth_provider, provider_user_id),
  CONSTRAINT owners_handle_key UNIQUE (handle)
);

CREATE TABLE oauth_states (
  id text PRIMARY KEY,
  provider text,
  status text NOT NULL,
  cli_login_challenge_id text,
  redirect_to text,
  created_at text,
  expires_at text NOT NULL,
  consumed_at text,
  owner_id text,
  session_id text
);

CREATE TABLE sessions (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  created_at text,
  expires_at text NOT NULL,
  revoked_at text
);

CREATE TABLE cli_login_challenges (
  id text PRIMARY KEY,
  status text,
  label text,
  redirect_uri text,
  device_code_digest text,
  user_code text,
  verification_uri text,
  verification_uri_complete text,
  interval_seconds integer,
  created_at text,
  expires_at text,
  approved_at text,
  exchanged_at text,
  owner_id text,
  cli_token_id text,
  CONSTRAINT cli_login_challenges_device_code_digest_key UNIQUE (device_code_digest),
  CONSTRAINT cli_login_challenges_user_code_key UNIQUE (user_code)
);

CREATE TABLE cli_tokens (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  token_digest text NOT NULL,
  label text,
  scopes jsonb,
  source_challenge_id text,
  created_at text,
  expires_at text,
  revoked_at text,
  last_used_at text,
  CONSTRAINT cli_tokens_token_digest_key UNIQUE (token_digest)
);

CREATE INDEX cli_tokens_owner_id_idx ON cli_tokens (owner_id);

CREATE TABLE latest_snapshots (
  owner_id text PRIMARY KEY,
  handle text NOT NULL,
  visibility text NOT NULL,
  captured_at text NOT NULL,
  uploaded_at text NOT NULL,
  schema_version integer NOT NULL,
  snapshot jsonb NOT NULL,
  CONSTRAINT latest_snapshots_handle_key UNIQUE (handle)
);

CREATE TABLE latest_usages (
  owner_id text PRIMARY KEY,
  handle text NOT NULL,
  visibility text NOT NULL,
  contract_version integer,
  captured_at text NOT NULL,
  uploaded_at text NOT NULL,
  content_digest text,
  usage jsonb NOT NULL,
  CONSTRAINT latest_usages_handle_key UNIQUE (handle)
);

CREATE TABLE submitted_devices (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  device_key text NOT NULL,
  display_name text,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  last_submitted_at text NOT NULL,
  CONSTRAINT submitted_devices_owner_device_key UNIQUE (owner_id, device_key)
);
