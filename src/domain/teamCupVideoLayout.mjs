export const TEAM_CUP_VIDEO_CARD_WIDTH = 624;
export const TEAM_CUP_VIDEO_CONTENT_HEIGHT = 820;
export const TEAM_CUP_VIDEO_CARD_GAP = 16;

const estimateWidth = (text, font) => [...text].length * Number(font.match(/([\d.]+)px/)[1]) * .65;

// Unlike labels in compact tables, a video roster must retain every full name.
// Wrap long words too, so even an unbroken name stays inside the card.
function wrapText(text, font, width, measure) {
  const lines = [];
  let current = "";
  for (const word of String(text).trim().split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate, font) <= width) { current = candidate; continue; }
    if (current) { lines.push(current); current = ""; }
    for (const letter of word) {
      if (current && measure(current + letter, font) > width) { lines.push(current); current = ""; }
      current += letter;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function teamCupVideoCardLayout(team, { captainsOnly = false, measure = estimateWidth } = {}) {
  const captain = team.athletes.find(a => a.id === team.captainId);
  const members = team.athletes.filter(a => a.id !== team.captainId);
  let layout;
  for (const scale of [1, .94, .88, .82, .76]) {
    const rows = [];
    let y = 22;
    function block(text, role, size, weight, lineHeight, gap = 0) {
      const font = `${weight} ${Math.round(size * scale)}px Arial`;
      for (const line of wrapText(text, font, TEAM_CUP_VIDEO_CARD_WIDTH - 44, measure)) {
        rows.push({ text: line, role, font, y, height: Math.ceil(lineHeight * scale) });
        y += Math.ceil(lineHeight * scale);
      }
      y += gap;
    }
    block(team.name, "team", 28, 900, 34, 14);
    block(`CAPITÃO/Ã · Categoria: ${captain?.level || "não definida"}`, "label", 18, 700, 24, 5);
    block(captain?.name || "A definir", "captain", 28, 700, 36, captainsOnly ? 0 : 16);
    if (!captainsOnly) {
      block("INTEGRANTES", "label", 18, 700, 24, 8);
      members.forEach((athlete, i) => block(athlete.name || "A definir", "member", 26, 500, 34, i < members.length - 1 ? 6 : 0));
    }
    layout = { rows, height: Math.max(captainsOnly ? 190 : 390, y + 22) };
    if (layout.height <= TEAM_CUP_VIDEO_CONTENT_HEIGHT) return layout;
  }
  return layout;
}
