import { useEffect, useState } from "react";

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isStandaloneMode()) return undefined;

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsVisible(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setIsVisible(false);
    }

    setDeferredPrompt(null);
  };

  if (!isVisible) return null;

  return (
    <div className="pwa-sheet pwa-sheet-install" role="dialog" aria-label="Install StočkHive">
      <div className="pwa-sheet-copy">
        <p className="pwa-sheet-eyebrow">Install app</p>
        <h2 className="pwa-sheet-title">Install StočkHive</h2>
        <p className="pwa-sheet-text">Add StočkHive to your home screen for the fastest full-screen experience.</p>
      </div>
      <div className="pwa-sheet-actions">
        <button type="button" className="ghost-btn" onClick={() => setIsVisible(false)}>
          Not now
        </button>
        <button type="button" className="primary-btn" onClick={handleInstall}>
          Install
        </button>
      </div>
    </div>
  );
}
