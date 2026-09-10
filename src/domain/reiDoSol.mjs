// Rei do Sol: individual standings, rotating doubles and four independent final groups.
import { calculateScheduleRanking } from './rankingCalculation.mjs';
import { getScoreWinnerSide } from './scoreRules.mjs';
import { buildReizinhoGames } from '../reizinhoSchedule.mjs';
import { reconcileParticipantAttendance } from './participantAttendance.mjs';

export const GROUPS = [
  { id: 'ouro', name: 'Ouro', range: '1º ao 4º', color: '#e9ae22', palette: { start: '#fde047', end: '#e9ae22', ink: '#634200', tint: '#fff3c4' } },
  { id: 'prata', name: 'Prata', range: '5º ao 8º', color: '#aebed1', palette: { start: '#f1f5f9', end: '#aebed1', ink: '#344256', tint: '#e8edf3' } },
  { id: 'bronze', name: 'Bronze', range: '9º ao 12º', color: '#cb874f', palette: { start: '#edb587', end: '#cb874f', ink: '#512b10', tint: '#f8e4d3' } },
  { id: 'lango', name: 'Lango', range: '13º ao 16º', color: '#60a5fa', palette: { start: '#bfdbfe', end: '#60a5fa', ink: '#123465', tint: '#dbeafe' } },
];
export function groupColorStyle(group) {
  return { '--group-color': group.color, '--group-ink': group.palette.ink, '--group-tint': group.palette.tint, '--group-start': group.palette.start, '--group-end': group.palette.end };
}
export const CRITERIA = 'Vitórias → Saldo de games → Total de games → Confronto direto → Coeficiente → Sorteio ou escolha manual do organizador';
export const COEFFICIENT_HELP = 'Coeficiente: média de games ganhos ÷ total de games disputados em cada partida concluída. Quanto maior, melhor.';
export const RANKING_COLUMNS = [
  { key: 'w', label: 'Vitórias' },
  { key: 'bal', label: 'Saldo de games' },
  { key: 'pts', label: 'Total de games' },
  { key: 'coefficient', label: 'Coeficiente' },
];

export function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = Math.imul(value ^ value >>> 15, 1 | value);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function newGame(ids1, ids2, matchKey, court = 1) {
  return { ids1, ids2, matchKey, court, s1: '', s2: '', inProgress: false };
}

export function qualifyingSchedule(count, random = Math.random, courts = 4) {
  if (!Number.isInteger(count) || count < 16) throw new Error('São necessários pelo menos 16 atletas.');
  if (!Number.isInteger(courts) || courts < 1) throw new Error('Informe uma quantidade válida de quadras.');
  const ids = shuffle(Array.from({ length: count }, (_, i) => i), random);
  const games = [];
  // Cyclic design: partners ±1/±5 and opponents ±1/±2/±6/±7.
  // For every N >= 16 these are distinct: four games and four partners,
  // with eight distinct opponents per athlete, including odd N.
  for (let residue = 0; residue < 4; residue++) {
    for (let i = residue; i < count; i += 4) {
      games.push(newGame([ids[i], ids[(i + 1) % count]], [ids[(i + 2) % count], ids[(i + 7) % count]], `qual-${i}`));
    }
  }
  const rounds = [];
  const occupied = [];
  for (const game of games) {
    const participants = [...game.ids1, ...game.ids2];
    let index = rounds.findIndex((round, i) => round.length < courts && participants.every(id => !occupied[i].has(id)));
    if (index < 0) { index = rounds.length; rounds.push([]); occupied.push(new Set()); }
    game.court = rounds[index].length + 1;
    rounds[index].push(game);
    participants.forEach(id => occupied[index].add(id));
  }
  return rounds;
}

export function withNames(schedule, names) {
  return schedule.map(round => round.map(game => ({ ...game,
    team1: game.ids1.map(id => names[id] || `Atleta ${id + 1}`),
    team2: game.ids2.map(id => names[id] || `Atleta ${id + 1}`),
  })));
}

export function isValidTieOrder(ids, order) {
  return Array.isArray(order) && order.length === ids.length && new Set(order).size === ids.length
    && order.every(id => Number.isInteger(id) && ids.includes(id));
}

