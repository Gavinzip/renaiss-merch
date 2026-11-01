-- Reduce the additional Pro allocation from 15 to 13, preserving every receipt.
-- Serialize with submissions and enforce the new cap in older running functions.
DO $$
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);
  PERFORM pg_advisory_xact_lock(hashtextextended('surf-store:public:pro-month', 0));
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE
    conrelid = 'public.surf_store_claims'::regclass
    AND conname = 'surf_store_claims_pro_nov01_allocation_check') THEN
    ALTER TABLE public.surf_store_claims
      ADD CONSTRAINT surf_store_claims_pro_nov01_allocation_check CHECK (
        reward_id <> 'pro-month' OR allocation_number <= 33
      );
  END IF;
END $$;
