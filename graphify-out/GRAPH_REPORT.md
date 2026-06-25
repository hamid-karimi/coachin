# Graph Report - .  (2026-06-25)

## Corpus Check
- Corpus is ~16,981 words - fits in a single context window. You may not need a graph.

## Summary
- 309 nodes · 508 edges · 23 communities (15 shown, 8 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.85)
- Token cost: 59,502 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Shared UI Components|Shared UI Components]]
- [[_COMMUNITY_Dashboard & Auth UI|Dashboard & Auth UI]]
- [[_COMMUNITY_Community Page & Coaching|Community Page & Coaching]]
- [[_COMMUNITY_Community Server Actions|Community Server Actions]]
- [[_COMMUNITY_Project Docs & Rationale|Project Docs & Rationale]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Package Manifest & Deps|Package Manifest & Deps]]
- [[_COMMUNITY_Discover & Social Feed|Discover & Social Feed]]
- [[_COMMUNITY_Dev Dependencies & Tooling|Dev Dependencies & Tooling]]
- [[_COMMUNITY_Community Layout|Community Layout]]
- [[_COMMUNITY_Root Layout & Toasts|Root Layout & Toasts]]
- [[_COMMUNITY_App Entry & Supabase|App Entry & Supabase]]
- [[_COMMUNITY_UI Icon Assets|UI Icon Assets]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Brand Logo Assets|Brand Logo Assets]]
- [[_COMMUNITY_Storybook Main Config|Storybook Main Config]]
- [[_COMMUNITY_Storybook Preview Config|Storybook Preview Config]]
- [[_COMMUNITY_Community 21|Community 21]]

## God Nodes (most connected - your core abstractions)
1. `createClient()` - 23 edges
2. `useActionToast()` - 19 edges
3. `compilerOptions` - 16 edges
4. `getCurrentUserAndRole()` - 11 edges
5. `getCommunityData()` - 11 edges
6. `ProfileSummary` - 7 edges
7. `scripts` - 7 edges
8. `CommunityActionState` - 6 edges
9. `GET()` - 6 edges
10. `fetchDiscoverProfiles()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `LoginPage()` --calls--> `useActionToast()`  [EXTRACTED]
  app/auth/login/page.tsx → components/hooks/use-action-toast.ts
- `RegisterPage()` --calls--> `useActionToast()`  [EXTRACTED]
  app/auth/register/page.tsx → components/hooks/use-action-toast.ts
- `getCurrentUserAndRole()` --calls--> `createClient()`  [EXTRACTED]
  app/community/actions.ts → lib/supabase/server.ts
- `GET()` --calls--> `createClient()`  [EXTRACTED]
  app/community/api/discover/route.ts → lib/supabase/server.ts
- `FollowToggleButton()` --calls--> `useActionToast()`  [EXTRACTED]
  app/community/components/FollowToggleButton.tsx → components/hooks/use-action-toast.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Unified Toast Notification Migration** — coachin_sonner_toast, coachin_use_action_toast, auth_readme, onboarding_readme, dashboard_readme, community_readme [EXTRACTED 0.90]
- **Coach Join Reliability Fix Flow** — coachin_add_coach_fix, coachin_join_coach_statuses, community_coach_join_fix [EXTRACTED 0.90]
- **CoachIn Feature Route Modules** — auth_readme, onboarding_readme, dashboard_readme, community_readme [EXTRACTED 0.85]
- **Next.js Starter Template Assets** —  [INFERRED 0.85]

## Communities (23 total, 8 thin omitted)

### Community 0 - "Shared UI Components"
Cohesion: 0.07
Nodes (34): AddScheduleForm(), AddScheduleFormProps, DAYS, SportType, CompleteOnboardingButton(), CompleteOnboardingButtonProps, LoadingScreen(), LoadingScreenProps (+26 more)

### Community 1 - "Dashboard & Auth UI"
Cohesion: 0.08
Nodes (30): AuthContainer(), AuthContainerProps, Default, meta, Story, SubmitButton(), SubmitButtonProps, WorkoutCard() (+22 more)

### Community 2 - "Community Page & Coaching"
Cohesion: 0.08
Nodes (34): ActiveBoard, ActiveTab, COACH_ENABLED_ROLES, CommunityPage(), CommunityPageProps, STUDENT_ENABLED_ROLES, CoachInviteCodeSummary, CoachRelationship (+26 more)

### Community 3 - "Community Server Actions"
Cohesion: 0.12
Nodes (29): assignCoachWeeklyPlanAction(), COACH_ENABLED_ROLES, CommunityActionState, connectCoachByCodeAction(), createClubAction(), followUserAction(), generateCoachInviteCodeAction(), getCurrentUserAndRole() (+21 more)

### Community 4 - "Project Docs & Rationale"
Cohesion: 0.12
Nodes (24): Authentication Module, Supabase Auth Sign-in/Registration, Auth Validation Behavior, Add-Coach Reliability Fix, English-Only User Messaging, Deterministic Join Coach Statuses, Next.js 16 App Router, CoachIn App (+16 more)

### Community 5 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 6 - "Package Manifest & Deps"
Cohesion: 0.11
Nodes (18): dependencies, canvas-confetti, next, react, react-dom, sonner, @supabase/ssr, @supabase/supabase-js (+10 more)

### Community 7 - "Discover & Social Feed"
Cohesion: 0.19
Nodes (13): ProfileSummary, FollowToggleButton(), FriendsSection(), FriendsSectionProps, LeaderboardSection(), LeaderboardSectionProps, GET(), DiscoverProfilesInput (+5 more)

### Community 8 - "Dev Dependencies & Tooling"
Cohesion: 0.11
Nodes (18): devDependencies, eslint, eslint-config-next, eslint-plugin-storybook, playwright, storybook, @storybook/nextjs-vite, tailwindcss (+10 more)

### Community 9 - "Community Layout"
Cohesion: 0.28
Nodes (5): Default, meta, Story, CommunityLayout(), CommunityLayoutProps

### Community 10 - "Root Layout & Toasts"
Cohesion: 0.33
Nodes (4): geistMono, geistSans, metadata, Sonner()

### Community 12 - "UI Icon Assets"
Cohesion: 0.67
Nodes (3): File / Document Icon, Globe Icon, Browser Window Icon

## Knowledge Gaps
- **129 isolated node(s):** `config`, `preview`, `meta`, `Story`, `Default` (+124 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClient()` connect `Dashboard & Auth UI` to `Shared UI Components`, `Community Page & Coaching`, `Community Server Actions`, `Discover & Social Feed`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Why does `useActionToast()` connect `Community Server Actions` to `Shared UI Components`, `Dashboard & Auth UI`, `Community Page & Coaching`, `Discover & Social Feed`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Why does `getCommunityData()` connect `Community Page & Coaching` to `Dashboard & Auth UI`, `Discover & Social Feed`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `config`, `preview`, `meta` to the rest of the system?**
  _130 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Shared UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.06826241134751773 - nodes in this community are weakly interconnected._
- **Should `Dashboard & Auth UI` be split into smaller, more focused modules?**
  _Cohesion score 0.0824524312896406 - nodes in this community are weakly interconnected._
- **Should `Community Page & Coaching` be split into smaller, more focused modules?**
  _Cohesion score 0.08084163898117387 - nodes in this community are weakly interconnected._