export function phaseRanking(names, schedule, target, drawOrders = {}, members = null) {
  const games = schedule.flat();
  const completed = games.filter(game => getScoreWinnerSide(game, target)).length;
  const complete = games.length > 0 && completed === games.length;
  const base = calculateScheduleRanking({ names, schedule, winningScore: target, rankingCriteriaValue: 'wins_balance_points' })
    .filter(row => !members || members.includes(row.id));
  // Same coefficient as the platform's Modelo Torneio 360 (cupGroupRanking):
  // mean of the game share in each completed match, not the aggregate ratio.
  const coefficientTotals = new Map(base.map(row => [row.id, 0]));
  games.forEach(game => {
    if (!getScoreWinnerSide(game, target)) return;
    const total = Number(game.s1) + Number(game.s2);
    if (total <= 0) return;
    for (const [ids, score] of [[game.ids1, game.s1], [game.ids2, game.s2]]) {
      ids.forEach(id => {
        if (coefficientTotals.has(id)) coefficientTotals.set(id, coefficientTotals.get(id) + Number(score) / total);
      });
    }
  });
  base.forEach(row => { row.coefficient = row.played ? coefficientTotals.get(row.id) / row.played : 0; });
  const buckets = [];
  for (const row of base) {
    const key = `${row.w}:${row.bal}:${row.pts}`;
    const last = buckets.at(-1);
    if (last?.key === key) last.rows.push(row);
    else buckets.push({ key, rows: [row] });
  }
  const pending = [];
  const rows = buckets.flatMap(bucket => {
    let tied = bucket.rows.sort((a, b) => a.id - b.id);
    if (!complete || tied.length < 2) return tied;
    // Same convention as existing cup ranking: direct confrontation for two
    // tied athletes only; a partnership is not a direct confrontation.
    if (tied.length === 2) {
      const [a, b] = tied.map(row => row.id);
      let balance = 0;
      games.forEach(game => {
        const aSide = game.ids1.includes(a) ? 'team1' : game.ids2.includes(a) ? 'team2' : null;
        const bSide = game.ids1.includes(b) ? 'team1' : game.ids2.includes(b) ? 'team2' : null;
        if (!aSide || !bSide || aSide === bSide) return;
        balance += getScoreWinnerSide(game, target) === aSide ? 1 : -1;
      });
      if (balance) return (balance > 0 ? tied : tied.toReversed()).map(row => ({ ...row, resolution: 'Confronto direto' }));
    }
    // The coefficient is consulted only after an unresolved direct confrontation.
    const coefficientRows = [...tied].sort((a, b) => b.coefficient - a.coefficient || a.id - b.id);
    const coefficientGroups = [];
    coefficientRows.forEach(row => {
      const last = coefficientGroups.at(-1);
      if (last && Math.abs(last[0].coefficient - row.coefficient) < 1e-12) last.push(row);
      else coefficientGroups.push([row]);
    });
    return coefficientGroups.flatMap(equalRows => {
      if (equalRows.length === 1) return equalRows.map(row => ({ ...row, resolution: 'Coeficiente' }));
      // A draw stored under the old five-criterion rule must not override v2.
      const signature = `rds-criteria-v2:${target}:${bucket.key}:coef-${equalRows[0].coefficient.toFixed(12)}|${equalRows.map(row => row.id).sort((a, b) => a - b).join(',')}|${games.map(g => `${g.matchKey}:${g.ids1.join(',')}/${g.ids2.join(',')}:${g.s1}-${g.s2}`).join(';')}`;
      const decision = drawOrders[signature];
      // Arrays remain valid receipts for draws already saved in this preview.
      const order = Array.isArray(decision) ? decision : decision?.method === 'manual' ? decision.order : null;
      if (isValidTieOrder(equalRows.map(row => row.id), order)) return [...equalRows].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)).map(row => ({ ...row, resolution: decision?.method === 'manual' ? 'Escolha manual do organizador' : 'Sorteio' }));
      pending.push({ signature, ids: equalRows.map(row => row.id) });
      return equalRows.map(row => ({ ...row, unresolved: true }));
    });
  });
  return { rows, pending, completed, total: games.length, complete, settled: complete && pending.length === 0 };
}

export function applyManualTieOrder(state, scope, signature, order) {
  const group = scope === 'qualifying' ? null : state.finals.find(item => item.id === scope);
  if (scope !== 'qualifying' && !group) throw new Error('Esta fase não está disponível.');
  const ranking = phaseRanking(state.players, group ? group.schedule : state.qualifying, state.target, state.draws?.[scope], group?.ids);
  const pending = ranking.pending.find(tie => tie.signature === signature);
  if (!ranking.complete || !pending) throw new Error('O empate mudou ou já foi resolvido. Revise a classificação.');
  if (!isValidTieOrder(pending.ids, order)) throw new Error('Defina todas as posições, sem repetir atletas e usando somente os empatados.');
  const videos = { ...state.drawVideos?.[scope] };
  delete videos[signature];
  return { ...state,
    draws: { ...state.draws, [scope]: { ...state.draws?.[scope], [signature]: { method: 'manual', order: [...order], decidedAt: new Date().toISOString() } } },
    drawVideos: { ...state.drawVideos, [scope]: videos },
  };
}

export function createFinals(ranking) {
  if (!ranking.settled || ranking.rows.length < 16) throw new Error('Conclua a classificatória e resolva os empates antes de gerar a fase final.');
  return GROUPS.map((group, index) => {
    const ids = ranking.rows.slice(index * 4, index * 4 + 4).map(row => row.id);
    const schedule = buildReizinhoGames(4).map((round, roundIndex) => round.map(([a, b]) => ({
      ...newGame(a.map(i => ids[i - 1]), b.map(i => ids[i - 1]), `${group.id}-${roundIndex}`, index + 1),
      groupName: group.name,
    })));
    return { ...group, ids, schedule };
  });
}

