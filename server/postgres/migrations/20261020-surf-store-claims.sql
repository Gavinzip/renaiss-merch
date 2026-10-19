CREATE TABLE IF NOT EXISTS public.surf_store_claims (
  id text PRIMARY KEY,
  reward_id text NOT NULL CHECK (reward_id IN ('mystery-box', 'pro-month')),
  user_sub text NOT NULL,
  wallet_address text NOT NULL CHECK (wallet_address ~ '^0x[a-f0-9]{40}$'),
  gmail text NOT NULL CHECK (gmail = lower(gmail) AND length(gmail) <= 254 AND gmail ~ '^[a-z0-9][a-z0-9.+_-]*@gmail[.]com$'),
  allocation_number integer NOT NULL CHECK (allocation_number >= 1 AND allocation_number <= CASE reward_id WHEN 'mystery-box' THEN 3 ELSE 20 END),
  eligibility_json jsonb NOT NULL,
  submitted_at timestamptz NOT NULL,
  UNIQUE (reward_id, user_sub),
  UNIQUE (reward_id, wallet_address),
  UNIQUE (reward_id, allocation_number)
);
