import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET || "liquidity-square-super-secret-jwt-key-2026-production-ready",
  });

  const { pathname } = req.nextUrl;
  const isAuthPage = pathname.startsWith("/auth");
  const isSquarePage = pathname.startsWith("/square");
  const isRoot = pathname === "/";

  // Root redirect
  if (isRoot) {
    if (token) {
      return NextResponse.redirect(new URL("/square", req.url));
    }
    return NextResponse.redirect(new URL("/auth", req.url));
  }

  // If already authenticated and visiting /auth
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/square", req.url));
  }

  // If not authenticated and visiting protected /square routes
  if (isSquarePage && !token) {
    const callbackUrl = encodeURIComponent(pathname + req.nextUrl.search);
    return NextResponse.redirect(new URL(`/auth?callbackUrl=${callbackUrl}`, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/square/:path*", "/auth/:path*"],
};
