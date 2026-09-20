-- Phase 6: Database schema for opportunity finder
-- Run: supabase db push or apply manually in Supabase dashboard

-- Analyses: cada vez que el usuario analiza una URL
CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_item_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_title TEXT,
  source_price NUMERIC(12,2),
  source_currency TEXT DEFAULT 'USD',
  fingerprint_json JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Search queries usadas en cada analisis
CREATE TABLE IF NOT EXISTS search_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  results_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Candidates: candidatos encontrados
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  title TEXT,
  price NUMERIC(12,2),
  currency TEXT,
  url TEXT,
  seller_id TEXT,
  pre_score NUMERIC(5,3),
  raw_data_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Matches: resultados de AI matching
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  gemini_result_json JSONB,
  match_type TEXT,
  confidence NUMERIC(5,3),
  score NUMERIC(5,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Opportunities: oportunidades clasificadas
CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id),
  sale_price NUMERIC(12,2),
  acquisition_price NUMERIC(12,2),
  gross_difference NUMERIC(12,2),
  estimated_profit NUMERIC(12,2),
  margin_percent NUMERIC(6,2),
  roi_percent NUMERIC(6,2),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  level TEXT CHECK (level IN ('HIGH', 'MEDIUM', 'REVIEW', 'REJECT')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'viewed', 'purchased', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status);
CREATE INDEX IF NOT EXISTS idx_candidates_analysis ON candidates(analysis_id);
CREATE INDEX IF NOT EXISTS idx_matches_analysis ON matches(analysis_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_analysis ON opportunities(analysis_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_level ON opportunities(level);
CREATE INDEX IF NOT EXISTS idx_opportunities_created ON opportunities(created_at DESC);
