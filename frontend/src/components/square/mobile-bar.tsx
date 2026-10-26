"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LuFeather as Feather, LuSearch as Search } from "react-icons/lu";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";
import { NavBadge, navItemActive, useNavItems } from "./navigation";
import { useCurrentAuthor } from "./use-current-author";

/* Mobile bottom bar + floating compose                                */
/* ------------------------------------------------------------------ */

const MOBILE_LABELS = ["Home", "Explore", "Notifications", "Bookmarks", "Messages", "Profile"];

export function MobileBar({ onCompose }: { onCompose: () => void }) {
  const pathname = usePathname();
  const me = useCurrentAuthor();
  const navItems = useNavItems();
  const items = MOBILE_LABELS.flatMap((label) => navItems.filter((item) => item.label === label));
  const inThread = /^\/square\/(messages|post)\/.+/.test(pathname);

  return (
    <>
      {!inThread && (
        <button
          type="button"
          onClick={onCompose}
          aria-label="Write a post"
          className="fixed bottom-20 right-4 z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_30px_-6px_var(--primary)] transition active:scale-[0.96] sm:hidden"
        >
          <Feather className="size-6" />
        </button>
      )}
      <nav
        aria-label="Square navigation"
        data-tour="mobile-nav"
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
              {item.label === "Profile" ? (
                <Avatar
                  author={me}
                  className={cn(
                    "size-7 text-[0.65rem] ring-2 ring-offset-2 ring-offset-background",
                    active ? "ring-primary" : "ring-foreground/30",
                  )}
                />
              ) : (
                <Icon className={cn("size-6", active ? "text-primary" : "text-foreground/80")} strokeWidth={active ? 2.5 : 2} />
              )}
              <NavBadge count={item.badge} className="left-1/2 top-2 ml-1" />
            </Link>
          );
        })}
      </nav>
    </>
  );
}
