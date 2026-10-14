"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { LuCamera as Camera, LuCheck as Check, LuChevronsUpDown as ChevronsUpDown } from "react-icons/lu";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { updateProfile } from "./api";
import { Avatar } from "./avatar";
import { useSquare } from "./context";
import type { Profile } from "./data";
import { cn } from "@/lib/utils";
import { FINANCE_TITLE_GROUPS, TITLE_LOCK_DAYS } from "./finance-titles";
import { suggestedTitles } from "./title-search";
import { BANNERS, bannerClass, type BannerId } from "./profile-meta";

const LIMITS = { name: 50, username: 20, bio: 160, location: 30, website: 100 };
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

function seedUsername(handle: string) {
  return handle.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, LIMITS.username);
}

export function EditProfileDialog({
  profile,
  open,
  onOpenChange,
  onSaved,
}: {
  profile: Profile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (profile: Profile) => void;
}) {
  const { token } = useSquare();
  const { update } = useSession();
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(seedUsername(profile.handle));
  const [title, setTitle] = useState(profile.title ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [website, setWebsite] = useState(profile.website ?? "");
  const [image, setImage] = useState<string | null>(profile.image ?? null);
  const [banner, setBanner] = useState<BannerId>((profile.banner as BannerId) || "ember");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (!open) {
      seeded.current = false;
      return;
    }
    if (seeded.current) return;
    seeded.current = true;
    setName(profile.name);
    setUsername(seedUsername(profile.handle));
    setTitle(profile.title ?? "");
    setBio(profile.bio ?? "");
    setLocation(profile.location ?? "");
    setWebsite(profile.website ?? "");
    setImage(profile.image ?? null);
    setBanner((profile.banner as BannerId) || "ember");
    setError(null);
  }, [open, profile]);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose a JPEG, PNG, or WebP photo.");
      return;
    }
    try {
      setImage(await squarePhoto(file));
      setError(null);
    } catch {
      setError("Couldn't read that photo. Try another image.");
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token || saving) return;
    const nextName = name.trim();
    const nextUsername = username.trim().toLowerCase();
    if (!nextName) {
      setError("Name can't be empty.");
      return;
    }
    if (!USERNAME_PATTERN.test(nextUsername)) {
      setError("Username must be 3–20 letters, numbers, or underscores.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await updateProfile(token, {
        name: nextName,
        username: nextUsername,
        title: title || null,
        bio: bio.trim(),
        location: location.trim(),
        website: website.trim(),
        image,
        banner,
      });
      await update({ name: saved.name, image: saved.image ?? null, username: saved.handle });
      onSaved(saved);
      onOpenChange(false);
      toast.success("Profile saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your profile");
    } finally {
      setSaving(false);
    }
  }

  const draft = { ...profile, name: name || profile.name, image, initials: profile.initials };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92dvh,760px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[600px] sm:rounded-2xl">
        <form id="edit-profile" onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3 pr-14">
            <DialogTitle className="flex-1 text-xl font-bold">Edit profile</DialogTitle>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-foreground px-4 py-1.5 text-sm font-bold text-background transition hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Saving" : "Save"}
            </button>
          </div>
          <DialogDescription className="sr-only">
            Update your name, username, title, bio, location, website, photo, and banner.
          </DialogDescription>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className={cn("relative h-32 sm:h-40", bannerClass(banner))}>
              <div className="absolute bottom-3 right-3 flex gap-1 rounded-full bg-background/80 p-1 backdrop-blur">
                {BANNERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`${item.label} banner`}
                    aria-pressed={banner === item.id}
                    onClick={() => setBanner(item.id)}
                    className={`size-6 rounded-full ring-offset-2 ring-offset-background ${item.className} ${banner === item.id ? "ring-2 ring-foreground" : ""}`}
                  />
                ))}
              </div>
            </div>

            <div className="px-4 pb-6">
              <div className="flex items-end justify-between">
                <div className="relative -mt-12 sm:-mt-14">
                  <div className="rounded-full ring-4 ring-background">
                    <Avatar author={draft} size="lg" />
                  </div>
                  <label className="absolute bottom-1 right-1 grid size-9 cursor-pointer place-items-center rounded-full bg-black/75 text-white transition hover:bg-black">
                    <Camera className="size-4" aria-hidden="true" />
                    <span className="sr-only">Upload photo</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(event) => {
                        void onPhoto(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {image && (
                  <button
                    type="button"
                    onClick={() => setImage(null)}
                    className="mb-2 text-sm font-semibold text-bear hover:underline"
                  >
                    Remove photo
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-4">
                <Field label="Name" value={name} max={LIMITS.name} onChange={setName} autoComplete="name" />
                <UsernameField value={username} onChange={setUsername} />
                <TitleField
                  value={title}
                  lockedUntil={profile.titleLockedUntil}
                  onChange={setTitle}
                />
                <Field label="Bio" value={bio} max={LIMITS.bio} onChange={setBio} multiline />
                <Field label="Location" value={location} max={LIMITS.location} onChange={setLocation} />
                <Field
                  label="Website"
                  value={website}
                  max={LIMITS.website}
                  onChange={setWebsite}
                  placeholder="yoursite.com"
                  inputMode="url"
                />
              </div>

              {error && (
                <p role="alert" className="mt-4 text-sm text-bear">
                  {error}
                </p>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UsernameField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="block rounded-lg border px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
      <span className="flex items-center justify-between font-mono text-xs text-muted-foreground">
        Username
        <span>
          {value.length}/{LIMITS.username}
        </span>
      </span>
      <span className="mt-1 flex items-center text-[15px]">
        <span className="text-muted-foreground">@</span>
        <input
          value={value}
          maxLength={LIMITS.username}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          onChange={(event) => onChange(seedUsername(event.target.value))}
          className="w-full bg-transparent outline-none"
        />
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">Letters, numbers, and underscores. This is saved on your account.</span>
    </label>
  );
}

function TitleField({
  value,
  lockedUntil,
  onChange,
}: {
  value: string;
  lockedUntil?: string | null;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const suggestions = useMemo(() => suggestedTitles(query), [query]);
  const locked = !!lockedUntil && new Date(lockedUntil).getTime() > Date.now();
  const unlocks = lockedUntil
    ? new Date(lockedUntil).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="font-mono text-xs text-muted-foreground">Title</p>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={locked}
        onClick={() =>
          setOpen((current) => {
            if (current) setQuery("");
            return !current;
          })
        }
        className="mt-1 flex w-full items-center justify-between gap-3 text-left text-[15px] disabled:cursor-not-allowed disabled:opacity-70"
      >
        <span className={value ? "" : "text-muted-foreground"}>{value || "Choose a finance title"}</span>
        {!locked && <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      </button>
      {open && !locked && (
        <Command shouldFilter={false} className="mt-2 rounded-md border">
          <CommandInput
            placeholder="Search titles"
            value={query}
            onValueChange={setQuery}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
          />
          <CommandList className="max-h-60">
            {query.trim() ? (
              suggestions.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No titles match that search.</p>
              ) : (
                <CommandGroup>
                  {suggestions.map((item) => (
                    <CommandItem
                      key={item.title}
                      value={item.title}
                      onSelect={() => {
                        onChange(item.title);
                        setQuery("");
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("size-4", value === item.title ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            ) : (
              FINANCE_TITLE_GROUPS.map((group) => (
                <CommandGroup key={group.label} heading={group.label}>
                  {group.titles.map((item) => (
                    <CommandItem
                      key={item}
                      value={item}
                      onSelect={() => {
                        onChange(item);
                        setQuery("");
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("size-4", value === item ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                      {item}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            )}
          </CommandList>
        </Command>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        {locked && unlocks
          ? `This title is locked until ${unlocks}. You can choose a different one after that.`
          : `Your title stays for ${TITLE_LOCK_DAYS} days after you save it. Pick carefully — you won't be able to change it until then.`}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  max,
  onChange,
  multiline,
  placeholder,
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  max: number;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "url";
}) {
  const shared = {
    value,
    maxLength: max,
    placeholder,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
    className: "mt-1 w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-muted-foreground",
  };
  return (
    <label className="block rounded-lg border px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
      <span className="flex items-center justify-between font-mono text-xs text-muted-foreground">
        {label}
        <span>
          {value.length}/{max}
        </span>
      </span>
      {multiline ? <textarea {...shared} rows={3} /> : <input {...shared} autoComplete={autoComplete} inputMode={inputMode} />}
    </label>
  );
}

function squarePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      const scale = Math.max(size / img.width, size / img.height);
      const width = img.width * scale;
      const height = img.height * scale;
      ctx.drawImage(img, (size - width) / 2, (size - height) / 2, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}
