-- Preserve every claim and its identity keys. Only new slots submitted at or
-- after the restock instant may exceed the original 3 / 20 allocations.
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.surf_store_claims
  DROP CONSTRAINT IF EXISTS surf_store_claims_check,
  DROP CONSTRAINT IF EXISTS surf_store_claims_allocation_number_check,
  DROP CONSTRAINT IF EXISTS surf_store_claims_allocation_check,
  ADD CONSTRAINT surf_store_claims_allocation_check CHECK (
    allocation_number >= 1 AND allocation_number <= CASE reward_id
      WHEN 'mystery-box' THEN CASE WHEN submitted_at >= TIMESTAMPTZ '2026-10-27 19:00:00+08' THEN 4 ELSE 3 END
      WHEN 'pro-month' THEN CASE WHEN submitted_at >= TIMESTAMPTZ '2026-10-27 19:00:00+08' THEN 35 ELSE 20 END
      ELSE 0
    END
  );
