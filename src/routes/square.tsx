import { useRef } from "react";
import { createFileRoute, Outlet, useRouter, useParams } from "@tanstack/react-router";
import { LeftNav, MobileBar, RightRail, TickerTape } from "@/components/square/parts";
import { SquareProvider, useSquare } from "@/components/square/context";

const TITLE = "The Square — Liquidity Pro (preview)";
const DESC = "A preview of The Square: the social feed where Nigerian investors debate NGX stocks, follow verified voices and read live sentiment.";

export const Route = createFileRoute("/square")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SquareLayout,
});

function SquareLayout() {
  return (
    <SquareProvider>
      <SquareInner />
    </SquareProvider>
  );
}

function SquareInner() {
  const { following, toggleFollow } = useSquare();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const params = useParams({ strict: false }) as Record<string, string | undefined>;
  const activeTicker = params.ticker;

  function focusComposer() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (router.state.location.pathname === "/square") {
      setTimeout(() => {
        const composer = document.querySelector('textarea') as HTMLTextAreaElement | null;
        composer?.focus();
      }, 100);
    } else {
      router.navigate({ to: "/square" });
    }
  }

  function handleTickerNav(ticker: string) {
    router.navigate({ to: "/square/$ticker", params: { ticker } });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TickerTape />
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 justify-center">
        <LeftNav onCompose={focusComposer} />

        <main className="min-h-screen w-full max-w-[600px] border-x pb-24 sm:pb-0">
          <Outlet />
        </main>

        <RightRail onTicker={handleTickerNav} following={following} onToggleFollow={toggleFollow} activeTicker={activeTicker} />
        <MobileBar onCompose={focusComposer} />
      </div>
    </div>
  );
}
