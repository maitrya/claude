-- ============================================================
-- Prepped Talent — Networking Dashboard Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── profiles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email       TEXT,
  full_name   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── networking_weeks ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS networking_weeks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_key         DATE NOT NULL,
  week_label       TEXT,
  requests_sent    INTEGER NOT NULL DEFAULT 0,
  acceptance_rate  INTEGER NOT NULL DEFAULT 0,
  messages_sent    INTEGER NOT NULL DEFAULT 0,
  catchups_booked  INTEGER NOT NULL DEFAULT 0,
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_key)
);

ALTER TABLE networking_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own networking weeks"
  ON networking_weeks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own networking weeks"
  ON networking_weeks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own networking weeks"
  ON networking_weeks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own networking weeks"
  ON networking_weeks FOR DELETE
  USING (auth.uid() = user_id);

-- ─── connections ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_key    DATE NOT NULL,
  name        TEXT,
  position    TEXT,
  company     TEXT,
  connected_on DATE
);

ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connections"
  ON connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connections"
  ON connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections"
  ON connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own connections"
  ON connections FOR DELETE
  USING (auth.uid() = user_id);

-- ─── messages ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_key   DATE NOT NULL,
  recipient  TEXT,
  content    TEXT,
  is_catchup BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at    DATE
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages"
  ON messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own messages"
  ON messages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages"
  ON messages FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Helpful indexes ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_networking_weeks_user_week ON networking_weeks (user_id, week_key);
CREATE INDEX IF NOT EXISTS idx_connections_user_week ON connections (user_id, week_key);
CREATE INDEX IF NOT EXISTS idx_messages_user_week ON messages (user_id, week_key);
