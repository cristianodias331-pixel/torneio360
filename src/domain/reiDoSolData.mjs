import { GROUPS, phaseRanking, finalsFollowQualification, groupChampion, withNames } from './reiDoSol.mjs';
const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export function createReiDoSolData(base = {}, count = 16) {
  if (!Number.isSafeInteger(count) || count < 16) throw new Error('Informe uma quantidade inteira, a partir de 16 atletas.');
  return { ...base, rankingCriteria: 'wins_balance_points', players: Array(count).fill(''),
    participantAttendance: Array(count).fill(false), schedule: [], brackets: [], namesShuffled: false,
    reiDoSol: { version: 1, playerCount: count, finalGroups: [], decisions: {}, drawVideos: {} } };
}
// Use canonical collections so saving, score protection, timers and courts see both phases.
export function reiDoSolState(data) {
  const settings = record(data.reiDoSol);
  return { players: data.players, participantAttendance: data.participantAttendance,
    participantGenders: data.participantGenders, target: data.winningScore,
    namesShuffled: Boolean(data.namesShuffled), lastShuffleVideo: data.lastShuffleVideo || null,
    qualifying: data.schedule || [], draws: record(settings.decisions), drawVideos: record(settings.drawVideos),
    finals: (settings.finalGroups || []).map(group => ({ ...GROUPS.find(item => item.id === group.id),
      id: group.id, ids: group.ids,
      schedule: (data.brackets || []).filter(game => game.phase === group.id).map(game => [game]),
    })) };
}
export function applyReiDoSolState(data, state) {
  return { ...data, players: state.players, participantAttendance: state.participantAttendance,
    participantGenders: state.participantGenders || {}, winningScore: state.target,
    rankingCriteria: 'wins_balance_points', namesShuffled: Boolean(state.namesShuffled),
    lastShuffleVideo: state.lastShuffleVideo || null,
    schedule: withNames(state.qualifying, state.players),
    brackets: state.finals.flatMap(group => withNames(group.schedule, state.players).flat().map((game, index) => ({
      ...game, phase: group.id, groupName: group.name, roundName: `${group.name} · Jogo ${index + 1}`,
    }))),
    reiDoSol: { ...record(data.reiDoSol), version: 1, playerCount: state.players.length,
      finalGroups: state.finals.map(({ id, ids }) => ({ id, ids: [...ids] })),
      decisions: state.draws || {}, drawVideos: state.drawVideos || {} },
  };
}
export function normalizeReiDoSolData(data) {
  // Never trim saved participants to the default count.
  const source = Array.isArray(data.players) ? data.players : [];
  const count = Math.max(16, source.length);
  const players = Array.from({ length: count }, (_, index) => typeof source[index] === 'string' ? source[index] : '');
  const settings = record(data.reiDoSol);
  const normalized = { ...data, players, rankingCriteria: 'wins_balance_points',
    participantAttendance: players.map((_, index) => data.participantAttendance?.[index] === true),
    brackets: Array.isArray(data.brackets) ? data.brackets : [],
    reiDoSol: { ...settings, version: 1, playerCount: count,
      finalGroups: Array.isArray(settings.finalGroups) ? settings.finalGroups.filter(group =>
        GROUPS.some(item => item.id === group?.id) && Array.isArray(group.ids)) : [],
      decisions: record(settings.decisions), drawVideos: record(settings.drawVideos) } };
  return applyReiDoSolState(normalized, reiDoSolState(normalized));
}
export function resizeReiDoSol(data, count) {
  const fresh = createReiDoSolData(data, count);
  return { ...fresh, players: fresh.players.map((_, index) => data.players[index] || ''),
    participantAttendance: fresh.players.map((_, index) => data.participantAttendance?.[index] === true),
    lastShuffleVideo: null };
}
export function reiDoSolCompletion(data) {
  const state = reiDoSolState(data);
  const qualification = phaseRanking(state.players, state.qualifying, state.target, state.draws.qualifying);
  const finals = state.finals.map(group => phaseRanking(state.players, group.schedule, state.target, state.draws[group.id], group.ids));
  const validFinals = qualification.total === state.players.length && state.finals.length === 4 && finalsFollowQualification(state.finals, qualification);
  return { hasRequiredGames: qualification.total > 0,
    completed: validFinals && finals.every(ranking => Boolean(groupChampion(ranking))),
    requiredGames: qualification.total + 12,
    completedGames: qualification.completed + finals.reduce((sum, ranking) => sum + ranking.completed, 0) };
}
