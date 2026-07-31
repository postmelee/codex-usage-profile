-- Optional display-only CLI caller intent for device approval onboarding.

ALTER TABLE cli_login_challenges
  ADD COLUMN intent TEXT
  CHECK (intent IS NULL OR intent IN ('login', 'submit'));
