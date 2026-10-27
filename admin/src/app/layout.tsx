import type { Metadata } from "next";
import { Fira_Code } from "next/font/google";
import "./globals.css";

const fira = Fira_Code({ subsets: ["latin"], variable: "--font-desk" });

export const metadata: Metadata = {
  title: "Desk",
  description: "Staff desk for Liquidity Square",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={fira.className}>{children}</body>
    </html>
  );
}
