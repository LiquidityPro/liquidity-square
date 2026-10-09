"use client";

import { Bell, Feather, House, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileThemeToggle } from "./navigation";

/* Mobile bottom bar + floating compose                                */
/* ------------------------------------------------------------------ */

export function MobileBar({ onCompose }: { onCompose: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onCompose}
        aria-label="Write a post"
        className="fixed bottom-20 right-4 z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_30px_-6px_var(--primary)] transition active:scale-[0.96] sm:hidden"
      >
        <Feather className="size-6" />
      </button>
      <nav
        aria-label="Square navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t bg-background/65 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl backdrop-saturate-150 sm:hidden"
      >
        {[House, Search, Bell, User].map((Icon, i) => (
          <button
            key={i}
            type="button"
            aria-label={["Home", "Search", "Notifications", "Profile"][i]}
            className="grid min-h-14 flex-1 place-items-center transition active:scale-[0.96]"
          >
            <Icon className={cn("size-6", i === 0 ? "text-primary" : "text-foreground/80")} />
          </button>
        ))}
        <MobileThemeToggle />
      </nav>
    </>
  );
}