export function groupChampion(ranking) {
  const first = ranking?.rows?.[0];
  // A tie for lower positions must not delay an already defined champion.
  if (!ranking?.complete || ranking.total !== 3 || !first || first.unresolved || ranking.pending.some(tie => tie.ids.includes(first.id))) return null;
  return first;
}

export function finalsFollowQualification(finals, qualification) {
  if (!finals.length) return true;
  if (!qualification.settled || finals.length !== GROUPS.length) return false;
  return GROUPS.every((group, index) => {
    const stored = finals.find(item => item.id === group.id);
    const expected = qualification.rows.slice(index * 4, index * 4 + 4).map(row => row.id);
    return stored?.ids.length === 4 && new Set(stored.ids).size === 4 && expected.every(id => stored.ids.includes(id));
  });
}

export function allGames(state) { return [...state.qualifying.flat(), ...state.finals.flatMap(group => group.schedule.flat())]; }
export function findGame(state, key) { return allGames(state).find(game => game.matchKey === key); }

export function shuffleParticipants(state, random = Math.random) {
  if (!state.players.some(name => String(name).trim())) throw new Error('Adicione os nomes antes do sorteio.');
  const order = shuffle(state.players.map((_, index) => index), random);
  return { ...state,
    players: order.map(index => state.players[index]),
    participantAttendance: order.map(index => state.participantAttendance?.[index] === true),
    namesShuffled: true, qualifying: [], finals: [], draws: {}, drawVideos: {}, lastShuffleVideo: null, demoDraws: false,
  };
}

export function generateQualifying(state, courts = 4) {
  if (state.players.some(name => !String(name).trim())) throw new Error('Preencha os nomes dos participantes antes de criar as rodadas e os jogos.');
  // The participant order was chosen manually or by “Sortear nomes”. Generating
  // the matches must not silently perform a second draw or reorder this list.
  const qualifying = qualifyingSchedule(state.players.length, () => 1 - Number.EPSILON, courts);
  return { ...state, qualifying, finals: [], draws: {}, drawVideos: {}, demoDraws: false };
}

export function importParticipantNames(state, players, summary = {}) {
  if (!Array.isArray(players) || players.length !== state.players.length) throw new Error('A lista deve respeitar a quantidade de vagas do torneio.');
  return { ...state, players: [...players],
    participantAttendance: reconcileParticipantAttendance({ type: 'reiDoSol' }, state.players, players, state.participantAttendance),
    participantGenders: { ...state.participantGenders, ...summary.participantGenders },
  };
}

export function makeExample(count = 20, target = 4, scenario = 'finals', seed = 360) {
  const first = ['Cristiano', 'Danilo', 'Guilherme', 'Nicolas', 'Layner', 'Rafael', 'Lucas', 'Pedro', 'Bruno', 'Diego', 'Gabriel', 'André', 'Felipe', 'Caio', 'Vinícius', 'Thiago', 'Henrique', 'João', 'Arthur', 'Mateus'];
  const last = ['Silva', 'Souza', 'Lima', 'Santos', 'Costa', 'Oliveira', 'Almeida', 'Ferreira'];
  const random = seededRandom(seed);
  const players = Array.from({ length: count }, (_, i) => `${first[i % first.length]} ${last[Math.floor(i / first.length) % last.length]}${i >= 160 ? ` ${Math.floor(i / 160) + 1}` : ''}`);
  const state = { version: 1, players, participantAttendance: players.map(() => true), target, qualifying: qualifyingSchedule(count, random), finals: [], draws: {}, demoDraws: false };
  const fill = games => games.forEach(game => {
    const winner = random() < .5 ? 's1' : 's2';
    game[winner] = String(target);
    game[winner === 's1' ? 's2' : 's1'] = String(Math.floor(random() * target));
  });
  const resolve = (scope, schedule, ids) => {
    const ranking = phaseRanking(players, schedule, target, {}, ids);
    state.draws[scope] = Object.fromEntries(ranking.pending.map(tie => [tie.signature, shuffle(tie.ids, random)]));
    state.demoDraws ||= ranking.pending.length > 0;
    return phaseRanking(players, schedule, target, state.draws[scope], ids);
  };
  if (scenario === 'empty') return state;
  const games = state.qualifying.flat();
  fill(scenario === 'progress' ? games.slice(0, Math.floor(games.length / 2)) : games);
  if (scenario === 'progress' || scenario === 'qualifying') return state;
  state.finals = createFinals(resolve('qualifying', state.qualifying));
  if (scenario === 'finished') state.finals.forEach(group => { fill(group.schedule.flat()); resolve(group.id, group.schedule, group.ids); });
  return state;
}
