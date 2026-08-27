import React from "react";
import { Building2, LockKeyhole, Menu, UserRound } from "lucide-react";
import { BeachLogo } from "./EntryPresentation.jsx";
import "../../styles/40-organizer-data-and-navigation.css";
import "../../styles/56-unified-navigation.css";

export function PlatformIdentityContext({ identity }) {
  if (!identity) return null;
  const isOrganization = identity.kind === "organization";
  const IdentityIcon = isOrganization ? Building2 : UserRound;

  return (
    <div className="platformIdentityContext" aria-label={`Identidade ativa: ${identity.label}`}>
      <span className="platformIdentityAvatar" aria-hidden="true">
        {identity.photoUrl ? <img src={identity.photoUrl} alt="" /> : <IdentityIcon />}
      </span>
      <span className="platformIdentityCopy">
        <small>Usando como</small>
        <strong>{identity.label}</strong>
        <em>{identity.subtitle || (isOrganization ? "Organização" : "Atleta")}</em>
      </span>
    </div>
  );
}

export function PlatformSidebar({
  activePanel,
  className = "",
  expanded = false,
  items = [],
  onNavigate,
  onExpandedChange,
}) {
  const closeAfterNavigation = () => {
    if (window.matchMedia?.("(max-width: 1024px)").matches) onExpandedChange?.(false);
  };

  return (
    <>
      <button
        type="button"
        className={`sidebarBackdrop ${expanded ? "visible" : ""}`}
        aria-label="Fechar menu principal"
        onClick={() => onExpandedChange?.(false)}
      />
      <aside
        id="torneio360-main-sidebar"
        className={`playSidebar proSidebar ${className} ${expanded ? "isExpanded" : ""}`.trim()}
        aria-label="Navegação principal"
        onMouseLeave={() => {
          if (window.matchMedia?.("(min-width: 1025px)").matches) onExpandedChange?.(false);
        }}
      >
        <div className="sidebarHeader"><span className="sidebarSectionLabel">Menu</span></div>
        <nav className="sidebarNav">
          {items.map(({ panel, label, Icon, locked = false }) => (
            <button
              key={panel}
              className={`playNavItem ${activePanel === panel ? "active" : ""}`}
              type="button"
              onClick={() => {
                onNavigate?.(panel);
                closeAfterNavigation();
              }}
              aria-current={activePanel === panel ? "page" : undefined}
              title={label}
            >
              <span className="navIcon" aria-hidden="true"><Icon /></span>
              <small>{label}</small>
              {locked ? <LockKeyhole className="unifiedPlatformNavLock" aria-label="Disponível com assinatura" /> : null}
            </button>
          ))}
        </nav>
        <div className="sidebarBrandAccent" aria-hidden="true"><span /><small>Torneio 360</small></div>
      </aside>
    </>
  );
}

export function PlatformTopbar({
  sidebarExpanded = false,
  onSidebarExpandedChange,
  tagline = "Gestão inteligente de torneios",
  identity = null,
  actions = null,
}) {
  return (
    <header className="playTopbar proTopbar">
      <div className="playTopBrand">
        <button
          type="button"
          className="sidebarMobileToggle"
          aria-label={sidebarExpanded ? "Fechar menu principal" : "Abrir menu principal"}
          aria-controls="torneio360-main-sidebar"
          aria-expanded={sidebarExpanded}
          onClick={() => onSidebarExpandedChange?.(!sidebarExpanded)}
        >
          <Menu aria-hidden="true" />
          <span>Menu</span>
        </button>
        <BeachLogo />
        <div className="brandTaglineOnly"><span>{tagline}</span></div>
      </div>
      <div className="playUserBox proTopActions">
        <PlatformIdentityContext identity={identity} />
        {actions}
      </div>
    </header>
  );
}
