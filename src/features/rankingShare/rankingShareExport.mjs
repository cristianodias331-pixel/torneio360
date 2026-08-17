import { formatMatchDuration } from "../../domain/matchTimer.mjs";
import {
  normalizeRankingExportGroups,
  paginateRankingGroups,
} from "../../domain/rankingPagination.mjs";
import {
  formatRankingMetricValue,
  getRankingColumnLabel,
  getRankingCriteria,
} from "../../domain/rankingCriteria.mjs";
import {
  TORNEIO360_LOGO,
  drawCenteredCanvasLines,
  drawRoundedRect,
  getPodiumInitials,
  loadShareImage,
  truncateCanvasText,
  wrapCanvasItems,
} from "../media/canvasTools.mjs";

const RANKING_SHARE_CANVAS_HEIGHT = 1350;
const RANKING_SHARE_CONTENT_HEIGHT = 850;
const RANKING_SHARE_ROW_HEIGHT = 64;
const RANKING_SHARE_GROUP_OVERHEAD = 64;

async function createCupPodiumShareFile({
  title,
  subtitle,
  arenaName,
  arenaPhotoUrl,
  podium = [],
  podiumVariant = "main",
  tournamentDurationSeconds = 0,
}) {
  const visiblePodium = podium.slice(0, podiumVariant === "parallel" ? 1 : 3);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = RANKING_SHARE_CANVAS_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a imagem do pódio.");

  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, "#07163e");
  background.addColorStop(0.52, "#202779");
  background.addColorStop(1, "#5b21b6");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.globalAlpha = 0.14;
  context.strokeStyle = "#67e8f9";
  context.lineWidth = 3;
  [170, 910].forEach((x, index) => {
    context.beginPath();
    context.arc(x, index === 0 ? 455 : 570, 190, 0, Math.PI * 2);
    context.stroke();
  });
  context.globalAlpha = 1;

  const [logo, arenaPhoto] = await Promise.all([
    loadShareImage(TORNEIO360_LOGO),
    loadShareImage(arenaPhotoUrl),
  ]);

  if (logo) {
    const logoWidth = 315;
    const logoHeight = logoWidth * (logo.height / logo.width);
    context.drawImage(logo, 54, 28, logoWidth, logoHeight);
  }

  const photoX = 920;
  const photoY = 106;
  const photoRadius = 66;
  context.save();
  context.beginPath();
  context.arc(photoX, photoY, photoRadius, 0, Math.PI * 2);
  context.clip();
  if (arenaPhoto) {
    const scale = Math.max((photoRadius * 2) / arenaPhoto.width, (photoRadius * 2) / arenaPhoto.height);
    const width = arenaPhoto.width * scale;
    const height = arenaPhoto.height * scale;
    context.drawImage(arenaPhoto, photoX - width / 2, photoY - height / 2, width, height);
  } else {
    const avatarGradient = context.createLinearGradient(photoX - photoRadius, photoY - photoRadius, photoX + photoRadius, photoY + photoRadius);
    avatarGradient.addColorStop(0, "#2563eb");
    avatarGradient.addColorStop(1, "#06b6d4");
    context.fillStyle = avatarGradient;
    context.fillRect(photoX - photoRadius, photoY - photoRadius, photoRadius * 2, photoRadius * 2);
    context.fillStyle = "#ffffff";
    context.font = "900 38px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(arenaName || "A").slice(0, 2).toUpperCase(), photoX, photoY + 2);
  }
  context.restore();
  context.strokeStyle = "#fbbf24";
  context.lineWidth = 7;
  context.beginPath();
  context.arc(photoX, photoY, photoRadius + 3, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = "#ffffff";
  context.font = "900 23px Arial";
  context.textAlign = "right";
  context.fillText(truncateCanvasText(context, arenaName || "Arena Torneio360", 400), 820, 96);
  context.fillStyle = "#bae6fd";
  context.font = "700 16px Arial";
  context.fillText("ORGANIZAÇÃO", 820, 124);

  drawRoundedRect(context, 52, 210, 976, 168, 32, "rgba(7, 18, 57, 0.78)", "rgba(255, 255, 255, 0.18)");
  context.textAlign = "left";
  context.fillStyle = "#fbbf24";
  context.font = "900 18px Arial";
  context.fillText(podiumVariant === "parallel" ? "CAMPEÃ DA DISPUTA PARALELA" : "PÓDIO OFICIAL", 88, 257);
  context.fillStyle = "#ffffff";
  context.font = "900 40px Arial";
  context.fillText(truncateCanvasText(context, title || "Pódio", 850), 88, 315);
  context.fillStyle = "#cbd5e1";
  context.font = "700 21px Arial";
  context.fillText(truncateCanvasText(context, subtitle || "Torneio360", 850), 88, 352);

  const singleChampion = visiblePodium.length === 1;
  const podiumLayout = singleChampion
    ? [{ place: 1, x: 540, y: 610, radius: 142, colorStart: "#fde047", colorEnd: "#f59e0b", nameWidth: 720 }]
    : [
        { place: 1, x: 540, y: 565, radius: 112, colorStart: "#fde047", colorEnd: "#f59e0b", nameWidth: 340 },
        { place: 2, x: 235, y: 690, radius: 88, colorStart: "#f8fafc", colorEnd: "#94a3b8", nameWidth: 290 },
        { place: 3, x: 845, y: 690, radius: 88, colorStart: "#fdba74", colorEnd: "#ea580c", nameWidth: 290 },
      ];

  visiblePodium.forEach((item, index) => {
    const layout = podiumLayout.find((entry) => entry.place === index + 1);
    if (!layout) return;
    if (layout.place === 1) {
      context.fillStyle = "#fbbf24";
      context.font = singleChampion ? "900 76px Arial" : "900 58px Arial";
      context.textAlign = "center";
      context.fillText("♛", layout.x, layout.y - layout.radius - 24);
    }

    const avatarGradient = context.createLinearGradient(
      layout.x - layout.radius,
      layout.y - layout.radius,
      layout.x + layout.radius,
      layout.y + layout.radius
    );
    avatarGradient.addColorStop(0, layout.colorStart);
    avatarGradient.addColorStop(1, layout.colorEnd);
    context.fillStyle = avatarGradient;
    context.beginPath();
    context.arc(layout.x, layout.y, layout.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(255,255,255,.92)";
    context.lineWidth = 8;
    context.stroke();

    context.fillStyle = layout.place === 1 ? "#5b21b6" : "#172554";
    context.font = `900 ${singleChampion ? 62 : layout.place === 1 ? 52 : 42}px Arial`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(getPodiumInitials(item.name), layout.x, layout.y + 4);

    const labelY = layout.y + layout.radius + 42;
    context.fillStyle = layout.place === 1 ? "#fde68a" : "#ffffff";
    context.font = `900 ${singleChampion ? 30 : 24}px Arial`;
    context.fillText(layout.place === 1 ? "🏆 Campeão" : layout.place === 2 ? "🥈 Vice-campeão" : "🥉 3º lugar", layout.x, labelY);
    drawCenteredCanvasLines(context, item.name, layout.x, labelY + (singleChampion ? 58 : 48), layout.nameWidth, {
      font: `900 ${singleChampion ? 43 : layout.place === 1 ? 36 : 31}px Arial`,
      color: "#ffffff",
      lineHeight: singleChampion ? 49 : 38,
      maxLines: 2,
    });
    if (Number(item.playTimeSeconds || 0) > 0) {
      context.fillStyle = "#a5f3fc";
      context.font = `800 ${singleChampion ? 22 : 17}px Arial`;
      context.fillText(
        `Tempo em jogo: ${formatMatchDuration(item.playTimeSeconds)}`,
        layout.x,
        labelY + (singleChampion ? 166 : layout.place === 1 ? 142 : 138)
      );
    }
  });

  if (singleChampion) {
    const stepGradient = context.createLinearGradient(230, 0, 850, 0);
    stepGradient.addColorStop(0, "#f59e0b");
    stepGradient.addColorStop(1, "#facc15");
    drawRoundedRect(context, 230, 1010, 620, 245, 30, stepGradient);
    context.fillStyle = "#ffffff";
    context.font = "900 92px Arial";
    context.textAlign = "center";
    context.fillText("1", 540, 1155);
  } else {
    drawRoundedRect(context, 65, 1055, 310, 200, 28, "#cbd5e1");
    drawRoundedRect(context, 365, 940, 350, 315, 28, "#fbbf24");
    if (visiblePodium.length >= 3) {
      drawRoundedRect(context, 705, 1085, 310, 170, 28, "#f97316");
    }
    [[220, 1150, "2"], [540, 1110, "1"], ...(visiblePodium.length >= 3 ? [[860, 1180, "3"]] : [])].forEach(([x, y, place]) => {
      context.fillStyle = "#ffffff";
      context.font = "900 82px Arial";
      context.textAlign = "center";
      context.fillText(place, x, y);
    });
  }

  context.fillStyle = "rgba(255, 255, 255, 0.78)";
  context.font = "700 17px Arial";
  context.textAlign = "center";
  context.fillText(
    Number(tournamentDurationSeconds || 0) > 0
      ? `Tempo geral do torneio: ${formatMatchDuration(tournamentDurationSeconds)} • Torneio360`
      : "Gerado pelo Torneio360 • torneio360.com",
    canvas.width / 2,
    canvas.height - 38
  );

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Não foi possível gerar a imagem.")), "image/png", 0.96);
  });
  const safeName = String(title || "podio").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return new File([blob], `${safeName || "podio"}-torneio360.png`, { type: "image/png" });
}

