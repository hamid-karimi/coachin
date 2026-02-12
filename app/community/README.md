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
