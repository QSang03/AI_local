import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const authRoutes = ["/login", "/forgot-password", "/reset-password"];
const protectedPrefixes = ["/projects", "/inbox", "/channels", "/marking", "/chat", "/profile"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const refreshToken = req.cookies.get("refresh_token")?.value;

  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));
  const isProtected = protectedPrefixes.some((route) => pathname.startsWith(route)) || pathname === "/";

  if (isProtected && !refreshToken) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname || "/projects");
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && refreshToken) {
    const url = req.nextUrl.clone();
    url.pathname = "/projects";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
