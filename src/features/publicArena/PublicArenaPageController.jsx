import React, { useEffect, useRef, useState } from "react";
import { excludeOrganizationCoverFromGallery } from "../media/organizationGalleryCover.mjs";
import "../../styles/41-responsive-public-covers.css";
import { BeachLogo } from "../appShell/EntryPresentation.jsx";
import { PublicArenaPageView } from "./PublicArenaPresentation.jsx";
import { getBrazilianWhatsAppUrl } from "../../domain/contactLinks.mjs";
import { formatDateBR } from "../../domain/dateTime.mjs";
import {
  ARENA_DIRECTORY_FOCUS_MIN_AGE_MS,
  PUBLIC_ARENA_BUNDLE_REFRESH_INTERVAL_MS,
  PUBLIC_ARENA_EVENT_PAGE_SIZE,
  PUBLIC_TOURNAMENT_REFRESH_INTERVAL_MS,
  readPublicArenaBundleCache,
} from "../../domain/publicArenaCache.mjs";
import {
  normalizePublicCircuitForDisplay,
  sortCircuitsForDisplay,
} from "../../domain/publicArenaData.mjs";
import { normalizeCircuitStatus } from "../../domain/statusFormatting.mjs";
import { navigatePlatform } from "../../domain/platformNavigation.mjs";
import {
  getAutomaticEventStatus,
  isPublicItemFinished,
  sortTournamentsForDisplay,
} from "../../domain/tournamentLifecycle.mjs";

const PUBLIC_ARENA_LOADING_MIN_DURATION_MS = 1500;
const EMBEDDED_ARENA_LOADING_MIN_DURATION_MS = 650;

function createPublicArenaEventPages(counts = {}) {
  const createStatus = (kind, status) => ({
    loaded: false,
    loading: false,
    error: "",
    total: Math.max(0, Number(counts?.[kind]?.[status]) || 0),
    hasMore: false,
    nextOffset: 0,
  });
  return {
    tournaments: {
      active: createStatus("tournaments", "active"),
      finished: createStatus("tournaments", "finished"),
    },
    circuits: {
      active: createStatus("circuits", "active"),
      finished: createStatus("circuits", "finished"),
    },
  };
}

function PublicArenaLoadingScreen() {
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    // Alguns navegadores móveis não disparam `playing` antes de a tela de
    // abertura terminar. Exiba o primeiro quadro assim que houver dados e
    // reforce as propriedades exigidas pelo autoplay silencioso no iOS.
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    const revealVideo = () => setVideoReady(true);
    const revealTimer = window.setTimeout(revealVideo, 900);
    const playback = video.play();
    playback?.catch(() => {
      // O quadro carregado continua visível mesmo quando o sistema bloqueia
      // a reprodução automática. A página não fica presa em uma tela vazia.
      revealVideo();
    });

    return () => window.clearTimeout(revealTimer);
  }, []);

  return (
    <div className="publicArenaLoadingScreen" role="status" aria-live="polite" aria-label="Carregando perfil da organização">
      <video
        ref={videoRef}
        className={`publicArenaLoadingVideo${videoReady ? " isReady" : ""}`}
        src="/arena-profile-loading.mp4"
        autoPlay
        muted
        playsInline
        loop
        preload="auto"
        onLoadedMetadata={() => setVideoReady(true)}
        onLoadedData={() => setVideoReady(true)}
        onCanPlay={() => setVideoReady(true)}
        onPlaying={() => window.requestAnimationFrame(() => setVideoReady(true))}
        aria-hidden="true"
      />
      <div className="publicArenaLoadingCaption">Carregando perfil da organização...</div>
    </div>
  );
}

