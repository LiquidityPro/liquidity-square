"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import { LeftNav, MobileBar, RightRail, TickerTape } from "@/components/square/parts";
import { SquareProvider, useSquare } from "@/components/square/context";
import { InlineError } from "@/components/square/page-chrome";
import { Toaster } from "@/components/ui/sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTheme } from "@/components/theme-provider";
import { PushPrompt } from "@/components/pwa/push-prompt";

export default function SquareLayout({ children }: { children: React.ReactNode }) {
  return (
    <SquareProvider>
      <SquareInner>{children}</SquareInner>
    </SquareProvider>
  );
}

function SquareInner({ children }: { children: React.ReactNode }) {
  const { error } = useSquare();
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams() as Record<string, string | undefined>;
  const activeTicker = params?.ticker;
  const [railOpen, setRailOpen] = useState(false);

  useEffect(() => {
    setRailOpen(false);
  }, [pathname]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (media.matches) setRailOpen(false);
    };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);

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

  return (
    <div className="flex min-h-screen flex-col">
      <TickerTape onOpen={() => setRailOpen(true)} />
      <Sheet open={railOpen} onOpenChange={setRailOpen}>
        <SheetContent
          side="bottom"
          className="h-[min(85dvh,720px)] gap-0 overflow-hidden rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Markets</SheetTitle>
            <SheetDescription>Trending tickers, top movers, and people to follow.</SheetDescription>
          </SheetHeader>
          <RightRail activeTicker={activeTicker} variant="sheet" />
        </SheetContent>
      </Sheet>
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 justify-center">
        <LeftNav onCompose={focusComposer} />

        <main className="min-h-screen w-full max-w-[600px] border-x pb-24 sm:pb-0">
          <PushPrompt />
          {error && <InlineError message={error} />}
          {children}
        </main>

        <RightRail activeTicker={activeTicker} />
        <MobileBar onCompose={focusComposer} />
      </div>
      <Toaster
        theme={resolvedTheme}
        position="bottom-center"
        toastOptions={{
          classNames: {
            toast: "!rounded-full !border-primary/30 !bg-primary !px-5 !py-3 !font-semibold !text-primary-foreground",
            error: "!border-bear/30 !bg-bear",
          },
        }}
      />
    </div>
  );
}
