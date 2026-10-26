"use client";

import { useEffect, useRef, useState } from "react";
import type { IconType } from "react-icons";
import { LuShare as Share, LuSquarePlus as Plus } from "react-icons/lu";
import { cn } from "@/lib/utils";
import { SQUARE_TOUR_IDLE } from "@/components/square/square-tour";
import { runInstallPrompt, useInstallState } from "./install-button";

const STORAGE_KEY = "lq-home-tour-v2";

type Kind = "iphone-safari" | "ipad-safari" | "ios-other" | "mac-safari" | "mac-other";

type Step = {
  id: string;
  title: string;
  body: string;
  icon?: IconType;
  /** Offer the browser's own install button on this step. */
  install?: boolean;
};

function installedAlready() {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  if (standalone) return true;
  try {
    return localStorage.getItem("lq-app-installed") === "1";
  } catch {
    return false;
  }
}

function tourDone() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

function rememberTour() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* private mode */
  }
}

/** iPhone, iPad, and Mac only. iPadOS reports itself as a Mac, so touch is checked too. */
function detectApple(): Kind | null {
  const ua = navigator.userAgent;
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const iPhone = /iphone|ipod/i.test(ua);
  const iPad = /ipad/i.test(ua) || iPadOs;
  const mac = /Macintosh|Mac OS X/i.test(ua) && !iPadOs;
  if (!iPhone && !iPad && !mac) return null;

  const inApp = /Instagram|FBAN|FBAV|FB_IAB|Twitter|TikTok|Snapchat|Line\/|LinkedInApp|MicroMessenger/i.test(ua);
  const otherIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua);
  const safari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Edg\//i.test(ua);

  if (iPhone || iPad) {
    if (safari && !inApp && !otherIosBrowser) return iPad ? "ipad-safari" : "iphone-safari";
    return "ios-other";
  }
  if (safari && !inApp) return "mac-safari";
  return "mac-other";
}

function stepsFor(kind: Kind, canInstall: boolean): Step[] {
  if (kind === "iphone-safari" || kind === "ipad-safari") {
    const share =
      kind === "ipad-safari"
        ? "The square with an arrow, in the toolbar at the top of Safari."
        : "The square with an arrow, along the bottom of Safari.";
    return [
      {
        id: "welcome",
        title: "Add The Square to your home screen",
        body: "It opens full screen, like an app. Alerts for replies and price moves show up from the icon.",
        icon: Plus,
      },
      { id: "share", title: "Tap Share", body: share, icon: Share },
      {
        id: "add",
        title: "Tap Add to Home Screen",
        body: "Scroll the share sheet, tap Add to Home Screen, then tap Add. The icon lands on your home screen.",
        icon: Plus,
      },
    ];
  }
  if (kind === "ios-other") {
    return [
      {
        id: "safari",
        title: "Open this page in Safari",
        body: "This browser can't add a home screen icon. Copy the address into Safari.",
        icon: Share,
      },
      {
        id: "add",
        title: "Then add it",
        body: "In Safari, tap Share, then Add to Home Screen, then Add.",
        icon: Plus,
      },
    ];
  }
  if (kind === "mac-other" && canInstall) {
    return [
      {
        id: "install",
        title: "Add The Square to your Dock",
        body: "Install it and it opens like an app, from the Dock.",
        icon: Plus,
        install: true,
      },
    ];
  }
  if (kind === "mac-safari") {
    return [
      {
        id: "welcome",
        title: "Add The Square to your Dock",
        body: "It opens like an app, from the Dock, with room for alerts.",
        icon: Plus,
      },
      {
        id: "file",
        title: "Open the File menu",
        body: "It's in the menu bar at the top of the screen, next to Safari.",
      },
      {
        id: "add",
        title: "Choose Add to Dock",
        body: "Click Add. If you don't see that item, use the Share button in the toolbar and choose Add to Dock.",
        icon: Share,
      },
    ];
  }
  return [
    {
      id: "menu",
      title: "Add The Square to your Dock",
      body: "Open the browser menu and choose Install Liquidity Square. In Safari, use File, then Add to Dock.",
      icon: Plus,
    },
  ];
}

function floorTourOpen() {
  return document.getElementById("square-tour-title") != null;
}

export function InstallTour({ ready }: { ready: boolean }) {
  const install = useInstallState();
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const shown = useRef(false);

  const finish = () => {
    rememberTour();
    setOpen(false);
  };

  const next = () => {
    if (index >= steps.length - 1) {
      finish();
      return;
    }
    setIndex(index + 1);
  };

  const back = () => setIndex((current) => Math.max(0, current - 1));

  useEffect(() => {
    if (!ready) return;
    const offer = () => {
      if (shown.current || tourDone() || installedAlready() || floorTourOpen()) return;
      const kind = detectApple();
      if (!kind) return;
      shown.current = true;
      setSteps(stepsFor(kind, install.prompt !== null));
      setIndex(0);
      setOpen(true);
    };
    window.addEventListener(SQUARE_TOUR_IDLE, offer);
    return () => window.removeEventListener(SQUARE_TOUR_IDLE, offer);
  }, [ready, install.prompt]);

  useEffect(() => {
    if (!open) return;
    const shell = document.getElementById("square-shell");
    shell?.setAttribute("inert", "");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    cardRef.current?.focus({ preventScroll: true });
    return () => {
      shell?.removeAttribute("inert");
      window.removeEventListener("keydown", onKey);
    };
  }, [open, index]);

  if (!open || steps.length === 0) return null;
  const step = steps[index];
  if (!step) return null;
  const last = index === steps.length - 1;
  const Icon = step.icon;

  async function installNow() {
    const outcome = await runInstallPrompt();
    if (outcome === "accepted") finish();
  }

  return (
    <>
      <div className="fixed inset-0 z-[110] bg-black/72" aria-hidden="true" />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-tour-title"
        aria-describedby="home-tour-body"
        tabIndex={-1}
        className="fixed left-1/2 top-1/2 z-[120] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-5 text-card-foreground shadow-2xl outline-none"
      >
        {Icon && (
          <div className="mb-3 grid size-11 place-items-center rounded-full bg-primary/15 text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </div>
        )}
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.14em] text-primary">
          {index + 1} of {steps.length}
        </p>
        <h2 id="home-tour-title" className="mt-1 text-lg font-bold">
          {step.title}
        </h2>
        <p id="home-tour-body" className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {step.body}
        </p>
        <div className="mt-4 flex gap-1.5" aria-hidden="true">
          {steps.map((item, itemIndex) => (
            <span
              key={item.id}
              className={cn("h-1.5 rounded-full", itemIndex === index ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30")}
            />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          {last && !step.install ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={finish}
              className="min-h-11 rounded-full px-2 text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {step.install ? "Not now" : "Skip"}
            </button>
          )}
          <div className="flex gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={back}
                className="min-h-11 rounded-full border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Back
              </button>
            )}
            {step.install ? (
              <button
                type="button"
                onClick={() => void installNow()}
                className="min-h-11 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                Install
              </button>
            ) : (
              <button
                type="button"
                onClick={next}
                className="min-h-11 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                {last ? "Done" : "Next"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