function EmbeddedArenaLoadingState() {
  return (
    <section className="embeddedArenaLoadingState" role="status" aria-live="polite" aria-label="Carregando perfil da organização">
      <header>
        <span className="embeddedArenaLoadingMark" aria-hidden="true"><i /><i /><i /></span>
        <div>
          <strong>Abrindo perfil da organização</strong>
          <small>Preparando torneios, fotos e informações públicas</small>
        </div>
      </header>
      <div className="embeddedArenaLoadingSkeleton" aria-hidden="true">
        <span className="embeddedArenaLoadingAvatar" />
        <div><i /><i /><i /></div>
        <span className="embeddedArenaLoadingAction" />
      </div>
    </section>
  );
}

export default function PublicArenaPageController({ arenaId = null, publicId = null, session = null, runtime, embedded = false }) {
  const {
    PublicArenaHeroHeader,
    PublicArenaTournamentCards,
    PublicCircuitScreen,
    PublicTournamentScreen,
    fetchPublicArenaBundle,
    fetchPublicArenaEventsPage,
    fetchPublicArenaInitialView,
    fetchPublicArenaPhoto,
    fetchPublicCircuitCover,
    fetchPublicCircuitDetail,
    fetchPublicTournamentCover,
    fetchPublicTournamentDetail,
    refreshPublicTournamentDetail,
    loadPublicOrganizationGallery,
  } = runtime;
  const [loading, setLoading] = useState(true);
  const [minimumLoadingElapsed, setMinimumLoadingElapsed] = useState(false);
  const [bundle, setBundle] = useState(null);
  const [error, setError] = useState("");
  const [activeArenaTab, setActiveArenaTab] = useState("tournaments");
  const [activeStatusTab, setActiveStatusTab] = useState("active");
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [selectedCircuit, setSelectedCircuit] = useState(null);
  const [openingPublicId, setOpeningPublicId] = useState(null);
  const [openingCircuitId, setOpeningCircuitId] = useState(null);
  const [organizationGallery, setOrganizationGallery] = useState([]);
  const [eventPages, setEventPages] = useState(() => createPublicArenaEventPages());
  const requestedTournamentCoversRef = useRef(new Set());
  const requestedCircuitCoversRef = useRef(new Set());
  const tournamentCoverCacheRef = useRef(new Map());
  const circuitCoverCacheRef = useRef(new Map());
  const bundleRequestInFlightRef = useRef(false);
  const eventPageRequestsRef = useRef(new Set());
  const eventPagesRef = useRef(eventPages);
  const lastBundleLoadAtRef = useRef(0);
  const selectedPublicTournamentRef = useRef(null);
  eventPagesRef.current = eventPages;

  useEffect(() => {
    selectedPublicTournamentRef.current = selectedTournament;
  }, [selectedTournament]);

  function getTournamentCardCoverKey(tournament) {
    const details = tournament?.data || {};
    return details.multiCategoryEvent === true && details.eventGroupKey
      ? `group:${details.eventGroupKey}`
      : `tournament:${tournament?.id || tournament?.public_id || ""}`;
  }

  function applyTournamentCardCover(tournament, coverImageUrl) {
    if (!coverImageUrl) return tournament;
    const details = tournament?.data || {};
    return {
      ...tournament,
      data: {
        ...details,
        ...(details.multiCategoryEvent === true
          ? { eventCoverImageUrl: coverImageUrl }
          : { coverImageUrl }),
      },
    };
  }

  const loadTournamentCardCover = React.useCallback(async (tournament) => {
    const tournamentPublicId = String(tournament?.public_id || "").trim();
    const coverKey = getTournamentCardCoverKey(tournament);
    if (!tournamentPublicId || !coverKey || requestedTournamentCoversRef.current.has(coverKey)) return;
    requestedTournamentCoversRef.current.add(coverKey);
    const coverImageUrl = await fetchPublicTournamentCover(tournamentPublicId);
    if (!coverImageUrl) return;
    tournamentCoverCacheRef.current.set(coverKey, coverImageUrl);
    setBundle((current) => current ? {
      ...current,
      tournaments: (current.tournaments || []).map((item) => (
        getTournamentCardCoverKey(item) === coverKey ? applyTournamentCardCover(item, coverImageUrl) : item
      )),
    } : current);
  }, []);

  const loadCircuitCardCover = React.useCallback(async (circuit) => {
    const circuitId = String(circuit?.id || "").trim();
    if (!circuitId || requestedCircuitCoversRef.current.has(circuitId)) return;
    requestedCircuitCoversRef.current.add(circuitId);
    const coverImageUrl = await fetchPublicCircuitCover(circuitId);
    if (!coverImageUrl) return;
    circuitCoverCacheRef.current.set(circuitId, coverImageUrl);
    setBundle((current) => current ? {
      ...current,
      circuits: (current.circuits || []).map((item) => String(item.id) === circuitId ? {
        ...item,
        coverImageUrl,
        ranking_settings: { ...(item.ranking_settings || {}), coverImageUrl },
        rankingSettings: { ...(item.rankingSettings || {}), coverImageUrl },
      } : item),
    } : current);
  }, []);

  function loadProfilePhotoInBackground(profile) {
    const profileId = String(profile?.id || "");
    if (!profileId || profile?.photo_url || !profile?.has_photo) return;

    void fetchPublicArenaPhoto(profileId).then((photoUrl) => {
      if (!photoUrl) return;
      setBundle((current) => {
        if (String(current?.profile?.id || "") !== profileId) return current;
        return {
          ...current,
          profile: { ...current.profile, photo_url: photoUrl },
        };
      });
    });
  }

  async function loadPublicEventPage({ kind, status, append = false }) {
    const normalizedKind = kind === "circuits" ? "circuits" : "tournaments";
    const normalizedStatus = status === "finished" ? "finished" : "active";
    const requestKey = `${normalizedKind}:${normalizedStatus}`;
    if (eventPageRequestsRef.current.has(requestKey)) return;

    const currentPage = eventPagesRef.current?.[normalizedKind]?.[normalizedStatus];
    if (!append && currentPage?.loaded) return;
    if (append && (!currentPage?.hasMore || currentPage?.loading)) return;

    eventPageRequestsRef.current.add(requestKey);
    setEventPages((current) => ({
      ...current,
      [normalizedKind]: {
        ...current[normalizedKind],
        [normalizedStatus]: {
          ...current[normalizedKind][normalizedStatus],
          loading: true,
          error: "",
        },
      },
    }));

    const result = await fetchPublicArenaEventsPage({
      arenaId,
      publicId,
      kind: normalizedKind,
      status: normalizedStatus,
      limit: PUBLIC_ARENA_EVENT_PAGE_SIZE,
      offset: append ? currentPage?.nextOffset || 0 : 0,
    });
    eventPageRequestsRef.current.delete(requestKey);

    if (result.error || !result.data) {
      console.warn("Não foi possível carregar a página pública de eventos.", result.error);
      setEventPages((current) => ({
        ...current,
        [normalizedKind]: {
          ...current[normalizedKind],
          [normalizedStatus]: {
            ...current[normalizedKind][normalizedStatus],
            loading: false,
            error: "Não foi possível carregar estes eventos agora.",
          },
        },
      }));
      return;
    }

    const pageItems = normalizedKind === "circuits"
      ? result.data.items.map((item) => normalizePublicCircuitForDisplay(item, { directoryEntry: true }))
      : result.data.items;
    setBundle((current) => {
      if (!current) return current;
      const existing = Array.isArray(current[normalizedKind]) ? current[normalizedKind] : [];
      const belongsToStatus = (item) => isPublicItemFinished(
        item,
        normalizedKind === "circuits" ? "circuit" : "tournament"
      ) === (normalizedStatus === "finished");
      const otherStatusItems = existing.filter((item) => !belongsToStatus(item));
      const currentStatusItems = append ? existing.filter(belongsToStatus) : [];
      const mergedById = new Map(
        [...currentStatusItems, ...pageItems].map((item) => [String(item.id), item])
      );
      return {
        ...current,
        [normalizedKind]: [...otherStatusItems, ...mergedById.values()],
      };
    });
    setEventPages((current) => ({
      ...current,
      [normalizedKind]: {
        ...current[normalizedKind],
        [normalizedStatus]: {
          loaded: true,
          loading: false,
          error: "",
          total: result.data.total,
          hasMore: result.data.hasMore,
          nextOffset: result.data.nextOffset,
        },
      },
    }));
  }

  async function loadBundle({ silent = false } = {}) {
    if (bundleRequestInFlightRef.current) return;
    bundleRequestInFlightRef.current = true;
    if (!silent) setLoading(true);
    try {
      const initialView = silent
        ? null
        : await fetchPublicArenaInitialView({ arenaId, publicId });
      const result = initialView?.bundle || await fetchPublicArenaBundle({ arenaId, publicId });

      if (result.error || !result.data?.profile) {
        console.error(result.error);
        if (!silent) {
          setError("Não foi possível abrir o perfil desta arena.");
          setBundle(null);
        }
      } else {
        const usesServerPagination = result.data.pagination?.enabled === true;
        const initialActiveTournaments = usesServerPagination && initialView?.activeTournaments?.data
          ? initialView.activeTournaments.data
          : null;
        const initialTournamentRows = initialActiveTournaments?.items || result.data.tournaments || [];
        const tournamentsWithCachedCovers = initialTournamentRows.map((tournament) => {
          const cachedCover = tournamentCoverCacheRef.current.get(getTournamentCardCoverKey(tournament));
          return cachedCover ? applyTournamentCardCover(tournament, cachedCover) : tournament;
        });
        const normalizedCircuits = (result.data.circuits || []).map((circuit) => {
          const cachedCover = circuitCoverCacheRef.current.get(String(circuit.id));
          const circuitWithCover = cachedCover ? {
            ...circuit,
            coverImageUrl: cachedCover,
            ranking_settings: { ...(circuit.ranking_settings || {}), coverImageUrl: cachedCover },
          } : circuit;
          return normalizePublicCircuitForDisplay(circuitWithCover, { directoryEntry: true });
        });
        const normalizedBundle = { ...result.data, tournaments: tournamentsWithCachedCovers, circuits: normalizedCircuits };
        setBundle((current) => usesServerPagination && current?.profile?.id === normalizedBundle.profile?.id
          ? {
            ...normalizedBundle,
            tournaments: current.tournaments || [],
            circuits: current.circuits || [],
          }
          : normalizedBundle);
        if (usesServerPagination) {
          setEventPages((current) => {
            const next = { ...current };
            ["tournaments", "circuits"].forEach((kind) => {
              next[kind] = { ...current[kind] };
              ["active", "finished"].forEach((status) => {
                next[kind][status] = {
                  ...current[kind][status],
                  total: Math.max(0, Number(result.data.counts?.[kind]?.[status]) || 0),
                };
              });
            });
            if (initialActiveTournaments) {
              next.tournaments.active = {
                ...next.tournaments.active,
                loaded: true,
                loading: false,
                error: "",
                total: initialActiveTournaments.total,
                hasMore: initialActiveTournaments.hasMore,
                nextOffset: initialActiveTournaments.nextOffset,
              };
            }
            return next;
          });
        } else {
          const legacyCounts = {
            tournaments: {
              active: tournamentsWithCachedCovers.filter((item) => !isPublicItemFinished(item, "tournament")).length,
              finished: tournamentsWithCachedCovers.filter((item) => isPublicItemFinished(item, "tournament")).length,
            },
            circuits: {
              active: normalizedCircuits.filter((item) => !isPublicItemFinished(item, "circuit")).length,
              finished: normalizedCircuits.filter((item) => isPublicItemFinished(item, "circuit")).length,
            },
          };
          const legacyPages = createPublicArenaEventPages(legacyCounts);
          ["tournaments", "circuits"].forEach((kind) => {
            ["active", "finished"].forEach((status) => {
              legacyPages[kind][status].loaded = true;
            });
          });
          setEventPages(legacyPages);
        }
        loadProfilePhotoInBackground(normalizedBundle.profile);
        if (!usesServerPagination) setSelectedTournament((current) => {
          if (!current) return null;
          const directoryItem = (normalizedBundle.tournaments || []).find((item) => item.id === current.id);
          if (!directoryItem) return null;
          if (current.directoryEntry !== true) {
            return { ...directoryItem, ...current, data: current.data };
          }
          return directoryItem;
        });
        if (!usesServerPagination) setSelectedCircuit((current) => {
          if (!current) return null;
          const directoryItem = normalizedCircuits.find((item) => String(item.id) === String(current.id));
          if (!directoryItem) return null;
          if (current.directoryEntry !== true) {
            return { ...directoryItem, ...current };
          }
          return directoryItem;
        });
        setError("");
        lastBundleLoadAtRef.current = Date.now();
      }
    } finally {
      bundleRequestInFlightRef.current = false;
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    setMinimumLoadingElapsed(false);
    setEventPages(createPublicArenaEventPages());
    eventPageRequestsRef.current.clear();
    const minimumLoadingTimer = window.setTimeout(
      () => setMinimumLoadingElapsed(true),
      embedded ? EMBEDDED_ARENA_LOADING_MIN_DURATION_MS : PUBLIC_ARENA_LOADING_MIN_DURATION_MS
    );
    const cachedBundle = readPublicArenaBundleCache({ arenaId, publicId });
    if (cachedBundle?.profile) {
      setBundle(cachedBundle);
      loadProfilePhotoInBackground(cachedBundle.profile);
      setError("");
      setLoading(false);
      void loadBundle({ silent: true });
    } else {
      void loadBundle();
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastBundleLoadAtRef.current < ARENA_DIRECTORY_FOCUS_MIN_AGE_MS) return;
      void loadBundle({ silent: true });
    };
    const interval = window.setInterval(refreshWhenVisible, PUBLIC_ARENA_BUNDLE_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(minimumLoadingTimer);
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [arenaId, publicId, embedded]);

  useEffect(() => {
    const organizationId = bundle?.profile?.id;
    if (!organizationId || !loadPublicOrganizationGallery) {
      setOrganizationGallery([]);
      return undefined;
    }
    let active = true;
    loadPublicOrganizationGallery(organizationId).then(async (result) => {
      if (!active) return;
      if (result?.error) {
        setOrganizationGallery([]);
        return;
      }
      const photos = (result?.photos || []).slice(0, 6);
      const separateCoverUrl = String(bundle?.profile?.cover_url || "").trim();
      const visiblePhotos = separateCoverUrl
        ? await excludeOrganizationCoverFromGallery(photos, separateCoverUrl)
        : photos.slice(1);
      if (active) setOrganizationGallery(visiblePhotos);
    });
    return () => { active = false; };
  }, [bundle?.profile?.id, bundle?.profile?.cover_url, loadPublicOrganizationGallery]);

  useEffect(() => {
    if (!bundle?.profile || bundle.pagination?.enabled !== true) return;
    const currentPage = eventPagesRef.current?.[activeArenaTab]?.[activeStatusTab];
    if (!currentPage?.loaded && !currentPage?.loading) {
      void loadPublicEventPage({ kind: activeArenaTab, status: activeStatusTab });
    }
  }, [bundle?.profile?.id, bundle?.pagination?.enabled, activeArenaTab, activeStatusTab]);

  useEffect(() => {
    const targetPublicId = String(publicId || "").trim();
    if (!targetPublicId || !bundle?.profile || selectedTournament || openingPublicId) return;
    const directoryItem = (bundle.tournaments || []).find((item) => String(item.public_id || "") === targetPublicId);
    if (directoryItem) void openPublicTournament(directoryItem);
  }, [publicId, bundle?.profile?.id, bundle?.tournaments, selectedTournament, openingPublicId]);

  useEffect(() => {
    const selectedPublicId = String(selectedTournament?.public_id || "").trim();
    if (!selectedPublicId || selectedTournament?.directoryEntry === true) return undefined;
    let active = true;
    let requestInFlight = false;

    const refreshSelectedTournament = async () => {
      if (!active || requestInFlight || document.visibilityState !== "visible") return;
      const current = selectedPublicTournamentRef.current;
      if (!current || String(current.public_id || "") !== selectedPublicId) return;
      requestInFlight = true;
      const result = await refreshPublicTournamentDetail(selectedPublicId, current.updated_at || null);
      requestInFlight = false;
      if (!active || result.error || !result.changed || !result.data) return;
      setSelectedTournament((latest) => (
        latest && String(latest.public_id || "") === selectedPublicId
          ? { ...latest, ...result.data, directoryEntry: false }
          : latest
      ));
    };

    const interval = window.setInterval(refreshSelectedTournament, PUBLIC_TOURNAMENT_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshSelectedTournament);
    document.addEventListener("visibilitychange", refreshSelectedTournament);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshSelectedTournament);
      document.removeEventListener("visibilitychange", refreshSelectedTournament);
    };
  }, [selectedTournament?.public_id, selectedTournament?.directoryEntry]);

  useEffect(() => {
    setActiveStatusTab("active");
  }, [activeArenaTab]);

  async function openPublicTournament(item) {
    if (!item?.directoryEntry) {
      setSelectedTournament(item);
      return;
    }

    setOpeningPublicId(item.public_id);
    const result = await fetchPublicTournamentDetail(item.public_id);
    setOpeningPublicId(null);

    if (result.error || !result.data) {
      console.error(result.error);
      return;
    }

    setSelectedTournament({ ...item, ...result.data, directoryEntry: false });
  }

  async function openPublicCircuit(item) {
    if (!item?.directoryEntry) {
      setSelectedCircuit(item);
      return;
    }

    setOpeningCircuitId(item.id);
    const result = await fetchPublicCircuitDetail(item.id);
    setOpeningCircuitId(null);

    if (result.error || !result.data) {
      console.error(result.error);
      return;
    }

    setSelectedCircuit(normalizePublicCircuitForDisplay(result.data, { directoryEntry: false }));
  }

  if (loading || !minimumLoadingElapsed) {
    return embedded ? <EmbeddedArenaLoadingState /> : <PublicArenaLoadingScreen />;
  }

  if (error || !bundle?.profile) {
    if (embedded) {
      return <div className="publicDirectoryState publicDirectoryError">{error || "Este perfil não está disponível."}</div>;
    }
    return (
      <div className="publicPage publicUnavailablePage">
        <div className="center">
          <BeachLogo />
          <h1>Perfil indisponível</h1>
          <p>{error || "Este perfil não está disponível."}</p>
          <button type="button" onClick={() => window.location.assign(`${window.location.origin}/#organizacoes`)}>Explorar outras organizações</button>
        </div>
      </div>
    );
  }

  const profile = bundle.profile;
  const loadedTournaments = Array.isArray(bundle.tournaments) ? bundle.tournaments : [];
  const loadedCircuits = Array.isArray(bundle.circuits) ? bundle.circuits : [];
  const tournaments = bundle.pagination?.enabled === true
    ? loadedTournaments
    : sortTournamentsForDisplay(loadedTournaments);
  const circuits = bundle.pagination?.enabled === true
    ? loadedCircuits
    : sortCircuitsForDisplay(loadedCircuits);
  const arenaName = profile.arena_name || profile.name || "Arena Torneio360";
  const organizer = {
    id: profile.id,
    photoUrl: profile.photo_url || "",
    arenaName,
    organizerName: profile.name || "",
    whatsapp: profile.phone || "",
    address: profile.address || "",
    mapsLink: profile.maps_link || "",
    instagramHandle: profile.instagram_handle || "",
    instagramLink: profile.instagram_link || "",
    whatsappGroupLink: profile.whatsapp_group_link || "",
    pixKey: profile.pix_key || "",
    cardPaymentLink: profile.card_payment_link || "",
    city: profile.city || "",
    state: profile.state || "",
  };

  if (selectedTournament) {
    return (
      <PublicTournamentScreen
        tournament={selectedTournament}
        organizer={organizer}
        onBackToArena={() => setSelectedTournament(null)}
        embedded={embedded}
        initialTab={new URLSearchParams(window.location.search).get("inscricao") === "1" ? "inscricao" : ""}
        viewer={session?.user || null}
        onRequireLogin={() => {
          const url = new URL(window.location.origin);
          url.searchParams.set("cadastro", "conta");
          window.location.assign(url.toString());
        }}
      />
    );
  }

  if (selectedCircuit) {
    return (
      <PublicCircuitScreen
        circuit={selectedCircuit}
        tournaments={Array.isArray(selectedCircuit.tournaments) ? selectedCircuit.tournaments : tournaments}
        organizer={organizer}
        onBackToArena={() => setSelectedCircuit(null)}
        embedded={embedded}
      />
    );
  }

  const activeItems = activeArenaTab === "tournaments"
    ? tournaments.filter((item) => !isPublicItemFinished(item, "tournament"))
    : circuits.filter((item) => !isPublicItemFinished(item, "circuit"));
  const finishedItems = activeArenaTab === "tournaments"
    ? tournaments.filter((item) => isPublicItemFinished(item, "tournament"))
    : circuits.filter((item) => isPublicItemFinished(item, "circuit"));
  const visibleItems = activeStatusTab === "finished" ? finishedItems : activeItems;
  const currentEventPage = eventPages?.[activeArenaTab]?.[activeStatusTab];
  const serverPagination = bundle.pagination?.enabled === true ? {
    activeTotal: eventPages?.[activeArenaTab]?.active?.total || 0,
    finishedTotal: eventPages?.[activeArenaTab]?.finished?.total || 0,
    hasMore: currentEventPage?.hasMore === true,
    loading: currentEventPage?.loading === true,
    error: currentEventPage?.error || "",
    onLoadMore: () => loadPublicEventPage({
      kind: activeArenaTab,
      status: activeStatusTab,
      append: true,
    }),
  } : null;

  return (
    <PublicArenaPageView
      arenaName={arenaName}
      organizer={organizer}
      organizationGallery={organizationGallery}
      hasSession={Boolean(session)}
      onRequireLogin={() => {
        const url = new URL(window.location.origin);
        url.searchParams.set("cadastro", "conta");
        url.hash = "acesso";
        navigatePlatform({ cadastro: "conta" });
      }}
      activeArenaTab={activeArenaTab}
      activeStatusTab={activeStatusTab}
      activeItems={activeItems}
      finishedItems={finishedItems}
      visibleItems={visibleItems}
      serverPagination={serverPagination}
      onArenaTabChange={setActiveArenaTab}
      onStatusTabChange={setActiveStatusTab}
      onOpenTournament={openPublicTournament}
      onOpenCircuit={openPublicCircuit}
      onRequestTournamentCover={loadTournamentCardCover}
      onRequestCircuitCover={loadCircuitCardCover}
      openingPublicId={openingPublicId}
      openingCircuitId={openingCircuitId}
      getWhatsAppUrl={getBrazilianWhatsAppUrl}
      getCircuitStatus={(item) => normalizeCircuitStatus(getAutomaticEventStatus(item.end_date || item.endDate))}
      getCircuitDateLabel={(item) => item.start_date ? `${formatDateBR(item.start_date)} até ${formatDateBR(item.end_date)}` : ""}
      getCircuitTournamentCount={(item) => (item.tournament_ids || []).length}
      HeroHeader={PublicArenaHeroHeader}
      TournamentCards={PublicArenaTournamentCards}
      embedded={embedded}
    />
  );
}
