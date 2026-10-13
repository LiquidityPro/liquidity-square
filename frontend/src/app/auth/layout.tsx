import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-auth",
});

export const metadata: Metadata = {
  title: "Sign in · Liquidity Square",
  description: "Sign in or create an account for Liquidity Square.",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${inter.variable} min-h-dvh`}>{children}</div>;
}
