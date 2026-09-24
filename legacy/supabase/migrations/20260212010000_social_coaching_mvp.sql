-- Social & Coaching MVP: invite codes, constraints, and RLS policies

-- 1) Coach invite codes (per coach + sport)
CREATE TABLE IF NOT EXISTS public.coach_invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sport_type_id bigint NOT NULL REFERENCES public.sport_types(id) ON DELETE RESTRICT,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT coach_invite_codes_coach_sport_key UNIQUE (coach_id, sport_type_id)
);

ALTER TABLE public.coach_invite_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS coach_invite_codes_code_idx
  ON public.coach_invite_codes (code);

CREATE INDEX IF NOT EXISTS coach_invite_codes_coach_idx
  ON public.coach_invite_codes (coach_id);

-- 2) Constraints for coaching relationship many-to-many by sport
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coaching_relationships_coach_student_sport_key'
  ) THEN
    ALTER TABLE public.coaching_relationships
      ADD CONSTRAINT coaching_relationships_coach_student_sport_key
      UNIQUE (coach_id, student_id, sport_type_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coaching_relationships_no_self_link'
  ) THEN
    ALTER TABLE public.coaching_relationships
      ADD CONSTRAINT coaching_relationships_no_self_link
      CHECK (coach_id <> student_id);
  END IF;
END $$;

-- 3) Clubs: multi-membership + one primary club per user
ALTER TABLE public.club_members
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'club_members_club_user_key'
  ) THEN
    ALTER TABLE public.club_members
      ADD CONSTRAINT club_members_club_user_key UNIQUE (club_id, user_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS club_members_one_primary_per_user_idx
  ON public.club_members (user_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS club_members_user_idx
  ON public.club_members (user_id);

CREATE INDEX IF NOT EXISTS club_members_club_idx
  ON public.club_members (club_id);

-- 4) Helpful indexes
CREATE INDEX IF NOT EXISTS coaching_relationships_student_idx
  ON public.coaching_relationships (student_id);

CREATE INDEX IF NOT EXISTS coaching_relationships_coach_idx
  ON public.coaching_relationships (coach_id);

CREATE INDEX IF NOT EXISTS coaching_relationships_sport_idx
  ON public.coaching_relationships (sport_type_id);

CREATE INDEX IF NOT EXISTS social_graph_follower_idx
  ON public.social_graph (follower_id);

CREATE INDEX IF NOT EXISTS social_graph_following_idx
  ON public.social_graph (following_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'social_graph_follower_following_key'
  ) THEN
    ALTER TABLE public.social_graph
      ADD CONSTRAINT social_graph_follower_following_key
      UNIQUE (follower_id, following_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS xp_transactions_user_created_idx
  ON public.xp_transactions (user_id, created_at DESC);

-- 5) RLS Policies

-- profiles
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_authenticated
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- coaching_relationships
DROP POLICY IF EXISTS coaching_relationships_select_related ON public.coaching_relationships;
CREATE POLICY coaching_relationships_select_related
ON public.coaching_relationships
FOR SELECT
TO authenticated
USING (coach_id = auth.uid() OR student_id = auth.uid());

DROP POLICY IF EXISTS coaching_relationships_insert_student_self ON public.coaching_relationships;
CREATE POLICY coaching_relationships_insert_student_self
ON public.coaching_relationships
FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS coaching_relationships_delete_related ON public.coaching_relationships;
CREATE POLICY coaching_relationships_delete_related
ON public.coaching_relationships
FOR DELETE
TO authenticated
USING (coach_id = auth.uid() OR student_id = auth.uid());

-- coach_invite_codes
DROP POLICY IF EXISTS coach_invite_codes_select_active ON public.coach_invite_codes;
CREATE POLICY coach_invite_codes_select_active
ON public.coach_invite_codes
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (expires_at IS NULL OR expires_at > now())
);

DROP POLICY IF EXISTS coach_invite_codes_manage_own ON public.coach_invite_codes;
CREATE POLICY coach_invite_codes_manage_own
ON public.coach_invite_codes
FOR ALL
TO authenticated
USING (coach_id = auth.uid())
WITH CHECK (coach_id = auth.uid());

-- social_graph
DROP POLICY IF EXISTS social_graph_select_related ON public.social_graph;
CREATE POLICY social_graph_select_related
ON public.social_graph
FOR SELECT
TO authenticated
USING (follower_id = auth.uid() OR following_id = auth.uid());

DROP POLICY IF EXISTS social_graph_insert_self_follow ON public.social_graph;
CREATE POLICY social_graph_insert_self_follow
ON public.social_graph
FOR INSERT
TO authenticated
WITH CHECK (follower_id = auth.uid() AND following_id <> auth.uid());

DROP POLICY IF EXISTS social_graph_delete_self_follow ON public.social_graph;
CREATE POLICY social_graph_delete_self_follow
ON public.social_graph
FOR DELETE
TO authenticated
USING (follower_id = auth.uid());

-- clubs
DROP POLICY IF EXISTS clubs_select_authenticated ON public.clubs;
CREATE POLICY clubs_select_authenticated
ON public.clubs
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS clubs_insert_owner_self ON public.clubs;
CREATE POLICY clubs_insert_owner_self
ON public.clubs
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS clubs_update_owner ON public.clubs;
CREATE POLICY clubs_update_owner
ON public.clubs
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS clubs_delete_owner ON public.clubs;
CREATE POLICY clubs_delete_owner
ON public.clubs
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- club_members
DROP POLICY IF EXISTS club_members_select_authenticated ON public.club_members;
CREATE POLICY club_members_select_authenticated
ON public.club_members
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS club_members_insert_self ON public.club_members;
CREATE POLICY club_members_insert_self
ON public.club_members
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS club_members_update_self ON public.club_members;
CREATE POLICY club_members_update_self
ON public.club_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS club_members_delete_self ON public.club_members;
CREATE POLICY club_members_delete_self
ON public.club_members
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- xp_transactions
DROP POLICY IF EXISTS xp_transactions_select_self ON public.xp_transactions;
CREATE POLICY xp_transactions_select_self
ON public.xp_transactions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
