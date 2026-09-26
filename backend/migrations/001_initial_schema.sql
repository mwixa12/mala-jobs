DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('job_seeker','employer','admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE opportunity_type AS ENUM ('formal_job','internship','apprenticeship','gig','informal','self_employment_resource');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE job_status AS ENUM ('pending_review','published','closed','flagged','removed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE application_status AS ENUM ('submitted','viewed','shortlisted','interview','offered','rejected','withdrawn');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE employer_trust_tier AS ENUM ('unverified','tier_0_phone','tier_1_reviewed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE proficiency_level AS ENUM ('beginner','intermediate','advanced','expert');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('application_status_changed','new_matching_opportunity','job_flagged','account');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255) UNIQUE,
  password_hash TEXT,
  role user_role NOT NULL,
  preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',
  phone_verified_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_seeker_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  location_district VARCHAR(100),
  bio TEXT,
  highest_education VARCHAR(100),
  open_to_gig_work BOOLEAN NOT NULL DEFAULT TRUE,
  open_to_relocation BOOLEAN NOT NULL DEFAULT FALSE,
  profile_photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL UNIQUE,
  category VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  proficiency proficiency_level NOT NULL DEFAULT 'beginner',
  years_experience NUMERIC(4,1),
  self_reported BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS employers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(255) NOT NULL,
  is_organization BOOLEAN NOT NULL DEFAULT FALSE,
  business_reg_number VARCHAR(100),
  trust_tier employer_trust_tier NOT NULL DEFAULT 'unverified',
  trust_tier_reviewed_at TIMESTAMPTZ,
  trust_tier_reviewed_by UUID REFERENCES users(id),
  location_district VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  opportunity_type opportunity_type NOT NULL,
  location_district VARCHAR(100),
  is_remote BOOLEAN NOT NULL DEFAULT FALSE,
  pay_amount_min NUMERIC(12,2),
  pay_amount_max NUMERIC(12,2),
  pay_period VARCHAR(20),
  status job_status NOT NULL DEFAULT 'pending_review',
  quality_flag_reason TEXT,
  quality_checked_at TIMESTAMPTZ,
  application_deadline DATE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_board ON jobs(status, location_district, published_at DESC) WHERE status='published';

CREATE TABLE IF NOT EXISTS job_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (job_id, skill_id)
);

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  seeker_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_status application_status NOT NULL DEFAULT 'submitted',
  cover_note TEXT,
  match_explanation_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, seeker_user_id)
);

CREATE TABLE IF NOT EXISTS application_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_status application_status,
  to_status application_status NOT NULL,
  changed_by_user_id UUID REFERENCES users(id),
  note TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  related_application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  related_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  employer_id UUID REFERENCES employers(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by_user_id UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (job_id IS NOT NULL OR employer_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed skills
INSERT INTO skills (name, category) VALUES
  ('Solar Installation & Maintenance', 'Trades'),
  ('Plumbing & Pipefitting', 'Trades'),
  ('Carpentry & Joinery', 'Trades'),
  ('Electrical Wiring', 'Trades'),
  ('Bricklaying & Masonry', 'Trades'),
  ('Tailoring & Garment Making', 'Trades'),
  ('Welding & Metal Fabrication', 'Trades'),
  ('Auto Mechanics & Repair', 'Trades'),
  ('Web Development & Coding', 'Digital'),
  ('Graphic Design & Branding', 'Digital'),
  ('Digital Marketing & Social Media', 'Digital'),
  ('Data Entry & Office Admin', 'Digital'),
  ('Mobile Money Operations', 'Service'),
  ('Catering & Culinary Arts', 'Service'),
  ('Professional Driving & Logistics', 'Service'),
  ('Customer Service & Sales', 'Service'),
  ('Agri-Tech & Drip Irrigation', 'Trades'),
  ('Housekeeping & Hospitality', 'Service'),
  ('Hairdressing & Beauty Therapy', 'Service'),
  ('Basic Bookkeeping & Accounting', 'Digital')
ON CONFLICT (name) DO NOTHING;
