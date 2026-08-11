-- Shared fixed-window counters. Keys are token record ids, never raw tokens.

CREATE TABLE account_usage_rate_limits (
  rate_key TEXT NOT NULL,
  window_kind TEXT NOT NULL,
  window_start_ms INTEGER NOT NULL,
  window_end_ms INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  PRIMARY KEY (rate_key, window_kind, window_start_ms)
);

CREATE INDEX account_usage_rate_limits_expiry_idx
  ON account_usage_rate_limits (window_end_ms);
