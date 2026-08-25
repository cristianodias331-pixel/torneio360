import React, { useEffect, useState } from "react";
import { PublicArenaPageView } from "./PublicArenaPresentation.jsx";
import { getBrazilianWhatsAppUrl } from "../../domain/contactLinks.mjs";
import { formatDateBR } from "../../domain/dateTime.mjs";
import { normalizeTournamentData } from "../../domain/tournamentDataNormalization.mjs";
import {
  normalizePublicCircuitForDisplay,
  sortCircuitsForDisplay,
} from "../../domain/publicArenaData.mjs";
import {
  defaultRankingCriteria,
} from "../../domain/rankingCriteria.mjs";
import { normalizeCircuitRankingSettings } from "../../domain/circuitRankingSettings.mjs";
import { normalizeCircuitStatus } from "../../domain/statusFormatting.mjs";
import {
  getAutomaticEventStatus,
  isPublicItemFinished,
  sortTournamentsForDisplay,
} from "../../domain/tournamentLifecycle.mjs";

export default function PublicTournamentPageController({ publicId, runtime }) {
  const {
    PublicArenaHeroHeader,
    PublicArenaTournamentCards,
    PublicCircuitScreen,
    PublicTournamentScreen,
    fetchPublicCircuitDetail,
    supabase,
  } = runtime;
  const [loading, setLoading] = useState(true);
  const [anchorTournament, setAnchorTournament] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [circuits, setCircuits] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [selectedCircuit, setSelectedCircuit] = useState(null);
  const [activeArenaTab, setActiveArenaTab] = useState("tournaments");
  const [activeStatusTab, setActiveStatusTab] = useState("active");
  const [openingPublicId, setOpeningPublicId] = useState(null);
  const [openingCircuitId, setOpeningCircuitId] = useState(null);
  const [error, setError] = useState(null);

  async function loadPublicArena({ silent = false } = {}) {
    if (!silent) setLoading(true);

    const { data: publicTournament, error: publicTournamentError } = await supabase
      .rpc("get_public_tournament", { p_public_id: publicId })
      .maybeSingle();

    if (publicTournamentError || !publicTournament) {
      console.error(publicTournamentError);
      setError("Link público não encontrado ou desativado.");
      setAnchorTournament(null);
      setTournaments([]);
      setCircuits([]);
    } else {
      const visibleAnchor = { ...publicTournament, is_public: true };
      const ownerId = publicTournament.user_id;
      const [tournamentsResult, circuitsResult] = await Promise.all([
        supabase
          .from("tournaments")
          .select("*")
          .eq("user_id", ownerId)
          .eq("is_public", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("circuits")
          .select("id, user_id, name, start_date, end_date, status, tournament_ids, ranking_criteria, ranking_settings, updated_at")
          .eq("user_id", ownerId)
          .order("updated_at", { ascending: false }),
      ]);

      const tournamentDirectory = Array.isArray(publicTournament.data?.publicArenaDirectory)
        ? publicTournament.data.publicArenaDirectory.filter((item) => item?.public_id)
        : [];
      const publicTournaments = tournamentsResult.error
        ? tournamentDirectory
        : (tournamentsResult.data || []).filter((item) => !item.data?.deletedAt);
      const uniqueTournaments = Array.from(
        new Map([...publicTournaments, visibleAnchor].map((item) => [item.public_id || item.id, item])).values()
      );
      const circuitSnapshot = Array.isArray(publicTournament.data?.publicArenaCircuits)
        ? publicTournament.data.publicArenaCircuits
        : [];
      const circuitSnapshotById = new Map(circuitSnapshot.map((item) => [String(item.id), item]));
      const publicCircuits = circuitsResult.error
        ? circuitSnapshot
        : (circuitsResult.data || []).map((item) => {
          const snapshot = circuitSnapshotById.get(String(item.id)) || {};
          return {
            ...snapshot,
            ...item,
            ranking_criteria: snapshot.ranking_criteria || item.ranking_criteria || defaultRankingCriteria,
            ranking_settings: snapshot.ranking_settings || item.ranking_settings || normalizeCircuitRankingSettings(),
            ranking_groups: snapshot.ranking_groups || item.ranking_groups || [],
          };
        });

      if (tournamentsResult.error) {
        console.warn("A listagem pública completa de torneios não está disponível; exibindo o torneio do link.", tournamentsResult.error);
      }

      if (circuitsResult.error && circuitSnapshot.length === 0) {
        console.warn("A listagem pública de circuitos ainda não está disponível.", circuitsResult.error);
      }

      setAnchorTournament(visibleAnchor);
      setTournaments(uniqueTournaments);
      setCircuits(sortCircuitsForDisplay(publicCircuits));
      setSelectedTournament((current) => {
        if (!current) return null;
        return uniqueTournaments.find((item) => item.id === current.id) || current;
      });
      setSelectedCircuit((current) => {
        if (!current) return null;
        const directoryItem = publicCircuits.find((item) => String(item.id) === String(current.id));
        if (!directoryItem) return current;
        if (current.directoryEntry !== true) return { ...directoryItem, ...current };
        return directoryItem;
      });
      setError(null);
    }

    if (!silent) setLoading(false);
  }

  useEffect(() => {
    loadPublicArena();

    const interval = setInterval(() => {
      loadPublicArena({ silent: true });
    }, 20000);

    return () => clearInterval(interval);
  }, [publicId]);

  useEffect(() => {
    setActiveStatusTab("active");
  }, [activeArenaTab]);

  async function openPublicTournament(item) {
    if (!item?.directoryEntry) {
      setSelectedTournament(item);
      return;
    }

    setOpeningPublicId(item.public_id);
    const { data, error: tournamentError } = await supabase
      .rpc("get_public_tournament", { p_public_id: item.public_id })
      .maybeSingle();
    setOpeningPublicId(null);

    if (tournamentError || !data) {
      console.error(tournamentError);
      setError("Este torneio não está mais disponível no perfil da arena.");
      return;
    }

    setSelectedTournament({ ...item, ...data });
  }

  async function openPublicCircuit(item) {
    setOpeningCircuitId(item.id);
    const result = await fetchPublicCircuitDetail(item.id);
    setOpeningCircuitId(null);

    if (result.error || !result.data) {
      console.error(result.error);
      setError("Este circuito não está mais disponível no perfil da arena.");
      return;
    }

    setSelectedCircuit(normalizePublicCircuitForDisplay(result.data, { directoryEntry: false }));
  }

  if (loading) {
    return (
      <div className="publicPage">
        <div className="center">
          <h1>Carregando tabela...</h1>
        </div>
      </div>
    );
  }

  if (error || !anchorTournament) {
    return (
      <div className="publicPage">
        <div className="center">
          <h1>Link indisponível</h1>
          <p>{error || "Não foi possível carregar esta tabela."}</p>
        </div>
      </div>
    );
  }

  if (selectedTournament) {
    return (
      <PublicTournamentScreen
        tournament={selectedTournament}
        onBackToArena={() => setSelectedTournament(null)}
      />
    );
  }

  const anchorData = normalizeTournamentData(anchorTournament.type, anchorTournament.data);
  const publicOrganizer = anchorData.publicInfo?.organizer || {};
  const orderedPublicTournaments = sortTournamentsForDisplay(tournaments);
  if (selectedCircuit) {
    return (
      <PublicCircuitScreen
        circuit={selectedCircuit}
        tournaments={orderedPublicTournaments}
        organizer={publicOrganizer}
        onBackToArena={() => setSelectedCircuit(null)}
      />
    );
  }
  const activeItems = activeArenaTab === "tournaments"
    ? orderedPublicTournaments.filter((item) => !isPublicItemFinished(item, "tournament"))
    : circuits.filter((item) => !isPublicItemFinished(item, "circuit"));
  const finishedItems = activeArenaTab === "tournaments"
    ? orderedPublicTournaments.filter((item) => isPublicItemFinished(item, "tournament"))
    : circuits.filter((item) => isPublicItemFinished(item, "circuit"));
  const visibleItems = activeStatusTab === "finished" ? finishedItems : activeItems;
  const arenaName = publicOrganizer.arenaName || anchorTournament.name || "Arena Torneio360";

  return (
    <PublicArenaPageView
      arenaName={arenaName}
      organizer={publicOrganizer}
      pageClassName=""
      heroLabel="Perfil da arena"
      contactDescription="Escolha um torneio para acompanhar participantes, jogos, chaves e resultados sem fazer login."
      activeArenaTab={activeArenaTab}
      activeStatusTab={activeStatusTab}
      activeItems={activeItems}
      finishedItems={finishedItems}
      visibleItems={visibleItems}
      onArenaTabChange={setActiveArenaTab}
      onStatusTabChange={setActiveStatusTab}
      onOpenTournament={openPublicTournament}
      onOpenCircuit={openPublicCircuit}
      openingPublicId={openingPublicId}
      openingCircuitId={openingCircuitId}
      getWhatsAppUrl={getBrazilianWhatsAppUrl}
      getCircuitStatus={(item) => normalizeCircuitStatus(getAutomaticEventStatus(item.end_date || item.endDate))}
      getCircuitDateLabel={(item) => item.start_date || item.startDate ? formatDateBR(item.start_date || item.startDate) : ""}
      getCircuitTournamentCount={(item) => (item.tournament_ids || item.tournamentIds || []).length}
      HeroHeader={PublicArenaHeroHeader}
      TournamentCards={PublicArenaTournamentCards}
    />
  );
}
