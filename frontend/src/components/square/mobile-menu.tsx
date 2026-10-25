"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { IconType } from "react-icons";
import {
  LuLogOut as LogOut,
  LuMenu as Menu,
  LuMessageCircle as MessageCircle,
  LuSearch as Search,
} from "react-icons/lu";
import { InstallAppButton } from "@/components/pwa/install-button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { signOutSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { fetchProfile } from "./api";
import { Avatar } from "./avatar";
import { useSquare } from "./context";
import { compact } from "./data";
import { NavBadge, navItemActive, ThemeToggle, useMoreItems, useNavItems, type NavItem } from "./navigation";
import { useCurrentAuthor } from "./use-current-author";

/* Mobile account drawer                                                */
/* ------------------------------------------------------------------ */

const MENU_ORDER = [
  "Explore",
  "Home",
  "Messages",
  "Notifications",
  "Lists",
  "Bookmarks",
  "Pro rooms",
  "Drafts",
  "Communities",
  "Profile",
  "Settings",
];

function menuIcon(item: NavItem): IconType {
  if (item.label === "Explore") return Search;
  if (item.label === "Messages") return MessageCircle;
  return item.icon;
}

export function MobileMenuButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const me = useCurrentAuthor();
  const { token } = useSquare();
  const items = useNavItems();
  const moreItems = useMoreItems();
  const [stats, setStats] = useState<{ followers: number; following: number } | null>(null);
  const [statsFailed, setStatsFailed] = useState(false);

  const profileHref = me.id ? `/square/u/${me.id}` : undefined;
  const menu = MENU_ORDER.flatMap((label) => [...items, ...moreItems].filter((item) => item.label === label));

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open || !token || !me.id) return;
    let cancelled = false;
    fetchProfile(token, me.id)
      .then((profile) => {
        if (!cancelled) setStats({ followers: profile.followers, following: profile.following });
      })
      .catch((err) => {
        console.error("Failed to load profile counts", err);
        if (!cancelled) setStatsFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token, me.id]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-account-menu"
        onClick={() => setOpen(true)}
        className="grid size-11 place-items-center rounded-full text-foreground transition hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
      >
        <Menu className="size-6" aria-hidden="true" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          id="mobile-account-menu"
          side="left"
          overlayClassName="bg-black/50"
          className="flex h-dvh w-[min(88vw,22.5rem)] max-w-none flex-col gap-0 border-r bg-background p-0 shadow-2xl data-[state=closed]:duration-200 data-[state=open]:duration-300 sm:max-w-none [&>button]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription>Your account and navigation.</SheetDescription>
          </SheetHeader>

          <div className="px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
            {profileHref ? (
              <Link href={profileHref} onClick={() => setOpen(false)} className="block w-fit rounded-2xl">
                <ProfileIdentity />
              </Link>
            ) : (
              <ProfileIdentity />
            )}
            {stats ? (
              <p className="mt-3 text-sm text-muted-foreground">
                <StatLink
                  href={me.id ? `/square/u/${me.id}/followers` : undefined}
                  count={stats.followers}
                  label={stats.followers === 1 ? "follower" : "followers"}
                  onNavigate={() => setOpen(false)}
                />
                <span aria-hidden="true"> · </span>
                <StatLink
                  href={me.id ? `/square/u/${me.id}/following` : undefined}
                  count={stats.following}
                  label="following"
                  onNavigate={() => setOpen(false)}
                />
              </p>
            ) : (
              !statsFailed &&
              token && (
                <p className="mt-3" aria-hidden="true">
                  <span className="inline-block h-4 w-36 animate-pulse rounded bg-muted" />
                </p>
              )
            )}
          </div>

          <nav aria-label="Account menu" className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {menu.map((item) => {
              const active = navItemActive(item, pathname);
              const Icon = menuIcon(item);
              const className = cn(
                "relative flex min-h-12 w-full items-center gap-4 rounded-xl px-3 text-lg transition-colors hover:bg-card",
                active ? "font-bold" : "text-foreground/90",
              );
              const content = (
                <>
                  <Icon className={cn("size-6", active && "text-primary")} strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                  <span>{item.label}</span>
                  <NavBadge count={item.badge} className="left-7 top-2" />
                </>
              );
              return item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={className}
                >
                  {content}
                </Link>
              ) : (
                <span key={item.label} className={cn(className, "opacity-60")}>
                  {content}
                </span>
              );
            })}
          </nav>

          <div className="shrink-0 px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
            <div className="mx-1 border-t" />
            <div className="flex flex-col gap-2 px-3 py-4">
              <Link href="/terms" onClick={() => setOpen(false)} className="text-sm font-medium text-primary hover:underline">
                Terms of Service
              </Link>
              <Link href="/privacy" onClick={() => setOpen(false)} className="text-sm font-medium text-primary hover:underline">
                Privacy Policy
              </Link>
            </div>
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
        </SheetContent>
      </Sheet>
    </>
  );
}

function ProfileIdentity() {
  const me = useCurrentAuthor();
  return (
    <>
      <Avatar author={me} className="size-14 text-base" />
      <p className="mt-3 truncate text-lg font-bold leading-tight">{me.name}</p>
      <p className="truncate text-sm text-muted-foreground">@{me.handle}</p>
    </>
  );
}

function StatLink({
  href,
  count,
  label,
  onNavigate,
}: {
  href?: string;
  count: number;
  label: string;
  onNavigate: () => void;
}) {
  const body = (
    <>
      <span className="font-bold text-foreground">{compact(count)}</span> {label}
    </>
  );
  if (!href) return <span>{body}</span>;
  return (
    <Link href={href} onClick={onNavigate} className="hover:underline">
      {body}
    </Link>
  );
}
