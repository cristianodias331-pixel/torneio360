import { getTeamName } from "../../domain/cupGroups.mjs";
import {
  isCupType,
  isFixedTeamType,
  isIndividualCupType,
  isMixedType,
} from "../../domain/modalityClassification.mjs";
import { shuffleArray } from "../../domain/scheduleGeneration.mjs";

export const SHUFFLE_DURATION_SECONDS = 5;
export const SHUFFLE_MOVEMENT_INTERVAL_MS = 620;

export function getShuffleNames(data, config) {
  if (!data?.players) return [];

  if (isMixedType(config)) {
    return [...data.players.men, ...data.players.women];
  }

  if (isIndividualCupType(config)) {
    return data.players.teams.map((participant) => participant.a);
  }

  if (isFixedTeamType(config) || isCupType(config)) {
    return data.players.teams.map((team, index) => `Dupla ${index + 1}: ${getTeamName(team)}`);
  }

  return data.players || [];
}

export function createShuffleSlots(count, compact = false) {
  const maxColumns = compact ? 3 : 5;
  const columns = Math.min(count, Math.max(2, Math.min(maxColumns, Math.ceil(Math.sqrt(count * 1.35)))));
  const rows = Math.max(1, Math.ceil(count / columns));

  return Array.from({ length: count }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const rowItems = Math.min(columns, count - row * columns);
    const rowOffset = (columns - rowItems) / 2;

    return {
      left: 7 + ((column + rowOffset + 0.5) / columns) * 86,
      top: 8 + ((row + 0.5) / rows) * 84,
    };
  });
}

export function createShuffleAnimationItems(names) {
  const compact = typeof window !== "undefined" && window.innerWidth <= 760;
  const slots = shuffleArray(createShuffleSlots(names.length, compact));

  return names.map((name, index) => ({
    id: `shuffle-name-${index}`,
    name,
    ...slots[index],
    rotation: (index % 2 === 0 ? -1 : 1) * (1 + (index % 3)),
  }));
}

export function moveShuffleAnimationItems(items) {
  if (items.length < 2) return items;

  const offset = 1 + Math.floor(Math.random() * (items.length - 1));
  const positions = items.map(({ left, top }) => ({ left, top }));

  return items.map((item, index) => ({
    ...item,
    ...positions[(index + offset) % positions.length],
    rotation: -item.rotation + (index % 2 === 0 ? 1 : -1),
  }));
}
