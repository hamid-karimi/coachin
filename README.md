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
  - Tab navigation با loading feedback (spinner روی تب + skeleton محتوا)
  - بهینه‌سازی fetch بر اساس تب/برد فعال برای کاهش زمان سوییچ
  - هم‌راستاسازی XP لیدربرد با fallback به `profiles.xp` در صورت نبود داده هفتگی معتبر

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

## Community Notes

- در `app/community/components/TabNavigation.tsx` از `useTransition` برای سوییچ نرم بین تب‌ها استفاده می‌شود.
- `app/community/loading.tsx` برای initial route load است؛ برای تغییر `searchParams` لودینگ داخلی تب‌ها نمایش داده می‌شود.
- لایه `app/community/lib/community-data.ts` فقط داده‌های لازم تب فعال را load می‌کند.
- منبع اصلی لیدربرد RPC `get_weekly_leaderboard` است؛ اگر خروجی معتبر نبود، fallback روی `profiles.xp` انجام می‌شود.

## Troubleshooting

- **Dashboard XP با Community XP یکی نیست**
  - در Community ابتدا RPC هفتگی (`get_weekly_leaderboard`) خوانده می‌شود.
  - اگر داده هفتگی معتبر نباشد، سیستم به `profiles.xp` fallback می‌کند.
  - مطمئن شوید در ثبت تمرین، علاوه بر آپدیت `profiles.xp`، رکورد `xp_transactions` هم درج می‌شود.

- **لودینگ فقط بار اول صفحه دیده می‌شود**
  - `loading.tsx` فقط برای initial route load اجرا می‌شود.
  - در سوییچ تب‌ها (تغییر `searchParams`) باید لودینگ داخلی `TabNavigation` فعال باشد (spinner + skeleton).

- **سوییچ تب‌ها کند است**
  - بررسی کنید fetch شرطی بر اساس `activeTab`/`activeBoard` در `community-data.ts` حفظ شده باشد.
  - اجرای `npm run build` و بررسی queryهای Supabase برای مسیرهای `leaderboards` و `coaching` توصیه می‌شود.

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
