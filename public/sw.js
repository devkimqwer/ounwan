self.addEventListener("push", (event) => {
  const payload = readPushPayload(event);
  const title = payload.title || "오운완";
  const options = {
    body: payload.body || payload.message || "새 알림이 도착했어요.",
    icon: "/icons/app-icon-white-bg.png",
    badge: "/icons/app-icon-white-bg.png",
    data: {
      url: payload.url || "/",
      notificationId: payload.notificationId,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin);
  const notificationId = event.notification.data?.notificationId;

  if (notificationId && !targetUrl.searchParams.has("notificationId")) {
    targetUrl.searchParams.set("notificationId", notificationId);
  }

  event.waitUntil(openOrFocusClient(targetUrl.href));
});

function readPushPayload(event) {
  if (!event.data) {
    return {};
  }

  try {
    return event.data.json();
  } catch {
    return { body: event.data.text() };
  }
}

async function openOrFocusClient(targetUrl) {
  const windowClients = await clients.matchAll({ type: "window", includeUncontrolled: true });

  for (const client of windowClients) {
    if (client.url.startsWith(self.location.origin) && "focus" in client) {
      await client.focus();
      if ("navigate" in client) {
        return client.navigate(targetUrl);
      }
      return undefined;
    }
  }

  if (clients.openWindow) {
    return clients.openWindow(targetUrl);
  }

  return undefined;
}