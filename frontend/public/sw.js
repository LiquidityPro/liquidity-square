// Makes Liquidity Square installable, and shows notification pop-ups.
// This worker does not cache anything, so posts and auth stay on the network.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = typeof data.title === "string" && data.title ? data.title : "Liquidity Square";
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    // Android status-bar icons are a 96px alpha mask. The color logo is the large icon.
    icon: new URL("/icons/icon-192.png", self.location.origin).href,
    badge: new URL("/icons/badge-96.png", self.location.origin).href,
    tag: typeof data.id === "string" ? data.id : "liquidity-square",
    data: { url: typeof data.url === "string" ? data.url : "/square/notifications", id: data.id, title, body: data.body },
  };

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const visible = windows.filter((client) => client.visibilityState === "visible");
      if (visible.length > 0) {
        for (const client of visible) {
          client.postMessage({ type: "push", id: options.data.id, title, body: options.body, url: options.data.url });
        }
        return;
      }
      await self.registration.showNotification(title, options);
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url || "/square/notifications";
  const target = new URL(path, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (!("focus" in client)) continue;
        await client.focus();
        if ("navigate" in client && typeof client.navigate === "function") {
          await client.navigate(target);
        }
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
