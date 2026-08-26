import React, { useEffect, useState } from "react";
import { GitBranch, LayoutDashboard, LogIn, Moon, Sun, Trophy, UserRound } from "lucide-react";
import { PlatformSidebar, PlatformTopbar } from "./PlatformChrome.jsx";
import "../../styles/53-public-social-platform.css";

const NAV_ITEMS = [
  { panel: "overview", label: "Visão geral", Icon: LayoutDashboard },
  { panel: "tournaments", label: "Torneios", Icon: Trophy, protected: true },
  { panel: "circuits", label: "Circuitos", Icon: GitBranch, protected: true },
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
    locked: item.protected && !hasSession,
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
