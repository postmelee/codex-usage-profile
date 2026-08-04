-- Versioned owner card presentation preference.

ALTER TABLE owners
  ADD COLUMN card_style jsonb NOT NULL
  DEFAULT '{"effect":{"preset":"none","version":1},"schemaVersion":1,"theme":"dark"}'::jsonb;
