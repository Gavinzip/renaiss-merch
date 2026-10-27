-- Emergency postponement: preserve all receipts and block the 15 additional
-- Pro slots even while older Vercel functions are still running.
SET LOCAL lock_timeout = '5s';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE
    conrelid = 'public.surf_store_claims'::regclass
    AND conname = 'surf_store_claims_pro_oct28_release_check') THEN
    ALTER TABLE public.surf_store_claims
      ADD CONSTRAINT surf_store_claims_pro_oct28_release_check CHECK (
        reward_id <> 'pro-month' OR allocation_number <= 20
        OR submitted_at >= TIMESTAMPTZ '2026-10-28 19:00:00+08'
      );
  END IF;
END $$;
