import React, { useEffect, useState } from "react";

export default function AppUpdateNotice() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const currentVersion = typeof __APP_BUILD_VERSION__ === "string" ? __APP_BUILD_VERSION__ : "development";

  useEffect(() => {
    if (!import.meta.env.PROD || currentVersion === "development") return undefined;
    let active = true;

    async function checkVersion() {
      try {
        const response = await fetch(`/app-version.json?t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!response.ok) return;
        const latest = await response.json();
        if (active && latest?.version && latest.version !== currentVersion) setUpdateAvailable(true);
      } catch {
        // O app continua funcionando offline e tenta novamente depois.
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkVersion();
    };
    const onFocus = () => void checkVersion();
    void checkVersion();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(checkVersion, 5 * 60 * 1000);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [currentVersion]);

  async function applyUpdate() {
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      await registration?.update();
      registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    } finally {
      window.location.reload();
    }
  }

  if (!updateAvailable) return null;

  return (
    <aside className="appUpdateNotice" role="status" aria-live="polite">
      <div>
        <strong>Nova versão disponível</strong>
        <span>Atualize sem sair da sua conta. Seus dados salvos serão mantidos.</span>
      </div>
      <button type="button" onClick={applyUpdate}>Atualizar agora</button>
      <button type="button" className="appUpdateLater" onClick={() => setUpdateAvailable(false)}>Depois</button>
    </aside>
  );
}
