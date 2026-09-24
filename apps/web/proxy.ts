import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIES, sessionRedirect } from "@/lib/session-routing";

export function proxy(req: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));
  const target = sessionRedirect(req.nextUrl.pathname, hasSession);
  return target ? NextResponse.redirect(new URL(target, req.url)) : NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/training/:path*",
    "/calendar/:path*",
    "/nutrition/:path*",
    "/community/:path*",
    "/coaching/:path*",
    "/profile/:path*",
    "/onboarding/:path*",
  ],
};
