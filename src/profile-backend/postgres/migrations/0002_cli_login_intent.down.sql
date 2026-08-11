ALTER TABLE cli_login_challenges
  DROP CONSTRAINT IF EXISTS cli_login_challenges_intent_check;

ALTER TABLE cli_login_challenges
  DROP COLUMN IF EXISTS intent;
