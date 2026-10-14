"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LuFeather as Feather,
  LuEllipsis as More,
  LuLock as Lock,
  LuLogOut as LogOut,
  LuSearch as Search,
} from "react-icons/lu";
import { cn } from "@/lib/utils";
import { signOutSession } from "@/lib/session";
import { NavBadge, navItemActive, ThemeToggle, useNavItems } from "./navigation";
import { Avatar } from "./avatar";
import { useCurrentAuthor } from "./use-current-author";
import { InstallAppButton } from "@/components/pwa/install-button";

/* Mobile bottom bar + floating compose                                */
/* ------------------------------------------------------------------ */

const MOBILE_LABELS = ["Home", "Explore", "Notifications", "Bookmarks", "Profile"];

export function MobileBar({ onCompose }: { onCompose: () => void }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const me = useCurrentAuthor();
  const items = useNavItems().filter((item) => MOBILE_LABELS.includes(item.label));

  useEffect(() => {
    if (!moreOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !moreMenuRef.current?.contains(target) &&
        !moreButtonRef.current?.contains(target)
      ) {
        setMoreOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
        moreButtonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [moreOpen]);

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
      {moreOpen && (
        <div
          ref={moreMenuRef}
          id="mobile-more-menu"
          aria-label="More navigation and account options"
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-3 z-50 w-64 max-w-[calc(100vw-1.5rem)] rounded-2xl border bg-card p-3 shadow-xl sm:hidden"
        >
          <div className="mb-3 flex items-center gap-3 border-b pb-3">
            <Avatar author={me} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{me.name}</p>
              <p className="truncate text-xs text-muted-foreground">@{me.handle}</p>
            </div>
          </div>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm text-muted-foreground"
          >
            <Lock className="size-5" aria-hidden="true" />
            <span className="flex-1">Pro rooms</span>
            <span className="label-mono rounded border border-primary/40 px-1.5 text-[0.6rem] text-primary">
              Soon
            </span>
          </button>
          <InstallAppButton variant="menu" />
          <div className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-2">
            <span className="text-sm">Appearance</span>
            <ThemeToggle />
          </div>
          <button
            type="button"
            onClick={() => void signOutSession()}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="size-5" aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
      <nav
        aria-label="Square navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/65 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl backdrop-saturate-150 sm:hidden"
      >
        {items.map((item) => {
          const active = navItemActive(item, pathname);
          const Icon = item.label === "Explore" ? Search : item.icon;
          return (
            <Link
              key={item.label}
              href={item.href ?? "/square"}
              aria-label={item.label}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className="relative grid min-h-14 min-w-0 flex-1 place-items-center transition active:scale-[0.96]"
            >
              <Icon className={cn("size-6", active ? "text-primary" : "text-foreground/80")} strokeWidth={active ? 2.5 : 2} />
              <NavBadge count={item.badge} className="left-1/2 top-2 ml-1" />
            </Link>
          );
        })}
        <button
          ref={moreButtonRef}
          type="button"
          aria-label="More options"
          aria-expanded={moreOpen}
          aria-controls="mobile-more-menu"
          onClick={() => setMoreOpen((open) => !open)}
          className="grid min-h-14 min-w-0 flex-1 place-items-center text-foreground/80 transition hover:text-foreground active:scale-[0.96]"
        >
          <More className="size-6" aria-hidden="true" />
        </button>
      </nav>
    </>
  );
}
