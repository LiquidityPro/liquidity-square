import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const sessionToken =
    req.cookies.get("__Secure-next-auth.session-token")?.value ||
    req.cookies.get("next-auth.session-token")?.value ||
    req.cookies.get("__Secure-next-auth.session-token.0")?.value ||
    req.cookies.get("next-auth.session-token.0")?.value;

  const hasSession = Boolean(sessionToken);

  const { pathname } = req.nextUrl;
  const isAuthPage = pathname.startsWith("/auth");
  const isSquarePage = pathname.startsWith("/square");
  const isRoot = pathname === "/";

  // Root redirect
  if (isRoot) {
    if (hasSession) {
      return NextResponse.redirect(new URL("/square", req.url));
    }
    return NextResponse.redirect(new URL("/auth", req.url));
  }

  // If already authenticated and visiting /auth
  if (isAuthPage && hasSession) {
    return NextResponse.redirect(new URL("/square", req.url));
  }

  // If not authenticated and visiting protected /square routes
  if (isSquarePage && !hasSession) {
    const callbackUrl = encodeURIComponent(pathname + req.nextUrl.search);
    return NextResponse.redirect(new URL(`/auth?callbackUrl=${callbackUrl}`, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/square/:path*", "/auth/:path*"],
};
