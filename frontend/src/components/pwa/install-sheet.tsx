"use client";

import { useEffect, useState } from "react";
import { LuShare as Share, LuSquarePlus as SquarePlus } from "react-icons/lu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { runInstallPrompt, useInstallState } from "./install-button";

const DISMISS_KEY = "lq-install-dismissed-at";

function mondayStart(now = new Date()) {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  const sinceMonday = day.getDay() === 0 ? 6 : day.getDay() - 1;
  day.setDate(day.getDate() - sinceMonday);
  return day.getTime();
}

function nudgeDue() {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return true;
  const dismissedAt = Number(raw);
  return !Number.isFinite(dismissedAt) || dismissedAt < mondayStart();
}

function rememberDismiss() {
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
}

function isPhone() {
  return /iphone|ipad|ipod|android/i.test(navigator.userAgent);
}

/** Safari can add a home-screen app. Other iOS browsers and in-app webviews cannot. */
function openElsewhere(): "safari" | "chrome" | null {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua);
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|Twitter|TikTok|Snapchat|Line\/|LinkedInApp|MicroMessenger/i.test(ua);
  if (ios && (/CriOS|FxiOS|EdgiOS/i.test(ua) || inApp)) return "safari";
  if (/Android/i.test(ua) && (/; wv\)/.test(ua) || inApp)) return "chrome";
  return null;
}

export function InstallSheet() {
  const install = useInstallState();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [elsewhere, setElsewhere] = useState<"safari" | "chrome" | null>(null);
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    setReady(true);
    setElsewhere(openElsewhere());
    setPhone(isPhone());
  }, []);

  useEffect(() => {
    if (!ready || install.installed) {
      setOpen(false);
      return;
    }
    const blocked = openElsewhere();
    const canAsk = blocked !== null || install.ios || install.prompt !== null;
    const audience = phone || install.prompt !== null || blocked !== null;
    if (!canAsk || !audience || !nudgeDue()) return;
    setOpen(true);
  }, [ready, install.installed, install.ios, install.prompt, phone]);

  function close() {
    rememberDismiss();
    setOpen(false);
  }

  async function installNow() {
    const outcome = await runInstallPrompt();
    if (outcome === "accepted") {
      rememberDismiss();
      setOpen(false);
      return;
    }
  }

  const iosSteps = install.ios && !elsewhere;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add The Square to your home screen</DialogTitle>
          <DialogDescription>
            {elsewhere
              ? `Open this page in ${elsewhere === "safari" ? "Safari" : "Chrome"} to install it.`
              : "Alerts for replies, likes, and price moves show up properly from the installed app."}
          </DialogDescription>
        </DialogHeader>
        {iosSteps && (
          <ol className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <Share className="size-5 shrink-0" aria-hidden="true" />
              <span>Tap the Share button in Safari.</span>
            </li>
            <li className="flex items-center gap-3">
              <SquarePlus className="size-5 shrink-0" aria-hidden="true" />
              <span>Tap Add to Home Screen, then Add.</span>
            </li>
          </ol>
        )}
        <div className="flex flex-col gap-2">
          {install.prompt && !elsewhere && (
            <button
              type="button"
              onClick={() => void installNow()}
              className="min-h-10 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground"
            >
              Install app
            </button>
          )}
          <button type="button" onClick={close} className="min-h-10 rounded-full border px-4 text-sm font-semibold">
            Not now
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
