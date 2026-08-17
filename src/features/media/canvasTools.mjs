export const TORNEIO360_LOGO = "/torneio360-logo.png";
export const TORNEIO360_LOGO_BLUE = "/torneio360-logo-blue.png";

export function loadShareImage(source) {
  return new Promise((resolve) => {
    if (!source) {
      resolve(null);
      return;
    }

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

export function drawRoundedRect(context, x, y, width, height, radius, fillStyle, strokeStyle = null) {
  context.beginPath();
  context.roundRect(x, y, width, height, Math.min(radius, width / 2, height / 2));
  context.fillStyle = fillStyle;
  context.fill();
  if (strokeStyle) {
    context.strokeStyle = strokeStyle;
    context.lineWidth = 2;
    context.stroke();
  }
}

export function truncateCanvasText(context, value, maxWidth) {
  const text = String(value || "Sem nome");
  if (context.measureText(text).width <= maxWidth) return text;

  let shortened = text;
  while (shortened.length > 1 && context.measureText(`${shortened}…`).width > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened}…`;
}

export function wrapCanvasItems(context, items, maxWidth, separator = "  •  ") {
  const lines = [];
  let currentLine = "";

  items.filter(Boolean).forEach((item) => {
    const candidate = currentLine ? `${currentLine}${separator}${item}` : String(item);
    if (currentLine && context.measureText(candidate).width > maxWidth) {
      lines.push(currentLine);
      currentLine = String(item);
      return;
    }
    currentLine = candidate;
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

export function drawCenteredCanvasLines(context, value, centerX, startY, maxWidth, {
  font = "900 34px Arial",
  color = "#ffffff",
  lineHeight = 40,
  maxLines = 2,
} = {}) {
  const words = String(value || "Sem nome").split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = "";
  context.font = font;

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (currentLine && context.measureText(candidate).width > maxWidth && lines.length < maxLines - 1) {
      lines.push(currentLine);
      currentLine = word;
      return;
    }
    currentLine = candidate;
  });
  if (currentLine) lines.push(currentLine);

  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  lines.slice(0, maxLines).forEach((line, index) => {
    context.fillText(line, centerX, startY + (index * lineHeight));
  });
}

export function getPodiumInitials(name) {
  return String(name || "T360")
    .replace(/\s*\+\s*/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
