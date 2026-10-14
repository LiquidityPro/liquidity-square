import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:5000").replace(/\/$/, "");

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        throw new Error("Please provide both email and password");
      }

      try {
        const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to log in");
        }

        if (data.user) {
          return {
            id: data.user.id,
            email: data.user.email,
            name: `${data.user.firstName || ""} ${data.user.lastName || ""}`.trim() || data.user.email,
            firstName: data.user.firstName,
            lastName: data.user.lastName,
            image: data.user.image,
            token: data.token,
          };
        }

        return null;
      } catch (error: any) {
        throw new Error(error.message || "Authentication error connecting to server");
      }
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

function isUsableAccessToken(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { exp?: number };
    return typeof payload.exp !== "number" || payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export const authOptions: NextAuthOptions = {
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        try {
          const email = user.email || (profile as any)?.email;
          if (!email) {
            console.error("[NextAuth] Google login missing email");
            return false;
          }

          const name = user.name || (profile as any)?.name || "";
          const names = name.trim().split(" ");
          const firstName = names[0] || "User";
          const lastName = names.slice(1).join(" ") || "";
          const image = user.image || (profile as any)?.picture || null;

          console.log("[NextAuth] Syncing Google user to backend:", { email, firstName, lastName });

          const res = await fetch(`${BACKEND_URL}/api/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              firstName,
              lastName,
              image,
              googleId: account.providerAccountId,
            }),
          });

          if (!res.ok) {
            const errText = await res.text();
            console.error("[NextAuth] Backend returned error on Google sync:", res.status, errText);
            return false;
          }

          const data = await res.json();
          (user as any).id = data.user.id;
          (user as any).firstName = data.user.firstName;
          (user as any).lastName = data.user.lastName;
          (user as any).token = data.token;
          return true;
        } catch (err) {
          console.error("[NextAuth] Error calling backend for Google user:", err);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.firstName = (user as any).firstName;
        token.lastName = (user as any).lastName;
        token.token = (user as any).token;
      }
      // Throw so NextAuth clears the cookie and returns an empty session.
      // Returning null still gets encoded and leaves the browser looking signed in.
      if (!isUsableAccessToken(token.token)) {
        throw new Error("API access token expired");
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = (token.id as string) || (token.sub as string);
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
        session.accessToken = token.token as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  pages: {
    signIn: "/auth",
    error: "/auth",
  },
  secret: process.env.NEXTAUTH_SECRET || "liquidity-square-super-secret-jwt-key-2026-production-ready",
};
