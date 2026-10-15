"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSquare } from "@/components/square/context";
import {
  canUsePush,
  claimToast,
  dismissPushPrompt,
  enablePush,
  isIosBrowser,
  pushDismissed,
  subscribeToPush,
} from "./push";

type PushMessage = { type: "push"; id?: string; title?: string; body?: string; url?: string };

export function PushPrompt() {
  const { token } = useSquare();
  const router = useRouter();
  const pathname = usePathname();
  const persistent = pathname.startsWith("/square/notifications");
  const [visible, setVisible] = useState(false);
  const [iosOnly, setIosOnly] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    const ios = isIosBrowser();
    setIosOnly(ios);
    if (ios || !canUsePush()) {
      setVisible(ios && (persistent || !pushDismissed()));
      return;
    }
    if (Notification.permission === "granted") {
      subscribeToPush(token)
        .then(() => setVisible(false))
        .catch((err) => {
          console.error("Push subscription failed", err);
          setVisible(persistent || !pushDismissed());
        });
      return;
    }
    setVisible(Notification.permission === "default" && (persistent || !pushDismissed()));
  }, [token, persistent]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent<PushMessage>) => {
      const data = event.data;
      if (!data || data.type !== "push" || !data.title) return;
      if (data.id && !claimToast(data.id)) return;
      toast(data.title, {
        description: data.body || undefined,
        duration: 8000,
        action: data.url
          ? {
              label: "View",
              onClick: () => {
                if (/^https:\/\/([a-z0-9-]+\.)*ngxgroup\.com\//i.test(data.url!)) {
                  window.open(data.url, "_blank", "noopener,noreferrer");
                  return;
                }
                router.push(data.url!);
              },
            }
          : undefined,
      });
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  if (!visible) return null;

  async function turnOn() {
    if (!token || busy) return;
    setBusy(true);
    try {
      const permission = await enablePush(token);
      if (permission === "granted") setVisible(false);
      else toast.error("Notifications stay off until you allow them in the browser.");
    } catch (err) {
      console.error("Enable notifications failed", err);
      toast.error("Couldn't turn on notifications on this device.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-3">
      <p className="min-w-0 flex-1 text-sm">
        {iosOnly
          ? "Add The Square to your Home Screen to get alerts on this iPhone."
          : "Get a pop-up on this phone or computer when someone likes, replies, or follows you."}
      </p>
      {!iosOnly && (
        <button
          type="button"
          onClick={() => void turnOn()}
          disabled={busy}
          className="rounded-full bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Turning on…" : "Enable"}
        </button>
      )}
      {!persistent && (
        <button
          type="button"
          onClick={() => {
            dismissPushPrompt();
            setVisible(false);
          }}
          className="rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground transition hover:bg-card"
        >
          Not now
        </button>
      )}
    </div>
  );
}
