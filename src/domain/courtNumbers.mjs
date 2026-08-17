export function normalizeCourtNumberValue(value) {
  const match = String(value || "").normalize("NFKC").match(/\d+/);
  if (!match) return "";

  const number = Number(match[0]);
  return Number.isInteger(number) && number > 0 ? String(number).slice(0, 4) : "";
}

export function createDefaultCourtNumbers(count = 1) {
  return Array.from(
    { length: Math.max(1, Number(count) || 1) },
    (_, index) => String(index + 1)
  );
}

export function normalizeCourtNumbers(values, count = 1) {
  const source = Array.isArray(values) ? values : [];
  const defaults = createDefaultCourtNumbers(count);

  return defaults.map((fallback, index) => normalizeCourtNumberValue(source[index]) || fallback);
}

export function getGameCourtNumber(game, courtNumbers = []) {
  const override = normalizeCourtNumberValue(game?.courtNumberOverride || game?.courtLabelOverride);
  if (override) return override;

  const courtIndex = Math.max(0, Number(game?.court || 1) - 1);
  return normalizeCourtNumberValue(courtNumbers[courtIndex]) || String(courtIndex + 1);
}

export function getGameCourtLabel(game, courtNumbers = []) {
  return `Quadra ${getGameCourtNumber(game, courtNumbers)}`;
}

export function applyCourtNumberToGame(game, value, courtNumbers = []) {
  const normalizedNumber = normalizeCourtNumberValue(value);
  const courtIndex = Math.max(0, Number(game?.court || 1) - 1);
  const defaultNumber = normalizeCourtNumberValue(courtNumbers[courtIndex]) || String(courtIndex + 1);

  delete game.courtLabelOverride;

  if (!normalizedNumber || normalizedNumber === defaultNumber) {
    delete game.courtNumberOverride;
    return;
  }

  game.courtNumberOverride = normalizedNumber;
}
