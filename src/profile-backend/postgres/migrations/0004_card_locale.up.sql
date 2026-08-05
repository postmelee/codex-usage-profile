-- Saved locale selects one of the already-published en/ko card variants.

ALTER TABLE owners
  ADD COLUMN card_locale text NOT NULL DEFAULT 'en'
  CHECK (card_locale IN ('en', 'ko'));
