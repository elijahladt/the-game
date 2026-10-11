-- =============================================================================
-- QUICKFIRE: Supabase PostgreSQL Schema
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (user profiles for persistent accounts or guest tracking)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(32) NOT NULL UNIQUE,
  avatar_seed VARCHAR(64) DEFAULT 'player',
  total_matches_played INTEGER DEFAULT 0,
  total_matches_won INTEGER DEFAULT 0,
  total_points_earned INTEGER DEFAULT 0,
  highest_round_reached INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Questions Bank Table
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_text TEXT NOT NULL,
  canonical_answer VARCHAR(255) NOT NULL,
  accepted_answers TEXT[] NOT NULL DEFAULT '{}',
  category VARCHAR(64) NOT NULL,
  difficulty VARCHAR(16) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  image_url TEXT,
  image_alt_text TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_active ON questions(is_active);

-- 3. Matches Table
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code VARCHAR(8) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed', 'abandoned')),
  is_private BOOLEAN DEFAULT FALSE,
  target_round INTEGER DEFAULT 10,
  winner_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  winner_username VARCHAR(32),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_room_code ON matches(room_code);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);

-- 4. Match Players Table
CREATE TABLE IF NOT EXISTS match_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id VARCHAR(64) NOT NULL,
  username VARCHAR(32) NOT NULL,
  final_score INTEGER DEFAULT 0,
  final_round INTEGER DEFAULT 1,
  violations_count INTEGER DEFAULT 0,
  is_disqualified BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (match_id, player_id)
);

-- 5. Question Instances Table (Atomic server-managed questions)
CREATE TABLE IF NOT EXISTS question_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  assigned_to_player_id VARCHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  first_correct_player_id VARCHAR(64),
  first_correct_submitted_at TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_question_instances_match ON question_instances(match_id);
CREATE INDEX IF NOT EXISTS idx_question_instances_status ON question_instances(status);

-- 6. Answer Submissions Table (Authoritative audit log)
CREATE TABLE IF NOT EXISTS answer_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  question_instance_id UUID NOT NULL REFERENCES question_instances(id) ON DELETE CASCADE,
  player_id VARCHAR(64) NOT NULL,
  submitted_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  awarded_point BOOLEAN NOT NULL DEFAULT FALSE,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_answer_submissions_instance ON answer_submissions(question_instance_id);

-- 7. Focus Violations Table (Anti-cheat audit log)
CREATE TABLE IF NOT EXISTS focus_violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(32) NOT NULL CHECK (event_type IN ('blur', 'visibilitychange')),
  penalty_tier VARCHAR(32) NOT NULL CHECK (penalty_tier IN ('warning', 'lockout', 'point_deduction', 'disqualified')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row-Level Security (RLS) Setup
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE answer_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_violations ENABLE ROW LEVEL SECURITY;

-- Public can read questions that are active
CREATE POLICY "Public read active questions" ON questions
  FOR SELECT USING (is_active = true);

-- Public can read completed match summaries
CREATE POLICY "Public read matches" ON matches
  FOR SELECT USING (true);
