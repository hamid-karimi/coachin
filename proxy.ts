import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/server";

export async function proxy(req: NextRequest) {
  const { supabase, response } = createSupabaseMiddlewareClient(req);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAuthPage = req.nextUrl.pathname.startsWith("/auth");
  const isDashboardPage = req.nextUrl.pathname.startsWith("/dashboard");

  // If user is authenticated and tries to access auth pages (login/register)
  // redirect to dashboard
  if (session && isAuthPage && !isDashboardPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // If user is not authenticated and tries to access dashboard
  // redirect to login
  if (!session && isDashboardPage) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  return response;
}

export const config = {
  matcher: ["/auth/:path*", "/dashboard/:path*"],
};
