# CoachIn

CoachIn یک اپلیکیشن ورزشی مبتنی بر Next.js است برای برنامه‌ریزی تمرین، ثبت فعالیت روزانه، و قابلیت‌های اجتماعی/مربیگری.

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- Supabase (Auth + Database + RLS)

## Main Features

- احراز هویت (Login/Register)
- Onboarding برای تعریف برنامه هفتگی تمرین
- Dashboard روزانه با ثبت تمرین و XP
- Community:
  - لیدربردهای `Global League`، `My Club`، `My Circle`
  - Coaching Zone (مربی‌ها، شاگردها، Invite code)
  - Club memberships (join/leave/set primary)
  - Friends management (follow/unfollow + search)

## Project Structure

- `app/auth`: صفحات و اکشن‌های ورود/ثبت‌نام
- `app/onboarding`: تنظیم برنامه هفتگی
- `app/dashboard`: ثبت تمرین و نمایش برنامه روز
- `app/community`: ماژول اجتماعی/مربیگری (جزئیات در `app/community/README.md`)
- `lib/supabase`: کلاینت‌های Supabase برای Server و Middleware
- `supabase/migrations`: اسکیمای دیتابیس و RLS

## Social & Coaching Migration

برای فیچرهای Community این migration ضروری است:

- `supabase/migrations/20260212010000_social_coaching_mvp.sql`

## Development

```bash
npm install
npm run dev
```

## Quality Checks

```bash
npm run lint
npm run build
```
