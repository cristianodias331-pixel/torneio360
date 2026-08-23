import {
  isCupType,
  isIndividualCupType,
  isMixedType,
} from "./modalityClassification.mjs";
import { formatParticipantName } from "./participantNames.mjs";

export function normalizeAttendanceList(values, count) {
  const source = Array.isArray(values) ? values : [];
  return Array.from({ length: count }, (_, index) => source[index] === true);
}

export function normalizeParticipantAttendance(config, players, attendance) {
  const source = attendance && typeof attendance === "object" ? attendance : {};

  if (isMixedType(config)) {
    return {
      men: normalizeAttendanceList(source.men, players?.men?.length || config.men || 0),
      women: normalizeAttendanceList(source.women, players?.women?.length || config.women || 0),
    };
  }

  if (isIndividualCupType(config)) {
    const sourceTeams = Array.isArray(source.teams) ? source.teams : [];
    return {
      teams: (players?.teams || []).map((_, index) => ({
        a: sourceTeams[index]?.a === true,
        b: false,
      })),
    };
  }

  if (config?.type === "fixed12" || config?.type === "fixed16" || config?.type === "fixed20" || config?.type === "fixed24" || isCupType(config)) {
    const sourceTeams = Array.isArray(source.teams) ? source.teams : [];
    return {
      teams: (players?.teams || []).map((_, index) => ({
        a: sourceTeams[index]?.a === true,
        b: sourceTeams[index]?.b === true,
      })),
    };
  }

  return normalizeAttendanceList(attendance, Array.isArray(players) ? players.length : 0);
}

export function getParticipantAttendanceEntries(config, data) {
  const attendance = normalizeParticipantAttendance(config, data?.players, data?.participantAttendance);

  if (isMixedType(config)) {
    return [
      ...(data.players?.men || []).map((name, index) => ({
        path: { kind: "men", index },
        name,
        confirmed: attendance.men[index] === true,
      })),
      ...(data.players?.women || []).map((name, index) => ({
        path: { kind: "women", index },
        name,
        confirmed: attendance.women[index] === true,
      })),
    ];
  }

  if (isIndividualCupType(config)) {
    return (data.players?.teams || []).map((participant, index) => ({
      path: { kind: "team", index, field: "a" },
      name: participant.a,
      confirmed: attendance.teams[index]?.a === true,
    }));
  }

  if (config?.type === "fixed12" || config?.type === "fixed16" || config?.type === "fixed20" || config?.type === "fixed24" || isCupType(config)) {
    return (data.players?.teams || []).flatMap((team, index) => ([
      {
        path: { kind: "team", index, field: "a" },
        name: team.a,
        confirmed: attendance.teams[index]?.a === true,
      },
      {
        path: { kind: "team", index, field: "b" },
        name: team.b,
        confirmed: attendance.teams[index]?.b === true,
      },
    ]));
  }

  return (data.players || []).map((name, index) => ({
    path: { kind: "normal", index },
    name,
    confirmed: attendance[index] === true,
  }));
}

export function getGameSideAttendanceParticipants(data, game, side) {
  if (!data || !game) return [];

  const ids = side === "team1" ? game.ids1 : game.ids2;
  if (!Array.isArray(ids) || ids.length === 0) return [];

  const players = data.players;
  const attendance = data.participantAttendance;

  if (players?.men || players?.women) {
    const names = [...(players?.men || []), ...(players?.women || [])];
    const confirmations = [
      ...(Array.isArray(attendance?.men) ? attendance.men : []),
      ...(Array.isArray(attendance?.women) ? attendance.women : []),
    ];

    return ids
      .map((id) => ({ name: names[id], pending: confirmations[id] !== true }))
      .filter((participant) => String(participant.name || "").trim());
  }

  if (Array.isArray(players?.teams)) {
    return ids.flatMap((id) => {
      const team = players.teams[id];
      if (!team) return [];

      const confirmation = attendance?.teams?.[id] || {};
      return [
        { name: team.a, pending: confirmation.a !== true },
        { name: team.b, pending: confirmation.b !== true },
      ].filter((participant) => String(participant.name || "").trim());
    });
  }

  if (Array.isArray(players)) {
    return ids
      .map((id) => ({ name: players[id], pending: attendance?.[id] !== true }))
      .filter((participant) => String(participant.name || "").trim());
  }

  return [];
}

export function setParticipantAttendanceValue(attendance, path, confirmed) {
  if (path.kind === "normal") attendance[path.index] = confirmed;
  if (path.kind === "men") attendance.men[path.index] = confirmed;
  if (path.kind === "women") attendance.women[path.index] = confirmed;
  if (path.kind === "team") attendance.teams[path.index][path.field] = confirmed;
}

export function reconcileParticipantAttendance(config, currentPlayers, nextPlayers, attendance) {
  const currentData = { players: currentPlayers, participantAttendance: attendance };
  const entries = getParticipantAttendanceEntries(config, currentData);
  const nextAttendance = normalizeParticipantAttendance(config, nextPlayers, null);

  entries.forEach((entry) => {
    let nextName = "";
    if (entry.path.kind === "normal") nextName = nextPlayers?.[entry.path.index];
    if (entry.path.kind === "men") nextName = nextPlayers?.men?.[entry.path.index];
    if (entry.path.kind === "women") nextName = nextPlayers?.women?.[entry.path.index];
    if (entry.path.kind === "team") nextName = nextPlayers?.teams?.[entry.path.index]?.[entry.path.field];

    if (formatParticipantName(entry.name) === formatParticipantName(nextName)) {
      setParticipantAttendanceValue(nextAttendance, entry.path, entry.confirmed);
    }
  });

  return nextAttendance;
}