async function createRankingShareFile({
  title,
  subtitle,
  arenaName,
  arenaPhotoUrl,
  rankingCriteria,
  columns = null,
  criteriaLabel = "",
  tournamentDurationSeconds = 0,
  groups = [],
  pageNumber = 1,
  totalPages = 1,
}) {
  const criteria = getRankingCriteria(rankingCriteria);
  const exportColumns = Array.isArray(columns) && columns.length
    ? columns
    : criteria.order.map((key) => ({ key, label: getRankingColumnLabel(key) }));
  const normalizedGroups = normalizeRankingExportGroups(groups);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = RANKING_SHARE_CANVAS_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a imagem do ranking.");

  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, "#07163e");
  background.addColorStop(0.52, "#192574");
  background.addColorStop(1, "#5b21b6");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.globalAlpha = 0.16;
  context.fillStyle = "#22d3ee";
  context.beginPath();
  context.arc(950, 120, 270, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#fbbf24";
  context.beginPath();
  context.arc(75, canvas.height - 50, 260, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  const [logo, arenaPhoto] = await Promise.all([
    loadShareImage(TORNEIO360_LOGO),
    loadShareImage(arenaPhotoUrl),
  ]);

  if (logo) {
    const logoWidth = 330;
    const logoHeight = logoWidth * (logo.height / logo.width);
    context.drawImage(logo, 62, 34, logoWidth, logoHeight);
  } else {
    context.fillStyle = "#ffffff";
    context.font = "900 48px Arial";
    context.fillText("TORNEIO360", 62, 118);
  }

  const photoX = 862;
  const photoY = 116;
  const photoRadius = 76;
  context.save();
  context.beginPath();
  context.arc(photoX, photoY, photoRadius, 0, Math.PI * 2);
  context.clip();
  if (arenaPhoto) {
    const scale = Math.max((photoRadius * 2) / arenaPhoto.width, (photoRadius * 2) / arenaPhoto.height);
    const width = arenaPhoto.width * scale;
    const height = arenaPhoto.height * scale;
    context.drawImage(arenaPhoto, photoX - width / 2, photoY - height / 2, width, height);
  } else {
    const avatarGradient = context.createLinearGradient(photoX - photoRadius, photoY - photoRadius, photoX + photoRadius, photoY + photoRadius);
    avatarGradient.addColorStop(0, "#2563eb");
    avatarGradient.addColorStop(1, "#06b6d4");
    context.fillStyle = avatarGradient;
    context.fillRect(photoX - photoRadius, photoY - photoRadius, photoRadius * 2, photoRadius * 2);
    context.fillStyle = "#ffffff";
    context.font = "900 46px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(arenaName || "A").slice(0, 2).toUpperCase(), photoX, photoY + 2);
  }
  context.restore();
  context.strokeStyle = "#fbbf24";
  context.lineWidth = 8;
  context.beginPath();
  context.arc(photoX, photoY, photoRadius + 3, 0, Math.PI * 2);
  context.stroke();

  context.textAlign = "right";
  context.textBaseline = "alphabetic";
  context.fillStyle = "#ffffff";
  context.font = "900 24px Arial";
  context.fillText(truncateCanvasText(context, arenaName || "Arena Torneio360", 360), 770, 104);
  context.fillStyle = "#bae6fd";
  context.font = "700 17px Arial";
  context.fillText("ORGANIZAÇÃO", 770, 134);

  drawRoundedRect(context, 52, 222, 976, 168, 32, "rgba(7, 18, 57, 0.78)", "rgba(255, 255, 255, 0.18)");
  context.textAlign = "left";
  context.fillStyle = "#fbbf24";
  context.font = "900 18px Arial";
  context.fillText("RANKING OFICIAL", 88, 268);
  context.fillStyle = "#ffffff";
  context.font = "900 42px Arial";
  context.fillText(truncateCanvasText(context, title || "Ranking", 850), 88, 323);
  context.fillStyle = "#cbd5e1";
  context.font = "700 22px Arial";
  context.fillText(truncateCanvasText(context, subtitle || "Torneio360", 850), 88, 360);
  context.fillStyle = "#bae6fd";
  context.font = "700 16px Arial";
  context.fillText(truncateCanvasText(context, `Critério: ${criteriaLabel || criteria.label}`, 670), 88, 382);
  context.fillStyle = "#fbbf24";
  context.font = "900 16px Arial";
  context.textAlign = "right";
  context.fillText(`PÁGINA ${pageNumber} DE ${totalPages}`, 982, 382);

  let y = 432;
  normalizedGroups.forEach((group) => {
    const panelHeight = 64 + (group.rows.length * RANKING_SHARE_ROW_HEIGHT);
    drawRoundedRect(context, 52, y, 976, panelHeight, 28, "rgba(255, 255, 255, 0.96)", "rgba(255, 255, 255, 0.35)");
    context.fillStyle = "#111b3f";
    context.font = "900 23px Arial";
    context.textAlign = "left";
    context.fillText(group.title, 84, y + 38);
    y += 50;

    group.rows.forEach((row, index) => {
      const absoluteIndex = Number(group.startIndex || 0) + index;
      const rowFill = absoluteIndex === 0
        ? "#fff4c2"
        : absoluteIndex === 1
          ? "#eef2f7"
          : absoluteIndex === 2
            ? "#ffeadb"
            : absoluteIndex % 2 === 0 ? "#f6f8fc" : "#ffffff";
      drawRoundedRect(context, 72, y, 936, 56, 14, rowFill);
      const medalColor = absoluteIndex === 0 ? "#d97706" : absoluteIndex === 1 ? "#64748b" : absoluteIndex === 2 ? "#c2410c" : "#334155";
      context.fillStyle = medalColor;
      context.font = `900 ${absoluteIndex < 3 ? 20 : 18}px Arial`;
      context.textAlign = "center";
      context.fillText(`${absoluteIndex + 1}º`, 112, y + 35);
      context.fillStyle = "#111827";
      context.font = "800 18px Arial";
      context.textAlign = "left";
      context.fillText(truncateCanvasText(context, row.name, 365), 154, y + 35);

      const stats = exportColumns
        .filter(({ key }) => row[key] !== undefined)
        .map(({ key, label }) => `${label || getRankingColumnLabel(key)}: ${formatRankingMetricValue(key, row[key])}`);
      context.fillStyle = "#475569";
      context.font = "700 13px Arial";
      context.textAlign = "right";
      wrapCanvasItems(context, stats, 430).forEach((line, lineIndex) => {
        context.fillText(line, 982, y + 18 + (lineIndex * 16));
      });
      y += RANKING_SHARE_ROW_HEIGHT;
    });
    y += 14;
  });

  context.fillStyle = "rgba(255, 255, 255, 0.76)";
  context.font = "700 17px Arial";
  context.textAlign = "center";
  const rankingFooter = Number(tournamentDurationSeconds || 0) > 0
    ? `Tempo geral do torneio: ${formatMatchDuration(tournamentDurationSeconds)} • Torneio360 • Página ${pageNumber} de ${totalPages}`
    : `Gerado pelo Torneio360 • torneio360.com • Página ${pageNumber} de ${totalPages}`;
  context.fillText(rankingFooter, canvas.width / 2, canvas.height - 38);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Não foi possível gerar a imagem.")), "image/png", 0.96);
  });
  const safeName = String(title || "ranking").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  const pageSuffix = totalPages > 1 ? `-${String(pageNumber).padStart(2, "0")}-de-${String(totalPages).padStart(2, "0")}` : "";
  return new File([blob], `${safeName || "ranking"}-torneio360${pageSuffix}.png`, { type: "image/png" });
}

