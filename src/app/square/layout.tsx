"use client";
import { useRef } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import { LeftNav, MobileBar, RightRail, TickerTape } from "@/components/square/parts";
import { SquareProvider, useSquare } from "@/components/square/context";

export default function SquareLayout({ children }: { children: React.ReactNode }) {
  return (
    <SquareProvider>
      <SquareInner>{children}</SquareInner>
    </SquareProvider>
  );
}

function SquareInner({ children }: { children: React.ReactNode }) {
  const { following, toggleFollow } = useSquare();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams() as Record<string, string | undefined>;
  const activeTicker = params?.ticker;

  function focusComposer() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (pathname === "/square") {
      setTimeout(() => {
        const composer = document.querySelector('textarea') as HTMLTextAreaElement | null;
        composer?.focus();
      }, 100);
    } else {
      router.push("/square");
    }
  }

  function handleTickerNav(ticker: string) {
    router.push(`/square/${ticker}`);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TickerTape />
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 justify-center">
        <LeftNav onCompose={focusComposer} />

        <main className="min-h-screen w-full max-w-[600px] border-x pb-24 sm:pb-0">
          {children}
        </main>

        <RightRail onTicker={handleTickerNav} following={following} onToggleFollow={toggleFollow} activeTicker={activeTicker} />
        <MobileBar onCompose={focusComposer} />
      </div>
    </div>
  );
}
