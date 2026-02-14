# Community Module

ماژول `community` شامل منطق اجتماعی، مربیگری و لیدربردهای اپ است.

## Scope (MVP)

- **Leaderboards**
  - `Global League`: رتبه‌بندی هفتگی کل اپ (بر اساس `xp_transactions` در ۷ روز اخیر)
  - `My Club`: رتبه‌بندی اعضای کلاب primary کاربر
  - `My Circle`: رتبه‌بندی کاربرانی که کاربر فالو کرده (`social_graph`)
- **Coaching Zone**
  - نمایش مربی‌های من
  - نمایش شاگردهای من
  - تولید کد دعوت مربیگری per coach + sport
  - اتصال شاگرد به مربی از طریق کد دعوت
  - ارسال برنامه هفتگی مربی برای شاگرد (جایگزینی برنامه فعلی شاگرد)
- **Friends Management**
  - لیست Following مستقل
  - جستجوی کاربران و Follow/Unfollow
  - صفحه‌بندی نتایج جستجو
- **Club Management**
  - Join با کد کلاب
  - Leave کلاب
  - تعیین یک کلاب primary در کنار چند عضویت همزمان

## Main Files

- `app/community/page.tsx`: صفحه اصلی Community (تب‌ها + ترکیب سکشن‌ها)
- `app/community/actions.ts`: Server Actions اجتماعی/مربیگری
- `app/community/lib/community-data.ts`: لایه بارگذاری داده‌ها
- `app/community/components/*`: سکشن‌ها و فرم‌های UI
- `app/community/types.ts`: تایپ‌های مشترک ماژول
- `app/community/components/TabNavigation.tsx`: ناوبری client-side تب‌ها با `useTransition` + spinner روی دکمه‌ها
- `app/community/loading.tsx`: اسکلتون اولیه مسیر

## Navigation & Loading UX

- سوییچ تب‌ها (`leaderboards` / `coaching`) و بردها (`global` / `club` / `circle`) با `router.push` در `TabNavigation` انجام می‌شود.
- هنگام pending شدن transition:
  - URL بلافاصله آپدیت می‌شود.
  - روی دکمه تب/برد مقصد spinner نمایش داده می‌شود.
  - محتوای سکشن با اسکلتون موقت جایگزین می‌شود تا کاربر جریان لود را ببیند.
- `loading.tsx` مخصوص initial route load است؛ برای searchParams transitions، لودینگ داخلی `TabNavigation` استفاده می‌شود.

## Data Loading Strategy (Performance)

- در `getCommunityData` فقط دیتای لازم برای `activeTab` و `activeBoard` fetch می‌شود.
- تب `coaching` فقط داده‌های مربیگری (`coaching_relationships`, `coach_invite_codes`, `sport_types`) را می‌گیرد.
- تب `leaderboards` فقط داده‌های لیدربرد/اجتماعی (`club_members`, `social_graph`, discover/following`) را می‌گیرد.
- این تفکیک باعث کاهش queryهای غیرضروری و بهبود زمان سوییچ تب شده است.

## Database Dependencies

### Tables Used

- `profiles`
- `coaching_relationships`
- `coach_invite_codes`
- `clubs`
- `club_members`
- `social_graph`
- `xp_transactions`
- `sport_types`

### Required Migration

- `supabase/migrations/20260212010000_social_coaching_mvp.sql`

این migration موارد زیر را اعمال می‌کند:

- جدول `coach_invite_codes`
- قیود uniqueness و self-check برای روابط مربیگری
- پشتیبانی کلاب primary در `club_members`
- ایندکس‌های مرتبط با Social/Coaching
- RLS policyهای MVP برای جداول اجتماعی

## Role Model

`profiles.role` مبنای دسترسی UI/Action است:

- coach-enabled: `coach`, `both`, `admin`
- student-enabled: `student`, `both`, `admin`

## Notes

- My Circle صرفاً بر پایه `social_graph` محاسبه می‌شود.
- Invite مربیگری به‌صورت **per-coach+sport** است.
- CTA `Create Workout for Student` فعلاً placeholder است و به workflow اصلی هدایت می‌کند.
- دکمه `ارسال برنامه` در لیست شاگردان، برنامه هفتگی مربی را برای همان شاگرد کپی می‌کند.
- لیدربرد ابتدا از RPC `get_weekly_leaderboard` می‌خواند.
- اگر RPC خطا بدهد یا همه `weekly_xp` ها صفر باشند، fallback به `profiles.xp` (Total XP) انجام می‌شود تا نمایش امتیاز با dashboard هم‌راستا بماند.
- برای همگام بودن داده هفتگی، ثبت تمرین در dashboard باید در `xp_transactions` نیز رکورد ایجاد کند.
