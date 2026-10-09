"use client";

import { useTheme } from "@/components/theme-provider";
import { Bell, Bookmark, Ellipsis, Feather, Hash, House, Lock, Moon, Sun, User } from "lucide-react";
import { Logo } from "@/components/site";
import { Avatar } from "./avatar";
import { cn } from "@/lib/utils";
import { ME } from "./data";

/* Left navigation                                                     */
/* ------------------------------------------------------------------ */

const NAV = [
  { icon: House, label: "Home", active: true },
  { icon: Hash, label: "Explore" },
  { icon: Bell, label: "Notifications", badge: "3" },
  { icon: Lock, label: "Pro rooms", soon: true },
  { icon: Bookmark, label: "Bookmarks" },
  { icon: User, label: "Profile" },
];

export function LeftNav({ onCompose }: { onCompose: () => void }) {
  return (
    <aside className="sticky top-10 hidden h-[calc(100dvh-2.5rem)] min-h-[calc(100dvh-2.5rem)] w-[76px] shrink-0 flex-col justify-between px-2 py-3 sm:flex xl:w-[260px] xl:px-3">
      <div className="flex flex-col items-center gap-1 xl:items-stretch">
        <div className="mb-2 px-2 [&_span]:hidden xl:[&_span]:inline">
          <Logo />
        </div>
        <nav aria-label="Square navigation" className="flex flex-col items-center gap-1 xl:items-stretch">
          {NAV.map(({ icon: Icon, label, active, badge, soon }) => (
            <button
              key={label}
              type="button"
              aria-current={active ? "page" : undefined}
              title={active ? label : `${label} — coming soon`}
              className={cn(
                "relative flex min-h-12 items-center gap-4 rounded-full px-3 text-lg transition-colors hover:bg-card xl:pr-5",
                active ? "font-bold" : "text-foreground/85",
              )}
            >
              <Icon className={cn("size-6", active && "text-primary")} strokeWidth={active ? 2.5 : 2} />
              <span className="hidden xl:inline">{label}</span>
              {soon && (
                <span className="label-mono hidden rounded border border-primary/40 px-1.5 !text-[0.6rem] text-primary xl:inline">
                  Soon
                </span>
              )}
              {badge && (
                <span className="absolute left-7 top-2 grid min-w-4 place-items-center rounded-full bg-primary px-1 font-mono text-[0.6rem] font-bold text-primary-foreground">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={onCompose}
          className="mt-4 flex min-h-12 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground shadow-[0_0_30px_-8px_var(--primary)] transition hover:opacity-90 active:scale-[0.96] max-xl:size-12 xl:text-lg"
        >
          <Feather className="size-5 xl:hidden" aria-hidden="true" />
          <span className="hidden xl:inline">Post</span>
          <span className="sr-only xl:hidden">Post</span>
        </button>
      </div>

      <div className="mt-auto mb-2 space-y-2">
        <div className="flex items-center gap-3 rounded-full p-2 hover:bg-card">
          <Avatar author={ME} />
          <div className="hidden min-w-0 flex-1 xl:block">
            <p className="truncate text-sm font-semibold">{ME.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">@{ME.handle}</p>
          </div>
          <ThemeToggle />
          <Ellipsis className="hidden size-4 text-muted-foreground xl:block" aria-hidden="true" />
        </div>
      </div>
    </aside>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle color theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative inline-flex h-8 w-[4.5rem] shrink-0 items-center rounded-full bg-secondary p-1 text-secondary-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-2 top-1 size-6 rounded-full bg-primary transition-transform duration-200",
          isDark && "translate-x-8",
        )}
      />
      <Sun
        className={cn("z-10 size-4 flex-1", !isDark && "text-primary-foreground")}
        aria-hidden="true"
      />
      <Moon
        className={cn("z-10 size-4 flex-1", isDark && "text-primary-foreground")}
        aria-hidden="true"
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */

export function MobileThemeToggle() {
  return (
    <div className="grid min-h-14 flex-1 place-items-center">
      <ThemeToggle />
    </div>
  );
}
