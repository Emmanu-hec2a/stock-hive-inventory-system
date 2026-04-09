export function supportsAppBadge() {
  return typeof navigator !== "undefined" && ("setAppBadge" in navigator || "clearAppBadge" in navigator);
}

export async function setNativeAppBadge(count) {
  if (!supportsAppBadge()) return;

  try {
    if (count > 0 && "setAppBadge" in navigator) {
      await navigator.setAppBadge(count);
      return;
    }

    if ("clearAppBadge" in navigator) {
      await navigator.clearAppBadge();
    }
  } catch (error) {
    // App badges are a progressive enhancement, so we silently ignore unsupported calls.
  }
}

export async function clearNativeAppBadge() {
  if (typeof navigator === "undefined" || !("clearAppBadge" in navigator)) return;

  try {
    await navigator.clearAppBadge();
  } catch (error) {
    // Ignore badge-clear failures for unsupported browsers and partial implementations.
  }
}
