const SUPABASE_URL = "https://dttutybojealkvuywszt.supabase.co";
const SUPABASE_KEY = "sb_publishable_Tr5qiUea-p42UknVoWwPKg_6K_b1EX_";

async function rpc(name, body) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${SUPABASE_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${name}: HTTP ${response.status} — ${await response.text()}`);
  }
  return response.json();
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isGame(value) {
  if (!isObject(value)) return false;
  return ["team1", "team2", "ids1", "ids2", "s1", "s2", "matchKey", "court"]
    .some((field) => Object.prototype.hasOwnProperty.call(value, field));
}

function collectGames(value, output = [], visited = new Set()) {
  if (!value || typeof value !== "object" || visited.has(value)) return output;
  visited.add(value);
  if (isGame(value)) {
    output.push(value);
    return output;
  }
  Object.values(value).forEach((child) => collectGames(child, output, visited));
  return output;
}

function collectGamesWithPath(value, path = [], output = [], visited = new Set()) {
  if (!value || typeof value !== "object" || visited.has(value)) return output;
  visited.add(value);
  if (isGame(value)) {
    output.push({ game: value, path });
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => collectGamesWithPath(child, [...path, index], output, visited));
  } else {
    Object.entries(value).forEach(([key, child]) => collectGamesWithPath(child, [...path, key], output, visited));
  }
  return output;
}

function hasScore(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function getRunningTimerSeconds(game, now = Date.now()) {
  if (game?.inProgress !== true || !game?.matchTimerStartedAt) return null;
  const startedAt = new Date(game.matchTimerStartedAt).getTime();
  if (!Number.isFinite(startedAt)) return null;
  const stored = Math.max(0, Number(game.matchTimerElapsedSeconds || 0));
  return Math.floor(stored + Math.max(0, now - startedAt) / 1000);
}

function countParticipantSlots(players) {
  if (Array.isArray(players)) return players.length;
  if (!isObject(players)) return 0;
  return Object.values(players).reduce((total, group) => {
    if (!Array.isArray(group)) return total;
    return total + group.reduce((subtotal, participant) => {
      if (typeof participant === "string") return subtotal + 1;
      if (!isObject(participant)) return subtotal;
      return subtotal + [participant.a, participant.b].filter((name) => typeof name === "string").length;
    }, 0);
  }, 0);
}

function listParticipantNames(players) {
  if (Array.isArray(players)) return players.filter((name) => typeof name === "string");
  if (!isObject(players)) return [];
  return Object.values(players).flatMap((group) => {
    if (!Array.isArray(group)) return [];
    return group.flatMap((participant) => {
      if (typeof participant === "string") return [participant];
      if (!isObject(participant)) return [];
      return [participant.a, participant.b].filter((name) => typeof name === "string");
    });
  });
}

function isAutomaticParticipantName(name) {
  return /^(atleta|jogador|homem|mulher|participante)(\s|$)/i.test(String(name || "").trim());
}

async function mapWithConcurrency(items, concurrency, callback) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await callback(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, worker));
  return results;
}

const arenas = await rpc("list_public_arenas", { p_search: null, p_limit: 500 });
const bundles = await mapWithConcurrency(arenas, 4, async (arena) => ({
  arena,
  bundle: await rpc("get_public_arena_bundle", { p_organizer_id: arena.id, p_public_id: null }),
}));

const directoryEntries = bundles.flatMap(({ arena, bundle }) => (
  Array.isArray(bundle?.tournaments)
    ? bundle.tournaments.map((tournament) => ({ arena, tournament }))
    : []
));

const audited = await mapWithConcurrency(directoryEntries, 5, async ({ arena, tournament }) => {
  try {
    const fullResponse = await rpc("get_public_tournament", { p_public_id: tournament.public_id });
    const full = Array.isArray(fullResponse) ? fullResponse[0] : fullResponse;
    const data = full?.data;
    const scheduleGames = collectGames(data?.schedule);
    const bracketGames = collectGames(data?.brackets);
    const games = [...scheduleGames, ...bracketGames];
    const participantNames = listParticipantNames(data?.players);
    const activeTimers = [
      ...collectGamesWithPath(data?.schedule, ["schedule"]),
      ...collectGamesWithPath(data?.brackets, ["brackets"]),
    ]
      .map(({ game, path }) => ({ game, path, seconds: getRunningTimerSeconds(game) }))
      .filter((item) => item.seconds !== null);
    return {
      arena: arena.arena_name || arena.name || arena.id,
      id: tournament.id,
      publicId: tournament.public_id,
      name: tournament.name,
      type: tournament.type,
      hasFullData: isObject(data),
      participantSlots: countParticipantSlots(data?.players),
      customizedParticipantNames: participantNames.filter((name) => !isAutomaticParticipantName(name)).length,
      namesShuffled: data?.namesShuffled === true,
      groupsShuffled: data?.groupsShuffled === true,
      scheduleGames: scheduleGames.length,
      bracketGames: bracketGames.length,
      scoredGames: games.filter((game) => hasScore(game.s1) && hasScore(game.s2)).length,
      activeTimers: activeTimers.length,
      timersAtOrAbove59Minutes: activeTimers.filter((item) => item.seconds >= 59 * 60).length,
      expiredTimerDetails: activeTimers
        .filter((item) => item.seconds >= 59 * 60)
        .map((item) => ({
          path: item.path,
          matchKey: item.game.matchKey || null,
          teams: [item.game.team1, item.game.team2],
          seconds: item.seconds,
        })),
      error: null,
    };
  } catch (error) {
    return {
      arena: arena.arena_name || arena.name || arena.id,
      id: tournament.id,
      publicId: tournament.public_id,
      name: tournament.name,
      type: tournament.type,
      hasFullData: false,
      participantSlots: 0,
      customizedParticipantNames: 0,
      namesShuffled: false,
      groupsShuffled: false,
      scheduleGames: 0,
      bracketGames: 0,
      scoredGames: 0,
      activeTimers: 0,
      timersAtOrAbove59Minutes: 0,
      expiredTimerDetails: [],
      error: error.message,
    };
  }
});

const failures = audited.filter((item) => item.error || !item.hasFullData);
const withGames = audited.filter((item) => item.scheduleGames + item.bracketGames > 0);
const withScores = audited.filter((item) => item.scoredGames > 0);
const withActiveTimers = audited.filter((item) => item.activeTimers > 0);
const withExpiredTimers = audited.filter((item) => item.timersAtOrAbove59Minutes > 0);
const withoutGamesAfterParticipants = audited.filter((item) => (
  item.participantSlots > 0 && item.scheduleGames + item.bracketGames === 0
));
const arenaSummary = bundles.map(({ arena, bundle }) => {
  const arenaName = arena.arena_name || arena.name || arena.id;
  const rows = audited.filter((item) => item.arena === arenaName);
  return {
    arena: arenaName,
    tournaments: rows.length,
    circuits: Array.isArray(bundle?.circuits) ? bundle.circuits.length : 0,
    withGames: rows.filter((item) => item.scheduleGames + item.bracketGames > 0).length,
    withScores: rows.filter((item) => item.scoredGames > 0).length,
    fullReadFailures: rows.filter((item) => item.error || !item.hasFullData).length,
  };
});

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  arenas: arenas.length,
  tournaments: audited.length,
  tournamentsWithGames: withGames.length,
  tournamentsWithScores: withScores.length,
  tournamentsWithActiveTimers: withActiveTimers.map((item) => ({
    arena: item.arena,
    id: item.id,
    publicId: item.publicId,
    name: item.name,
    activeTimers: item.activeTimers,
    timersAtOrAbove59Minutes: item.timersAtOrAbove59Minutes,
    expiredTimerDetails: item.expiredTimerDetails,
  })),
  tournamentsWithTimersAtOrAbove59Minutes: withExpiredTimers.map((item) => ({
    arena: item.arena,
    id: item.id,
    publicId: item.publicId,
    name: item.name,
    timersAtOrAbove59Minutes: item.timersAtOrAbove59Minutes,
    expiredTimerDetails: item.expiredTimerDetails,
  })),
  fullReadFailures: failures,
  tournamentsWithParticipantsButNoGeneratedGames: withoutGamesAfterParticipants.map((item) => ({
    arena: item.arena,
    id: item.id,
    publicId: item.publicId,
    name: item.name,
    type: item.type,
    participantSlots: item.participantSlots,
    customizedParticipantNames: item.customizedParticipantNames,
    namesShuffled: item.namesShuffled,
    groupsShuffled: item.groupsShuffled,
  })),
  arenaSummary,
}, null, 2));
