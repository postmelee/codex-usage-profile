-- Versioned owner card presentation preference. Existing owners retain the
-- queryless dark PNG behavior through the canonical dark/none default.

ALTER TABLE owners ADD COLUMN card_style TEXT NOT NULL
  DEFAULT '{"effect":{"preset":"none","version":1},"schemaVersion":1,"theme":"dark"}'
  CHECK (json_valid(card_style));
