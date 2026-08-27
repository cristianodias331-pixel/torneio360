import React, { useEffect, useState } from "react";
import { Compass, Home, LogIn, Moon, PlusCircle, Sun, UserRound } from "lucide-react";
import { PlatformSidebar, PlatformTopbar } from "./PlatformChrome.jsx";
import "../../styles/53-public-social-platform.css";

const NAV_ITEMS = [
  { panel: "overview", label: "Início", Icon: Home },
  { panel: "explore", label: "Explorar", Icon: Compass },
  { panel: "create", label: "Criar", Icon: PlusCircle, requiresCreationPermission: true },
  { panel: "profile", label: "Perfil", Icon: UserRound },
];

export default function UnifiedPlatformFrame({
  activePanel = "overview",
  hasSession = false,
  tagline = "Gestão inteligente de torneios",
  title,
  description,
  eyebrow,
  accountLabel,
  canCreate = false,
  identity = null,
  onNavigate,
  onAccountAction,
  onSignup,
  children,
}) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [colorMode, setColorMode] = useState(() => {
    try {
      return localStorage.getItem("torneio360:color-mode:public") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (sidebarExpanded && window.matchMedia?.("(max-width: 1024px)").matches) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [sidebarExpanded]);

  useEffect(() => {
    try { localStorage.setItem("torneio360:color-mode:public", colorMode); } catch { /* armazenamento opcional */ }
    document.documentElement.dataset.theme = colorMode;
  }, [colorMode]);

  const navItems = NAV_ITEMS.map((item) => ({
    ...item,
    locked: item.requiresCreationPermission && !canCreate,
  }));

  const topbarActions = (
    <>
      <button
        type="button"
        className="themeToggleButton"
        onClick={() => setColorMode((current) => current === "dark" ? "light" : "dark")}
        aria-label={colorMode === "dark" ? "Ativar modo claro" : "Ativar modo noturno"}
        aria-pressed={colorMode === "dark"}
      >
        {colorMode === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        <span>{colorMode === "dark" ? "Modo claro" : "Modo noturno"}</span>
      </button>
      {!hasSession && onSignup ? (
        <button type="button" className="publicOverviewCreateProfile" onClick={onSignup}>
          <UserRound aria-hidden="true" /> Criar conta
        </button>
      ) : null}
      {onAccountAction ? (
        <button type="button" className="publicOverviewLogin" onClick={onAccountAction}>
          <LogIn aria-hidden="true" /> {accountLabel || (hasSession ? "Minha conta" : "Entrar")}
        </button>
      ) : null}
    </>
  );

  return (
    <div className={`playAppShell proDashboard theme-${colorMode} publicOverviewShell unifiedPlatformShell`}>
      <PlatformSidebar
        activePanel={activePanel}
        className="unifiedPlatformSidebar"
        expanded={sidebarExpanded}
        items={navItems}
        onNavigate={onNavigate}
        onExpandedChange={setSidebarExpanded}
      />
      <div className="playMain">
        <PlatformTopbar
          sidebarExpanded={sidebarExpanded}
          onSidebarExpandedChange={setSidebarExpanded}
          tagline={tagline}
          identity={identity}
          actions={topbarActions}
        />

        <main className="playContent publicOverviewContent unifiedPlatformContent">
          {title ? (
            <section className="playTitleBlock unifiedPlatformTitleBlock">
              <div>
                {eyebrow ? <span className="pageEyebrow">{eyebrow}</span> : null}
                <h1>{title}</h1>
                {description ? <p>{description}</p> : null}
              </div>
            </section>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
