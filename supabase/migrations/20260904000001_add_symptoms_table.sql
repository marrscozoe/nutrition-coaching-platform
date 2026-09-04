-- Add symptoms table for food intolerance tracking
CREATE TABLE IF NOT EXISTS symptoms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bloating', 'stomach_pain')),
  meal_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_symptoms_client_id ON symptoms (client_id);
CREATE INDEX IF NOT EXISTS idx_symptoms_created_at ON symptoms (created_at);
