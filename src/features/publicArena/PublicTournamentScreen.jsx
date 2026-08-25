import React, { useEffect, useState } from "react";
import {
  AtSign,
  CalendarDays,
  Clock3,
  Flame,
  Grid3X3,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { BeachLogo } from "../appShell/EntryPresentation.jsx";
import { PublicImageLightbox } from "./PublicArenaPresentation.jsx";
import { getBrazilianWhatsAppUrl } from "../../domain/contactLinks.mjs";
import {
  calculateCupGroupRankings,
} from "../../domain/cupGroupRanking.mjs";
import {
  isCearenseSecondParallelEnabled,
  isCearenseThirdParallelEnabled,
  isCopinhaData,
  isPlayRankingData,
  isSunsetData,
} from "../../domain/cupFormat.mjs";
import { formatDateBR } from "../../domain/dateTime.mjs";
import { isCupType, isFlexibleSimpleType } from "../../domain/modalityClassification.mjs";
import { modalityConfig } from "../../domain/modalityConfig.mjs";
import { getModalityDisplayName } from "../../domain/modalityCatalog.mjs";
import {
  readPublicViewStorage,
  savePublicViewStorage,
} from "../../domain/localAppStorage.mjs";
import {
  getRegisteredAthletesForPublic,
} from "../../domain/publicArenaData.mjs";
import {
  defaultRankingCriteria,
  getRankingCriteria,
} from "../../domain/rankingCriteria.mjs";
import { getWinningScore } from "../../domain/scoreRules.mjs";
import { normalizeTournamentData } from "../../domain/tournamentDataNormalization.mjs";
import {
  getTournamentClassificationLabels,
} from "../../domain/tournamentGenderConfig.mjs";
import { getTournamentCompletionState } from "../../domain/tournamentLifecycle.mjs";
import {
  migratePlayRankingBracketForReferenceProfile,
} from "../../domain/playRankingBracketMigration.mjs";

export default function PublicTournamentScreenView({
  tournament,
  organizer: liveOrganizer = null,
  onBackToArena = null,
  runtime,
}) {
  const {
    CupGroupRankingView,
    CupPodiumView,
    PublicCupBracketView,
    RankingView,
    ScheduleView,
    SimpleFormatInfoButton,
    TournamentFormatInfoButton,
    TournamentTimingSummary,
    calculateRanking,
    getSafeCupPresentation,
    getTournamentTimingSummary,
    tagline,
  } = runtime;
  const publicTabStorageKey = `publicTournamentTab:${tournament.public_id || tournament.id}`;
  const publicMatchesTabStorageKey = `publicTournamentMatchesTab:${tournament.public_id || tournament.id}`;
  const [activePublicTab, setActivePublicTabState] = useState(() => readPublicViewStorage(publicTabStorageKey, "participantes"));
  const [activePublicMatchesTab, setActivePublicMatchesTabState] = useState(() => readPublicViewStorage(publicMatchesTabStorageKey, "grupos"));
  const [previewImage, setPreviewImage] = useState(null);

  function setActivePublicTab(tab) {
    savePublicViewStorage(publicTabStorageKey, tab);
    setActivePublicTabState(tab);
  }

  function setActivePublicMatchesTab(tab) {
    savePublicViewStorage(publicMatchesTabStorageKey, tab);
    setActivePublicMatchesTabState(tab);
  }
  const config = modalityConfig[tournament.type];
  const normalizedData = normalizeTournamentData(tournament.type, tournament.data);
  const migrationTournament = tournament.user_id || !liveOrganizer?.id
    ? tournament
    : { ...tournament, user_id: liveOrganizer.id };
  const data = migratePlayRankingBracketForReferenceProfile(migrationTournament, normalizedData).data;
  const secondParallelVisible = isCearenseSecondParallelEnabled(data);
  const sunsetSecondParallelVisible = isSunsetData(data);
  const thirdParallelVisible = isCearenseThirdParallelEnabled(data);
  const sunsetFinalVisible = isSunsetData(data);

  useEffect(() => {
    if (activePublicMatchesTab === "paralela" && !secondParallelVisible) {
      setActivePublicMatchesTab("chaves");
    } else if (activePublicMatchesTab === "paralela3" && !thirdParallelVisible) {
      setActivePublicMatchesTab("chaves");
    }
  }, [activePublicMatchesTab, secondParallelVisible, thirdParallelVisible]);

  if (!config) {
    return (
      <div className="publicPage">
        <div className="center">
          <h1>Modalidade indisponível</h1>
          <p>Esta tabela foi criada com uma modalidade que não está disponível na versão atual.</p>
        </div>
      </div>
    );
  }

  const publicInfo = data.publicInfo || {};
  const publicVisibility = publicInfo.visibility || {};
  const storedOrganizer = publicInfo.organizer || {};
  const publicOrganizer = liveOrganizer
    ? { ...storedOrganizer, ...liveOrganizer }
    : storedOrganizer;
  const registrationClosed = data.registrationDeadline ? new Date() > new Date(`${data.registrationDeadline}T23:59:59`) : false;
  const ranking = calculateRanking(data, tournament.type, data.rankingCriteria);
  const isCup = isCupType(config);
  const publicCompletionState = getTournamentCompletionState({
    type: tournament.type,
    data,
  });
  const publicRankingReady = isCup || publicCompletionState.completed;

  const cupGroupRankings = isCup
    ? calculateCupGroupRankings(data, data.rankingCriteria)
    : [];

  const { currentBrackets, parallelRanking, mainCupPodium, consolationCupPodium, secondParallelPodium, thirdParallelPodium, sunsetPodium } = getSafeCupPresentation(data, config);
  const publicTournamentTimingSummary = getTournamentTimingSummary(data);
  const publicRankingShareContext = {
    title: tournament.name,
    subtitle: getModalityDisplayName(tournament.type),
    arenaName: publicOrganizer.arenaName || publicOrganizer.organizerName || "Arena Torneio360",
    arenaPhotoUrl: publicOrganizer.photoUrl || "",
    rankingCriteria: data.rankingCriteria || defaultRankingCriteria,
    tournamentDurationSeconds: publicTournamentTimingSummary.complete ? publicTournamentTimingSummary.durationSeconds : 0,
  };

  const publicAthletes = getRegisteredAthletesForPublic(data, config);
  const tournamentCoverDisplay = data.coverImageThumbnailUrl || data.coverImageUrl || "";

  return (
    <div className="publicPage">
      <header className="publicHeader publicHeaderWithLogo">
        <div className="publicBrandRow">
          <BeachLogo />
          <div className="brandTaglineOnly">
            <span>{tagline}</span>
          </div>
        </div>

        <div className="publicTitleBlock">
          <span>Tabela pública</span>
          <h1>{tournament.name}</h1>
          <p>
            {getModalityDisplayName(tournament.type)}
            {getTournamentClassificationLabels(data).map((label) => ` · ${label}`).join("")}
            {data.eventDay ? ` · ${data.eventDay}` : ""}
            {data.eventDate ? ` · ${formatDateBR(data.eventDate)}` : ""}
            {data.location ? ` · ${data.location}` : ""}
          </p>
        </div>

        <div className="publicTournamentHeaderActions">
          {onBackToArena ? <button type="button" onClick={onBackToArena}>← Voltar ao perfil da arena</button> : null}
          <div className="publicBadge">
            {registrationClosed ? "Inscrições encerradas" : "Somente visualização"}
          </div>
        </div>
      </header>

      <main className="publicContent">
        <div className={`publicEventMediaInfo ${tournamentCoverDisplay ? "hasCover" : ""}`}>
        {tournamentCoverDisplay ? (
          <button
            type="button"
            className="publicTournamentCover publicCoverPreviewButton"
            onClick={() => setPreviewImage({ src: data.coverImageUrl || tournamentCoverDisplay, alt: `Foto do torneio ${tournament.name}`, title: tournament.name })}
            aria-label={`Ampliar foto do torneio ${tournament.name}`}
          >
            <img src={tournamentCoverDisplay} alt={`Foto do torneio ${tournament.name}`} />
            <span>Ver foto maior</span>
          </button>
        ) : null}

        <div className="publicEventMediaInfoDetails">
        <section className="card publicTournamentInfoCard">
          <h2>Informações do torneio</h2>
          <div className="publicInfoGrid">
            {data.registrationDeadline ? <span><CalendarDays aria-hidden="true" /> Inscrições até {formatDateBR(data.registrationDeadline)}</span> : null}
            {registrationClosed ? <span className="closedInfo"><LockKeyhole aria-hidden="true" /> Inscrições encerradas</span> : null}
            {data.eventStartTime ? <span><Clock3 aria-hidden="true" /> Início {data.eventStartTime}</span> : null}
            {data.location ? <span><MapPin aria-hidden="true" /> {data.location}</span> : null}
            {data.winningScore ? <span><Target aria-hidden="true" /> {data.winningScore} games</span> : null}
          </div>
        </section>

        {(publicVisibility.showArenaName && publicOrganizer.arenaName) ||
          (publicVisibility.showOrganizerName && publicOrganizer.organizerName) ||
          (publicVisibility.showWhatsapp && publicOrganizer.whatsapp) ||
          (publicVisibility.showWhatsappGroupLink && publicOrganizer.whatsappGroupLink) ||
          (publicVisibility.showInstagram && (publicOrganizer.instagramHandle || publicOrganizer.instagramLink)) ||
          (publicVisibility.showAddress && publicOrganizer.address) ||
          (publicVisibility.showMapsLink && publicOrganizer.mapsLink) ||
          (publicVisibility.showCityState && (publicOrganizer.city || publicOrganizer.state)) ? (
          <section className="card publicOrganizerCard">
            <h2>Organização</h2>
            <div className="publicOrganizerHeader">
              {publicOrganizer.photoUrl ? <img src={publicOrganizer.photoUrl} alt="Foto do organizador" /> : null}
              <div>
                {publicVisibility.showArenaName && publicOrganizer.arenaName ? <strong>{publicOrganizer.arenaName}</strong> : null}
                {publicVisibility.showOrganizerName && publicOrganizer.organizerName ? <span>{publicOrganizer.organizerName}</span> : null}
              </div>
            </div>
            <div className="publicOrganizerLinks">
              {publicVisibility.showWhatsapp && publicOrganizer.whatsapp ? <a href={getBrazilianWhatsAppUrl(publicOrganizer.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" /> WhatsApp</a> : null}
              {publicVisibility.showWhatsappGroupLink && publicOrganizer.whatsappGroupLink ? <a href={publicOrganizer.whatsappGroupLink} target="_blank" rel="noreferrer"><Users aria-hidden="true" /> Grupo do WhatsApp</a> : null}
              {publicVisibility.showInstagram && publicOrganizer.instagramLink ? <a href={publicOrganizer.instagramLink} target="_blank" rel="noreferrer"><AtSign aria-hidden="true" /> {publicOrganizer.instagramHandle || "Instagram"}</a> : null}
              {publicVisibility.showInstagram && !publicOrganizer.instagramLink && publicOrganizer.instagramHandle ? <span><AtSign aria-hidden="true" /> {publicOrganizer.instagramHandle}</span> : null}
              {publicVisibility.showAddress && publicOrganizer.address ? <span><MapPin aria-hidden="true" /> {publicOrganizer.address}</span> : null}
              {publicVisibility.showCityState && (publicOrganizer.city || publicOrganizer.state) ? <span><MapPin aria-hidden="true" /> {[publicOrganizer.city, publicOrganizer.state].filter(Boolean).join("/")}</span> : null}
              {publicVisibility.showMapsLink && publicOrganizer.mapsLink ? <a href={publicOrganizer.mapsLink} target="_blank" rel="noreferrer"><MapPin aria-hidden="true" /> Ver endereço no mapa</a> : null}
            </div>
          </section>
        ) : null}
        </div>
        </div>

        <nav className="tournamentTopTabs publicTournamentTabs" aria-label="Visualização pública do torneio">
          <button type="button" className={activePublicTab === "participantes" ? "active" : ""} onClick={() => setActivePublicTab("participantes")}><Users aria-hidden="true" /> Participantes</button>
          {isCup ? <button type="button" className={activePublicTab === "grupos" ? "active" : ""} onClick={() => setActivePublicTab("grupos")}><Grid3X3 aria-hidden="true" /> Grupos</button> : null}
          <button type="button" className={activePublicTab === "partidas" ? "active" : ""} onClick={() => setActivePublicTab("partidas")}><Flame aria-hidden="true" /> Partidas</button>
          <button type="button" className={activePublicTab === "ranking" ? "active" : ""} onClick={() => setActivePublicTab("ranking")}><Trophy aria-hidden="true" /> Ranking</button>
        </nav>

        <section className="card publicAthletesCard" style={{ display: activePublicTab === "participantes" ? undefined : "none" }}>
          <div className="cardTitleRow">
            <h2>Participantes</h2>
            <span className="readOnlyBadge">Somente visualização</span>
          </div>
          {config.type === "cearense" || config.type === "cearenseIndividual" || config.type === "playranking" || config.type === "sunset" ? (
            <div className="formatInfoPublicPlacement">
              <TournamentFormatInfoButton data={data} config={config} publicView />
            </div>
          ) : isFlexibleSimpleType(config) ? (
            <div className="formatInfoPublicPlacement">
              <SimpleFormatInfoButton data={data} config={config} publicView />
            </div>
          ) : null}
          <div className="publicAthletesGrid organizerLikeParticipants">
            {publicAthletes.map((group) => (
              <div className="publicAthleteGroup" key={group.title}>
                <h3>{group.title}</h3>
                {group.names.length === 0 ? (
                  <p>Nenhum atleta cadastrado ainda.</p>
                ) : (
                  <div className="publicAthleteList">
                    {group.names.map((name, index) => (
                      <span key={`${group.title}-${index}`}>{name}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {isCup ? (
          <section className="card" style={{ display: activePublicTab === "grupos" ? undefined : "none" }}>
            <div className="cardTitleRow">
              <h2>Grupos</h2>
              <span className="readOnlyBadge">Somente visualização</span>
            </div>
            {!publicRankingReady ? (
              <div className="publicRankingLocked">
                <LockKeyhole aria-hidden="true" />
                <div>
                  <strong>Classificação ainda não liberada</strong>
                  <p>Ela ficará disponível após o preenchimento do último placar do torneio.</p>
                </div>
              </div>
            ) : cupGroupRankings.length > 0 ? (
              <div className="groupsPreviewBox">
                <h3>Classificação dos grupos</h3>
                <CupGroupRankingView
                  className="publicGroupRankings"
                  groupRankings={cupGroupRankings}
                  rankingCriteria={data.rankingCriteria || defaultRankingCriteria}
                />
              </div>
            ) : (
              <p>Os grupos ainda não foram gerados pelo organizador.</p>
            )}
          </section>
        ) : null}

        <section className="card" style={{ display: activePublicTab === "partidas" ? undefined : "none" }}>
          <div className="cardTitleRow">
            <h2>{isCup ? "Partidas" : "Rodadas"}</h2>
            <span className="readOnlyBadge">Somente visualização</span>
          </div>
          {isCup ? (
            <div className="matchesSubTabs">
              <button type="button" className={activePublicMatchesTab === "grupos" ? "active" : ""} onClick={() => setActivePublicMatchesTab("grupos")}>Fase de grupos</button>
              <button type="button" className={activePublicMatchesTab === "chaves" ? "active" : ""} onClick={() => setActivePublicMatchesTab("chaves")}>Chaves finais</button>
              {secondParallelVisible ? <button type="button" className={activePublicMatchesTab === "paralela" ? "active" : ""} onClick={() => setActivePublicMatchesTab("paralela")}>{data.cupConfig?.repechageName || "Disputa paralela"}</button> : null}
              {sunsetSecondParallelVisible ? <button type="button" className={activePublicMatchesTab === "paralela2" ? "active" : ""} onClick={() => setActivePublicMatchesTab("paralela2")}>{data.cupConfig?.secondParallelName || "2ª Disputa Paralela"}</button> : null}
              {thirdParallelVisible ? (
                <button type="button" className={activePublicMatchesTab === "paralela3" ? "active" : ""} onClick={() => setActivePublicMatchesTab("paralela3")}>{data.cupConfig?.thirdRepechageName || "3ª Disputa Paralela"}</button>
              ) : null}
              {sunsetFinalVisible ? <button type="button" className={activePublicMatchesTab === "sunset" ? "active" : ""} onClick={() => setActivePublicMatchesTab("sunset")}>{data.cupConfig?.sunsetBracketName || "Etapa Sunset"}</button> : null}
            </div>
          ) : null}

          <div style={{ display: !isCup || activePublicMatchesTab === "grupos" ? undefined : "none" }}>
            {!data.schedule || data.schedule.length === 0 ? (
              <p>A tabela ainda não foi gerada pelo organizador.</p>
            ) : (
              <ScheduleView schedule={data.schedule} showGroupName={isCup} winningScore={getWinningScore(data)} courtNumbers={data.courtNumbers || []} readOnly />
            )}
          </div>

          {isCup ? (
            <div style={{ display: activePublicMatchesTab === "chaves" ? undefined : "none" }}>
              {!currentBrackets ? <p>As chaves finais ainda não foram geradas pelo organizador.</p> : (
                <PublicCupBracketView
                  groupedBrackets={{ main: currentBrackets.main, repechage: [] }}
                  mainTitle={data.cupConfig?.mainBracketName || "Chave principal"}
                  courtNumbers={data.courtNumbers || []}
                />
              )}
            </div>
          ) : null}

          {isCup && secondParallelVisible ? (
            <div style={{ display: activePublicMatchesTab === "paralela" ? undefined : "none" }}>
              {!currentBrackets
                ? <p>A disputa paralela ainda não foi gerada pelo organizador.</p>
                : currentBrackets.repechage?.length > 0
                  ? (
                    <PublicCupBracketView
                      groupedBrackets={{ main: [], repechage: currentBrackets.repechage }}
                      repechageTitle={data.cupConfig?.repechageName || "Disputa paralela"}
                      courtNumbers={data.courtNumbers || []}
                    />
                  )
                  : <p>{isPlayRankingData(data)
                    ? "A Disputa Paralela aparecerá aqui após o preenchimento de todos os placares da primeira fase da Eliminatória Principal."
                    : "Esta Copinha de 2 grupos não possui chave de consolação."}</p>}
            </div>
          ) : null}

          {isCup && sunsetSecondParallelVisible ? (
            <div style={{ display: activePublicMatchesTab === "paralela2" ? undefined : "none" }}>
              {!currentBrackets
                ? <p>A 2ª disputa paralela ainda não foi gerada pelo organizador.</p>
                : currentBrackets.secondParallel?.length > 0
                  ? (
                    <PublicCupBracketView
                      groupedBrackets={{ main: [], repechage: [], secondParallel: currentBrackets.secondParallel }}
                      secondParallelTitle={data.cupConfig?.secondParallelName || "2ª Disputa Paralela"}
                      courtNumbers={data.courtNumbers || []}
                    />
                  )
                  : <p>Sem eliminadas suficientes nas oitavas, a vice-campeã da Principal ocupará automaticamente esta vaga.</p>}
            </div>
          ) : null}

          {isCup && thirdParallelVisible ? (
            <div style={{ display: activePublicMatchesTab === "paralela3" ? undefined : "none" }}>
              {!currentBrackets
                ? <p>A 3ª disputa paralela ainda não foi gerada pelo organizador.</p>
                : currentBrackets.thirdParallel?.length > 0
                  ? (
                    <PublicCupBracketView
                      groupedBrackets={{ main: [], repechage: [], thirdParallel: currentBrackets.thirdParallel }}
                      thirdRepechageTitle={data.cupConfig?.thirdRepechageName || "3ª Disputa Paralela"}
                      courtNumbers={data.courtNumbers || []}
                    />
                  )
                  : <p>Nesta quantidade de grupos não há duplas elegíveis para a 3ª disputa paralela.</p>}
            </div>
          ) : null}

          {isCup && sunsetFinalVisible ? (
            <div style={{ display: activePublicMatchesTab === "sunset" ? undefined : "none" }}>
              {!currentBrackets
                ? <p>A etapa Sunset ainda não foi gerada pelo organizador.</p>
                : currentBrackets.sunsetFinal?.length > 0
                  ? (
                    <PublicCupBracketView
                      groupedBrackets={{ main: [], repechage: [], sunsetFinal: currentBrackets.sunsetFinal }}
                      sunsetFinalTitle={data.cupConfig?.sunsetBracketName || "Etapa Sunset"}
                      courtNumbers={data.courtNumbers || []}
                    />
                  )
                  : <p>A etapa Sunset aparecerá quando houver ao menos duas chaves capazes de produzir campeãs.</p>}
            </div>
          ) : null}
        </section>

        <section className="card" style={{ display: activePublicTab === "ranking" ? undefined : "none" }}>
          <div className="cardTitleRow">
            <div>
              <h2>{isCup ? "Ranking das chaves" : "Ranking do dia"}</h2>
              {!isCup ? (
                <p className="publicCircuitRankingRule">
                  {getRankingCriteria(data.rankingCriteria || defaultRankingCriteria).label}
                </p>
              ) : null}
            </div>
            <span className="readOnlyBadge">Somente visualização</span>
          </div>
          <TournamentTimingSummary data={data} compact />
          {!publicRankingReady ? (
            <div className="publicRankingLocked">
              <LockKeyhole aria-hidden="true" />
              <div>
                <strong>Ranking ainda não liberado</strong>
                <p>
                  O ranking será exibido quando todos os jogos reais estiverem concluídos.
                  {publicCompletionState.requiredGames > 0
                    ? ` ${publicCompletionState.completedGames} de ${publicCompletionState.requiredGames} placares foram finalizados.`
                    : " As partidas ainda não foram geradas pelo organizador."}
                </p>
              </div>
            </div>
          ) : isCup ? (
            <div className="cupRankingSplit">
              <div className="cupRankingPanel">
                <h3>{data.cupConfig?.mainBracketName || "Chave Principal"}</h3>
                {mainCupPodium.length > 0 ? <CupPodiumView podium={mainCupPodium} title={data.cupConfig?.mainBracketName || "Principal"} shareContext={publicRankingShareContext} /> : <p>Finalize a chave principal para ver o ranking.</p>}
              </div>
              {secondParallelVisible ? <div className="cupRankingPanel">
                <h3>{data.cupConfig?.repechageName || "Disputa Paralela"}</h3>
                {isCopinhaData(data)
                  ? (data.cupConfig?.teamCount === 6
                    ? <p>Com 2 grupos, não há consolação neste formato.</p>
                    : consolationCupPodium.length > 0
                    ? <CupPodiumView podium={consolationCupPodium} title={data.cupConfig?.repechageName || "Consolação"} variant="parallel" shareContext={publicRankingShareContext} />
                    : <p>A consolação ainda não foi finalizada.</p>)
                  : (parallelRanking.length > 0
                    ? <CupPodiumView
                        podium={parallelRanking.slice(0, 3).map((item, index) => ({
                          position: index === 0 ? "🏆 Campeão" : index === 1 ? "🥈 Vice" : "🥉 3º lugar",
                          name: item.name,
                          playTimeSeconds: item.playTimeSeconds,
                        }))}
                        title={data.cupConfig?.repechageName || "Disputa Paralela"}
                        variant="parallel"
                        shareContext={publicRankingShareContext}
                      />
                    : <p>A disputa paralela ainda não tem ranking.</p>)}
              </div> : null}
              {sunsetSecondParallelVisible ? (
                <div className="cupRankingPanel">
                  <h3>{data.cupConfig?.secondParallelName || "2ª Disputa Paralela"}</h3>
                  {secondParallelPodium.length > 0
                    ? <CupPodiumView podium={secondParallelPodium} title={data.cupConfig?.secondParallelName || "2ª Disputa Paralela"} variant="parallel" shareContext={publicRankingShareContext} />
                    : <p>A 2ª disputa paralela ainda não foi finalizada.</p>}
                </div>
              ) : null}
              {thirdParallelVisible ? (
                <div className="cupRankingPanel">
                  <h3>{data.cupConfig?.thirdRepechageName || "3ª Disputa Paralela"}</h3>
                  {thirdParallelPodium.length > 0
                    ? <CupPodiumView podium={thirdParallelPodium} title={data.cupConfig?.thirdRepechageName || "3ª Disputa Paralela"} variant="parallel" shareContext={publicRankingShareContext} />
                    : <p>A 3ª disputa paralela ainda não foi finalizada.</p>}
                </div>
              ) : null}
              {sunsetFinalVisible ? (
                <div className="cupRankingPanel">
                  <h3>{data.cupConfig?.sunsetBracketName || "Etapa Sunset"}</h3>
                  {sunsetPodium.length > 0
                    ? <CupPodiumView podium={sunsetPodium} title={data.cupConfig?.sunsetBracketName || "Etapa Sunset"} shareContext={publicRankingShareContext} />
                    : <p>A etapa Sunset ainda não foi finalizada.</p>}
                </div>
              ) : null}
            </div>
          ) : (
            <RankingView ranking={ranking} type={tournament.type} rankingCriteria={data.rankingCriteria || defaultRankingCriteria} shareContext={publicRankingShareContext} />
          )}
        </section>

      </main>
      <PublicImageLightbox image={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  );
}
