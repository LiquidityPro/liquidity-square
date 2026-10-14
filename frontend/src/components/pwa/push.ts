"use client";

import { fetchVapidPublicKey, savePushSubscription } from "@/components/square/api";

const DISMISS_KEY = "lq-push-dismissed";
const toasted = new Set<string>();

export function canUsePush() {
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function isIosBrowser() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone();
}

export function pushDismissed() {
  return localStorage.getItem(DISMISS_KEY) === "1";
}

export function dismissPushPrompt() {
  localStorage.setItem(DISMISS_KEY, "1");
}

/** Returns false when this notification was already shown. */
export function claimToast(id: string) {
  if (!id || toasted.has(id)) return false;
  toasted.add(id);
  return true;
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export async function enablePush(token: string) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;
  await subscribeToPush(token);
  return permission;
}

export async function subscribeToPush(token: string) {
  const registration = await navigator.serviceWorker.ready;
  const publicKey = await fetchVapidPublicKey(token);
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return;
  await savePushSubscription(token, {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
}
