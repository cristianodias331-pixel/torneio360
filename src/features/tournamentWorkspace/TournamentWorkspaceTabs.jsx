import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  PlusCircle,
  Search,
  Trophy,
  X,
} from "lucide-react";
import { getModalityDisplayName } from "../../domain/modalityCatalog.mjs";

const TOURNAMENT_TAB_COLORS = Object.freeze([
  "#2563eb",
  "#ea580c",
  "#0f766e",
  "#db2777",
  "#16a34a",
  "#ca8a04",
  "#0891b2",
  "#dc2626",
  "#4f46e5",
  "#65a30d",
  "#e11d48",
  "#0284c7",
  "#b45309",
  "#059669",
  "#7c3aed",
  "#c026d3",
  "#0e7490",
  "#d97706",
  "#be123c",
  "#4338ca",
]);

function getTournamentTabColor(tournamentId, position = null) {
  if (Number.isInteger(position) && position >= 0) {
    return TOURNAMENT_TAB_COLORS[position % TOURNAMENT_TAB_COLORS.length];
  }
  const value = String(tournamentId || "torneio");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return TOURNAMENT_TAB_COLORS[Math.abs(hash) % TOURNAMENT_TAB_COLORS.length];
}

export default function TournamentWorkspaceTabs({
  tournaments,
  openTournamentIds,
  activeTournamentId,
  onSelectTournament,
  onCloseTournament,
  onOpenCourtCenter,
  courtCenterSummary = null,
  MatchStatusSummary,
}) {
  const [managerOpen, setManagerOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [closeTarget, setCloseTarget] = useState(null);
  const [busyTournamentId, setBusyTournamentId] = useState(null);
  const tabsViewportRef = useRef(null);
  const activeTabRef = useRef(null);

  const tournamentsById = useMemo(
    () => new Map((tournaments || []).map((tournament) => [tournament.id, tournament])),
    [tournaments]
  );
  const openTournaments = useMemo(
    () => (openTournamentIds || []).map((id) => tournamentsById.get(id)).filter(Boolean),
    [openTournamentIds, tournamentsById]
  );
  const filteredTournaments = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedSearch) return tournaments || [];
    return (tournaments || []).filter((tournament) => {
      const searchable = [
        tournament.name,
        getModalityDisplayName(tournament.type),
        tournament.data?.category,
        tournament.data?.gender,
        tournament.data?.eventName,
      ].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
      return searchable.includes(normalizedSearch);
    });
  }, [searchValue, tournaments]);

  useEffect(() => {
    if (!activeTabRef.current) return;
    activeTabRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeTournamentId, openTournamentIds]);

  useEffect(() => {
    if (!managerOpen && !closeTarget) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      if (closeTarget) setCloseTarget(null);
      else setManagerOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [managerOpen, closeTarget]);

  async function selectTournament(tournament) {
    if (!tournament?.id || busyTournamentId) return;
    setBusyTournamentId(tournament.id);
    const opened = await onSelectTournament(tournament);
    setBusyTournamentId(null);
    if (opened !== false) {
      setManagerOpen(false);
      setSearchValue("");
    }
  }

  async function confirmCloseTournament() {
    if (!closeTarget || busyTournamentId) return;
    setBusyTournamentId(closeTarget.id);
    const closed = await onCloseTournament(closeTarget);
    setBusyTournamentId(null);
    if (closed !== false) setCloseTarget(null);
  }

  function scrollTabs(direction) {
    tabsViewportRef.current?.scrollBy({ left: direction * 320, behavior: "smooth" });
  }

  const activeTournament = tournamentsById.get(activeTournamentId);

  return (
    <>
      <nav className="tournamentWorkspaceTabsShell" aria-label="Torneios abertos">
        <div className="desktopTournamentTabs">
          <button
            type="button"
            className="tournamentTabsScrollButton"
            onClick={() => scrollTabs(-1)}
            aria-label="Ver torneios anteriores"
          >
            <ChevronLeft aria-hidden="true" />
          </button>

          <div className="openTournamentTabsViewport" ref={tabsViewportRef}>
            <div className="openTournamentTabsTrack">
              {openTournaments.map((tournament, tournamentIndex) => {
                const isActive = tournament.id === activeTournamentId;
                return (
                  <div
                    key={tournament.id}
                    ref={isActive ? activeTabRef : null}
                    className={`openTournamentTab ${isActive ? "active" : ""}`}
                    style={{ "--tournament-tab-color": getTournamentTabColor(tournament.id, tournamentIndex) }}
                  >
                    <button
                      type="button"
                      className="openTournamentTabMain"
                      onClick={() => selectTournament(tournament)}
                      title={tournament.name}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className="openTournamentTabIdentity">
                        <span className="openTournamentTabDot" aria-hidden="true" />
                        <span className="openTournamentTabName">{tournament.name}</span>
                      </span>
                      <MatchStatusSummary data={tournament.data} compact vertical />
                    </button>
                    <button
                      type="button"
                      className="openTournamentTabClose"
                      onClick={() => setCloseTarget(tournament)}
                      aria-label={`Remover ${tournament.name} das abas abertas`}
                      title="Remover da barra"
                    >
                      <X aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            className="tournamentTabsScrollButton"
            onClick={() => scrollTabs(1)}
            aria-label="Ver próximos torneios"
          >
            <ChevronRight aria-hidden="true" />
          </button>

          <div className="tournamentWorkspaceActionStack">
            <button type="button" className="addOpenTournamentButton" onClick={() => setManagerOpen(true)}>
              <PlusCircle aria-hidden="true" />
              <span>Adicionar</span>
            </button>

            <button type="button" className="openCourtCenterButton" onClick={onOpenCourtCenter}>
              <Grid3X3 aria-hidden="true" />
              <span>Quadras</span>
              {courtCenterSummary ? (
                <small>
                  <strong className="courtSummaryFree">{courtCenterSummary.free}</strong> livres
                  <i aria-hidden="true">·</i>
                  <strong className="courtSummaryOccupied">{courtCenterSummary.occupied}</strong> em uso
                </small>
              ) : null}
            </button>
          </div>
        </div>

        <div className="mobileTournamentWorkspaceActions">
          <button type="button" className="mobileTournamentSwitcherButton" onClick={() => setManagerOpen(true)}>
            <span
              className="mobileTournamentSwitcherColor"
              style={{
                "--tournament-tab-color": getTournamentTabColor(
                  activeTournamentId,
                  Math.max(0, openTournaments.findIndex((tournament) => tournament.id === activeTournamentId))
                ),
              }}
              aria-hidden="true"
            />
            <span className="mobileTournamentSwitcherCopy">
              <small>Torneio atual</small>
              <strong>{activeTournament?.name || "Escolher torneio"}</strong>
              {activeTournament ? <MatchStatusSummary data={activeTournament.data} compact /> : null}
            </span>
            <span className="mobileTournamentSwitcherCount">{openTournaments.length}</span>
            <ChevronDown aria-hidden="true" />
          </button>
          <button type="button" className="mobileCourtCenterButton" onClick={onOpenCourtCenter} aria-label="Abrir Central de Quadras">
            <Grid3X3 aria-hidden="true" />
            <span>{courtCenterSummary?.free ?? 0}</span>
          </button>
        </div>
      </nav>

      {managerOpen ? createPortal(
        <div className="tournamentTabsModalOverlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setManagerOpen(false);
        }}>
          <section className="tournamentTabsModal" role="dialog" aria-modal="true" aria-labelledby="open-tournaments-title">
            <header className="tournamentTabsModalHeader">
              <div>
                <span>Central de torneios</span>
                <h2 id="open-tournaments-title">Abrir ou trocar torneio</h2>
                <p>Os torneios permanecem salvos mesmo quando você os remove desta barra.</p>
              </div>
              <button type="button" onClick={() => setManagerOpen(false)} aria-label="Fechar">
                <X aria-hidden="true" />
              </button>
            </header>

            <label className="tournamentTabsSearch platformUnifiedSearch">
              <Search aria-hidden="true" />
              <input
                type="search"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Ex.: nome, modalidade ou categoria"
                autoFocus
              />
            </label>

            <div className="tournamentTabsModalList">
              {filteredTournaments.length ? filteredTournaments.map((tournament) => {
                const isOpen = openTournamentIds.includes(tournament.id);
                const isActive = tournament.id === activeTournamentId;
                const isBusy = tournament.id === busyTournamentId;
                const openIndex = openTournamentIds.indexOf(tournament.id);
                const tournamentIndex = Math.max(0, tournaments.findIndex((item) => item.id === tournament.id));
                return (
                  <article
                    key={tournament.id}
                    className={`tournamentTabsModalItem ${isActive ? "active" : ""}`}
                    style={{
                      "--tournament-tab-color": getTournamentTabColor(
                        tournament.id,
                        openIndex >= 0 ? openIndex : tournamentIndex
                      ),
                    }}
                  >
                    <span className="tournamentTabsModalItemColor" aria-hidden="true" />
                    <div className="tournamentTabsModalItemCopy">
                      <strong>{tournament.name}</strong>
                      <span>{getModalityDisplayName(tournament.type)}{[...new Set([tournament.data?.category, tournament.data?.gender].filter(Boolean))].map((label) => ` · ${label}`).join("")}</span>
                    </div>
                    {isOpen ? <span className="tournamentTabsOpenBadge">{isActive ? "Em uso" : "Aberto"}</span> : null}
                    <button type="button" onClick={() => selectTournament(tournament)} disabled={isBusy || isActive}>
                      {isBusy ? "Abrindo..." : isActive ? "Atual" : isOpen ? "Trocar" : "Adicionar"}
                    </button>
                  </article>
                );
              }) : (
                <div className="tournamentTabsEmpty">
                  <Trophy aria-hidden="true" />
                  <strong>Nenhum torneio encontrado</strong>
                  <span>Tente outro nome ou modalidade.</span>
                </div>
              )}
            </div>
          </section>
        </div>,
        document.body
      ) : null}

      {closeTarget ? createPortal(
        <div className="tournamentTabsModalOverlay tournamentTabCloseOverlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setCloseTarget(null);
        }}>
          <section className="tournamentTabCloseModal" role="dialog" aria-modal="true" aria-labelledby="close-tournament-tab-title">
            <span className="tournamentTabCloseIcon"><X aria-hidden="true" /></span>
            <h2 id="close-tournament-tab-title">Remover da barra?</h2>
            <p>
              <strong>{closeTarget.name}</strong> será fechado somente nesta central. O torneio não será apagado e continuará disponível no painel.
            </p>
            <div className="tournamentTabCloseActions">
              <button type="button" onClick={() => setCloseTarget(null)}>Cancelar</button>
              <button type="button" className="confirm" onClick={confirmCloseTournament} disabled={Boolean(busyTournamentId)}>
                {busyTournamentId ? "Salvando..." : "Remover da barra"}
              </button>
            </div>
          </section>
        </div>,
        document.body
      ) : null}
    </>
  );
}
