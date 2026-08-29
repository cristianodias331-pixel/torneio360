import React, { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { BeachLogo } from "../appShell/EntryPresentation.jsx";
import { PublicImageLightbox } from "./PublicArenaPresentation.jsx";
import { formatDateBR } from "../../domain/dateTime.mjs";
import { getModalityDisplayName } from "../../domain/modalityCatalog.mjs";
import { getPublicUrl } from "../../domain/publicIdentifiers.mjs";
import {
  circuitRankingModes,
  getCircuitPerformanceColumns,
  getCircuitPlacementColumns,
  getCircuitRankingExportColumns,
  getCircuitTieBreakLabel,
  normalizeCircuitRankingSettings,
} from "../../domain/circuitRankingSettings.mjs";
import { defaultRankingCriteria } from "../../domain/rankingCriteria.mjs";
import { selectVisiblePublicCircuitRankingGroups } from "../../domain/publicArenaData.mjs";
import { sortTournamentsChronologically } from "../../domain/tournamentLifecycle.mjs";

export default function PublicCircuitScreenView({
  circuit,
  tournaments = [],
  organizer = {},
  onBackToArena,
  embedded = false,
  runtime,
}) {
  const {
    RankingTable,
    buildPublicCircuitRankingGroups,
    fetchPublicCircuitRankingAll,
    fetchPublicCircuitRankingPage,
    tagline,
  } = runtime;
  const [previewImage, setPreviewImage] = useState(null);
  const [pagedRankingGroups, setPagedRankingGroups] = useState(() => circuit?.ranking_groups || []);
  const [rankingRequestState, setRankingRequestState] = useState({});
  const rankingRequestSequenceRef = useRef({});
  const rankingPaginationEnabled = circuit?.ranking_pagination?.enabled === true
    && typeof fetchPublicCircuitRankingPage === "function";
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [circuit?.id]);
  useEffect(() => {
    setPagedRankingGroups(Array.isArray(circuit?.ranking_groups) ? circuit.ranking_groups : []);
    setRankingRequestState({});
    rankingRequestSequenceRef.current = {};
  }, [circuit?.id, circuit?.updated_at]);

  const requestRankingPage = useCallback(async ({
    groupKey,
    offset = 0,
    search = "",
    replace = false,
  }) => {
    if (!rankingPaginationEnabled) return;
    const normalizedGroupKey = String(groupKey || "geral");
    const sequence = Number(rankingRequestSequenceRef.current[normalizedGroupKey] || 0) + 1;
    rankingRequestSequenceRef.current[normalizedGroupKey] = sequence;
    setRankingRequestState((current) => ({
      ...current,
      [normalizedGroupKey]: { loading: true, error: "" },
    }));

    const result = await fetchPublicCircuitRankingPage({
      circuitId: circuit?.id,
      groupKey: normalizedGroupKey,
      limit: Number(circuit?.ranking_pagination?.page_size) || 30,
      offset,
      search,
    });
    if (rankingRequestSequenceRef.current[normalizedGroupKey] !== sequence) return;

    if (result.error || !result.data) {
      setRankingRequestState((current) => ({
        ...current,
        [normalizedGroupKey]: {
          loading: false,
          error: "Não foi possível carregar esta parte do ranking. Tente novamente.",
        },
      }));
      return;
    }

    const nextRows = Array.isArray(result.data.items) ? result.data.items : [];
    setPagedRankingGroups((current) => current.map((group) => {
      if (String(group?.key || "geral") !== normalizedGroupKey) return group;
      const rows = replace ? nextRows : Array.from(new Map([
        ...(Array.isArray(group.rows) ? group.rows : []),
        ...nextRows,
      ].map((row) => [String(row?.id || row?.name || ""), row])).values());
      return {
        ...group,
        rows,
        total: Number(result.data.total) || 0,
        all_total: Number(result.data.all_total) || 0,
        has_more: result.data.has_more === true,
        next_offset: Number(result.data.next_offset) || rows.length,
        search: String(result.data.search || ""),
        server_pagination: true,
      };
    }));
    setRankingRequestState((current) => ({
      ...current,
      [normalizedGroupKey]: { loading: false, error: "" },
    }));
  }, [circuit?.id, circuit?.ranking_pagination?.page_size, fetchPublicCircuitRankingPage, rankingPaginationEnabled]);

  const rankingSettings = normalizeCircuitRankingSettings(circuit?.ranking_settings || circuit?.rankingSettings);
  const circuitCoverImage = rankingSettings.coverImageUrl || circuit?.coverImageUrl || "";
  const circuitCoverThumbnail = rankingSettings.coverImageThumbnailUrl || circuit?.coverImageThumbnailUrl || "";
  const circuitCoverDisplay = circuitCoverThumbnail || circuitCoverImage;
  const sourceRankingGroups = rankingPaginationEnabled ? pagedRankingGroups : circuit?.ranking_groups;
  const storedRankingGroups = Array.isArray(sourceRankingGroups)
    ? sourceRankingGroups.filter((group) => (
      rankingPaginationEnabled
        ? group?.server_pagination === true
        : Array.isArray(group?.rows) && group.rows.length > 0
    ))
    : [];
  const storedRankingNeedsGenderRepair = rankingSettings.rankingDivision === "gender"
    && storedRankingGroups.some((group) => (group.key || "geral") === "geral");
  const rebuiltRankingGroups = storedRankingGroups.length === 0 || storedRankingNeedsGenderRepair
    ? buildPublicCircuitRankingGroups(circuit, tournaments)
    : [];
  const rankingGroups = selectVisiblePublicCircuitRankingGroups({
    storedGroups: storedRankingGroups,
    rebuiltGroups: rebuiltRankingGroups,
    rankingDivision: rankingSettings.rankingDivision,
  });
  const placementMode = rankingSettings.mode === circuitRankingModes.placement;
  const placementColumns = placementMode ? getCircuitPlacementColumns(rankingSettings) : null;
  const performanceColumns = placementMode ? null : getCircuitPerformanceColumns(rankingSettings);
  const circuitDisplayColumns = placementColumns || performanceColumns;
  const circuitExportColumns = getCircuitRankingExportColumns(rankingSettings);
  const rankingTitle = placementMode ? "Ranking geral por pontos" : "Ranking geral acumulado";
  const circuitCriteriaLabel = getCircuitTieBreakLabel(rankingSettings, { compact: true });
  const arenaName = organizer.arenaName || "Arena Torneio360";
  const selectedTournamentIds = new Set((circuit?.tournament_ids || circuit?.tournamentIds || []).map((id) => String(id)));
  const circuitTournaments = sortTournamentsChronologically(
    tournaments.filter((tournament) => selectedTournamentIds.has(String(tournament.id)))
  );
  const getPublicCircuitGroupShareConfig = (group) => {
    const baseConfig = {
      cacheKey: `${circuit?.id || "circuito"}:${group.key || "geral"}`,
      title: circuit?.name || "Ranking do circuito",
      subtitle: group.title,
      arenaName,
      arenaPhotoUrl: organizer.photoUrl || "",
      rankingCriteria: circuit?.ranking_criteria || defaultRankingCriteria,
      columns: circuitExportColumns,
      criteriaLabel: circuitCriteriaLabel,
      groups: [group],
      editableWorkbook: true,
      workbookTitle: `${circuit?.name || "Ranking do circuito"} - ${group.title}`,
      workbookGroups: [group],
      workbookColumns: circuitExportColumns,
      buttonLabel: group.key === "masculino"
        ? "Compartilhar masculino"
        : group.key === "feminino"
          ? "Compartilhar feminino"
          : "Compartilhar ranking",
    };
    if (!rankingPaginationEnabled || typeof fetchPublicCircuitRankingAll !== "function") return baseConfig;
    return {
      ...baseConfig,
      loadFullConfig: async () => {
        const result = await fetchPublicCircuitRankingAll({
          circuitId: circuit?.id,
          groupKey: group.key || "geral",
        });
        if (result.error || !result.data) throw result.error || new Error("Ranking completo indisponível.");
        const fullGroup = { ...group, ...result.data };
        return {
          ...baseConfig,
          groups: [fullGroup],
          workbookGroups: [fullGroup],
        };
      },
    };
  };

  const getRemotePagination = (group) => {
    if (!rankingPaginationEnabled) return null;
    const groupKey = String(group?.key || "geral");
    const requestState = rankingRequestState[groupKey] || {};
    return {
      enabled: true,
      total: Number(group?.total) || 0,
      allTotal: Number(group?.all_total) || Number(group?.total) || 0,
      hasMore: group?.has_more === true,
      loading: requestState.loading === true,
      error: requestState.error || "",
      onLoadMore: () => requestRankingPage({
        groupKey,
        offset: Number(group?.next_offset) || (group?.rows || []).length,
        search: group?.search || "",
        replace: false,
      }),
      onSearch: (search) => requestRankingPage({
        groupKey,
        offset: 0,
        search,
        replace: true,
      }),
    };
  };

  return (
    <div className={`publicPage publicCircuitPage${embedded ? " embeddedPublicCircuit" : ""}`}>
      {!embedded ? <header className="publicHeader publicHeaderWithLogo publicCircuitHeader">
        <div className="publicBrandRow">
          <BeachLogo />
          <div className="brandTaglineOnly"><span>{tagline}</span></div>
        </div>

        <div className="publicTitleBlock">
          <span>Ranking público do circuito</span>
          <h1>{circuit?.name || "Circuito"}</h1>
          <p>
            {circuit?.start_date || circuit?.startDate ? formatDateBR(circuit.start_date || circuit.startDate) : "Data inicial não informada"}
            {circuit?.end_date || circuit?.endDate ? ` até ${formatDateBR(circuit.end_date || circuit.endDate)}` : ""}
          </p>
        </div>

        <div className="publicTournamentHeaderActions">
          <button type="button" onClick={onBackToArena}>← Voltar ao perfil da arena</button>
        </div>
      </header> : (
        <section className="platformEntityHeader">
          <div>
            <span>CIRCUITO</span>
            <h1>{circuit?.name || "Circuito"}</h1>
            <p>Ranking e torneios do circuito</p>
          </div>
          <button type="button" onClick={onBackToArena}>Voltar à organização</button>
        </section>
      )}

      <main className="publicContent publicCircuitContent embeddedEntityContent">
        <div className={`publicEventMediaInfo ${circuitCoverDisplay ? "hasCover" : ""}`}>
        {circuitCoverDisplay ? (
          <button
            type="button"
            className="publicTournamentCover publicCoverPreviewButton"
            onClick={() => setPreviewImage({ src: circuitCoverImage || circuitCoverDisplay, alt: `Foto do circuito ${circuit?.name || "Circuito"}`, title: circuit?.name || "Circuito" })}
            aria-label={`Ampliar foto do circuito ${circuit?.name || "Circuito"}`}
          >
            <img src={circuitCoverDisplay} alt={`Foto do circuito ${circuit?.name || "Circuito"}`} />
            <span>Ver foto maior</span>
          </button>
        ) : null}

        <div className="publicEventMediaInfoDetails">
        <section className="card publicCircuitIdentityCard">
          {organizer.photoUrl ? (
            <img src={organizer.photoUrl} alt={`Foto de ${arenaName}`} />
          ) : (
            <span>{arenaName.slice(0, 2).toUpperCase()}</span>
          )}
          <div>
            <small>Organização</small>
            <h2>{arenaName}</h2>
            <p>{(circuit?.tournament_ids || circuit?.tournamentIds || []).length} torneio(s) neste circuito</p>
          </div>
        </section>
        </div>
        </div>

        <section className="card publicCircuitStagesCard">
          <div className="cardTitleRow">
            <div><small>Etapas</small><h2>Torneios do circuito</h2></div>
            <span>{circuitTournaments.length} torneio(s)</span>
          </div>
          {circuitTournaments.length === 0 ? (
            <p className="publicCircuitEmptyRanking">Nenhum torneio público está vinculado a este circuito.</p>
          ) : (
            <div className="publicCircuitStageGrid">
              {circuitTournaments.map((tournament) => {
                const details = tournament.data || {};
                return (
                  <article key={tournament.id}>
                    <div><small>{getModalityDisplayName(tournament.type)}</small><h3>{tournament.name}</h3></div>
                    <p>{details.eventDate ? <span><CalendarDays aria-hidden="true" /> {formatDateBR(details.eventDate)} {details.eventStartTime || ""}</span> : null}</p>
                    {tournament.public_id ? <button type="button" onClick={() => window.location.assign(getPublicUrl(tournament.public_id))}>Ver torneio</button> : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="card publicCircuitRankingCard">
          <div className="cardTitleRow">
            <div>
              <small className="publicCircuitName">{circuit?.name || "Circuito"}</small>
              <h2>{rankingTitle}</h2>
              <p className="publicCircuitRankingRule">
                {circuitCriteriaLabel}{placementMode ? " · Disputas paralelas não pontuam." : ""}
              </p>
            </div>
          </div>

          {rankingGroups.length === 0 ? (
            <div className="publicCircuitEmptyRanking">
              O ranking aparecerá aqui assim que houver placares válidos nos torneios do circuito.
            </div>
          ) : rankingGroups.length === 1 ? (
            <RankingTable
              key={`${circuit?.id || "circuito"}:${circuit?.updated_at || ""}:${rankingGroups[0].key || "geral"}`}
              title={rankingGroups[0].title}
              rows={rankingGroups[0].rows}
              rankingCriteria={circuit.ranking_criteria || defaultRankingCriteria}
              columns={circuitDisplayColumns}
              showGames={!placementMode}
              shareConfig={getPublicCircuitGroupShareConfig(rankingGroups[0])}
              progressive={!rankingPaginationEnabled}
              initialRowCount={30}
              remotePagination={getRemotePagination(rankingGroups[0])}
            />
          ) : (
            <div className="twoCols publicCircuitRankingTables">
              {rankingGroups.map((group) => (
                <RankingTable
                  key={`${circuit?.id || "circuito"}:${circuit?.updated_at || ""}:${group.key || group.title}`}
                  title={group.title}
                  rows={group.rows}
                  rankingCriteria={circuit.ranking_criteria || defaultRankingCriteria}
                  columns={circuitDisplayColumns}
                  showGames={!placementMode}
                  shareConfig={getPublicCircuitGroupShareConfig(group)}
                  progressive={!rankingPaginationEnabled}
                  initialRowCount={30}
                  remotePagination={getRemotePagination(group)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
      <PublicImageLightbox image={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  );
}
