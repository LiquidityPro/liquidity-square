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
import { InstallTour } from "@/components/pwa/install-tour";
import { SquareSplash } from "@/components/square/splash";
import { SquareTour } from "@/components/square/square-tour";

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
  const lockedColumn = /^\/square\/(messages|post)\/.+/.test(pathname);
  const [railOpen, setRailOpen] = useState(false);
  const [floorReady, setFloorReady] = useState(false);

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
    <>
    <div id="square-shell" className={lockedColumn ? "flex h-dvh flex-col overflow-hidden" : "flex min-h-screen flex-col"}>
      <SquareSplash onDone={() => setFloorReady(true)} />
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
      <div className={`mx-auto flex w-full max-w-[1280px] flex-1 justify-center ${lockedColumn ? "min-h-0" : ""}`}>
        <LeftNav onCompose={focusComposer} />

        <main
          className={
            lockedColumn
              ? "flex h-full min-h-0 w-full max-w-[600px] flex-col overflow-hidden border-x pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:pb-0"
              : "min-h-screen w-full max-w-[600px] border-x pb-24 sm:pb-0"
          }
        >
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
            toast:
              "!w-[min(100vw-2rem,24rem)] !items-center !gap-3 !rounded-2xl !border !border-primary/40 !bg-primary !px-4 !py-3 !text-left !text-sm !text-primary-foreground",
            content: "!min-w-0 !flex-1",
            title: "!font-semibold !leading-snug !text-inherit",
            description: "!mt-0.5 !font-normal !leading-snug !text-inherit !opacity-80",
            actionButton:
              "!h-auto !shrink-0 !rounded-full !bg-primary-foreground !px-3 !py-1.5 !text-sm !font-semibold !text-primary",
            error: "!border-destructive/40 !bg-destructive !text-destructive-foreground",
          },
        }}
      />
    </div>
    <SquareTour ready={floorReady} />
    <InstallTour ready={floorReady} />
    </>
  );
}
