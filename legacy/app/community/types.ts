export type ProfileSummary = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  xp?: number | null;
  weekly_xp?: number | null;
  level?: number | null;
  league_tier?: string | null;
  avatar_url?: string | null;
};

export type SportTypeSummary = {
  id?: number | null;
  name?: string | null;
};

export type CoachRelationship = {
  coach: ProfileSummary;
  sport_type?: SportTypeSummary | null;
};

export type StudentRelationship = {
  student: ProfileSummary;
  sport_type?: SportTypeSummary | null;
};

export type CoachInviteCodeSummary = {
  code: string;
  is_active: boolean;
  expires_at: string | null;
  sport_type?: SportTypeSummary | null;
};

export type ClubMembershipSummary = {
  club_id: string;
  club_name: string;
  club_invite_code: string;
  is_primary: boolean;
};
