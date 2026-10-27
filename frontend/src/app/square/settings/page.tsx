"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LuBookmark as Bookmark,
  LuChevronRight as ChevronRight,
  LuCompass as Compass,
  LuLock as Lock,
  LuMail as Mail,
  LuShield as Shield,
  LuBadgeCheck as BadgeCheck,
  LuUser as User,
  LuUsers as Users,
  LuList as List,
} from "react-icons/lu";
import type { IconType } from "react-icons";
import { PageHeader, ThemeToggle } from "@/components/square/parts";
import { requestSquareTour } from "@/components/square/square-tour";
import { useCurrentAuthor } from "@/components/square/use-current-author";

const LINKS: { href: string; label: string; icon: IconType; hint: string }[] = [
  { href: "/square/settings/safety", label: "Muted and blocked", icon: Shield, hint: "People you've quieted" },
  { href: "/square/messages", label: "Messages", icon: Mail, hint: "Direct messages" },
  { href: "/square/rooms", label: "Pro rooms", icon: Lock, hint: "Analyst desks" },
  { href: "/square/lists", label: "Lists", icon: List, hint: "Curated voices" },
  { href: "/square/communities", label: "Communities", icon: Users, hint: "Desks you can join" },
  { href: "/square/bookmarks", label: "Bookmarks", icon: Bookmark, hint: "Posts you saved" },
];

export default function SettingsPage() {
  const router = useRouter();
  const me = useCurrentAuthor();
  const profileHref = me.id ? `/square/u/${me.id}?edit=1` : "/square";

  return (
    <>
      <PageHeader title="Settings" subtitle={`@${me.handle}`} back />
      <section className="border-b">
        <h2 className="px-4 pt-4 text-sm font-bold text-muted-foreground">Account</h2>
        <Link href={profileHref} className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-card/60">
          <User className="size-5" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Edit profile</span>
            <span className="block truncate text-sm text-muted-foreground">Name, username, title, bio, photo</span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </Link>
        <Link href="/square/settings/badge" className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-card/60">
          <BadgeCheck className="size-5" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Professional badge</span>
            <span className="block truncate text-sm text-muted-foreground">Apply for a green badge. Gold is chosen by the desk.</span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </Link>
      </section>
      <section className="border-b px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Appearance</h2>
            <p className="text-sm text-muted-foreground">Switch the floor between day and night.</p>
          </div>
          <ThemeToggle />
        </div>
      </section>
      <section className="border-b">
        <button
          type="button"
          onClick={() => {
            requestSquareTour();
            router.push("/square?tour=1");
          }}
          className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-card/60"
        >
          <Compass className="size-5" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Take the tour</span>
            <span className="block text-sm text-muted-foreground">Walk through the floor again</span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </button>
      </section>
      <section>
        <h2 className="px-4 pt-4 text-sm font-bold text-muted-foreground">More</h2>
        <ul>
          {LINKS.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-card/60">
                <item.icon className="size-5" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{item.label}</span>
                  <span className="block text-sm text-muted-foreground">{item.hint}</span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
