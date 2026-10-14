import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      firstName?: string;
      lastName?: string;
      username?: string | null;
    } & DefaultSession["user"];
    accessToken?: string;
  }

  interface User {
    id: string;
    firstName?: string;
    lastName?: string;
    username?: string | null;
    token?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    firstName?: string;
    lastName?: string;
    username?: string | null;
    token?: string;
  }
}
