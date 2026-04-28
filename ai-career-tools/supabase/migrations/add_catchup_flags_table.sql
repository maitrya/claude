-- Migration: add_catchup_flags_table
-- Already applied to Supabase project dsnkabdmposyukcedduy

CREATE TABLE IF NOT EXISTS catchup_flags (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  thread_id        TEXT NOT NULL,
  week_key         DATE NOT NULL,
  contact_name     TEXT,
  approximate_date DATE,
  excerpt          TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, thread_id)
);

ALTER TABLE catchup_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own catchup flags"   ON catchup_flags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own catchup flags" ON catchup_flags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own catchup flags" ON catchup_flags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own catchup flags" ON catchup_flags FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_catchup_flags_user_week   ON catchup_flags (user_id, week_key);
CREATE INDEX IF NOT EXISTS idx_catchup_flags_user_status ON catchup_flags (user_id, status);
