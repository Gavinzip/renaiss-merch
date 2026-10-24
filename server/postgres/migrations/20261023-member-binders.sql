CREATE TABLE IF NOT EXISTS public.member_binders (
  user_sub text PRIMARY KEY,
  document jsonb NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
