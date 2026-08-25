import { normalizeCircuitRankingSettings } from "./circuitRankingSettings.mjs";
import { modalityConfig } from "./modalityConfig.mjs";
import { createInitialData } from "./tournamentDataNormalization.mjs";
import { generateSchedule } from "./tournamentScheduleFactory.mjs";

export const HOMOLOGATION_PROJECT_REF = "vcixhzvytkrautotinpi";
export const OFFICIAL_PROJECT_REF = "dttutybojealkvuywszt";
export const HOMOLOGATION_LOAD_EMAIL = "torneio360@gmail.com";
export const HOMOLOGATION_LOAD_MARKER = "torneio360-organizer-load-lab-v1";
export const HOMOLOGATION_LOAD_TOURNAMENT_COUNT = 50;
export const HOMOLOGATION_LOAD_CIRCUIT_COUNT = 8;
export const HOMOLOGATION_LOAD_RANKING_ROWS_PER_CIRCUIT = 500;
export const HOMOLOGATION_LOAD_CIRCUIT_PREFIX = "[TESTE DE CARGA]";

const LOAD_MODALITIES = [
  "Reizinho",
  "Super 08",
  "Super 12",
  "Super 10 Mista (Dupla Aleatória)",
  "Super 12 Mista (Dupla Aleatória)",
  "Super 16 Mista (Dupla Aleatória)",
  "Super 20 Mista (Dupla Aleatória)",
  "Super 12 Mista (Dupla Fixa)",
  "Super 16 Mista (Dupla Fixa)",
  "Super 10 (Dupla Fixa)",
  "Super 12 (Dupla Fixa)",
  "Simples 8",
];

const FIRST_NAMES = [
  "Ana", "Bruno", "Carla", "Daniel", "Elisa", "Felipe", "Gabriela", "Henrique",
  "Isabela", "João", "Karina", "Lucas", "Marina", "Nicolas", "Olívia", "Paulo",
  "Renata", "Samuel", "Talita", "Vinícius",
];

const LAST_NAMES = [
  "Almeida", "Barbosa", "Cardoso", "Dias", "Esteves", "Ferreira", "Gomes", "Lima",
  "Martins", "Nogueira", "Oliveira", "Pereira", "Queiroz", "Rocha", "Silva", "Teixeira",
];

