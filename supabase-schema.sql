-- Nutrition Coaching Platform - Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TRAINERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS trainers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  business_name TEXT,
  brand_color TEXT DEFAULT '#3B82F6',
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- CLIENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id UUID REFERENCES trainers(id) ON DELETE SET NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  gender TEXT DEFAULT 'male' CHECK (gender IN ('male', 'female')),
  program_type TEXT DEFAULT 'general_health' CHECK (program_type IN ('event_ready', 'muscle_gain', 'general_health', 'first_responder')),
  starting_weight REAL,
  current_weight REAL,
  goal_weight REAL,
  goal_type TEXT,
  goal_start_date TIMESTAMPTZ,
  event_date TIMESTAMPTZ,
  current_phase INTEGER DEFAULT 1,
  phase_start_date TIMESTAMPTZ,
  current_week INTEGER DEFAULT 1,
  good_meal_streak INTEGER DEFAULT 0,
  waiver_signed INTEGER DEFAULT 0,
  waiver_signed_at TIMESTAMPTZ,
  subscription_status TEXT DEFAULT 'active',
  subscription_end_date TIMESTAMPTZ,
  notes TEXT,
  lead_source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- MEALS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS meals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  food_description TEXT,
  photo_url TEXT,
  photo_analyzed INTEGER DEFAULT 0,
  analyzed_text TEXT,
  portion_advice TEXT,
  on_phase INTEGER DEFAULT 1,
  messed_up INTEGER DEFAULT 0,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- WEIGH INS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS weigh_ins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  weight REAL NOT NULL,
  body_fat_percent REAL,
  pant_size TEXT,
  waist_size TEXT,
  notes TEXT,
  weigh_day TEXT CHECK (weigh_day IN ('monday', 'friday')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FEEDBACK TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id UUID REFERENCES trainers(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- =============================================
-- MILESTONES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  milestone_type TEXT CHECK (milestone_type IN ('10lb', '20lb', '30lb', 'goal', 'best_week')),
  achieved_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE weigh_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

-- TRAINERS: Users can only see/edit their own trainer record
CREATE POLICY "Trainers can view their own record" ON trainers
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Trainers can update their own record" ON trainers
  FOR UPDATE USING (auth.uid() = id);

-- CLIENTS: Users can only see/edit clients belonging to their trainer
CREATE POLICY "Trainers can view their own clients" ON clients
  FOR SELECT USING (
    trainer_id IN (SELECT id FROM trainers WHERE email = (SELECT email FROM trainers WHERE id = auth.uid()))
  );

CREATE POLICY "Trainers can insert clients for themselves" ON clients
  FOR INSERT WITH CHECK (trainer_id IN (SELECT id FROM trainers WHERE email = (SELECT email FROM trainers WHERE id = auth.uid())));

CREATE POLICY "Trainers can update their own clients" ON clients
  FOR UPDATE USING (trainer_id IN (SELECT id FROM trainers WHERE email = (SELECT email FROM trainers WHERE id = auth.uid())));

-- CLIENTS: Clients can view/edit their own record
CREATE POLICY "Clients can view own record" ON clients
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Clients can update own record" ON clients
  FOR UPDATE USING (id = auth.uid());

-- MEALS: Clients can only see/edit their own meals
CREATE POLICY "Clients can view own meals" ON meals
  FOR SELECT USING (client_id = auth.uid());

CREATE POLICY "Clients can insert own meals" ON meals
  FOR INSERT WITH CHECK (client_id = auth.uid());

CREATE POLICY "Clients can update own meals" ON meals
  FOR UPDATE USING (client_id = auth.uid());

-- WEIGH INS: Clients can only see/edit their own weigh ins
CREATE POLICY "Clients can view own weigh_ins" ON weigh_ins
  FOR SELECT USING (client_id = auth.uid());

CREATE POLICY "Clients can insert own weigh_ins" ON weigh_ins
  FOR INSERT WITH CHECK (client_id = auth.uid());

CREATE POLICY "Clients can update own weigh_ins" ON weigh_ins
  FOR UPDATE USING (client_id = auth.uid());

-- FEEDBACK: Clients can submit feedback, trainers can view
CREATE POLICY "Clients can insert feedback" ON feedback
  FOR INSERT WITH CHECK (client_id = auth.uid());

CREATE POLICY "Trainers can view feedback for their clients" ON feedback
  FOR SELECT USING (
    trainer_id IN (SELECT id FROM trainers WHERE email = (SELECT email FROM trainers WHERE id = auth.uid()))
  );

CREATE POLICY "Trainers can update feedback status" ON feedback
  FOR UPDATE USING (trainer_id IN (SELECT id FROM trainers WHERE email = (SELECT email FROM trainers WHERE id = auth.uid())));

-- MILESTONES: Clients can only see their own milestones
CREATE POLICY "Clients can view own milestones" ON milestones
  FOR SELECT USING (client_id = auth.uid());

CREATE POLICY "Clients can insert own milestones" ON milestones
  FOR INSERT WITH CHECK (client_id = auth.uid());

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_clients_trainer_id ON clients(trainer_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_meals_client_id ON meals(client_id);
CREATE INDEX IF NOT EXISTS idx_meals_logged_at ON meals(logged_at);
CREATE INDEX IF NOT EXISTS idx_weigh_ins_client_id ON weigh_ins(client_id);
CREATE INDEX IF NOT EXISTS idx_weigh_ins_created_at ON weigh_ins(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_client_id ON feedback(client_id);
CREATE INDEX IF NOT EXISTS idx_feedback_trainer_id ON feedback(trainer_id);
CREATE INDEX IF NOT EXISTS idx_milestones_client_id ON milestones(client_id);

-- =============================================
-- FUNCTION: Auto-update updated_at timestamp
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply auto-update to trainers and clients
CREATE TRIGGER update_trainers_updated_at
  BEFORE UPDATE ON trainers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ANON ACCESS POLICY (for public reads/writes with API)
-- =============================================
-- For Supabase anon key access (client-side), we need to allow basic operations
-- This is a simplified policy - expand based on your auth needs

-- Allow public read on trainers (for login lookup)
CREATE POLICY "Public can view trainers by email" ON trainers
  FOR SELECT USING (true);

-- Allow public insert on clients (signup)
CREATE POLICY "Public can insert clients" ON clients
  FOR INSERT WITH CHECK (true);

-- Allow public read on clients (for login)
CREATE POLICY "Public can view clients by email" ON clients
  FOR SELECT USING (true);

-- Allow public operations on meals, weigh_ins, feedback for now
-- (RLS will restrict based on user ID once auth is properly set up)
CREATE POLICY "Public can insert meals" ON meals FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can view meals" ON meals FOR SELECT USING (true);
CREATE POLICY "Public can update meals" ON meals FOR UPDATE USING (true);

CREATE POLICY "Public can insert weigh_ins" ON weigh_ins FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can view weigh_ins" ON weigh_ins FOR SELECT USING (true);

CREATE POLICY "Public can insert feedback" ON feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can view feedback" ON feedback FOR SELECT USING (true);

CREATE POLICY "Public can insert milestones" ON milestones FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can view milestones" ON milestones FOR SELECT USING (true);