async function createRankingShareFiles(config) {
  if (config?.presentation === "podium" && Array.isArray(config?.podium) && config.podium.length > 0) {
    return [await createCupPodiumShareFile(config)];
  }

  const normalizedGroups = normalizeRankingExportGroups(config?.groups);
  const pages = paginateRankingGroups(normalizedGroups, {
    maxHeight: RANKING_SHARE_CONTENT_HEIGHT,
    rowHeight: RANKING_SHARE_ROW_HEIGHT,
    groupOverhead: RANKING_SHARE_GROUP_OVERHEAD,
  });
  const totalPages = Math.max(1, pages.length);

  return Promise.all((pages.length ? pages : [[]]).map((groups, pageIndex) => createRankingShareFile({
    ...config,
    groups,
    pageNumber: pageIndex + 1,
    totalPages,
  })));
}

async function copyRankingImageToClipboard(file) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") return false;

  try {
    if (ClipboardItem.supports && !ClipboardItem.supports("image/png")) return false;
    const pngBlob = new Blob([await file.arrayBuffer()], { type: "image/png" });
    await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
    return true;
  } catch (error) {
    console.warn("Não foi possível preparar a imagem na área de transferência.", error);
    return false;
  }
}

function downloadRankingFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadRankingFiles(files) {
  files.forEach((file) => downloadRankingFile(file));
}

