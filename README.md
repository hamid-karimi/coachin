# CoachIn - Personal Workout Tracker

CoachIn is a Next.js application designed to help users schedule and track their daily sports activities, utilizing gamification elements like XP to maintain motivation.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database & Auth**: Supabase
- **UI Libraries**: React 19, Lucide React, Canvas Confetti

## Key Features

- **User Authentication**: Secure sign-up and login flows.
- **Onboarding Wizard**: Easy setup for defining a weekly recurring schedule.
- **Daily Dashboard**: Auto-generated daily view based on the weekly plan.
- **Gamification**: Earn XP for completing workouts.

## Project Structure

- `app/auth`: Login and Registration logic.
- `app/dashboard`: Main application view for tracking.
- `app/onboarding`: Initial setup flow for schedules.
- `lib/supabase`: Database client configuration.

## Database Schema (Inferred)

- **profiles**: User data and total XP.
- **sport_types**: Metadata for sports (name, XP multiplier).
- **schedules**: Recurring weekly plans (`user_id`, `day_of_week`, `sport_type_id`, `time`).
- **logs**: Records of completed activities.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# coachin
