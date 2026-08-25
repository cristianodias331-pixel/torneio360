import React, { useEffect, useState } from "react";
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
  runtime,
}) {
  const {
    RankingTable,
    buildPublicCircuitRankingGroups,
    tagline,
  } = runtime;
  const [previewImage, setPreviewImage] = useState(null);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [circuit?.id]);
  const rankingSettings = normalizeCircuitRankingSettings(circuit?.ranking_settings || circuit?.rankingSettings);
  const circuitCoverImage = rankingSettings.coverImageUrl || circuit?.coverImageUrl || "";
  const circuitCoverThumbnail = rankingSettings.coverImageThumbnailUrl || circuit?.coverImageThumbnailUrl || "";
  const circuitCoverDisplay = circuitCoverThumbnail || circuitCoverImage;
  const storedRankingGroups = Array.isArray(circuit?.ranking_groups)
    ? circuit.ranking_groups.filter((group) => Array.isArray(group?.rows) && group.rows.length > 0)
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
  const getPublicCircuitGroupShareConfig = (group) => ({
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
  });

  return (
    <div className="publicPage publicCircuitPage">
      <header className="publicHeader publicHeaderWithLogo publicCircuitHeader">
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
          <div className="publicBadge">Somente visualização</div>
        </div>
      </header>

      <main className="publicContent publicCircuitContent">
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
              title={rankingGroups[0].title}
              rows={rankingGroups[0].rows}
              rankingCriteria={circuit.ranking_criteria || defaultRankingCriteria}
              columns={circuitDisplayColumns}
              showGames={!placementMode}
              shareConfig={getPublicCircuitGroupShareConfig(rankingGroups[0])}
              progressive
              initialRowCount={30}
            />
          ) : (
            <div className="twoCols publicCircuitRankingTables">
              {rankingGroups.map((group) => (
                <RankingTable
                  key={group.key || group.title}
                  title={group.title}
                  rows={group.rows}
                  rankingCriteria={circuit.ranking_criteria || defaultRankingCriteria}
                  columns={circuitDisplayColumns}
                  showGames={!placementMode}
                  shareConfig={getPublicCircuitGroupShareConfig(group)}
                  progressive
                  initialRowCount={30}
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