function createRankingPrintElement(printDocument, tagName, className, text) {
  const element = printDocument.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function printRankingDocument(config) {
  const normalizedGroups = normalizeRankingExportGroups(config?.groups);
  if (normalizedGroups.length === 0) return false;

  const printWindow = window.open("", "_blank", "width=920,height=860");
  if (!printWindow) return false;

  printWindow.opener = null;
  const printDocument = printWindow.document;
  const criteria = getRankingCriteria(config?.rankingCriteria);
  const exportColumns = Array.isArray(config?.columns) && config.columns.length
    ? config.columns
    : criteria.order.map((key) => ({ key, label: getRankingColumnLabel(key) }));
  const printPages = paginateRankingGroups(normalizedGroups, {
    maxHeight: 20,
    rowHeight: 1,
    groupOverhead: 2,
  });
  const metricLabels = {
    w: "Vitórias",
    pts: "Total de Games",
    bal: "Saldo de Games",
    playTimeSeconds: "Tempo em jogo",
  };
  const style = printDocument.createElement("style");
  style.textContent = `
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; font-family: Arial, sans-serif; color: #101a35; }
    body { background: #dfe7f1; }
    .rankingPrintPage { position: relative; width: 210mm; min-height: 297mm; margin: 0 auto 8mm; padding: 10mm 11mm 14mm; overflow: hidden; background: #fff; break-after: page; page-break-after: always; }
    .rankingPrintPage:last-child { margin-bottom: 0; break-after: auto; page-break-after: auto; }
    .rankingPrintBrand { display: flex; align-items: center; justify-content: space-between; gap: 10mm; min-height: 20mm; padding-bottom: 4mm; border-bottom: 1px solid #dbe3ef; }
    .rankingPrintLogo { display: block; width: 45mm; height: 16mm; object-fit: contain; object-position: left center; }
    .rankingPrintArena { display: flex; align-items: center; justify-content: flex-end; gap: 3mm; min-width: 0; text-align: right; }
    .rankingPrintArenaPhoto { width: 14mm; height: 14mm; border: 1.2mm solid #fbbf24; border-radius: 50%; object-fit: cover; }
    .rankingPrintArena strong { display: block; max-width: 70mm; overflow-wrap: anywhere; font-size: 10pt; }
    .rankingPrintArena span { display: block; margin-top: 1mm; color: #64748b; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; }
    .rankingPrintHeading { margin: 5mm 0 4mm; padding: 4mm 5mm; border-radius: 4mm; background: linear-gradient(135deg, #07163e, #24368f); color: #fff; }
    .rankingPrintHeading span { color: #fbbf24; font-size: 7.5pt; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
    .rankingPrintHeading h1 { margin: 1.5mm 0 1mm; font-size: 19pt; line-height: 1.05; }
    .rankingPrintHeading p { margin: .8mm 0 0; color: #dbeafe; font-size: 8.5pt; font-weight: 700; }
    .rankingPrintGroup { margin-top: 3mm; break-inside: avoid; page-break-inside: avoid; }
    .rankingPrintGroup h2 { margin: 0; padding: 2.5mm 3mm; border: 1px solid #d9e2ef; border-bottom: 0; border-radius: 3mm 3mm 0 0; background: #edf3fb; font-size: 10pt; }
    .rankingPrintTable { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .rankingPrintTable th { padding: 2.2mm 2.4mm; background: #101b3f; color: #fff; font-size: 7.3pt; line-height: 1.1; text-align: center; text-transform: uppercase; }
    .rankingPrintTable th:nth-child(1) { width: 11mm; }
    .rankingPrintTable th:nth-child(2) { width: auto; text-align: left; }
    .rankingPrintTable th:not(:nth-child(-n+2)) { width: 29mm; }
    .rankingPrintTable td { padding: 2.5mm 2.4mm; border-bottom: 1px solid #dfe6ef; background: #fff; font-size: 8.8pt; font-weight: 700; text-align: center; }
    .rankingPrintTable tr:nth-child(even) td { background: #f7f9fc; }
    .rankingPrintTable tr:first-child td { background: #fff8d9; }
    .rankingPrintTable td:nth-child(2) { overflow-wrap: anywhere; text-align: left; font-size: 9.2pt; font-weight: 800; }
    .rankingPrintFooter { position: absolute; right: 11mm; bottom: 6mm; left: 11mm; display: flex; justify-content: space-between; gap: 8mm; padding-top: 2mm; border-top: 1px solid #dbe3ef; color: #64748b; font-size: 7pt; font-weight: 700; }
    @media print {
      body { background: #fff; }
      .rankingPrintPage { margin: 0; }
    }
  `;

  printPages.forEach((pageGroups, pageIndex) => {
    const page = createRankingPrintElement(printDocument, "section", "rankingPrintPage");
    const brand = createRankingPrintElement(printDocument, "header", "rankingPrintBrand");
    const logo = createRankingPrintElement(printDocument, "img", "rankingPrintLogo");
    logo.alt = "Torneio360";
    logo.src = new URL(TORNEIO360_LOGO, window.location.origin).href;
    brand.appendChild(logo);

    const arena = createRankingPrintElement(printDocument, "div", "rankingPrintArena");
    const arenaCopy = createRankingPrintElement(printDocument, "div");
    arenaCopy.appendChild(createRankingPrintElement(printDocument, "strong", "", config?.arenaName || "Arena Torneio360"));
    arenaCopy.appendChild(createRankingPrintElement(printDocument, "span", "", "Organização"));
    arena.appendChild(arenaCopy);
    if (config?.arenaPhotoUrl) {
      const arenaPhoto = createRankingPrintElement(printDocument, "img", "rankingPrintArenaPhoto");
      arenaPhoto.alt = "Foto da arena";
      arenaPhoto.src = config.arenaPhotoUrl;
      arena.appendChild(arenaPhoto);
    }
    brand.appendChild(arena);
    page.appendChild(brand);

    const heading = createRankingPrintElement(printDocument, "div", "rankingPrintHeading");
    heading.appendChild(createRankingPrintElement(printDocument, "span", "", "Ranking oficial"));
    heading.appendChild(createRankingPrintElement(printDocument, "h1", "", config?.title || "Ranking"));
    heading.appendChild(createRankingPrintElement(printDocument, "p", "", config?.subtitle || "Torneio360"));
    heading.appendChild(createRankingPrintElement(printDocument, "p", "", `Critério: ${config?.criteriaLabel || criteria.label}`));
    if (Number(config?.tournamentDurationSeconds || 0) > 0) {
      heading.appendChild(createRankingPrintElement(
        printDocument,
        "p",
        "",
        `Tempo geral do torneio: ${formatMatchDuration(config.tournamentDurationSeconds)}`
      ));
    }
    page.appendChild(heading);

    pageGroups.forEach((group) => {
      const groupSection = createRankingPrintElement(printDocument, "section", "rankingPrintGroup");
      groupSection.appendChild(createRankingPrintElement(printDocument, "h2", "", group.title));
      const table = createRankingPrintElement(printDocument, "table", "rankingPrintTable");
      const tableHead = printDocument.createElement("thead");
      const headRow = printDocument.createElement("tr");
      ["#", "Nome", ...exportColumns.map(({ key, label }) => label || metricLabels[key] || key)].forEach((label) => {
        headRow.appendChild(createRankingPrintElement(printDocument, "th", "", label));
      });
      tableHead.appendChild(headRow);
      table.appendChild(tableHead);

      const tableBody = printDocument.createElement("tbody");
      group.rows.forEach((row, rowIndex) => {
        const absoluteIndex = Number(group.startIndex || 0) + rowIndex;
        const tableRow = printDocument.createElement("tr");
        tableRow.appendChild(createRankingPrintElement(printDocument, "td", "", `${absoluteIndex + 1}º`));
        tableRow.appendChild(createRankingPrintElement(printDocument, "td", "", row.name || "Sem nome"));
        exportColumns.forEach(({ key }) => {
          tableRow.appendChild(createRankingPrintElement(printDocument, "td", "", formatRankingMetricValue(key, row[key])));
        });
        tableBody.appendChild(tableRow);
      });
      table.appendChild(tableBody);
      groupSection.appendChild(table);
      page.appendChild(groupSection);
    });

    const footer = createRankingPrintElement(printDocument, "footer", "rankingPrintFooter");
    footer.appendChild(createRankingPrintElement(printDocument, "span", "", "Gerado pelo Torneio360 • torneio360.com"));
    footer.appendChild(createRankingPrintElement(printDocument, "span", "", `Página ${pageIndex + 1} de ${printPages.length}`));
    page.appendChild(footer);
    printDocument.body.appendChild(page);
  });

  printDocument.title = `${config?.title || "Ranking"} — Torneio360`;
  printDocument.head.appendChild(style);
  printDocument.close();
  printWindow.addEventListener("afterprint", () => {
    printWindow.close();
  }, { once: true });
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 300);
  return true;
}

function isMobileShareDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "")
    || (navigator.maxTouchPoints > 1 && window.matchMedia?.("(max-width: 900px)").matches);
}

function canNativeShareRankingFiles(files) {
  if (!navigator.share) return false;
  try {
    return !navigator.canShare || navigator.canShare({ files });
  } catch (error) {
    return false;
  }
}

async function nativeShareRankingFiles(files, config) {
  if (!canNativeShareRankingFiles(files)) return false;
  await navigator.share({
    title: config.title || "Ranking Torneio360",
    text: `${config.title || "Ranking"} — ${config.arenaName || "Torneio360"}`,
    files,
  });
  return true;
}

async function shareRankingImages(config) {
  const files = await createRankingShareFiles(config);

  if (isMobileShareDevice() && await nativeShareRankingFiles(files, config)) {
    return { status: "shared", files: [] };
  }

  if (files.length === 1 && !isMobileShareDevice()) {
    const imageCopied = await copyRankingImageToClipboard(files[0]);
    return { status: imageCopied ? "copied" : "copyError", files };
  }

  return { status: "ready", files };
}

export {
  canNativeShareRankingFiles,
  downloadRankingFiles,
  nativeShareRankingFiles,
  printRankingDocument,
  shareRankingImages,
};
