"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { LuDownload as Download } from "react-icons/lu";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const INSTALLED_KEY = "lq-app-installed";

type InstallState = {
  prompt: BeforeInstallPromptEvent | null;
  installed: boolean;
  ios: boolean;
};

function rememberInstalled() {
  try {
    localStorage.setItem(INSTALLED_KEY, "1");
  } catch {
    // Private mode can block storage. The standalone check still applies this visit.
  }
}

function rememberedInstalled() {
  try {
    return localStorage.getItem(INSTALLED_KEY) === "1";
  } catch {
    return false;
  }
}

let state: InstallState = { prompt: null, installed: false, ios: false };
const listeners = new Set<() => void>();
let listening = false;

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  ensureListening();
  return () => listeners.delete(listener);
}

function ensureListening() {
  if (listening || typeof window === "undefined") return;
  listening = true;

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (standalone) rememberInstalled();
  state = { ...state, installed: standalone || rememberedInstalled(), ios: ios && !standalone };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    if (state.installed) return;
    state = { ...state, prompt: event as BeforeInstallPromptEvent };
    emit();
  });
  window.addEventListener("appinstalled", () => {
    rememberInstalled();
    state = { ...state, prompt: null, installed: true };
    emit();
  });

  const related = navigator as Navigator & {
    getInstalledRelatedApps?: () => Promise<{ platform: string }[]>;
  };
  if (typeof related.getInstalledRelatedApps === "function") {
    related
      .getInstalledRelatedApps()
      .then((apps) => {
        const installed = apps.some((app) => app.platform === "webapp");
        if (installed) rememberInstalled();
        else if (!standalone) localStorage.removeItem(INSTALLED_KEY);
        const hasApp = installed || standalone;
        state = { ...state, installed: hasApp, prompt: hasApp ? null : state.prompt };
        emit();
      })
      .catch(() => undefined);
  }
}

function getSnapshot() {
  return state;
}

const SERVER_SNAPSHOT: InstallState = { prompt: null, installed: false, ios: false };

export function useInstallState() {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
}

export async function runInstallPrompt() {
  const prompt = state.prompt;
  if (!prompt) return "unavailable" as const;
  state = { ...state, prompt: null };
  emit();
  await prompt.prompt();
  const choice = await prompt.userChoice;
  return choice.outcome;
}

export function InstallAppButton({ variant = "nav" }: { variant?: "nav" | "menu" | "quiet" }) {
  const installState = useInstallState();
  const [hint, setHint] = useState(false);
  const visible = !installState.installed && (installState.prompt !== null || installState.ios);

  useEffect(() => {
    if (!visible) setHint(false);
  }, [visible]);

  if (!visible) return null;

  async function onClick() {
    const prompt = installState.prompt;
    if (!prompt) {
      setHint((open) => !open);
      return;
    }
    state = { ...state, prompt: null };
    emit();
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch (err) {
      console.error("Install prompt failed", err);
    }
  }

  const label = "Install app";

  return (
    <div className={cn(variant === "quiet" && "mt-6 text-center")}>
      <button
        type="button"
        onClick={() => void onClick()}
        aria-expanded={installState.ios ? hint : undefined}
        title={installState.ios ? "Share, then Add to Home Screen" : "Install Liquidity Square"}
        className={cn(
          variant === "nav" &&
            "flex min-h-12 items-center gap-4 rounded-full px-3 text-lg text-foreground/85 transition-colors hover:bg-card xl:pr-5",
          variant === "menu" &&
            "flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm transition-colors hover:bg-secondary",
          variant === "quiet" &&
            "text-sm font-medium text-[#0F5A3D] hover:underline os-dark:text-[#D4FF5A]",
        )}
      >
        {variant !== "quiet" && <Download className={cn(variant === "nav" ? "size-6" : "size-5")} aria-hidden="true" />}
        <span className={cn(variant === "nav" && "hidden xl:inline")}>{label}</span>
        {variant === "nav" && <span className="sr-only xl:hidden">{label}</span>}
      </button>
      {hint && (
        <p
          className={cn(
            "px-2 pt-1 text-xs leading-snug",
            variant === "quiet" ? "text-[#5C6B64] os-dark:text-[#A9B8B0]" : "text-muted-foreground",
            variant === "nav" && "hidden px-3 xl:block",
          )}
        >
          Open the Share menu, then tap Add to Home Screen.
        </p>
      )}
    </div>
  );
}
