-- D1/SQLite projection of the profile backend store contract v2.
-- ISO-8601 UTC timestamps and JSON text preserve the existing JS record shape.

CREATE TABLE owners (
  id TEXT PRIMARY KEY NOT NULL,
  auth_provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  github_login TEXT,
  display_name TEXT,
  avatar_url TEXT,
  profile_url TEXT,
  handle TEXT NOT NULL,
  visibility TEXT,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE (auth_provider, provider_user_id),
  UNIQUE (handle)
);

CREATE TABLE oauth_states (
  id TEXT PRIMARY KEY NOT NULL,
  provider TEXT,
  status TEXT NOT NULL,
  cli_login_challenge_id TEXT,
  redirect_to TEXT,
  created_at TEXT,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  owner_id TEXT,
  session_id TEXT
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  created_at TEXT,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE cli_login_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  status TEXT,
  label TEXT,
  redirect_uri TEXT,
  device_code_digest TEXT,
  user_code TEXT,
  verification_uri TEXT,
  verification_uri_complete TEXT,
  interval_seconds INTEGER,
  created_at TEXT,
  expires_at TEXT,
  approved_at TEXT,
  exchanged_at TEXT,
  owner_id TEXT,
  cli_token_id TEXT,
  UNIQUE (device_code_digest),
  UNIQUE (user_code)
);

CREATE TABLE cli_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  token_digest TEXT NOT NULL,
  label TEXT,
  scopes TEXT,
  source_challenge_id TEXT,
  created_at TEXT,
  expires_at TEXT,
  revoked_at TEXT,
  last_used_at TEXT,
  UNIQUE (token_digest)
);

CREATE INDEX cli_tokens_owner_id_idx ON cli_tokens (owner_id);

CREATE TABLE latest_snapshots (
  owner_id TEXT PRIMARY KEY NOT NULL,
  handle TEXT NOT NULL,
  visibility TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  UNIQUE (handle)
);

CREATE TABLE latest_usages (
  owner_id TEXT PRIMARY KEY NOT NULL,
  handle TEXT NOT NULL,
  visibility TEXT NOT NULL,
  contract_version INTEGER,
  captured_at TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  content_digest TEXT,
  usage TEXT NOT NULL,
  UNIQUE (handle)
);

CREATE TABLE submitted_devices (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  device_key TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_submitted_at TEXT NOT NULL,
  UNIQUE (owner_id, device_key)
);

-- A claim exists only for the duration of one D1 batch. The following
-- assertion row turns a zero-row conditional claim into a NOT NULL failure,
-- causing D1 to roll the entire batch back.
CREATE TABLE atomic_operation_claims (
  operation TEXT NOT NULL,
  claim_key TEXT NOT NULL,
  nonce TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('ok', 'new', 'idempotent')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (operation, claim_key)
);

CREATE TABLE atomic_operation_assertions (
  nonce TEXT PRIMARY KEY NOT NULL
);
