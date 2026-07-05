import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/server";

export async function proxy(req: NextRequest) {
  const { supabase, response } = createSupabaseMiddlewareClient(req);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAuthPage = req.nextUrl.pathname.startsWith("/auth");
  const isDashboardPage = req.nextUrl.pathname.startsWith("/dashboard");
  const isCommunityPage = req.nextUrl.pathname.startsWith("/community");
  const isCoachingPage = req.nextUrl.pathname.startsWith("/coaching");
  const isProfilePage = req.nextUrl.pathname.startsWith("/profile");
  const isTrainingPage = req.nextUrl.pathname.startsWith("/training");
  const isNutritionPage = req.nextUrl.pathname.startsWith("/nutrition");

  // If user is authenticated and tries to access auth pages (login/register)
  // redirect to "/" — the root page does the role-aware routing (no role
  // fetch here: one extra DB hit per request is the anti-pattern).
  if (session && isAuthPage && !isDashboardPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // If user is not authenticated and tries to access dashboard
  // redirect to login
  if (
    !session &&
    (isDashboardPage ||
      isCommunityPage ||
      isCoachingPage ||
      isProfilePage ||
      isTrainingPage ||
      isNutritionPage)
  ) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/auth/:path*",
    "/dashboard/:path*",
    "/community/:path*",
    "/coaching/:path*",
    "/profile/:path*",
    "/training/:path*",
    "/nutrition/:path*",
  ],
};
