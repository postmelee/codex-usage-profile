-- Reverts 0001_init. schema_migrations is owned by the migration runner and
-- is intentionally not dropped here.

DROP TABLE IF EXISTS submitted_devices;
DROP TABLE IF EXISTS latest_usages;
DROP TABLE IF EXISTS latest_snapshots;
DROP TABLE IF EXISTS cli_tokens;
DROP TABLE IF EXISTS cli_login_challenges;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS oauth_states;
DROP TABLE IF EXISTS owners;
