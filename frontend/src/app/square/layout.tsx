"use client";
import { useRouter, useParams, usePathname } from "next/navigation";
import { LeftNav, MobileBar, RightRail, TickerTape } from "@/components/square/parts";
import { SquareProvider, useSquare } from "@/components/square/context";
import { InlineError } from "@/components/square/page-chrome";
import { Toaster } from "@/components/ui/sonner";
import { useTheme } from "@/components/theme-provider";

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
      <TickerTape />
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 justify-center">
        <LeftNav onCompose={focusComposer} />

        <main className="min-h-screen w-full max-w-[600px] border-x pb-24 sm:pb-0">
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
