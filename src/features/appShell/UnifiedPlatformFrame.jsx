import React from "react";
import { GitBranch, LayoutDashboard, LockKeyhole, LogIn, Trophy, UserRound } from "lucide-react";
import { BeachLogo } from "./EntryPresentation.jsx";
import "../../styles/53-public-social-platform.css";

const NAV_ITEMS = [
  { id: "overview", label: "Visão geral", Icon: LayoutDashboard },
  { id: "tournaments", label: "Torneios", Icon: Trophy, protected: true },
  { id: "circuits", label: "Circuitos", Icon: GitBranch, protected: true },
  { id: "profile", label: "Perfil", Icon: UserRound },
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
  return (
    <div className="playAppShell proDashboard theme-dark publicOverviewShell unifiedPlatformShell">
      <aside className="playSidebar proSidebar publicOverviewSidebar unifiedPlatformSidebar" aria-label="Navegação principal">
        <div className="sidebarHeader"><span className="sidebarSectionLabel">Menu</span></div>
        <nav className="sidebarNav">
          {NAV_ITEMS.map(({ id, label, Icon, protected: protectedPanel }) => (
            <button
              type="button"
              key={id}
              className={`playNavItem ${activePanel === id ? "active" : ""}`}
              aria-current={activePanel === id ? "page" : undefined}
              onClick={() => onNavigate?.(id)}
              title={label}
            >
              <span className="navIcon" aria-hidden="true"><Icon /></span>
              <small>{label}</small>
              {protectedPanel && !hasSession ? <LockKeyhole className="unifiedPlatformNavLock" aria-label="Acesso com conta" /> : null}
            </button>
          ))}
        </nav>
        <div className="sidebarBrandAccent" aria-hidden="true"><span /><small>Torneio 360</small></div>
      </aside>

      <div className="playMain">
        <header className="playTopbar proTopbar publicOverviewTopbar unifiedPlatformTopbar">
          <div className="playTopBrand">
            <BeachLogo />
            <div className="brandTaglineOnly"><span>{tagline}</span></div>
          </div>
          <div className="publicOverviewAccountActions">
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
          </div>
        </header>

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
