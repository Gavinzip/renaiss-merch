-- Broaden only the address check; preserve all rows, allocation and identity keys.
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.surf_store_claims
  DROP CONSTRAINT IF EXISTS surf_store_claims_gmail_check,
  DROP CONSTRAINT IF EXISTS surf_store_claims_email_check,
  ADD CONSTRAINT surf_store_claims_email_check CHECK (
    gmail = lower(gmail)
    AND length(gmail) <= 254
    AND length(split_part(gmail, '@', 1)) <= 64
    AND gmail ~ '^[a-z0-9!#$%&''*+/=?^_`{|}~-]+([.][a-z0-9!#$%&''*+/=?^_`{|}~-]+)*@[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
  );
