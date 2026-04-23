import { useEffect, useState } from "react";

const IOS_DISMISS_KEY = "ios-install-banner-dismissed";

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export default function IOSInstallBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isIOS() || isStandaloneMode()) return;

    const isDismissed = localStorage.getItem(IOS_DISMISS_KEY);
    if (!isDismissed) {
      setIsVisible(true);
    }
  }, []);

  const dismissBanner = () => {
    localStorage.setItem(IOS_DISMISS_KEY, "1");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="pwa-sheet pwa-sheet-ios" role="dialog" aria-label="Install StočkHive on iPhone or iPad">
      <button type="button" className="pwa-sheet-close" onClick={dismissBanner} aria-label="Dismiss install instructions">
        x
      </button>
      <div className="pwa-sheet-copy">
        <p className="pwa-sheet-eyebrow">Install on iPhone</p>
        <h2 className="pwa-sheet-title">Add StočkHive to Home Screen</h2>
        <p className="pwa-sheet-text">
          In Safari, tap <strong>Share</strong> and then choose <strong>Add to Home Screen</strong>.
        </p>
      </div>
    </div>
  );
}
