-- Persistent account deletion checkpoint and lease state. The row is scoped to
-- one owner and is removed with the owner after structured deletion completes.

CREATE TABLE account_deletion_operations (
  owner_id TEXT PRIMARY KEY NOT NULL,
  handle TEXT NOT NULL,
  operation_id TEXT NOT NULL UNIQUE,
  approved_content_digest TEXT NOT NULL,
  approved_object_count INTEGER NOT NULL
    CHECK (approved_object_count >= 0),
  phase TEXT NOT NULL
    CHECK (phase IN ('prepare', 'media', 'structured')),
  lease_nonce TEXT,
  lease_expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
  CHECK (
    (lease_nonce IS NULL AND lease_expires_at IS NULL) OR
    (lease_nonce IS NOT NULL AND lease_expires_at IS NOT NULL)
  )
);
