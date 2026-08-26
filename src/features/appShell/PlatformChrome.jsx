import React from "react";
import { LockKeyhole, Menu } from "lucide-react";
import { BeachLogo } from "./EntryPresentation.jsx";
import "../../styles/40-organizer-data-and-navigation.css";

export function PlatformSidebar({
  activePanel,
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
        className={`playSidebar proSidebar ${expanded ? "isExpanded" : ""}`}
        aria-label="Navegação principal"
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
      <div className="playUserBox proTopActions">{actions}</div>
    </header>
  );
}
