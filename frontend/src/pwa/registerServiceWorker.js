import { Workbox } from "workbox-window";

export function registerServiceWorker() {
  if (import.meta.env.DEV || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    const workbox = new Workbox("/sw.js");

    workbox.addEventListener("waiting", () => {
      workbox.messageSkipWaiting();
    });

    workbox.addEventListener("controlling", () => {
      window.location.reload();
    });

    workbox.register().catch(() => {
      // Service worker registration should fail quietly in unsupported environments.
    });
  });
}
