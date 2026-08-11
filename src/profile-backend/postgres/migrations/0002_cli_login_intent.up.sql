-- Optional display-only CLI caller intent for device approval onboarding.

ALTER TABLE cli_login_challenges
  ADD COLUMN intent text;

ALTER TABLE cli_login_challenges
  ADD CONSTRAINT cli_login_challenges_intent_check
  CHECK (intent IS NULL OR intent IN ('login', 'submit'));