export function getSupabaseProjectRef(supabaseUrl) {
  try {
    return new URL(String(supabaseUrl || "")).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

export function assertHomologationLoadTarget({ supabaseUrl, userEmail }) {
  const projectRef = getSupabaseProjectRef(supabaseUrl);
  const normalizedEmail = String(userEmail || "").trim().toLowerCase();

  if (projectRef === OFFICIAL_PROJECT_REF) {
    throw new Error("Operação recusada: o banco informado é o banco oficial.");
  }
  if (projectRef !== HOMOLOGATION_PROJECT_REF) {
    throw new Error("O laboratório só funciona no projeto isolado de homologação.");
  }
  if (normalizedEmail !== HOMOLOGATION_LOAD_EMAIL) {
    throw new Error("O laboratório está restrito à conta autorizada de homologação.");
  }

  return { projectRef, email: normalizedEmail };
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function createLoadPerson(sequence, label = "Atleta") {
  const number = Math.max(1, Number(sequence) || 1);
  const firstName = FIRST_NAMES[(number - 1) % FIRST_NAMES.length];
  const lastName = LAST_NAMES[Math.floor((number - 1) / FIRST_NAMES.length) % LAST_NAMES.length];
  return `${firstName} ${lastName} · ${label} ${String(number).padStart(4, "0")}`;
}

function replaceParticipantNames(players, nextName) {
  if (Array.isArray(players)) return players.map(() => nextName());
  if (!players || typeof players !== "object") return players;

  if (Array.isArray(players.teams)) {
    return {
      ...players,
      teams: players.teams.map(() => ({ a: nextName(), b: nextName() })),
    };
  }

  return {
    ...players,
    men: Array.isArray(players.men) ? players.men.map(() => nextName("Masculino")) : players.men,
    women: Array.isArray(players.women) ? players.women.map(() => nextName("Feminino")) : players.women,
  };
}

function scoreSchedule(schedule, { finished, tournamentIndex }) {
  const games = Array.isArray(schedule) ? schedule : [];
  const totalGames = games.reduce((sum, round) => sum + round.length, 0);
  let gameSequence = 0;

  return games.map((round, roundIndex) => round.map((game, gameIndex) => {
    const shouldScore = finished || gameSequence < Math.ceil(totalGames * 0.42);
    const firstWins = (tournamentIndex + roundIndex + gameIndex) % 2 === 0;
    gameSequence += 1;
    return {
      ...game,
      s1: shouldScore ? (firstWins ? 6 : 3 + ((roundIndex + gameIndex) % 3)) : "",
      s2: shouldScore ? (firstWins ? 2 + ((roundIndex + gameIndex) % 4) : 6) : "",
    };
  }));
}

export function countTournamentParticipantEntries(data) {
  const players = data?.players;
  if (Array.isArray(players)) return players.length;
  if (!players || typeof players !== "object") return 0;
  if (Array.isArray(players.teams)) return players.teams.length * 2;
  return (players.men?.length || 0) + (players.women?.length || 0);
}

export function buildHomologationTournamentRows({
  userId,
  batchId,
  now = new Date(),
  count = HOMOLOGATION_LOAD_TOURNAMENT_COUNT,
} = {}) {
  if (!userId || !batchId) throw new Error("Usuário e lote são obrigatórios para gerar os torneios.");

  const baseDate = new Date(now);
  let participantSequence = 0;

  return Array.from({ length: count }, (_, index) => {
    const type = LOAD_MODALITIES[index % LOAD_MODALITIES.length];
    const config = modalityConfig[type];
    const finished = index < Math.round(count * 0.7);
    const data = createInitialData(type, config);
    const nextName = (label) => createLoadPerson(++participantSequence, label);
    const players = replaceParticipantNames(data.players, nextName);
    const schedule = scoreSchedule(generateSchedule(type, players), {
      finished,
      tournamentIndex: index,
    });
    const eventDate = finished
      ? addDays(baseDate, -(count - index + 12))
      : addDays(baseDate, index - Math.round(count * 0.7) + 2);
    const loadNumber = String(index + 1).padStart(2, "0");
    const createdAt = new Date(baseDate.getTime() - (count - index) * 3_600_000).toISOString();

    return {
      user_id: userId,
      name: `[TESTE DE CARGA] Torneio ${loadNumber}`,
      type,
      data: {
        ...data,
        players,
        schedule,
        namesShuffled: true,
        eventName: `[TESTE DE CARGA] Evento ${String(Math.floor(index / 3) + 1).padStart(2, "0")}`,
        category: `Categoria de desempenho ${((index % 5) + 1)}`,
        participantGenderMode: index % 3 === 0 ? "female" : index % 3 === 1 ? "male" : "mixed",
        gender: index % 3 === 0 ? "Feminino" : index % 3 === 1 ? "Masculino" : "Misto",
        eventDate,
        eventStartDate: eventDate,
        eventEndDate: eventDate,
        registrationDeadline: addDays(new Date(`${eventDate}T12:00:00Z`), -5),
        eventStartTime: `${String(8 + (index % 10)).padStart(2, "0")}:00`,
        location: `Arena de Homologação · Quadra ${(index % 12) + 1}`,
        winningScore: 6,
        rankingCriteria: "wins_points_balance",
        lifecycleStatus: finished ? "finished" : "active",
        publishedOnProfile: true,
        publishedAt: createdAt,
        loadTestMarker: HOMOLOGATION_LOAD_MARKER,
        loadTestBatchId: batchId,
        loadTestSequence: index + 1,
        loadTestParticipantEntries: countTournamentParticipantEntries({ players }),
      },
      status: finished ? "finished" : "active",
      public_id: `load-${batchId.slice(0, 8)}-${loadNumber}`,
      is_public: true,
      created_at: createdAt,
      updated_at: createdAt,
    };
  });
}

export function buildHomologationCircuitRows({
  userId,
  batchId,
  tournaments,
  now = new Date(),
  count = HOMOLOGATION_LOAD_CIRCUIT_COUNT,
} = {}) {
  if (!userId || !batchId || !Array.isArray(tournaments) || tournaments.length === 0) {
    throw new Error("Os torneios inseridos são obrigatórios para gerar os circuitos.");
  }

  const baseDate = new Date(now);
  return Array.from({ length: count }, (_, index) => {
    const linked = Array.from({ length: 10 }, (_, offset) => (
      tournaments[(index * 6 + offset) % tournaments.length]
    ));
    const finished = index < Math.round(count * 0.75);
    const startDate = addDays(baseDate, -(150 - index * 7));
    const endDate = finished ? addDays(baseDate, -(14 - index)) : addDays(baseDate, 90 + index * 7);
    const settings = normalizeCircuitRankingSettings({
      mode: index % 2 === 0 ? "performance" : "placement",
      identity: "individual",
      rankingDivision: "general",
    });

    return {
      user_id: userId,
      name: `${HOMOLOGATION_LOAD_CIRCUIT_PREFIX} Circuito ${String(index + 1).padStart(2, "0")}`,
      start_date: startDate,
      end_date: endDate,
      status: finished ? "finished" : "active",
      tournament_ids: linked.map((tournament) => String(tournament.id)),
      ranking_criteria: "wins_points_balance",
      ranking_criteria_mode: "automatic",
      ranking_settings: {
        ...settings,
        loadTestMarker: HOMOLOGATION_LOAD_MARKER,
        loadTestBatchId: batchId,
        loadTestSequence: index + 1,
      },
    };
  });
}

export function buildHomologationCircuitHistoryRows({
  circuit,
  circuitIndex = 0,
  count = HOMOLOGATION_LOAD_RANKING_ROWS_PER_CIRCUIT,
  now = new Date(),
} = {}) {
  const tournamentIds = Array.isArray(circuit?.tournament_ids) ? circuit.tournament_ids : [];
  if (!circuit?.id || tournamentIds.length === 0) {
    throw new Error("O circuito precisa estar salvo e vinculado a torneios para receber o ranking.");
  }

  return Array.from({ length: count }, (_, index) => {
    const placement = index + 1;
    const points = Math.max(20, 1000 - index * 2);
    const nameSequence = circuitIndex * count + index + 1;
    const tournamentId = tournamentIds[index % tournamentIds.length];

    return {
      tournament_id: tournamentId,
      group_key: "geral",
      player_key: `load-c${circuitIndex + 1}-p${String(index + 1).padStart(4, "0")}`,
      player_name: createLoadPerson(nameSequence, "Ranking"),
      pts: 12 + ((count - index) % 28),
      w: 1 + ((count - index) % 9),
      bal: 18 - (index % 37),
      played: 2 + (index % 10),
      circuit_points: points,
      placement_key: placement === 1 ? "champion" : placement === 2 ? "runnerUp" : placement === 3 ? "third" : "",
      placement_label: placement <= 3 ? `${placement}º lugar` : "Participação",
      titles: placement === 1 ? 1 : 0,
      runner_ups: placement === 2 ? 1 : 0,
      third_places: placement === 3 ? 1 : 0,
      updated_at: new Date(now).toISOString(),
    };
  });
}
