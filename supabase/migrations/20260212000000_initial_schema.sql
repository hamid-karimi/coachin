-- Enable necessary extensions if not already enabled
create extension if not exists "uuid-ossp";

-- 1. Create Custom Types
DO $$ BEGIN
    CREATE TYPE public.log_status AS ENUM ('completed', 'skipped', 'missed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Independent Tables

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  email text,
  role text DEFAULT 'student'::text,
  xp integer DEFAULT 0,
  level integer DEFAULT 1,
  hearts integer DEFAULT 3,
  current_streak integer DEFAULT 0,
  best_streak integer DEFAULT 0,
  league_tier text DEFAULT 'bronze'::text,
  full_name text,
  avatar_url text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Sport Types
CREATE TABLE IF NOT EXISTS public.sport_types (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name text,
  xp_multiplier real,
  CONSTRAINT sport_types_pkey PRIMARY KEY (id)
);

-- 3. Create Tables with Dependencies

-- Clubs
CREATE TABLE IF NOT EXISTS public.clubs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_id uuid NOT NULL,
  invite_code text NOT NULL UNIQUE,
  telegram_link text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clubs_pkey PRIMARY KEY (id),
  CONSTRAINT clubs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id)
);

-- Club Members
CREATE TABLE IF NOT EXISTS public.club_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text DEFAULT 'member'::text,
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT club_members_pkey PRIMARY KEY (id),
  CONSTRAINT club_members_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE,
  CONSTRAINT club_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Coaching Relationships
CREATE TABLE IF NOT EXISTS public.coaching_relationships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  student_id uuid NOT NULL,
  sport_type_id bigint,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coaching_relationships_pkey PRIMARY KEY (id),
  CONSTRAINT coaching_relationships_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id),
  CONSTRAINT coaching_relationships_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT coaching_relationships_sport_type_id_fkey FOREIGN KEY (sport_type_id) REFERENCES public.sport_types(id)
);

-- Daily Plans
CREATE TABLE IF NOT EXISTS public.daily_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  date date NOT NULL,
  content text NOT NULL,
  is_completed boolean DEFAULT false,
  feedback text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT daily_plans_pkey PRIMARY KEY (id),
  CONSTRAINT daily_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- Logs
CREATE TABLE IF NOT EXISTS public.logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  date date NOT NULL,
  sport_type_id bigint,
  status public.log_status NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT logs_pkey PRIMARY KEY (id),
  CONSTRAINT logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT logs_sport_type_id_fkey FOREIGN KEY (sport_type_id) REFERENCES public.sport_types(id)
);

-- Schedules
CREATE TABLE IF NOT EXISTS public.schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  sport_type_id bigint,
  time time without time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT schedules_pkey PRIMARY KEY (id),
  CONSTRAINT schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT schedules_sport_type_id_fkey FOREIGN KEY (sport_type_id) REFERENCES public.sport_types(id)
);

-- Social Graph
CREATE TABLE IF NOT EXISTS public.social_graph (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  follower_id uuid,
  following_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT social_graph_pkey PRIMARY KEY (id),
  CONSTRAINT social_graph_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.profiles(id),
  CONSTRAINT social_graph_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.profiles(id)
);

-- XP Transactions
CREATE TABLE IF NOT EXISTS public.xp_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  amount integer NOT NULL,
  reason text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT xp_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT xp_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

-- 4. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_graph ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;
