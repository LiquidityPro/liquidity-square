"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { signOut } from "next-auth/react";
import type { IconType } from "react-icons";
import {
  LuBell as Bell,
  LuBookmark as Bookmark,
  LuFeather as Feather,
  LuHash as Hash,
  LuHouse as House,
  LuLock as Lock,
  LuLogOut as LogOut,
  LuMoon as Moon,
  LuSun as Sun,
  LuUser as User,
} from "react-icons/lu";
import { Logo } from "@/components/site";
import { Avatar } from "./avatar";
import { cn } from "@/lib/utils";
import { useSquare } from "./context";
import { useCurrentAuthor } from "./use-current-author";

/* Left navigation                                                     */
/* ------------------------------------------------------------------ */

export type NavItem = {
  icon: IconType;
  label: string;
  href?: string;
  isActive?: (pathname: string) => boolean;
  badge?: number;
  soon?: boolean;
};

const isProfilePath = (pathname: string, href?: string) => !!href && pathname === href;

/** Ticker rooms and post threads live under /square too, so they count as Home. */
function isHomePath(pathname: string) {
  return !/^\/square\/(explore|notifications|bookmarks|u)(\/|$)/.test(pathname);
}

export function useNavItems(): NavItem[] {
  const me = useCurrentAuthor();
  const { unreadCount } = useSquare();
  const profileHref = me.id ? `/square/u/${me.id}` : undefined;

  return [
    { icon: House, label: "Home", href: "/square", isActive: isHomePath },
    { icon: Hash, label: "Explore", href: "/square/explore" },
    { icon: Bell, label: "Notifications", href: "/square/notifications", badge: unreadCount },
    { icon: Lock, label: "Pro rooms", soon: true },
    { icon: Bookmark, label: "Bookmarks", href: "/square/bookmarks" },
    {
      icon: User,
      label: "Profile",
      href: profileHref,
      isActive: (pathname) => isProfilePath(pathname, profileHref),
    },
  ];
}

export function navItemActive(item: NavItem, pathname: string) {
  if (!item.href) return false;
  return item.isActive ? item.isActive(pathname) : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function NavBadge({ count, className }: { count?: number; className?: string }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "absolute grid min-w-4 place-items-center rounded-full bg-primary px-1 font-mono text-[0.6rem] font-bold text-primary-foreground",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function LeftNav({ onCompose }: { onCompose: () => void }) {
  const me = useCurrentAuthor();
  const pathname = usePathname();
  const items = useNavItems();

  return (
    <aside className="sticky top-10 hidden h-[calc(100dvh-2.5rem)] min-h-[calc(100dvh-2.5rem)] w-[76px] shrink-0 flex-col justify-between px-2 py-3 sm:flex xl:w-[260px] xl:px-3">
      <div className="flex flex-col items-center gap-1 xl:items-stretch">
        <div className="mb-2 px-2 [&_span]:hidden xl:[&_span]:inline">
          <Logo />
        </div>
        <nav aria-label="Square navigation" className="flex flex-col items-center gap-1 xl:items-stretch">
          {items.map((item) => {
            const { icon: Icon, label, href, badge, soon } = item;
            const active = navItemActive(item, pathname);
            const className = cn(
              "relative flex min-h-12 items-center gap-4 rounded-full px-3 text-lg transition-colors hover:bg-card xl:pr-5",
              active ? "font-bold" : "text-foreground/85",
            );
            const content = (
              <>
                <Icon className={cn("size-6", active && "text-primary")} strokeWidth={active ? 2.5 : 2} />
                <span className="hidden xl:inline">{label}</span>
                {soon && (
                  <span className="label-mono hidden rounded border border-primary/40 px-1.5 !text-[0.6rem] text-primary xl:inline">
                    Soon
                  </span>
                )}
                <NavBadge count={badge} className="left-7 top-2" />
              </>
            );

            return href ? (
              <Link key={label} href={href} aria-current={active ? "page" : undefined} title={label} className={className}>
                {content}
              </Link>
            ) : (
              <button key={label} type="button" title={`${label} — coming soon`} className={className}>
                {content}
              </button>
            );
          })}
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
        <div className="flex items-center gap-2 rounded-full p-2 hover:bg-card">
          <Avatar author={me} />
          <div className="hidden min-w-0 flex-1 xl:block">
            <p className="truncate text-sm font-semibold">{me.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">@{me.handle}</p>
          </div>
          <ThemeToggle />
          <button
            type="button"
            title="Sign Out"
            onClick={() => signOut({ callbackUrl: "/auth" })}
            className="hidden rounded-full p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive xl:block"
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
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
