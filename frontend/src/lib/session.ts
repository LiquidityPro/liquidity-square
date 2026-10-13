"use client";

import { signOut } from "next-auth/react";

let inFlight: Promise<void> | null = null;

/**
 * Standard logout for this app: NextAuth session cookie is HttpOnly,
 * so only `/api/auth/signout` can expire it. The backend JWT is stored
 * inside that cookie (session.accessToken), not as a separate cookie.
 */
export function signOutSession() {
  if (inFlight) return inFlight;
  inFlight = signOut({ callbackUrl: "/auth" }).then(() => undefined);
  return inFlight;
}
