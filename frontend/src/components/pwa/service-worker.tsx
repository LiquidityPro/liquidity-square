"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // A worker that controls localhost also controls the dev server's hot-reload
    // socket. That drops the page into a reload loop and aborts /api/auth/session.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) void registration.unregister();
      }).catch((err) => {
        console.error("Service worker unregister failed", err);
      });
      return;
    }

    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((err) => {
      console.error("Service worker registration failed", err);
    });
  }, []);

  return null;
}
