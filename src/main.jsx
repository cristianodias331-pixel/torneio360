import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import {
  AtSign,
  Camera,
  CalendarDays,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  CircleHelp,
  CloudCheck,
  CloudOff,
  Clock3,
  Copy,
  Dices,
  Download,
  Flame,
  Gift,
  GitBranch,
  Grid3X3,
  LayoutDashboard,
  LifeBuoy,
  Link2,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Moon,
  PlusCircle,
  Printer,
  RefreshCw,
  Search,
  Settings,
  Shapes,
  Share2,
  Sun,
  Tag,
  Target,
  Trash2,
  Trophy,
  Undo2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import InstallAppBanner from "./InstallAppBanner.jsx";
import { orderFixedMixedPair } from "./fixedMixedTeamOrder.mjs";
import {
  listPendingTournaments,
  mergeConcurrentTournamentData,
  preservesTournamentCriticalData,
  readDashboardCache,
  removePendingTournament,
  requestDurableOfflineStorage,
  saveDashboardCache,
  savePendingTournament,
} from "./offlineDataStore.mjs";
import { super12IndividualTemplate } from "./super12Schedule.mjs";
import { super20MixedTemplate } from "./super20MixedSchedule.mjs";
import "./style.css";

const SUPABASE_URL = "https://dttutybojealkvuywszt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Tr5qiUea-p42UknVoWwPKg_6K_b1EX_";
const PLATFORM_WHATSAPP_NUMBER = "5585988739056";
const PLATFORM_WHATSAPP_DEFAULT_MESSAGE = "Olá! Preciso de ajuda com o Torneio360.";

function getPlatformWhatsAppUrl(message = PLATFORM_WHATSAPP_DEFAULT_MESSAGE) {
  return `https://wa.me/${PLATFORM_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

const PLATFORM_SUPPORT = Object.freeze([
  {
    id: "whatsapp",
    label: "WhatsApp",
    value: "85 9.8873-9056",
    href: getPlatformWhatsAppUrl(),
    Icon: MessageCircle,
    external: true,
  },
  {
    id: "instagram",
    label: "Instagram",
    value: "@torneio360",
    href: "https://www.instagram.com/torneio360/",
    Icon: AtSign,
    external: true,
  },
  {
    id: "email",
    label: "E-mail",
    value: "torneio360@gmail.com",
    href: "mailto:torneio360@gmail.com",
    Icon: Mail,
    external: false,
  },
]);
const supabase = globalThis.__torneio360Supabase || createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
if (import.meta.env.DEV) globalThis.__torneio360Supabase = supabase;
const TORNEIO360_LOGO = "/torneio360-logo.png";
const TORNEIO360_LOGO_BLUE = "/torneio360-logo-blue.png";

function loadShareImage(source) {
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

function resizeImageFile(file, {
  maxWidth = 1400,
  maxHeight = 900,
  quality = 0.84,
  outputType = "image/jpeg",
} = {}) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) {
      reject(new Error("Escolha um arquivo de imagem."));
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("Escolha uma imagem com até 8 MB."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("A imagem escolhida não pôde ser aberta."));
      image.onload = () => {
        const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Não foi possível preparar a imagem."));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(outputType, quality));
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function drawRoundedRect(context, x, y, width, height, radius, fillStyle, strokeStyle = null) {
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

function truncateCanvasText(context, value, maxWidth) {
  const text = String(value || "Sem nome");
  if (context.measureText(text).width <= maxWidth) return text;

  let shortened = text;
  while (shortened.length > 1 && context.measureText(`${shortened}…`).width > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened}…`;
}

const RANKING_SHARE_CANVAS_HEIGHT = 1350;
const RANKING_SHARE_CONTENT_HEIGHT = 810;
const RANKING_SHARE_ROW_HEIGHT = 60;
const RANKING_SHARE_GROUP_OVERHEAD = 86;

function normalizeRankingExportGroups(groups = []) {
  return groups
    .map((group) => ({
      title: group?.title || "Ranking",
      rows: Array.isArray(group?.rows) ? group.rows : [],
      startIndex: Number(group?.startIndex || 0),
    }))
    .filter((group) => group.rows.length > 0);
}

function paginateRankingGroups(groups, {
  maxHeight,
  rowHeight,
  groupOverhead,
}) {
  const pages = [];
  let currentPage = [];
  let usedHeight = 0;

  function finishPage() {
    if (currentPage.length > 0) pages.push(currentPage);
    currentPage = [];
    usedHeight = 0;
  }

  groups.forEach((group) => {
    let rowIndex = 0;

    while (rowIndex < group.rows.length) {
      const availableHeight = maxHeight - usedHeight - groupOverhead;
      const availableRows = Math.floor(availableHeight / rowHeight);

      if (availableRows <= 0) {
        finishPage();
        continue;
      }

      const pageRows = group.rows.slice(rowIndex, rowIndex + availableRows);
      currentPage.push({
        title: rowIndex > 0 ? `${group.title} — continuação` : group.title,
        rows: pageRows,
        startIndex: rowIndex,
      });
      usedHeight += groupOverhead + (pageRows.length * rowHeight);
      rowIndex += pageRows.length;

      if (rowIndex < group.rows.length) finishPage();
    }
  });

  finishPage();
  return pages;
}

async function createRankingShareFile({
  title,
  subtitle,
  arenaName,
  arenaPhotoUrl,
  rankingCriteria,
  groups = [],
  pageNumber = 1,
  totalPages = 1,
}) {
  const criteria = getRankingCriteria(rankingCriteria);
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
  context.fillText(truncateCanvasText(context, `Critério: ${criteria.label}`, 670), 88, 382);
  context.fillStyle = "#fbbf24";
  context.font = "900 16px Arial";
  context.textAlign = "right";
  context.fillText(`PÁGINA ${pageNumber} DE ${totalPages}`, 982, 382);

  let y = 432;
  normalizedGroups.forEach((group) => {
    const panelHeight = 74 + (group.rows.length * RANKING_SHARE_ROW_HEIGHT);
    drawRoundedRect(context, 52, y, 976, panelHeight, 28, "rgba(255, 255, 255, 0.96)", "rgba(255, 255, 255, 0.35)");
    context.fillStyle = "#111b3f";
    context.font = "900 25px Arial";
    context.textAlign = "left";
    context.fillText(group.title, 84, y + 45);
    y += 64;

    group.rows.forEach((row, index) => {
      const absoluteIndex = Number(group.startIndex || 0) + index;
      const rowFill = absoluteIndex === 0
        ? "#fff4c2"
        : absoluteIndex === 1
          ? "#eef2f7"
          : absoluteIndex === 2
            ? "#ffeadb"
            : absoluteIndex % 2 === 0 ? "#f6f8fc" : "#ffffff";
      drawRoundedRect(context, 72, y, 936, 50, 15, rowFill);
      const medalColor = absoluteIndex === 0 ? "#d97706" : absoluteIndex === 1 ? "#64748b" : absoluteIndex === 2 ? "#c2410c" : "#334155";
      context.fillStyle = medalColor;
      context.font = `900 ${absoluteIndex < 3 ? 23 : 20}px Arial`;
      context.textAlign = "center";
      context.fillText(`${absoluteIndex + 1}º`, 112, y + 33);
      context.fillStyle = "#111827";
      context.font = "800 20px Arial";
      context.textAlign = "left";
      context.fillText(truncateCanvasText(context, row.name, 510), 154, y + 33);

      const metricText = {
        w: `${Number(row.w || 0)} vit.`,
        pts: `${Number(row.pts || 0)} games`,
        bal: `saldo ${Number(row.bal || 0)}`,
      };
      const stats = criteria.order
        .filter((key) => row[key] !== undefined)
        .map((key) => metricText[key]);
      context.fillStyle = "#475569";
      context.font = "700 16px Arial";
      context.textAlign = "right";
      context.fillText(truncateCanvasText(context, stats.join("  •  "), 300), 982, y + 32);
      y += RANKING_SHARE_ROW_HEIGHT;
    });
    y += 22;
  });

  context.fillStyle = "rgba(255, 255, 255, 0.76)";
  context.font = "700 17px Arial";
  context.textAlign = "center";
  context.fillText(`Gerado pelo Torneio360 • torneio360.com • Página ${pageNumber} de ${totalPages}`, canvas.width / 2, canvas.height - 38);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Não foi possível gerar a imagem.")), "image/png", 0.96);
  });
  const safeName = String(title || "ranking").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  const pageSuffix = totalPages > 1 ? `-${String(pageNumber).padStart(2, "0")}-de-${String(totalPages).padStart(2, "0")}` : "";
  return new File([blob], `${safeName || "ranking"}-torneio360${pageSuffix}.png`, { type: "image/png" });
}

async function createRankingShareFiles(config) {
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
  const printPages = paginateRankingGroups(normalizedGroups, {
    maxHeight: 20,
    rowHeight: 1,
    groupOverhead: 2,
  });
  const metricLabels = {
    w: "Vitórias",
    pts: "Total de Games",
    bal: "Saldo de Games",
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
    heading.appendChild(createRankingPrintElement(printDocument, "p", "", `Critério: ${criteria.label}`));
    page.appendChild(heading);

    pageGroups.forEach((group) => {
      const groupSection = createRankingPrintElement(printDocument, "section", "rankingPrintGroup");
      groupSection.appendChild(createRankingPrintElement(printDocument, "h2", "", group.title));
      const table = createRankingPrintElement(printDocument, "table", "rankingPrintTable");
      const tableHead = printDocument.createElement("thead");
      const headRow = printDocument.createElement("tr");
      ["#", "Nome", ...criteria.order.map((key) => metricLabels[key])].forEach((label) => {
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
        criteria.order.forEach((key) => {
          tableRow.appendChild(createRankingPrintElement(printDocument, "td", "", String(Number(row[key] || 0))));
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
const TORNEIO360_TAGLINE = "Gestão inteligente de torneios";

async function logout() {
  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch (e) {
    console.error(e);
  }

  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.includes("supabase") || key.includes("sb-") || key.includes("auth")) {
        localStorage.removeItem(key);
      }
    });

    sessionStorage.clear();
  } catch (e) {
    console.error(e);
  }

  window.location.replace("/");
}

const rankingCriteriaOptions = [
  {
    value: "wins_points_balance",
    label: "Vitórias > Total de Games > Saldo de games",
    order: ["w", "pts", "bal"],
  },
  {
    value: "wins_balance_points",
    label: "Vitórias > Saldo de games > Total de Games",
    order: ["w", "bal", "pts"],
  },
  {
    value: "points_wins_balance",
    label: "Total de Games > Vitórias > Saldo de games",
    order: ["pts", "w", "bal"],
  },
  {
    value: "points_balance_wins",
    label: "Total de Games > Saldo de games > Vitórias",
    order: ["pts", "bal", "w"],
  },
  {
    value: "balance_wins_points",
    label: "Saldo de games > Vitórias > Total de Games",
    order: ["bal", "w", "pts"],
  },
  {
    value: "balance_points_wins",
    label: "Saldo de games > Total de Games > Vitórias",
    order: ["bal", "pts", "w"],
  },
];

const defaultRankingCriteria = "wins_points_balance";

function generatePublicId() {
  return `tfbt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateCollaborationChangeId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function getPublicUrl(publicId) {
  return `${window.location.origin}${window.location.pathname}?public=${publicId}`;
}

function getArenaPublicUrl(arenaId) {
  const url = new URL(window.location.origin);
  url.searchParams.set("arena", arenaId);
  return url.toString();
}

function getArenaPublicShareMessage(arenaId) {
  const url = getArenaPublicUrl(arenaId);
  return `Acompanhe os torneios e circuitos desta arena no Torneio360:
${url}`;
}

const ARENA_DIRECTORY_REFRESH_INTERVAL_MS = 60_000;
const ARENA_DIRECTORY_RETRY_DELAY_MS = 450;

async function fetchPublicArenaDirectory({ search = null, limit = 250 } = {}) {
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await supabase.rpc("list_public_arenas", {
      p_search: search,
      p_limit: limit,
    });

    if (!result.error) {
      return {
        data: Array.isArray(result.data) ? result.data : [],
        error: null,
      };
    }

    lastError = result.error;
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, ARENA_DIRECTORY_RETRY_DELAY_MS));
    }
  }

  return { data: [], error: lastError };
}

function getAutomaticEventStatus(endDate) {
  if (!endDate) return "active";
  return String(endDate) < getBrazilTodayISO() ? "finished" : "active";
}

function hasTournamentGameSide(game, side) {
  const ids = Array.isArray(game?.[`ids${side}`]) ? game[`ids${side}`] : [];
  const names = Array.isArray(game?.[`team${side}`]) ? game[`team${side}`].filter(Boolean) : [];
  const entry = game?.[`entry${side}`];
  return ids.length > 0 || names.length > 0 || Boolean(entry && !entry.isBye && !entry.bye);
}

function isTournamentByeGame(game) {
  if (game?.isBye || game?.bye) return true;
  const firstSide = hasTournamentGameSide(game, 1);
  const secondSide = hasTournamentGameSide(game, 2);
  return firstSide !== secondSide;
}

function isTournamentGameFinished(game, winningScore) {
  if (!game || game.s1 === "" || game.s2 === "" || game.s1 === null || game.s2 === null) return false;
  return Boolean(getScoreWinnerSide(game, winningScore));
}

function getTournamentCompletionState(tournament) {
  const config = modalityConfig[tournament?.type];
  const data = normalizeTournamentData(tournament?.type, tournament?.data);
  const winningScore = getWinningScore(data);
  const scheduleGames = (data.schedule || []).flat().filter((game) => (
    hasTournamentGameSide(game, 1) && hasTournamentGameSide(game, 2)
  ));
  const bracketGames = (data.brackets || []).map((game) => (
    resolveBracketGame(game, data.brackets || [], data)
  ));
  const requiredBracketGames = bracketGames.filter((game) => !isTournamentByeGame(game));
  const requiredGames = [...scheduleGames, ...requiredBracketGames];
  const needsEliminationBracket = isCupType(config);
  const bracketReady = !needsEliminationBracket || requiredBracketGames.length > 0;

  return {
    hasRequiredGames: requiredGames.length > 0 && bracketReady,
    completed: requiredGames.length > 0
      && bracketReady
      && requiredGames.every((game) => isTournamentGameFinished(game, winningScore)),
    requiredGames: requiredGames.length,
    completedGames: requiredGames.filter((game) => isTournamentGameFinished(game, winningScore)).length,
  };
}

function getTournamentLifecycleStatus(tournament, now = new Date()) {
  const details = tournament?.data || {};
  const eventKey = getTournamentEventSortKey(tournament);
  const nowKey = getBrazilDateTimeKey(now);
  const today = getBrazilTodayISO(now);
  const eventStartDate = String(details.eventStartDate || details.eventDate || "").slice(0, 10);
  const eventStartTime = String(details.eventStartTime || "").trim();
  const eventEndDate = String(details.eventEndDate || details.eventDate || "").slice(0, 10);

  if (details.lifecycleStatus === "finished" && tournament?.directoryEntry) return "finished";
  if (getTournamentCompletionState(tournament).completed) return "finished";
  if (eventEndDate && eventEndDate < today) return "finished";
  if (eventStartDate && eventStartDate > today) return "upcoming";
  if (eventStartDate === today && eventStartTime && eventKey > nowKey) return "upcoming";

  return "active";
}

function getCollaborationRevision(row) {
  if (row?.revision === null || row?.revision === undefined || row?.revision === "") return null;
  const revision = Number(row?.revision);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : null;
}

function compareCollaborationVersions(first, second) {
  const firstRevision = getCollaborationRevision(first);
  const secondRevision = getCollaborationRevision(second);

  if (firstRevision !== null || secondRevision !== null) {
    if (firstRevision === null) return -1;
    if (secondRevision === null) return 1;
    return firstRevision - secondRevision;
  }

  const firstUpdatedAt = Date.parse(first?.updated_at || first?.updatedAt || "") || 0;
  const secondUpdatedAt = Date.parse(second?.updated_at || second?.updatedAt || "") || 0;
  return firstUpdatedAt - secondUpdatedAt;
}

function tournamentDataEquals(first, second) {
  if (Object.is(first, second)) return true;
  try {
    return JSON.stringify(first || {}) === JSON.stringify(second || {});
  } catch {
    return false;
  }
}

function tournamentMutationDataEquals(first, second) {
  const firstData = { ...(first || {}) };
  const secondData = { ...(second || {}) };
  delete firstData.lifecycleStatus;
  delete secondData.lifecycleStatus;
  return tournamentDataEquals(firstData, secondData);
}

function mergeRealtimeTournamentRow(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming) return existing;
  if (compareCollaborationVersions(incoming, existing) < 0) return existing;

  const incomingHasCompleteData = incoming.data
    && typeof incoming.data === "object"
    && !Array.isArray(incoming.data)
    && Object.keys(incoming.data).length > 0;

  return {
    ...existing,
    ...incoming,
    data: incomingHasCompleteData ? incoming.data : existing.data,
  };
}

function isPublicItemFinished(item, kind = "tournament") {
  if (kind === "tournament") return getTournamentLifecycleStatus(item) === "finished";

  const endDate = item?.end_date || item?.endDate;
  if (!endDate) return normalizeCircuitStatus(item?.status) === "closed";
  return getAutomaticEventStatus(endDate) === "finished";
}

function getCircuitLifecycleStatus(circuit) {
  const today = getBrazilTodayISO();
  const startDate = String(circuit?.start_date || circuit?.startDate || "").slice(0, 10);

  if (isPublicItemFinished(circuit, "circuit")) return "finished";
  if (startDate && startDate > today) return "upcoming";
  return "active";
}

function getTournamentEventSortKey(tournament) {
  const details = tournament?.data || {};
  const eventDate = String(details.eventDate || details.eventStartDate || "").slice(0, 10);
  const rawTime = String(details.eventStartTime || "").trim();
  const eventTime = /^\d{2}:\d{2}/.test(rawTime) ? rawTime.slice(0, 5) : "23:59";
  return eventDate ? `${eventDate}T${eventTime}` : "9999-12-31T23:59";
}

function compareTournamentsByEventSchedule(first, second) {
  const statusOrder = { active: 0, upcoming: 1, finished: 2 };
  const firstStatus = getTournamentLifecycleStatus(first);
  const secondStatus = getTournamentLifecycleStatus(second);
  const statusComparison = (statusOrder[firstStatus] ?? 1) - (statusOrder[secondStatus] ?? 1);
  if (statusComparison !== 0) return statusComparison;

  const scheduleComparison = getTournamentEventSortKey(first).localeCompare(getTournamentEventSortKey(second));
  if (scheduleComparison !== 0) return firstStatus === "finished" ? -scheduleComparison : scheduleComparison;

  const createdComparison = String(first?.created_at || "").localeCompare(String(second?.created_at || ""));
  if (createdComparison !== 0) return createdComparison;

  return String(first?.name || "").localeCompare(String(second?.name || ""), "pt-BR");
}

function sortTournamentsByEventSchedule(items) {
  return [...(items || [])].sort(compareTournamentsByEventSchedule);
}

function sortTournamentsChronologically(items) {
  return [...(items || [])].sort((first, second) => (
    getTournamentEventSortKey(first).localeCompare(getTournamentEventSortKey(second))
  ));
}

function sortTournamentsByDisplayOrder(items) {
  return (items || [])
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((first, second) => {
      const firstOrder = Number(first.item.data?.displayOrder);
      const secondOrder = Number(second.item.data?.displayOrder);
      const firstHasOrder = Number.isFinite(firstOrder);
      const secondHasOrder = Number.isFinite(secondOrder);

      if (firstHasOrder && secondHasOrder && firstOrder !== secondOrder) return firstOrder - secondOrder;
      if (firstHasOrder !== secondHasOrder) return firstHasOrder ? -1 : 1;
      return first.originalIndex - second.originalIndex;
    })
    .map(({ item }) => item);
}

function hasSavedManualTournamentOrder(items) {
  if (!items?.length) return false;
  if (!items.every((item) => item.data?.displayOrderMode === "manual")) return false;
  const orders = items
    .map((item) => Number(item.data?.displayOrder))
    .filter((order) => Number.isInteger(order))
    .sort((first, second) => first - second);

  return orders.length === items.length && orders.every((order, index) => order === index);
}

function sortTournamentsForDisplay(items) {
  return hasSavedManualTournamentOrder(items)
    ? sortTournamentsByDisplayOrder(items)
    : sortTournamentsByEventSchedule(items);
}

function insertTournamentsByEventSchedule(currentItems, incomingItems) {
  const incomingIds = new Set((incomingItems || []).map((item) => item.id));
  const ordered = (currentItems || []).filter((item) => !incomingIds.has(item.id));

  sortTournamentsByEventSchedule(incomingItems).forEach((incoming) => {
    const insertionIndex = ordered.findIndex((item) => compareTournamentsByEventSchedule(incoming, item) < 0);
    if (insertionIndex < 0) ordered.push(incoming);
    else ordered.splice(insertionIndex, 0, incoming);
  });

  return ordered;
}

function getTournamentRegistrationDeadline(tournament) {
  return tournament?.data?.registrationDeadline
    || tournament?.registrationDeadline
    || tournament?.registration_deadline
    || "";
}

function isRegistrationDeadlineOpen(deadline) {
  return Boolean(deadline) && String(deadline) >= getBrazilTodayISO();
}

function PublicRegistrationStatus({ open, whatsapp, eventName }) {
  if (!open) {
    return <span className="publicRegistrationStatus closed">Inscrições encerradas</span>;
  }

  const message = `Olá! Quero me inscrever em ${eventName || "um evento"} pelo Torneio360.`;
  const whatsappUrl = getBrazilianWhatsAppUrl(whatsapp, message);

  if (!whatsappUrl) {
    return <span className="publicRegistrationStatus open unavailable" title="WhatsApp não cadastrado pela arena">Inscreva-se</span>;
  }

  return (
    <a className="publicRegistrationStatus open" href={whatsappUrl} target="_blank" rel="noreferrer">
      <MessageCircle aria-hidden="true" /> Inscreva-se
    </a>
  );
}

function getPublicTournamentDirectoryItem(tournament) {
  const details = tournament?.data || {};

  return {
    id: tournament?.id || tournament?.public_id,
    public_id: tournament?.public_id || null,
    name: tournament?.name || "Torneio",
    type: tournament?.type || "",
    data: {
      eventDate: details.eventDate || "",
      eventEndDate: details.eventEndDate || details.eventDate || "",
      eventStartTime: details.eventStartTime || "",
      location: details.location || "",
      gender: details.gender || "",
      coverImageUrl: details.coverImageUrl || "",
      registrationDeadline: details.registrationDeadline || "",
      eventName: details.eventName || "",
      eventGroupKey: details.eventGroupKey || "",
      multiCategoryEvent: details.multiCategoryEvent === true,
      displayOrder: details.displayOrder,
      displayOrderMode: details.displayOrderMode || "automatic",
      lifecycleStatus: getTournamentLifecycleStatus(tournament),
    },
    directoryEntry: true,
  };
}

function getPublicCircuitDirectoryItem(circuit, rankingGroups = [], rankingCriteria = defaultRankingCriteria) {
  return {
    id: circuit?.id,
    name: circuit?.name || "Circuito",
    start_date: circuit?.start_date || circuit?.startDate || "",
    end_date: circuit?.end_date || circuit?.endDate || "",
    status: normalizeCircuitStatus(circuit?.status),
    tournament_ids: circuit?.tournament_ids || circuit?.tournamentIds || [],
    ranking_criteria: rankingCriteria,
    ranking_groups: rankingGroups.map((group) => ({
      key: group.key,
      title: group.title,
      rows: (group.rows || []).map((row) => ({
        id: row.id,
        name: row.name,
        pts: Number(row.pts || 0),
        w: Number(row.w || 0),
        bal: Number(row.bal || 0),
        played: Number(row.played || 0),
        tournaments: Number(row.tournaments || 0),
      })),
    })),
  };
}

function readPublicViewStorage(key, fallbackValue) {
  try {
    return sessionStorage.getItem(key) || fallbackValue;
  } catch (error) {
    // Links públicos também precisam funcionar quando o navegador bloqueia
    // o armazenamento da sessão, como em algumas visualizações dentro de apps.
    return fallbackValue;
  }
}

function savePublicViewStorage(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch (error) {
    // A aba continua navegável mesmo sem persistir a última subaba aberta.
  }
}

const USER_APP_STATE_STORAGE_PREFIX = "torneio360:user-app-state:v2:";
const OPEN_TOURNAMENTS_STORAGE_PREFIX = "torneio360:open-tournaments:v1:";
const OPEN_TOURNAMENT_NAV_STORAGE_PREFIX = "torneio360:open-tournament-navigation:v1:";
const PROFILE_CACHE_STORAGE_PREFIX = "torneio360:profile-cache:v1:";
const TOURNAMENT_DRAFT_STORAGE_PREFIX = "torneio360:tournament-draft:";
const TOURNAMENT_DRAFT_CHANGED_EVENT = "torneio360:tournament-draft-changed";
const DEFAULT_TOURNAMENT_NAVIGATION = Object.freeze({
  tournamentTab: "participantes",
  matchesTab: "grupos",
  scrollY: 0,
});

function isBrowserOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function isRetryableConnectionError(error) {
  if (isBrowserOffline()) return true;
  const text = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return /failed to fetch|fetch failed|network|offline|connection|timeout|timed out|load failed|gateway|temporarily unavailable/.test(text);
}

function getProfileCacheKey(userId) {
  return `${PROFILE_CACHE_STORAGE_PREFIX}${userId}`;
}

function readCachedProfile(userId) {
  if (!userId) return null;
  try {
    const cached = JSON.parse(localStorage.getItem(getProfileCacheKey(userId)) || "null");
    return cached?.profile && typeof cached.profile === "object" ? cached.profile : null;
  } catch {
    return null;
  }
}

function saveCachedProfile(userId, profile) {
  if (!userId || !profile) return;
  try {
    localStorage.setItem(getProfileCacheKey(userId), JSON.stringify({
      profile,
      savedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.warn("Não foi possível atualizar a cópia offline do perfil.", error);
  }
}
const TOURNAMENT_TAB_COLORS = Object.freeze([
  "#2563eb",
  "#ea580c",
  "#0f766e",
  "#db2777",
  "#16a34a",
  "#ca8a04",
  "#0891b2",
  "#dc2626",
  "#4f46e5",
  "#65a30d",
  "#e11d48",
  "#0284c7",
  "#b45309",
  "#059669",
  "#7c3aed",
  "#c026d3",
  "#0e7490",
  "#d97706",
  "#be123c",
  "#4338ca",
]);

function getOpenTournamentsStorageKey(userId) {
  return `${OPEN_TOURNAMENTS_STORAGE_PREFIX}${userId || "anonymous"}`;
}

function getOpenTournamentNavigationStorageKey(userId) {
  return `${OPEN_TOURNAMENT_NAV_STORAGE_PREFIX}${userId || "anonymous"}`;
}

function readOpenTournamentIds(userId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(getOpenTournamentsStorageKey(userId)) || "[]");
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((id) => typeof id === "string" && id.trim()))].slice(0, 50)
      : [];
  } catch {
    return [];
  }
}

function saveOpenTournamentIds(userId, ids) {
  try {
    const normalized = [...new Set((ids || []).filter(Boolean))].slice(0, 50);
    localStorage.setItem(getOpenTournamentsStorageKey(userId), JSON.stringify(normalized));
  } catch {
    // A central continua funcionando durante a sessao mesmo sem armazenamento local.
  }
}

function readOpenTournamentNavigation(userId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(getOpenTournamentNavigationStorageKey(userId)) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveOpenTournamentNavigation(userId, navigation) {
  try {
    localStorage.setItem(
      getOpenTournamentNavigationStorageKey(userId),
      JSON.stringify(navigation && typeof navigation === "object" ? navigation : {})
    );
  } catch {
    // A troca de torneios continua disponivel mesmo sem armazenamento local.
  }
}

function getTournamentTabColor(tournamentId, position = null) {
  if (Number.isInteger(position) && position >= 0) {
    return TOURNAMENT_TAB_COLORS[position % TOURNAMENT_TAB_COLORS.length];
  }
  const value = String(tournamentId || "torneio");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return TOURNAMENT_TAB_COLORS[Math.abs(hash) % TOURNAMENT_TAB_COLORS.length];
}

function getUserAppStateStorageKey(userId) {
  return `${USER_APP_STATE_STORAGE_PREFIX}${userId}`;
}

function getAppStateTimestamp(state) {
  const time = Date.parse(state?.updated_at || "");
  return Number.isFinite(time) ? time : 0;
}

function readLocalUserAppState(userId) {
  if (!userId) return null;

  const key = getUserAppStateStorageKey(userId);
  const states = [];

  try {
    const sessionValue = sessionStorage.getItem(key);
    if (sessionValue) states.push(JSON.parse(sessionValue));
  } catch (error) {
    console.warn("Não foi possível ler a posição salva nesta aba", error);
  }

  try {
    const localValue = localStorage.getItem(key);
    if (localValue) states.push(JSON.parse(localValue));
  } catch (error) {
    console.warn("Não foi possível ler a posição salva neste dispositivo", error);
  }

  return states
    .filter((state) => state && typeof state === "object")
    .sort((first, second) => getAppStateTimestamp(second) - getAppStateTimestamp(first))[0] || null;
}

function saveLocalUserAppState(userId, state) {
  if (!userId || !state) return;

  const serialized = JSON.stringify(state);
  const key = getUserAppStateStorageKey(userId);

  try {
    // sessionStorage recupera a posição imediatamente ao voltar para esta aba.
    sessionStorage.setItem(key, serialized);
  } catch (error) {
    console.warn("Não foi possível salvar a posição nesta aba", error);
  }

  try {
    // localStorage é o backup caso o navegador descarregue a aba antes do upsert.
    localStorage.setItem(key, serialized);
  } catch (error) {
    console.warn("Não foi possível salvar a posição neste dispositivo", error);
  }
}

function getTournamentDraftStorageKey(userId, tournamentId) {
  return `${TOURNAMENT_DRAFT_STORAGE_PREFIX}${userId || "anonymous"}:${tournamentId}`;
}

function notifyTournamentDraftChanged(userId, tournamentId) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOURNAMENT_DRAFT_CHANGED_EVENT, {
    detail: { userId, tournamentId },
  }));
}

function listLocalTournamentDrafts(userId) {
  if (!userId) return [];
  const prefix = `${TOURNAMENT_DRAFT_STORAGE_PREFIX}${userId}:`;

  try {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith(prefix))
      .map((key) => {
        try {
          const draft = JSON.parse(localStorage.getItem(key) || "null");
          const tournamentId = key.slice(prefix.length);
          return draft?.data && tournamentId ? { ...draft, userId, tournamentId } : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function readTournamentDraft(userId, tournament) {
  if (!tournament?.id) return null;

  try {
    const rawDraft = localStorage.getItem(getTournamentDraftStorageKey(userId, tournament.id));
    if (!rawDraft) return null;
    const draft = JSON.parse(rawDraft);
    if (draft?.pending === true && draft?.data) return draft;

    const draftUpdatedAt = Number(draft?.updatedAt || 0);
    const serverUpdatedAt = Date.parse(tournament.updated_at || tournament.created_at || "") || 0;

    if (!draft?.data || draftUpdatedAt <= serverUpdatedAt) return null;
    return draft;
  } catch (error) {
    console.warn("Não foi possível recuperar o rascunho local do torneio", error);
    return null;
  }
}

function saveTournamentDraft(userId, tournament, data, baseUpdatedAt = null, baseData = null, baseRevision = null) {
  const tournamentId = typeof tournament === "string" ? tournament : tournament?.id;
  if (!userId || !tournamentId || !data) return Promise.resolve(false);
  const draft = {
    data,
    name: typeof tournament === "object" ? tournament.name : "",
    type: typeof tournament === "object" ? tournament.type : "",
    status: typeof tournament === "object" ? tournament.status : "active",
    public_id: typeof tournament === "object" ? tournament.public_id : null,
    is_public: typeof tournament === "object" ? tournament.is_public : true,
    created_at: typeof tournament === "object" ? tournament.created_at : null,
    baseUpdatedAt: baseUpdatedAt || (typeof tournament === "object" ? tournament.updated_at : null),
    baseRevision: baseRevision ?? (typeof tournament === "object" ? getCollaborationRevision(tournament) : null),
    baseData: baseData || (typeof tournament === "object" ? tournament.data : null),
    updatedAt: Date.now(),
    pending: true,
  };

  let localStorageSaved = false;
  try {
    localStorage.setItem(
      getTournamentDraftStorageKey(userId, tournamentId),
      JSON.stringify(draft)
    );
    localStorageSaved = true;
  } catch (error) {
    console.warn("Não foi possível criar o backup local do torneio", error);
  }

  notifyTournamentDraftChanged(userId, tournamentId);
  return savePendingTournament(userId, tournamentId, draft).then((indexedDbSaved) => {
    const saved = localStorageSaved || indexedDbSaved;
    if (!saved) console.error("Nenhum armazenamento local aceitou o backup do torneio.");
    return saved;
  }).finally(() => {
    notifyTournamentDraftChanged(userId, tournamentId);
  });
}

function clearTournamentDraft(userId, tournamentId) {
  try {
    localStorage.removeItem(getTournamentDraftStorageKey(userId, tournamentId));
  } catch (error) {
    console.warn("Não foi possível remover o rascunho local já salvo", error);
  }
  void removePendingTournament(userId, tournamentId).finally(() => {
    notifyTournamentDraftChanged(userId, tournamentId);
  });
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    console.error(e);

    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }
}

function getRankingCriteria(value) {
  return rankingCriteriaOptions.find((item) => item.value === value) || rankingCriteriaOptions[0];
}

function getRankingColumnLabel(key) {
  return { w: "Vitórias", pts: "Total de Games", bal: "Saldo de games" }[key] || key;
}

function formatDateBR(value) {
  if (!value) return "";

  const [year, month, day] = String(value).split("-");

  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}

function formatStatusBR(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "active") return "ATIVO";
  if (normalized === "inactive") return "INATIVO";
  if (normalized === "blocked") return "BLOQUEADO";
  if (normalized === "pending") return "PENDENTE";
  if (normalized === "expired") return "VENCIDO";
  return String(value || "").toUpperCase();
}

const TRIAL_DAYS = 7;
const MILLISECONDS_PER_DAY = 86_400_000;
const AUTH_FLOW_QUERY_KEY = "auth";

function getBrazilTodayISO(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch (error) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

function getBrazilDateISO(value) {
  if (!value) return "";

  const rawValue = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) return rawValue;

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return "";

  return getBrazilTodayISO(date);
}

function isoDateToUtcDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcTime = Date.UTC(year, month - 1, day);
  const parsed = new Date(utcTime);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return Math.floor(utcTime / MILLISECONDS_PER_DAY);
}

function getCalendarDayDifference(startValue, endValue) {
  const startDay = isoDateToUtcDay(getBrazilDateISO(startValue));
  const endDay = isoDateToUtcDay(getBrazilDateISO(endValue));

  if (startDay === null || endDay === null) return null;
  return endDay - startDay;
}

function getFreeTrialDetails(profile, user) {
  if (String(profile?.status || "").toLowerCase() !== "active") return null;

  const trialEndValue = profile?.trial_ends_at || profile?.trial_end_at;
  const accessEndValue = trialEndValue || profile?.expires_at;
  const accessEndDate = getBrazilDateISO(accessEndValue);
  if (!accessEndDate) return null;

  const accessType = String(
    profile?.access_type || profile?.access_kind || profile?.subscription_status || ""
  ).toLowerCase();
  const hasExplicitTrial =
    profile?.is_trial === true ||
    Boolean(trialEndValue) ||
    ["trial", "free_trial", "free-trial", "gratuito", "teste"].includes(accessType);
  const hasExplicitPaidAccess =
    profile?.is_trial === false ||
    ["paid", "active_paid", "subscribed", "assinante", "pago"].includes(accessType);

  const trialStartValue =
    profile?.trial_started_at ||
    profile?.trial_start_at ||
    user?.email_confirmed_at ||
    user?.confirmed_at ||
    profile?.created_at ||
    user?.created_at;
  const inferredTrialLength = getCalendarDayDifference(trialStartValue, accessEndDate);
  const isInitialPremiumTrial =
    !hasExplicitPaidAccess &&
    String(profile?.plan || "").toLowerCase() === "premium" &&
    inferredTrialLength !== null &&
    inferredTrialLength >= 0 &&
    inferredTrialLength <= TRIAL_DAYS;

  if (!hasExplicitTrial && !isInitialPremiumTrial) return null;

  const remainingDifference = getCalendarDayDifference(getBrazilTodayISO(), accessEndDate);
  if (remainingDifference === null || remainingDifference < 0) return null;

  return {
    daysRemaining: remainingDifference + 1,
    expiresAt: accessEndDate,
  };
}

function getAuthRedirectUrl(flow) {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set(AUTH_FLOW_QUERY_KEY, flow);
  return url.toString();
}

function getAuthFlowFromLocation() {
  const url = new URL(window.location.href);
  const queryFlow = url.searchParams.get(AUTH_FLOW_QUERY_KEY);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const hashType = hashParams.get("type");

  if (queryFlow === "recovery" || hashType === "recovery") return "recovery";
  if (queryFlow === "confirm" || hashType === "signup" || hashType === "email") return "confirm";
  return null;
}

function getAuthCallbackError() {
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const rawMessage = hashParams.get("error_description") || url.searchParams.get("error_description") || "";

  if (!rawMessage) return null;

  if (/expired|invalid|otp/i.test(rawMessage)) {
    return "Este link expirou ou já foi usado. Solicite um novo link para continuar.";
  }

  return "Não foi possível concluir este link de acesso. Solicite um novo link e tente novamente.";
}

function clearAuthCallbackUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete(AUTH_FLOW_QUERY_KEY);
  url.searchParams.delete("code");
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  url.hash = "";
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getBrazilianWhatsAppUrl(value, message = "") {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";

  const numberWithCountryCode = digits.startsWith("55") && digits.length >= 12
    ? digits
    : `55${digits}`;

  const url = `https://wa.me/${numberWithCountryCode}`;
  return message ? `${url}?text=${encodeURIComponent(message)}` : url;
}

function getPlanRegularizationWhatsAppUrl(profile, user) {
  const plan = profile?.plan ? ` Plano atual: ${profile.plan}.` : "";
  const email = user?.email ? ` E-mail da conta: ${user.email}.` : "";
  return getPlatformWhatsAppUrl(`Olá! Meu período de acesso ao Torneio360 terminou e quero regularizar o pagamento do meu plano.${plan}${email}`);
}

function isEmailNotConfirmedError(error) {
  return /email[^\n]*not[^\n]*confirm|not[^\n]*confirm[^\n]*email|email_not_confirmed/i.test(`${error?.message || ""} ${error?.code || ""}`);
}

function isUserAlreadyRegisteredError(error) {
  const code = String(error?.code || "").toLowerCase();
  if (code === "user_already_exists" || code === "email_exists") return true;

  return /user\s+already\s+registered|user[^\n]*already[^\n]*exists|email[^\n]*already[^\n]*exists/i.test(String(error?.message || ""));
}

function getAuthErrorMessage(error, fallback) {
  const message = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();

  if (/rate limit|too many requests|over_email_send_rate_limit/.test(message)) {
    return "Aguarde alguns minutos antes de pedir outro e-mail.";
  }

  if (/redirect|redirect_to|not allowed/.test(message)) {
    return "O retorno por e-mail ainda não está autorizado no Supabase. Confira as URLs permitidas.";
  }

  if (/not authorized|not allowed to send|email address not authorized/.test(message)) {
    return "O serviço de e-mail ainda não está configurado para este endereço. Configure o SMTP do Supabase.";
  }

  return fallback;
}

async function resendEmailConfirmation(email) {
  return supabase.auth.resend({
    type: "signup",
    email: normalizeEmail(email),
    options: {
      emailRedirectTo: getAuthRedirectUrl("confirm"),
    },
  });
}

function isProfilePendingEmailConfirmation(profile) {
  return profile?.status === "pending" && !profile?.expires_at;
}

function getWeekdayBR(value) {
  if (!value) return "";

  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return "";

  const date = new Date(year, month - 1, day);

  return [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
  ][date.getDay()];
}

function getMaxScore(winningScore = 4) {
  return Number(winningScore) === 6 ? 7 : 4;
}

function normalizeCourtNumberValue(value) {
  const match = String(value || "").normalize("NFKC").match(/\d+/);
  if (!match) return "";

  const number = Number(match[0]);
  return Number.isInteger(number) && number > 0 ? String(number).slice(0, 4) : "";
}

function createDefaultCourtNumbers(count = 1) {
  return Array.from(
    { length: Math.max(1, Number(count) || 1) },
    (_, index) => String(index + 1)
  );
}

function normalizeCourtNumbers(values, count = 1) {
  const source = Array.isArray(values) ? values : [];
  const defaults = createDefaultCourtNumbers(count);

  return defaults.map((fallback, index) => normalizeCourtNumberValue(source[index]) || fallback);
}

function getGameCourtNumber(game, courtNumbers = []) {
  const override = normalizeCourtNumberValue(game?.courtNumberOverride || game?.courtLabelOverride);
  if (override) return override;

  const courtIndex = Math.max(0, Number(game?.court || 1) - 1);
  return normalizeCourtNumberValue(courtNumbers[courtIndex]) || String(courtIndex + 1);
}

function getGameCourtLabel(game, courtNumbers = []) {
  return `Quadra ${getGameCourtNumber(game, courtNumbers)}`;
}

function applyCourtNumberToGame(game, value, courtNumbers = []) {
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

function normalizeScoreInput(value, winningScore = 4) {
  if (value === "") return "";

  const number = Number(value);
  const maxScore = getMaxScore(winningScore);

  if (Number.isNaN(number)) return "";
  if (number < 0) return "0";
  if (number > maxScore) return String(maxScore);

  return String(Math.floor(number));
}

const modalityDisplayNames = {
  "Super 08": "Super 8",
  "Super 12": "Super 12",
  "Super 10 Mista (Dupla Aleatória)": "Super 10 mista",
  "Super 12 Mista (Dupla Aleatória)": "Super 12 mista",
  "Super 16 Mista (Dupla Aleatória)": "Super 16 mista",
  "Super 20 Mista (Dupla Aleatória)": "Super 20 mista",
  "Super 12 Mista (Dupla Fixa)": "Super 6 (dupla fixa)",
  "Super 16 Mista (Dupla Fixa)": "Super 8 (dupla fixa)",
  "Simples 8": "Simples (1 contra 1 por jogo)",
  "Campeonato Cearense": "Torneio modelo Campeonato Cearense",
  "Modelo Play Ranking": "Modelo Torneio 360",
};

function getModalityDisplayName(type) {
  return modalityDisplayNames[type] || type;
}

function normalizeCircuitStatus(status) {
  return status === "finished" || status === "closed" || status === "archived" ? "closed" : "active";
}

function sortCircuitsForDisplay(items) {
  return [...(items || [])].sort((first, second) => {
    const firstFinished = isPublicItemFinished(first, "circuit");
    const secondFinished = isPublicItemFinished(second, "circuit");
    if (firstFinished !== secondFinished) return firstFinished ? 1 : -1;

    const firstDate = String(first?.end_date || first?.endDate || first?.start_date || first?.startDate || "9999-12-31");
    const secondDate = String(second?.end_date || second?.endDate || second?.start_date || second?.startDate || "9999-12-31");
    return firstFinished ? secondDate.localeCompare(firstDate) : firstDate.localeCompare(secondDate);
  });
}

const allowedByPlan = {
  basic: [
    "Super 08",
    "Super 12",
    "Super 10 Mista (Dupla Aleatória)",
    "Super 12 Mista (Dupla Aleatória)",
    "Super 16 Mista (Dupla Aleatória)",
    "Super 20 Mista (Dupla Aleatória)",
  ],
  pro: [
    "Super 12 Mista (Dupla Fixa)",
    "Super 08",
    "Super 16 Mista (Dupla Fixa)",
    "Super 12",
    "Super 10 Mista (Dupla Aleatória)",
    "Super 12 Mista (Dupla Aleatória)",
    "Super 16 Mista (Dupla Aleatória)",
    "Super 20 Mista (Dupla Aleatória)",
  ],
  premium: [
    "Super 12 Mista (Dupla Fixa)",
    "Super 08",
    "Super 16 Mista (Dupla Fixa)",
    "Super 12",
    "Super 10 Mista (Dupla Aleatória)",
    "Super 12 Mista (Dupla Aleatória)",
    "Super 16 Mista (Dupla Aleatória)",
    "Super 20 Mista (Dupla Aleatória)",
    "Simples 8",
    "Copa - 18 duplas",
    "Campeonato Cearense",
    "Modelo Play Ranking",
  ],
};

const modalityConfig = {
  "Super 08": {
    type: "super8",
    total: 8,
    label: "Participante",
    courts: 2,
  },

  "Super 12": {
    type: "super12",
    total: 12,
    label: "Participante",
    courts: 3,
  },

  "Super 10 Mista (Dupla Aleatória)": {
    type: "mixed10",
    men: 5,
    women: 5,
    courts: 2,
  },

  "Super 12 Mista (Dupla Aleatória)": {
    type: "mixed12",
    men: 6,
    women: 6,
    courts: 3,
  },

  "Super 16 Mista (Dupla Aleatória)": {
    type: "mixed16",
    men: 8,
    women: 8,
    courts: 4,
  },

  "Super 20 Mista (Dupla Aleatória)": {
    type: "mixed20",
    men: 10,
    women: 10,
    courts: 5,
  },

  "Super 12 Mista (Dupla Fixa)": {
    type: "fixed12",
    teams: 6,
    courts: 3,
  },

  "Super 16 Mista (Dupla Fixa)": {
    type: "fixed16",
    teams: 8,
    courts: 4,
  },

  "Simples 8": {
    type: "simple8",
    allowedPlayerCounts: [4, 6, 8, 10, 12, 14],
    defaultPlayers: 8,
    total: 8,
    label: "Jogador",
    courts: 4,
  },

  "Copa - 12 ou 24 duplas": {
    type: "cup",
    cupMode: "standard",
    allowedTeamCounts: [12, 24],
    defaultTeams: 12,
    groupSize: 3,
    defaultMainBracketName: "Principal",
    defaultRepechageName: "Repescagem",
    courts: 4,
  },

  "Copa - 18 duplas": {
    type: "cup18",
    cupMode: "cup18",
    allowedTeamCounts: [18],
    defaultTeams: 18,
    groupSize: 3,
    defaultMainBracketName: "Principal",
    defaultRepechageName: "Disputa Paralela",
    courts: 6,
  },

  "Copa - 21 duplas": {
    type: "cup21",
    cupMode: "cup21",
    allowedTeamCounts: [21],
    defaultTeams: 21,
    groupSize: 3,
    defaultMainBracketName: "Chave Principal",
    defaultRepechageName: "Disputa Paralela",
    courts: 7,
  },

  "Copinha - grupos de 3": {
    type: "copinha",
    cupMode: "copinha",
    allowedTeamCounts: [6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
    defaultTeams: 6,
    groupSize: 3,
    defaultMainBracketName: "Chave Principal",
    defaultRepechageName: "Consolação",
    courts: 4,
  },

  "Campeonato Cearense": {
    type: "cearense",
    cupMode: "cearense",
    allowedTeamCounts: Array.from({ length: 29 }, (_, index) => index + 4),
    defaultTeams: 4,
    defaultMainBracketName: "Eliminatória Principal",
    defaultRepechageName: "2ª Disputa Paralela",
    defaultThirdRepechageName: "3ª Disputa Paralela",
    courts: 6,
  },

  "Modelo Play Ranking": {
    type: "playranking",
    cupMode: "playranking",
    allowedTeamCounts: Array.from({ length: 29 }, (_, index) => index + 4),
    defaultTeams: 4,
    defaultMainBracketName: "Eliminatória Principal",
    defaultRepechageName: "Disputa Paralela",
    courts: 6,
  },
};

function getWinningScore(data) {
  return Number(data?.winningScore || 4);
}

function getScoreWinnerSide(game, winningScore = 4) {
  const s1 = Number(game.s1);
  const s2 = Number(game.s2);
  const target = Number(winningScore || 4);

  if (game.s1 === "" || game.s2 === "") return null;
  if (Number.isNaN(s1) || Number.isNaN(s2)) return null;
  if (s1 === s2) return null;

  if (target === 6) {
    if (s1 >= 6 && s1 > s2) return "team1";
    if (s2 >= 6 && s2 > s1) return "team2";
    return null;
  }

  if (s1 >= target && s1 > s2) return "team1";
  if (s2 >= target && s2 > s1) return "team2";

  return null;
}

function isGameFinished(game, winningScore = 4) {
  return getScoreWinnerSide(game, winningScore) !== null;
}

function isCupType(config) {
  return config?.type === "cup" || config?.type === "cup18" || config?.type === "cup21" || config?.type === "copinha" || config?.type === "cearense" || config?.type === "playranking";
}

function isMixedType(config) {
  return config?.type === "mixed10"
    || config?.type === "mixed12"
    || config?.type === "mixed16"
    || config?.type === "mixed20";
}

function isFlexibleSimpleType(config) {
  return config?.type === "simple8";
}

function getSimplePlayerCount(config, data = null) {
  const allowedCounts = config?.allowedPlayerCounts || [config?.total || 8];
  const storedCount = Number(
    data?.simplePlayerCount
      ?? (Array.isArray(data?.players) ? data.players.length : null)
      ?? config?.defaultPlayers
      ?? config?.total
      ?? 8
  );

  return allowedCounts.includes(storedCount)
    ? storedCount
    : (config?.defaultPlayers || config?.total || allowedCounts[0] || 8);
}

function getTournamentCourtCount(config, data = null) {
  return isFlexibleSimpleType(config)
    ? Math.max(1, getSimplePlayerCount(config, data) / 2)
    : Math.max(1, config?.courts || 1);
}

const super8Template = [
  [[[1, 2], [3, 4]], [[5, 6], [7, 8]]],
  [[[1, 3], [6, 8]], [[2, 4], [5, 7]]],
  [[[1, 4], [5, 8]], [[2, 3], [6, 7]]],
  [[[1, 5], [2, 6]], [[3, 7], [4, 8]]],
  [[[1, 6], [4, 7]], [[2, 5], [3, 8]]],
  [[[1, 7], [3, 5]], [[2, 8], [4, 6]]],
  [[[1, 8], [2, 7]], [[3, 6], [4, 5]]],
];

const super10MixedTemplate = [
  // 5 homens (1-5) + 5 mulheres (6-10)
  // Regra: cada atleta joga 4 partidas, descansa 1 rodada
  // e cada homem joga com cada mulher no máximo uma única vez.
  [[1, 7, 2, 8], [3, 9, 4, 10]], // descansam: Homem 5 e Mulher 1
  [[1, 6, 2, 9], [3, 8, 5, 10]], // descansam: Homem 4 e Mulher 2
  [[1, 9, 3, 10], [4, 6, 5, 7]], // descansam: Homem 2 e Mulher 3
  [[1, 8, 2, 10], [4, 7, 5, 6]], // descansam: Homem 3 e Mulher 4
  [[2, 6, 3, 7], [4, 8, 5, 9]], // descansam: Homem 1 e Mulher 5
];

const super12MixedTemplate = [
  [[1, 7, 4, 12], [2, 8, 6, 11], [3, 9, 5, 10]],
  [[1, 8, 2, 7], [3, 10, 4, 9], [5, 12, 6, 11]],
  [[1, 9, 6, 10], [2, 11, 5, 7], [3, 8, 4, 12]],
  [[1, 10, 3, 12], [2, 9, 4, 11], [5, 7, 6, 8]],
  [[1, 11, 5, 8], [2, 10, 6, 7], [3, 12, 4, 9]],
  [[1, 12, 4, 8], [2, 7, 3, 11], [5, 9, 6, 10]],
];

const super16MixedTemplate = [
  [[1, 9, 6, 16], [2, 10, 8, 15], [3, 11, 7, 14], [4, 12, 5, 13]],
  [[1, 10, 2, 9], [3, 12, 4, 11], [5, 14, 7, 13], [8, 16, 6, 15]],
  [[1, 12, 8, 14], [2, 11, 6, 13], [3, 10, 5, 16], [4, 9, 7, 15]],
  [[1, 13, 4, 16], [2, 14, 3, 15], [5, 9, 6, 12], [7, 10, 8, 11]],
  [[1, 14, 5, 10], [2, 13, 7, 9], [3, 16, 8, 12], [4, 15, 6, 11]],
  [[1, 15, 3, 13], [2, 16, 4, 14], [5, 11, 8, 9], [7, 12, 6, 10]],
  [[1, 16, 7, 11], [2, 15, 5, 12], [3, 14, 6, 9], [4, 13, 8, 10]],
  [[1, 11, 2, 12], [3, 9, 4, 10], [5, 15, 7, 16], [8, 13, 6, 14]],
];

const fixed12Template = [
  [[1, 6], [2, 5], [3, 4]],
  [[1, 5], [6, 4], [2, 3]],
  [[1, 4], [5, 3], [6, 2]],
  [[1, 3], [4, 2], [5, 6]],
  [[1, 2], [3, 6], [4, 5]],
];

function berger(n) {
  let arr = Array.from({ length: n }, (_, i) => i);
  const rounds = [];

  for (let r = 0; r < n - 1; r++) {
    const games = [];

    for (let i = 0; i < n / 2; i++) {
      games.push([arr[i], arr[n - 1 - i]]);
    }

    rounds.push(games);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }

  return rounds;
}

function shuffleArray(list) {
  const arr = [...list];

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function optimizeCourts(schedule) {
  if (!schedule || schedule.length === 0) return schedule;

  const usage = {};

  function players(game) {
    return [...(game.ids1 || []), ...(game.ids2 || [])];
  }

  function get(id, court) {
    return usage[id]?.[court] || 0;
  }

  function add(id, court) {
    if (!usage[id]) usage[id] = {};
    usage[id][court] = (usage[id][court] || 0) + 1;
  }

  function score(game, court, courts) {
    let total = 0;

    players(game).forEach((id) => {
      const same = get(id, court);
      total += same * 10000;
      total += same * same * 3000;

      const hasUnused = courts.some((c) => get(id, c) === 0);
      if (hasUnused && same > 0) total += 5000;

      const values = courts.map((c) => get(id, c));
      total += (Math.max(...values) - Math.min(...values)) * 500;
    });

    return total;
  }

  return schedule.map((round, roundIndex) => {
    const courts = round.map((_, i) => i + 1);
    const remaining = round.map((game, i) => ({
      ...game,
      preferredCourt: ((i + roundIndex) % courts.length) + 1,
    }));

    const balanced = [];

    courts.forEach((court) => {
      let bestIndex = 0;
      let bestScore = Infinity;

      remaining.forEach((game, i) => {
        let s = score(game, court, courts);
        if (game.preferredCourt !== court) s += 100;

        if (s < bestScore) {
          bestScore = s;
          bestIndex = i;
        }
      });

      const selected = remaining.splice(bestIndex, 1)[0];
      const game = { ...selected, court };
      delete game.preferredCourt;

      players(game).forEach((id) => add(id, court));
      balanced.push(game);
    });

    return balanced.sort((a, b) => a.court - b.court);
  });
}

function getTeamName(team) {
  if (!team) return "";
  return `${team.a || ""} + ${team.b || ""}`.trim();
}

function getCupTeams(data) {
  return data?.players?.teams || [];
}

function getCupTeamName(data, id) {
  const team = getCupTeams(data)[id];
  return getTeamName(team);
}

function getGroupLetter(index) {
  return String.fromCharCode(65 + index);
}

function createCearenseGroups(teamCount) {
  const safeTeamCount = Math.max(4, Math.min(32, Number(teamCount) || 4));
  const groupSizes = [];

  if (safeTeamCount <= 5) {
    groupSizes.push(safeTeamCount);
  } else {
    const groupCount = Math.floor(safeTeamCount / 3);
    const groupsWithFour = safeTeamCount % 3;

    for (let index = 0; index < groupCount; index += 1) {
      groupSizes.push(index < groupsWithFour ? 4 : 3);
    }
  }

  let nextTeamId = 0;

  return groupSizes.map((size, index) => {
    const teamIds = Array.from({ length: size }, () => nextTeamId++);

    return {
      id: index,
      name: `Grupo ${getGroupLetter(index)}`,
      teamIds,
    };
  });
}

function describeCearenseGroupSizes(groups) {
  const countsBySize = groups.reduce((summary, group) => {
    const size = group.teamIds.length;
    summary[size] = (summary[size] || 0) + 1;
    return summary;
  }, {});

  return Object.entries(countsBySize)
    .sort(([firstSize], [secondSize]) => Number(firstSize) - Number(secondSize))
    .map(([size, count]) => `${count} ${count === 1 ? "grupo" : "grupos"} de ${size} duplas`)
    .join(" e ");
}

function getCearenseFormatSummary(teamCount, playRanking = false) {
  const safeTeamCount = Math.max(4, Math.min(32, Number(teamCount) || 4));
  const groups = createCearenseGroups(safeTeamCount);
  const groupSizes = groups.map((group) => group.teamIds.length);
  const gamesPerTeam = [...new Set(groupSizes.map((size) => size - 1))].sort((a, b) => a - b);
  const groupMatches = groupSizes.reduce((total, size) => total + (size * (size - 1)) / 2, 0);
  const mainCount = groups.length * 2;
  const initialParallelCount = safeTeamCount - mainCount;
  const mainBracketSize = getNextPowerOfTwo(mainCount);
  const mainByes = mainBracketSize - mainCount;
  const openingMainGames = mainCount - mainBracketSize / 2;
  const transferredCount = playRanking ? openingMainGames : 0;
  const finalParallelCount = initialParallelCount + transferredCount;
  const parallelBracketSize = finalParallelCount >= 2 ? getNextPowerOfTwo(finalParallelCount) : finalParallelCount;
  const parallelByes = Math.max(0, parallelBracketSize - finalParallelCount);

  return {
    teamCount: safeTeamCount,
    groupCount: groups.length,
    groupDescription: describeCearenseGroupSizes(groups),
    gamesPerTeamDescription: gamesPerTeam.join(" ou "),
    groupMatches,
    mainCount,
    initialParallelCount,
    mainBracketSize,
    mainOpeningRound: getEliminationRoundName(mainBracketSize),
    mainByes,
    openingMainGames,
    transferredCount,
    finalParallelCount,
    parallelBracketSize,
    parallelByes,
  };
}

function createCupGroups(teamCount, format = "") {
  if (format === "cearense" || format === "playranking") {
    return createCearenseGroups(teamCount);
  }

  const groups = [];

  for (let i = 0; i < teamCount / 3; i++) {
    groups.push({
      id: i,
      name: `Grupo ${getGroupLetter(i)}`,
      teamIds: [i * 3, i * 3 + 1, i * 3 + 2],
    });
  }

  return groups;
}

function createRoundRobinPairings(teamIds) {
  const rotation = [...teamIds];

  if (rotation.length % 2 === 1) rotation.push(null);

  const rounds = [];

  for (let roundIndex = 0; roundIndex < rotation.length - 1; roundIndex += 1) {
    const pairs = [];

    for (let index = 0; index < rotation.length / 2; index += 1) {
      const first = rotation[index];
      const second = rotation[rotation.length - 1 - index];

      if (first !== null && second !== null) pairs.push([first, second]);
    }

    rounds.push(pairs);
    rotation.splice(1, 0, rotation.pop());
  }

  return rounds;
}

function generateCearenseGroupSchedule(players, cupConfig) {
  const teamCount = cupConfig.teamCount || 4;
  const groups = createCearenseGroups(teamCount);
  const teamNames = players.teams.map((team) => getTeamName(team));
  const groupRounds = groups.map((group) => createRoundRobinPairings(group.teamIds));
  const roundCount = Math.max(...groupRounds.map((rounds) => rounds.length));
  const rounds = Array.from({ length: roundCount }, () => []);

  groupRounds.forEach((scheduledRounds, groupIndex) => {
    scheduledRounds.forEach((pairs, roundIndex) => {
      pairs.forEach(([id1, id2]) => {
        rounds[roundIndex].push({
          phase: "groups",
          groupId: groups[groupIndex].id,
          groupName: groups[groupIndex].name,
          team1: [teamNames[id1]],
          ids1: [id1],
          team2: [teamNames[id2]],
          ids2: [id2],
          s1: "",
          s2: "",
        });
      });
    });
  });

  return rounds.map((round) => round.map((game, index) => ({
    ...game,
    court: index + 1,
  })));
}

function generateCupGroupSchedule(players, cupConfig) {
  const teamCount = cupConfig.teamCount || 12;
  const format = cupConfig.format || cupConfig.cupMode || "";

  if (format === "cearense" || format === "playranking") {
    return generateCearenseGroupSchedule(players, cupConfig);
  }

  const groups = createCupGroups(teamCount, format);
  const teamNames = players.teams.map((t) => getTeamName(t));

  const roundTemplates = [
    [0, 1],
    [0, 2],
    [1, 2],
  ];

  const rounds = [[], [], []];

  groups.forEach((group, groupIndex) => {
    roundTemplates.forEach(([aIndex, bIndex], roundIndex) => {
      const id1 = group.teamIds[aIndex];
      const id2 = group.teamIds[bIndex];

      rounds[roundIndex].push({
        phase: "groups",
        groupId: group.id,
        groupName: group.name,
        court: groupIndex + 1,
        team1: [teamNames[id1]],
        ids1: [id1],
        team2: [teamNames[id2]],
        ids2: [id2],
        s1: "",
        s2: "",
      });
    });
  });

  return rounds.map((round) =>
    round.map((game, index) => ({
      ...game,
      court: index + 1,
    }))
  );
}

function getCupFormat(data) {
  return data?.cupConfig?.format || data?.cupConfig?.cupMode || "";
}

function isCopinhaData(data) {
  return getCupFormat(data) === "copinha";
}

function isCearenseData(data) {
  return getCupFormat(data) === "cearense" || getCupFormat(data) === "playranking";
}

function isCampeonatoCearenseData(data) {
  return getCupFormat(data) === "cearense";
}

function isPlayRankingData(data) {
  return getCupFormat(data) === "playranking";
}

function resetCopinhaTieBreaks(data) {
  if (!isCopinhaData(data) && !isCearenseData(data)) return data;

  data.cupConfig = {
    ...(data.cupConfig || {}),
    tieBreakOverrides: {},
    groupTieBreakOverrides: {},
    campaignTieBreakOverrides: {},
  };

  return data;
}

function getCopinhaHeadToHeadWinnerId(firstId, secondId, groupGames, winningScore) {
  const game = groupGames.find((item) => {
    const id1 = item.ids1?.[0];
    const id2 = item.ids2?.[0];
    return (id1 === firstId && id2 === secondId) || (id1 === secondId && id2 === firstId);
  });

  if (!game) return null;

  const winnerSide = getScoreWinnerSide(game, winningScore);
  if (!winnerSide) return null;

  return winnerSide === "team1" ? game.ids1?.[0] ?? null : game.ids2?.[0] ?? null;
}

function getCopinhaManualTieOrder(tiedRows, storedOrder) {
  const tiedIds = tiedRows.map((row) => row.id);
  const order = Array.isArray(storedOrder)
    ? storedOrder.map((id) => Number(id)).filter((id) => tiedIds.includes(id))
    : [];
  const uniqueOrder = Array.from(new Set(order));

  return uniqueOrder.length === tiedRows.length ? uniqueOrder : null;
}

function rankCopinhaGroupRows(rows, groupGames, winningScore, storedTieOrder) {
  const baseRows = [...rows].sort((a, b) => {
    const winsDiff = b.w - a.w;
    if (winsDiff !== 0) return winsDiff;

    const balanceDiff = b.bal - a.bal;
    if (balanceDiff !== 0) return balanceDiff;

    return a.name.localeCompare(b.name);
  });

  const allGroupGamesFinished = groupGames.length === 3 && groupGames.every((game) => (
    getScoreWinnerSide(game, winningScore) !== null
  ));

  if (!allGroupGamesFinished) {
    return { rows: baseRows, unresolvedTieIds: [] };
  }

  const rankedRows = [];
  const unresolvedTieIds = [];

  for (let start = 0; start < baseRows.length;) {
    let end = start + 1;

    while (
      end < baseRows.length &&
      baseRows[end].w === baseRows[start].w &&
      baseRows[end].bal === baseRows[start].bal
    ) {
      end += 1;
    }

    const tiedRows = baseRows.slice(start, end);

    if (tiedRows.length === 1) {
      rankedRows.push(tiedRows[0]);
    } else {
      const manualOrder = getCopinhaManualTieOrder(tiedRows, storedTieOrder);

      if (manualOrder) {
        rankedRows.push(...[...tiedRows].sort((a, b) => manualOrder.indexOf(a.id) - manualOrder.indexOf(b.id)));
      } else if (tiedRows.length === 2) {
        const winnerId = getCopinhaHeadToHeadWinnerId(
          tiedRows[0].id,
          tiedRows[1].id,
          groupGames,
          winningScore
        );

        if (winnerId !== null) {
          rankedRows.push(...[...tiedRows].sort((a, b) => (a.id === winnerId ? -1 : 1)));
        } else {
          unresolvedTieIds.push(...tiedRows.map((row) => row.id));
          rankedRows.push(...tiedRows);
        }
      } else {
        // Com três duplas empatadas, o confronto direto pode formar um ciclo.
        // A planilha determina sorteio; o organizador registra esse sorteio na tela de grupos.
        unresolvedTieIds.push(...tiedRows.map((row) => row.id));
        rankedRows.push(...tiedRows);
      }
    }

    start = end;
  }

  return { rows: rankedRows, unresolvedTieIds };
}

function rankCearenseGroupRows(rows, groupGames, winningScore, criteria, storedTieOrder) {
  const baseRows = [...rows].sort((a, b) => {
    for (const key of criteria.order) {
      const diff = b[key] - a[key];
      if (diff !== 0) return diff;
    }

    return a.name.localeCompare(b.name);
  });
  const expectedGameCount = (rows.length * (rows.length - 1)) / 2;
  const allGroupGamesFinished = groupGames.length === expectedGameCount && groupGames.every((game) => (
    getScoreWinnerSide(game, winningScore) !== null
  ));

  if (!allGroupGamesFinished) {
    return { rows: baseRows, unresolvedTieIds: [] };
  }

  const rankedRows = [];
  const unresolvedTieIds = [];

  for (let start = 0; start < baseRows.length;) {
    let end = start + 1;

    while (
      end < baseRows.length &&
      baseRows[end].w === baseRows[start].w &&
      baseRows[end].bal === baseRows[start].bal &&
      baseRows[end].pts === baseRows[start].pts
    ) {
      end += 1;
    }

    const tiedRows = baseRows.slice(start, end);
    const manualOrder = getCopinhaManualTieOrder(tiedRows, storedTieOrder);

    if (tiedRows.length === 1) {
      rankedRows.push(tiedRows[0]);
    } else if (manualOrder) {
      rankedRows.push(...[...tiedRows].sort((a, b) => manualOrder.indexOf(a.id) - manualOrder.indexOf(b.id)));
    } else {
      unresolvedTieIds.push(...tiedRows.map((row) => row.id));
      rankedRows.push(...tiedRows);
    }

    start = end;
  }

  return { rows: rankedRows, unresolvedTieIds };
}

function rankOfficialCearenseGroupRows(rows, groupGames, winningScore, storedTieOrder) {
  const baseRows = [...rows].sort((a, b) => (
    b.w - a.w || b.bal - a.bal || a.name.localeCompare(b.name)
  ));
  const expectedGameCount = (rows.length * (rows.length - 1)) / 2;
  const allGroupGamesFinished = groupGames.length === expectedGameCount && groupGames.every((game) => (
    getScoreWinnerSide(game, winningScore) !== null
  ));

  if (!allGroupGamesFinished) return { rows: baseRows, unresolvedTieIds: [] };

  const rankedRows = [];
  const unresolvedTieIds = [];

  for (let start = 0; start < baseRows.length;) {
    let end = start + 1;
    while (
      end < baseRows.length
      && baseRows[end].w === baseRows[start].w
      && baseRows[end].bal === baseRows[start].bal
    ) end += 1;

    const tiedRows = baseRows.slice(start, end);
    const manualOrder = getCopinhaManualTieOrder(tiedRows, storedTieOrder);

    if (tiedRows.length === 1) {
      rankedRows.push(tiedRows[0]);
    } else if (manualOrder) {
      rankedRows.push(...[...tiedRows].sort((a, b) => manualOrder.indexOf(a.id) - manualOrder.indexOf(b.id)));
    } else if (tiedRows.length === 2) {
      const winnerId = getCopinhaHeadToHeadWinnerId(
        tiedRows[0].id,
        tiedRows[1].id,
        groupGames,
        winningScore
      );

      if (winnerId !== null) {
        rankedRows.push(...[...tiedRows].sort((a, b) => (
          a.id === winnerId ? -1 : b.id === winnerId ? 1 : 0
        )));
      } else {
        unresolvedTieIds.push(...tiedRows.map((row) => row.id));
        rankedRows.push(...tiedRows);
      }
    } else {
      unresolvedTieIds.push(...tiedRows.map((row) => row.id));
      rankedRows.push(...tiedRows);
    }

    start = end;
  }

  return { rows: rankedRows, unresolvedTieIds };
}

function calculateCupGroupRankings(data, rankingCriteriaValue = defaultRankingCriteria) {
  const cupConfig = data.cupConfig || {};
  const teamCount = cupConfig.teamCount || 12;
  const format = getCupFormat(data);
  const groups = createCupGroups(teamCount, format);
  const teamNames = data.players.teams.map((t) => getTeamName(t));
  const criteria = getRankingCriteria(rankingCriteriaValue);
  const winningScore = getWinningScore(data);
  const isCopinha = isCopinhaData(data);
  const isCearense = isCearenseData(data);
  const isOfficialCearense = isCampeonatoCearenseData(data);
  const tieBreakOverrides = cupConfig.tieBreakOverrides || {};

  const groupRankings = groups.map((group) => {
    const rows = group.teamIds.map((id) => ({
      id,
      name: teamNames[id],
      groupId: group.id,
      groupName: group.name,
      pts: 0,
      w: 0,
      bal: 0,
      played: 0,
    }));

    const tableById = {};
    rows.forEach((row) => {
      tableById[row.id] = row;
    });

    const groupGames = (data.schedule || [])
      .flat()
      .filter((game) => game.phase === "groups" && game.groupId === group.id);

    groupGames.forEach((game) => {
      const s1 = Number(game.s1);
      const s2 = Number(game.s2);

      if (game.s1 === "" || game.s2 === "" || Number.isNaN(s1) || Number.isNaN(s2)) return;

      const winnerSide = getScoreWinnerSide(game, winningScore);
      if (!winnerSide) return;

      const win1 = winnerSide === "team1";
      const win2 = winnerSide === "team2";

      game.ids1.forEach((id) => {
        tableById[id].pts += s1;
        tableById[id].bal += s1 - s2;
        tableById[id].played += 1;
        if (win1) tableById[id].w += 1;
      });

      game.ids2.forEach((id) => {
        tableById[id].pts += s2;
        tableById[id].bal += s2 - s1;
        tableById[id].played += 1;
        if (win2) tableById[id].w += 1;
      });
    });

    if (isCopinha) {
      const ranked = rankCopinhaGroupRows(
        rows,
        groupGames,
        winningScore,
        tieBreakOverrides[String(group.id)]
      );

      return {
        ...group,
        rows: ranked.rows,
        unresolvedTieIds: ranked.unresolvedTieIds,
        rankingMode: "copinha",
      };
    }

    if (isCearense) {
      const ranked = isOfficialCearense
        ? rankOfficialCearenseGroupRows(
          rows,
          groupGames,
          winningScore,
          tieBreakOverrides[String(group.id)]
        )
        : rankCearenseGroupRows(
          rows,
          groupGames,
          winningScore,
          criteria,
          tieBreakOverrides[String(group.id)]
        );

      return {
        ...group,
        rows: ranked.rows,
        unresolvedTieIds: ranked.unresolvedTieIds,
        rankingMode: isOfficialCearense ? "cearense-official" : "cearense",
      };
    }

    rows.sort((a, b) => {
      for (const key of criteria.order) {
        const diff = b[key] - a[key];
        if (diff !== 0) return diff;
      }

      return a.name.localeCompare(b.name);
    });

    return {
      ...group,
      rows,
      unresolvedTieIds: [],
      rankingMode: "standard",
    };
  });

  if (!isOfficialCearense) return groupRankings;

  const storedCampaignOverrides = cupConfig.campaignTieBreakOverrides || {};
  const champions = groupRankings.map((group) => ({
    ...group.rows[0],
    groupSize: group.rows.length,
  }));
  champions.sort((a, b) => compareOfficialCearenseChampions(a, b) || a.name.localeCompare(b.name));
  let hasUnresolvedChampionTie = false;

  for (let start = 0; start < champions.length;) {
    let end = start + 1;
    while (end < champions.length && compareOfficialCearenseChampions(champions[start], champions[end]) === 0) end += 1;
    const tied = champions.slice(start, end);
    const manualOrder = getCopinhaManualTieOrder(tied, storedCampaignOverrides[getOfficialCearenseChampionTieKey(tied[0])]);
    if (manualOrder) tied.sort((a, b) => manualOrder.indexOf(a.id) - manualOrder.indexOf(b.id));
    else if (tied.length > 1) hasUnresolvedChampionTie = true;
    champions.splice(start, tied.length, ...tied);
    start = end;
  }

  const allGroupsReady = groupRankings.every((group) => (
    group.unresolvedTieIds.length === 0
    && group.rows.every((row) => row.played === group.rows.length - 1)
  ));
  if (!allGroupsReady || hasUnresolvedChampionTie) return groupRankings;

  const groupOrder = new Map(champions.map((row, index) => [row.groupId, index + 1]));
  return [...groupRankings]
    .sort((a, b) => groupOrder.get(a.id) - groupOrder.get(b.id))
    .map((group) => ({ ...group, groupRank: groupOrder.get(group.id) }));
}

function compareCearenseCampaignMetrics(first, second) {
  const firstPlayed = Math.max(1, Number(first.played) || 0);
  const secondPlayed = Math.max(1, Number(second.played) || 0);

  for (const key of ["w", "bal", "pts"]) {
    const difference = Number(second[key] || 0) * firstPlayed - Number(first[key] || 0) * secondPlayed;
    if (difference !== 0) return difference;
  }

  return 0;
}

function haveSameCearenseCampaign(first, second) {
  const firstPlayed = Math.max(1, Number(first.played) || 0);
  const secondPlayed = Math.max(1, Number(second.played) || 0);

  return ["w", "bal", "pts"].every((key) => (
    Number(first[key] || 0) * secondPlayed === Number(second[key] || 0) * firstPlayed
  ));
}

function greatestCommonDivisor(first, second) {
  let a = Math.abs(Number(first) || 0);
  let b = Math.abs(Number(second) || 0);

  while (b !== 0) {
    [a, b] = [b, a % b];
  }

  return a || 1;
}

function getReducedRatio(value, divisor) {
  const safeDivisor = Math.max(1, Number(divisor) || 0);
  const commonDivisor = greatestCommonDivisor(value, safeDivisor);
  return `${Number(value || 0) / commonDivisor}/${safeDivisor / commonDivisor}`;
}

function getCearenseCampaignTieKey(scope, row) {
  return `${scope}:${getReducedRatio(row.w, row.played)}:${getReducedRatio(row.bal, row.played)}:${getReducedRatio(row.pts, row.played)}`;
}

function rankCearenseCampaignEntries(entries, storedOverrides, scope) {
  const baseEntries = [...entries].sort((a, b) => {
    const comparison = compareCearenseCampaignMetrics(a, b);
    if (comparison !== 0) return comparison;
    if (a.groupId === b.groupId) return a.groupPosition - b.groupPosition;
    return a.name.localeCompare(b.name);
  });
  const rankedEntries = [];
  const unresolvedTies = [];

  for (let start = 0; start < baseEntries.length;) {
    let end = start + 1;

    while (end < baseEntries.length && haveSameCearenseCampaign(baseEntries[start], baseEntries[end])) {
      end += 1;
    }

    const tiedEntries = baseEntries.slice(start, end);
    const distinctGroups = new Set(tiedEntries.map((entry) => entry.groupId));

    if (tiedEntries.length === 1 || distinctGroups.size === 1) {
      rankedEntries.push(...tiedEntries);
    } else {
      const tieKey = getCearenseCampaignTieKey(scope, tiedEntries[0]);
      const manualOrder = getCopinhaManualTieOrder(tiedEntries, storedOverrides[tieKey]);

      if (manualOrder) {
        rankedEntries.push(...[...tiedEntries].sort((a, b) => manualOrder.indexOf(a.id) - manualOrder.indexOf(b.id)));
      } else {
        unresolvedTies.push({
          tieKey,
          scope,
          teamIds: tiedEntries.map((entry) => entry.id),
          rows: tiedEntries,
        });
        rankedEntries.push(...tiedEntries);
      }
    }

    start = end;
  }

  return { rows: rankedEntries, unresolvedTies };
}

function getOfficialCearenseAdjustedBalance(row) {
  const groupSize = Number(row.groupSize) || 3;
  return groupSize === 4
    ? { numerator: Number(row.bal || 0) * 2, denominator: 3 }
    : { numerator: Number(row.bal || 0), denominator: 1 };
}

function compareOfficialCearenseChampions(first, second) {
  const firstBalance = getOfficialCearenseAdjustedBalance(first);
  const secondBalance = getOfficialCearenseAdjustedBalance(second);
  return secondBalance.numerator * firstBalance.denominator
    - firstBalance.numerator * secondBalance.denominator;
}

function getOfficialCearenseChampionTieKey(row) {
  const balance = getOfficialCearenseAdjustedBalance(row);
  return `campeoes-saldo-ajustado:${getReducedRatio(balance.numerator, balance.denominator)}`;
}

function getOfficialCearenseQualified(data) {
  const groupRankings = calculateCupGroupRankings(data, data.rankingCriteria);
  const storedOverrides = data.cupConfig?.campaignTieBreakOverrides || {};
  const canRankGroups = groupRankings.every((group) => (
    group.unresolvedTieIds.length === 0
    && group.rows.every((row) => row.played === group.rows.length - 1)
  ));
  const champions = groupRankings.map((group) => ({
    ...group.rows[0],
    groupPosition: 1,
    groupSize: group.rows.length,
  })).filter((row) => Number.isInteger(row.id));
  const orderedChampions = [...champions].sort((a, b) => (
    compareOfficialCearenseChampions(a, b) || a.name.localeCompare(b.name)
  ));
  const rankedChampions = [];
  const unresolvedCampaignTies = [];

  for (let start = 0; start < orderedChampions.length;) {
    let end = start + 1;
    while (end < orderedChampions.length && compareOfficialCearenseChampions(orderedChampions[start], orderedChampions[end]) === 0) {
      end += 1;
    }

    const tied = orderedChampions.slice(start, end);
    const tieKey = getOfficialCearenseChampionTieKey(tied[0]);
    const manualOrder = getCopinhaManualTieOrder(tied, storedOverrides[tieKey]);

    if (tied.length > 1 && !manualOrder) {
      if (canRankGroups) {
        unresolvedCampaignTies.push({ tieKey, scope: "campeoes", teamIds: tied.map((row) => row.id), rows: tied });
      }
      rankedChampions.push(...tied);
    } else if (manualOrder) {
      rankedChampions.push(...[...tied].sort((a, b) => manualOrder.indexOf(a.id) - manualOrder.indexOf(b.id)));
    } else {
      rankedChampions.push(...tied);
    }
    start = end;
  }

  const groupRankById = new Map(rankedChampions.map((row, index) => [row.groupId, index + 1]));
  const main = [];
  const repechage = [];

  groupRankings.forEach((group) => {
    group.rows.forEach((row, index) => {
      const entry = {
        ...row,
        groupPosition: index + 1,
        groupRank: groupRankById.get(group.id),
        groupSize: group.rows.length,
      };
      if (index < 2) main.push(entry);
      else repechage.push(entry);
    });
  });

  main.sort((a, b) => a.groupPosition - b.groupPosition || a.groupRank - b.groupRank);
  repechage.sort((a, b) => a.groupPosition - b.groupPosition || a.groupRank - b.groupRank);

  return { main, repechage, unresolvedCampaignTies };
}

function getCearenseQualified(data) {
  if (isCampeonatoCearenseData(data)) return getOfficialCearenseQualified(data);

  const groupRankings = calculateCupGroupRankings(data, data.rankingCriteria);
  const storedOverrides = data.cupConfig?.campaignTieBreakOverrides || {};
  const champions = [];
  const runnersUp = [];
  const parallel = [];

  groupRankings.forEach((group) => {
    group.rows.forEach((row, index) => {
      const entry = { ...row, groupPosition: index + 1 };

      if (index === 0) champions.push(entry);
      else if (index === 1) runnersUp.push(entry);
      else parallel.push(entry);
    });
  });

  const rankedChampions = rankCearenseCampaignEntries(champions, storedOverrides, "campeoes");
  const rankedRunnersUp = rankCearenseCampaignEntries(runnersUp, storedOverrides, "segundos");
  const rankedParallel = rankCearenseCampaignEntries(parallel, storedOverrides, "paralela");

  return {
    main: [...rankedChampions.rows, ...rankedRunnersUp.rows],
    repechage: rankedParallel.rows,
    unresolvedCampaignTies: [
      ...rankedChampions.unresolvedTies,
      ...rankedRunnersUp.unresolvedTies,
      ...rankedParallel.unresolvedTies,
    ],
  };
}

function sortRowsByPointsBalanceWins(a, b) {
  const ptsDiff = b.pts - a.pts;
  if (ptsDiff !== 0) return ptsDiff;

  const balDiff = b.bal - a.bal;
  if (balDiff !== 0) return balDiff;

  const winDiff = b.w - a.w;
  if (winDiff !== 0) return winDiff;

  return a.name.localeCompare(b.name);
}

function getCup18Qualified(data) {
  const groupRankings = calculateCupGroupRankings(data, data.rankingCriteria);

  const direct = [];
  const thirds = [];

  groupRankings.forEach((group) => {
    if (group.rows[0]) direct.push({ ...group.rows[0], groupPosition: 1 });
    if (group.rows[1]) direct.push({ ...group.rows[1], groupPosition: 2 });
    if (group.rows[2]) thirds.push({ ...group.rows[2], groupPosition: 3 });
  });

  const sortedThirds = [...thirds].sort(sortRowsByPointsBalanceWins);

  const extraMain = sortedThirds.slice(0, 2);
  const parallel = sortedThirds.slice(2);

  const criteria = getRankingCriteria(data.rankingCriteria || defaultRankingCriteria);

  function sortMain(a, b) {
    if (a.groupPosition !== b.groupPosition) return a.groupPosition - b.groupPosition;

    for (const key of criteria.order) {
      const diff = b[key] - a[key];
      if (diff !== 0) return diff;
    }

    return a.name.localeCompare(b.name);
  }

  const main = [...direct, ...extraMain].sort(sortMain);

  return {
    main,
    repechage: parallel,
  };
}

function getCup21Qualified(data) {
  const groupRankings = calculateCupGroupRankings(data, data.rankingCriteria);
  const main = [];
  const repechage = [];

  groupRankings.forEach((group) => {
    if (group.rows[0]) main.push({ ...group.rows[0], groupPosition: 1 });
    if (group.rows[1]) main.push({ ...group.rows[1], groupPosition: 2 });
    if (group.rows[2]) repechage.push({ ...group.rows[2], groupPosition: 3 });
  });

  const criteria = getRankingCriteria(data.rankingCriteria || defaultRankingCriteria);

  function sortGeneral(a, b) {
    if (a.groupPosition !== b.groupPosition) return a.groupPosition - b.groupPosition;

    for (const key of criteria.order) {
      const diff = b[key] - a[key];
      if (diff !== 0) return diff;
    }

    return a.name.localeCompare(b.name);
  }

  main.sort(sortGeneral);
  repechage.sort(sortRowsByPointsBalanceWins);

  return { main, repechage };
}

function compareCopinhaGroupCampaign(firstGroup, secondGroup) {
  const first = firstGroup.rows[0] || {};
  const second = secondGroup.rows[0] || {};

  const winsDiff = Number(second.w || 0) - Number(first.w || 0);
  if (winsDiff !== 0) return winsDiff;

  const balanceDiff = Number(second.bal || 0) - Number(first.bal || 0);
  if (balanceDiff !== 0) return balanceDiff;

  return firstGroup.id - secondGroup.id;
}

function getCopinhaGroupTieKey(group) {
  const champion = group.rows[0] || {};
  return `${Number(champion.w || 0)}:${Number(champion.bal || 0)}`;
}

function getCopinhaSeededGroups(data) {
  const groupRankings = calculateCupGroupRankings(data, data.rankingCriteria);
  const baseGroups = [...groupRankings].sort(compareCopinhaGroupCampaign);
  const groupsFinished = baseGroups.every((group) => group.rows.every((row) => row.played === 2));

  if (!groupsFinished) {
    return { rankedGroups: baseGroups, unresolvedGroupTies: [] };
  }

  const rankedGroups = [];
  const unresolvedGroupTies = [];
  const storedOverrides = data.cupConfig?.groupTieBreakOverrides || {};

  for (let start = 0; start < baseGroups.length;) {
    let end = start + 1;
    const tieKey = getCopinhaGroupTieKey(baseGroups[start]);

    while (end < baseGroups.length && getCopinhaGroupTieKey(baseGroups[end]) === tieKey) {
      end += 1;
    }

    const tiedGroups = baseGroups.slice(start, end);

    if (tiedGroups.length === 1) {
      rankedGroups.push(tiedGroups[0]);
    } else {
      const manualOrder = getCopinhaManualTieOrder(tiedGroups, storedOverrides[tieKey]);

      if (manualOrder) {
        rankedGroups.push(...[...tiedGroups].sort((a, b) => manualOrder.indexOf(a.id) - manualOrder.indexOf(b.id)));
      } else {
        unresolvedGroupTies.push({
          tieKey,
          groupIds: tiedGroups.map((group) => group.id),
        });
        rankedGroups.push(...tiedGroups);
      }
    }

    start = end;
  }

  return { rankedGroups, unresolvedGroupTies };
}

function getCopinhaQualified(data) {
  const { rankedGroups } = getCopinhaSeededGroups(data);

  const champions = rankedGroups
    .filter((group) => group.rows[0])
    .map((group, index) => ({
      ...group.rows[0],
      groupPosition: 1,
      groupRank: index + 1,
    }));

  const runnersUp = rankedGroups
    .filter((group) => group.rows[1])
    .map((group, index) => ({
      ...group.rows[1],
      groupPosition: 2,
      groupRank: index + 1,
    }));

  const thirds = rankedGroups
    .filter((group) => group.rows[2])
    .map((group, index) => ({
      ...group.rows[2],
      groupPosition: 3,
      groupRank: index + 1,
    }));

  return {
    // Campeões de grupo recebem as melhores sementes; depois vêm os segundos.
    main: [...champions, ...runnersUp],
    // Na planilha de 2 grupos os terceiros não disputam consolação.
    repechage: rankedGroups.length > 2 ? thirds : [],
  };
}

function getCupQualified(data) {
  const format = getCupFormat(data);
  const teamCount = data.cupConfig?.teamCount || 12;

  if (format === "cearense" || format === "playranking") {
    return getCearenseQualified(data);
  }

  if (format === "copinha") {
    return getCopinhaQualified(data);
  }

  // Os torneios antigos não guardavam o formato. Mantemos a compatibilidade
  // apenas para eles, sem deixar uma Copinha de 18/21 cair na regra errada.
  if (format === "cup18" || (!format && teamCount === 18)) {
    return getCup18Qualified(data);
  }

  if (format === "cup21" || (!format && teamCount === 21)) {
    return getCup21Qualified(data);
  }

  const groupRankings = calculateCupGroupRankings(data, data.rankingCriteria);
  const main = [];
  const repechage = [];

  groupRankings.forEach((group) => {
    if (group.rows[0]) main.push({ ...group.rows[0], groupPosition: 1 });
    if (group.rows[1]) main.push({ ...group.rows[1], groupPosition: 2 });
    if (group.rows[2]) repechage.push({ ...group.rows[2], groupPosition: 3 });
  });

  const criteria = getRankingCriteria(data.rankingCriteria || defaultRankingCriteria);

  function sortGeneral(a, b) {
    if (a.groupPosition !== b.groupPosition) return a.groupPosition - b.groupPosition;

    for (const key of criteria.order) {
      const diff = b[key] - a[key];
      if (diff !== 0) return diff;
    }

    return a.name.localeCompare(b.name);
  }

  main.sort(sortGeneral);
  repechage.sort(sortGeneral);

  return { main, repechage };
}

function seedBracket(teamIds, bracketType) {
  if (teamIds.length === 4) {
    return [
      [teamIds[0], teamIds[3]],
      [teamIds[1], teamIds[2]],
    ].map((pair, index) => ({
      phase: bracketType,
      roundName: "Semifinal",
      matchKey: `${bracketType}_sf_${index + 1}`,
      source1: null,
      source2: null,
      ids1: [pair[0]],
      ids2: [pair[1]],
      team1: null,
      team2: null,
      s1: "",
      s2: "",
      court: index + 1,
    }));
  }

  if (teamIds.length === 8) {
    return [
      [teamIds[0], teamIds[7]],
      [teamIds[3], teamIds[4]],
      [teamIds[2], teamIds[5]],
      [teamIds[1], teamIds[6]],
    ].map((pair, index) => ({
      phase: bracketType,
      roundName: "Quartas de final",
      matchKey: `${bracketType}_qf_${index + 1}`,
      source1: null,
      source2: null,
      ids1: [pair[0]],
      ids2: [pair[1]],
      team1: null,
      team2: null,
      s1: "",
      s2: "",
      court: index + 1,
    }));
  }

  if (teamIds.length === 7) {
    return [
      [teamIds[1], teamIds[6]],
      [teamIds[2], teamIds[5]],
      [teamIds[3], teamIds[4]],
    ].map((pair, index) => ({
      phase: bracketType,
      roundName: "Preliminar",
      matchKey: `${bracketType}_pre_${index + 1}`,
      source1: null,
      source2: null,
      ids1: [pair[0]],
      ids2: [pair[1]],
      team1: null,
      team2: null,
      s1: "",
      s2: "",
      court: index + 1,
    }));
  }

  if (teamIds.length === 14) {
    return [
      [teamIds[2], teamIds[13]],
      [teamIds[3], teamIds[12]],
      [teamIds[4], teamIds[11]],
      [teamIds[5], teamIds[10]],
      [teamIds[6], teamIds[9]],
      [teamIds[7], teamIds[8]],
    ].map((pair, index) => ({
      phase: bracketType,
      roundName: "Preliminar",
      matchKey: `${bracketType}_pre_${index + 1}`,
      source1: null,
      source2: null,
      ids1: [pair[0]],
      ids2: [pair[1]],
      team1: null,
      team2: null,
      s1: "",
      s2: "",
      court: index + 1,
    }));
  }

  if (teamIds.length === 16) {
    return [
      [teamIds[0], teamIds[15]],
      [teamIds[7], teamIds[8]],
      [teamIds[4], teamIds[11]],
      [teamIds[3], teamIds[12]],
      [teamIds[2], teamIds[13]],
      [teamIds[5], teamIds[10]],
      [teamIds[6], teamIds[9]],
      [teamIds[1], teamIds[14]],
    ].map((pair, index) => ({
      phase: bracketType,
      roundName: "Oitavas de final",
      matchKey: `${bracketType}_r16_${index + 1}`,
      source1: null,
      source2: null,
      ids1: [pair[0]],
      ids2: [pair[1]],
      team1: null,
      team2: null,
      s1: "",
      s2: "",
      court: index + 1,
    }));
  }

  return [];
}

function generateParallelRoundRobin(teamIds) {
  const pairs = [
    [teamIds[0], teamIds[1]],
    [teamIds[2], teamIds[3]],
    [teamIds[0], teamIds[2]],
    [teamIds[1], teamIds[3]],
    [teamIds[0], teamIds[3]],
    [teamIds[1], teamIds[2]],
  ];

  return pairs.map((pair, index) => ({
    phase: "repechage",
    roundName: "Disputa Paralela",
    matchKey: `repechage_parallel_${index + 1}`,
    source1: null,
    source2: null,
    ids1: [pair[0]],
    ids2: [pair[1]],
    team1: null,
    team2: null,
    s1: "",
    s2: "",
    court: (index % 2) + 1,
  }));
}

function getGameWinnerId(game, data = null) {
  const winningScore = getWinningScore(data);
  const winnerSide = getScoreWinnerSide(game, winningScore);

  if (game.isBye) {
    if (game.ids1?.length && !game.ids2?.length) return game.ids1[0];
    if (game.ids2?.length && !game.ids1?.length) return game.ids2[0];
  }

  if (!game.ids1?.length || !game.ids2?.length) return null;
  if (!winnerSide) return null;

  return winnerSide === "team1" ? game.ids1[0] : game.ids2[0];
}

function getGameLoserId(game, data = null) {
  const winningScore = getWinningScore(data);
  const winnerSide = getScoreWinnerSide(game, winningScore);

  if (!game.ids1?.length || !game.ids2?.length) return null;
  if (!winnerSide) return null;

  return winnerSide === "team1" ? game.ids2[0] : game.ids1[0];
}

function resolveBracketGame(game, allGames, data) {
  const copy = { ...game };

  if (copy.source1) {
    const sourceGame = allGames.find((item) => item.matchKey === copy.source1);

    const sourceId = sourceGame
      ? copy.source1Mode === "loser"
        ? getGameLoserId(resolveBracketGame(sourceGame, allGames, data), data)
        : getGameWinnerId(resolveBracketGame(sourceGame, allGames, data), data)
      : null;

    copy.ids1 = sourceId === null ? [] : [sourceId];
  }

  if (copy.source2) {
    const sourceGame = allGames.find((item) => item.matchKey === copy.source2);

    const sourceId = sourceGame
      ? copy.source2Mode === "loser"
        ? getGameLoserId(resolveBracketGame(sourceGame, allGames, data), data)
        : getGameWinnerId(resolveBracketGame(sourceGame, allGames, data), data)
      : null;

    copy.ids2 = sourceId === null ? [] : [sourceId];
  }

  copy.team1 = copy.ids1?.length
    ? [getCupTeamName(data, copy.ids1[0])]
    : [copy.isBye ? "BYE" : "Aguardando"];

  copy.team2 = copy.ids2?.length
    ? [getCupTeamName(data, copy.ids2[0])]
    : [copy.isBye ? "BYE" : "Aguardando"];

  return copy;
}

function buildNextRound(previousGames, bracketType, roundName, keyPrefix) {
  const games = [];

  for (let i = 0; i < previousGames.length; i += 2) {
    games.push({
      phase: bracketType,
      roundName,
      matchKey: `${bracketType}_${keyPrefix}_${games.length + 1}`,
      source1: previousGames[i].matchKey,
      source2: previousGames[i + 1].matchKey,
      ids1: [],
      ids2: [],
      team1: null,
      team2: null,
      s1: "",
      s2: "",
      court: games.length + 1,
    });
  }

  return games;
}

function buildThirdPlaceGame(semifinals, bracketType = "main") {
  if (!semifinals || semifinals.length < 2) return [];

  return [
    {
      phase: bracketType,
      roundName: "3º lugar",
      matchKey: `${bracketType}_third_1`,
      source1: semifinals[0].matchKey,
      source2: semifinals[1].matchKey,
      source1Mode: "loser",
      source2Mode: "loser",
      ids1: [],
      ids2: [],
      team1: null,
      team2: null,
      s1: "",
      s2: "",
      court: 2,
    },
  ];
}

function getLargestPowerOfTwo(value) {
  let power = 1;

  while (power * 2 <= value) {
    power *= 2;
  }

  return power;
}

function getNextPowerOfTwo(value) {
  let power = 1;

  while (power < value) {
    power *= 2;
  }

  return power;
}

function getBracketSeedOrder(size) {
  let order = [1, 2];

  while (order.length < size) {
    const nextSize = order.length * 2;
    order = order.flatMap((seed) => [seed, nextSize + 1 - seed]);
  }

  return order;
}

function getEliminationRoundName(teamCount) {
  if (teamCount === 2) return "Final";
  if (teamCount === 4) return "Semifinal";
  if (teamCount === 8) return "Quartas de final";
  if (teamCount === 16) return "Oitavas de final";
  if (teamCount === 32) return "Fase de 32";
  return `Rodada de ${teamCount}`;
}

function getCopinhaPreliminaryPairs(entries) {
  const remaining = [...entries];
  const pairs = [];

  while (remaining.length > 1) {
    const first = remaining.shift();
    let opponentIndex = -1;

    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      if (remaining[index].groupId !== first.groupId) {
        opponentIndex = index;
        break;
      }
    }

    if (opponentIndex < 0) opponentIndex = remaining.length - 1;

    pairs.push([first, remaining.splice(opponentIndex, 1)[0]]);
  }

  return pairs;
}

function createCopinhaBracketGame({
  bracketType,
  roundName,
  matchKey,
  entry1,
  entry2,
  court,
}) {
  return {
    phase: bracketType,
    roundName,
    matchKey,
    source1: entry1?.sourceMatchKey || null,
    source2: entry2?.sourceMatchKey || null,
    source1Mode: entry1?.sourceMode || null,
    source2Mode: entry2?.sourceMode || null,
    ids1: Number.isInteger(entry1?.id) ? [entry1.id] : [],
    ids2: Number.isInteger(entry2?.id) ? [entry2.id] : [],
    team1: null,
    team2: null,
    s1: "",
    s2: "",
    court,
  };
}

// Mapas de chaveamento da Copinha. C = campeão do grupo, R = segundo e T =
// terceiro; o número é a posição da campanha do grupo. As abas de 2 a 9
// grupos foram transcritas da planilha. Em 10 grupos, a planilha repete o
// 2º MG4 no Jogo 8 e deixa o 1º MG4 de fora; usamos 1º MG4 para que as 20
// duplas classificadas apareçam uma única vez. Os formatos 11 e 12 seguem a
// mesma distribuição, corrigindo as cópias incompletas dessas abas.
const copinhaBracketPlans = {
  2: {
    main: [
      { title: "Semifinal", games: [["m1", "c1", "r2"], ["m2", "c2", "r1"]] },
      { title: "3º lugar", games: [["m3", "l:m1", "l:m2"]] },
      { title: "Final", games: [["m4", "w:m1", "w:m2"]] },
    ],
    repechage: [],
  },
  3: {
    main: [
      { title: "Quartas de final", games: [["m1", "r2", "r3"], ["m2", "r1", "c3"]] },
      { title: "Semifinal", games: [["m3", "c1", "w:m1"], ["m4", "c2", "w:m2"]] },
      { title: "3º lugar", games: [["m5", "l:m3", "l:m4"]] },
      { title: "Final", games: [["m6", "w:m3", "w:m4"]] },
    ],
    repechage: [
      { title: "Semifinal", games: [["r1", "t2", "t3"]] },
      { title: "Final", games: [["r2", "t1", "w:r1"]] },
    ],
  },
  4: {
    main: [
      { title: "Quartas de final", games: [["m1", "c1", "r3"], ["m2", "c4", "r2"], ["m3", "c3", "r1"], ["m4", "c2", "r4"]] },
      { title: "Semifinal", games: [["m5", "w:m1", "w:m2"], ["m6", "w:m3", "w:m4"]] },
      { title: "3º lugar", games: [["m7", "l:m5", "l:m6"]] },
      { title: "Final", games: [["m8", "w:m5", "w:m6"]] },
    ],
    repechage: [
      { title: "Semifinal", games: [["r1", "t1", "t4"], ["r2", "t2", "t3"]] },
      { title: "Final", games: [["r3", "w:r1", "w:r2"]] },
    ],
  },
  5: {
    main: [
      { title: "Oitavas de final", games: [["m1", "r3", "r2"], ["m2", "r4", "r5"]] },
      { title: "Quartas de final", games: [["m3", "c1", "w:m1"], ["m4", "c4", "c5"], ["m5", "c3", "r1"], ["m6", "c2", "w:m2"]] },
      { title: "Semifinal", games: [["m7", "w:m3", "w:m4"], ["m8", "w:m5", "w:m6"]] },
      { title: "3º lugar", games: [["m9", "l:m7", "l:m8"]] },
      { title: "Final", games: [["m10", "w:m7", "w:m8"]] },
    ],
    repechage: [
      { title: "Quartas de final", games: [["r1", "t5", "t4"]] },
      { title: "Semifinal", games: [["r2", "t1", "w:r1"], ["r3", "t2", "t3"]] },
      { title: "Final", games: [["r4", "w:r2", "w:r3"]] },
    ],
  },
  6: {
    main: [
      { title: "Oitavas de final", games: [["m1", "r2", "r6"], ["m2", "r3", "c5"], ["m3", "r1", "c6"], ["m4", "r4", "r5"]] },
      { title: "Quartas de final", games: [["m5", "c1", "w:m1"], ["m6", "c4", "w:m2"], ["m7", "c3", "w:m3"], ["m8", "c2", "w:m4"]] },
      { title: "Semifinal", games: [["m9", "w:m5", "w:m6"], ["m10", "w:m7", "w:m8"]] },
      { title: "3º lugar", games: [["m11", "l:m9", "l:m10"]] },
      { title: "Final", games: [["m12", "w:m9", "w:m10"]] },
    ],
    repechage: [
      { title: "Quartas de final", games: [["r1", "t4", "t6"], ["r2", "t3", "t5"]] },
      { title: "Semifinal", games: [["r3", "t1", "w:r1"], ["r4", "t2", "w:r2"]] },
      { title: "Final", games: [["r5", "w:r3", "w:r4"]] },
    ],
  },
  7: {
    main: [
      { title: "Oitavas de final", games: [["m1", "c7", "r6"], ["m2", "r3", "c5"], ["m3", "c4", "r2"], ["m4", "r5", "r4"], ["m5", "c6", "r7"], ["m6", "c3", "r1"]] },
      { title: "Quartas de final", games: [["m7", "c1", "w:m1"], ["m8", "w:m2", "w:m3"], ["m9", "w:m5", "w:m6"], ["m10", "c2", "w:m4"]] },
      { title: "Semifinal", games: [["m11", "w:m7", "w:m8"], ["m12", "w:m9", "w:m10"]] },
      { title: "3º lugar", games: [["m13", "l:m11", "l:m12"]] },
      { title: "Final", games: [["m14", "w:m11", "w:m12"]] },
    ],
    repechage: [
      { title: "Quartas de final", games: [["r1", "t2", "t7"], ["r2", "t3", "t6"], ["r3", "t4", "t5"]] },
      { title: "Semifinal", games: [["r4", "t1", "w:r3"], ["r5", "w:r1", "w:r2"]] },
      { title: "Final", games: [["r6", "w:r4", "w:r5"]] },
    ],
  },
  8: {
    main: [
      { title: "Oitavas de final", games: [["m1", "c1", "r8"], ["m2", "c5", "r3"], ["m3", "c7", "r2"], ["m4", "c4", "r6"], ["m5", "c3", "r5"], ["m6", "c6", "r4"], ["m7", "c8", "r1"], ["m8", "c2", "r7"]] },
      { title: "Quartas de final", games: [["m9", "w:m1", "w:m2"], ["m10", "w:m3", "w:m4"], ["m11", "w:m5", "w:m6"], ["m12", "w:m7", "w:m8"]] },
      { title: "Semifinal", games: [["m13", "w:m9", "w:m10"], ["m14", "w:m11", "w:m12"]] },
      { title: "3º lugar", games: [["m15", "l:m13", "l:m14"]] },
      { title: "Final", games: [["m16", "w:m13", "w:m14"]] },
    ],
    repechage: [
      { title: "Quartas de final", games: [["r1", "t1", "t8"], ["r2", "t2", "t7"], ["r3", "t3", "t6"], ["r4", "t4", "t5"]] },
      { title: "Semifinal", games: [["r5", "w:r1", "w:r2"], ["r6", "w:r3", "w:r4"]] },
      { title: "Final", games: [["r7", "w:r5", "w:r6"]] },
    ],
  },
  9: {
    main: [
      { title: "1ª Rodada", games: [["m1", "r8", "r6"], ["m2", "r9", "r7"]] },
      { title: "Oitavas de final", games: [["m3", "c1", "w:m1"], ["m4", "c5", "r3"], ["m5", "c7", "c9"], ["m6", "c4", "r2"], ["m7", "c2", "w:m2"], ["m8", "c8", "r4"], ["m9", "c6", "r5"], ["m10", "c3", "r1"]] },
      { title: "Quartas de final", games: [["m11", "w:m3", "w:m4"], ["m12", "w:m5", "w:m6"], ["m13", "w:m7", "w:m8"], ["m14", "w:m9", "w:m10"]] },
      { title: "Semifinal", games: [["m15", "w:m11", "w:m12"], ["m16", "w:m13", "w:m14"]] },
      { title: "3º lugar", games: [["m17", "l:m15", "l:m16"]] },
      { title: "Final", games: [["m18", "w:m15", "w:m16"]] },
    ],
    repechage: [
      { title: "1ª Rodada", games: [["r1", "t8", "t9"]] },
      { title: "Quartas de final", games: [["r2", "t1", "w:r1"], ["r3", "t2", "t7"], ["r4", "t3", "t6"], ["r5", "t4", "t5"]] },
      { title: "Semifinal", games: [["r6", "w:r2", "w:r3"], ["r7", "w:r4", "w:r5"]] },
      { title: "Final", games: [["r8", "w:r6", "w:r7"]] },
    ],
  },
  10: {
    main: [
      { title: "1ª Rodada", games: [["m1", "r3", "r6"], ["m2", "r8", "r10"], ["m3", "r4", "r5"], ["m4", "r7", "r9"]] },
      { title: "Oitavas de final", games: [["m5", "c1", "w:m1"], ["m6", "c5", "r2"], ["m7", "c7", "c9"], ["m8", "c4", "w:m2"], ["m9", "c3", "w:m3"], ["m10", "r1", "c6"], ["m11", "c8", "c10"], ["m12", "c2", "w:m4"]] },
      { title: "Quartas de final", games: [["m13", "w:m5", "w:m6"], ["m14", "w:m7", "w:m8"], ["m15", "w:m9", "w:m10"], ["m16", "w:m11", "w:m12"]] },
      { title: "Semifinal", games: [["m17", "w:m13", "w:m14"], ["m18", "w:m15", "w:m16"]] },
      { title: "3º lugar", games: [["m19", "l:m17", "l:m18"]] },
      { title: "Final", games: [["m20", "w:m17", "w:m18"]] },
    ],
    repechage: [
      { title: "1ª Rodada", games: [["r1", "t9", "t10"], ["r2", "t7", "t8"]] },
      { title: "Quartas de final", games: [["r3", "t1", "w:r1"], ["r4", "t2", "w:r2"], ["r5", "t3", "t4"], ["r6", "t5", "t6"]] },
      { title: "Semifinal", games: [["r7", "w:r3", "w:r4"], ["r8", "w:r5", "w:r6"]] },
      { title: "Final", games: [["r9", "w:r7", "w:r8"]] },
    ],
  },
  11: {
    main: [
      { title: "1ª Rodada", games: [["m1", "c11", "r10"], ["m2", "r1", "r11"], ["m3", "r2", "r9"], ["m4", "r3", "r8"], ["m5", "r4", "r7"], ["m6", "r5", "r6"]] },
      { title: "Oitavas de final", games: [["m7", "c1", "w:m1"], ["m8", "c8", "w:m2"], ["m9", "c4", "w:m3"], ["m10", "c5", "w:m4"], ["m11", "c2", "w:m5"], ["m12", "c7", "w:m6"], ["m13", "c3", "c10"], ["m14", "c6", "c9"]] },
      { title: "Quartas de final", games: [["m15", "w:m7", "w:m8"], ["m16", "w:m9", "w:m10"], ["m17", "w:m11", "w:m12"], ["m18", "w:m13", "w:m14"]] },
      { title: "Semifinal", games: [["m19", "w:m15", "w:m16"], ["m20", "w:m17", "w:m18"]] },
      { title: "3º lugar", games: [["m21", "l:m19", "l:m20"]] },
      { title: "Final", games: [["m22", "w:m19", "w:m20"]] },
    ],
    repechage: [
      { title: "1ª Rodada", games: [["r1", "t6", "t11"], ["r2", "t7", "t10"], ["r3", "t8", "t9"]] },
      { title: "Quartas de final", games: [["r4", "t1", "w:r1"], ["r5", "t4", "w:r2"], ["r6", "t2", "w:r3"], ["r7", "t3", "t5"]] },
      { title: "Semifinal", games: [["r8", "w:r4", "w:r5"], ["r9", "w:r6", "w:r7"]] },
      { title: "Final", games: [["r10", "w:r8", "w:r9"]] },
    ],
  },
  12: {
    main: [
      { title: "1ª Rodada", games: [["m1", "c9", "r12"], ["m2", "c10", "r11"], ["m3", "c11", "r10"], ["m4", "c12", "r9"], ["m5", "r1", "r8"], ["m6", "r2", "r7"], ["m7", "r3", "r6"], ["m8", "r4", "r5"]] },
      { title: "Oitavas de final", games: [["m9", "c1", "w:m1"], ["m10", "c8", "w:m2"], ["m11", "c4", "w:m3"], ["m12", "c5", "w:m4"], ["m13", "c2", "w:m5"], ["m14", "c3", "w:m6"], ["m15", "c7", "w:m7"], ["m16", "c6", "w:m8"]] },
      { title: "Quartas de final", games: [["m17", "w:m9", "w:m10"], ["m18", "w:m11", "w:m12"], ["m19", "w:m13", "w:m14"], ["m20", "w:m15", "w:m16"]] },
      { title: "Semifinal", games: [["m21", "w:m17", "w:m18"], ["m22", "w:m19", "w:m20"]] },
      { title: "3º lugar", games: [["m23", "l:m21", "l:m22"]] },
      { title: "Final", games: [["m24", "w:m21", "w:m22"]] },
    ],
    repechage: [
      { title: "1ª Rodada", games: [["r1", "t5", "t12"], ["r2", "t6", "t11"], ["r3", "t7", "t10"], ["r4", "t8", "t9"]] },
      { title: "Quartas de final", games: [["r5", "t1", "w:r1"], ["r6", "t4", "w:r2"], ["r7", "t2", "w:r3"], ["r8", "t3", "w:r4"]] },
      { title: "Semifinal", games: [["r9", "w:r5", "w:r6"], ["r10", "w:r7", "w:r8"]] },
      { title: "Final", games: [["r11", "w:r9", "w:r10"]] },
    ],
  },
};

const cearenseMainBracketPlans = {
  2: copinhaBracketPlans[2].main,
  3: copinhaBracketPlans[3].main,
  4: copinhaBracketPlans[4].main,
  5: copinhaBracketPlans[5].main,
  6: copinhaBracketPlans[6].main,
  7: copinhaBracketPlans[7].main,
  8: copinhaBracketPlans[8].main,
  9: copinhaBracketPlans[9].main,
  10: [
    { title: "1ª Rodada", games: [["m1", "r8", "r10"], ["m2", "r3", "r6"], ["m3", "r4", "r5"], ["m4", "r7", "r9"]] },
    { title: "Oitavas de final", games: [["m5", "c1", "w:m1"], ["m6", "r2", "c5"], ["m7", "c7", "c9"], ["m8", "w:m2", "c4"], ["m9", "c3", "w:m3"], ["m10", "r1", "c6"], ["m11", "c8", "c10"], ["m12", "w:m4", "c2"]] },
    { title: "Quartas de final", games: [["m13", "w:m5", "w:m6"], ["m14", "w:m7", "w:m8"], ["m15", "w:m9", "w:m10"], ["m16", "w:m11", "w:m12"]] },
    { title: "Semifinal", games: [["m17", "w:m13", "w:m14"], ["m18", "w:m15", "w:m16"]] },
    { title: "3º lugar", games: [["m19", "l:m17", "l:m18"]] },
    { title: "Final", games: [["m20", "w:m17", "w:m18"]] },
  ],
};

function expandBracketPlanWithVisualByes(roundPlan) {
  const expandedPlan = structuredClone(roundPlan || []);
  const treeRounds = expandedPlan.filter((round) => !String(round.title || "").includes("3º"));

  for (let roundIndex = 0; roundIndex < treeRounds.length - 1; roundIndex += 1) {
    const currentRound = treeRounds[roundIndex];
    const nextRound = treeRounds[roundIndex + 1];
    const currentByKey = new Map(currentRound.games.map((game) => [game[0], game]));
    const orderedCurrentGames = [];

    nextRound.games = nextRound.games.map(([nextKey, firstReference, secondReference], nextGameIndex) => {
      const nextReferences = [firstReference, secondReference];
      const normalizedReferences = nextReferences.map((reference, sideIndex) => {
        if (typeof reference === "string" && reference.startsWith("w:")) {
          const sourceKey = reference.slice(2);
          const sourceGame = currentByKey.get(sourceKey);
          if (sourceGame) orderedCurrentGames.push(sourceGame);
          return reference;
        }

        const byeKey = `visual_bye_${roundIndex + 1}_${nextGameIndex + 1}_${sideIndex + 1}`;
        orderedCurrentGames.push([byeKey, reference, null]);
        return `w:${byeKey}`;
      });

      return [nextKey, ...normalizedReferences];
    });

    if (orderedCurrentGames.length === nextRound.games.length * 2) {
      currentRound.games = orderedCurrentGames;
    }
  }

  return expandedPlan;
}

function getCopinhaEntryCode(entry) {
  const prefix = entry?.groupPosition === 1 ? "c" : entry?.groupPosition === 2 ? "r" : "t";
  return prefix ? `${prefix}${entry.groupRank}` : "";
}

function getCopinhaPlanEntry(reference, entryByCode, bracketType) {
  if (typeof reference !== "string") return null;

  if (reference.startsWith("w:") || reference.startsWith("l:")) {
    return {
      sourceMatchKey: `${bracketType}_${reference.slice(2)}`,
      sourceMode: reference.startsWith("l:") ? "loser" : "winner",
    };
  }

  return entryByCode[reference] || null;
}

function buildCopinhaBracketFromPlan(entries, bracketType, bracketTitle, roundPlan) {
  const entryByCode = Object.fromEntries(
    entries.map((entry) => [getCopinhaEntryCode(entry), entry])
  );

  return roundPlan.map((round) => ({
    title: round.title,
    bracketTitle,
    games: round.games.map(([key, first, second], index) => {
      const firstEntry = getCopinhaPlanEntry(first, entryByCode, bracketType);
      const secondEntry = getCopinhaPlanEntry(second, entryByCode, bracketType);
      return {
        ...createCopinhaBracketGame({
          bracketType,
          roundName: round.title,
          matchKey: `${bracketType}_${key}`,
          entry1: firstEntry,
          entry2: secondEntry,
          court: index + 1,
        }),
        isBye: Boolean(firstEntry) !== Boolean(secondEntry),
      };
    }),
  }));
}

function buildCopinhaEliminationRounds(entries, bracketType, bracketTitle, includeThirdPlace = false) {
  if (!Array.isArray(entries) || entries.length < 2) return [];

  const teamCount = entries.length;
  const targetSize = getLargestPowerOfTwo(teamCount);
  const preliminaryGameCount = teamCount - targetSize;
  const directEntryCount = teamCount - preliminaryGameCount * 2;
  const directEntries = entries.slice(0, directEntryCount);
  const preliminaryPairs = getCopinhaPreliminaryPairs(entries.slice(directEntryCount));
  const preliminaryGames = preliminaryPairs.map(([entry1, entry2], index) => (
    createCopinhaBracketGame({
      bracketType,
      roundName: "Preliminar",
      matchKey: `${bracketType}_pre_${index + 1}`,
      entry1,
      entry2,
      court: index + 1,
    })
  ));

  const seededEntries = [
    ...directEntries,
    ...preliminaryGames.map((game) => ({ sourceMatchKey: game.matchKey })),
  ];
  const seedOrder = getBracketSeedOrder(targetSize);
  const openingRoundName = getEliminationRoundName(targetSize);
  const openingGames = [];

  for (let index = 0; index < seedOrder.length; index += 2) {
    openingGames.push(createCopinhaBracketGame({
      bracketType,
      roundName: openingRoundName,
      matchKey: `${bracketType}_r${targetSize}_${openingGames.length + 1}`,
      entry1: seededEntries[seedOrder[index] - 1],
      entry2: seededEntries[seedOrder[index + 1] - 1],
      court: openingGames.length + 1,
    }));
  }

  const rounds = [];

  if (preliminaryGames.length > 0) {
    rounds.push({
      title: "Preliminar",
      bracketTitle,
      games: preliminaryGames,
    });
  }

  rounds.push({
    title: openingRoundName,
    bracketTitle,
    games: openingGames,
  });

  let currentGames = openingGames;
  let currentTeamCount = targetSize;

  while (currentGames.length > 1) {
    const nextTeamCount = currentTeamCount / 2;
    const nextRoundName = getEliminationRoundName(nextTeamCount);
    const nextGames = buildNextRound(
      currentGames,
      bracketType,
      nextRoundName,
      `r${nextTeamCount}`
    );

    if (nextTeamCount === 2 && includeThirdPlace) {
      const thirdPlaceGames = buildThirdPlaceGame(currentGames, bracketType);

      if (thirdPlaceGames.length) {
        rounds.push({
          title: "3º lugar",
          bracketTitle,
          games: thirdPlaceGames,
        });
      }
    }

    rounds.push({
      title: nextRoundName,
      bracketTitle,
      games: nextGames,
    });

    currentGames = nextGames;
    currentTeamCount = nextTeamCount;
  }

  return rounds;
}

function avoidSameGroupOpeningMatches(slots) {
  const arranged = [...slots];

  for (let index = 0; index < arranged.length; index += 2) {
    const first = arranged[index];
    const second = arranged[index + 1];

    if (!first || !second || first.groupId !== second.groupId) continue;

    let swapIndex = -1;

    for (let candidateIndex = 0; candidateIndex < arranged.length; candidateIndex += 1) {
      if (candidateIndex === index || candidateIndex === index + 1) continue;
      const candidate = arranged[candidateIndex];
      if (!candidate || candidate.groupId === first.groupId) continue;
      const preserveMainSeedType = first.groupPosition <= 2 || second.groupPosition <= 2;
      if (preserveMainSeedType && candidate.groupPosition !== second.groupPosition) continue;

      const candidatePairIndex = candidateIndex % 2 === 0 ? candidateIndex + 1 : candidateIndex - 1;
      const candidateOpponent = arranged[candidatePairIndex];

      if (!candidateOpponent || candidateOpponent.groupId !== second.groupId) {
        swapIndex = candidateIndex;
        break;
      }
    }

    if (swapIndex >= 0) {
      [arranged[index + 1], arranged[swapIndex]] = [arranged[swapIndex], arranged[index + 1]];
    }
  }

  return arranged;
}

function buildCearenseEliminationRounds(entries, bracketType, bracketTitle, includeThirdPlace = false) {
  if (!Array.isArray(entries) || entries.length < 2) return [];

  const bracketSize = getNextPowerOfTwo(entries.length);
  const seedOrder = getBracketSeedOrder(bracketSize);
  const seededSlots = avoidSameGroupOpeningMatches(
    seedOrder.map((seed) => entries[seed - 1] || null)
  );
  const openingRoundName = getEliminationRoundName(bracketSize);
  const openingGames = [];

  for (let index = 0; index < seededSlots.length; index += 2) {
    const entry1 = seededSlots[index];
    const entry2 = seededSlots[index + 1];

    openingGames.push({
      ...createCopinhaBracketGame({
        bracketType,
        roundName: openingRoundName,
        matchKey: `${bracketType}_r${bracketSize}_${openingGames.length + 1}`,
        entry1,
        entry2,
        court: openingGames.length + 1,
      }),
      isBye: Boolean(entry1) !== Boolean(entry2),
    });
  }

  const rounds = [{
    title: openingRoundName,
    bracketTitle,
    games: openingGames,
  }];
  let currentGames = openingGames;
  let currentTeamCount = bracketSize;

  while (currentGames.length > 1) {
    const nextTeamCount = currentTeamCount / 2;
    const nextRoundName = getEliminationRoundName(nextTeamCount);
    const nextGames = buildNextRound(
      currentGames,
      bracketType,
      nextRoundName,
      `r${nextTeamCount}`
    );

    if (nextTeamCount === 2 && includeThirdPlace) {
      const thirdPlaceGames = buildThirdPlaceGame(currentGames, bracketType);

      if (thirdPlaceGames.length) {
        rounds.push({
          title: "3º lugar",
          bracketTitle,
          games: thirdPlaceGames,
        });
      }
    }

    rounds.push({
      title: nextRoundName,
      bracketTitle,
      games: nextGames,
    });
    currentGames = nextGames;
    currentTeamCount = nextTeamCount;
  }

  return rounds;
}

function takeCompatibleParallelOpponent(entries, referenceEntry, fromEnd = true) {
  if (!entries.length) return null;

  const indexes = fromEnd
    ? Array.from({ length: entries.length }, (_, index) => entries.length - 1 - index)
    : Array.from({ length: entries.length }, (_, index) => index);
  const compatibleIndex = indexes.find((index) => entries[index]?.groupId !== referenceEntry?.groupId);
  const selectedIndex = compatibleIndex ?? indexes[0];

  return entries.splice(selectedIndex, 1)[0] || null;
}

function pairPlayRankingTransferredEntries(transferredEntries, originalEntries) {
  const ownerByOriginalIndex = Array(originalEntries.length).fill(-1);

  function findOpponent(transferIndex, visitedOriginals) {
    for (let originalIndex = originalEntries.length - 1; originalIndex >= 0; originalIndex -= 1) {
      if (visitedOriginals.has(originalIndex)) continue;
      if (originalEntries[originalIndex]?.groupId === transferredEntries[transferIndex]?.groupId) continue;

      visitedOriginals.add(originalIndex);
      const currentOwner = ownerByOriginalIndex[originalIndex];

      if (currentOwner < 0 || findOpponent(currentOwner, visitedOriginals)) {
        ownerByOriginalIndex[originalIndex] = transferIndex;
        return true;
      }
    }

    return false;
  }

  transferredEntries.forEach((_, transferIndex) => {
    findOpponent(transferIndex, new Set());
  });

  const opponentIndexByTransfer = Array(transferredEntries.length).fill(-1);
  ownerByOriginalIndex.forEach((transferIndex, originalIndex) => {
    if (transferIndex >= 0) opponentIndexByTransfer[transferIndex] = originalIndex;
  });
  const usedOriginals = new Set(opponentIndexByTransfer.filter((index) => index >= 0));
  const remainingOriginals = originalEntries.filter((_, index) => !usedOriginals.has(index));

  const pairs = transferredEntries.map((entry, transferIndex) => {
    const matchedOriginalIndex = opponentIndexByTransfer[transferIndex];
    const opponent = matchedOriginalIndex >= 0
      ? originalEntries[matchedOriginalIndex]
      : takeCompatibleParallelOpponent(remainingOriginals, entry, true);

    return [entry, opponent];
  });

  return { pairs, remainingOriginals };
}

function spreadPlayRankingOpeningPairs(pairs) {
  if (pairs.length <= 2) return pairs;

  const seedOrder = getBracketSeedOrder(pairs.length);
  const spread = Array(pairs.length).fill(null);

  pairs.forEach((pair, index) => {
    spread[seedOrder[index] - 1] = pair;
  });

  return spread;
}

function buildPlayRankingParallelRounds(transferredEntries, originalEntries, bracketTitle) {
  const transferred = [...transferredEntries];
  const originals = [...originalEntries];
  const totalEntries = transferred.length + originals.length;

  if (totalEntries < 2) return [];

  const bracketSize = getNextPowerOfTwo(totalEntries);
  const openingGameCount = totalEntries - bracketSize / 2;
  const transferredGamesCount = Math.min(openingGameCount, transferred.length, originals.length);
  const transferredByeCount = transferred.length - transferredGamesCount;
  const originalByeCount = originals.length - (transferredGamesCount + (openingGameCount - transferredGamesCount) * 2);
  const openingPairs = [];

  transferred.splice(0, transferredByeCount).forEach((entry) => {
    openingPairs.push([entry, null]);
  });

  originals.splice(0, Math.max(0, originalByeCount)).forEach((entry) => {
    openingPairs.push([entry, null]);
  });

  const transferPairing = pairPlayRankingTransferredEntries(transferred, originals);
  openingPairs.push(...transferPairing.pairs);
  originals.splice(0, originals.length, ...transferPairing.remainingOriginals);

  while (originals.length > 1) {
    const first = originals.shift();
    openingPairs.push([first, takeCompatibleParallelOpponent(originals, first, true)]);
  }

  if (originals.length === 1) openingPairs.push([originals.shift(), null]);

  while (openingPairs.length < bracketSize / 2) openingPairs.push([null, null]);

  const openingRoundName = getEliminationRoundName(bracketSize);
  const openingGames = spreadPlayRankingOpeningPairs(openingPairs).map(([entry1, entry2], index) => ({
    ...createCopinhaBracketGame({
      bracketType: "repechage",
      roundName: openingRoundName,
      matchKey: `repechage_r${bracketSize}_${index + 1}`,
      entry1,
      entry2,
      court: index + 1,
    }),
    isBye: Boolean(entry1) !== Boolean(entry2),
  }));
  const rounds = [{ title: openingRoundName, bracketTitle, games: openingGames }];
  let currentGames = openingGames;
  let currentTeamCount = bracketSize;

  while (currentGames.length > 1) {
    const nextTeamCount = currentTeamCount / 2;
    const nextRoundName = getEliminationRoundName(nextTeamCount);
    const nextGames = buildNextRound(
      currentGames,
      "repechage",
      nextRoundName,
      `r${nextTeamCount}`
    );

    rounds.push({ title: nextRoundName, bracketTitle, games: nextGames });
    currentGames = nextGames;
    currentTeamCount = nextTeamCount;
  }

  return rounds;
}

function getPlayRankingOpeningLosses(data, mainRounds, qualifiedMain) {
  const openingRound = mainRounds?.[0];

  if (!openingRound) {
    return { ready: false, roundName: "Primeira fase", losses: [] };
  }

  const storedGames = Array.isArray(data.brackets) ? data.brackets : [];
  const storedByKey = new Map(storedGames.map((game) => [game.matchKey, game]));
  const playedOpeningGames = openingRound.games
    .filter((game) => !game.isBye && game.ids1?.length && game.ids2?.length)
    .map((game) => {
      const stored = storedByKey.get(game.matchKey) || {};
      return {
        ...game,
        s1: stored.s1 ?? "",
        s2: stored.s2 ?? "",
      };
    });

  const ready = playedOpeningGames.length > 0 && playedOpeningGames.every((game) => (
    isGameFinished(game, getWinningScore(data))
  ));

  if (!ready) {
    return { ready: false, roundName: openingRound.title, losses: [] };
  }

  const entryById = new Map(qualifiedMain.map((entry) => [entry.id, entry]));
  const seedIndexById = new Map(qualifiedMain.map((entry, index) => [entry.id, index]));
  const losses = playedOpeningGames
    .map((game) => {
      const loserId = getGameLoserId(game, data);
      const winnerSide = getScoreWinnerSide(game, getWinningScore(data));
      const entry = entryById.get(loserId);

      if (!entry || !winnerSide) return null;

      const loserGames = winnerSide === "team1" ? Number(game.s2) : Number(game.s1);
      const winnerGames = winnerSide === "team1" ? Number(game.s1) : Number(game.s2);

      return {
        ...entry,
        playRankingOrigin: "main-opening-loss",
        openingLossMargin: Math.abs(winnerGames - loserGames),
        openingLossGames: loserGames,
      };
    })
    .filter(Boolean)
    .sort((first, second) => {
      const marginDifference = first.openingLossMargin - second.openingLossMargin;
      if (marginDifference !== 0) return marginDifference;

      const gamesDifference = second.openingLossGames - first.openingLossGames;
      if (gamesDifference !== 0) return gamesDifference;

      const campaignDifference = compareCearenseCampaignMetrics(first, second);
      if (campaignDifference !== 0) return campaignDifference;

      const seedDifference = seedIndexById.get(first.id) - seedIndexById.get(second.id);
      if (seedDifference !== 0) return seedDifference;

      return first.name.localeCompare(second.name);
    });

  return { ready: true, roundName: openingRound.title, losses };
}

function generatePlayRankingBrackets(data) {
  const qualified = getCearenseQualified(data);
  const cupConfig = data.cupConfig || {};
  const mainName = cupConfig.mainBracketName || "Eliminatória Principal";
  const repechageName = cupConfig.repechageName || "Disputa Paralela";
  const mainRounds = buildCearenseEliminationRounds(qualified.main, "main", mainName, true);
  const openingLosses = getPlayRankingOpeningLosses(data, mainRounds, qualified.main);
  const repechageRounds = openingLosses.ready
    ? buildPlayRankingParallelRounds(openingLosses.losses, qualified.repechage, repechageName)
    : [];
  const allGames = [...mainRounds, ...repechageRounds].flatMap((round) => round.games);

  return {
    main: mainRounds.map((round) => ({
      ...round,
      games: round.games.map((game) => resolveBracketGame(game, allGames, data)),
    })),
    repechage: repechageRounds.map((round) => ({
      ...round,
      games: round.games.map((game) => resolveBracketGame(game, allGames, data)),
    })),
  };
}

function buildCearenseThirdParallelRounds(mainRounds, bracketTitle) {
  const quarterfinal = mainRounds.find((round) => String(round.title).toLocaleLowerCase("pt-BR").includes("quartas"));
  const semifinal = mainRounds.find((round) => String(round.title).toLocaleLowerCase("pt-BR").includes("semifinal"));
  const realQuarterfinalGames = (quarterfinal?.games || []).filter((game) => !game.isBye);
  const realSemifinalGames = (semifinal?.games || []).filter((game) => !game.isBye);
  const sourceGames = realQuarterfinalGames.length === 4
    ? realQuarterfinalGames
    : realQuarterfinalGames.length === 2
      ? realQuarterfinalGames
      : !quarterfinal && realSemifinalGames.length === 2
        ? realSemifinalGames
        : [];

  if (sourceGames.length < 2) return [];

  const loserEntry = (game) => ({ sourceMatchKey: game.matchKey, sourceMode: "loser" });

  if (sourceGames.length === 2) {
    return [{
      title: "Final",
      bracketTitle,
      games: [createCopinhaBracketGame({
        bracketType: "thirdParallel",
        roundName: "Final",
        matchKey: "thirdParallel_final_1",
        entry1: loserEntry(sourceGames[0]),
        entry2: loserEntry(sourceGames[1]),
        court: 1,
      })],
    }];
  }

  const semifinals = [0, 2].map((start, index) => createCopinhaBracketGame({
    bracketType: "thirdParallel",
    roundName: "Semifinal",
    matchKey: `thirdParallel_sf_${index + 1}`,
    entry1: loserEntry(sourceGames[start]),
    entry2: loserEntry(sourceGames[start + 1]),
    court: index + 1,
  }));
  const final = createCopinhaBracketGame({
    bracketType: "thirdParallel",
    roundName: "Final",
    matchKey: "thirdParallel_final_1",
    entry1: { sourceMatchKey: semifinals[0].matchKey, sourceMode: "winner" },
    entry2: { sourceMatchKey: semifinals[1].matchKey, sourceMode: "winner" },
    court: 1,
  });

  return [
    { title: "Semifinal", bracketTitle, games: semifinals },
    { title: "Final", bracketTitle, games: [final] },
  ];
}

function generateCearenseBrackets(data) {
  const qualified = getCearenseQualified(data);
  const cupConfig = data.cupConfig || {};
  const mainName = cupConfig.mainBracketName || "Eliminatória Principal";
  const repechageName = cupConfig.repechageName || "2ª Disputa Paralela";
  const thirdRepechageName = cupConfig.thirdRepechageName || "3ª Disputa Paralela";
  const groupCount = createCearenseGroups(cupConfig.teamCount || 4).length;
  const mainPlan = cearenseMainBracketPlans[groupCount];
  const mainRounds = mainPlan
    ? buildCopinhaBracketFromPlan(qualified.main, "main", mainName, expandBracketPlanWithVisualByes(mainPlan))
    : buildCearenseEliminationRounds(qualified.main, "main", mainName, true);
  const repechageRounds = buildCearenseEliminationRounds(qualified.repechage, "repechage", repechageName);
  const thirdParallelRounds = buildCearenseThirdParallelRounds(mainRounds, thirdRepechageName);
  const allGames = [...mainRounds, ...repechageRounds, ...thirdParallelRounds].flatMap((round) => round.games);

  return {
    main: mainRounds.map((round) => ({
      ...round,
      games: round.games.map((game) => resolveBracketGame(game, allGames, data)),
    })),
    repechage: repechageRounds.map((round) => ({
      ...round,
      games: round.games.map((game) => resolveBracketGame(game, allGames, data)),
    })),
    thirdParallel: thirdParallelRounds.map((round) => ({
      ...round,
      games: round.games.map((game) => resolveBracketGame(game, allGames, data)),
    })),
  };
}

function generateCopinhaBrackets(data) {
  const qualified = getCopinhaQualified(data);
  const cupConfig = data.cupConfig || {};
  const mainName = cupConfig.mainBracketName || "Chave Principal";
  const repechageName = cupConfig.repechageName || "Consolação";
  const groupCount = Math.floor((cupConfig.teamCount || 0) / 3);
  const plan = copinhaBracketPlans[groupCount];
  const mainRounds = plan
    ? buildCopinhaBracketFromPlan(qualified.main, "main", mainName, plan.main)
    : buildCopinhaEliminationRounds(qualified.main, "main", mainName, true);
  const repechageRounds = plan
    ? buildCopinhaBracketFromPlan(qualified.repechage, "repechage", repechageName, plan.repechage)
    : buildCopinhaEliminationRounds(qualified.repechage, "repechage", repechageName, false);
  const allGames = [...mainRounds, ...repechageRounds].flatMap((round) => round.games);

  return {
    main: mainRounds.map((round) => ({
      ...round,
      games: round.games.map((game) => resolveBracketGame(game, allGames, data)),
    })),
    repechage: repechageRounds.map((round) => ({
      ...round,
      games: round.games.map((game) => resolveBracketGame(game, allGames, data)),
    })),
  };
}

function generateCupBrackets(data) {
  if (isPlayRankingData(data)) {
    return generatePlayRankingBrackets(data);
  }

  if (isCampeonatoCearenseData(data)) {
    return generateCearenseBrackets(data);
  }

  if (isCopinhaData(data)) {
    return generateCopinhaBrackets(data);
  }

  const qualified = getCupQualified(data);
  const cupConfig = data.cupConfig || {};
  const teamCount = cupConfig.teamCount || 12;
  const mainName = cupConfig.mainBracketName || "Principal";
  const repechageName = cupConfig.repechageName || "Repescagem";

  const mainIds = qualified.main.map((item) => item.id);
  const repechageIds = qualified.repechage.map((item) => item.id);

  const mainRounds = [];
  const repechageRounds = [];

  if ((teamCount === 18 || teamCount === 21) && mainIds.length === 14) {
    const preliminary = seedBracket(mainIds, "main");

    const quarterfinals = [
      {
        phase: "main",
        roundName: "Quartas de final",
        matchKey: "main_qf_1",
        source1: null,
        source2: preliminary[0].matchKey,
        ids1: [mainIds[0]],
        ids2: [],
        team1: null,
        team2: null,
        s1: "",
        s2: "",
        court: 1,
      },
      {
        phase: "main",
        roundName: "Quartas de final",
        matchKey: "main_qf_2",
        source1: null,
        source2: preliminary[1].matchKey,
        ids1: [mainIds[1]],
        ids2: [],
        team1: null,
        team2: null,
        s1: "",
        s2: "",
        court: 2,
      },
      {
        phase: "main",
        roundName: "Quartas de final",
        matchKey: "main_qf_3",
        source1: preliminary[2].matchKey,
        source2: preliminary[3].matchKey,
        ids1: [],
        ids2: [],
        team1: null,
        team2: null,
        s1: "",
        s2: "",
        court: 3,
      },
      {
        phase: "main",
        roundName: "Quartas de final",
        matchKey: "main_qf_4",
        source1: preliminary[4].matchKey,
        source2: preliminary[5].matchKey,
        ids1: [],
        ids2: [],
        team1: null,
        team2: null,
        s1: "",
        s2: "",
        court: 4,
      },
    ];

    const semifinals = [
      {
        phase: "main",
        roundName: "Semifinal",
        matchKey: "main_sf_1",
        source1: "main_qf_1",
        source2: "main_qf_4",
        ids1: [],
        ids2: [],
        team1: null,
        team2: null,
        s1: "",
        s2: "",
        court: 1,
      },
      {
        phase: "main",
        roundName: "Semifinal",
        matchKey: "main_sf_2",
        source1: "main_qf_2",
        source2: "main_qf_3",
        ids1: [],
        ids2: [],
        team1: null,
        team2: null,
        s1: "",
        s2: "",
        court: 2,
      },
    ];

    const final = [
      {
        phase: "main",
        roundName: "Final",
        matchKey: "main_final_1",
        source1: "main_sf_1",
        source2: "main_sf_2",
        ids1: [],
        ids2: [],
        team1: null,
        team2: null,
        s1: "",
        s2: "",
        court: 1,
      },
    ];

    mainRounds.push({
      title: "Preliminar",
      bracketTitle: mainName,
      games: preliminary,
    });

    mainRounds.push({
      title: "Quartas de final",
      bracketTitle: mainName,
      games: quarterfinals,
    });

    mainRounds.push({
      title: "Semifinal",
      bracketTitle: mainName,
      games: semifinals,
    });

    mainRounds.push({
      title: "3º lugar",
      bracketTitle: mainName,
      games: buildThirdPlaceGame(semifinals),
    });

    mainRounds.push({
      title: "Final",
      bracketTitle: mainName,
      games: final,
    });
  } else {
    const mainFirstRound = seedBracket(mainIds, "main");

    if (mainFirstRound.length) {
      mainRounds.push({
        title: mainFirstRound[0].roundName,
        bracketTitle: mainName,
        games: mainFirstRound,
      });

      if (mainIds.length === 8) {
        const semifinals = buildNextRound(mainFirstRound, "main", "Semifinal", "sf");
        const thirdPlace = buildThirdPlaceGame(semifinals);
        const final = buildNextRound(semifinals, "main", "Final", "final");

        mainRounds.push({ title: "Semifinal", bracketTitle: mainName, games: semifinals });
        mainRounds.push({ title: "3º lugar", bracketTitle: mainName, games: thirdPlace });
        mainRounds.push({ title: "Final", bracketTitle: mainName, games: final });
      }

      if (mainIds.length === 16) {
        const quarterfinals = buildNextRound(mainFirstRound, "main", "Quartas de final", "qf");
        const semifinals = buildNextRound(quarterfinals, "main", "Semifinal", "sf");
        const thirdPlace = buildThirdPlaceGame(semifinals);
        const final = buildNextRound(semifinals, "main", "Final", "final");

        mainRounds.push({ title: "Quartas de final", bracketTitle: mainName, games: quarterfinals });
        mainRounds.push({ title: "Semifinal", bracketTitle: mainName, games: semifinals });
        mainRounds.push({ title: "3º lugar", bracketTitle: mainName, games: thirdPlace });
        mainRounds.push({ title: "Final", bracketTitle: mainName, games: final });
      }
    }
  }

  const repechageFirstRound =
    repechageIds.length === 4
      ? generateParallelRoundRobin(repechageIds)
      : seedBracket(repechageIds, "repechage");

  if (repechageFirstRound.length) {
    repechageRounds.push({
      title: repechageFirstRound[0].roundName,
      bracketTitle: repechageName,
      games: repechageFirstRound,
    });

    if (repechageIds.length === 4) {
      // Disputa Paralela: todos contra todos. Não gera final.
    } else if (repechageIds.length === 7) {
      const semifinals = [
        {
          phase: "repechage",
          roundName: "Semifinal",
          matchKey: "repechage_sf_1",
          source1: null,
          source2: repechageFirstRound[0].matchKey,
          ids1: [repechageIds[0]],
          ids2: [],
          team1: null,
          team2: null,
          s1: "",
          s2: "",
          court: 1,
        },
        {
          phase: "repechage",
          roundName: "Semifinal",
          matchKey: "repechage_sf_2",
          source1: repechageFirstRound[1].matchKey,
          source2: repechageFirstRound[2].matchKey,
          ids1: [],
          ids2: [],
          team1: null,
          team2: null,
          s1: "",
          s2: "",
          court: 2,
        },
      ];
      const final = buildNextRound(semifinals, "repechage", "Final", "final");

      repechageRounds.push({ title: "Semifinal", bracketTitle: repechageName, games: semifinals });
      repechageRounds.push({ title: "Final", bracketTitle: repechageName, games: final });
    } else if (repechageIds.length === 8) {
      const semifinals = buildNextRound(repechageFirstRound, "repechage", "Semifinal", "sf");
      const final = buildNextRound(semifinals, "repechage", "Final", "final");

      repechageRounds.push({ title: "Semifinal", bracketTitle: repechageName, games: semifinals });
      repechageRounds.push({ title: "Final", bracketTitle: repechageName, games: final });
    }
  }

  const allGames = [...mainRounds, ...repechageRounds].flatMap((round) => round.games);

  const resolvedMainRounds = mainRounds.map((round) => ({
    ...round,
    games: round.games.map((game) => resolveBracketGame(game, allGames, data)),
  }));

  const resolvedRepechageRounds = repechageRounds.map((round) => ({
    ...round,
    games: round.games.map((game) => resolveBracketGame(game, allGames, data)),
  }));

  return {
    main: resolvedMainRounds,
    repechage: resolvedRepechageRounds,
  };
}

function getCupAllBracketGames(data) {
  const brackets = generateCupBrackets(data);
  return [...brackets.main, ...brackets.repechage, ...(brackets.thirdParallel || [])].flatMap((round) => round.games);
}

function rebuildCupBracketGames(currentData, existingScores = {}) {
  const baseGames = getCupAllBracketGames(currentData).map((game) => ({
    ...game,
    s1: existingScores[game.matchKey]?.s1 ?? game.s1 ?? "",
    s2: existingScores[game.matchKey]?.s2 ?? game.s2 ?? "",
    inProgress: existingScores[game.matchKey]?.inProgress === true,
    ...(existingScores[game.matchKey]?.courtNumberOverride
      ? { courtNumberOverride: existingScores[game.matchKey].courtNumberOverride }
      : {}),
  }));

  // Resolve novamente depois de reaplicar os placares. Assim, o vencedor de
  // uma fase anterior aparece imediatamente na fase seguinte.
  const resolvedGames = baseGames.map((game) => resolveBracketGame(game, baseGames, currentData));
  const safeGames = isPlayRankingData(currentData)
    ? resolvedGames.map((game) => {
        const stored = existingScores[game.matchKey];
        const sameParticipants = stored
          && JSON.stringify(stored.ids1 || []) === JSON.stringify(game.ids1 || [])
          && JSON.stringify(stored.ids2 || []) === JSON.stringify(game.ids2 || []);

        if (game.phase !== "repechage" || !stored || sameParticipants) return game;

        return { ...game, s1: "", s2: "" };
      })
    : resolvedGames;

  return safeGames.map((game) => resolveBracketGame(game, safeGames, currentData));
}

function syncCupBracketScores(currentData) {
  const copy = structuredClone(currentData);
  const existingScores = {};

  (copy.brackets || []).forEach((game) => {
    existingScores[game.matchKey] = {
      s1: game.s1,
      s2: game.s2,
      ids1: game.ids1,
      ids2: game.ids2,
      inProgress: game.inProgress === true,
      courtNumberOverride: game.courtNumberOverride,
    };
  });

  copy.brackets = rebuildCupBracketGames(copy, existingScores);
  return copy;
}

function calculateParallelRanking(data, rankingCriteriaValue = defaultRankingCriteria) {
  const allRepechageGames = (data.brackets || []).filter((game) => game.phase === "repechage");
  const games = allRepechageGames.map((game) =>
    resolveBracketGame(game, data.brackets || [], data)
  );

  const winningScore = getWinningScore(data);

  const qualified = getCupQualified(data);
  const baseIds = (qualified.repechage || []).map((item) => item.id);
  const ids = Array.from(
    new Set([
      ...baseIds,
      ...games.flatMap((game) => [
        ...(game.ids1 || []),
        ...(game.ids2 || []),
      ]),
    ])
  );

  const rows = ids.map((id) => ({
    id,
    name: getCupTeamName(data, id),
    pts: 0,
    w: 0,
    bal: 0,
    played: 0,
  }));

  const tableById = {};
  rows.forEach((row) => {
    tableById[row.id] = row;
  });

  games.forEach((game) => {
    const s1 = Number(game.s1);
    const s2 = Number(game.s2);

    if (game.s1 === "" || game.s2 === "" || Number.isNaN(s1) || Number.isNaN(s2)) return;

    const id1 = game.ids1?.[0];
    const id2 = game.ids2?.[0];

    if (id1 === undefined || id2 === undefined) return;

    if (!tableById[id1]) return;
    if (!tableById[id2]) return;

    const winnerSide = getScoreWinnerSide(game, winningScore);
    if (!winnerSide) return;

    const win1 = winnerSide === "team1";
    const win2 = winnerSide === "team2";

    tableById[id1].pts += s1;
    tableById[id1].bal += s1 - s2;
    tableById[id1].played += 1;
    if (win1) tableById[id1].w += 1;

    tableById[id2].pts += s2;
    tableById[id2].bal += s2 - s1;
    tableById[id2].played += 1;
    if (win2) tableById[id2].w += 1;
  });

  const finalGame = games.find((game) => game.roundName === "Final");
  const finalWinnerId = finalGame ? getGameWinnerId(finalGame, data) : null;
  const finalLoserId = finalGame ? getGameLoserId(finalGame, data) : null;

  if (finalWinnerId !== null && tableById[finalWinnerId]) tableById[finalWinnerId].parallelPosition = 1;
  if (finalLoserId !== null && tableById[finalLoserId]) tableById[finalLoserId].parallelPosition = 2;

  const criteria = getRankingCriteria(rankingCriteriaValue);

  return rows.sort((a, b) => {
    if (a.parallelPosition && b.parallelPosition) return a.parallelPosition - b.parallelPosition;
    if (a.parallelPosition) return -1;
    if (b.parallelPosition) return 1;

    for (const key of criteria.order) {
      const diff = b[key] - a[key];
      if (diff !== 0) return diff;
    }

    return a.name.localeCompare(b.name);
  });
}

function calculateMainCupPodium(data) {
  const games = data.brackets || [];

  const finalGame = games.find(
    (game) => game.phase === "main" && game.roundName === "Final"
  );

  const thirdPlaceGame = games.find(
    (game) => game.phase === "main" && game.roundName === "3º lugar"
  );

  if (!finalGame) return [];

  const resolvedFinal = resolveBracketGame(finalGame, games, data);
  const championId = getGameWinnerId(resolvedFinal, data);
  const runnerUpId = getGameLoserId(resolvedFinal, data);

  if (championId === null || runnerUpId === null) return [];

  const podium = [
    { position: "🏆 Campeão", name: getCupTeamName(data, championId) },
    { position: "🥈 Vice", name: getCupTeamName(data, runnerUpId) },
  ];

  if (thirdPlaceGame) {
    const resolvedThirdPlace = resolveBracketGame(thirdPlaceGame, games, data);
    const thirdId = getGameWinnerId(resolvedThirdPlace, data);

    if (thirdId !== null) {
      podium.push({ position: "🥉 3º lugar", name: getCupTeamName(data, thirdId) });
    }
  }

  return podium;
}

function calculateCupBracketPodium(data, phase) {
  const games = data.brackets || [];
  const finalGame = games.find(
    (game) => game.phase === phase && game.roundName === "Final"
  );
  const thirdPlaceGame = games.find((game) => (
    game.phase === phase && String(game.roundName || "").includes("3")
  ));

  if (!finalGame) return [];

  const resolvedFinal = resolveBracketGame(finalGame, games, data);
  const championId = getGameWinnerId(resolvedFinal, data);
  const runnerUpId = getGameLoserId(resolvedFinal, data);

  if (championId === null || runnerUpId === null) return [];

  const podium = [
    { position: "🏆 Campeão", name: getCupTeamName(data, championId) },
    { position: "🥈 Vice", name: getCupTeamName(data, runnerUpId) },
  ];

  if (thirdPlaceGame) {
    const resolvedThirdPlace = resolveBracketGame(thirdPlaceGame, games, data);
    const thirdId = getGameWinnerId(resolvedThirdPlace, data);

    if (thirdId !== null) {
      podium.push({ position: "🥉 3º lugar", name: getCupTeamName(data, thirdId) });
    }
  }

  return podium;
}

function calculateCopinhaConsolationPodium(data) {
  return calculateCupBracketPodium(data, "repechage");
}

function canUseSpeech() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function stopSpeech() {
  if (!canUseSpeech()) return;
  window.speechSynthesis.cancel();
}

function speakText(text) {
  if (!canUseSpeech()) {
    alert("Seu navegador não suporta chamada por voz.");
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pt-BR";
  utterance.rate = 1.05;
  utterance.pitch = 1;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
}

function cleanSpeechName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\+/g, " e ")
    .trim();
}

function formatTeamForSpeech(team) {
  if (!team || team.length === 0) return "equipe aguardando definição";

  return team
    .map((item) => cleanSpeechName(item))
    .filter(Boolean)
    .join(" e ");
}

function getGameSpeechText(game, options = {}) {
  const {
    roundLabel = "",
    includeIntro = true,
    includeGroup = true,
    includeClosing = true,
    courtNumbers = [],
  } = options;

  const groupText = includeGroup && game.groupName ? `${game.groupName}. ` : "";
  const roundText = roundLabel ? `${roundLabel}. ` : "";
  const team1 = formatTeamForSpeech(game.team1);
  const team2 = formatTeamForSpeech(game.team2);
  const courtLabel = getGameCourtLabel(game, courtNumbers);

  return [
    includeIntro ? "Atenção atletas." : "",
    roundText,
    groupText,
    `${courtLabel}.`,
    `${team1} contra ${team2}.`,
    includeClosing ? `Compareçam à ${courtLabel}. Boa partida.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function repeatText(text, times = 1) {
  return Array.from({ length: Number(times) || 1 }, () => text).join(" ");
}

function speakGame(game, options = {}) {
  const { repeat = 1 } = options;

  const text = getGameSpeechText(game, {
    ...options,
    includeIntro: true,
    includeClosing: true,
  });

  speakText(repeatText(text, repeat));
}

function speakRound(round, roundIndex, options = {}) {
  const {
    titlePrefix = "Rodada",
    includeGroup = true,
    repeat = 1,
    courtNumbers = [],
  } = options;

  const roundLabel = `${titlePrefix} ${roundIndex + 1}`;

  const gamesText = round
    .map((game) => {
      const gameText = getGameSpeechText(game, {
        includeIntro: false,
        includeClosing: false,
        includeGroup,
        courtNumbers,
      });

      return repeatText(gameText, repeat);
    })
    .join(" ");

  speakText(
    `Atenção atletas. ${roundLabel} iniciando. ${gamesText} Compareçam às suas quadras. Boa partida.`
  );
}

function speakBracketRound(round, repeat = 1, courtNumbers = []) {
  const title = round.bracketTitle
    ? `${round.title} da chave ${round.bracketTitle}`
    : round.title;

  const gamesText = round.games
    .map((game) => {
      const gameText = getGameSpeechText(game, {
        includeIntro: false,
        includeClosing: false,
        includeGroup: false,
        courtNumbers,
      });

      return repeatText(gameText, repeat);
    })
    .join(" ");

  speakText(
    `Atenção atletas. ${title} iniciando. ${gamesText} Compareçam às suas quadras. Boa partida.`
  );
}

function NoticeModal({ notice, onClose }) {
  if (!notice) return null;

  const icon = {
    success: "✅",
    error: "⚠️",
    info: "ℹ️",
    warning: "⚠️",
  }[notice.type || "info"];

  return (
    <div className="confirmOverlay">
      <div className={`confirmBox noticeBox ${notice.type || "info"}`}>
        <div className="confirmIcon">{icon}</div>
        <h2>{notice.title}</h2>
        <p>{notice.message}</p>

        <div className="confirmActions">
          <button type="button" onClick={onClose}>Entendi</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ target, onCancel, onConfirm }) {
  if (!target) return null;

  return (
    <div className="confirmOverlay">
      <div className="confirmBox">
        <div className="confirmIcon">⚠️</div>
        <h2>Mover para a lixeira?</h2>

        <p>
          O torneio <strong>{target.name}</strong> será movido para a lixeira e
          poderá ser recuperado em até 30 dias.
        </p>

        <div className="confirmActions">
          <button type="button" className="cancelBtn" onClick={onCancel}>Cancelar</button>
          <button type="button" className="deleteBtn" onClick={onConfirm}>Mover para lixeira</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmCircuitDeleteModal({ target, onCancel, onConfirm }) {
  if (!target) return null;

  return (
    <div className="confirmOverlay" role="dialog" aria-modal="true" aria-labelledby="delete-circuit-title">
      <div className="confirmBox circuitDeleteConfirmBox">
        <div className="confirmIcon"><Trash2 aria-hidden="true" /></div>
        <span className="confirmEyebrow">Excluir circuito</span>
        <h2 id="delete-circuit-title">Deseja excluir “{target.name}”?</h2>
        <p>
          O circuito será removido, mas todos os torneios vinculados continuarão salvos normalmente.
        </p>

        <div className="confirmActions">
          <button type="button" className="secondaryBtn" onClick={onCancel}>Manter circuito</button>
          <button type="button" className="deleteBtn" onClick={onConfirm}>Excluir circuito</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmClearScoresModal({ open, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div className="confirmOverlay">
      <div className="confirmBox">
        <div className="confirmIcon">🧹</div>
        <h2>Apagar somente os placares?</h2>

        <p>
          Todos os placares preenchidos deste campeonato serão apagados. A tabela
          e os participantes serão mantidos.
        </p>

        <div className="confirmActions">
          <button type="button" className="cancelBtn" onClick={onCancel}>Cancelar</button>
          <button type="button" className="deleteBtn" onClick={onConfirm}>Sim, apagar</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmClearTableModal({ open, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div className="confirmOverlay">
      <div className="confirmBox">
        <div className="confirmIcon">🗑️</div>
        <h2>Apagar todos os jogos e placares?</h2>

        <p>
          Os participantes serão mantidos, mas todos os jogos, rodadas, placares
          e chaves deste torneio serão removidos.
        </p>

        <div className="confirmActions">
          <button type="button" className="cancelBtn" onClick={onCancel}>Cancelar</button>
          <button type="button" className="deleteBtn" onClick={onConfirm}>Sim, apagar tudo</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmRegenerationModal({ confirmation, onCancel, onConfirm }) {
  if (!confirmation) return null;

  return createPortal(
    <div className="confirmOverlay" role="dialog" aria-modal="true" aria-labelledby="regeneration-confirm-title">
      <div className="confirmBox regenerationConfirmBox">
        <div className="confirmIcon" aria-hidden="true">{"\u26a0\ufe0f"}</div>
        <span className="confirmEyebrow">Atenção antes de continuar</span>
        <h2 id="regeneration-confirm-title">{confirmation.title}</h2>
        <p>{confirmation.message}</p>

        <ul className="regenerationImpactList">
          {confirmation.impacts.map((impact) => <li key={impact}>{impact}</li>)}
        </ul>

        <div className="confirmActions">
          <button type="button" className="secondaryBtn" onClick={onCancel}>Cancelar</button>
          <button type="button" className="regenerationConfirmBtn" onClick={onConfirm}>
            {confirmation.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PlanCard({ title, tag, badge, price, text, items }) {
  return (
    <div className="planCard">
      {badge && <div className="planBadge">{badge}</div>}

      <div className="planTop">
        <h3>{title}</h3>
        <span>{tag}</span>
      </div>

      <div className="planPrice">
        <strong>{price}</strong>
        <small>/mês</small>
      </div>

      <p className="planDesc">{text}</p>

      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Info({ title, text }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="modalityInfoCard">
      <div className="modalityInfoTop">
        <strong>{title}</strong>

        <button
          type="button"
          className="explainBtn"
          onClick={() => setOpen((prev) => !prev)}
        >
          {open ? "Fechar" : "Como funciona?"}
        </button>
      </div>

      {open && (
        <div className="modalityExplainBox">
          <p>{text}</p>
        </div>
      )}
    </div>
  );
}

function RankingShareButton({ config, compact = false }) {
  const [status, setStatus] = useState("idle");
  const [exportFiles, setExportFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);

  useEffect(() => {
    if (exportFiles.length === 0) {
      setPreviewUrls([]);
      return undefined;
    }

    const urls = exportFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [exportFiles]);

  if (!config?.groups?.some((group) => group?.rows?.length)) return null;

  function closeExportDialog() {
    setExportFiles([]);
    setStatus("idle");
  }

  async function handleShare() {
    if (status === "loading") return;
    setStatus("loading");

    try {
      const result = await shareRankingImages(config);
      setStatus(result.status);
      if (result.files?.length) {
        setExportFiles(result.files);
      } else {
        setTimeout(() => setStatus("idle"), 2400);
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        setStatus("idle");
        return;
      }
      console.error("Erro ao compartilhar ranking:", error);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2800);
    }
  }

  const label = status === "loading"
    ? "Preparando páginas…"
    : status === "copied"
      ? "Imagem copiada"
    : status === "copyError"
      ? "Opções de exportação"
    : status === "ready"
      ? "Ranking preparado"
    : status === "downloaded"
      ? "Imagens baixadas"
    : status === "shared"
      ? "Compartilhado"
        : status === "error"
          ? "Tentar novamente"
          : "Compartilhar ranking";

  return (
    <>
      <button type="button" className="rankingShareButton" onClick={handleShare} disabled={status === "loading"}>
        <Share2 aria-hidden="true" /> {label}
      </button>

      {exportFiles.length > 0 && createPortal(
        <div className="rankingExportOverlay" role="presentation" onMouseDown={closeExportDialog}>
          <section
            className="rankingExportDialog"
            role="dialog"
            aria-modal="true"
            aria-label="Opções para o ranking"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>{exportFiles.length === 1 ? "Ranking preparado" : `${exportFiles.length} páginas preparadas`}</span>
                <h2>{config.title || "Ranking Torneio360"}</h2>
              </div>
              <button type="button" className="rankingExportClose" onClick={closeExportDialog} aria-label="Fechar">
                <X aria-hidden="true" />
              </button>
            </header>

            {previewUrls.length > 0 ? (
              <div className="rankingExportPreviewPages" aria-label="Prévias das páginas do ranking">
                {previewUrls.map((url, index) => (
                  <figure key={url}>
                    <img className="rankingExportPreview" src={url} alt={`Prévia da página ${index + 1} do ranking`} />
                    <figcaption>Página {index + 1} de {previewUrls.length}</figcaption>
                  </figure>
                ))}
              </div>
            ) : null}

            <div className={`rankingExportNotice ${status === "copyError" || status === "error" ? "warning" : "success"}`}>
              {status === "copyError"
                ? "O navegador não liberou a cópia automática. Você ainda pode compartilhar, baixar ou imprimir."
                : status === "ready"
                  ? `${exportFiles.length} página(s) legível(is), sem reduzir o tamanho dos nomes.`
                : status === "downloaded"
                  ? "As imagens foram baixadas. Elas também continuam disponíveis para compartilhar ou imprimir."
                  : status === "shared"
                    ? "As páginas do ranking foram enviadas para o aplicativo escolhido."
                  : status === "error"
                    ? "A ação foi bloqueada pelo navegador. Tente novamente ou baixe as imagens."
                    : "Imagem copiada. Agora use Ctrl+V para colar diretamente no WhatsApp."}
            </div>

            <div className="rankingExportActions">
              {canNativeShareRankingFiles(exportFiles) ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await nativeShareRankingFiles(exportFiles, config);
                      setStatus("shared");
                    } catch (error) {
                      if (error?.name !== "AbortError") setStatus("error");
                    }
                  }}
                >
                  <Share2 aria-hidden="true" /> Compartilhar {exportFiles.length > 1 ? `${exportFiles.length} imagens` : "imagem"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (!printRankingDocument(config)) setStatus("error");
                }}
              >
                <Printer aria-hidden="true" /> Imprimir / salvar PDF multipágina
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  downloadRankingFiles(exportFiles);
                  setStatus("downloaded");
                }}
              >
                <Download aria-hidden="true" /> Baixar {exportFiles.length > 1 ? `${exportFiles.length} PNGs` : "PNG"}
              </button>
            </div>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}

function getPodiumInitials(name) {
  return String(name || "T360")
    .replace(/\s*\+\s*/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function CupPodiumView({ podium, title = "Principal", variant = "main", shareContext = null }) {
  if (!podium || podium.length === 0) return null;

  const podiumPlaces = podium.slice(0, 3).map((item, index) => ({ ...item, place: index + 1 }));
  const displayOrder = [podiumPlaces[1], podiumPlaces[0], podiumPlaces[2]].filter(Boolean);
  const shareConfig = shareContext ? {
    ...shareContext,
    title: `${shareContext.title || title} — ${title}`,
    groups: [{
      title: `Pódio da ${title}`,
      rows: podiumPlaces.map((item) => ({ name: item.name })),
    }],
  } : null;

  return (
    <div className={`cupPodiumBox ${variant === "parallel" ? "parallelPodiumBox" : "mainPodiumBox"}`}>
      <div className="cupPodiumHeading">
        <div>
          <span>Pódio oficial</span>
          <h3>{title}</h3>
        </div>
        <RankingShareButton config={shareConfig} compact />
      </div>

      <div className="cupPodiumGrid">
        {displayOrder.map((item) => (
          <div className={`cupPodiumItem cupPodiumPlace${item.place}`} key={`${item.position}-${item.name}`}>
            <span className="cupPodiumCrown" aria-hidden="true">{item.place === 1 ? "♛" : ""}</span>
            <span className="cupPodiumAvatar">{getPodiumInitials(item.name)}</span>
            <strong>{item.position}</strong>
            <span className="cupPodiumName">{item.name}</span>
            <span className="cupPodiumStep" aria-hidden="true">{item.place}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  const routeParams = new URLSearchParams(window.location.search);
  const publicId = routeParams.get("public");
  const arenaId = routeParams.get("arena");
  const wantsLogin = routeParams.get("entrar") === "1";
  const publicMode = routeParams.get("publico") === "1";

  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authFlow, setAuthFlow] = useState(() => getAuthFlowFromLocation());
  const [authCallbackError, setAuthCallbackError] = useState(() => getAuthCallbackError());
  const [authNotice, setAuthNotice] = useState(null);
  const activeUserIdRef = useRef(null);

  async function reconcileOwnProfile() {
    const { error } = await supabase.rpc("reconcile_my_profile");

    // A função existe na correção de banco desta atualização. Enquanto ela
    // ainda não tiver sido aplicada, o restante do fluxo continua funcionando
    // normalmente e não exibe um erro técnico para o organizador.
    if (error && !/reconcile_my_profile|function.*does not exist/i.test(`${error.message || ""} ${error.code || ""}`)) {
      console.warn("Não foi possível concluir a preparação do perfil:", error);
    }
  }

  async function loadProfile(userId, { waitForAccess = false } = {}) {
    const attempts = waitForAccess ? 6 : 1;
    let lastProfile = null;

    if (waitForAccess) {
      await reconcileOwnProfile();
    }

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Erro ao carregar perfil:", error);

        if (!waitForAccess || attempt === attempts - 1) {
          const cachedProfile = readCachedProfile(userId);
          if (!lastProfile && cachedProfile && isRetryableConnectionError(error)) {
            setProfile(cachedProfile);
            return cachedProfile;
          }
          if (!lastProfile) setProfile(null);
          return lastProfile;
        }
      } else if (data) {
        lastProfile = data;
        setProfile(data);
        saveCachedProfile(userId, data);

        const status = String(data.status || "").toLowerCase();
        const isStableProfile =
          status === "active" ||
          status === "blocked" ||
          status === "expired" ||
          isProfilePendingEmailConfirmation(data);

        if (!waitForAccess || isStableProfile || attempt === attempts - 1) {
          return data;
        }
      } else if (!waitForAccess) {
        setProfile(null);
        return null;
      }

      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    setProfile(lastProfile);
    return lastProfile;
  }

  async function refreshProfile() {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      console.error("Não foi possível atualizar a sessão:", error);
      return null;
    }

    setSession((current) => (current ? { ...current, user: data.user } : current));
    activeUserIdRef.current = data.user.id;

    setLoading(true);
    const nextProfile = await loadProfile(data.user.id, { waitForAccess: true });
    setLoading(false);
    return nextProfile;
  }

  async function endRecoveryFlow(nextNotice = null, scope = "local") {
    try {
      await supabase.auth.signOut({ scope });
    } catch (error) {
      console.error("Não foi possível encerrar a sessão de recuperação:", error);
    } finally {
      clearAuthCallbackUrl();
      activeUserIdRef.current = null;
      setSession(null);
      setProfile(null);
      setAuthFlow(null);
      setAuthCallbackError(null);
      setAuthNotice(nextNotice);
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function init() {
      const callbackError = getAuthCallbackError();
      const callbackFlow = callbackError ? null : getAuthFlowFromLocation();

      if (callbackError) {
        setAuthCallbackError(callbackError);
        clearAuthCallbackUrl();
      }

      setAuthFlow(callbackFlow);

      const { data } = await supabase.auth.getSession();
      if (!active) return;

      setSession(data.session);
      activeUserIdRef.current = data.session?.user?.id || null;

      // A recuperação tem prioridade sobre qualquer Dashboard: o token desse
      // link só pode ser usado para trocar a senha.
      if (callbackFlow === "recovery") {
        setLoading(false);
        return;
      }

      if (data.session?.user?.id) {
        await loadProfile(data.session.user.id, { waitForAccess: true });
      }

      if (!active) return;

      if (callbackFlow === "confirm" && data.session?.user?.email_confirmed_at) {
        clearAuthCallbackUrl();
        setAuthFlow(null);
      }

      setLoading(false);
    }

    async function handleAuthEvent(event, newSession) {
      if (!active) return;

      const previousUserId = activeUserIdRef.current;
      const nextUserId = newSession?.user?.id || null;
      setSession(newSession);

      if (event === "PASSWORD_RECOVERY") {
        activeUserIdRef.current = nextUserId;
        setAuthCallbackError(null);
        setAuthNotice(null);
        setAuthFlow("recovery");
        setLoading(false);
        return;
      }

      // A renovação automática de token acontece ao voltar para a aba. Ela
      // não deve desmontar o Dashboard, pois isso apagava as abas abertas.
      if (event === "TOKEN_REFRESHED" && previousUserId === nextUserId) return;

      if (!nextUserId) {
        activeUserIdRef.current = null;
        setProfile(null);
        setLoading(false);
        return;
      }

      activeUserIdRef.current = nextUserId;
      const isSameUser = previousUserId === nextUserId;

      if (isSameUser) {
        if (event === "USER_UPDATED") {
          await loadProfile(nextUserId, { waitForAccess: true });

          if (getAuthFlowFromLocation() === "confirm" && newSession?.user?.email_confirmed_at) {
            clearAuthCallbackUrl();
            setAuthFlow(null);
          }
        }
        return;
      }

      setLoading(true);
      await loadProfile(nextUserId, { waitForAccess: true });

      if (!active) return;

      if (getAuthFlowFromLocation() === "confirm" && newSession?.user?.email_confirmed_at) {
        clearAuthCallbackUrl();
        setAuthFlow(null);
      }

      setLoading(false);
    }

    void init();

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      void handleAuthEvent(event, newSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (publicId || arenaId) {
    return <PublicArenaPage publicId={publicId} arenaId={arenaId} />;
  }

  if (publicMode && authFlow !== "recovery") {
    return <PublicPlatformHome session={session} />;
  }

  if (loading) {
    return (
      <div className="loadingPage">
        <div className="loadingCard">
          <div className="loadingSpinner" aria-hidden="true" />
          <p>Carregando Torneio 360...</p>
        </div>
      </div>
    );
  }

  if (authFlow === "recovery") {
    return (
      <Login
        key="password-recovery"
        initialMode="resetPassword"
        recoverySession={session}
        onRecoveryFinished={(notice) => endRecoveryFlow(notice, "global")}
        onRecoveryExit={() => endRecoveryFlow()}
      />
    );
  }

  if (!session && !wantsLogin && !authCallbackError && !authNotice) {
    return <PublicPlatformHome />;
  }

  if (!session) {
    return (
      <Login
        key="guest-login"
        initialMode={authCallbackError ? "forgotPassword" : "login"}
        initialNotice={authCallbackError || authNotice}
      />
    );
  }

  const sessionRole = String(session.user?.app_metadata?.role || "organizer").toLowerCase();
  if (["athlete", "visitor", "spectator"].includes(sessionRole)) {
    return <PublicPlatformHome session={session} />;
  }

  if (!profile) {
    return <ProfileUnavailable onRetry={refreshProfile} />;
  }

  if (isProfilePendingEmailConfirmation(profile)) {
    return (
      <EmailConfirmationPending
        email={session.user?.email}
        onRefresh={refreshProfile}
      />
    );
  }

  const today = getBrazilTodayISO();
  const expired = Boolean(profile.expires_at && profile.expires_at < today);
  const hasActivePeriod = !profile.expires_at || profile.expires_at >= today;
  const status = String(profile.status || "").toLowerCase();
  const isActive = status === "active";
  const isExplicitlyBlocked = ["blocked", "suspended", "inactive", "expired"].includes(status);

  if (!isActive && !expired && !isExplicitlyBlocked) {
    return <AccessPreparing onRetry={refreshProfile} />;
  }

  if (expired || !isActive || !hasActivePeriod) {
    return (
      <Blocked
        profile={profile}
        user={session.user}
        autoRedirect={status !== "suspended"}
      />
    );
  }

  return <Dashboard profile={profile} user={session.user} onProfileChange={setProfile} />;
}


function BeachLogo({ variant = "light" } = {}) {
  const logoSrc = variant === "blue" ? TORNEIO360_LOGO_BLUE : TORNEIO360_LOGO;

  return (
    <div className={`beachLogo torneio360Logo ${variant === "blue" ? "torneio360LogoBlue" : ""}`} aria-label="Torneio 360">
      <img src={logoSrc} alt="Torneio 360" />
    </div>
  );
}

function PlatformSupportLinks({ contacts = PLATFORM_SUPPORT, className = "", whatsappHref = "" }) {
  return (
    <div className={`supportContactGrid ${className}`.trim()}>
      {contacts.map(({ id, label, value, href, Icon, external }) => {
        const contactHref = id === "whatsapp" && whatsappHref ? whatsappHref : href;

        return (
          <a
            key={id}
            className={`supportContactLink supportContactLink-${id}`}
            href={contactHref}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            aria-label={`${label}: ${value}`}
          >
            <span className="supportContactIcon"><Icon aria-hidden="true" /></span>
            <span>
              <strong>{label}</strong>
              <small>{value}</small>
            </span>
          </a>
        );
      })}
    </div>
  );
}


function EmailConfirmationPending({ email, onRefresh }) {
  const [notice, setNotice] = useState(null);
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;

    const timer = setTimeout(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleResend() {
    if (!email || resending || cooldown > 0) return;

    setResending(true);
    try {
      const { error } = await resendEmailConfirmation(email);

      if (error) {
        setNotice({
          type: "error",
          title: "Não foi possível reenviar",
          message: getAuthErrorMessage(error, "Tente novamente em alguns minutos."),
        });
        return;
      }

      setCooldown(60);
      setNotice({
        type: "success",
        title: "E-mail reenviado",
        message: "Abra o link recebido para confirmar seu endereço e iniciar os 7 dias grátis.",
      });
    } catch (error) {
      console.error(error);
      setNotice({
        type: "error",
        title: "Não foi possível reenviar",
        message: "Verifique sua conexão e tente novamente.",
      });
    } finally {
      setResending(false);
    }
  }

  async function handleCheck() {
    if (checking) return;

    setChecking(true);
    try {
      const nextProfile = await onRefresh();

      if (!nextProfile || isProfilePendingEmailConfirmation(nextProfile)) {
        setNotice({
          type: "warning",
          title: "Confirmação ainda pendente",
          message: "Depois de abrir o link no e-mail, toque em “Já confirmei meu e-mail” novamente.",
        });
      }
    } catch (error) {
      console.error(error);
      setNotice({
        type: "error",
        title: "Não foi possível atualizar",
        message: "Verifique sua conexão e tente novamente.",
      });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="authStatusPage">
      <NoticeModal notice={notice} onClose={() => setNotice(null)} />

      <section className="authStatusCard" aria-labelledby="email-confirmation-title">
        <div className="authStatusIcon" aria-hidden="true">✉️</div>
        <span className="authStatusEyebrow">Confirmação necessária</span>
        <h1 id="email-confirmation-title">Confirme seu e-mail</h1>
        <p>
          Enviamos um link de confirmação para <strong>{email || "seu e-mail"}</strong>. O teste Premium de {TRIAL_DAYS} dias só começa depois dessa confirmação.
        </p>

        <div className="authStatusActions">
          <button type="button" onClick={handleCheck} disabled={checking}>
            {checking ? "Conferindo..." : "Já confirmei meu e-mail"}
          </button>
          <button type="button" className="secondaryBtn" onClick={handleResend} disabled={resending || cooldown > 0}>
            {resending ? "Reenviando..." : cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar confirmação"}
          </button>
        </div>

        <button type="button" className="linkBtn authStatusSignOut" onClick={logout}>
          Sair da conta
        </button>
      </section>
    </div>
  );
}


function ProfileUnavailable({ onRetry }) {
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    if (retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="authStatusPage">
      <section className="authStatusCard" aria-labelledby="profile-unavailable-title">
        <div className="authStatusIcon" aria-hidden="true">⏳</div>
        <span className="authStatusEyebrow">Conta em preparação</span>
        <h1 id="profile-unavailable-title">Estamos preparando seu acesso</h1>
        <p>
          Sua conta foi identificada, mas o perfil ainda não ficou disponível. Isso costuma levar apenas alguns segundos.
        </p>

        <div className="authStatusActions">
          <button type="button" onClick={handleRetry} disabled={retrying}>
            {retrying ? "Conferindo..." : "Tentar novamente"}
          </button>
        </div>

        <button type="button" className="linkBtn authStatusSignOut" onClick={logout}>
          Sair da conta
        </button>
      </section>
    </div>
  );
}


function openOrganizerAccess() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "acesso";
  url.searchParams.set("entrar", "1");
  window.location.assign(url.toString());
}

function openOrganizerPanel() {
  const url = new URL(window.location.origin);
  window.location.assign(url.toString());
}

function PublicArenaDirectorySection({ title = "Encontre uma arena", description = "Acompanhe torneios, circuitos, jogos e rankings sem precisar fazer login." }) {
  const [arenas, setArenas] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let requestInFlight = false;
    let hasSuccessfulLoad = false;

    async function loadArenas({ silent = false } = {}) {
      if (requestInFlight) return;
      requestInFlight = true;
      if (!silent) setLoading(true);

      try {
        const result = await fetchPublicArenaDirectory({ limit: 250 });
        if (!active) return;
        if (result.error) {
          if (!hasSuccessfulLoad) setError("Não foi possível carregar as arenas agora.");
          return;
        }

        hasSuccessfulLoad = true;
        setArenas((result.data || []).filter((arena) => arena?.id));
        setError("");
      } finally {
        requestInFlight = false;
        if (active) setLoading(false);
      }
    }

    void loadArenas();

    const refreshArenas = () => void loadArenas({ silent: true });
    const refreshVisibleArenas = () => {
      if (document.visibilityState === "visible") refreshArenas();
    };
    const handleVisibilityChange = () => {
      refreshVisibleArenas();
    };
    const refreshTimer = window.setInterval(refreshVisibleArenas, ARENA_DIRECTORY_REFRESH_INTERVAL_MS);

    window.addEventListener("focus", refreshArenas);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshArenas);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const filteredArenas = arenas.filter((arena) => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return true;
    return [arena.arena_name, arena.name, arena.city, arena.state]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(term));
  });

  return (
    <section id="arenas" className="publicArenaDirectorySection">
      <div className="publicDirectoryHeading">
        <span>Aberto para todos</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <label className="publicArenaSearch">
        <span className="srOnly">Pesquisar arenas</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Busque por arena, organizador, cidade ou estado"
        />
        <span aria-hidden="true">🔎</span>
      </label>

      {loading ? (
        <div className="publicDirectoryState">Carregando arenas...</div>
      ) : error ? (
        <div className="publicDirectoryState publicDirectoryError">{error}</div>
      ) : filteredArenas.length === 0 ? (
        <div className="publicDirectoryState">Nenhuma arena encontrada.</div>
      ) : (
        <div className="publicArenaDirectoryGrid">
          {filteredArenas.map((arena) => {
            const arenaName = arena.arena_name || arena.name || "Arena Torneio360";
            return (
              <article className="publicArenaDirectoryCard" key={arena.id}>
                <div className="publicArenaDirectoryPhoto">
                  {arena.photo_url ? (
                    <img src={arena.photo_url} alt={`Foto de ${arenaName}`} />
                  ) : (
                    <span>{arenaName.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="publicArenaDirectoryInfo">
                  <small>Perfil da arena</small>
                  <h3>{arenaName}</h3>
                  <p className="publicArenaDirectoryOrganizer"><UserRound aria-hidden="true" /> Organizador: {arena.name || "Não informado"}</p>
                  <p className="publicArenaDirectoryLocation"><MapPin aria-hidden="true" /> {[arena.city, arena.state].filter(Boolean).join("/") || "Local não informado"}</p>
                </div>
                <button type="button" onClick={() => window.location.assign(getArenaPublicUrl(arena.id))}>
                  Ver perfil e eventos
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PublicPlatformHome({ session = null }) {
  return (
    <div className="publicPlatformHome">
      <header className="publicPlatformTopbar">
        <div className="landingBrand">
          <BeachLogo />
          <div className="brandTaglineOnly"><span>{TORNEIO360_TAGLINE}</span></div>
        </div>
        <div className="publicPlatformActions">
          <a href="#arenas">Explorar arenas</a>
          <button type="button" onClick={session ? openOrganizerPanel : openOrganizerAccess}>
            {session ? "Painel do organizador" : "Entrar ou criar conta"}
          </button>
        </div>
      </header>

      <main className="publicPlatformMain">
        <section className="publicPlatformHero">
          <div>
            <span className="publicPlatformEyebrow">Torneios ao vivo, sem barreiras</span>
            <h1>Acompanhe sua arena sem fazer login</h1>
            <p>Consulte eventos ativos e encerrados, rodadas, resultados, chaves e rankings diretamente no Torneio360.</p>
            <a href="#arenas" className="publicPlatformHeroButton">Encontrar uma arena</a>
          </div>
          <div className="publicPlatformHeroMark" aria-hidden="true">
            <Trophy />
            <strong>360°</strong>
            <span>Toda a competição em um só lugar</span>
          </div>
        </section>

        <PublicArenaDirectorySection />

        <section className="publicOrganizerCallout">
          <div>
            <span>Para organizadores</span>
            <h2>Crie torneios e circuitos com 7 dias grátis</h2>
            <p>A visualização é aberta para todos. A criação e a administração dos eventos ficam disponíveis para assinantes.</p>
          </div>
          <button type="button" onClick={session ? openOrganizerPanel : openOrganizerAccess}>
            {session ? "Ir para o painel" : "Começar agora"}
          </button>
        </section>

        <section className="publicPlatformSupport">
          <div><span>Atendimento</span><h2>Fale com o Torneio360</h2></div>
          <PlatformSupportLinks />
        </section>
      </main>
    </div>
  );
}

function Login({
  initialMode = "login",
  initialNotice = null,
  recoverySession = null,
  onRecoveryFinished,
  onRecoveryExit,
} = {}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState(initialMode);
  const [notice, setNotice] = useState(() => {
    if (!initialNotice) return null;
    return typeof initialNotice === "string"
      ? { type: "error", title: "Link inválido ou expirado", message: initialNotice }
      : initialNotice;
  });
  const [submitting, setSubmitting] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;

    const timer = setTimeout(() => setResendCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (mode !== "resetPassword") return undefined;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById("acesso")?.scrollIntoView({ behavior: "auto", block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [mode]);

  function showNotice(type, title, message) {
    setNotice({ type, title, message });
  }

  function resetForm() {
    setFirstName("");
    setLastName("");
    setBirthDate("");
    setEmail("");
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  function changeMode(nextMode) {
    if (mode === "resetPassword" && onRecoveryExit) {
      void onRecoveryExit();
      return;
    }

    setNotice(null);
    setMode(nextMode);
  }

  async function handleResendVerification() {
    const emailToResend = normalizeEmail(pendingVerificationEmail || email);
    if (!emailToResend || resendCooldown > 0) return;

    setSubmitting(true);
    try {
      const { error } = await resendEmailConfirmation(emailToResend);

      if (error) {
        showNotice("error", "Não foi possível reenviar", getAuthErrorMessage(error, "Tente novamente em alguns minutos."));
        return;
      }

      setResendCooldown(60);
      showNotice("success", "E-mail reenviado", "Confira sua caixa de entrada e abra o link para iniciar os 7 dias grátis.");
    } catch (error) {
      console.error(error);
      showNotice("error", "Não foi possível reenviar", "Verifique sua conexão e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (submitting) return;

    const normalizedEmail = normalizeEmail(email);

    if (mode === "resetPassword") {
      if (!recoverySession?.access_token) {
        showNotice("error", "Link inválido ou expirado", "Peça um novo link de recuperação para trocar sua senha.");
        return;
      }

      if (!newPassword) {
        showNotice("warning", "Nova senha obrigatória", "Digite sua nova senha para continuar.");
        return;
      }

      if (newPassword.length < 8) {
        showNotice("warning", "Senha muito curta", "Use pelo menos 8 caracteres na nova senha.");
        return;
      }

      if (newPassword !== confirmPassword) {
        showNotice("warning", "Senhas diferentes", "Repita exatamente a nova senha para confirmar.");
        return;
      }
    } else {
      if (!normalizedEmail) {
        showNotice("warning", "E-mail obrigatório", "Informe seu e-mail para continuar.");
        return;
      }

      if (!isValidEmail(normalizedEmail)) {
        showNotice("warning", "E-mail inválido", "Informe um e-mail válido para continuar.");
        return;
      }

      if (mode !== "forgotPassword" && !password) {
        showNotice("warning", "Senha obrigatória", "Digite sua senha para continuar.");
        return;
      }

      if (mode === "signup") {
        if (!firstName.trim()) {
          showNotice("warning", "Nome obrigatório", "Informe seu nome para criar a conta.");
          return;
        }

        if (!lastName.trim()) {
          showNotice("warning", "Sobrenome obrigatório", "Informe seu sobrenome para criar a conta.");
          return;
        }

        if (!birthDate) {
          showNotice("warning", "Data de nascimento obrigatória", "Informe sua data de nascimento.");
          return;
        }

        if (birthDate > getBrazilTodayISO()) {
          showNotice("warning", "Data de nascimento inválida", "A data de nascimento não pode estar no futuro.");
          return;
        }

        if (password.length < 8) {
          showNotice("warning", "Senha muito curta", "Use uma senha com pelo menos 8 caracteres.");
          return;
        }

        if (password !== confirmPassword) {
          showNotice("warning", "Senhas diferentes", "Repita exatamente a senha para confirmar.");
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      if (mode === "forgotPassword") {
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: getAuthRedirectUrl("recovery"),
        });

        if (error) {
          showNotice("error", "Não foi possível enviar", getAuthErrorMessage(error, "Tente novamente em alguns minutos."));
        } else {
          showNotice(
            "success",
            "Confira seu e-mail",
            "Se existir uma conta para esse endereço, você receberá um link para criar uma nova senha."
          );
          setMode("login");
        }
        return;
      }

      if (mode === "resetPassword") {
        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (userError || !userData?.user) {
          showNotice("error", "Link inválido ou expirado", "Peça um novo link de recuperação para trocar sua senha.");
          return;
        }

        const { error } = await supabase.auth.updateUser({ password: newPassword });

        if (error) {
          showNotice("error", "Senha não alterada", getAuthErrorMessage(error, "Abra novamente o link recebido por e-mail e tente de novo."));
        } else {
          resetForm();
          await onRecoveryFinished?.({
            type: "success",
            title: "Senha alterada",
            message: "Sua senha foi alterada. Entre com a nova senha para continuar.",
          });
        }
        return;
      }

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (error) {
          if (isEmailNotConfirmedError(error)) {
            setPendingVerificationEmail(normalizedEmail);
            showNotice(
              "warning",
              "Confirme seu e-mail",
              "Abra o link enviado para seu e-mail antes de entrar. Se precisar, reenviamos a confirmação abaixo."
            );
          } else {
            showNotice("error", "Não foi possível entrar", "Confira o e-mail e a senha informados e tente novamente.");
          }
        }
        return;
      }

      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl("confirm"),
          data: {
            name: fullName,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            birth_date: birthDate,
          },
        },
      });

      if (error) {
        console.error(error);

        if (isUserAlreadyRegisteredError(error)) {
          setFirstName("");
          setLastName("");
          setBirthDate("");
          setPassword("");
          setConfirmPassword("");
          setPendingVerificationEmail("");
          setMode("login");
          showNotice(
            "warning",
            "Este e-mail já possui uma conta",
            "Digite sua senha para entrar. Se não lembrar, clique em “Esqueci minha senha?”."
          );
          return;
        }

        showNotice("error", "Cadastro não concluído", getAuthErrorMessage(error, "Verifique os dados e tente novamente."));
        return;
      }

      const existingAccountResponse = Array.isArray(data?.user?.identities) && data.user.identities.length === 0;
      const confirmationRequired = !data?.session;

      setPendingVerificationEmail(normalizedEmail);
      resetForm();
      setMode("login");
      showNotice(
        "success",
        confirmationRequired || existingAccountResponse ? "Confira seu e-mail" : "Conta criada",
        confirmationRequired || existingAccountResponse
          ? "Se este endereço puder receber confirmações, enviamos um link. Abra-o para ativar sua conta e iniciar os 7 dias grátis."
          : "Sua conta foi criada e os 7 dias grátis do plano Premium já estão ativos."
      );
    } catch (error) {
      console.error(error);
      showNotice("error", "Não foi possível concluir", "Verifique sua conexão e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="landingPage">
      <NoticeModal notice={notice} onClose={() => setNotice(null)} />

      <header className="landingHeader">
        <div className="landingBrand">
          <BeachLogo />
          <div className="brandTaglineOnly">
            <span>{TORNEIO360_TAGLINE}</span>
          </div>
        </div>

        <nav className="landingNav">
          <a href="#como-funciona">Como funciona</a>
          <a href="#planos">Planos</a>
          <a href="#modalidades">Modalidades</a>
          <a href="#contato">Contato</a>
        </nav>

        <div className="landingHeaderActions">
          <button
            type="button"
            className="secondaryBtn"
            onClick={() => {
              changeMode("login");
              setTimeout(() => {
                document.getElementById("acesso")?.scrollIntoView({ behavior: "smooth" });
              }, 50);
            }}
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => {
              changeMode("signup");
              setTimeout(() => {
                document.getElementById("acesso")?.scrollIntoView({ behavior: "smooth" });
              }, 50);
            }}
          >
            Criar conta
          </button>
        </div>
      </header>

      <main>
        <section className="landingTrialBanner" aria-labelledby="landing-trial-title">
          <div className="landingTrialSeal" aria-hidden="true">
            <Gift />
            <strong>7</strong>
            <span>dias grátis</span>
          </div>

          <div className="landingTrialCopy">
            <span>Oferta para novos usuários</span>
            <h2 id="landing-trial-title">Experimente o plano Premium completo por 7 dias</h2>
            <p>Crie sua conta e confirme o e-mail para liberar seu período gratuito.</p>
            <div className="landingTrialBenefits" aria-label="Benefícios do teste grátis">
              <span>Todos os formatos Premium</span>
              <span>Rankings e tabelas automáticas</span>
              <span>Começa após confirmar o e-mail</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              changeMode("signup");
              document.getElementById("acesso")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Começar teste grátis
          </button>
        </section>

        <section className="landingHero">
          <div className="heroContent">
            <div className="heroBadge">
              🎾 Gestão de torneios com cara de arena profissional
            </div>

            <h1>Sua arena com torneios, rankings e experiência profissional</h1>

            <p>
              Monte torneios de Beach Tennis com visual moderno, controle de jogos, rankings automáticos, chamada por voz e uma área pública pronta para encantar atletas e organizadores.
            </p>

            <div className="heroActions">
              <button
                type="button"
                onClick={() => {
                  changeMode("signup");
                  document.getElementById("acesso")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Começar agora
              </button>

              <button
                type="button"
                className="secondaryBtn"
                onClick={() => {
                  changeMode("login");
                  document.getElementById("acesso")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Já tenho conta
              </button>
            </div>

            <div className="heroHighlights">
              <span>🏟️ Gestão para arenas</span>
              <span>🏆 Torneios e copas</span>
              <span>📊 Ranking em tempo real</span>
            </div>
          </div>

          <div className="heroVisual">
            <div className="sandCard">
              <div className="sandSun"></div>

              <div className="racketMark">
                <span>🎾</span>
              </div>

              <div className="mockPanel">
                <div className="mockTop">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>

                <div className="mockTitle">Arena Central · Rodada 1</div>

                <div className="mockGame">
                  <strong>Quadra 1</strong>
                  <p>João + Pedro  4 x 2  Lucas + Marcos</p>
                </div>

                <div className="mockGame">
                  <strong>Quadra 2</strong>
                  <p>Ana + Carla  3 x 4  Júlia + Fernanda</p>
                </div>

                <button type="button" className="mockVoiceBtn">
                  🔊 Anunciar próximos jogos
                </button>
              </div>
            </div>
          </div>
        </section>

                <section id="como-funciona" className="landingSection">
          <div className="sectionIntro">
            <span>Como funciona</span>
            <h2>Da inscrição ao pódio, tudo em uma plataforma</h2>
            <p>
              A plataforma foi pensada para a realidade de quem organiza torneios de Beach Tennis e precisa de agilidade, clareza e apresentação profissional.
            </p>
          </div>

          <div className="stepsGrid">
            <div className="stepCard">
              <div>1</div>
              <h3>Cadastre a arena</h3>
              <p>Use sua conta para centralizar os torneios da arena, clube ou organizador.</p>
            </div>

            <div className="stepCard">
              <div>2</div>
              <h3>Escolha o formato</h3>
              <p>
                Selecione Super 6, Super 8, Super 12, modalidades mistas, Simples, Copa 18, Torneio modelo Campeonato Cearense ou Modelo Torneio 360 conforme a realidade do evento.
              </p>
            </div>

            <div className="stepCard">
              <div>3</div>
              <h3>Gere a tabela</h3>
              <p>Informe os participantes, sorteie nomes e deixe o sistema montar os jogos.</p>
            </div>

            <div className="stepCard">
              <div>4</div>
              <h3>Entregue uma experiência premium</h3>
              <p>Preencha placares, acompanhe rankings e anuncie jogos com aparência profissional.</p>
            </div>
          </div>
        </section>

        <section className="landingSection featuresSection">
          <div className="sectionIntro">
            <span>Recursos</span>
            <h2>Tudo que sua arena precisa para rodar campeonatos</h2>
          </div>

          <div className="featuresGrid">
            <div className="featureCard">
              <span>🎲</span>
              <h3>Sorteio automático</h3>
              <p>Embaralhe nomes e duplas com animação antes de gerar a tabela.</p>
            </div>

            <div className="featureCard">
              <span>📅</span>
              <h3>Tabelas automáticas</h3>
              <p>O sistema gera rodadas conforme o formato escolhido.</p>
            </div>

            <div className="featureCard">
              <span>📊</span>
              <h3>Ranking configurável</h3>
              <p>Escolha a ordem dos critérios entre vitórias, total de games e saldo de games.</p>
            </div>

            <div className="featureCard">
              <span>🔊</span>
              <h3>Chamada de jogos</h3>
              <p>Anuncie rodada, quadra e nomes dos atletas usando voz pelo navegador.</p>
            </div>

            <div className="featureCard">
              <span>💾</span>
              <h3>Salvamento automático</h3>
              <p>Os dados ficam salvos automaticamente na conta do organizador.</p>
            </div>

            <div className="featureCard">
              <span>🏆</span>
              <h3>Copa Premium</h3>
              <p>Formato de Copa com 18 duplas, grupos, chaves finais e disputa paralela.</p>
            </div>
          </div>
        </section>

        <section id="planos" className="landingSection">
          <div className="sectionIntro">
            <span>Planos</span>
            <h2>Escolha o plano ideal para seus torneios</h2>
          </div>

          <div className="plansGrid plansGridThree landingPlans">
            <PlanCard
              title="Basic"
              tag="Entrada"
              price="R$ 19,90"
              text="Para começar com torneios individuais e mistos."
              items={[
                "Super 8",
                "Super 12",
                "Super 10 mista",
                "Super 12 mista",
                "Super 16 mista",
                "Super 20 mista",
                "Gerencie apenas 1 campeonato por vez",
                "Sorteio automático",
              ]}
            />

            <PlanCard
              title="Pro"
              tag="Organizador"
              badge="Mais usado"
              price="R$ 39,90"
              text="Para organizadores que precisam de modalidades com duplas fixas."
              items={[
                "Super 6 (dupla fixa)",
                "Super 8",
                "Super 8 (dupla fixa)",
                "Super 12",
                "Super 10 mista",
                "Super 12 mista",
                "Super 16 mista",
                "Super 20 mista",
                "Gerencie vários campeonatos ao mesmo tempo",
              ]}
            />

            <PlanCard
              title="Premium"
              tag="Completo"
              price="R$ 59,90"
              text="Para quem quer liberar todos os formatos disponíveis."
              items={[
                "Super 6 (dupla fixa)",
                "Super 8",
                "Super 8 (dupla fixa)",
                "Super 12",
                "Super 10 mista",
                "Super 12 mista",
                "Super 16 mista",
                "Super 20 mista",
                "Simples (1 contra 1 por jogo)",
                "Copa - 18 duplas",
                "Torneio modelo Campeonato Cearense",
                "Gerencie vários campeonatos ao mesmo tempo",
              ]}
            />
          </div>
        </section>

        <section id="modalidades" className="landingSection">
          <div className="sectionIntro">
            <span>Modalidades</span>
            <h2>Formatos disponíveis na plataforma</h2>
            <p>Clique em “Como funciona?” para ver a explicação de cada formato.</p>
          </div>

          <div className="modalitiesGrid landingModalities">
            <Info
              title="Super 6 (dupla fixa)"
              text="Formato com 6 duplas já definidas antes do início do campeonato. Diferente das modalidades aleatórias, aqui os parceiros permanecem juntos do começo ao fim. O sistema gera automaticamente os confrontos entre as duplas, organiza a sequência de jogos e calcula a classificação geral pelos placares lançados. É indicado quando os atletas já se inscrevem em dupla e querem disputar como equipe fixa."
            />

            <Info
              title="Super 8"
              text="Formato individual com 8 participantes, ideal para torneios rápidos. Cada atleta joga com parceiros diferentes ao longo das rodadas, evitando que uma dupla fixa determine todo o resultado. O sistema monta os confrontos automaticamente, organiza as quadras, registra os placares e calcula o ranking individual. No final, vence quem tiver melhor desempenho geral conforme os critérios definidos, como vitórias, total de games e saldo de games."
            />

            <Info
              title="Super 8 (dupla fixa)"
              text="Formato com 8 duplas fixas, indicado para torneios maiores em que cada equipe permanece igual durante toda a competição. O sistema organiza os jogos entre as duplas, distribui as rodadas e registra os resultados. A classificação é por dupla, não individual. Conforme os placares são preenchidos, o ranking geral é atualizado com vitórias, total de games e saldo de games, ajudando o organizador a acompanhar quem está avançando melhor."
            />

            <Info
              title="Super 12"
              text="Formato individual com 12 participantes escolhidos livremente pelo organizador, sem exigência de gênero. São 11 rodadas em 3 quadras, sem descanso: cada atleta forma dupla uma vez com cada um dos outros participantes e enfrenta cada adversário exatamente duas vezes. Todos aparecem juntos em um único ranking geral."
            />

            <Info
              title="Super 10 mista"
              text="Formato com 5 homens e 5 mulheres. São 5 rodadas, 2 jogos por rodada, e em cada rodada descansam 1 homem e 1 mulher. Todos jogam 4 partidas e descansam 1 vez. O ranking é separado masculino e feminino."
            />

            <Info
              title="Super 12 mista"
              text="Formato misto com 12 participantes: 6 homens e 6 mulheres. Primeiro, os atletas são cadastrados e sorteados. Depois, o sistema combina os participantes para formar duplas mistas em diferentes rodadas, mantendo equilíbrio entre homens e mulheres. Cada jogador participa de jogos com combinações variadas, e o desempenho é calculado individualmente. É uma boa opção para eventos sociais e competitivos com rotação de parceiros."
            />

            <Info
              title="Super 16 mista"
              text="Formato misto com 16 participantes: 8 homens e 8 mulheres. Funciona como uma versão maior do Super 12 mista, com mais atletas, mais jogos e maior movimentação de quadras. O sistema monta as duplas mistas de forma organizada, distribui as partidas e permite preencher os placares rodada por rodada. O ranking é individual, ou seja, cada atleta pontua pelo próprio desempenho, mesmo jogando com parceiros diferentes durante o torneio."
            />

            <Info
              title="Super 20 mista"
              text="Formato misto com 20 participantes: 10 homens e 10 mulheres. São 10 rodadas em 5 quadras. Cada homem forma dupla exatamente uma vez com cada mulher, e vice-versa, em uma tabela matemática fixa que reduz ao máximo a repetição de adversários. O desempenho é individual, com rankings masculino e feminino."
            />

            <Info
              title="Simples (1 contra 1 por jogo)"
              text="Formato individual para 4, 6, 8, 10, 12 ou 14 jogadores, sem formação de duplas. O organizador escolhe a quantidade e o sistema monta automaticamente todos contra todos, com cada atleta enfrentando cada adversário exatamente uma vez e sem folgas nas rodadas. Os placares alimentam um ranking geral individual por vitórias, total de games e saldo de games."
            />

            <Info
              title="Copa - 18 duplas"
              text="Formato de Copa com 18 duplas, dividido em 6 grupos de 3 duplas. Cada grupo joga sua fase classificatória, e o sistema calcula a classificação com base nos critérios definidos. Os melhores avançam para a chave principal; os 2 melhores gerais podem receber BYE, entrando em fase mais avançada. Também há disputa paralela para duplas específicas, como terceiros colocados, permitindo manter mais atletas em atividade. É um formato ideal para torneios grandes, com organização mais profissional e várias fases."
            />

            <Info
              title="Torneio modelo Campeonato Cearense"
              text="Formato para 4 a 32 duplas, com fase de grupos, Eliminatória Principal para os dois primeiros de cada grupo e Disputa Paralela para os demais. As comparações entre grupos usam percentual de vitórias, saldo médio e média de games para equilibrar grupos de tamanhos diferentes."
            />

            <Info
              title="Modelo Torneio 360"
              text="Mantém a fase de grupos e os critérios do modelo Campeonato Cearense, mas acrescenta uma segunda oportunidade: as duplas derrotadas somente na primeira fase efetivamente jogada da Eliminatória Principal também entram na Disputa Paralela. Elas são ordenadas pela qualidade da derrota e recebem prioridade na montagem da nova chave."
            />
          </div>
        </section>

        <section id="contato" className="landingSection landingSupportSection">
          <div className="landingSupportShell">
            <div className="landingSupportIntro">
              <span>Atendimento</span>
              <h2>Fale diretamente com o Torneio360</h2>
              <p>Conheça os planos, regularize seu acesso ou peça ajuda pelo canal que preferir.</p>
              <div className="landingSupportHighlight">
                <MessageCircle aria-hidden="true" />
                <span><strong>Precisa falar agora?</strong> O WhatsApp é o caminho mais rápido.</span>
              </div>
            </div>

            <PlatformSupportLinks className="landingSupportContacts" />
          </div>
        </section>

        <section id="acesso" className="landingAccessSection">
          <div className="accessText">
            <span>Acesso</span>
            <h2>
              {mode === "login"
                ? "Entre na sua conta"
                : mode === "signup"
                  ? "Crie sua conta"
                  : mode === "forgotPassword"
                    ? "Redefinir senha"
                    : "Criar nova senha"}
            </h2>
            <p>
              {mode === "login"
                ? "Acesse seus torneios salvos e continue de onde parou."
                : mode === "signup"
                  ? "Confirme seu e-mail e ganhe 7 dias grátis no plano Premium."
                  : mode === "forgotPassword"
                    ? "Informe seu e-mail para receber o link de redefinição."
                    : "Crie uma nova senha com pelo menos 8 caracteres para voltar a acessar sua conta."}
            </p>
          </div>

          <div className="accessCard">
            <div className="accessToggle" aria-label="Escolha entre entrar ou criar uma conta">
              <button
                type="button"
                className={mode === "login" ? "active" : ""}
                onClick={() => changeMode("login")}
                aria-pressed={mode === "login"}
              >
                Login
              </button>

              <button
                type="button"
                className={mode === "signup" ? "active" : ""}
                onClick={() => changeMode("signup")}
                aria-pressed={mode === "signup"}
              >
                Criar conta
              </button>
            </div>

            {mode === "signup" ? (
              <div className="accessTrialCallout" role="status">
                <span className="accessTrialCalloutIcon"><Gift aria-hidden="true" /></span>
                <span>
                  <strong>Seu Premium começa com 7 dias grátis</strong>
                  <small>Confirme o e-mail depois do cadastro para ativar o teste.</small>
                </span>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} noValidate>
              {mode === "signup" && (
                <>
                  <div className="twoCols formTwoCols">
                    <div>
                      <label>Nome</label>
                      <input
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Seu nome"
                      />
                    </div>

                    <div>
                      <label>Sobrenome</label>
                      <input
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Seu sobrenome"
                      />
                    </div>
                  </div>

                  <label>Data de nascimento</label>
                  <input
                    className="clickableDateInput"
                    type="date"
                    autoComplete="bday"
                    value={birthDate}
                    onClick={(e) => e.currentTarget.showPicker?.()}
                    onFocus={(e) => e.currentTarget.showPicker?.()}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </>
              )}

              {mode !== "resetPassword" && (
                <>
                  <label>E-mail</label>
                  <input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                  />
                </>
              )}

              {mode === "resetPassword" ? (
                <>
                  <p className="authFormHint">
                    {recoverySession?.access_token
                      ? "A nova senha será aplicada somente à conta vinculada ao link de recuperação."
                      : "Este link não está mais válido. Volte ao login e peça um novo link de recuperação."}
                  </p>
                  <label>Nova senha</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo de 8 caracteres"
                  />

                  <label>Repita a nova senha</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Digite a nova senha novamente"
                  />
                </>
              ) : (
                mode !== "forgotPassword" && (
                  <>
                    <label>Senha</label>
                    <input
                      type="password"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "signup" ? "Mínimo de 8 caracteres" : "Digite sua senha"}
                    />

                    {mode === "signup" && (
                      <>
                        <label>Repita a senha</label>
                        <input
                          type="password"
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Digite a senha novamente"
                        />
                      </>
                    )}
                  </>
                )
              )}

              <button
                type="submit"
                disabled={submitting || (mode === "resetPassword" && !recoverySession?.access_token)}
                aria-busy={submitting}
              >
                {submitting
                  ? "Aguarde..."
                  : mode === "login"
                  ? "Entrar"
                  : mode === "signup"
                    ? "Criar conta"
                    : mode === "forgotPassword"
                      ? "Enviar link"
                      : "Salvar nova senha"}
              </button>

              {mode === "login" && (
                <button
                  type="button"
                  className="linkBtn"
                  onClick={() => changeMode("forgotPassword")}
                >
                  Esqueci minha senha
                </button>
              )}

              {mode === "login" && pendingVerificationEmail && (
                <div className="authVerificationHint" role="status">
                  <strong>Seu e-mail ainda não foi confirmado?</strong>
                  <span>Abra o link enviado para {pendingVerificationEmail} ou peça outro abaixo.</span>
                  <button
                    type="button"
                    className="linkBtn"
                    onClick={handleResendVerification}
                    disabled={submitting || resendCooldown > 0}
                  >
                    {resendCooldown > 0 ? `Reenviar em ${resendCooldown}s` : "Reenviar confirmação"}
                  </button>
                </div>
              )}

              {(mode === "forgotPassword" || mode === "resetPassword") && (
                <button
                  type="button"
                  className="linkBtn"
                  onClick={() => changeMode("login")}
                >
                  Voltar para o login
                </button>
              )}
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

function AccessPreparing({ onRetry }) {
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    if (retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void handleRetry();
    }, 900);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="accessPreparingPage">
      <div className="accessPreparingCard">
        <div className="accessPreparingSpinner" aria-hidden="true" />
        <h1>Estamos finalizando seu acesso</h1>
        <p>Estamos concluindo a criação do seu perfil. Tentamos atualizar automaticamente; se necessário, você também pode conferir o status abaixo.</p>
        <div className="accessPreparingActions">
          <button type="button" onClick={handleRetry} disabled={retrying}>
            {retrying ? "Conferindo..." : "Atualizar status"}
          </button>
          <button type="button" className="linkBtn" onClick={logout}>Sair</button>
        </div>
      </div>
    </div>
  );
}

function Blocked({ profile, user, autoRedirect = false }) {
  const regularizationUrl = getPlanRegularizationWhatsAppUrl(profile, user);

  useEffect(() => {
    if (!autoRedirect) return undefined;

    const timer = window.setTimeout(() => {
      window.location.assign(regularizationUrl);
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [autoRedirect, regularizationUrl]);

  return (
    <div className="blockedAccessPage">
      <main className="blockedAccessCard" aria-labelledby="blocked-access-title">
        <BeachLogo variant="blue" />

        <div className="blockedAccessIcon" aria-hidden="true"><MessageCircle /></div>
        <span className="blockedAccessEyebrow">Acesso e assinatura</span>
        <h1 id="blocked-access-title">Seu período gratuito terminou</h1>
        <p>Para continuar organizando seus torneios, fale com o Torneio360 e regularize o pagamento do seu plano.</p>

        <dl className="blockedAccessSummary">
          <div><dt>Plano</dt><dd>{profile.plan || "Não informado"}</dd></div>
          <div><dt>Status</dt><dd>{formatStatusBR(profile.status)}</dd></div>
          <div><dt>Vencimento</dt><dd>{profile.expires_at ? formatDateBR(profile.expires_at) : "Não definido"}</dd></div>
        </dl>

        {autoRedirect ? (
          <div className="blockedRedirectNotice" role="status" aria-live="polite">
            <span aria-hidden="true" />
            Abrindo o atendimento no WhatsApp...
          </div>
        ) : null}

        <a className="blockedWhatsappButton" href={regularizationUrl} target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden="true" />
          Regularizar pelo WhatsApp
        </a>

        <button
          type="button"
          className="secondaryBtn blockedBrowseButton"
          onClick={() => window.location.assign(`${window.location.origin}/?publico=1`)}
        >
          Explorar arenas sem administrar
        </button>

        <p className="blockedAccessFallback">Se o WhatsApp não abrir automaticamente, toque no botão acima.</p>

        <PlatformSupportLinks
          contacts={PLATFORM_SUPPORT.filter(({ id }) => id !== "whatsapp")}
          className="blockedAlternativeContacts"
        />

        <button type="button" className="blockedSignOutButton" onClick={logout}>Sair da conta</button>
      </main>
    </div>
  );
}

function FreeTrialNotice({ details }) {
  const isLastDay = details.daysRemaining === 1;
  const dayLabel = details.daysRemaining === 1 ? "dia" : "dias";

  return (
    <section
      className={`freeTrialNotice ${isLastDay ? "freeTrialNoticeLastDay" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Período gratuito"
    >
      <div className="freeTrialNoticeIcon" aria-hidden="true"><Gift /></div>

      <div className="freeTrialNoticeCopy">
        <span>Seu período gratuito está ativo</span>
        <strong>
          {isLastDay
            ? "Hoje é o seu último dia grátis"
            : `Você ainda tem ${details.daysRemaining} dias grátis`}
        </strong>
        <p>Plano Premium liberado até {formatDateBR(details.expiresAt)}.</p>
      </div>

      <div className="freeTrialNoticeDays" aria-hidden="true">
        <strong>{details.daysRemaining}</strong>
        <span>{dayLabel}</span>
      </div>
    </section>
  );
}

function TournamentWorkspaceTabs({
  tournaments,
  openTournamentIds,
  activeTournamentId,
  onSelectTournament,
  onCloseTournament,
}) {
  const [managerOpen, setManagerOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [closeTarget, setCloseTarget] = useState(null);
  const [busyTournamentId, setBusyTournamentId] = useState(null);
  const tabsViewportRef = useRef(null);
  const activeTabRef = useRef(null);

  const tournamentsById = useMemo(
    () => new Map((tournaments || []).map((tournament) => [tournament.id, tournament])),
    [tournaments]
  );
  const openTournaments = useMemo(
    () => (openTournamentIds || []).map((id) => tournamentsById.get(id)).filter(Boolean),
    [openTournamentIds, tournamentsById]
  );
  const filteredTournaments = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedSearch) return tournaments || [];
    return (tournaments || []).filter((tournament) => {
      const searchable = [
        tournament.name,
        getModalityDisplayName(tournament.type),
        tournament.data?.gender,
        tournament.data?.eventName,
      ].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
      return searchable.includes(normalizedSearch);
    });
  }, [searchValue, tournaments]);

  useEffect(() => {
    if (!activeTabRef.current) return;
    activeTabRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeTournamentId, openTournamentIds]);

  useEffect(() => {
    if (!managerOpen && !closeTarget) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      if (closeTarget) setCloseTarget(null);
      else setManagerOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [managerOpen, closeTarget]);

  async function selectTournament(tournament) {
    if (!tournament?.id || busyTournamentId) return;
    setBusyTournamentId(tournament.id);
    const opened = await onSelectTournament(tournament);
    setBusyTournamentId(null);
    if (opened !== false) {
      setManagerOpen(false);
      setSearchValue("");
    }
  }

  async function confirmCloseTournament() {
    if (!closeTarget || busyTournamentId) return;
    setBusyTournamentId(closeTarget.id);
    const closed = await onCloseTournament(closeTarget);
    setBusyTournamentId(null);
    if (closed !== false) setCloseTarget(null);
  }

  function scrollTabs(direction) {
    tabsViewportRef.current?.scrollBy({ left: direction * 320, behavior: "smooth" });
  }

  const activeTournament = tournamentsById.get(activeTournamentId);

  return (
    <>
      <nav className="tournamentWorkspaceTabsShell" aria-label="Torneios abertos">
        <div className="desktopTournamentTabs">
          <button
            type="button"
            className="tournamentTabsScrollButton"
            onClick={() => scrollTabs(-1)}
            aria-label="Ver torneios anteriores"
          >
            <ChevronLeft aria-hidden="true" />
          </button>

          <div className="openTournamentTabsViewport" ref={tabsViewportRef}>
            <div className="openTournamentTabsTrack">
              {openTournaments.map((tournament, tournamentIndex) => {
                const isActive = tournament.id === activeTournamentId;
                return (
                  <div
                    key={tournament.id}
                    ref={isActive ? activeTabRef : null}
                    className={`openTournamentTab ${isActive ? "active" : ""}`}
                    style={{ "--tournament-tab-color": getTournamentTabColor(tournament.id, tournamentIndex) }}
                  >
                    <button
                      type="button"
                      className="openTournamentTabMain"
                      onClick={() => selectTournament(tournament)}
                      title={tournament.name}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className="openTournamentTabDot" aria-hidden="true" />
                      <span className="openTournamentTabName">{tournament.name}</span>
                    </button>
                    <button
                      type="button"
                      className="openTournamentTabClose"
                      onClick={() => setCloseTarget(tournament)}
                      aria-label={`Remover ${tournament.name} das abas abertas`}
                      title="Remover da barra"
                    >
                      <X aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            className="tournamentTabsScrollButton"
            onClick={() => scrollTabs(1)}
            aria-label="Ver próximos torneios"
          >
            <ChevronRight aria-hidden="true" />
          </button>

          <button type="button" className="allOpenTournamentsButton" onClick={() => setManagerOpen(true)}>
            Todos <span>{openTournaments.length}</span>
          </button>
          <button type="button" className="addOpenTournamentButton" onClick={() => setManagerOpen(true)}>
            <PlusCircle aria-hidden="true" />
            <span>Adicionar torneio</span>
          </button>
        </div>

        <button type="button" className="mobileTournamentSwitcherButton" onClick={() => setManagerOpen(true)}>
          <span
            className="mobileTournamentSwitcherColor"
            style={{
              "--tournament-tab-color": getTournamentTabColor(
                activeTournamentId,
                Math.max(0, openTournaments.findIndex((tournament) => tournament.id === activeTournamentId))
              ),
            }}
            aria-hidden="true"
          />
          <span className="mobileTournamentSwitcherCopy">
            <small>Torneio atual</small>
            <strong>{activeTournament?.name || "Escolher torneio"}</strong>
          </span>
          <span className="mobileTournamentSwitcherCount">{openTournaments.length}</span>
          <ChevronDown aria-hidden="true" />
        </button>
      </nav>

      {managerOpen ? createPortal(
        <div className="tournamentTabsModalOverlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setManagerOpen(false);
        }}>
          <section className="tournamentTabsModal" role="dialog" aria-modal="true" aria-labelledby="open-tournaments-title">
            <header className="tournamentTabsModalHeader">
              <div>
                <span>Central de torneios</span>
                <h2 id="open-tournaments-title">Abrir ou trocar torneio</h2>
                <p>Os torneios permanecem salvos mesmo quando você os remove desta barra.</p>
              </div>
              <button type="button" onClick={() => setManagerOpen(false)} aria-label="Fechar">
                <X aria-hidden="true" />
              </button>
            </header>

            <label className="tournamentTabsSearch">
              <Search aria-hidden="true" />
              <input
                type="search"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Buscar por nome, modalidade ou categoria"
                autoFocus
              />
            </label>

            <div className="tournamentTabsModalList">
              {filteredTournaments.length ? filteredTournaments.map((tournament) => {
                const isOpen = openTournamentIds.includes(tournament.id);
                const isActive = tournament.id === activeTournamentId;
                const isBusy = tournament.id === busyTournamentId;
                const openIndex = openTournamentIds.indexOf(tournament.id);
                const tournamentIndex = Math.max(0, tournaments.findIndex((item) => item.id === tournament.id));
                return (
                  <article
                    key={tournament.id}
                    className={`tournamentTabsModalItem ${isActive ? "active" : ""}`}
                    style={{
                      "--tournament-tab-color": getTournamentTabColor(
                        tournament.id,
                        openIndex >= 0 ? openIndex : tournamentIndex
                      ),
                    }}
                  >
                    <span className="tournamentTabsModalItemColor" aria-hidden="true" />
                    <div className="tournamentTabsModalItemCopy">
                      <strong>{tournament.name}</strong>
                      <span>{getModalityDisplayName(tournament.type)}{tournament.data?.gender ? ` · ${tournament.data.gender}` : ""}</span>
                    </div>
                    {isOpen ? <span className="tournamentTabsOpenBadge">{isActive ? "Em uso" : "Aberto"}</span> : null}
                    <button type="button" onClick={() => selectTournament(tournament)} disabled={isBusy || isActive}>
                      {isBusy ? "Abrindo..." : isActive ? "Atual" : isOpen ? "Trocar" : "Adicionar"}
                    </button>
                  </article>
                );
              }) : (
                <div className="tournamentTabsEmpty">
                  <Trophy aria-hidden="true" />
                  <strong>Nenhum torneio encontrado</strong>
                  <span>Tente outro nome ou modalidade.</span>
                </div>
              )}
            </div>
          </section>
        </div>,
        document.body
      ) : null}

      {closeTarget ? createPortal(
        <div className="tournamentTabsModalOverlay tournamentTabCloseOverlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setCloseTarget(null);
        }}>
          <section className="tournamentTabCloseModal" role="dialog" aria-modal="true" aria-labelledby="close-tournament-tab-title">
            <span className="tournamentTabCloseIcon"><X aria-hidden="true" /></span>
            <h2 id="close-tournament-tab-title">Remover da barra?</h2>
            <p>
              <strong>{closeTarget.name}</strong> será fechado somente nesta central. O torneio não será apagado e continuará disponível no painel.
            </p>
            <div className="tournamentTabCloseActions">
              <button type="button" onClick={() => setCloseTarget(null)}>Cancelar</button>
              <button type="button" className="confirm" onClick={confirmCloseTournament} disabled={Boolean(busyTournamentId)}>
                {busyTournamentId ? "Salvando..." : "Remover da barra"}
              </button>
            </div>
          </section>
        </div>,
        document.body
      ) : null}
    </>
  );
}

function Dashboard({ profile, user, onProfileChange }) {
  const [tournaments, setTournaments] = useState([]);
  const [trashTournaments, setTrashTournaments] = useState([]);
  const [publicArenaProfiles, setPublicArenaProfiles] = useState([]);
  const [arenaProfileSearch, setArenaProfileSearch] = useState("");
  const [selectedArenaProfile, setSelectedArenaProfile] = useState(null);
  const [selectedArenaTournaments, setSelectedArenaTournaments] = useState([]);
  const [selectedArenaLoading, setSelectedArenaLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [networkOnline, setNetworkOnline] = useState(() => !isBrowserOffline());
  const [pendingSyncCount, setPendingSyncCount] = useState(() => listLocalTournamentDrafts(user.id).length);
  const [dashboardUsingOfflineCache, setDashboardUsingOfflineCache] = useState(false);
  const [openTournamentIds, setOpenTournamentIds] = useState(() => readOpenTournamentIds(user.id));
  const tournamentNavigationGuardRef = useRef(null);
  const openTournamentNavigationRef = useRef(readOpenTournamentNavigation(user.id));
  const publicArenaProfilesLoaderRef = useRef(null);
  const publicArenaProfilesInFlightRef = useRef(false);
  const publicArenaProfilesRequestRef = useRef(0);
  const publicArenaProfilesMountedRef = useRef(true);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
const [newGender, setNewGender] = useState("");
const [newMultiCategoryEvent, setNewMultiCategoryEvent] = useState("nao");
const [newCategorySchedules, setNewCategorySchedules] = useState([{
  category: "",
  date: "",
  endDate: "",
  registrationDeadline: "",
  time: "",
  type: "",
  location: "",
  winningScore: "4",
  rankingCriteria: "",
  coverImageUrl: "",
}]);
const [newDate, setNewDate] = useState("");
const [newEndDate, setNewEndDate] = useState("");
const [newRegistrationDeadline, setNewRegistrationDeadline] = useState("");
const [newEventStartTime, setNewEventStartTime] = useState("");
const [newDailyStartTimes, setNewDailyStartTimes] = useState({});
const [newDay, setNewDay] = useState("");
const [newLocation, setNewLocation] = useState("");
const [newCoverImageUrl, setNewCoverImageUrl] = useState("");
const [coverImageLoading, setCoverImageLoading] = useState(false);
const [newWinningScore, setNewWinningScore] = useState(4);
const [newRankingCriteria, setNewRankingCriteria] = useState("");
const [newPublicInfo, setNewPublicInfo] = useState({
  showArenaName: true,
  showOrganizerName: true,
  showWhatsapp: true,
  showWhatsappGroupLink: true,
  showInstagram: true,
  showAddress: true,
  showMapsLink: true,
  showCityState: true,
});
  const [saving, setSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const profileSaveSuccessTimerRef = useRef(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editEventGroup, setEditEventGroup] = useState(null);
  const [editEventGroupSaving, setEditEventGroupSaving] = useState(false);
  const [draggedTournamentId, setDraggedTournamentId] = useState(null);
  const [dragOverTournamentId, setDragOverTournamentId] = useState(null);
  const [createTournamentOpen, setCreateTournamentOpen] = useState(false);
  const [tournamentStatusFilter, setTournamentStatusFilter] = useState("active");
  const [createCircuitOpen, setCreateCircuitOpen] = useState(false);
  const [circuitStatusFilter, setCircuitStatusFilter] = useState("active");
  const [notice, setNotice] = useState(null);
  const [profileSubtab, setProfileSubtab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("perfil") || "publicacoes";
  });
  const [activePanel, setActivePanel] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("aba") || "inicio";
  });
  const [colorMode, setColorMode] = useState(() => {
    try {
      const savedMode = localStorage.getItem(`torneio360:color-mode:${user.id}`);
      if (savedMode === "light" || savedMode === "dark") return savedMode;
    } catch {
      // A preferência continua funcional durante a sessão mesmo sem armazenamento local.
    }

    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const [circuits, setCircuits] = useState([]);
  const tournamentsRef = useRef(tournaments);
  const trashTournamentsRef = useRef(trashTournaments);
  const circuitsRef = useRef(circuits);
  const selectedRef = useRef(selected);
  const dashboardLoadInFlightRef = useRef(false);
  const tournamentRealtimeEpochRef = useRef(0);
  const circuitRealtimeEpochRef = useRef(0);
  const [circuitForm, setCircuitForm] = useState({
    id: null,
    name: "",
    startDate: "",
    endDate: "",
    tournamentIds: [],
    rankingCriteria: defaultRankingCriteria,
    rankingCriteriaMode: "automatic",
  });
  const [circuitEditForm, setCircuitEditForm] = useState(null);
  const [circuitDeleteTarget, setCircuitDeleteTarget] = useState(null);
  const [expandedCircuitId, setExpandedCircuitId] = useState(null);
  const [restoredTournamentId, setRestoredTournamentId] = useState(null);
  const circuitPersistenceQueueRef = useRef(Promise.resolve());
  const appStateSaveTimerRef = useRef(null);
  const restoredAppStateRef = useRef(false);
  const appStateRestoreReadyRef = useRef(false);
  const pendingScrollRestoreRef = useRef(null);
  const scrollRestoreTimersRef = useRef([]);
  const initialAppRouteRef = useRef(`${window.location.pathname}${window.location.search}${window.location.hash || ""}`);
  const initialRouteIsExplicitRef = useRef(isExplicitAppRoute(initialAppRouteRef.current));

  useEffect(() => { tournamentsRef.current = tournaments; }, [tournaments]);
  useEffect(() => { trashTournamentsRef.current = trashTournaments; }, [trashTournaments]);
  useEffect(() => { circuitsRef.current = circuits; }, [circuits]);
  selectedRef.current = selected;

  function getRelativeAppRoute() {
    return `${window.location.pathname}${window.location.search}${window.location.hash || ""}`;
  }

  function isExplicitAppRoute(route) {
    try {
      const url = new URL(route, window.location.origin);
      const params = url.searchParams;

      return Boolean(
        params.get("torneio") ||
        params.get("tab") ||
        params.get("partidas") ||
        params.get("perfil") ||
        (params.get("aba") && params.get("aba") !== "inicio")
      );
    } catch {
      return false;
    }
  }

  function getStateRoute(state) {
    if (!state?.last_url || typeof state.last_url !== "string") return null;

    try {
      const url = new URL(state.last_url, window.location.origin);
      if (url.origin !== window.location.origin) return null;

      if (!url.searchParams.get("aba") && state.last_panel) url.searchParams.set("aba", state.last_panel);
      if (!url.searchParams.get("torneio") && state.last_tournament_id) url.searchParams.set("torneio", state.last_tournament_id);
      if (!url.searchParams.get("tab") && state.last_tournament_tab) url.searchParams.set("tab", state.last_tournament_tab);
      if (!url.searchParams.get("partidas") && state.last_matches_tab) url.searchParams.set("partidas", state.last_matches_tab);
      if (!url.searchParams.get("perfil") && state.last_profile_subtab) url.searchParams.set("perfil", state.last_profile_subtab);

      return `${url.pathname}${url.search}${url.hash || ""}`;
    } catch {
      return null;
    }
  }

  function areAppRoutesEqual(firstRoute, secondRoute) {
    try {
      const first = new URL(firstRoute, window.location.origin);
      const second = new URL(secondRoute, window.location.origin);

      if (first.pathname !== second.pathname || first.hash !== second.hash) return false;

      return ["aba", "torneio", "tab", "partidas", "perfil"].every(
        (key) => first.searchParams.get(key) === second.searchParams.get(key)
      );
    } catch {
      return false;
    }
  }

  function clearPendingScrollRestore() {
    scrollRestoreTimersRef.current.forEach((timer) => clearTimeout(timer));
    scrollRestoreTimersRef.current = [];
    pendingScrollRestoreRef.current = null;
  }

  function applyPendingScrollRestore() {
    const pending = pendingScrollRestoreRef.current;
    if (!pending || Date.now() > pending.expiresAt) {
      pendingScrollRestoreRef.current = null;
      return;
    }

    const maximumScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (pending.top > maximumScroll + 2) return;

    const scrollToSavedPosition = () => {
      if (pendingScrollRestoreRef.current?.token !== pending.token) return;
      window.scrollTo({ top: pending.top, left: 0, behavior: "auto" });
      pendingScrollRestoreRef.current = null;
      scrollRestoreTimersRef.current = [];
    };

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(scrollToSavedPosition);
    } else {
      scrollToSavedPosition();
    }
  }

  function queueScrollRestore(scrollY) {
    const top = Math.max(0, Math.round(Number(scrollY) || 0));
    const token = `${Date.now()}:${top}`;

    scrollRestoreTimersRef.current.forEach((timer) => clearTimeout(timer));
    scrollRestoreTimersRef.current = [];
    pendingScrollRestoreRef.current = {
      top,
      token,
      expiresAt: Date.now() + 3000,
    };

    scrollRestoreTimersRef.current = [setTimeout(applyPendingScrollRestore, 120)];
  }

  function applySavedAppState(state, { restoreRoute = false } = {}) {
    if (!state || typeof state !== "object") return false;

    const savedRoute = getStateRoute(state);
    const initialRoute = initialAppRouteRef.current;
    const routeMatchesInitial = savedRoute && areAppRoutesEqual(savedRoute, initialRoute);
    const canRestoreDetails = restoreRoute || routeMatchesInitial;

    if (restoreRoute && savedRoute) {
      window.history.replaceState(null, "", savedRoute);
    }

    if (!canRestoreDetails) return false;

    if (state.last_panel) setActivePanel(state.last_panel);
    if (state.last_profile_subtab) setProfileSubtab(state.last_profile_subtab);
    if (state.last_circuit_id) setExpandedCircuitId(state.last_circuit_id);

    const currentParams = new URLSearchParams(window.location.search);
    const tournamentId = state.last_tournament_id || currentParams.get("torneio");
    if (tournamentId) setRestoredTournamentId(tournamentId);

    if (state.scroll_y !== undefined && state.scroll_y !== null) {
      queueScrollRestore(state.scroll_y);
    }

    return true;
  }

  function updateAppUrl(next = {}) {
    const params = new URLSearchParams(window.location.search);

    if (next.activePanel) params.set("aba", next.activePanel);
    else if (!params.get("aba")) params.set("aba", activePanel || "inicio");

    if (Object.prototype.hasOwnProperty.call(next, "selectedTournamentId")) {
      if (next.selectedTournamentId) params.set("torneio", next.selectedTournamentId);
      else params.delete("torneio");
    }

    if (Object.prototype.hasOwnProperty.call(next, "profileSubtab")) {
      if (next.profileSubtab) params.set("perfil", next.profileSubtab);
      else params.delete("perfil");
    }

    if (Object.prototype.hasOwnProperty.call(next, "tournamentTab")) {
      if (next.tournamentTab) params.set("tab", next.tournamentTab);
      else params.delete("tab");
    }

    if (Object.prototype.hasOwnProperty.call(next, "matchesTab")) {
      if (next.matchesTab) params.set("partidas", next.matchesTab);
      else params.delete("partidas");
    }

    const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash || ""}`;
    window.history.replaceState(null, "", nextUrl);
    scheduleUserAppStateSave({
      activePanel: params.get("aba") || activePanel || "inicio",
      selectedTournamentId: params.get("torneio"),
      profileSubtab: params.get("perfil") || profileSubtab,
      circuitId: expandedCircuitId,
    });
  }

  function ensureCloudConnection(actionLabel = "concluir esta ação") {
    if (!isBrowserOffline()) return true;
    showNotice(
      "warning",
      "Sem conexão com a internet",
      `Para evitar um cadastro incompleto, reconecte-se antes de ${actionLabel}. As alterações feitas dentro de um torneio aberto continuam protegidas neste aparelho.`
    );
    return false;
  }

  async function guardSelectedTournamentBeforeLeaving() {
    if (!selected?.id || typeof tournamentNavigationGuardRef.current !== "function") return true;
    captureCurrentTournamentNavigation();
    const canLeave = await tournamentNavigationGuardRef.current();
    if (canLeave) tournamentNavigationGuardRef.current = null;
    return canLeave;
  }

  async function goToPanel(panel) {
    if (!await guardSelectedTournamentBeforeLeaving()) return;
    setSelected(null);
    setActivePanel(panel);
    updateAppUrl({ activePanel: panel, selectedTournamentId: null });
  }

  async function openProfileSection(nextSubtab = "editar") {
    if (!await guardSelectedTournamentBeforeLeaving()) return;
    setProfileMenuOpen(false);
    setSelected(null);
    setProfileSubtab(nextSubtab);
    setActivePanel("ajustes");
    updateAppUrl({ activePanel: "ajustes", selectedTournamentId: null, profileSubtab: nextSubtab });
  }

  function openProfileSettings() {
    void openProfileSection("editar");
  }

  function toggleColorMode() {
    setColorMode((currentMode) => currentMode === "dark" ? "light" : "dark");
  }

  useEffect(() => {
    saveOpenTournamentIds(user.id, openTournamentIds);
  }, [openTournamentIds, user.id]);

  useEffect(() => {
    if (!selected?.id) return;
    setOpenTournamentIds((currentIds) => currentIds.includes(selected.id)
      ? currentIds
      : [...currentIds, selected.id].slice(-50));
  }, [selected?.id]);

  useEffect(() => {
    if (!tournaments.length || !openTournamentIds.length) return;
    const availableIds = new Set(tournaments.map((tournament) => tournament.id));
    const validIds = openTournamentIds.filter((id) => availableIds.has(id));
    if (validIds.length !== openTournamentIds.length) setOpenTournamentIds(validIds);
  }, [tournaments, openTournamentIds]);

  useEffect(() => {
    try {
      localStorage.setItem(`torneio360:color-mode:${user.id}`, colorMode);
    } catch {
      // O tema permanece aplicado enquanto esta sessão estiver aberta.
    }

    const previousTheme = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = colorMode;

    return () => {
      if (previousTheme) document.documentElement.dataset.theme = previousTheme;
      else delete document.documentElement.dataset.theme;
    };
  }, [colorMode, user.id]);

  useEffect(() => {
    if (!profileMenuOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) setProfileMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    updateAppUrl({ activePanel });
  }, [activePanel]);

  useEffect(() => {
    if (selected || tournaments.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const tournamentId = restoredTournamentId || params.get("torneio");
    if (!tournamentId) return;

    const savedTournament = tournaments.find((item) => item.id === tournamentId);
    if (savedTournament) {
      setSelected(savedTournament);
      if (restoredTournamentId === savedTournament.id) setRestoredTournamentId(null);
    }
  }, [tournaments, selected, restoredTournamentId]);

  useEffect(() => {
    if (restoredAppStateRef.current) return;

    let cancelled = false;

    async function restoreUserAppState() {
      const localState = readLocalUserAppState(user.id);
      const restoreRoute = !initialRouteIsExplicitRef.current;
      const restoredLocally = applySavedAppState(localState, { restoreRoute });

      try {
        const { data, error } = await supabase
          .from("user_app_state")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (cancelled || error || !data?.last_url) return;

        // A cópia local é síncrona e costuma ser a mais recente ao voltar para
        // a mesma aba. O Supabase continua como recuperação entre dispositivos.
        if (!restoredLocally) {
          applySavedAppState(data, { restoreRoute });
        }

        if (!localState || getAppStateTimestamp(data) > getAppStateTimestamp(localState)) {
          saveLocalUserAppState(user.id, data);
        }
      } catch (error) {
        console.error("Erro ao restaurar posição do usuário", error);
      } finally {
        if (!cancelled) {
          restoredAppStateRef.current = true;
          appStateRestoreReadyRef.current = true;
        }
      }
    }

    restoreUserAppState();

    return () => { cancelled = true; };
  }, [user.id]);

  useEffect(() => {
    const saveNow = () => saveUserAppState();
    const saveWhenHidden = () => {
      if (document.visibilityState === "hidden") saveNow();
    };
    const saveAfterScroll = () => scheduleUserAppStateSave();
    const interval = setInterval(saveNow, 10000);
    window.addEventListener("pagehide", saveNow);
    window.addEventListener("beforeunload", saveNow);
    window.addEventListener("blur", saveNow);
    window.addEventListener("scroll", saveAfterScroll, { passive: true });
    document.addEventListener("visibilitychange", saveWhenHidden);

    return () => {
      saveNow();
      clearInterval(interval);
      window.removeEventListener("pagehide", saveNow);
      window.removeEventListener("beforeunload", saveNow);
      window.removeEventListener("blur", saveNow);
      window.removeEventListener("scroll", saveAfterScroll);
      document.removeEventListener("visibilitychange", saveWhenHidden);
    };
  }, [activePanel, selected?.id, expandedCircuitId, profileSubtab, user.id]);

  useEffect(() => {
    applyPendingScrollRestore();
  }, [activePanel, selected?.id, tournaments.length]);

  useEffect(() => () => clearPendingScrollRestore(), []);

  useEffect(() => {
    if (!appStateRestoreReadyRef.current) return;
    scheduleUserAppStateSave({
      profileSubtab,
      circuitId: expandedCircuitId,
    });
  }, [profileSubtab, expandedCircuitId]);

  async function saveUserAppState(extra = {}) {
    if (!appStateRestoreReadyRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const pendingScroll = pendingScrollRestoreRef.current;
    const scrollY = pendingScroll && Date.now() <= pendingScroll.expiresAt
      ? pendingScroll.top
      : Math.max(0, Math.round(window.scrollY || 0));
    const payload = {
      user_id: user.id,
      last_url: `${window.location.pathname}${window.location.search}${window.location.hash || ""}`,
      last_panel: extra.activePanel || activePanel || params.get("aba") || "inicio",
      last_tournament_id: extra.selectedTournamentId ?? params.get("torneio"),
      last_tournament_tab: extra.tournamentTab || params.get("tab"),
      last_matches_tab: extra.matchesTab || params.get("partidas"),
      last_circuit_id: extra.circuitId ?? expandedCircuitId,
      last_profile_subtab: extra.profileSubtab || profileSubtab,
      scroll_y: scrollY,
      updated_at: new Date().toISOString(),
    };

    saveLocalUserAppState(user.id, payload);

    try {
      const { error } = await supabase.from("user_app_state").upsert(payload, { onConflict: "user_id" });
      if (error) console.error("Erro ao salvar posição do usuário", error);
    } catch (error) {
      console.error("Erro ao salvar posição do usuário", error);
    }
  }

  function scheduleUserAppStateSave(extra = {}) {
    if (!appStateRestoreReadyRef.current) return;
    if (appStateSaveTimerRef.current) clearTimeout(appStateSaveTimerRef.current);
    appStateSaveTimerRef.current = setTimeout(() => saveUserAppState(extra), 700);
  }
  const [photoEditor, setPhotoEditor] = useState(null);
  const [profileEditing, setProfileEditing] = useState(false);

  const photoPointersRef = useRef(new Map());
  const photoPreviewRef = useRef(null);
  const photoCanvasRef = useRef(null);
  const lastPhotoDragRef = useRef(null);
  const lastPhotoPinchRef = useRef(null);
  const [organizerProfile, setOrganizerProfile] = useState(() => {
    const saved = localStorage.getItem(`organizerProfile:${user.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        localStorage.removeItem(`organizerProfile:${user.id}`);
      }
    }

    return {
      photoUrl: profile.photo_url || "",
      arenaName: profile.arena_name || "",
      organizerName: profile.name || "",
      email: user.email || "",
      whatsapp: profile.phone || "",
      address: profile.address || "",
      mapsLink: profile.maps_link || "",
      city: profile.city || "",
      state: profile.state || "",
      instagramHandle: profile.instagram_handle || "",
      instagramLink: profile.instagram_link || "",
      whatsappGroupLink: profile.whatsapp_group_link || "",
      isPublic: true,
    };
  });
  const organizerProfileBaseRef = useRef({
    photoUrl: profile.photo_url || "",
    arenaName: profile.arena_name || "",
    organizerName: profile.name || "",
    email: user.email || "",
    whatsapp: profile.phone || "",
    address: profile.address || "",
    mapsLink: profile.maps_link || "",
    city: profile.city || "",
    state: profile.state || "",
    instagramHandle: profile.instagram_handle || "",
    instagramLink: profile.instagram_link || "",
    whatsappGroupLink: profile.whatsapp_group_link || "",
    isPublic: true,
  });

  const allowedTypes = allowedByPlan[profile.plan] || [];
  const freeTrialDetails = getFreeTrialDetails(profile, user);
  const profileDisplayName = organizerProfile.organizerName || profile.name || user.email?.split("@")[0] || "Organizador";
  const profileInitials = profileDisplayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "T3";
  const panelMeta = {
    inicio: {
      title: "Visão geral",
      description: "Acompanhe seus torneios, circuitos e atividades em um só lugar.",
    },
    criar: {
      title: "Torneios",
      description: "Crie um novo torneio ou continue gerenciando os já cadastrados.",
    },
    circuitos: {
      title: "Circuitos",
      description: "Organize temporadas e acompanhe a classificação entre torneios.",
    },
    modalidades: {
      title: "Modalidades",
      description: "Consulte os formatos disponíveis para o seu plano.",
    },
    lixeira: {
      title: "Lixeira",
      description: "Recupere torneios excluídos nos últimos 30 dias.",
    },
    ajustes: {
      title: "Perfil e preferências",
      description: "Atualize sua imagem, dados públicos e informações da arena.",
    },
  };
  const currentPanelMeta = panelMeta[activePanel] || panelMeta.inicio;
  const tournamentLifecycleCounts = tournaments.reduce((counts, item) => {
    const status = getTournamentLifecycleStatus(item);
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, { active: 0, upcoming: 0, finished: 0 });
  const organizerVisibleTournaments = tournaments.filter((item) => (
    getTournamentLifecycleStatus(item) === tournamentStatusFilter
  ));
  const groupedTournaments = organizerVisibleTournaments.reduce((groups, item) => {
    const groupKey = item.data?.multiCategoryEvent === true && item.data?.eventGroupKey
      ? item.data.eventGroupKey
      : item.id;
    const groupName = item.data?.eventName || item.name;
    const existing = groups.find((group) => group.key === groupKey);

    if (existing) existing.items.push(item);
    else groups.push({ key: groupKey, name: groupName, items: [item] });

    return groups;
  }, []);

  const multiTournamentGroups = groupedTournaments.filter((group) => (
    group.items.length > 1 || group.items[0]?.data?.multiCategoryEvent === true
  ));
  const isolatedTournaments = groupedTournaments.flatMap((group) => (
    group.items.length === 1 && group.items[0]?.data?.multiCategoryEvent !== true ? group.items : []
  ));
  const circuitLifecycleCounts = circuits.reduce((counts, circuit) => {
    const status = getCircuitLifecycleStatus(circuit);
    counts[status] += 1;
    return counts;
  }, { active: 0, upcoming: 0, finished: 0 });
  const visibleOrganizerCircuits = circuits.filter((circuit) => (
    getCircuitLifecycleStatus(circuit) === circuitStatusFilter
  ));

  const filteredArenaProfiles = publicArenaProfiles.filter((arena) => {
    const term = arenaProfileSearch.trim().toLowerCase();
    if (!term) return true;
    return [arena.arena_name, arena.name, arena.city, arena.state]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  function normalizeCircuitRow(row) {
    return {
      id: row.id,
      name: row.name || "",
      startDate: row.start_date || "",
      endDate: row.end_date || "",
      status: normalizeCircuitStatus(row.status),
      tournamentIds: Array.isArray(row.tournament_ids) ? row.tournament_ids : [],
      rankingCriteria: row.ranking_criteria || defaultRankingCriteria,
      rankingCriteriaMode: row.ranking_criteria_mode === "manual" ? "manual" : "automatic",
      rankingHistory: row.rankingHistory || {},
      updatedAt: row.updated_at,
      revision: getCollaborationRevision(row),
    };
  }

  async function loadCircuits({ silentError = false, retryAfterRealtime = true } = {}) {
    const realtimeEpoch = circuitRealtimeEpochRef.current;
    const { data, error } = await supabase
      .from("circuits")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar circuitos:", error);
      if (!silentError) showNotice("error", "Erro ao carregar circuitos", "Não foi possível carregar seus circuitos do Supabase.");
      return;
    }

    const baseCircuits = (data || []).map(normalizeCircuitRow);

    const { data: historyRows, error: historyError } = await supabase
      .from("circuit_ranking_history")
      .select("*")
      .eq("user_id", user.id);

    if (historyError) console.error("Erro ao carregar histórico dos circuitos:", historyError);

    if (circuitRealtimeEpochRef.current !== realtimeEpoch) {
      if (retryAfterRealtime) return loadCircuits({ silentError, retryAfterRealtime: false });
      return circuitsRef.current;
    }

    const historyByCircuit = {};
    (historyRows || []).forEach((row) => {
      const key = `${row.tournament_id}::${row.group_key || "geral"}::${row.player_key}`;
      if (!historyByCircuit[row.circuit_id]) historyByCircuit[row.circuit_id] = {};
      historyByCircuit[row.circuit_id][key] = {
        tournamentId: row.tournament_id,
        groupKey: row.group_key || "geral",
        playerKey: row.player_key || key.split("::").pop(),
        name: row.player_name,
        pts: Number(row.pts || 0),
        w: Number(row.w || 0),
        bal: Number(row.bal || 0),
        played: Number(row.played || 0),
      };
    });

    const loadedCircuits = baseCircuits.map((circuit) => ({
      ...circuit,
      rankingHistory: historyByCircuit[circuit.id] || {},
    }));

    const currentCircuitsById = new Map(circuitsRef.current.map((item) => [String(item.id), item]));
    const reconciledCircuits = loadedCircuits.map((loadedCircuit) => {
      const currentCircuit = currentCircuitsById.get(String(loadedCircuit.id));
      if (!currentCircuit || compareCollaborationVersions(loadedCircuit, currentCircuit) >= 0) {
        return loadedCircuit;
      }
      return {
        ...currentCircuit,
        rankingHistory: historyError
          ? (currentCircuit.rankingHistory || {})
          : loadedCircuit.rankingHistory,
      };
    });
    const sortedCircuits = sortCircuitsForDisplay(reconciledCircuits);
    circuitsRef.current = sortedCircuits;
    setCircuits(sortedCircuits);
    return sortedCircuits;
  }

  async function saveCircuitHistoryToSupabase(circuitId, history, sourceTournaments = []) {
    const rows = Object.entries(history || {}).map(([recordKey, record]) => ({
      user_id: user.id,
      circuit_id: circuitId,
      tournament_id: record.tournamentId,
      group_key: record.groupKey || "geral",
      player_key: record.playerKey || recordKey.split("::").pop(),
      player_name: record.name || "Sem nome",
      pts: Number(record.pts || 0),
      w: Number(record.w || 0),
      bal: Number(record.bal || 0),
      played: Number(record.played || 0),
      updated_at: new Date().toISOString(),
    }));
    const sourceVersions = (sourceTournaments || [])
      .filter((tournament) => tournament?.id && tournament?.updated_at)
      .map((tournament) => ({
        tournament_id: tournament.id,
        updated_at: tournament.updated_at,
      }));

    const { error: atomicReplaceError } = await supabase.rpc("replace_circuit_ranking_history", {
      p_circuit_id: circuitId,
      p_rows: rows.map((row) => ({
        tournament_id: row.tournament_id,
        group_key: row.group_key,
        player_key: row.player_key,
        player_name: row.player_name,
        pts: row.pts,
        w: row.w,
        bal: row.bal,
        played: row.played,
        updated_at: row.updated_at,
      })),
      p_source_versions: sourceVersions,
    });

    if (!atomicReplaceError) return true;

    const atomicFunctionMissing = /replace_circuit_ranking_history|function.*does not exist|schema cache/i.test(
      `${atomicReplaceError.message || ""} ${atomicReplaceError.code || ""}`
    );
    if (!atomicFunctionMissing) {
      console.error("Erro ao substituir histórico do circuito em uma transação:", atomicReplaceError);
      return false;
    }

    // Compatibilidade temporária enquanto a função transacional ainda não foi
    // aplicada no banco: grava os dados novos antes de remover os antigos. Uma
    // falha nunca apaga primeiro o histórico que já estava confirmado.
    if (sourceVersions.length) {
      const { data: currentVersions, error: versionsError } = await supabase
        .from("tournaments")
        .select("id, updated_at")
        .eq("user_id", user.id)
        .in("id", sourceVersions.map((item) => item.tournament_id));
      const currentVersionById = new Map((currentVersions || []).map((item) => [String(item.id), item.updated_at]));
      const sourceStillCurrent = !versionsError && sourceVersions.every((item) => (
        currentVersionById.get(String(item.tournament_id)) === item.updated_at
      ));
      if (!sourceStillCurrent) {
        console.warn("O ranking não foi substituído porque um torneio recebeu dados mais recentes.", versionsError);
        return false;
      }
    }

    if (rows.length) {
      const { error: upsertError } = await supabase
        .from("circuit_ranking_history")
        .upsert(rows, { onConflict: "user_id,circuit_id,tournament_id,group_key,player_key" });

      if (upsertError) {
        console.error("Erro ao salvar histórico do circuito:", upsertError);
        return false;
      }
    }

    const currentKeys = new Set(
      rows.map((row) => `${row.tournament_id}::${row.group_key}::${row.player_key}`)
    );

    const { data: savedRows, error: savedRowsError } = await supabase
      .from("circuit_ranking_history")
      .select("tournament_id, group_key, player_key")
      .eq("user_id", user.id)
      .eq("circuit_id", circuitId);

    if (savedRowsError) {
      console.error("Erro ao conferir histórico do circuito:", savedRowsError);
      return false;
    }

    const staleRows = (savedRows || []).filter((row) => {
      const key = `${row.tournament_id}::${row.group_key || "geral"}::${row.player_key}`;
      return !currentKeys.has(key);
    });

    const removalResults = await Promise.all(
      staleRows.map(async (row) => {
        const { error } = await supabase
          .from("circuit_ranking_history")
          .delete()
          .eq("user_id", user.id)
          .eq("circuit_id", circuitId)
          .eq("tournament_id", row.tournament_id)
          .eq("group_key", row.group_key || "geral")
          .eq("player_key", row.player_key);

        if (error) {
          console.error("Erro ao remover histórico antigo do circuito:", error);
          return false;
        }
        return true;
      })
    );

    return removalResults.every((result) => result !== false);
  }

  function saveCircuits(nextCircuits) {
    const sortedCircuits = sortCircuitsForDisplay(nextCircuits);
    circuitsRef.current = sortedCircuits;
    setCircuits(sortedCircuits);
  }

  function getCircuitSelectedTournaments(circuit, tournamentSource = tournaments) {
    const selectedIds = (circuit.tournamentIds || []).map((id) => String(id));
    return selectedIds
      .map((id) => tournamentSource.find((t) => String(t.id) === id))
      .filter(Boolean);
  }

  function resetCircuitForm() {
    setCircuitForm({
      id: null,
      name: "",
      startDate: "",
      endDate: "",
      tournamentIds: [],
      rankingCriteria: defaultRankingCriteria,
      rankingCriteriaMode: "automatic",
    });
  }

  function getCircuitCriteriaInfo(tournamentIds = [], tournamentSource = tournaments) {
    const criteriaValues = tournamentIds
      .map((id) => tournamentSource.find((tournament) => String(tournament.id) === String(id)))
      .filter(Boolean)
      .map((tournament) => tournament.data?.rankingCriteria || defaultRankingCriteria);
    const uniqueValues = [...new Set(criteriaValues)];

    return {
      value: uniqueValues[0] || defaultRankingCriteria,
      mixed: uniqueValues.length > 1,
      count: criteriaValues.length,
    };
  }

  function getCircuitEffectiveCriteria(circuit, tournamentSource = tournaments) {
    if (circuit?.rankingCriteriaMode === "manual") {
      return circuit.rankingCriteria || defaultRankingCriteria;
    }
    return getCircuitCriteriaInfo(circuit?.tournamentIds || [], tournamentSource).value;
  }

  function toggleCircuitTournament(tournamentId, editing = false) {
    const updateForm = editing ? setCircuitEditForm : setCircuitForm;
    updateForm((prev) => {
      if (!prev) return prev;
      const selected = prev.tournamentIds.includes(tournamentId);
      const tournamentIds = selected
        ? prev.tournamentIds.filter((id) => id !== tournamentId)
        : [...prev.tournamentIds, tournamentId];
      const inheritedCriteria = getCircuitCriteriaInfo(tournamentIds).value;
      return {
        ...prev,
        tournamentIds,
        rankingCriteria: prev.rankingCriteriaMode === "manual"
          ? prev.rankingCriteria
          : inheritedCriteria,
      };
    });
  }

  async function saveCircuit(form = circuitForm) {
    if (!ensureCloudConnection("salvar o circuito")) return;
    if (!form?.name.trim()) {
      showNotice("warning", "Nome obrigatório", "Digite um nome para o circuito.");
      return;
    }

    if (!form.startDate || !form.endDate) {
      showNotice("warning", "Datas obrigatórias", "Informe a data inicial e a data final do circuito.");
      return;
    }

    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      showNotice("warning", "Período inválido", "A data final não pode ser anterior à data inicial.");
      return;
    }

    const isEditing = Boolean(form.id);

    if (!isEditing && !ensureArenaProfileReadyForPublication()) return;

    const rowPayload = {
      user_id: user.id,
      name: form.name.trim(),
      start_date: form.startDate || null,
      end_date: form.endDate || null,
      status: getAutomaticEventStatus(form.endDate),
      tournament_ids: form.tournamentIds || [],
      ranking_criteria: form.rankingCriteriaMode === "manual"
        ? form.rankingCriteria
        : getCircuitCriteriaInfo(form.tournamentIds || []).value,
      ranking_criteria_mode: form.rankingCriteriaMode === "manual" ? "manual" : "automatic",
      updated_at: new Date().toISOString(),
    };

    let data = null;
    let error = null;

    if (!isEditing) {
      ({ data, error } = await supabase.from("circuits").insert(rowPayload).select("*").single());
    } else {
      let mergeBase = form._baseCircuit || circuitsRef.current.find((item) => item.id === form.id);
      let candidatePayload = rowPayload;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        let updateQuery = supabase
          .from("circuits")
          .update(candidatePayload)
          .eq("id", form.id)
          .eq("user_id", user.id);
        const expectedRevision = getCollaborationRevision(mergeBase);
        if (expectedRevision !== null) updateQuery = updateQuery.eq("revision", expectedRevision);
        else if (mergeBase?.updatedAt) updateQuery = updateQuery.eq("updated_at", mergeBase.updatedAt);
        ({ data, error } = await updateQuery.select("*").maybeSingle());
        if (error || data) break;

        const { data: remoteRow, error: remoteError } = await supabase
          .from("circuits")
          .select("*")
          .eq("id", form.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (remoteError || !remoteRow) {
          error = remoteError;
          break;
        }

        const remoteCircuit = normalizeCircuitRow(remoteRow);
        const baseFields = mergeBase ? {
          name: mergeBase.name,
          startDate: mergeBase.startDate,
          endDate: mergeBase.endDate,
          tournamentIds: mergeBase.tournamentIds,
          rankingCriteria: mergeBase.rankingCriteria,
          rankingCriteriaMode: mergeBase.rankingCriteriaMode,
        } : {};
        const localFields = {
          name: candidatePayload.name,
          startDate: candidatePayload.start_date,
          endDate: candidatePayload.end_date,
          tournamentIds: candidatePayload.tournament_ids,
          rankingCriteria: candidatePayload.ranking_criteria,
          rankingCriteriaMode: candidatePayload.ranking_criteria_mode,
        };
        const remoteFields = {
          name: remoteCircuit.name,
          startDate: remoteCircuit.startDate,
          endDate: remoteCircuit.endDate,
          tournamentIds: remoteCircuit.tournamentIds,
          rankingCriteria: remoteCircuit.rankingCriteria,
          rankingCriteriaMode: remoteCircuit.rankingCriteriaMode,
        };
        const merged = mergeBase
          ? mergeConcurrentTournamentData(baseFields, localFields, remoteFields).data
          : localFields;

        candidatePayload = {
          ...candidatePayload,
          name: merged.name,
          start_date: merged.startDate || null,
          end_date: merged.endDate || null,
          status: getAutomaticEventStatus(merged.endDate),
          tournament_ids: merged.tournamentIds || [],
          ranking_criteria: merged.rankingCriteria,
          ranking_criteria_mode: merged.rankingCriteriaMode,
          updated_at: new Date().toISOString(),
        };
        mergeBase = remoteCircuit;
      }
    }

    if (error || !data) {
      console.error("Erro ao salvar circuito:", error);
      showNotice(
        error ? "error" : "warning",
        error ? "Erro ao salvar" : "Circuito atualizado em outro dispositivo",
        error
          ? "Não foi possível salvar o circuito no Supabase."
          : "A sincronização continua protegida. Tente salvar novamente; a última alteração será aplicada automaticamente."
      );
      return;
    }

    const payload = normalizeCircuitRow(data);
    const previousHistory = circuits.find((item) => item.id === payload.id)?.rankingHistory || {};
    const payloadWithHistory = { ...payload, rankingHistory: previousHistory };
    const updatedHistory = buildCircuitRankingHistory(payloadWithHistory);
    const finalPayload = { ...payloadWithHistory, rankingHistory: updatedHistory };

    const nextCircuits = isEditing
      ? circuits.map((item) => item.id === form.id ? finalPayload : item)
      : [finalPayload, ...circuits];

    saveCircuits(nextCircuits);
    const rankingHistorySaved = await saveCircuitHistoryToSupabase(
      finalPayload.id,
      finalPayload.rankingHistory,
      getCircuitSelectedTournaments(finalPayload, tournamentsRef.current)
    );
    await syncPublicArenaDirectory(tournaments, nextCircuits);
    if (isEditing) setCircuitEditForm(null);
    else {
      resetCircuitForm();
      setCreateCircuitOpen(false);
    }
    if (!rankingHistorySaved) {
      showNotice(
        "warning",
        "Circuito salvo; ranking pendente",
        "Os dados do circuito foram salvos, mas o histórico do ranking precisa de uma nova tentativa."
      );
      return;
    }
    showNotice("success", isEditing ? "Circuito atualizado" : "Circuito criado", "As alterações foram salvas no Supabase.");
  }

  function editCircuit(circuit) {
    setCircuitEditForm({
      _baseCircuit: circuit,
      id: circuit.id,
      name: circuit.name || "",
      startDate: circuit.startDate || "",
      endDate: circuit.endDate || "",
      tournamentIds: Array.isArray(circuit.tournamentIds) ? circuit.tournamentIds : [],
      rankingCriteria: getCircuitEffectiveCriteria(circuit),
      rankingCriteriaMode: circuit.rankingCriteriaMode === "manual" ? "manual" : "automatic",
    });
  }

  async function updateCircuitRankingRule(circuit, rankingCriteria, rankingCriteriaMode = "manual") {
    if (!ensureCloudConnection("alterar o critério do circuito")) return;
    const nextCircuit = {
      ...circuit,
      rankingCriteria,
      rankingCriteriaMode,
    };
    const nextCircuits = circuits.map((item) => item.id === circuit.id ? nextCircuit : item);
    setCircuits(nextCircuits);

    const criteriaUpdate = supabase
      .from("circuits")
      .update({
        ranking_criteria: rankingCriteria,
        ranking_criteria_mode: rankingCriteriaMode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", circuit.id)
      .eq("user_id", user.id);
    const { data: criteriaSaved, error } = await criteriaUpdate.select("*").maybeSingle();

    if (error || !criteriaSaved) {
      console.error("Erro ao atualizar critério do circuito:", error);
      setCircuits(circuits);
      showNotice(
        error ? "error" : "warning",
        error ? "Critério não alterado" : "Circuito atualizado em outro dispositivo",
        error ? "Não foi possível salvar o critério do circuito." : "Abra novamente o circuito para usar a versão mais recente."
      );
      return;
    }

    const savedCircuit = {
      ...normalizeCircuitRow(criteriaSaved),
      rankingHistory: circuit.rankingHistory || {},
    };
    const synchronizedCircuits = nextCircuits.map((item) => item.id === circuit.id ? savedCircuit : item);
    saveCircuits(synchronizedCircuits);
    await syncPublicArenaDirectory(tournaments, synchronizedCircuits);
  }

  async function syncAutomaticCircuitCriteria(nextTournaments, circuitSource = circuits) {
    const changedCircuits = [];
    const nextCircuits = (circuitSource || []).map((circuit) => {
      if (circuit.rankingCriteriaMode === "manual") return circuit;
      const inheritedCriteria = getCircuitEffectiveCriteria(circuit, nextTournaments);
      if (inheritedCriteria === circuit.rankingCriteria) return circuit;
      const updated = { ...circuit, rankingCriteria: inheritedCriteria, rankingCriteriaMode: "automatic" };
      changedCircuits.push(updated);
      return updated;
    });

    if (!changedCircuits.length) return nextCircuits;
    setCircuits(nextCircuits);

    const syncResults = await Promise.all(changedCircuits.map(async (circuit) => {
      const { error } = await supabase
        .from("circuits")
        .update({
          ranking_criteria: circuit.rankingCriteria,
          ranking_criteria_mode: "automatic",
          updated_at: new Date().toISOString(),
        })
        .eq("id", circuit.id)
        .eq("user_id", user.id);
      if (error) {
        console.error("Erro ao sincronizar critério automático do circuito:", error);
        return false;
      }
      return true;
    }));

    if (syncResults.some((result) => result === false)) {
      showNotice(
        "warning",
        "Critério do circuito pendente",
        "O torneio foi preservado, mas não foi possível atualizar agora o critério automático de todos os circuitos."
      );
    }

    return nextCircuits;
  }

  async function deleteCircuit() {
    if (!circuitDeleteTarget) return;
    if (!ensureCloudConnection("excluir o circuito")) return;
    const circuitId = circuitDeleteTarget.id;
    let circuitDelete = supabase
      .from("circuits")
      .delete()
      .eq("id", circuitId)
      .eq("user_id", user.id);
    if (circuitDeleteTarget.updatedAt) circuitDelete = circuitDelete.eq("updated_at", circuitDeleteTarget.updatedAt);
    const { data: deletedCircuit, error } = await circuitDelete.select("id").maybeSingle();

    if (error || !deletedCircuit) {
      console.error("Erro ao excluir circuito:", error);
      showNotice(
        error ? "error" : "warning",
        error ? "Erro ao excluir" : "Circuito atualizado em outro dispositivo",
        error ? "Não foi possível excluir o circuito no Supabase." : "Confira a versão mais recente antes de excluir."
      );
      return;
    }

    const nextCircuits = circuits.filter((item) => item.id !== circuitId);
    saveCircuits(nextCircuits);
    await syncPublicArenaDirectory(tournaments, nextCircuits);
    if (circuitEditForm?.id === circuitId) setCircuitEditForm(null);
    setCircuitDeleteTarget(null);
    showNotice("success", "Circuito excluído", "O circuito foi removido do Supabase. Os torneios continuam salvos.");
  }

  function normalizeCircuitPlayerKey(value, isTeam = false) {
    const normalizedParts = String(value || "Sem nome")
      .split(isTeam ? /\s+\+\s+/ : /$^/)
      .map((part) => part.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR"))
      .filter(Boolean);

    if (isTeam && normalizedParts.length > 1) {
      return normalizedParts.sort((first, second) => first.localeCompare(second, "pt-BR")).join(" + ");
    }

    return normalizedParts[0] || "sem nome";
  }

  function getCircuitTournamentRankingRecords(circuit, tournamentSource = tournaments) {
    const records = {};

    getCircuitSelectedTournaments(circuit, tournamentSource).forEach((tournament) => {
      let rows = [];
      try {
        rows = calculateCircuitTournamentRanking(
          tournament.data || {},
          tournament.type,
          tournament.data?.rankingCriteria || defaultRankingCriteria
        );
      } catch (error) {
        console.error(`Erro ao calcular o ranking do torneio ${tournament.id} no circuito:`, error);
        return;
      }
      const config = modalityConfig[tournament.type];
      const separated = isMixedType(config);
      const teamRanking = isCupType(config) || config?.type === "fixed12" || config?.type === "fixed16";
      const nameOccurrences = new Map();

      rows.forEach((row) => {
        const groupKey = separated ? (row.id < config.men ? "masculino" : "feminino") : "geral";
        const name = String(row.name || "Sem nome").trim() || "Sem nome";
        const key = `${groupKey}::${normalizeCircuitPlayerKey(name, teamRanking)}`;
        nameOccurrences.set(key, (nameOccurrences.get(key) || 0) + 1);
      });

      rows.forEach((row, rowIndex) => {
        if (Number(row.played || 0) <= 0) return;
        const groupKey = separated ? (row.id < config.men ? "masculino" : "feminino") : "geral";
        const name = String(row.name || "Sem nome").trim() || "Sem nome";
        const normalizedName = normalizeCircuitPlayerKey(name, teamRanking);
        const duplicateNameKey = `${groupKey}::${normalizedName}`;
        const playerKey = nameOccurrences.get(duplicateNameKey) > 1
          ? `${normalizedName}#${row.id ?? rowIndex + 1}`
          : normalizedName;
        const recordKey = `${tournament.id}::${groupKey}::${playerKey}`;
        const record = {
          tournamentId: tournament.id,
          groupKey,
          playerKey,
          name,
          pts: Number(row.pts || 0),
          w: Number(row.w || 0),
          bal: Number(row.bal || 0),
          played: Number(row.played || 0),
        };

        records[recordKey] = record;
      });
    });

    return records;
  }

  function buildCircuitRankingHistory(circuit, tournamentSource = tournaments) {
    return getCircuitTournamentRankingRecords(circuit, tournamentSource);
  }

  function getCircuitRanking(circuit, criteriaValue = getCircuitEffectiveCriteria(circuit), tournamentSource = tournaments) {
    const history = buildCircuitRankingHistory(circuit, tournamentSource);
    const groups = {
      geral: { title: "Ranking geral acumulado", rows: new Map() },
      masculino: { title: "Ranking Masculino", rows: new Map() },
      feminino: { title: "Ranking Feminino", rows: new Map() },
    };

    Object.values(history).forEach((record) => {
      const groupKey = record.groupKey || "geral";
      const table = groups[groupKey]?.rows || groups.geral.rows;
      const name = String(record.name || "Sem nome").trim() || "Sem nome";
      const key = normalizeCircuitPlayerKey(record.playerKey || name);
      const current = table.get(key) || {
        id: `${groupKey}:${key}`,
        name,
        pts: 0,
        w: 0,
        bal: 0,
        played: 0,
        tournaments: 0,
      };

      table.set(key, {
        ...current,
        name: current.name || name,
        pts: current.pts + Number(record.pts || 0),
        w: current.w + Number(record.w || 0),
        bal: current.bal + Number(record.bal || 0),
        played: current.played + Number(record.played || 0),
        tournaments: current.tournaments + 1,
      });
    });

    const criteria = getRankingCriteria(criteriaValue);
    const sortRows = (rows) => Array.from(rows.values()).sort((a, b) => {
      for (const key of criteria.order) {
        const diff = Number(b[key] || 0) - Number(a[key] || 0);
        if (diff !== 0) return diff;
      }
      return a.name.localeCompare(b.name, "pt-BR");
    });

    return [
      { key: "masculino", title: groups.masculino.title, rows: sortRows(groups.masculino.rows) },
      { key: "feminino", title: groups.feminino.title, rows: sortRows(groups.feminino.rows) },
      { key: "geral", title: groups.geral.title, rows: sortRows(groups.geral.rows) },
    ].filter((group) => group.rows.length > 0);
  }

  async function persistCircuitRankings(
    tournamentSource = tournaments,
    circuitSource = circuits,
    affectedTournamentId = null
  ) {
    const affectedId = affectedTournamentId === null ? null : String(affectedTournamentId);
    const circuitsToPersist = [];
    let changed = false;

    const nextCircuits = (circuitSource || []).map((circuit) => {
      const isAffected = affectedId === null
        || (circuit.tournamentIds || []).some((id) => String(id) === affectedId);
      if (!isAffected) return circuit;

      const rankingHistory = buildCircuitRankingHistory(circuit, tournamentSource || []);
      const historyChanged = JSON.stringify(circuit.rankingHistory || {}) !== JSON.stringify(rankingHistory);
      if (historyChanged) changed = true;
      const nextCircuit = historyChanged ? { ...circuit, rankingHistory } : circuit;
      circuitsToPersist.push(nextCircuit);
      return nextCircuit;
    });

    if (changed) saveCircuits(nextCircuits);

    const persistCurrentSnapshot = () => Promise.all(
      circuitsToPersist.map((circuit) => saveCircuitHistoryToSupabase(
        circuit.id,
        circuit.rankingHistory || {},
        getCircuitSelectedTournaments(circuit, tournamentSource || [])
      ))
    );
    const queuedPersistence = circuitPersistenceQueueRef.current.then(
      persistCurrentSnapshot,
      persistCurrentSnapshot
    );
    const guardedPersistence = queuedPersistence.catch((error) => {
      console.error("Erro na fila de atualização do ranking do circuito:", error);
      return [false];
    });
    circuitPersistenceQueueRef.current = guardedPersistence.then(() => undefined);
    const persistenceResults = await guardedPersistence;

    return {
      circuits: nextCircuits,
      success: persistenceResults.every((result) => result !== false),
    };
  }

  function showNotice(type, title, message) {
    setNotice({ type, title, message });
  }

  async function shareArenaProfile() {
    const url = getArenaPublicUrl(user.id);

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: organizerProfile.arenaName || "Arena Torneio360",
          text: getArenaPublicShareMessage(user.id),
          url,
        });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    const copied = await copyToClipboard(url);
    showNotice(
      copied ? "success" : "error",
      copied ? "Link do perfil copiado" : "Não foi possível copiar",
      copied
        ? "Envie este link para qualquer pessoa acompanhar a arena sem login."
        : "Tente novamente em alguns instantes."
    );
  }

  function updateOrganizerProfile(field, value) {
    setOrganizerProfile((prev) => ({ ...prev, [field]: value }));
  }

  function organizerProfileFromRow(row, fallback = {}) {
    return {
      photoUrl: row?.photo_url ?? fallback.photoUrl ?? "",
      arenaName: row?.arena_name ?? fallback.arenaName ?? "",
      organizerName: row?.name ?? fallback.organizerName ?? "",
      email: user.email || fallback.email || "",
      whatsapp: row?.phone ?? fallback.whatsapp ?? "",
      address: row?.address ?? fallback.address ?? "",
      mapsLink: row?.maps_link ?? fallback.mapsLink ?? "",
      city: row?.city ?? fallback.city ?? "",
      state: row?.state ?? fallback.state ?? "",
      instagramHandle: row?.instagram_handle ?? fallback.instagramHandle ?? "",
      instagramLink: row?.instagram_link ?? fallback.instagramLink ?? "",
      whatsappGroupLink: row?.whatsapp_group_link ?? fallback.whatsappGroupLink ?? "",
      isPublic: row?.is_public ?? fallback.isPublic ?? true,
    };
  }

  function openDatePicker(e) {
    e.currentTarget.showPicker?.();
  }

  async function prepareTournamentCover(file, applyImage) {
    if (!file || coverImageLoading) return;
    setCoverImageLoading(true);

    try {
      const imageUrl = await resizeImageFile(file, {
        maxWidth: 1400,
        maxHeight: 900,
        quality: 0.82,
      });
      applyImage(imageUrl);
    } catch (error) {
      showNotice("warning", "Foto não adicionada", error.message || "Escolha outra imagem.");
    } finally {
      setCoverImageLoading(false);
    }
  }

  function buildOrganizerProfilePayload() {
    return {
      name: organizerProfile.organizerName || profile.name || user.email || "Organizador",
      arena_name: organizerProfile.arenaName || profile.arena_name || profile.name || "Minha arena",
      phone: organizerProfile.whatsapp || "",
      address: organizerProfile.address || "",
      maps_link: organizerProfile.mapsLink || "",
      city: organizerProfile.city || "",
      state: organizerProfile.state || "",
      photo_url: organizerProfile.photoUrl || "",
      instagram_handle: organizerProfile.instagramHandle || "",
      instagram_link: organizerProfile.instagramLink || "",
      whatsapp_group_link: organizerProfile.whatsappGroupLink || "",
      is_public: true,
    };
  }

  async function saveOrganizerProfile() {
    if (!user?.id || profileSaving) return;
    if (!ensureCloudConnection("salvar o perfil")) return;
    setProfileSaveSuccess(false);
    if (profileSaveSuccessTimerRef.current) clearTimeout(profileSaveSuccessTimerRef.current);
    setProfileSaving(true);

    const publicProfileData = buildOrganizerProfilePayload();
    const baseProfile = organizerProfileBaseRef.current;
    const basePublicProfileData = {
      name: baseProfile.organizerName || profile.name || user.email || "Organizador",
      arena_name: baseProfile.arenaName || profile.arena_name || profile.name || "Minha arena",
      phone: baseProfile.whatsapp || "",
      address: baseProfile.address || "",
      maps_link: baseProfile.mapsLink || "",
      city: baseProfile.city || "",
      state: baseProfile.state || "",
      photo_url: baseProfile.photoUrl || "",
      instagram_handle: baseProfile.instagramHandle || "",
      instagram_link: baseProfile.instagramLink || "",
      whatsapp_group_link: baseProfile.whatsappGroupLink || "",
      is_public: baseProfile.isPublic ?? true,
    };
    const changedProfileData = Object.fromEntries(
      Object.entries(publicProfileData).filter(([key, value]) => value !== basePublicProfileData[key])
    );

    if (Object.keys(changedProfileData).length === 0) {
      setProfileSaving(false);
      showNotice("info", "Perfil já está atualizado", "Não há novas alterações para enviar.");
      return;
    }

    localStorage.setItem(`organizerProfile:${user.id}`, JSON.stringify({
      ...organizerProfile,
      organizerName: publicProfileData.name,
      arenaName: publicProfileData.arena_name,
      isPublic: publicProfileData.is_public,
    }));

    const { data, error } = await supabase
      .from("profiles")
      .update(changedProfileData)
      .eq("id", user.id)
      .select("*")
      .single();

    setProfileSaving(false);

    if (error) {
      console.error("Erro ao salvar perfil no Supabase:", error);
      showNotice("error", "Perfil não salvo", `O Supabase recusou a alteração. Detalhe: ${error.message || "erro desconhecido"}`);
      return;
    }

    if (data) {
      onProfileChange?.((prev) => ({ ...prev, ...data }));
      const savedOrganizerProfile = organizerProfileFromRow(data, organizerProfile);
      organizerProfileBaseRef.current = savedOrganizerProfile;
      setOrganizerProfile(savedOrganizerProfile);
      localStorage.setItem(`organizerProfile:${user.id}`, JSON.stringify(savedOrganizerProfile));
      saveCachedProfile(user.id, { ...profile, ...data });
    }

    await loadPublicArenaProfiles();
    setProfileSaveSuccess(true);
    profileSaveSuccessTimerRef.current = setTimeout(() => {
      setProfileSaveSuccess(false);
      profileSaveSuccessTimerRef.current = null;
    }, 2600);
  }

  function toggleNewPublicInfo(field) {
    setNewPublicInfo((prev) => ({ ...prev, [field]: !prev[field] }));
  }

  function buildTournamentPublicInfo() {
    return {
      visibility: { ...newPublicInfo },
      organizer: {
        photoUrl: organizerProfile.photoUrl || "",
        arenaName: organizerProfile.arenaName || "",
        organizerName: organizerProfile.organizerName || "",
        whatsapp: organizerProfile.whatsapp || "",
        instagramHandle: organizerProfile.instagramHandle || "",
        instagramLink: organizerProfile.instagramLink || "",
        whatsappGroupLink: organizerProfile.whatsappGroupLink || "",
        address: organizerProfile.address || "",
        mapsLink: organizerProfile.mapsLink || "",
        city: organizerProfile.city || "",
        state: organizerProfile.state || "",
      },
    };
  }

  function ensureArenaProfileReadyForPublication() {
    const arenaName = String(organizerProfile.arenaName || profile.arena_name || "").trim();
    const organizerName = String(organizerProfile.organizerName || profile.name || "").trim();

    if (arenaName && organizerName) return true;

    showNotice(
      "warning",
      "Complete o perfil da arena",
      "Informe o nome da arena e o nome do responsável antes de criar um evento público."
    );
    openProfileSection("editar");
    return false;
  }

  async function syncPublicArenaDirectory(
    nextTournaments = tournaments,
    nextCircuits = circuits,
    { updateLocalState = true, protectConcurrentData = false } = {}
  ) {
    const activeTournaments = (nextTournaments || []).filter((item) => !item.data?.deletedAt);
    if (!activeTournaments.length) return [];

    const normalizedTournaments = activeTournaments.map((item) => ({
      ...item,
      public_id: item.public_id || generatePublicId(),
      is_public: true,
    }));
    const updatedTournaments = await Promise.all(normalizedTournaments.map(async (item) => {
      const originalItem = activeTournaments.find((candidate) => candidate.id === item.id);
      const needsDirectoryUpdate = !originalItem?.public_id || originalItem?.is_public !== true;
      if (!needsDirectoryUpdate) return item;

      let directoryUpdate = supabase
        .from("tournaments")
        .update({
          public_id: item.public_id,
          is_public: true,
        })
        .eq("id", item.id)
        .eq("user_id", user.id);
      const itemRevision = getCollaborationRevision(item);
      if (protectConcurrentData && itemRevision !== null) {
        directoryUpdate = directoryUpdate.eq("revision", itemRevision);
      } else if (protectConcurrentData && item.updated_at) {
        directoryUpdate = directoryUpdate.eq("updated_at", item.updated_at);
      }
      const { data: savedDirectoryItem, error } = await directoryUpdate.select("*").maybeSingle();

      if (error) {
        console.warn("Não foi possível atualizar o diretório público da arena:", error);
        return item;
      }

      return savedDirectoryItem || item;
    }));

    if (updateLocalState) {
      const updatedById = new Map(updatedTournaments.map((item) => [String(item.id), item]));
      const reconciledTournaments = sortTournamentsByStoredOrder(
        tournamentsRef.current.map((current) => {
          const updated = updatedById.get(String(current.id));
          return updated ? mergeRealtimeTournamentRow(current, updated) : current;
        })
      );
      tournamentsRef.current = reconciledTournaments;
      setTournaments(reconciledTournaments);
    }
    return updatedTournaments;
  }


  function handleOrganizerPhotoFile(file) {
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      showNotice("warning", "Arquivo inválido", "Escolha uma imagem para usar como foto de perfil.");
      return;
    }
    const maxSize = 3 * 1024 * 1024;
    if (file.size > maxSize) {
      showNotice("warning", "Imagem muito grande", "Escolha uma imagem com até 3 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoEditor({ imageUrl: String(reader.result || ""), zoom: 1, x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  }

  function clampPhotoZoom(value) {
    return Math.min(4, Math.max(1, Number(value) || 1));
  }

  function clampPhotoOffset(value) {
    return Math.min(160, Math.max(-160, Number(value) || 0));
  }

  function handlePhotoPointerDown(e) {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    photoPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (photoPointersRef.current.size === 1) {
      lastPhotoDragRef.current = { x: e.clientX, y: e.clientY };
      lastPhotoPinchRef.current = null;
    }

    if (photoPointersRef.current.size === 2) {
      const points = Array.from(photoPointersRef.current.values());
      lastPhotoPinchRef.current = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      lastPhotoDragRef.current = null;
    }
  }

  function handlePhotoPointerMove(e) {
    if (!photoPointersRef.current.has(e.pointerId)) return;
    e.preventDefault();
    photoPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (photoPointersRef.current.size === 1 && lastPhotoDragRef.current) {
      const dx = e.clientX - lastPhotoDragRef.current.x;
      const dy = e.clientY - lastPhotoDragRef.current.y;
      lastPhotoDragRef.current = { x: e.clientX, y: e.clientY };

      setPhotoEditor((prev) => prev ? {
        ...prev,
        x: clampPhotoOffset((prev.x || 0) + dx),
        y: clampPhotoOffset((prev.y || 0) + dy),
      } : prev);
    }

    if (photoPointersRef.current.size === 2 && lastPhotoPinchRef.current) {
      const points = Array.from(photoPointersRef.current.values());
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const ratio = distance / lastPhotoPinchRef.current;
      lastPhotoPinchRef.current = distance;

      setPhotoEditor((prev) => prev ? {
        ...prev,
        zoom: clampPhotoZoom((prev.zoom || 1) * ratio),
      } : prev);
    }
  }

  function handlePhotoPointerEnd(e) {
    photoPointersRef.current.delete(e.pointerId);
    lastPhotoDragRef.current = null;
    lastPhotoPinchRef.current = null;

    if (photoPointersRef.current.size === 1) {
      const point = Array.from(photoPointersRef.current.values())[0];
      lastPhotoDragRef.current = { x: point.x, y: point.y };
    }
  }

  function handlePhotoWheel(e) {
    e.preventDefault();
    const direction = e.deltaY > 0 ? -0.08 : 0.08;
    setPhotoEditor((prev) => prev ? {
      ...prev,
      zoom: clampPhotoZoom((prev.zoom || 1) + direction),
    } : prev);
  }

  function nudgePhotoZoom(amount) {
    setPhotoEditor((prev) => prev ? {
      ...prev,
      zoom: clampPhotoZoom((prev.zoom || 1) + amount),
    } : prev);
  }

  function drawPhotoEditorCanvas(canvas, outputSize, onDone) {
    if (!canvas || !photoEditor?.imageUrl) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const image = new Image();
    image.onload = () => {
      canvas.width = outputSize;
      canvas.height = outputSize;

      ctx.clearRect(0, 0, outputSize, outputSize);
      ctx.save();
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.clip();

      const baseScale = Math.max(outputSize / image.width, outputSize / image.height);
      const scale = baseScale * Number(photoEditor.zoom || 1);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      const previewSize = photoPreviewRef.current?.getBoundingClientRect()?.width || outputSize;
      const offsetScale = outputSize / previewSize;
      const offsetX = Number(photoEditor.x || 0) * offsetScale;
      const offsetY = Number(photoEditor.y || 0) * offsetScale;

      ctx.drawImage(
        image,
        (outputSize - drawWidth) / 2 + offsetX,
        (outputSize - drawHeight) / 2 + offsetY,
        drawWidth,
        drawHeight
      );
      ctx.restore();

      onDone?.(canvas);
    };
    image.src = photoEditor.imageUrl;
  }

  useEffect(() => {
    if (!photoEditor?.imageUrl || !photoCanvasRef.current || !photoPreviewRef.current) return;
    const previewSize = Math.round(photoPreviewRef.current.getBoundingClientRect().width || 220);
    drawPhotoEditorCanvas(photoCanvasRef.current, previewSize);
  }, [photoEditor]);

  function applyEditedOrganizerPhoto() {
    if (!photoEditor?.imageUrl) return;

    const canvas = document.createElement("canvas");
    drawPhotoEditorCanvas(canvas, 360, (finalCanvas) => {
      const photoUrl = finalCanvas.toDataURL("image/png", 0.92);
      setOrganizerProfile((prev) => {
        const next = { ...prev, photoUrl };
        localStorage.setItem(`organizerProfile:${user.id}`, JSON.stringify(next));
        return next;
      });
      setPhotoEditor(null);
      showNotice("info", "Foto preparada", "Ajuste concluído. Clique em “Salvar alterações” para enviar a foto à nuvem.");
    });
  }

  function removeOrganizerPhoto() {
    setOrganizerProfile((prev) => {
      const next = { ...prev, photoUrl: "" };
      localStorage.setItem(`organizerProfile:${user.id}`, JSON.stringify(next));
      return next;
    });
  }

  function sortTournamentsByStoredOrder(items) {
    return sortTournamentsForDisplay(items);
  }

  async function persistTournamentOrderSequence(items, { manual = false } = {}) {
    let orderedTournaments = (items || []).map((tournament, displayOrder) => ({
      ...tournament,
      data: {
        ...(tournament.data || {}),
        displayOrder,
        displayOrderMode: manual ? "manual" : (tournament.data?.displayOrderMode || "automatic"),
      },
    }));

    if (orderedTournaments.length === 0) return { tournaments: [], error: null };

    let { error } = await supabase.rpc("set_tournament_order_safe", {
      p_tournament_ids: orderedTournaments.map((tournament) => tournament.id),
    });

    const safeFunctionMissing = error && /set_tournament_order_safe|function.*does not exist|schema cache/i.test(
      `${error.message || ""} ${error.code || ""}`
    );

    if (safeFunctionMissing) {
      ({ error } = await supabase.rpc("set_tournament_order", {
        p_tournament_ids: orderedTournaments.map((tournament) => tournament.id),
      }));
    }

    if (!error && manual && safeFunctionMissing) {
      const updates = await Promise.all(orderedTournaments.map((tournament) => (
        (() => {
          let markerUpdate = supabase
          .from("tournaments")
          .update({ data: tournament.data })
          .eq("id", tournament.id)
          .eq("user_id", user.id);
          const tournamentRevision = getCollaborationRevision(tournament);
          if (tournamentRevision !== null) markerUpdate = markerUpdate.eq("revision", tournamentRevision);
          else if (tournament.updated_at) markerUpdate = markerUpdate.eq("updated_at", tournament.updated_at);
          return markerUpdate.select("*").maybeSingle();
        })()
      )));
      const markerError = updates.find((result) => result.error)?.error || null;
      const markerConflict = updates.some((result) => !result.error && !result.data);
      if (markerError || markerConflict) {
        return {
          tournaments: orderedTournaments,
          error: markerError || new Error("A ordem encontrou um torneio alterado em outra aba."),
        };
      }
    }

    if (!error) {
      const { data: refreshedRows, error: refreshError } = await supabase
        .from("tournaments")
        .select("*")
        .eq("user_id", user.id)
        .in("id", orderedTournaments.map((tournament) => tournament.id));
      if (refreshError || (refreshedRows || []).length !== orderedTournaments.length) {
        return {
          tournaments: orderedTournaments,
          error: refreshError || new Error("Não foi possível confirmar as novas versões da ordem."),
        };
      }
      const refreshedById = new Map((refreshedRows || []).map((row) => [String(row.id), row]));
      orderedTournaments = orderedTournaments.map((tournament) => (
        mergeRealtimeTournamentRow(tournament, refreshedById.get(String(tournament.id)))
      ));
    }

    return { tournaments: orderedTournaments, error };
  }

  async function persistTournamentSnapshot(updated, { expectedUpdatedAt = null, expectedRevision = null } = {}) {
    const lifecycleStatus = getTournamentLifecycleStatus(updated);
    const persistedData = { ...(updated.data || {}), lifecycleStatus };
    const nextUpdatedAt = new Date().toISOString();

    let query = supabase
      .from("tournaments")
      .update({
        name: updated.name,
        type: updated.type,
        data: persistedData,
        status: lifecycleStatus === "finished" ? "finished" : "active",
        updated_at: nextUpdatedAt,
        last_change_id: updated.changeId || null,
      })
      .eq("id", updated.id)
      .eq("user_id", user.id);

    if (Number.isSafeInteger(expectedRevision) && expectedRevision >= 0) {
      query = query.eq("revision", expectedRevision);
    } else if (expectedUpdatedAt) {
      query = query.eq("updated_at", expectedUpdatedAt);
    }

    const { data: savedTournament, error } = await query.select("*").maybeSingle();

    if (error) {
      console.error("Erro ao salvar torneio:", error);
      return { ok: false, error, retryable: isRetryableConnectionError(error) };
    }

    if (!savedTournament) {
      const { data: serverTournament, error: reloadError } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", updated.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (reloadError) {
        console.error("Erro ao conferir versão do torneio:", reloadError);
        return { ok: false, error: reloadError, retryable: isRetryableConnectionError(reloadError) };
      }

      return { ok: false, conflict: true, serverTournament };
    }

    return { ok: true, tournament: savedTournament };
  }

  async function syncPendingTournamentDrafts(tournamentSource = []) {
    if (isBrowserOffline()) return { tournaments: tournamentSource, syncedCount: 0, pendingRetryCount: 0 };

    const localDrafts = listLocalTournamentDrafts(user.id);
    const indexedDrafts = await listPendingTournaments(user.id);
    const draftsByTournament = new Map();

    [...indexedDrafts, ...localDrafts].forEach((draft) => {
      if (!draft?.tournamentId || !draft?.data) return;
      const current = draftsByTournament.get(draft.tournamentId);
      if (!current || Number(draft.updatedAt || 0) >= Number(current.updatedAt || 0)) {
        draftsByTournament.set(draft.tournamentId, draft);
      }
    });

    if (!draftsByTournament.size) {
      setPendingSyncCount(0);
      return { tournaments: tournamentSource, syncedCount: 0, pendingRetryCount: 0 };
    }

    let nextTournaments = [...tournamentSource];
    let syncedCount = 0;
    let pendingRetryCount = 0;

    for (const draft of draftsByTournament.values()) {
      if (selectedRef.current?.id && String(selectedRef.current.id) === String(draft.tournamentId)) continue;
      let serverTournament = nextTournaments.find((item) => String(item.id) === String(draft.tournamentId));
      if (!serverTournament) continue;

      if (JSON.stringify(serverTournament.data || {}) === JSON.stringify(draft.data || {})) {
        clearTournamentDraft(user.id, serverTournament.id);
        syncedCount += 1;
        continue;
      }

      let dataToPersist = draft.data;
      const draftBaseRevision = draft.baseRevision !== null
        && draft.baseRevision !== undefined
        && Number.isSafeInteger(Number(draft.baseRevision))
        ? Number(draft.baseRevision)
        : null;
      const serverRevision = getCollaborationRevision(serverTournament);
      const serverChangedSinceDraft = draftBaseRevision !== null && serverRevision !== null
        ? draftBaseRevision !== serverRevision
        : Boolean(draft.baseUpdatedAt && serverTournament.updated_at && draft.baseUpdatedAt !== serverTournament.updated_at);

      if (serverChangedSinceDraft) {
        const merged = mergeConcurrentTournamentData(
          draft.baseData || {},
          draft.data,
          serverTournament.data || {}
        );
        dataToPersist = merged.data;
      }

      let result = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        result = await persistTournamentSnapshot({
          ...serverTournament,
          data: dataToPersist,
        }, {
          expectedUpdatedAt: serverTournament.updated_at || null,
          expectedRevision: getCollaborationRevision(serverTournament),
        });

        if (result.ok || !result.conflict || !result.serverTournament?.data) break;

        const merged = mergeConcurrentTournamentData(
          serverTournament.data || {},
          dataToPersist,
          result.serverTournament.data || {}
        );
        dataToPersist = merged.data;
        serverTournament = result.serverTournament;
      }

      if (result?.ok && result.tournament) {
        nextTournaments = nextTournaments.map((item) => (
          item.id === result.tournament.id ? result.tournament : item
        ));
        clearTournamentDraft(user.id, result.tournament.id);
        syncedCount += 1;
      } else {
        pendingRetryCount += 1;
      }

      if (result?.retryable) {
        break;
      }
    }

    setPendingSyncCount(listLocalTournamentDrafts(user.id).length);
    return { tournaments: nextTournaments, syncedCount, pendingRetryCount };
  }

  async function loadTournaments({ silentError = false, retryAfterRealtime = true } = {}) {
    const realtimeEpoch = tournamentRealtimeEpochRef.current;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deleteLimit = thirtyDaysAgo.toISOString();

    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      if (!silentError) showNotice("error", "Erro ao carregar", "Não foi possível carregar seus torneios.");
      console.error(error);
      return;
    }

    if (tournamentRealtimeEpochRef.current !== realtimeEpoch) {
      if (retryAfterRealtime) return loadTournaments({ silentError, retryAfterRealtime: false });
      return tournamentsRef.current;
    }

    const currentRows = [...tournamentsRef.current, ...trashTournamentsRef.current];
    const currentRowsById = new Map(currentRows.map((item) => [String(item.id), item]));
    const allTournaments = (data || []).map((item) => (
      mergeRealtimeTournamentRow(currentRowsById.get(String(item.id)), item)
    ));
    const expiredTrash = allTournaments.filter((item) => item.data?.deletedAt && item.data.deletedAt < deleteLimit);

    if (expiredTrash.length) {
      const { error: purgeError } = await supabase
        .from("tournaments")
        .delete()
        .eq("user_id", user.id)
        .in("id", expiredTrash.map((item) => item.id));

      if (purgeError) console.error("Erro ao excluir itens expirados da lixeira:", purgeError);
    }

    const validTournaments = allTournaments.filter((item) => !item.data?.deletedAt || item.data.deletedAt >= deleteLimit);
    const activeSource = validTournaments.filter((item) => !item.data?.deletedAt);
    const activeTournaments = sortTournamentsByStoredOrder(activeSource);
    const nextTrashTournaments = validTournaments.filter((item) => item.data?.deletedAt);

    if (tournamentRealtimeEpochRef.current !== realtimeEpoch) {
      if (retryAfterRealtime) return loadTournaments({ silentError, retryAfterRealtime: false });
      return tournamentsRef.current;
    }

    tournamentsRef.current = activeTournaments;
    trashTournamentsRef.current = nextTrashTournaments;
    setTournaments(activeTournaments);
    setTrashTournaments(nextTrashTournaments);
    setSelected((current) => {
      if (!current?.id) return current;
      const loadedCurrent = activeTournaments.find((item) => item.id === current.id);
      return loadedCurrent ? mergeRealtimeTournamentRow(current, loadedCurrent) : current;
    });
    return activeTournaments;
  }

  async function openArenaProfile(arena) {
    window.location.assign(getArenaPublicUrl(arena.id));
  }

  function closeArenaProfilePage() {
    setSelectedArenaProfile(null);
    setSelectedArenaTournaments([]);
  }

  async function loadPublicArenaProfiles() {
    if (publicArenaProfilesInFlightRef.current) return;
    publicArenaProfilesInFlightRef.current = true;
    const requestId = publicArenaProfilesRequestRef.current + 1;
    publicArenaProfilesRequestRef.current = requestId;

    try {
      const currentArenaProfile = {
        id: user.id,
        name: organizerProfile.organizerName || profile.name || user.email || "Organizador",
        arena_name: organizerProfile.arenaName || profile.arena_name || profile.name || "Minha arena",
        city: organizerProfile.city || profile.city || "",
        state: organizerProfile.state || profile.state || "",
        photo_url: organizerProfile.photoUrl || profile.photo_url || "",
        phone: organizerProfile.whatsapp || profile.phone || "",
        address: organizerProfile.address || profile.address || "",
        maps_link: organizerProfile.mapsLink || profile.maps_link || "",
        instagram_handle: organizerProfile.instagramHandle || profile.instagram_handle || "",
        instagram_link: organizerProfile.instagramLink || profile.instagram_link || "",
        whatsapp_group_link: organizerProfile.whatsappGroupLink || profile.whatsapp_group_link || "",
        is_public: true,
      };

      const { data, error } = await fetchPublicArenaDirectory({ limit: 250 });
      if (!publicArenaProfilesMountedRef.current || requestId !== publicArenaProfilesRequestRef.current) return;

      if (error) {
        console.error("Erro ao carregar perfis públicos:", error);
        setPublicArenaProfiles((currentProfiles) => (
          currentProfiles.length > 0 ? currentProfiles : [currentArenaProfile]
        ));
        return;
      }

      const profiles = (data || [])
        .filter((item) => item?.id)
        .map((item) => ({ ...item, is_public: true }));

      const withoutCurrent = profiles.filter((item) => item.id !== user.id);
      setPublicArenaProfiles([currentArenaProfile, ...withoutCurrent]);
    } finally {
      publicArenaProfilesInFlightRef.current = false;
    }
  }

  publicArenaProfilesLoaderRef.current = loadPublicArenaProfiles;

  async function loadDashboardData({ reconnecting = false } = {}) {
    if (dashboardLoadInFlightRef.current) return;
    dashboardLoadInFlightRef.current = true;

    try {
      const cached = await readDashboardCache(user.id);
      const hasCachedDashboard = Boolean(cached && (
        Array.isArray(cached.tournaments) || Array.isArray(cached.circuits)
      ));

      if (hasCachedDashboard && tournamentsRef.current.length === 0 && circuitsRef.current.length === 0) {
        const cachedTournaments = Array.isArray(cached.tournaments) ? cached.tournaments : [];
        const cachedTrash = Array.isArray(cached.trashTournaments) ? cached.trashTournaments : [];
        const cachedCircuits = Array.isArray(cached.circuits) ? cached.circuits : [];
        tournamentsRef.current = cachedTournaments;
        trashTournamentsRef.current = cachedTrash;
        circuitsRef.current = cachedCircuits;
        setTournaments(cachedTournaments);
        setTrashTournaments(cachedTrash);
        setCircuits(cachedCircuits);
        setDashboardUsingOfflineCache(true);
      }

      if (isBrowserOffline()) {
        setNetworkOnline(false);
        if (!hasCachedDashboard) {
          showNotice(
            "warning",
            "Primeiro acesso precisa de internet",
            "Este aparelho ainda não possui uma cópia dos seus torneios. Reconecte-se uma vez para preparar o acesso seguro offline."
          );
        }
        return;
      }

      const [loadedTournaments, loadedCircuits] = await Promise.all([
        loadTournaments({ silentError: hasCachedDashboard }),
        loadCircuits({ silentError: hasCachedDashboard }),
      ]);

      if (Array.isArray(loadedTournaments) && Array.isArray(loadedCircuits)) {
        const pendingSync = await syncPendingTournamentDrafts(loadedTournaments);
        const synchronizedById = new Map(
          pendingSync.tournaments.map((item) => [String(item.id), item])
        );
        const synchronizedTournaments = sortTournamentsByStoredOrder(
          tournamentsRef.current.map((current) => {
            const synchronized = synchronizedById.get(String(current.id));
            return synchronized ? mergeRealtimeTournamentRow(current, synchronized) : current;
          })
        );
        tournamentsRef.current = synchronizedTournaments;
        setTournaments(synchronizedTournaments);

        const criteriaCircuits = await syncAutomaticCircuitCriteria(synchronizedTournaments, loadedCircuits);
        const { circuits: rankedCircuits } = await persistCircuitRankings(
          synchronizedTournaments,
          criteriaCircuits || loadedCircuits
        );
        circuitsRef.current = rankedCircuits;
        setCircuits(rankedCircuits);

        if (synchronizedTournaments.length) {
          await syncPublicArenaDirectory(synchronizedTournaments, rankedCircuits);
        }

        await saveDashboardCache(user.id, {
          tournaments: synchronizedTournaments,
          trashTournaments: trashTournamentsRef.current,
          circuits: rankedCircuits,
        });
        setDashboardUsingOfflineCache(false);
        setNetworkOnline(true);

        if (pendingSync.pendingRetryCount > 0) {
          showNotice(
            "warning",
            "Sincronização ainda em andamento",
            "As alterações continuam protegidas neste aparelho e serão enviadas automaticamente assim que a conexão estiver estável."
          );
        } else if (reconnecting && pendingSync.syncedCount > 0) {
          showNotice(
            "success",
            "Dados sincronizados",
            `${pendingSync.syncedCount} alteração(ões) guardada(s) neste aparelho foram enviada(s) para a nuvem.`
          );
        }
      } else if (hasCachedDashboard) {
        setDashboardUsingOfflineCache(true);
      }

      await loadPublicArenaProfiles();
    } finally {
      dashboardLoadInFlightRef.current = false;
    }
  }

  function cacheCurrentDashboard() {
    void saveDashboardCache(user.id, {
      tournaments: tournamentsRef.current,
      trashTournaments: trashTournamentsRef.current,
      circuits: circuitsRef.current,
    });
  }

  function applyRemoteTournamentChange(payload) {
    const eventType = payload?.eventType;
    const incomingRow = eventType === "DELETE" ? payload?.old : payload?.new;
    if (!incomingRow?.id) return;
    tournamentRealtimeEpochRef.current += 1;

    if (eventType === "DELETE") {
      tournamentsRef.current = tournamentsRef.current.filter((item) => item.id !== incomingRow.id);
      trashTournamentsRef.current = trashTournamentsRef.current.filter((item) => item.id !== incomingRow.id);
      setTournaments(tournamentsRef.current);
      setTrashTournaments(trashTournamentsRef.current);
      setSelected((current) => current?.id === incomingRow.id ? null : current);
      cacheCurrentDashboard();
      return;
    }

    const existingRow = tournamentsRef.current.find((item) => item.id === incomingRow.id)
      || trashTournamentsRef.current.find((item) => item.id === incomingRow.id)
      || (selectedRef.current?.id === incomingRow.id ? selectedRef.current : null);
    if (existingRow && compareCollaborationVersions(incomingRow, existingRow) < 0) return;
    const row = mergeRealtimeTournamentRow(existingRow, incomingRow);

    if (row.data?.deletedAt) {
      tournamentsRef.current = tournamentsRef.current.filter((item) => item.id !== row.id);
      trashTournamentsRef.current = [
        row,
        ...trashTournamentsRef.current.filter((item) => item.id !== row.id),
      ];
    } else {
      const withoutCurrent = tournamentsRef.current.filter((item) => item.id !== row.id);
      tournamentsRef.current = sortTournamentsByStoredOrder([row, ...withoutCurrent]);
      trashTournamentsRef.current = trashTournamentsRef.current.filter((item) => item.id !== row.id);
    }

    setTournaments(tournamentsRef.current);
    setTrashTournaments(trashTournamentsRef.current);
    setSelected((current) => current?.id === row.id ? row : current);
    cacheCurrentDashboard();
  }

  function applyRemoteCircuitChange(payload) {
    const eventType = payload?.eventType;
    const row = eventType === "DELETE" ? payload?.old : payload?.new;
    if (!row?.id) return;
    circuitRealtimeEpochRef.current += 1;

    if (eventType === "DELETE") {
      saveCircuits(circuitsRef.current.filter((item) => item.id !== row.id));
      cacheCurrentDashboard();
      return;
    }

    const previous = circuitsRef.current.find((item) => item.id === row.id);
    if (previous && compareCollaborationVersions(row, previous) < 0) return;
    const normalized = {
      ...normalizeCircuitRow(row),
      rankingHistory: previous?.rankingHistory || {},
    };
    saveCircuits([normalized, ...circuitsRef.current.filter((item) => item.id !== row.id)]);
    cacheCurrentDashboard();
  }

  function applyRemoteProfileChange(payload) {
    if (payload?.eventType === "DELETE" || !payload?.new?.id) return;
    const remoteRow = payload.new;
    const remoteOrganizerProfile = organizerProfileFromRow(remoteRow, organizerProfileBaseRef.current);

    setOrganizerProfile((current) => {
      const previousBase = organizerProfileBaseRef.current;
      const merged = { ...current };

      Object.keys(remoteOrganizerProfile).forEach((field) => {
        const localFieldWasEdited = current[field] !== previousBase[field];
        if (!localFieldWasEdited) merged[field] = remoteOrganizerProfile[field];
      });

      organizerProfileBaseRef.current = remoteOrganizerProfile;
      try {
        localStorage.setItem(`organizerProfile:${user.id}`, JSON.stringify(merged));
      } catch (error) {
        console.warn("Não foi possível atualizar a cópia local do perfil.", error);
      }
      return merged;
    });

    onProfileChange?.((current) => ({ ...current, ...remoteRow }));
    saveCachedProfile(user.id, { ...profile, ...remoteRow });
  }

  useEffect(() => {
    void requestDurableOfflineStorage();
    void loadDashboardData();
  }, []);

  useEffect(() => {
    const refreshPendingCount = async (event) => {
      if (event?.detail?.userId && event.detail.userId !== user.id) return;
      const localCount = listLocalTournamentDrafts(user.id).length;
      const indexedCount = (await listPendingTournaments(user.id)).length;
      setPendingSyncCount(Math.max(localCount, indexedCount));
    };
    const handleOnline = () => {
      setNetworkOnline(true);
      void loadDashboardData({ reconnecting: true });
    };
    const handleOffline = () => {
      setNetworkOnline(false);
      setDashboardUsingOfflineCache(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(TOURNAMENT_DRAFT_CHANGED_EVENT, refreshPendingCount);
    void refreshPendingCount();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(TOURNAMENT_DRAFT_CHANGED_EVENT, refreshPendingCount);
    };
  }, [user.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`torneio360-collaboration-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournaments", filter: `user_id=eq.${user.id}` },
        applyRemoteTournamentChange
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circuits", filter: `user_id=eq.${user.id}` },
        applyRemoteCircuitChange
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        applyRemoteProfileChange
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("Atualização em tempo real temporariamente indisponível; a conferência periódica continuará ativa.", error);
        }
      });

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible" && !isBrowserOffline()) {
        void loadDashboardData();
      }
    };
    const refreshInterval = window.setInterval(refreshWhenVisible, 30000);
    window.addEventListener("focus", refreshWhenVisible);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshWhenVisible);
      void supabase.removeChannel(channel);
    };
  }, [user.id]);

  useEffect(() => {
    publicArenaProfilesMountedRef.current = true;
    let refreshInFlight = false;

    const refreshProfiles = () => {
      if (refreshInFlight) return;
      refreshInFlight = true;
      Promise.resolve(publicArenaProfilesLoaderRef.current?.())
        .catch((error) => console.error("Erro ao atualizar diretório de arenas:", error))
        .finally(() => { refreshInFlight = false; });
    };
    const refreshVisibleProfiles = () => {
      if (document.visibilityState === "visible") refreshProfiles();
    };
    const handleVisibilityChange = () => {
      refreshVisibleProfiles();
    };
    const refreshTimer = window.setInterval(refreshVisibleProfiles, ARENA_DIRECTORY_REFRESH_INTERVAL_MS);

    window.addEventListener("focus", refreshProfiles);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      publicArenaProfilesMountedRef.current = false;
      publicArenaProfilesRequestRef.current += 1;
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshProfiles);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  async function createTournament() {
    if (!ensureCloudConnection("criar um novo torneio")) return;
    if (!ensureArenaProfileReadyForPublication()) return;
    const isMultiCategory = newMultiCategoryEvent === "sim";
    const validCategorySchedules = newCategorySchedules.filter((item) => item.category.trim());

    if (!newName.trim()) {
      showNotice("warning", "Nome obrigatório", "Digite um nome para este torneio.");
      return;
    }

    if (!isMultiCategory && !newType) {
  showNotice("warning", "Modalidade obrigatória", "Escolha a modalidade do torneio.");
  return;
}

    if (!isMultiCategory && !rankingCriteriaOptions.some((option) => option.value === newRankingCriteria)) {
      showNotice("warning", "Critério obrigatório", "Escolha a ordem dos critérios do ranking antes de criar o torneio.");
      return;
    }

    if (!isMultiCategory && !allowedTypes.includes(newType)) {
      showNotice("warning", "Modalidade não liberada", "Seu plano não permite essa modalidade.");
      return;
    }

    if (!isMultiCategory && (!newDate || !newEndDate)) {
      showNotice("warning", "Datas obrigatórias", "Informe a data de início e a data de encerramento do torneio.");
      return;
    }

    if (profile.plan === "basic" && tournaments.length >= 1) {
      showNotice("warning", "Limite do plano básico", "O plano Basic permite apenas 1 campeonato por vez.");
      return;
    }

    if (!isMultiCategory && newDate && newEndDate && newEndDate < newDate) {
      showNotice("warning", "Período inválido", "A data final do torneio não pode ser anterior à data inicial.");
      return;
    }

    if (!isMultiCategory && newRegistrationDeadline && newDate && newRegistrationDeadline > newDate) {
      showNotice("warning", "Inscrições após o início", "A data de encerramento das inscrições não pode ser depois do início do torneio.");
      return;
    }

    if (isMultiCategory && validCategorySchedules.length === 0) {
      showNotice("warning", "Categoria obrigatória", "Adicione pelo menos uma categoria para este evento.");
      return;
    }

    if (isMultiCategory) {
      const incompleteCategory = validCategorySchedules.find((item) => (
        !allowedTypes.includes(item.type)
        || !rankingCriteriaOptions.some((option) => option.value === item.rankingCriteria)
        || !item.date
        || !["4", "6", 4, 6].includes(item.winningScore)
        || Boolean(item.endDate && item.endDate < item.date)
        || Boolean(item.registrationDeadline && item.registrationDeadline > item.date)
      ));
      if (incompleteCategory) {
        showNotice("warning", "Categoria incompleta", `Revise modalidade, data e critério de ${incompleteCategory.category}.`);
        return;
      }
    }

    setSaving(true);

    const eventGroupKey = isMultiCategory ? generatePublicId() : null;
    const config = modalityConfig[newType];
    const categoryStartDates = isMultiCategory
      ? validCategorySchedules.map((item) => item.date).filter(Boolean).sort()
      : [];
    const categoryEndDates = isMultiCategory
      ? validCategorySchedules.map((item) => item.endDate || item.date).filter(Boolean).sort()
      : [];
    const eventStartDate = isMultiCategory ? categoryStartDates[0] : newDate;
    const eventEndDate = isMultiCategory ? categoryEndDates[categoryEndDates.length - 1] : (newEndDate || newDate);

    const baseData = {
      eventName: newName.trim(),
      eventGroupKey,
      multiCategoryEvent: isMultiCategory,
      eventStartDate,
      eventEndDate,
      eventGroupStartDate: isMultiCategory ? eventStartDate : "",
      eventGroupEndDate: isMultiCategory ? eventEndDate : "",
      eventPeriodLabel: eventEndDate && eventEndDate !== eventStartDate ? `${formatDateBR(eventStartDate)} até ${formatDateBR(eventEndDate)}` : formatDateBR(eventStartDate),
      registrationDeadline: isMultiCategory ? "" : newRegistrationDeadline,
      location: isMultiCategory ? "" : newLocation.trim(),
      publicInfo: buildTournamentPublicInfo(),
      coverImageUrl: newCoverImageUrl,
      eventCoverImageUrl: newCoverImageUrl,
      winningScore: isMultiCategory ? 4 : (Number(newWinningScore) || 4),
      rankingCriteria: isMultiCategory ? defaultRankingCriteria : newRankingCriteria,
      publishedOnProfile: true,
      publishedAt: new Date().toISOString(),
    };

    const rowsToInsert = isMultiCategory
      ? validCategorySchedules.map((item) => {
        const categoryType = item.type;
        const categoryConfig = modalityConfig[categoryType];
        return ({
          user_id: user.id,
          public_id: generatePublicId(),
          is_public: true,
          name: item.category.trim(),
          type: categoryType,
          data: {
            ...createInitialData(categoryType, categoryConfig),
            ...baseData,
            gender: item.category.trim(),
            eventDate: item.date,
            eventStartDate: item.date,
            eventEndDate: item.endDate || item.date,
            registrationDeadline: item.registrationDeadline,
            eventDay: getWeekdayBR(item.date),
            eventStartTime: item.time,
            location: item.location.trim(),
            winningScore: Number(item.winningScore) || 4,
            rankingCriteria: item.rankingCriteria,
            coverImageUrl: item.coverImageUrl || newCoverImageUrl,
            usesEventCover: !item.coverImageUrl,
          },
          status: "active",
        });
      })
      : [{
          user_id: user.id,
          public_id: generatePublicId(),
          is_public: true,
          name: newName.trim(),
          type: newType,
          data: {
            ...createInitialData(newType, config),
            ...baseData,
            gender: newGender,
            eventDate: newDate,
            eventDay: getWeekdayBR(newDate),
            eventStartTime: newEventStartTime,
          },
          status: "active",
        }];

    const { data: createdTournaments, error } = await supabase
      .from("tournaments")
      .insert(rowsToInsert)
      .select("*");

    setSaving(false);

    if (error) {
      showNotice("error", "Erro ao criar torneio", "Tente novamente em alguns instantes.");
      console.error(error);
      return;
    }

    const manualOrderActive = hasSavedManualTournamentOrder(tournaments);
    const chronologicalInsertion = insertTournamentsByEventSchedule(tournaments, createdTournaments || []);
    const optimisticTournaments = manualOrderActive
      ? chronologicalInsertion.map((tournament, displayOrder) => ({
          ...tournament,
          data: { ...(tournament.data || {}), displayOrder, displayOrderMode: "manual" },
        }))
      : chronologicalInsertion;
    tournamentsRef.current = optimisticTournaments;
    setTournaments(optimisticTournaments);

    setNewName("");
    setNewType("");
setNewGender("");
setNewMultiCategoryEvent("nao");
setNewCategorySchedules([{
  category: "",
  date: "",
  endDate: "",
  registrationDeadline: "",
  time: "",
  type: "",
  location: "",
  winningScore: "4",
  rankingCriteria: "",
  coverImageUrl: "",
}]);
setNewDate("");
setNewEndDate("");
setNewRegistrationDeadline("");
setNewEventStartTime("");
setNewDailyStartTimes({});
setNewDay("");
setNewLocation("");
setNewCoverImageUrl("");
setNewWinningScore(4);
setNewRankingCriteria("");
setNewPublicInfo({
  showArenaName: true,
  showOrganizerName: true,
  showWhatsapp: true,
  showWhatsappGroupLink: true,
  showInstagram: true,
  showAddress: true,
  showMapsLink: true,
  showCityState: true,
});
    setCreateTournamentOpen(false);
    showNotice("success", isMultiCategory ? "Torneios criados" : "Torneio criado", isMultiCategory ? "As categorias foram criadas como torneios separados dentro do mesmo evento." : "O torneio foi criado com sucesso.");

    const createdIds = (createdTournaments || []).map((tournament) => tournament.id).filter(Boolean);
    if (createdIds.length) {
      setOpenTournamentIds((currentIds) => [...new Set([...currentIds, ...createdIds])].slice(-50));
      const firstCreatedTournament = optimisticTournaments.find((tournament) => tournament.id === createdIds[0])
        || createdTournaments[0];
      const savedNavigation = openTournamentNavigationRef.current[firstCreatedTournament.id] || {};
      updateAppUrl({
        activePanel: "criar",
        selectedTournamentId: firstCreatedTournament.id,
        tournamentTab: savedNavigation.tournamentTab || DEFAULT_TOURNAMENT_NAVIGATION.tournamentTab,
        matchesTab: savedNavigation.matchesTab || DEFAULT_TOURNAMENT_NAVIGATION.matchesTab,
      });
      setSelected(firstCreatedTournament);
      queueScrollRestore(savedNavigation.scrollY || 0);
    }

    void (async () => {
      let tournamentsForDirectory = optimisticTournaments;
      if (manualOrderActive) {
        const savedOrder = await persistTournamentOrderSequence(optimisticTournaments, { manual: true });
        if (savedOrder.error) console.error("Erro ao posicionar os novos torneios por data e hora:", savedOrder.error);
        else tournamentsForDirectory = savedOrder.tournaments;
      }
      await syncPublicArenaDirectory(tournamentsForDirectory, circuits, {
        updateLocalState: false,
        protectConcurrentData: true,
      });
    })().catch((backgroundError) => {
      console.error("Erro na sincronização posterior à criação do torneio:", backgroundError);
    });
  }

  async function confirmDeleteTournament() {
    if (!deleteTarget) return;
    if (!ensureCloudConnection("mover o torneio para a lixeira")) return;

    const target = deleteTarget;
    const previousTournaments = tournaments;
    const previousTrashTournaments = trashTournaments;
    const previousOpenTournamentIds = openTournamentIds;
    const deletedAt = new Date().toISOString();
    const deletedTournament = {
      ...target,
      is_public: false,
      data: { ...(target.data || {}), deletedAt },
      updated_at: deletedAt,
    };
    const remainingTournaments = tournaments.filter((tournament) => tournament.id !== target.id);

    setDeleteTarget(null);
    setTournaments(remainingTournaments);
    setTrashTournaments((current) => [
      deletedTournament,
      ...current.filter((tournament) => tournament.id !== target.id),
    ]);
    setOpenTournamentIds((current) => current.filter((id) => id !== target.id));

    let deleteUpdate = supabase
      .from("tournaments")
      .update({
        is_public: false,
        data: deletedTournament.data,
        updated_at: deletedAt,
      })
      .eq("id", target.id)
      .eq("user_id", user.id);
    const targetRevision = getCollaborationRevision(target);
    if (targetRevision !== null) deleteUpdate = deleteUpdate.eq("revision", targetRevision);
    else if (target.updated_at) deleteUpdate = deleteUpdate.eq("updated_at", target.updated_at);
    const { data: movedTournament, error } = await deleteUpdate.select("*").maybeSingle();

    if (error || !movedTournament) {
      setTournaments(previousTournaments);
      setTrashTournaments(previousTrashTournaments);
      tournamentsRef.current = previousTournaments;
      trashTournamentsRef.current = previousTrashTournaments;
      setOpenTournamentIds(previousOpenTournamentIds);
      showNotice(
        error ? "error" : "warning",
        error ? "Erro ao mover" : "Torneio atualizado em outro dispositivo",
        error
          ? "Não foi possível mover este torneio para a lixeira."
          : "Recarregamos a proteção porque outra pessoa alterou o torneio. Confira a versão atual antes de excluí-lo."
      );
      console.error(error);
      return;
    }

    showNotice("success", "Torneio movido para a lixeira", "Você pode recuperar este torneio em até 30 dias.");

    void (async () => {
      const confirmedDeletedTournament = mergeRealtimeTournamentRow(deletedTournament, movedTournament);
      tournamentsRef.current = remainingTournaments;
      trashTournamentsRef.current = [
        confirmedDeletedTournament,
        ...trashTournamentsRef.current.filter((item) => item.id !== target.id),
      ];
      setTrashTournaments(trashTournamentsRef.current);

      let tournamentsForDirectory = remainingTournaments;
      if (hasSavedManualTournamentOrder(previousTournaments)) {
        const remainingOrder = await persistTournamentOrderSequence(remainingTournaments, { manual: true });
        if (remainingOrder.error) console.error("Erro ao compactar a ordem após excluir o torneio:", remainingOrder.error);
        else tournamentsForDirectory = remainingOrder.tournaments;
      }
      const { circuits: rankedCircuits } = await persistCircuitRankings(tournamentsForDirectory, circuits, target.id);
      await syncPublicArenaDirectory(tournamentsForDirectory, rankedCircuits, {
        updateLocalState: false,
        protectConcurrentData: true,
      });
    })().catch((backgroundError) => {
      console.error("Erro na sincronização posterior ao envio para a lixeira:", backgroundError);
    });
  }

  async function restoreTournament(tournament) {
    if (!ensureCloudConnection("recuperar o torneio")) return;
    const restoredData = { ...(tournament.data || {}) };
    delete restoredData.deletedAt;

    let restoreUpdate = supabase
      .from("tournaments")
      .update({
        public_id: tournament.public_id || generatePublicId(),
        is_public: true,
        data: restoredData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tournament.id)
      .eq("user_id", user.id);
    const tournamentRevision = getCollaborationRevision(tournament);
    if (tournamentRevision !== null) restoreUpdate = restoreUpdate.eq("revision", tournamentRevision);
    else if (tournament.updated_at) restoreUpdate = restoreUpdate.eq("updated_at", tournament.updated_at);
    const { data: restoredRow, error } = await restoreUpdate.select("*").maybeSingle();

    if (error || !restoredRow) {
      showNotice(
        error ? "error" : "warning",
        error ? "Erro ao recuperar" : "Torneio atualizado em outro dispositivo",
        error ? "Não foi possível recuperar este torneio." : "Atualize a lixeira e tente novamente."
      );
      console.error(error);
      return;
    }

    const restoredTournament = restoredRow;
    if (hasSavedManualTournamentOrder(tournaments)) {
      const restoredOrder = await persistTournamentOrderSequence(
        insertTournamentsByEventSchedule(tournaments, [restoredTournament]),
        { manual: true }
      );
      if (restoredOrder.error) console.error("Erro ao posicionar o torneio recuperado:", restoredOrder.error);
    }

    const refreshedTournaments = await loadTournaments();
    const { circuits: rankedCircuits } = await persistCircuitRankings(refreshedTournaments || [], circuits, tournament.id);
    await syncPublicArenaDirectory(refreshedTournaments || [], rankedCircuits);
    showNotice("success", "Torneio recuperado", "O torneio voltou para o histórico.");
  }

  function getTrashDaysLeft(tournament) {
    const baseDate = tournament.data?.deletedAt || tournament.updated_at || tournament.created_at;
    if (!baseDate) return 30;
    const deletedAt = new Date(baseDate).getTime();
    const expiresAt = deletedAt + 30 * 24 * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
  }

  function registerTournamentNavigationGuard(guard) {
    tournamentNavigationGuardRef.current = typeof guard === "function" ? guard : null;
  }

  function persistTournamentNavigation(tournamentId, updates = {}) {
    if (!tournamentId) return;
    const nextNavigation = {
      ...openTournamentNavigationRef.current,
      [tournamentId]: {
        ...(openTournamentNavigationRef.current[tournamentId] || {}),
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    };
    openTournamentNavigationRef.current = nextNavigation;
    saveOpenTournamentNavigation(user.id, nextNavigation);
  }

  function captureCurrentTournamentNavigation() {
    if (!selected?.id) return;
    const params = new URLSearchParams(window.location.search);
    persistTournamentNavigation(selected.id, {
      tournamentTab: params.get("tab") || "participantes",
      matchesTab: params.get("partidas") || "grupos",
      scrollY: Math.max(0, Math.round(window.scrollY || 0)),
    });
  }

  async function activateTournament(tournament, { skipSaveGuard = false } = {}) {
    if (!tournament?.id) return false;
    if (selected?.id === tournament.id) return true;

    if (!skipSaveGuard && selected?.id) {
      captureCurrentTournamentNavigation();
      const canNavigate = tournamentNavigationGuardRef.current
        ? await tournamentNavigationGuardRef.current()
        : true;
      if (!canNavigate) return false;
    }

    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", tournament.id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      showNotice("error", "Erro ao abrir", "Não foi possível abrir este torneio.");
      console.error(error);
      return false;
    }

    const savedNavigation = openTournamentNavigationRef.current[data.id] || {};

    updateAppUrl({
      activePanel: "criar",
      selectedTournamentId: data.id,
      tournamentTab: savedNavigation.tournamentTab || DEFAULT_TOURNAMENT_NAVIGATION.tournamentTab,
      matchesTab: savedNavigation.matchesTab || DEFAULT_TOURNAMENT_NAVIGATION.matchesTab,
    });
    setOpenTournamentIds((currentIds) => currentIds.includes(data.id)
      ? currentIds
      : [...currentIds, data.id].slice(-50));
    setSelected(data);
    queueScrollRestore(savedNavigation.scrollY || 0);
    return true;
  }

  async function openTournament(tournament) {
    return activateTournament(tournament);
  }

  async function closeOpenTournament(tournament) {
    if (!tournament?.id) return false;
    const closingIndex = openTournamentIds.indexOf(tournament.id);
    const remainingIds = openTournamentIds.filter((id) => id !== tournament.id);

    if (selected?.id !== tournament.id) {
      setOpenTournamentIds(remainingIds);
      return true;
    }

    captureCurrentTournamentNavigation();
    const canNavigate = tournamentNavigationGuardRef.current
      ? await tournamentNavigationGuardRef.current()
      : true;
    if (!canNavigate) return false;

    tournamentNavigationGuardRef.current = null;
    const fallbackId = remainingIds[Math.min(Math.max(closingIndex, 0), remainingIds.length - 1)]
      || remainingIds[remainingIds.length - 1];
    const fallbackTournament = tournaments.find((item) => item.id === fallbackId);

    if (fallbackTournament) {
      const switched = await activateTournament(fallbackTournament, { skipSaveGuard: true });
      if (!switched) return false;
    } else {
      closeSelectedTournament();
    }

    setOpenTournamentIds((currentIds) => currentIds.filter((id) => id !== tournament.id));
    return true;
  }

  async function saveTournament(updated) {
    if (isBrowserOffline()) return { ok: false, retryable: true, offline: true };

    const saveResult = await persistTournamentSnapshot(updated, {
      expectedUpdatedAt: updated.updated_at || null,
      expectedRevision: getCollaborationRevision(updated),
    });
    if (!saveResult.ok) return saveResult;

    const persistedTournament = saveResult.tournament;
    setSelected((current) => current?.id === persistedTournament.id
      ? mergeRealtimeTournamentRow(current, persistedTournament)
      : current);
    const nextTournaments = tournamentsRef.current.map((t) => (
      t.id === persistedTournament.id ? mergeRealtimeTournamentRow(t, persistedTournament) : t
    ));
    tournamentsRef.current = nextTournaments;
    setTournaments(nextTournaments);
    void saveDashboardCache(user.id, {
      tournaments: nextTournaments,
      trashTournaments: trashTournamentsRef.current,
      circuits: circuitsRef.current,
    });
    void (async () => {
      const criteriaCircuits = await syncAutomaticCircuitCriteria(nextTournaments, circuitsRef.current);
      const circuitPersistence = await persistCircuitRankings(
        nextTournaments,
        criteriaCircuits || circuitsRef.current,
        persistedTournament.id
      );
      if (!circuitPersistence.success) {
        showNotice(
          "warning",
          "Placar salvo; ranking pendente",
          "O torneio foi salvo, mas o ranking do circuito não pôde ser sincronizado agora. Mantenha esta tela aberta e tente novamente."
        );
      }
      await saveDashboardCache(user.id, {
        tournaments: tournamentsRef.current,
        trashTournaments: trashTournamentsRef.current,
        circuits: circuitsRef.current,
      });
    })().catch((error) => {
      console.error("Erro ao atualizar o ranking derivado do circuito:", error);
    });
    return { ok: true, tournament: persistedTournament };
  }

  function openEditTournament(tournament) {
    const details = tournament.data || {};
    setEditTarget(tournament);
    setEditForm({
      name: tournament.name || "",
      type: tournament.type || "",
      eventName: details.eventName || "",
      gender: details.gender || "",
      eventDate: details.eventDate || "",
      eventEndDate: details.eventEndDate || details.eventDate || "",
      registrationDeadline: details.registrationDeadline || "",
      eventStartTime: details.eventStartTime || "",
      location: details.location || "",
      coverImageUrl: details.coverImageUrl || "",
      winningScore: Number(details.winningScore || 4),
      rankingCriteria: details.rankingCriteria || defaultRankingCriteria,
    });
  }

  function updateEditForm(field, value) {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  }

  async function saveEditedTournament() {
    if (!editTarget || !editForm) return;
    if (!ensureCloudConnection("salvar as informações do torneio")) return;

    if (!editForm.name.trim()) {
      showNotice("warning", "Nome obrigatório", "Digite um nome para este torneio.");
      return;
    }

    if (!editForm.eventDate || (!editTarget.data?.multiCategoryEvent && !editForm.eventEndDate)) {
      showNotice("warning", "Datas obrigatórias", "Informe a data de início e a data de encerramento do torneio.");
      return;
    }

    if (editForm.eventDate && editForm.eventEndDate && editForm.eventEndDate < editForm.eventDate) {
      showNotice("warning", "Período inválido", "A data final não pode ser anterior à data inicial.");
      return;
    }

    const isGroupedCategory = Boolean(editTarget.data?.multiCategoryEvent);
    const updatedData = {
      ...(editTarget.data || {}),
      eventName: editForm.eventName.trim(),
      gender: editForm.gender,
      eventDate: editForm.eventDate,
      eventStartDate: editForm.eventDate,
      eventEndDate: isGroupedCategory ? editForm.eventDate : (editForm.eventEndDate || editForm.eventDate),
      eventPeriodLabel: isGroupedCategory
        ? formatDateBR(editForm.eventDate)
        : editForm.eventEndDate && editForm.eventEndDate !== editForm.eventDate
          ? `${formatDateBR(editForm.eventDate)} até ${formatDateBR(editForm.eventEndDate)}`
          : formatDateBR(editForm.eventDate),
      eventDay: isGroupedCategory
        ? getWeekdayBR(editForm.eventDate)
        : editForm.eventEndDate && editForm.eventEndDate !== editForm.eventDate
          ? `${getWeekdayBR(editForm.eventDate)} até ${getWeekdayBR(editForm.eventEndDate)}`
          : getWeekdayBR(editForm.eventDate),
      registrationDeadline: editForm.registrationDeadline,
      eventStartTime: editForm.eventStartTime,
      location: editForm.location.trim(),
      coverImageUrl: editForm.coverImageUrl || "",
      winningScore: Number(editForm.winningScore) || 4,
      rankingCriteria: editForm.rankingCriteria || defaultRankingCriteria,
    };

    const statusCandidate = {
      ...editTarget,
      name: editForm.name.trim(),
      type: editForm.type,
      data: updatedData,
    };
    const lifecycleStatus = getTournamentLifecycleStatus(statusCandidate);
    const updated = {
      ...statusCandidate,
      status: lifecycleStatus === "finished" ? "finished" : "active",
      data: { ...updatedData, lifecycleStatus },
    };

    let finalUpdated = updated;
    let mergeBase = editTarget;
    let saveResult = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      saveResult = await persistTournamentSnapshot(finalUpdated, {
        expectedUpdatedAt: mergeBase.updated_at || null,
        expectedRevision: getCollaborationRevision(mergeBase),
      });
      if (saveResult.ok || !saveResult.conflict || !saveResult.serverTournament) break;

      const remoteTournament = saveResult.serverTournament;
      const merged = mergeConcurrentTournamentData(
        { name: mergeBase.name, type: mergeBase.type, data: mergeBase.data || {} },
        { name: finalUpdated.name, type: finalUpdated.type, data: finalUpdated.data || {} },
        {
          name: remoteTournament.name,
          type: remoteTournament.type,
          data: remoteTournament.data || {},
        }
      );
      finalUpdated = {
        ...remoteTournament,
        name: merged.data.name,
        type: merged.data.type,
        data: merged.data.data,
      };
      mergeBase = remoteTournament;
    }

    if (!saveResult?.ok) {
      if (saveResult?.conflict) {
        showNotice(
          "warning",
          "Sincronização ainda em andamento",
          "As informações foram preservadas. Tente salvar novamente; a alteração mais recente será aplicada automaticamente."
        );
      } else {
        console.error(saveResult?.error);
        showNotice("error", "Erro ao salvar", "Não foi possível atualizar este torneio.");
      }
      return;
    }

    finalUpdated = saveResult.tournament;

    const manualOrderActive = hasSavedManualTournamentOrder(tournaments);
    const nextTournaments = manualOrderActive
      ? tournaments.map((tournament) => tournament.id === finalUpdated.id ? finalUpdated : tournament)
      : sortTournamentsByEventSchedule(tournaments.map((tournament) => tournament.id === finalUpdated.id ? finalUpdated : tournament));
    const savedOrder = manualOrderActive
      ? await persistTournamentOrderSequence(nextTournaments, { manual: true })
      : { tournaments: nextTournaments, error: null };
    const orderedTournaments = savedOrder.error ? nextTournaments : savedOrder.tournaments;
    if (savedOrder.error) console.error("Erro ao preservar a ordem manual do torneio atualizado:", savedOrder.error);
    setTournaments(orderedTournaments);
    const criteriaCircuits = await syncAutomaticCircuitCriteria(orderedTournaments);
    const { circuits: rankedCircuits, success: circuitRankingSaved } = await persistCircuitRankings(
      orderedTournaments,
      criteriaCircuits || circuits,
      finalUpdated.id
    );
    await syncPublicArenaDirectory(orderedTournaments, rankedCircuits);
    setEditTarget(null);
    setEditForm(null);
    showNotice(
      circuitRankingSaved ? "success" : "warning",
      circuitRankingSaved ? "Torneio atualizado" : "Torneio atualizado; ranking pendente",
      circuitRankingSaved
        ? "As informações foram atualizadas com sucesso."
        : "Os dados do torneio foram salvos, mas o ranking do circuito precisa de uma nova tentativa."
    );
  }

  function openEditEventGroup(group) {
    const groupItems = tournaments.filter((tournament) => (
      tournament.data?.multiCategoryEvent === true
      && tournament.data?.eventGroupKey === group.key
    ));
    const firstTournament = groupItems[0] || group.items[0];
    const firstDetails = firstTournament?.data || {};
    const eventCoverImageUrl = firstDetails.eventCoverImageUrl || firstDetails.coverImageUrl || "";

    setEditEventGroup({
      key: group.key,
      eventName: firstDetails.eventName || group.name || "",
      coverImageUrl: eventCoverImageUrl,
      publicInfo: firstDetails.publicInfo || buildTournamentPublicInfo(),
      categories: (groupItems.length ? groupItems : group.items).map((tournament) => {
        const details = tournament.data || {};
        const usesEventCover = details.usesEventCover === true
          || (!details.usesEventCover && Boolean(eventCoverImageUrl) && details.coverImageUrl === eventCoverImageUrl);
        return {
          key: tournament.id,
          id: tournament.id,
          original: tournament,
          name: tournament.name || details.gender || "",
          gender: details.gender || tournament.name || "",
          type: tournament.type || "",
          eventDate: details.eventDate || "",
          eventEndDate: details.eventEndDate || details.eventDate || "",
          registrationDeadline: details.registrationDeadline || "",
          eventStartTime: details.eventStartTime || "",
          location: details.location || "",
          winningScore: Number(details.winningScore || 4),
          rankingCriteria: details.rankingCriteria || defaultRankingCriteria,
          coverImageUrl: usesEventCover ? "" : (details.coverImageUrl || ""),
          usesEventCover,
          removed: false,
          hasGeneratedGames: Boolean(details.schedule?.length || details.brackets?.length),
        };
      }),
    });
  }

  function updateEventGroupField(field, value) {
    setEditEventGroup((current) => ({ ...current, [field]: value }));
  }

  function updateEventGroupCategory(key, field, value) {
    setEditEventGroup((current) => ({
      ...current,
      categories: current.categories.map((category) => (
        category.key === key
          ? { ...category, [field]: value, ...(field === "name" ? { gender: value } : {}) }
          : category
      )),
    }));
  }

  function addEventGroupCategory() {
    setEditEventGroup((current) => ({
      ...current,
      categories: [
        ...current.categories,
        {
          key: `new-${generatePublicId()}`,
          id: null,
          original: null,
          name: "",
          gender: "",
          type: "",
          eventDate: "",
          eventEndDate: "",
          registrationDeadline: "",
          eventStartTime: "",
          location: "",
          winningScore: 4,
          rankingCriteria: "",
          coverImageUrl: "",
          usesEventCover: true,
          removed: false,
          hasGeneratedGames: false,
        },
      ],
    }));
  }

  function toggleEventGroupCategoryRemoved(key) {
    setEditEventGroup((current) => {
      const category = current.categories.find((item) => item.key === key);
      if (!category) return current;
      if (!category.removed && current.categories.filter((item) => !item.removed).length <= 1) {
        showNotice("warning", "Uma categoria é obrigatória", "O evento precisa permanecer com pelo menos uma categoria.");
        return current;
      }
      if (!category.id) {
        return { ...current, categories: current.categories.filter((item) => item.key !== key) };
      }
      return {
        ...current,
        categories: current.categories.map((item) => (
          item.key === key ? { ...item, removed: !item.removed } : item
        )),
      };
    });
  }

  async function saveEditedEventGroup() {
    if (!editEventGroup || editEventGroupSaving) return;
    if (!ensureCloudConnection("salvar o evento completo")) return;

    const activeCategories = editEventGroup.categories.filter((category) => !category.removed);
    if (!editEventGroup.eventName.trim()) {
      showNotice("warning", "Nome obrigatório", "Digite o nome geral do evento.");
      return;
    }

    const invalidCategory = activeCategories.find((category) => (
      !category.name.trim()
      || (!allowedTypes.includes(category.type) && category.original?.type !== category.type)
      || !category.eventDate
      || !rankingCriteriaOptions.some((option) => option.value === category.rankingCriteria)
      || ![4, 6].includes(Number(category.winningScore))
      || Boolean(category.eventEndDate && category.eventEndDate < category.eventDate)
      || Boolean(category.registrationDeadline && category.registrationDeadline > category.eventDate)
      || Boolean(category.hasGeneratedGames && category.original?.type !== category.type)
    ));

    if (invalidCategory) {
      showNotice(
        "warning",
        "Categoria incompleta",
        invalidCategory.hasGeneratedGames && invalidCategory.original?.type !== invalidCategory.type
          ? `A modalidade de ${invalidCategory.name} não pode ser trocada porque já existem jogos.`
          : `Revise nome, modalidade, data, games e critério de ${invalidCategory.name || "uma categoria"}.`
      );
      return;
    }

    setEditEventGroupSaving(true);
    const startDates = activeCategories.map((category) => category.eventDate).sort();
    const endDates = activeCategories.map((category) => category.eventEndDate || category.eventDate).sort();
    const groupStartDate = startDates[0];
    const groupEndDate = endDates[endDates.length - 1];
    const savedRows = [];

    for (const category of activeCategories.filter((item) => item.id)) {
      const original = category.original;
      const updatedData = {
        ...(original.data || {}),
        eventName: editEventGroup.eventName.trim(),
        eventGroupKey: editEventGroup.key,
        multiCategoryEvent: true,
        eventGroupStartDate: groupStartDate,
        eventGroupEndDate: groupEndDate,
        eventPeriodLabel: groupEndDate !== groupStartDate
          ? `${formatDateBR(groupStartDate)} até ${formatDateBR(groupEndDate)}`
          : formatDateBR(groupStartDate),
        eventCoverImageUrl: editEventGroup.coverImageUrl || "",
        usesEventCover: category.usesEventCover,
        gender: category.gender.trim() || category.name.trim(),
        eventDate: category.eventDate,
        eventStartDate: category.eventDate,
        eventEndDate: category.eventEndDate || category.eventDate,
        eventDay: getWeekdayBR(category.eventDate),
        registrationDeadline: category.registrationDeadline,
        eventStartTime: category.eventStartTime,
        location: category.location.trim(),
        winningScore: Number(category.winningScore) || 4,
        rankingCriteria: category.rankingCriteria,
        coverImageUrl: category.usesEventCover ? (editEventGroup.coverImageUrl || "") : category.coverImageUrl,
      };
      const result = await persistTournamentSnapshot({
        ...original,
        name: category.name.trim(),
        type: category.type,
        data: updatedData,
      }, {
        expectedUpdatedAt: original.updated_at || null,
        expectedRevision: getCollaborationRevision(original),
      });

      if (!result.ok) {
        setEditEventGroupSaving(false);
        await loadTournaments({ silentError: true });
        showNotice("error", "Evento não concluído", "Uma categoria foi alterada em outro dispositivo ou não pôde ser salva. Revise o conjunto e tente novamente.");
        return;
      }
      savedRows.push(result.tournament);
    }

    const newCategories = activeCategories.filter((item) => !item.id);
    if (newCategories.length > 0) {
      const rows = newCategories.map((category) => ({
        user_id: user.id,
        public_id: generatePublicId(),
        is_public: true,
        name: category.name.trim(),
        type: category.type,
        data: {
          ...createInitialData(category.type, modalityConfig[category.type]),
          eventName: editEventGroup.eventName.trim(),
          eventGroupKey: editEventGroup.key,
          multiCategoryEvent: true,
          eventGroupStartDate: groupStartDate,
          eventGroupEndDate: groupEndDate,
          eventPeriodLabel: groupEndDate !== groupStartDate
            ? `${formatDateBR(groupStartDate)} até ${formatDateBR(groupEndDate)}`
            : formatDateBR(groupStartDate),
          eventCoverImageUrl: editEventGroup.coverImageUrl || "",
          usesEventCover: category.usesEventCover,
          publicInfo: editEventGroup.publicInfo,
          publishedOnProfile: true,
          publishedAt: new Date().toISOString(),
          gender: category.gender.trim() || category.name.trim(),
          eventDate: category.eventDate,
          eventStartDate: category.eventDate,
          eventEndDate: category.eventEndDate || category.eventDate,
          eventDay: getWeekdayBR(category.eventDate),
          registrationDeadline: category.registrationDeadline,
          eventStartTime: category.eventStartTime,
          location: category.location.trim(),
          winningScore: Number(category.winningScore) || 4,
          rankingCriteria: category.rankingCriteria,
          coverImageUrl: category.usesEventCover ? (editEventGroup.coverImageUrl || "") : category.coverImageUrl,
        },
        status: "active",
      }));
      const { data: insertedRows, error } = await supabase.from("tournaments").insert(rows).select("*");
      if (error) {
        setEditEventGroupSaving(false);
        await loadTournaments({ silentError: true });
        showNotice("error", "Categoria não adicionada", "As alterações existentes foram preservadas, mas não foi possível adicionar a nova categoria.");
        return;
      }
      savedRows.push(...(insertedRows || []));
    }

    for (const category of editEventGroup.categories.filter((item) => item.id && item.removed)) {
      const deletedAt = new Date().toISOString();
      const { error } = await supabase
        .from("tournaments")
        .update({
          is_public: false,
          data: { ...(category.original.data || {}), deletedAt },
          updated_at: deletedAt,
        })
        .eq("id", category.id)
        .eq("user_id", user.id);
      if (error) console.error("Erro ao mover categoria removida para a lixeira:", error);
    }

    const refreshedTournaments = await loadTournaments({ silentError: true }) || tournamentsRef.current;
    const criteriaCircuits = await syncAutomaticCircuitCriteria(refreshedTournaments, circuitsRef.current);
    const { circuits: rankedCircuits } = await persistCircuitRankings(
      refreshedTournaments,
      criteriaCircuits || circuitsRef.current
    );
    await syncPublicArenaDirectory(refreshedTournaments, rankedCircuits);
    setEditEventGroupSaving(false);
    setEditEventGroup(null);
    showNotice("success", "Evento atualizado", "Os dados gerais e as categorias foram salvos em conjunto.");
  }

  function getEventDateRange() {
    if (!newDate) return [];

    const endDate = newEndDate || newDate;
    if (endDate < newDate) return [];

    const dates = [];
    const current = new Date(`${newDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    while (current <= end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  const eventDateRange = getEventDateRange();
  const isMultiDayEvent = eventDateRange.length > 1;

  function updateDailyStartTime(date, time) {
    setNewDailyStartTimes((prev) => ({ ...prev, [date]: time }));
  }

  function updateCategorySchedule(index, field, value) {
    setNewCategorySchedules((prev) =>
      prev.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item)
    );
  }

  function addCategorySchedule() {
    setNewCategorySchedules((prev) => [...prev, {
      category: "",
      date: "",
      endDate: "",
      registrationDeadline: "",
      time: "",
      type: "",
      location: "",
      winningScore: "4",
      rankingCriteria: "",
      coverImageUrl: "",
    }]);
  }

  function removeCategorySchedule(index) {
    setNewCategorySchedules((prev) => prev.length <= 1 ? prev : prev.filter((_, itemIndex) => itemIndex !== index));
  }

  function duplicateCategorySchedule(index) {
    setNewCategorySchedules((prev) => {
      const source = prev[index] || {};
      const copy = { ...source, category: "" };
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
  }

  async function moveTournamentByDrag(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    if (!ensureCloudConnection("alterar a ordem dos torneios")) return;

    const previousTournaments = tournaments;
    const list = [...previousTournaments];
    const fromIndex = list.findIndex((item) => item.id === fromId);
    const toIndex = list.findIndex((item) => item.id === toId);

    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

    const [item] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, item);
    setTournaments(list);

    const savedOrder = await persistTournamentOrderSequence(list, { manual: true });
    const { error } = savedOrder;

    if (error) {
      console.error("Erro ao salvar a ordem dos torneios:", error);
      setTournaments(previousTournaments);
      showNotice("error", "Ordem não salva", "Não foi possível manter a nova posição dos torneios.");
      return;
    }

    setTournaments(savedOrder.tournaments);

    showNotice("success", "Ordem atualizada", "A posição dos torneios será mantida ao atualizar a página.");
  }
  function closeSelectedTournament() {
    captureCurrentTournamentNavigation();
    tournamentNavigationGuardRef.current = null;
    updateAppUrl({ activePanel: "criar", selectedTournamentId: null });
    saveUserAppState({ activePanel: "criar", selectedTournamentId: null });
    setSelected(null);
  }

  function rememberTournamentNavigation({ tournamentId, tournamentTab, matchesTab }) {
    persistTournamentNavigation(tournamentId, {
      tournamentTab: tournamentTab || "participantes",
      matchesTab: matchesTab || "grupos",
      scrollY: Math.max(0, Math.round(window.scrollY || 0)),
    });
    saveUserAppState({
      activePanel: "criar",
      selectedTournamentId: tournamentId,
      tournamentTab,
      matchesTab,
    });
  }

  function renderAppSidebar() {
    const navItems = [
      { panel: "inicio", label: "Visão geral", Icon: LayoutDashboard },
      { panel: "criar", label: "Torneios", Icon: Trophy },
      { panel: "circuitos", label: "Circuitos", Icon: GitBranch },
      { panel: "modalidades", label: "Modalidades", Icon: Shapes },
    ];

    return (
      <aside className="playSidebar proSidebar" aria-label="Navegação principal">
        <span className="sidebarSectionLabel">Menu</span>
        <nav className="sidebarNav">
          {navItems.map(({ panel, label, Icon }) => (
            <button
              key={panel}
              className={`playNavItem ${activePanel === panel ? "active" : ""}`}
              type="button"
              onClick={() => goToPanel(panel)}
              aria-current={activePanel === panel ? "page" : undefined}
              title={label}
            >
              <span className="navIcon" aria-hidden="true"><Icon /></span>
              <small>{label}</small>
            </button>
          ))}
        </nav>
        <div className="sidebarBrandAccent" aria-hidden="true">
          <span />
          <small>Torneio 360</small>
        </div>
      </aside>
    );
  }

  async function logoutSafely() {
    if (!await guardSelectedTournamentBeforeLeaving()) return;

    if (listLocalTournamentDrafts(user.id).length > 0) {
      if (isBrowserOffline()) {
        showNotice(
          "warning",
          "Sincronize antes de sair",
          "Há alterações protegidas somente neste aparelho. Reconecte-se para enviá-las à nuvem antes de encerrar a sessão."
        );
        return;
      }

      await syncPendingTournamentDrafts(tournamentsRef.current);
      if (listLocalTournamentDrafts(user.id).length > 0) {
        showNotice(
          "warning",
          "Alterações ainda pendentes",
          "Alguns dados precisam ser revisados ou sincronizados. Abra o torneio indicado antes de sair."
        );
        return;
      }
    }

    await logout();
  }

  function renderAppTopbar() {
    const syncStatus = !networkOnline
      ? {
          className: "offline",
          label: pendingSyncCount > 0 ? `${pendingSyncCount} pendente(s) no aparelho` : "Modo offline",
          Icon: CloudOff,
        }
      : pendingSyncCount > 0
        ? { className: "pending", label: "Sincronizando dados", Icon: RefreshCw }
        : { className: "synced", label: "Dados sincronizados", Icon: CloudCheck };
    const SyncStatusIcon = syncStatus.Icon;

    return (
      <header className="playTopbar proTopbar">
        <div className="playTopBrand">
          <BeachLogo />
          <div className="brandTaglineOnly">
            <span>{TORNEIO360_TAGLINE}</span>
          </div>
        </div>

        <div className="playUserBox proTopActions">
          <div
            className={`cloudSyncStatus ${syncStatus.className}`}
            role="status"
            aria-live="polite"
            title={syncStatus.label}
          >
            <SyncStatusIcon aria-hidden="true" />
            <span>{syncStatus.label}</span>
          </div>
          <button
            type="button"
            className="themeToggleButton"
            onClick={toggleColorMode}
            aria-label={colorMode === "dark" ? "Ativar modo claro" : "Ativar modo noturno"}
            aria-pressed={colorMode === "dark"}
            title={colorMode === "dark" ? "Modo claro" : "Modo noturno"}
          >
            {colorMode === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            <span>{colorMode === "dark" ? "Modo claro" : "Modo noturno"}</span>
          </button>

          <div className="profileMenuWrap" ref={profileMenuRef}>
            <div className={`profileControl ${activePanel === "ajustes" || activePanel === "lixeira" ? "accountAreaActive" : ""}`}>
              <button type="button" className="profileTrigger" onClick={openProfileSettings} title="Abrir configurações do perfil">
                <span className="profileAvatar" aria-hidden="true">
                  {organizerProfile.photoUrl ? <img src={organizerProfile.photoUrl} alt="" /> : <span>{profileInitials}</span>}
                </span>
                <span className="profileTriggerCopy">
                  <strong>{profileDisplayName}</strong>
                  <small>Configurações do perfil</small>
                </span>
              </button>
              <button
                type="button"
                className="profileMenuToggle"
                onClick={() => setProfileMenuOpen((open) => !open)}
                aria-label="Abrir menu da conta"
                aria-expanded={profileMenuOpen}
              >
                <ChevronDown aria-hidden="true" />
              </button>
            </div>

            {profileMenuOpen ? (
              <div className="profileDropdown" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className={`profileDropdownItem ${activePanel === "ajustes" && profileSubtab !== "conta" ? "profileDropdownCurrent" : ""}`}
                  onClick={openProfileSettings}
                  aria-current={activePanel === "ajustes" && profileSubtab !== "conta" ? "page" : undefined}
                >
                  <Settings aria-hidden="true" />
                  <span><strong>Meu perfil</strong><small>Dados e foto da arena</small></span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={`profileDropdownItem ${activePanel === "ajustes" && profileSubtab === "conta" ? "profileDropdownCurrent" : ""}`}
                  onClick={() => openProfileSection("conta")}
                  aria-current={activePanel === "ajustes" && profileSubtab === "conta" ? "page" : undefined}
                >
                  <LifeBuoy aria-hidden="true" />
                  <span><strong>Ajuda e suporte</strong><small>WhatsApp, Instagram e e-mail</small></span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={`profileDropdownItem ${activePanel === "lixeira" ? "profileDropdownCurrent" : ""}`}
                  onClick={() => { setProfileMenuOpen(false); goToPanel("lixeira"); }}
                  aria-current={activePanel === "lixeira" ? "page" : undefined}
                >
                  <Trash2 aria-hidden="true" />
                  <span><strong>Lixeira</strong><small>Itens excluídos recentemente</small></span>
                </button>
                <div className="profileDropdownDivider" />
                <button type="button" role="menuitem" className="profileDropdownItem profileDropdownLogout" onClick={logoutSafely}>
                  <LogOut aria-hidden="true" />
                  <span><strong>Sair</strong><small>Encerrar esta sessão</small></span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
    );
  }

  function renderDataSafetyBanner() {
    if (networkOnline && !dashboardUsingOfflineCache && pendingSyncCount === 0) return null;

    return (
      <aside className={`dataSafetyBanner ${networkOnline ? "pending" : "offline"}`} role="status" aria-live="polite">
        {networkOnline ? <RefreshCw aria-hidden="true" /> : <CloudOff aria-hidden="true" />}
        <div>
          <strong>{networkOnline ? "Sincronização em andamento" : "Você está sem internet"}</strong>
          <span>
            {networkOnline
              ? "As alterações guardadas neste aparelho estão sendo conferidas com a nuvem."
              : "Você pode continuar no torneio aberto. Nomes, sorteios, rodadas e placares ficam protegidos neste aparelho e serão enviados quando a conexão voltar."}
          </span>
        </div>
      </aside>
    );
  }

  if (selected) {
    return (
      <div className={`playAppShell proDashboard theme-${colorMode}`}>
        <NoticeModal notice={notice} onClose={() => setNotice(null)} />
        {renderAppSidebar()}
        <div className="playMain">
          {renderAppTopbar()}
          {renderDataSafetyBanner()}
          <TournamentWorkspaceTabs
            tournaments={tournaments}
            openTournamentIds={openTournamentIds}
            activeTournamentId={selected.id}
            onSelectTournament={openTournament}
            onCloseTournament={closeOpenTournament}
          />
          <main className="playContent tournamentWorkspaceContent">
            <TournamentErrorBoundary tournamentId={selected.id} onBack={closeSelectedTournament}>
              <TournamentScreen
                key={selected.id}
                tournament={selected}
                userId={user.id}
                onBack={closeSelectedTournament}
                onSave={saveTournament}
                onNavigationStateChange={rememberTournamentNavigation}
                onRegisterNavigationGuard={registerTournamentNavigationGuard}
              />
            </TournamentErrorBoundary>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className={`playAppShell proDashboard theme-${colorMode}`}>
      <NoticeModal notice={notice} onClose={() => setNotice(null)} />

      <ConfirmModal
        target={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteTournament}
      />

      <ConfirmCircuitDeleteModal
        target={circuitDeleteTarget}
        onCancel={() => setCircuitDeleteTarget(null)}
        onConfirm={deleteCircuit}
      />

      {editTarget && editForm ? (
        <div className="editTournamentOverlay" role="dialog" aria-modal="true">
          <div className="editTournamentModal">
            <div className="editTournamentHeader">
              <div>
                <h2>Editar torneio</h2>
                <p>Atualize as informações principais deste torneio.</p>
              </div>
              <button type="button" className="secondaryBtn" onClick={() => { setEditTarget(null); setEditForm(null); }}>Fechar</button>
            </div>

            <div className="editTournamentGrid">
              <div className="formField">
                <label>Nome do evento/torneio</label>
                <input value={editForm.name} onChange={(e) => updateEditForm("name", e.target.value)} />
              </div>

              <div className="formField">
                <label>Categoria/Gênero</label>
                <input value={editForm.gender} onChange={(e) => updateEditForm("gender", e.target.value)} placeholder="Ex: Masculino iniciante" />
              </div>

              <div className="formField">
                <label>Modalidade</label>
                <select value={editForm.type} onChange={(e) => updateEditForm("type", e.target.value)}>
                  {!allowedTypes.includes(editForm.type) && (
                    <option value={editForm.type}>{getModalityDisplayName(editForm.type)} (modalidade legada)</option>
                  )}
                  {allowedTypes.map((type) => <option key={type} value={type}>{getModalityDisplayName(type)}</option>)}
                </select>
              </div>

              <div className="formField">
                <label>Local</label>
                <input value={editForm.location} onChange={(e) => updateEditForm("location", e.target.value)} />
              </div>

              <div className="formField fullField tournamentCoverField">
                <div className="tournamentCoverIntro">
                  <div>
                    <strong><Camera aria-hidden="true" /> Foto do torneio</strong>
                    <span>Esta imagem identifica o evento no perfil público da arena.</span>
                  </div>
                  {editForm.coverImageUrl ? <button type="button" className="removePhotoBtn" onClick={() => updateEditForm("coverImageUrl", "")}>Remover foto</button> : null}
                </div>
                <label className={`tournamentCoverDropzone ${editForm.coverImageUrl ? "hasImage" : ""}`}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => void prepareTournamentCover(event.target.files?.[0], (imageUrl) => updateEditForm("coverImageUrl", imageUrl))}
                  />
                  {editForm.coverImageUrl ? <img src={editForm.coverImageUrl} alt="Prévia da foto do torneio" /> : <span><Camera aria-hidden="true" /> {coverImageLoading ? "Preparando imagem..." : "Escolher foto do evento"}</span>}
                </label>
              </div>

              <div className="formField">
                <label>Início</label>
                <input className="clickableDateInput" type="date" required value={editForm.eventDate} onClick={openDatePicker} onFocus={openDatePicker} onChange={(e) => updateEditForm("eventDate", e.target.value)} />
              </div>

              {!editTarget.data?.multiCategoryEvent && (
              <div className="formField">
                <label>Fim</label>
                <input className="clickableDateInput" type="date" required value={editForm.eventEndDate} min={editForm.eventDate || undefined} onClick={openDatePicker} onFocus={openDatePicker} onChange={(e) => updateEditForm("eventEndDate", e.target.value)} />
              </div>
              )}

              <div className="formField">
                <label>Encerramento das inscrições</label>
                <input className="clickableDateInput" type="date" value={editForm.registrationDeadline} onClick={openDatePicker} onFocus={openDatePicker} onChange={(e) => updateEditForm("registrationDeadline", e.target.value)} />
              </div>

              <div className="formField">
                <label>Horário de início</label>
                <input type="time" value={editForm.eventStartTime} onChange={(e) => updateEditForm("eventStartTime", e.target.value)} />
              </div>

              <div className="formField">
                <label>Set para vencer</label>
                <select value={editForm.winningScore} onChange={(e) => updateEditForm("winningScore", Number(e.target.value))}>
                  <option value={4}>4 games</option>
                  <option value={6}>6 games</option>
                </select>
              </div>

              <div className="formField fullField">
                <label>Critério do ranking</label>
                <select value={editForm.rankingCriteria} onChange={(e) => updateEditForm("rankingCriteria", e.target.value)}>
                  {rankingCriteriaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            </div>

            <div className="editTournamentActions">
              <button type="button" className="cancelBtn" onClick={() => { setEditTarget(null); setEditForm(null); }}>Cancelar</button>
              <button type="button" onClick={saveEditedTournament}>Salvar alterações</button>
            </div>
          </div>
        </div>
      ) : null}

      {editEventGroup ? (
        <div className="editTournamentOverlay" role="dialog" aria-modal="true" aria-labelledby="edit-event-group-title">
          <div className="editTournamentModal editEventGroupModal">
            <div className="editTournamentHeader">
              <div>
                <span className="modalEyebrow">Evento com várias categorias</span>
                <h2 id="edit-event-group-title">Editar evento completo</h2>
                <p>Altere os dados gerais e todas as categorias sem abrir cada torneio separadamente.</p>
              </div>
              <button type="button" className="secondaryBtn" onClick={() => setEditEventGroup(null)} disabled={editEventGroupSaving}>Fechar</button>
            </div>

            <section className="eventGroupGeneralFields">
              <div className="formField">
                <label>Nome geral do evento</label>
                <input value={editEventGroup.eventName} onChange={(event) => updateEventGroupField("eventName", event.target.value)} />
              </div>

              <div className="formField tournamentCoverField">
                <div className="tournamentCoverIntro">
                  <div>
                    <strong><Camera aria-hidden="true" /> Foto geral do evento</strong>
                    <span>As categorias configuradas para usar a foto geral serão atualizadas juntas.</span>
                  </div>
                  {editEventGroup.coverImageUrl ? <button type="button" className="removePhotoBtn" onClick={() => updateEventGroupField("coverImageUrl", "")}>Remover foto</button> : null}
                </div>
                <label className={`tournamentCoverDropzone ${editEventGroup.coverImageUrl ? "hasImage" : ""}`}>
                  <input type="file" accept="image/*" onChange={(event) => void prepareTournamentCover(event.target.files?.[0], (value) => updateEventGroupField("coverImageUrl", value))} />
                  {editEventGroup.coverImageUrl
                    ? <img src={editEventGroup.coverImageUrl} alt="Prévia da foto geral do evento" />
                    : <span><Camera aria-hidden="true" /> Escolher foto geral</span>}
                </label>
              </div>
            </section>

            <div className="eventGroupEditIntro">
              <div>
                <strong>Categorias do evento</strong>
                <span>Modalidade, local, datas, games e critério são definidos em cada categoria.</span>
              </div>
              <button type="button" className="secondaryBtn" onClick={addEventGroupCategory}>+ Adicionar categoria</button>
            </div>

            <div className="eventGroupCategoryEditorList">
              {editEventGroup.categories.map((category, index) => (
                <section className={`eventGroupCategoryEditor ${category.removed ? "removed" : ""}`} key={category.key}>
                  <header>
                    <div>
                      <span>Categoria {index + 1}</span>
                      <strong>{category.name || "Nova categoria"}</strong>
                    </div>
                    <button
                      type="button"
                      className={category.removed ? "secondaryBtn" : "deleteBtn"}
                      onClick={() => toggleEventGroupCategoryRemoved(category.key)}
                    >
                      {category.removed ? "Restaurar" : category.id ? "Mover para lixeira" : "Remover"}
                    </button>
                  </header>

                  {category.removed ? (
                    <p className="eventGroupRemovalNotice">Esta categoria será movida para a lixeira quando as alterações forem salvas.</p>
                  ) : (
                    <div className="editTournamentGrid eventGroupCategoryFields">
                      <div className="formField">
                        <label>Categoria/Gênero</label>
                        <input value={category.name} onChange={(event) => updateEventGroupCategory(category.key, "name", event.target.value)} />
                      </div>
                      <div className="formField">
                        <label>Modalidade</label>
                        <select value={category.type} disabled={category.hasGeneratedGames} onChange={(event) => updateEventGroupCategory(category.key, "type", event.target.value)}>
                          <option value="">Escolha a modalidade</option>
                          {!allowedTypes.includes(category.type) && category.type ? <option value={category.type}>{getModalityDisplayName(category.type)} (legada)</option> : null}
                          {allowedTypes.map((type) => <option key={type} value={type}>{getModalityDisplayName(type)}</option>)}
                        </select>
                        {category.hasGeneratedGames ? <small>A modalidade fica protegida porque esta categoria já possui jogos.</small> : null}
                      </div>
                      <div className="formField">
                        <label>Início</label>
                        <input className="clickableDateInput" type="date" value={category.eventDate} onClick={openDatePicker} onFocus={openDatePicker} onChange={(event) => updateEventGroupCategory(category.key, "eventDate", event.target.value)} />
                      </div>
                      <div className="formField">
                        <label>Fim</label>
                        <input className="clickableDateInput" type="date" min={category.eventDate || undefined} value={category.eventEndDate} onClick={openDatePicker} onFocus={openDatePicker} onChange={(event) => updateEventGroupCategory(category.key, "eventEndDate", event.target.value)} />
                      </div>
                      <div className="formField">
                        <label>Inscrições até</label>
                        <input className="clickableDateInput" type="date" max={category.eventDate || undefined} value={category.registrationDeadline} onClick={openDatePicker} onFocus={openDatePicker} onChange={(event) => updateEventGroupCategory(category.key, "registrationDeadline", event.target.value)} />
                      </div>
                      <div className="formField">
                        <label>Horário</label>
                        <input type="time" value={category.eventStartTime} onChange={(event) => updateEventGroupCategory(category.key, "eventStartTime", event.target.value)} />
                      </div>
                      <div className="formField">
                        <label>Local</label>
                        <input value={category.location} onChange={(event) => updateEventGroupCategory(category.key, "location", event.target.value)} />
                      </div>
                      <div className="formField">
                        <label>Set para vencer</label>
                        <select value={category.winningScore} onChange={(event) => updateEventGroupCategory(category.key, "winningScore", Number(event.target.value))}>
                          <option value={4}>4 games</option>
                          <option value={6}>6 games</option>
                        </select>
                      </div>
                      <div className="formField fullField">
                        <label>Critério do ranking</label>
                        <select value={category.rankingCriteria} onChange={(event) => updateEventGroupCategory(category.key, "rankingCriteria", event.target.value)}>
                          <option value="">Escolha o critério</option>
                          {rankingCriteriaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </div>
                      <div className="formField fullField categoryEditCoverField">
                        <label className="eventCoverToggle">
                          <input type="checkbox" checked={category.usesEventCover} onChange={(event) => updateEventGroupCategory(category.key, "usesEventCover", event.target.checked)} />
                          Usar a foto geral do evento
                        </label>
                        {!category.usesEventCover ? (
                          <label className={`categoryCoverPicker ${category.coverImageUrl ? "hasImage" : ""}`}>
                            <input type="file" accept="image/*" onChange={(event) => void prepareTournamentCover(event.target.files?.[0], (value) => updateEventGroupCategory(category.key, "coverImageUrl", value))} />
                            {category.coverImageUrl ? <img src={category.coverImageUrl} alt={`Foto de ${category.name || "categoria"}`} /> : <span><Camera aria-hidden="true" /> Escolher foto própria</span>}
                          </label>
                        ) : null}
                      </div>
                    </div>
                  )}
                </section>
              ))}
            </div>

            <div className="editTournamentActions eventGroupEditActions">
              <button type="button" className="secondaryBtn" onClick={() => setEditEventGroup(null)} disabled={editEventGroupSaving}>Cancelar</button>
              <button type="button" onClick={saveEditedEventGroup} disabled={editEventGroupSaving}>
                {editEventGroupSaving ? "Salvando conjunto..." : "Salvar evento completo"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {circuitEditForm ? (
        <div className="editTournamentOverlay" role="dialog" aria-modal="true" aria-labelledby="edit-circuit-title">
          <div className="editTournamentModal circuitEditModal">
            <div className="editTournamentHeader">
              <div>
                <span className="modalEyebrow">Circuitos</span>
                <h2 id="edit-circuit-title">Editar circuito</h2>
                <p>Atualize os dados e os torneios vinculados sem sair desta tela.</p>
              </div>
              <button type="button" className="secondaryBtn" onClick={() => setCircuitEditForm(null)}>Fechar</button>
            </div>

            <div className="editTournamentGrid circuitEditGrid">
              <div className="formField fullField">
                <label>Nome do circuito</label>
                <input value={circuitEditForm.name} onChange={(e) => setCircuitEditForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Ex: Circuito Verão" />
              </div>
              <div className="formField">
                <label>Data inicial</label>
                <input className="clickableDateInput" type="date" required value={circuitEditForm.startDate} onClick={openDatePicker} onFocus={openDatePicker} onChange={(e) => setCircuitEditForm((prev) => ({ ...prev, startDate: e.target.value }))} />
              </div>
              <div className="formField">
                <label>Data final</label>
                <input className="clickableDateInput" type="date" required value={circuitEditForm.endDate} min={circuitEditForm.startDate || undefined} onClick={openDatePicker} onFocus={openDatePicker} onChange={(e) => setCircuitEditForm((prev) => ({ ...prev, endDate: e.target.value }))} />
              </div>
              <div className="formField fullField">
                <label>Situação automática</label>
                <div className="automaticStatusField">{getAutomaticEventStatus(circuitEditForm.endDate) === "finished" ? "Encerrado" : "Ativo"}</div>
              </div>
            </div>

            <div className="circuitTournamentPicker circuitEditTournamentPicker">
              <div className="circuitPickerTitle">
                <strong>Torneios deste circuito</strong>
                <span>{circuitEditForm.tournamentIds.length} selecionado(s)</span>
              </div>
              {tournaments.length === 0 ? (
                <p>Nenhum torneio criado ainda.</p>
              ) : (
                <div className="circuitTournamentList">
                  {tournaments.map((t) => {
                    const details = t.data || {};
                    const checked = circuitEditForm.tournamentIds.includes(t.id);
                    return (
                      <label className={`circuitTournamentOption ${checked ? "selected" : ""}`} key={t.id}>
                        <input type="checkbox" checked={checked} onChange={() => toggleCircuitTournament(t.id, true)} />
                        <span className="circuitCheckVisual">{checked ? "✓" : ""}</span>
                        <span className="circuitTournamentText">
                          <strong>{details.eventName || t.name}</strong>
                          <small>{[t.name, getModalityDisplayName(t.type), details.eventDate ? formatDateBR(details.eventDate) : null].filter(Boolean).join(" · ")}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="circuitCriteriaCard circuitCriteriaCardModal">
              <div>
                <strong>Critério do ranking</strong>
                <p>O modo automático acompanha os torneios vinculados.</p>
              </div>
              <label className="circuitAutomaticToggle">
                <input
                  type="checkbox"
                  checked={circuitEditForm.rankingCriteriaMode !== "manual"}
                  onChange={(event) => setCircuitEditForm((prev) => ({
                    ...prev,
                    rankingCriteriaMode: event.target.checked ? "automatic" : "manual",
                    rankingCriteria: event.target.checked ? getCircuitCriteriaInfo(prev.tournamentIds).value : prev.rankingCriteria,
                  }))}
                />
                Acompanhar automaticamente
              </label>
              <select
                value={circuitEditForm.rankingCriteriaMode === "manual" ? circuitEditForm.rankingCriteria : getCircuitCriteriaInfo(circuitEditForm.tournamentIds).value}
                disabled={circuitEditForm.rankingCriteriaMode !== "manual"}
                onChange={(event) => setCircuitEditForm((prev) => ({ ...prev, rankingCriteria: event.target.value }))}
              >
                {rankingCriteriaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              {circuitEditForm.rankingCriteriaMode !== "manual" && getCircuitCriteriaInfo(circuitEditForm.tournamentIds).mixed ? (
                <small className="circuitCriteriaWarning">Há critérios diferentes. O primeiro torneio selecionado será usado como referência.</small>
              ) : null}
              <small className="circuitIdentityHint">
                O acumulado identifica atletas e duplas pelo nome. Use a mesma escrita em todas as etapas e diferencie homônimos pelo sobrenome.
              </small>
            </div>

            <div className="editTournamentActions">
              <button type="button" className="secondaryBtn" onClick={() => setCircuitEditForm(null)}>Cancelar</button>
              <button type="button" onClick={() => saveCircuit(circuitEditForm)}>Salvar alterações</button>
            </div>
          </div>
        </div>
      ) : null}

      {photoEditor ? (
        <div className="photoEditorOverlay" role="dialog" aria-modal="true">
          <div className="photoEditorModal">
            <h2>Ajustar foto de perfil</h2>
            <p>Arraste a imagem para alinhar. Use o movimento de pinça no celular ou a roda do mouse para aproximar.</p>
            <div
              ref={photoPreviewRef}
              className="photoEditorPreview"
              onPointerDown={handlePhotoPointerDown}
              onPointerMove={handlePhotoPointerMove}
              onPointerUp={handlePhotoPointerEnd}
              onPointerCancel={handlePhotoPointerEnd}
              onWheel={handlePhotoWheel}
            >
              <canvas ref={photoCanvasRef} aria-label="Prévia da foto ajustada" />
            </div>
            <div className="photoEditorHint">Toque e arraste para mover • Pinça ou roda do mouse para zoom</div>
            <div className="photoZoomButtons" aria-label="Controles de zoom">
              <button type="button" className="secondaryBtn" onClick={() => nudgePhotoZoom(-0.12)}>−</button>
              <span>{Math.round((photoEditor.zoom || 1) * 100)}%</span>
              <button type="button" className="secondaryBtn" onClick={() => nudgePhotoZoom(0.12)}>+</button>
            </div>
            <div className="photoEditorActions">
              <button type="button" className="cancelBtn" onClick={() => setPhotoEditor(null)}>Cancelar</button>
              <button type="button" onClick={applyEditedOrganizerPhoto}>Aplicar foto</button>
            </div>
          </div>
        </div>
      ) : null}

      {renderAppSidebar()}

      <div className="playMain">
        {renderAppTopbar()}
        {renderDataSafetyBanner()}

        <main className="playContent">
          <section className="playTitleBlock">
            <div>
              <span className="pageEyebrow">Painel de gestão</span>
              <h1>{currentPanelMeta.title}</h1>
              <p>{currentPanelMeta.description}</p>
            </div>
            <div className="playPlanPill">Plano {profile.plan} · {formatStatusBR(profile.status)}</div>
          </section>

          {freeTrialDetails ? <FreeTrialNotice details={freeTrialDetails} /> : null}

          {activePanel === "inicio" && (
            <>
              <section className="playTabs homeQuickActions homeQuickActionsThree" aria-label="Ações rápidas">
                <button type="button" className="primaryQuickAction" onClick={() => goToPanel("criar")}><PlusCircle aria-hidden="true" /> Novo torneio</button>
                <button type="button" onClick={() => goToPanel("circuitos")}><GitBranch aria-hidden="true" /> Circuitos</button>
                <button type="button" onClick={() => goToPanel("modalidades")}><Shapes aria-hidden="true" /> Modalidades</button>
              </section>

              <section className="playStatsGrid">
                <div><strong>{tournaments.length}</strong><span>Torneios criados</span></div>
                <div><strong>{circuits.length}</strong><span>Circuitos cadastrados</span></div>
                <div><strong>{allowedTypes.length}</strong><span>Modalidades disponíveis</span></div>
              </section>
            </>
          )}

{activePanel === "inicio" && selectedArenaProfile ? (
<section className="arenaPublicPage card">
  <button type="button" className="arenaPublicBackBtn" onClick={closeArenaProfilePage}>← Voltar para arenas</button>

  <div className="arenaPublicHero">
    <div className="arenaPublicPhoto">
      {selectedArenaProfile.photo_url ? (
        <img src={selectedArenaProfile.photo_url} alt={selectedArenaProfile.arena_name || selectedArenaProfile.name || "Arena"} />
      ) : (
        <span>{(selectedArenaProfile.arena_name || selectedArenaProfile.name || "Arena").slice(0, 2).toUpperCase()}</span>
      )}
    </div>
    <div className="arenaPublicInfo">
      <span>Arena verificada</span>
      <h2>{selectedArenaProfile.arena_name || selectedArenaProfile.name || "Arena cadastrada"}</h2>
      <p>{[selectedArenaProfile.city, selectedArenaProfile.state].filter(Boolean).join("/") || "Local não informado"}</p>
      <small>Organizador: {selectedArenaProfile.name || "Não informado"}</small>
    </div>
  </div>

  <div className="arenaPublicDetailsGrid">
    {selectedArenaProfile.address ? <div><strong>Endereço</strong><span><MapPin aria-hidden="true" /> {selectedArenaProfile.address}</span></div> : null}
    {selectedArenaProfile.phone ? <div><strong>WhatsApp</strong><span>{selectedArenaProfile.phone}</span></div> : null}
    {selectedArenaProfile.instagram_handle ? <div><strong>Instagram</strong><span>{selectedArenaProfile.instagram_handle}</span></div> : null}
  </div>

  <div className="arenaPublicLinksTitle">Links</div>

  <div className="arenaProfileLinks arenaPublicLinks">
    {selectedArenaProfile.instagram_link ? (
      <a href={selectedArenaProfile.instagram_link} target="_blank" rel="noreferrer">Instagram</a>
    ) : selectedArenaProfile.instagram_handle ? (
      <a href={"https://instagram.com/" + String(selectedArenaProfile.instagram_handle).replace("@", "")} target="_blank" rel="noreferrer">Instagram</a>
    ) : null}
    {selectedArenaProfile.whatsapp_group_link ? <a href={selectedArenaProfile.whatsapp_group_link} target="_blank" rel="noreferrer">Grupo WhatsApp</a> : null}
    {selectedArenaProfile.phone ? <a href={getBrazilianWhatsAppUrl(selectedArenaProfile.phone)} target="_blank" rel="noreferrer">WhatsApp</a> : null}
    {selectedArenaProfile.maps_link ? <a href={selectedArenaProfile.maps_link} target="_blank" rel="noreferrer">Google Maps</a> : null}
  </div>

  <div className="arenaProfilePublicationsHeader arenaPublicPublicationsHeader">
    <strong>Campeonatos publicados</strong>
    <span>{selectedArenaTournaments.length} publicação(ões)</span>
  </div>

  {selectedArenaLoading ? (
    <div className="arenaProfileEmpty">Carregando publicações...</div>
  ) : selectedArenaTournaments.length === 0 ? (
    <div className="arenaProfileEmpty">Esta arena ainda não publicou torneios.</div>
  ) : (
    <div className="arenaPublicTournamentGrid">
      {selectedArenaTournaments.map((t) => {
        const details = t.data || {};
        return (
          <article className="arenaPublicTournamentCard" key={t.id}>
            <div>
              <strong>{t.name}</strong>
              <small>{getModalityDisplayName(t.type)}</small>
            </div>
            <div className="tournamentMeta">
              {details.eventDate ? <span><CalendarDays aria-hidden="true" /> {formatDateBR(details.eventDate)}</span> : null}
              {details.eventStartTime ? <span><Clock3 aria-hidden="true" /> {details.eventStartTime}</span> : null}
              {details.location ? <span><MapPin aria-hidden="true" /> {details.location}</span> : null}
              {details.gender ? <span><Tag aria-hidden="true" /> {details.gender}</span> : null}
            </div>
            {selectedArenaProfile.whatsapp_group_link ? (
              <button type="button" onClick={() => window.open(selectedArenaProfile.whatsapp_group_link, "_blank", "noopener,noreferrer")}>Inscreva-se</button>
            ) : selectedArenaProfile.phone ? (
              <button type="button" onClick={() => window.open(getBrazilianWhatsAppUrl(selectedArenaProfile.phone), "_blank", "noopener,noreferrer")}>Inscreva-se</button>
            ) : (
              <span className="arenaTournamentDraftBadge">Inscrições pelo organizador</span>
            )}
          </article>
        );
      })}
    </div>
  )}
</section>
) : activePanel === "inicio" && (
<section className="arenaFeedSection">
  <div className="arenaSearchRow">
    <div className="arenaSearchBox platformSearchBox">
      <input
        value={arenaProfileSearch}
        onChange={(e) => setArenaProfileSearch(e.target.value)}
        placeholder="Busque perfis públicos da plataforma..."
      />
      <span>🔍</span>
    </div>

    <button
      type="button"
      className="mapsMiniBtn"
      onClick={() => window.open("https://www.google.com/maps/search/arena+beach+tennis+perto+de+mim", "_blank", "noopener,noreferrer")}
    >
      Google Maps
    </button>
  </div>

  <div className="arenaFeedGrid">
    {filteredArenaProfiles.map((arena) => (
      <article className="arenaFeedCard" key={arena.id}>
        <div className="arenaFeedCover registeredArenaCover">
          {arena.photo_url ? <img src={arena.photo_url} alt={arena.arena_name || arena.name || "Arena"} /> : <span>{(arena.arena_name || arena.name || "Arena").slice(0, 2).toUpperCase()}</span>}
        </div>
        <strong>{arena.arena_name || arena.name || "Arena cadastrada"}</strong>
        <small className="arenaFeedOrganizer"><UserRound aria-hidden="true" /> Organizador: {arena.name || "Não informado"}</small>
        <small><MapPin aria-hidden="true" /> {[arena.city, arena.state].filter(Boolean).join("/") || "Local não informado"}</small>
        <button type="button" onClick={() => openArenaProfile(arena)}>Acessar arena</button>
      </article>
    ))}
  </div>
</section>
)}

    {activePanel === "criar" && (
    <>
    <section className="card eventManagerToolbar">
      <div>
        <span className="managerEyebrow">Organização dos eventos</span>
        <h2>Meus torneios</h2>
        <p>Acompanhe os eventos em andamento, os próximos e o histórico encerrado.</p>
      </div>
      <button type="button" onClick={() => setCreateTournamentOpen(true)}>+ Criar torneio</button>
    </section>

    {createTournamentOpen ? (
    <div className="eventEditorOverlay" role="dialog" aria-modal="true" aria-label="Criar torneio">
    <section className="card playCreateCard eventEditorSheet">
  <div className="eventEditorHeading">
    <div><span className="managerEyebrow">Novo evento</span><h2>Criar novo torneio</h2></div>
    <button type="button" className="secondaryBtn" onClick={() => setCreateTournamentOpen(false)}>Fechar</button>
  </div>

  <div className="formField">
    <label>Nome do evento/torneio</label>
    <input
      value={newName}
      onChange={(e) => setNewName(e.target.value)}
      placeholder="Ex: Campeão Open"
    />
  </div>

  <div className="formField">
    <label>Evento com várias categorias e/ou em mais de um dia?</label>
    <select value={newMultiCategoryEvent} onChange={(e) => setNewMultiCategoryEvent(e.target.value)}>
      <option value="nao">Não</option>
      <option value="sim">Sim</option>
    </select>
  </div>

  {newMultiCategoryEvent === "nao" && (
  <div className="formField">
    <label>Categoria/Gênero</label>
    <input
      value={newGender}
      onChange={(e) => setNewGender(e.target.value)}
      placeholder="Ex: Masculino iniciante"
    />
  </div>
  )}

  {newMultiCategoryEvent === "sim" && (
  <div className="formField fullField eventScheduleBox">
    <div className="eventScheduleHeader">
      <strong><Tag aria-hidden="true" /> Torneios deste evento</strong>
      <span>Cada categoria pode ter modalidade, local, data, horário, games, critério e foto próprios.</span>
    </div>

    <div className="categoryScheduleList">
      {newCategorySchedules.map((item, index) => (
        <div className="categoryScheduleItem categoryTournamentCard" key={index}>
          <div className="formField compactField">
            <label>Categoria/Gênero</label>
            <input value={item.category} onChange={(e) => updateCategorySchedule(index, "category", e.target.value)} placeholder="Ex: Masculino iniciante" />
          </div>

          <div className="formField compactField categoryWideField">
            <label>Modalidade</label>
            <select value={item.type} onChange={(e) => updateCategorySchedule(index, "type", e.target.value)}>
              <option value="">Escolha a modalidade</option>
              {allowedTypes.map((type) => <option key={type} value={type}>{getModalityDisplayName(type)}</option>)}
            </select>
          </div>

          <div className="formField compactField">
            <label>Data</label>
            <input className="clickableDateInput" type="date" value={item.date} onClick={openDatePicker} onFocus={openDatePicker} onChange={(e) => updateCategorySchedule(index, "date", e.target.value)} />
          </div>

          <div className="formField compactField">
            <label>Fim desta categoria</label>
            <input className="clickableDateInput" type="date" value={item.endDate} min={item.date || newDate || undefined} onClick={openDatePicker} onFocus={openDatePicker} onChange={(e) => updateCategorySchedule(index, "endDate", e.target.value)} />
          </div>

          <div className="formField compactField">
            <label>Inscrições até</label>
            <input className="clickableDateInput" type="date" value={item.registrationDeadline} max={item.date || newDate || undefined} onClick={openDatePicker} onFocus={openDatePicker} onChange={(e) => updateCategorySchedule(index, "registrationDeadline", e.target.value)} />
          </div>

          <div className="formField compactField">
            <label>Horário</label>
            <input type="time" value={item.time} onChange={(e) => updateCategorySchedule(index, "time", e.target.value)} />
          </div>

          <div className="formField compactField categoryWideField">
            <label>Local</label>
            <input value={item.location} onChange={(e) => updateCategorySchedule(index, "location", e.target.value)} placeholder="Ex: Arena Beach Sports" />
          </div>

          <div className="formField compactField">
            <label>Set para vencer</label>
            <select value={item.winningScore} onChange={(e) => updateCategorySchedule(index, "winningScore", e.target.value)}>
              <option value="4">4 games</option>
              <option value="6">6 games</option>
            </select>
          </div>

          <div className="formField compactField categoryCriteriaField">
            <label>Critério do ranking</label>
            <select value={item.rankingCriteria} onChange={(e) => updateCategorySchedule(index, "rankingCriteria", e.target.value)}>
              <option value="">Escolha o critério</option>
              {rankingCriteriaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

          <label className={`categoryCoverPicker ${item.coverImageUrl ? "hasImage" : ""}`}>
            <input type="file" accept="image/*" onChange={(event) => void prepareTournamentCover(event.target.files?.[0], (value) => updateCategorySchedule(index, "coverImageUrl", value))} />
            {item.coverImageUrl
              ? <img src={item.coverImageUrl} alt={`Foto de ${item.category || `categoria ${index + 1}`}`} />
              : <span><Camera aria-hidden="true" /> Foto própria</span>}
          </label>

          <div className="categoryScheduleActions">
            <button type="button" className="secondaryBtn" onClick={() => duplicateCategorySchedule(index)}>Duplicar</button>
            <button type="button" className="deleteBtn" onClick={() => removeCategorySchedule(index)} disabled={newCategorySchedules.length <= 1}>Remover</button>
          </div>
        </div>
      ))}
    </div>

    <button type="button" className="secondaryBtn" onClick={addCategorySchedule}>
      + Adicionar categoria
    </button>
  </div>
  )}

  {newMultiCategoryEvent === "nao" && (
  <div className="formField fullField eventScheduleBox">
    <div className="eventScheduleHeader">
      <strong><CalendarDays aria-hidden="true" /> Datas e horários do evento</strong>
      <span>Organize o período do torneio, inscrições e início dos jogos.</span>
    </div>

    <div className="eventScheduleGrid">
      <div className="formField compactField">
        <label>Início do torneio</label>
        <input
          className="clickableDateInput"
          type="date"
          required
          value={newDate}
          onClick={openDatePicker}
          onFocus={openDatePicker}
          onChange={(e) => {
            setNewDate(e.target.value);
            if (newEndDate && e.target.value && newEndDate < e.target.value) setNewEndDate(e.target.value);
          }}
        />
      </div>

      <div className="formField compactField">
        <label>Fim do torneio</label>
        <input
          className="clickableDateInput"
          type="date"
          required
          value={newEndDate}
          onClick={openDatePicker}
          onFocus={openDatePicker}
          min={newDate || undefined}
          onChange={(e) => setNewEndDate(e.target.value)}
        />
      </div>

      <div className="formField compactField">
        <label>Encerramento das inscrições</label>
        <input
          className="clickableDateInput"
          type="date"
          value={newRegistrationDeadline}
          onClick={openDatePicker}
          onFocus={openDatePicker}
          max={newDate || undefined}
          onChange={(e) => setNewRegistrationDeadline(e.target.value)}
        />
      </div>

      {newMultiCategoryEvent === "nao" && (
      <div className="formField compactField">
        <label>{isMultiDayEvent ? "Horário padrão de início" : "Horário de início"}</label>
        <input
          type="time"
          value={newEventStartTime}
          onChange={(e) => setNewEventStartTime(e.target.value)}
        />
      </div>
      )}
    </div>

    {newMultiCategoryEvent === "nao" && isMultiDayEvent && (
      <div className="dailyTimesBox">
        <div className="dailyTimesIntro">
          <strong>Horário por dia</strong>
          <span>Use quando cada dia do torneio começar em um horário diferente.</span>
        </div>

        <div className="dailyTimesGrid">
          {eventDateRange.map((date) => (
            <div className="dailyTimeItem" key={date}>
              <label>{formatDateBR(date)} · {getWeekdayBR(date)}</label>
              <input
                type="time"
                value={newDailyStartTimes[date] || newEventStartTime}
                onChange={(e) => updateDailyStartTime(date, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
  )}

  <div className="formField fullField tournamentCoverField">
    <div className="tournamentCoverIntro">
      <div>
        <strong><Camera aria-hidden="true" /> {newMultiCategoryEvent === "sim" ? "Foto geral do evento" : "Foto do torneio"}</strong>
        <span>{newMultiCategoryEvent === "sim" ? "As categorias sem foto própria usarão esta imagem." : "Use uma foto específica do evento. Se não escolher, será usada a foto da arena."}</span>
      </div>
      {newCoverImageUrl ? <button type="button" className="removePhotoBtn" onClick={() => setNewCoverImageUrl("")}>Remover foto</button> : null}
    </div>
    <label className={`tournamentCoverDropzone ${newCoverImageUrl ? "hasImage" : ""}`}>
      <input
        type="file"
        accept="image/*"
        onChange={(event) => void prepareTournamentCover(event.target.files?.[0], setNewCoverImageUrl)}
      />
      {newCoverImageUrl ? <img src={newCoverImageUrl} alt="Prévia da foto do torneio" /> : <span><Camera aria-hidden="true" /> {coverImageLoading ? "Preparando imagem..." : "Escolher foto do evento"}</span>}
    </label>
  </div>

  {newMultiCategoryEvent === "nao" && (
  <>
  <div className="formField">
    <label>Local</label>
    <input
      value={newLocation}
      onChange={(e) => setNewLocation(e.target.value)}
      placeholder="Ex: Arena Beach Sports"
    />
  </div>

  <div className="formField fullField">
    <label>Modalidade</label>
    <select value={newType} onChange={(e) => setNewType(e.target.value)}>
      <option value="">Escolha a modalidade</option>
      {allowedTypes.map((type) => (
        <option key={type} value={type}>{getModalityDisplayName(type)}</option>
      ))}
    </select>
  </div>

  <div className="formField">
    <label>Set para vencer</label>
    <select value={newWinningScore} onChange={(e) => setNewWinningScore(Number(e.target.value))}>
      <option value={4}>4 games</option>
      <option value={6}>6 games</option>
    </select>
  </div>

  <div className="formField fullField">
    <label>Critério do ranking <span aria-hidden="true">*</span></label>
    <select value={newRankingCriteria} onChange={(e) => setNewRankingCriteria(e.target.value)} required aria-required="true">
      <option value="">Escolha a ordem dos critérios</option>
      {rankingCriteriaOptions.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  </div>
  </>
  )}

 <button type="button" onClick={createTournament} disabled={saving}>
  {saving ? "Salvando..." : "Criar torneio"}
</button>
      </section>
      </div>
      ) : null}

<section id="historico-torneios" className="card">
  <h2>Torneios cadastrados</h2>
  <div className="tournamentStatusSummary" aria-label="Filtrar torneios por situação">
    <button type="button" className={`active ${tournamentStatusFilter === "active" ? "selected" : ""}`} aria-pressed={tournamentStatusFilter === "active"} onClick={() => setTournamentStatusFilter("active")}>
      <strong>{tournamentLifecycleCounts.active}</strong> Em andamento
    </button>
    <button type="button" className={`upcoming ${tournamentStatusFilter === "upcoming" ? "selected" : ""}`} aria-pressed={tournamentStatusFilter === "upcoming"} onClick={() => setTournamentStatusFilter("upcoming")}>
      <strong>{tournamentLifecycleCounts.upcoming}</strong> Próximos
    </button>
    <button type="button" className={`finished ${tournamentStatusFilter === "finished" ? "selected" : ""}`} aria-pressed={tournamentStatusFilter === "finished"} onClick={() => setTournamentStatusFilter("finished")}>
      <strong>{tournamentLifecycleCounts.finished}</strong> Encerrados
    </button>
  </div>

  {tournaments.length === 0 ? (
    <p>Nenhum torneio criado ainda.</p>
  ) : organizerVisibleTournaments.length === 0 ? (
    <p className="eventStatusEmpty">Nenhum torneio {tournamentStatusFilter === "active" ? "em andamento" : tournamentStatusFilter === "upcoming" ? "próximo" : "encerrado"}.</p>
  ) : (
    <div className="eventGroupList">
      {isolatedTournaments.length > 0 && (
        <div className="tournamentList isolatedTournamentGrid">
          {isolatedTournaments.map((t) => {
            const details = t.data || {};

            return (
                <div
                  className={`tournamentItem ${draggedTournamentId ? "dragMode" : ""} ${draggedTournamentId === t.id ? "dragging" : ""} ${dragOverTournamentId === t.id && draggedTournamentId !== t.id ? "dropTarget" : ""}`}
                  key={t.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (draggedTournamentId && draggedTournamentId !== t.id) setDragOverTournamentId(t.id);
                  }}
                  onDrop={() => {
                    void moveTournamentByDrag(draggedTournamentId, t.id);
                    setDraggedTournamentId(null);
                    setDragOverTournamentId(null);
                  }}
                >
                  <button
                    type="button"
                    className="moveLineBtn"
                    title="Segure e arraste para reorganizar"
                    aria-label={`Mover ${t.name}`}
                    draggable
                    onDragStart={(e) => {
                      setDraggedTournamentId(t.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggedTournamentId(null);
                      setDragOverTournamentId(null);
                    }}
                  >
                    <span>—</span>
                    <span>—</span>
                    <span>—</span>
                  </button>

                  <div className="tournamentInfo">
                    <div className="tournamentTitleRow">
                      <strong>{t.name}</strong>
                      <span className="tournamentTypeBadge">{getModalityDisplayName(t.type)}</span>
                      <span className={`tournamentLifecycleBadge ${getTournamentLifecycleStatus(t)}`}>
                        {getTournamentLifecycleStatus(t) === "finished" ? "Encerrado" : getTournamentLifecycleStatus(t) === "upcoming" ? "Próximo" : "Em andamento"}
                      </span>
                    </div>

                    <div className="tournamentMeta">
                      {details.multiCategoryEvent ? <span><Grid3X3 aria-hidden="true" /> {details.eventName}</span> : null}
                      {details.gender ? <span><Tag aria-hidden="true" /> {details.gender}</span> : null}
                      {details.eventDate ? <span><CalendarDays aria-hidden="true" /> {formatDateBR(details.eventDate)}</span> : null}
                      {details.eventStartTime ? <span><Clock3 aria-hidden="true" /> {details.eventStartTime}</span> : null}
                      {details.location ? <span><MapPin aria-hidden="true" /> {details.location}</span> : null}
                      {details.winningScore ? <span><Target aria-hidden="true" /> {details.winningScore} games</span> : null}
                    </div>
                  </div>

                  <div className="tournamentActions">
                    <button type="button" className="editBtn" onClick={() => openEditTournament(t)}>Editar</button>
                    <button type="button" onClick={() => openTournament(t)}>Abrir</button>
                    <button type="button" className="shareTournamentBtn" onClick={shareArenaProfile}><Share2 aria-hidden="true" /> Compartilhar</button>
                    <button type="button" className="deleteBtn" onClick={() => setDeleteTarget(t)}>Excluir</button>
                  </div>
                </div>
            );
          })}
        </div>
      )}

      {multiTournamentGroups.map((group) => (
        <div className="eventGroupCard" key={group.key}>
          <div className="eventGroupHeader">
            <div>
              <strong>{group.name}</strong>
              <span>{group.items.length} {group.items.length === 1 ? "categoria" : "categorias"}</span>
            </div>
            <button type="button" className="editEventGroupBtn" onClick={() => openEditEventGroup(group)}>
              Editar evento completo
            </button>
          </div>

          <div className="tournamentList eventTournamentGrid">
            {group.items.map((t) => {
              const details = t.data || {};

              return (
                <div
                  className={`tournamentItem ${draggedTournamentId ? "dragMode" : ""} ${draggedTournamentId === t.id ? "dragging" : ""} ${dragOverTournamentId === t.id && draggedTournamentId !== t.id ? "dropTarget" : ""}`}
                  key={t.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (draggedTournamentId && draggedTournamentId !== t.id) setDragOverTournamentId(t.id);
                  }}
                  onDrop={() => {
                    void moveTournamentByDrag(draggedTournamentId, t.id);
                    setDraggedTournamentId(null);
                    setDragOverTournamentId(null);
                  }}
                >
                  <button
                    type="button"
                    className="moveLineBtn"
                    title="Segure e arraste para reorganizar"
                    aria-label={`Mover ${t.name}`}
                    draggable
                    onDragStart={(e) => {
                      setDraggedTournamentId(t.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggedTournamentId(null);
                      setDragOverTournamentId(null);
                    }}
                  >
                    <span>—</span>
                    <span>—</span>
                    <span>—</span>
                  </button>

                  <div className="tournamentInfo">
                    <div className="tournamentTitleRow">
                      <strong>{t.name}</strong>
                      <span className="tournamentTypeBadge">{getModalityDisplayName(t.type)}</span>
                      <span className={`tournamentLifecycleBadge ${getTournamentLifecycleStatus(t)}`}>
                        {getTournamentLifecycleStatus(t) === "finished" ? "Encerrado" : getTournamentLifecycleStatus(t) === "upcoming" ? "Próximo" : "Em andamento"}
                      </span>
                    </div>

                    <div className="tournamentMeta">
                      {details.multiCategoryEvent ? <span><Grid3X3 aria-hidden="true" /> {details.eventName}</span> : null}
                      {details.gender ? <span><Tag aria-hidden="true" /> {details.gender}</span> : null}
                      {details.eventDate ? <span><CalendarDays aria-hidden="true" /> {formatDateBR(details.eventDate)}</span> : null}
                      {details.eventStartTime ? <span><Clock3 aria-hidden="true" /> {details.eventStartTime}</span> : null}
                      {details.location ? <span><MapPin aria-hidden="true" /> {details.location}</span> : null}
                      {details.winningScore ? <span><Target aria-hidden="true" /> {details.winningScore} games</span> : null}
                    </div>
                  </div>

                  <div className="tournamentActions">
                    <button type="button" className="editBtn" onClick={() => openEditTournament(t)}>Editar</button>
                    <button type="button" onClick={() => openTournament(t)}>Abrir</button>
                    <button type="button" className="shareTournamentBtn" onClick={shareArenaProfile}><Share2 aria-hidden="true" /> Compartilhar</button>
                    <button type="button" className="deleteBtn" onClick={() => setDeleteTarget(t)}>Excluir</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  )}
</section>
    </>
    )}


{activePanel === "circuitos" && (
  <div className="circuitManagerPage">
  <section className="card eventManagerToolbar circuitManagerToolbar">
    <div>
      <span className="managerEyebrow">Temporadas e etapas</span>
      <h2>Meus circuitos</h2>
      <p>Organize torneios relacionados e acompanhe o ranking geral acumulado.</p>
    </div>
    <button type="button" onClick={() => setCreateCircuitOpen(true)}>+ Criar circuito</button>
  </section>

  {createCircuitOpen ? (
  <div className="eventEditorOverlay" role="dialog" aria-modal="true" aria-label="Criar circuito">
  <section className="card circuitsCard eventEditorSheet">
    <div className="circuitsHeader">
      <div>
        <h2>Novo circuito</h2>
        <p>Crie períodos flexíveis e escolha manualmente quais torneios entram. Isso não altera os torneios já criados.</p>
      </div>
      <button type="button" className="secondaryBtn" onClick={() => setCreateCircuitOpen(false)}>Fechar</button>
    </div>

    <div className="circuitsFormGrid">
      <div className="formField">
        <label>Nome do circuito</label>
        <input value={circuitForm.name} onChange={(e) => setCircuitForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Ex: Circuito Verão" />
      </div>
      <div className="formField">
        <label>Data inicial</label>
        <input className="clickableDateInput" type="date" required value={circuitForm.startDate} onClick={openDatePicker} onFocus={openDatePicker} onChange={(e) => setCircuitForm((prev) => ({ ...prev, startDate: e.target.value }))} />
      </div>
      <div className="formField">
        <label>Data final</label>
        <input className="clickableDateInput" type="date" required value={circuitForm.endDate} min={circuitForm.startDate || undefined} onClick={openDatePicker} onFocus={openDatePicker} onChange={(e) => setCircuitForm((prev) => ({ ...prev, endDate: e.target.value }))} />
      </div>
      <div className="formField">
        <label>Situação automática</label>
        <div className="automaticStatusField">
          {circuitForm.endDate && getAutomaticEventStatus(circuitForm.endDate) === "finished" ? "Encerrado" : "Ativo"}
        </div>
      </div>
    </div>

    <div className="circuitTournamentPicker">
      <div className="circuitPickerTitle">
        <strong>Torneios deste circuito</strong>
        <span>{circuitForm.tournamentIds.length} selecionado(s)</span>
      </div>
      {tournaments.length === 0 ? (
        <p>Nenhum torneio criado ainda.</p>
      ) : (
        <div className="circuitTournamentList">
          {tournaments.map((t) => {
            const details = t.data || {};
            const checked = circuitForm.tournamentIds.includes(t.id);
            return (
              <label className={`circuitTournamentOption ${checked ? "selected" : ""}`} key={t.id}>
                <input type="checkbox" checked={checked} onChange={() => toggleCircuitTournament(t.id)} />
                <span className="circuitCheckVisual">{checked ? "✓" : ""}</span>
                <span className="circuitTournamentText">
                  <strong>{details.eventName || t.name}</strong>
                  <small>{[t.name, getModalityDisplayName(t.type), details.eventDate ? formatDateBR(details.eventDate) : null].filter(Boolean).join(" · ")}</small>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>

    <div className="circuitCriteriaCard">
      <div>
        <strong>Critério do ranking do circuito</strong>
        <p>No modo automático, o circuito acompanha o critério dos torneios vinculados.</p>
      </div>
      <label className="circuitAutomaticToggle">
        <input
          type="checkbox"
          checked={circuitForm.rankingCriteriaMode !== "manual"}
          onChange={(event) => setCircuitForm((prev) => ({
            ...prev,
            rankingCriteriaMode: event.target.checked ? "automatic" : "manual",
            rankingCriteria: event.target.checked
              ? getCircuitCriteriaInfo(prev.tournamentIds).value
              : prev.rankingCriteria,
          }))}
        />
        Acompanhar automaticamente
      </label>
      <select
        value={circuitForm.rankingCriteriaMode === "manual" ? circuitForm.rankingCriteria : getCircuitCriteriaInfo(circuitForm.tournamentIds).value}
        disabled={circuitForm.rankingCriteriaMode !== "manual"}
        onChange={(event) => setCircuitForm((prev) => ({ ...prev, rankingCriteria: event.target.value }))}
      >
        {rankingCriteriaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {circuitForm.rankingCriteriaMode !== "manual" && getCircuitCriteriaInfo(circuitForm.tournamentIds).mixed ? (
        <small className="circuitCriteriaWarning">Os torneios selecionados usam critérios diferentes. O primeiro torneio selecionado será a referência; você pode desligar o modo automático e escolher outro.</small>
      ) : null}
      <small className="circuitIdentityHint">
        O acumulado identifica atletas e duplas pelo nome. Use a mesma escrita em todas as etapas e diferencie homônimos pelo sobrenome.
      </small>
    </div>

    <div className="circuitFormActions">
      <button type="button" onClick={() => saveCircuit()}>Criar circuito</button>
    </div>
  </section>
  </div>
  ) : null}

  <section className="card circuitsOverviewCard">
    <div className="circuitsList">
      <h2>Circuitos cadastrados</h2>
      <div className="tournamentStatusSummary circuitStatusSummary" aria-label="Filtrar circuitos por situação">
        <button type="button" className={`active ${circuitStatusFilter === "active" ? "selected" : ""}`} aria-pressed={circuitStatusFilter === "active"} onClick={() => setCircuitStatusFilter("active")}>
          <strong>{circuitLifecycleCounts.active}</strong> Em andamento
        </button>
        <button type="button" className={`upcoming ${circuitStatusFilter === "upcoming" ? "selected" : ""}`} aria-pressed={circuitStatusFilter === "upcoming"} onClick={() => setCircuitStatusFilter("upcoming")}>
          <strong>{circuitLifecycleCounts.upcoming}</strong> Próximos
        </button>
        <button type="button" className={`finished ${circuitStatusFilter === "finished" ? "selected" : ""}`} aria-pressed={circuitStatusFilter === "finished"} onClick={() => setCircuitStatusFilter("finished")}>
          <strong>{circuitLifecycleCounts.finished}</strong> Encerrados
        </button>
      </div>
      {circuits.length === 0 ? (
        <p>Nenhum circuito criado ainda.</p>
      ) : visibleOrganizerCircuits.length === 0 ? (
        <p className="eventStatusEmpty">Nenhum circuito {circuitStatusFilter === "active" ? "em andamento" : circuitStatusFilter === "upcoming" ? "próximo" : "encerrado"}.</p>
      ) : visibleOrganizerCircuits.map((circuit) => {
        const selectedNames = getCircuitSelectedTournaments(circuit);
        const circuitStatus = getCircuitLifecycleStatus(circuit);
        const isExpanded = expandedCircuitId === circuit.id;
        return (
          <article className={`circuitItem ${isExpanded ? "expanded" : ""}`} key={circuit.id}>
            <button
              type="button"
              className="circuitItemSummary"
              aria-expanded={isExpanded}
              onClick={() => { const nextId = isExpanded ? null : circuit.id; setExpandedCircuitId(nextId); scheduleUserAppStateSave({ circuitId: nextId, activePanel: "circuitos" }); }}
            >
              <div className="circuitSummaryIdentity">
                <span className="circuitMonogram">CIR</span>
                <div className="circuitItemMain">
                  <div className="circuitTitleLine">
                    <h3>{circuit.name}</h3>
                    <span className={`circuitStatus circuitStatus-${circuitStatus}`}>
                      {circuitStatus === "finished" ? "Encerrado" : circuitStatus === "upcoming" ? "Próximo" : "Em andamento"}
                    </span>
                  </div>
                  <p><CalendarDays aria-hidden="true" /> {circuit.startDate ? formatDateBR(circuit.startDate) : "Sem início"} até {circuit.endDate ? formatDateBR(circuit.endDate) : "sem fim definido"}</p>
                  <small>{selectedNames.length} torneio(s) · {selectedNames.length ? selectedNames.map((t) => t.data?.eventName || t.name).join(", ") : "nenhum selecionado"}</small>
                </div>
              </div>
              <span className="circuitExpandIcon" aria-hidden="true"><ChevronDown /></span>
            </button>

            {isExpanded ? (
              <div className="circuitItemActions circuitItemActionsTop" aria-label={`Ações do circuito ${circuit.name}`}>
                <button type="button" className="editBtn" onClick={() => editCircuit(circuit)}>Editar circuito</button>
                <button type="button" className="deleteBtn" onClick={() => setCircuitDeleteTarget(circuit)}>Excluir circuito</button>
              </div>
            ) : null}

            {isExpanded ? (
              <section className="circuitStagesSummary">
                <div><span>Etapas</span><h4>Torneios do circuito</h4></div>
                {selectedNames.length ? (
                  <div className="circuitStageList">
                    {sortTournamentsChronologically(selectedNames).map((tournament) => (
                      <button type="button" key={tournament.id} onClick={() => openTournament(tournament)}>
                        <span>{tournament.name}</span>
                        <small>{getModalityDisplayName(tournament.type)} · {formatDateBR(tournament.data?.eventDate)}</small>
                      </button>
                    ))}
                  </div>
                ) : <p>Nenhum torneio vinculado.</p>}
              </section>
            ) : null}

            {isExpanded ? (() => {
              const effectiveCircuitCriteria = getCircuitEffectiveCriteria(circuit);
              const circuitRankingGroups = getCircuitRanking(circuit, effectiveCircuitCriteria);
              return circuitRankingGroups.length ? (
                <div className="circuitRankingBox">
                  <div className="circuitRankingHeader">
                    <div className="circuitRankingIdentity">
                      <span>{circuit.name}</span>
                      <strong>Ranking geral acumulado</strong>
                    </div>
                    <RankingShareButton
                      config={{
                        title: circuit.name,
                        subtitle: "Ranking geral acumulado",
                        arenaName: organizerProfile.arenaName || organizerProfile.organizerName || "Arena Torneio360",
                        arenaPhotoUrl: organizerProfile.photoUrl || "",
                        rankingCriteria: effectiveCircuitCriteria,
                        groups: circuitRankingGroups,
                      }}
                    />
                    <label>
                      <span>Critério de desempate</span>
                      <select
                        value={effectiveCircuitCriteria}
                        onChange={(event) => void updateCircuitRankingRule(circuit, event.target.value, "manual")}
                      >
                        {rankingCriteriaOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <small>{circuit.rankingCriteriaMode === "manual" ? "Ajustado manualmente" : "Herdado automaticamente dos torneios"}</small>
                      {circuit.rankingCriteriaMode === "manual" ? (
                        <button
                          type="button"
                          className="linkBtn"
                          onClick={() => void updateCircuitRankingRule(circuit, getCircuitCriteriaInfo(circuit.tournamentIds).value, "automatic")}
                        >
                          Voltar ao automático
                        </button>
                      ) : null}
                    </label>
                  </div>
                  {/* Legacy card-style circuit ranking kept here only as a reference.
                  {circuitRankingGroups.map((group) => (
                    <div className="circuitRankingGroup" key={group.key}>
                      <h4>{group.title}</h4>
                      <div className="circuitRankingTable">
                        {group.rows.map((row, index) => (
                          <div className="circuitRankingRow" key={row.name}>
                            <span>{index + 1}º</span>
                            <b>{row.name}</b>
                            <em>Total de Games: {row.pts}</em>
                            <small>{row.w} vit. · saldo {row.bal} · {row.played} jogo(s)</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  */}
                  {circuitRankingGroups.length === 1 ? (
                    <RankingTable
                      title={circuitRankingGroups[0].title}
                      rows={circuitRankingGroups[0].rows}
                      rankingCriteria={effectiveCircuitCriteria}
                    />
                  ) : (
                    <div className="twoCols circuitRankingTables">
                      {circuitRankingGroups.map((group) => (
                        <RankingTable
                          key={group.key}
                          title={group.title}
                          rows={group.rows}
                          rankingCriteria={effectiveCircuitCriteria}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : selectedNames.length ? (
                <div className="circuitRankingEmpty">Ranking aparece quando houver placares lançados nos torneios selecionados.</div>
              ) : null;
            })() : null}

          </article>
        );
      })}
    </div>
  </section>
  </div>
)}

{activePanel === "modalidades" && (
<section className="card">
  <h2>Modalidades liberadas</h2>
  <div className="modalitiesGrid internalModalities">
    {allowedTypes.includes("Super 12 Mista (Dupla Fixa)") && (
      <Info
        title="Super 6 (dupla fixa)"
        text="Formato com 6 duplas já definidas antes do início do campeonato. Diferente das modalidades aleatórias, aqui os parceiros permanecem juntos do começo ao fim. O sistema gera automaticamente os confrontos entre as duplas, organiza a sequência de jogos e calcula a classificação geral pelos placares lançados. É indicado quando os atletas já se inscrevem em dupla e querem disputar como equipe fixa."
      />
    )}

    {allowedTypes.includes("Super 08") && (
      <Info
        title="Super 8"
        text="Formato individual com 8 participantes, ideal para torneios rápidos. Cada atleta joga com parceiros diferentes ao longo das rodadas, evitando que uma dupla fixa determine todo o resultado. O sistema monta os confrontos automaticamente, organiza as quadras, registra os placares e calcula o ranking individual. No final, vence quem tiver melhor desempenho geral conforme os critérios definidos, como vitórias, total de games e saldo de games."
      />
    )}

    {allowedTypes.includes("Super 16 Mista (Dupla Fixa)") && (
      <Info
        title="Super 8 (dupla fixa)"
        text="Formato com 8 duplas fixas, indicado para torneios maiores em que cada equipe permanece igual durante toda a competição. O sistema organiza os jogos entre as duplas, distribui as rodadas e registra os resultados. A classificação é por dupla, não individual. Conforme os placares são preenchidos, o ranking geral é atualizado com vitórias, total de games e saldo de games, ajudando o organizador a acompanhar quem está avançando melhor."
      />
    )}

    {allowedTypes.includes("Super 12") && (
      <Info
        title="Super 12"
        text="Formato individual com 12 participantes definidos livremente pelo organizador, sem exigência de gênero. São 11 rodadas em 3 quadras, sem descanso. Cada atleta joga uma vez com cada parceiro, enfrenta cada adversário duas vezes e participa de um único ranking geral."
      />
    )}

    {allowedTypes.includes("Super 10 Mista (Dupla Aleatória)") && (
      <Info
        title="Super 10 mista"
        text="Formato misto com 10 participantes: 5 homens e 5 mulheres. São 5 rodadas, com 2 jogos por rodada, e em cada rodada descansam 1 homem e 1 mulher. Ao final, todos jogam 4 partidas e descansam 1 vez. O sistema monta automaticamente as duplas mistas, organiza as quadras, registra os placares e calcula rankings separados masculino e feminino. É ideal para torneios de hoje, eventos rápidos e grupos menores, mantendo equilíbrio de jogos entre todos os atletas."
      />
    )}

    {allowedTypes.includes("Super 12 Mista (Dupla Aleatória)") && (
      <Info
        title="Super 12 mista"
        text="Formato misto com 12 participantes: 6 homens e 6 mulheres. Primeiro, os atletas são cadastrados e sorteados. Depois, o sistema combina os participantes para formar duplas mistas em diferentes rodadas, mantendo equilíbrio entre homens e mulheres. Cada jogador participa de jogos com combinações variadas, e o desempenho é calculado individualmente. É uma boa opção para eventos sociais e competitivos com rotação de parceiros."
      />
    )}

    {allowedTypes.includes("Super 16 Mista (Dupla Aleatória)") && (
      <Info
        title="Super 16 mista"
        text="Formato misto com 16 participantes: 8 homens e 8 mulheres. Funciona como uma versão maior do Super 12 mista, com mais atletas, mais jogos e maior movimentação de quadras. O sistema monta as duplas mistas de forma organizada, distribui as partidas e permite preencher os placares rodada por rodada. O ranking é individual, ou seja, cada atleta pontua pelo próprio desempenho, mesmo jogando com parceiros diferentes durante o torneio."
      />
    )}

    {allowedTypes.includes("Super 20 Mista (Dupla Aleatória)") && (
      <Info
        title="Super 20 mista"
        text="Formato misto com 20 participantes: 10 homens e 10 mulheres. São 10 rodadas em 5 quadras. Cada homem forma dupla exatamente uma vez com cada mulher, e vice-versa. A tabela é fixa, reduz a repetição de adversários e mantém rankings individuais masculino e feminino."
      />
    )}

    {allowedTypes.includes("Simples 8") && (
      <Info
        title="Simples (1 contra 1 por jogo)"
        text="Formato individual para 4, 6, 8, 10, 12 ou 14 jogadores. O organizador escolhe a quantidade e o sistema monta automaticamente todos contra todos: cada atleta enfrenta todos os demais exatamente uma vez, sem folgas nas rodadas. O ranking geral individual acompanha vitórias, total de games e saldo de games."
      />
    )}

    {allowedTypes.includes("Copa - 18 duplas") && (
      <Info
        title="Copa - 18 duplas"
        text="Formato de Copa com 18 duplas, dividido em 6 grupos de 3 duplas. Cada grupo joga sua fase classificatória, e o sistema calcula a classificação com base nos critérios definidos. Os melhores avançam para a chave principal; os 2 melhores gerais podem receber BYE, entrando em fase mais avançada. Também há disputa paralela para duplas específicas, como terceiros colocados, permitindo manter mais atletas em atividade. É um formato ideal para torneios grandes, com organização mais profissional e várias fases."
      />
    )}

    {allowedTypes.includes("Campeonato Cearense") && (
      <Info
        title="Torneio modelo Campeonato Cearense"
        text="Formato de 4 a 32 duplas. Os dois primeiros de cada grupo seguem para a Eliminatória Principal e os demais para a Disputa Paralela. Entre grupos, a ordem é equilibrada por percentual de vitórias, saldo médio e média de games por partida."
      />
    )}

    {allowedTypes.includes("Modelo Play Ranking") && (
      <Info
        title="Modelo Torneio 360"
        text="Usa a mesma fase de grupos do modelo Campeonato Cearense. A diferença é que as duplas derrotadas somente na primeira fase jogada da Eliminatória Principal também seguem para a Disputa Paralela, com prioridade e sem confronto direto entre elas na estreia sempre que houver uma dupla vinda dos grupos disponível."
      />
    )}
  </div>
</section>
)}

{activePanel === "lixeira" && (
<section className="card trashCard">
  <div className="trashHeader">
    <div>
      <h2>Lixeira</h2>
      <p>Torneios apagados ficam aqui por 30 dias antes da exclusão definitiva.</p>
    </div>
    <span>{trashTournaments.length} item(ns)</span>
  </div>

  {trashTournaments.length === 0 ? (
    <p>Nenhum torneio na lixeira.</p>
  ) : (
    <div className="tournamentList trashList">
      {trashTournaments.map((t) => {
        const details = t.data || {};
        const daysLeft = getTrashDaysLeft(t);

        return (
          <div className="tournamentItem trashTournamentItem" key={t.id}>
            <div className="tournamentInfo">
              <div className="tournamentTitleRow">
                <strong>{t.name}</strong>
                <span className="tournamentTypeBadge">{getModalityDisplayName(t.type)}</span>
              </div>

              <div className="tournamentMeta">
                {details.multiCategoryEvent ? <span><Grid3X3 aria-hidden="true" /> Várias categorias</span> : null}
                {details.gender ? <span><Tag aria-hidden="true" /> {details.gender}</span> : null}
                {details.eventDate ? <span><CalendarDays aria-hidden="true" /> {formatDateBR(details.eventDate)}</span> : null}
                {details.location ? <span><MapPin aria-hidden="true" /> {details.location}</span> : null}
                <span><Trash2 aria-hidden="true" /> Exclui definitivamente em {daysLeft} dia(s)</span>
              </div>
            </div>

            <div className="tournamentActions">
              <button type="button" onClick={() => restoreTournament(t)}>Recuperar</button>
            </div>
          </div>
        );
      })}
    </div>
  )}
</section>
)}

{activePanel === "ajustes" && (
<>
  <section className="card instagramProfileCard">
    <div className="instagramProfileHeader">
      <div className="instagramProfilePhoto">
        {organizerProfile.photoUrl ? <img src={organizerProfile.photoUrl} alt="Foto do perfil" /> : <span><UserRound aria-hidden="true" /></span>}
      </div>
      <div className="instagramProfileInfo">
        <div className="instagramProfileTopline">
          <h2>{organizerProfile.arenaName || profile.name || "Meu perfil"}</h2>
          <button type="button" className="secondaryBtn profileEditShortcut" onClick={() => openProfileSection("editar")}>
            <Settings aria-hidden="true" />
            Editar perfil
          </button>
        </div>
        <p>{organizerProfile.city || organizerProfile.state ? [organizerProfile.city, organizerProfile.state].filter(Boolean).join("/") : "Complete seu perfil para receber visitas de outros usuários."}</p>
        <div className="profileAlwaysPublicBadge">
          <span aria-hidden="true">●</span>
          <div>
            <strong>Perfil público da arena</strong>
            <small>Com o nome da arena e do responsável preenchidos, seus eventos aparecem automaticamente para os visitantes.</small>
          </div>
        </div>
      </div>
    </div>

    <div className="profileSubtabs" role="tablist" aria-label="Seções do perfil">
      <button
        type="button"
        role="tab"
        className={profileSubtab === "publicacoes" ? "active" : ""}
        onClick={() => openProfileSection("publicacoes")}
        aria-selected={profileSubtab === "publicacoes"}
      >
        <Grid3X3 aria-hidden="true" />
        Publicações
      </button>
      <button
        type="button"
        role="tab"
        className={profileSubtab === "editar" ? "active" : ""}
        onClick={() => openProfileSection("editar")}
        aria-selected={profileSubtab === "editar"}
      >
        <Settings aria-hidden="true" />
        Dados da arena
      </button>
      <button
        type="button"
        role="tab"
        className={profileSubtab === "conta" ? "active" : ""}
        onClick={() => openProfileSection("conta")}
        aria-selected={profileSubtab === "conta"}
      >
        <LifeBuoy aria-hidden="true" />
        Conta e suporte
      </button>
    </div>

    {profileSubtab === "publicacoes" ? (
      <div className="profileSubtabPanel">
    <div className="profilePublicationsHeader">
      <strong>Publicações</strong>
      <span>{tournaments.length} campeonato(s) criado(s)</span>
    </div>

    <div className="profileTournamentGrid">
      {tournaments.length === 0 ? (
        <div className="profileEmptyPost">Nenhum campeonato criado ainda.</div>
      ) : tournaments.map((t) => {
        const details = t.data || {};
        return (
          <article className="profileTournamentPost tournamentItem" key={t.id}>
            {details.coverImageUrl ? (
              <img className="profileTournamentCover" src={details.coverImageUrl} alt={`Foto de ${t.name}`} />
            ) : null}
            <div className="tournamentInfo">
              <div className="tournamentTitleRow">
                <strong>{t.name}</strong>
                <span className="tournamentTypeBadge">{getModalityDisplayName(t.type)}</span>
              </div>
              <div className="tournamentMeta">
                {details.multiCategoryEvent ? <span><Grid3X3 aria-hidden="true" /> {details.eventName}</span> : null}
                {details.gender ? <span><Tag aria-hidden="true" /> {details.gender}</span> : null}
                {details.eventDate ? <span><CalendarDays aria-hidden="true" /> {formatDateBR(details.eventDate)}</span> : null}
                {details.eventStartTime ? <span><Clock3 aria-hidden="true" /> {details.eventStartTime}</span> : null}
                {details.location ? <span><MapPin aria-hidden="true" /> {details.location}</span> : null}
                {details.winningScore ? <span><Target aria-hidden="true" /> {details.winningScore} games</span> : null}
              </div>
            </div>
            <div className="tournamentActions">
              <button type="button" className="editBtn" onClick={() => openEditTournament(t)}>Editar</button>
              <button type="button" onClick={() => openTournament(t)}>Abrir</button>
              <button type="button" className="shareTournamentBtn" onClick={shareArenaProfile}><Share2 aria-hidden="true" /> Compartilhar</button>
              <button type="button" className="deleteBtn" onClick={() => setDeleteTarget(t)}>Excluir</button>
            </div>
          </article>
        );
      })}
    </div>

      </div>
    ) : null}
  </section>

  {profileSubtab === "editar" ? (
  <section className="card organizerProfileCard profileEditSubtab">
    <div className="profileEditSubtabHeader">
      <div>
        <span>Dados públicos</span>
        <h2>Dados da arena</h2>
      </div>
    </div>
    <p className="profileSectionHint">Organize as informações que identificam sua arena e facilitam o contato com atletas.</p>

    <div className="profileFormSectionHeader">
      <span><UserRound aria-hidden="true" /></span>
      <div>
        <strong>Identidade</strong>
        <small>Foto e nomes exibidos no perfil da arena.</small>
      </div>
    </div>

    <div className="organizerPhotoArea">
      <label className="organizerPhotoDropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleOrganizerPhotoFile(e.dataTransfer.files?.[0]); }}>
        <input type="file" accept="image/*" onChange={(e) => handleOrganizerPhotoFile(e.target.files?.[0])} />
        <div className="organizerPhotoPreview">
          {organizerProfile.photoUrl ? (
            <img src={organizerProfile.photoUrl} alt="Foto de perfil" />
          ) : (
            <span><Camera aria-hidden="true" /></span>
          )}
        </div>
        <strong>Foto de perfil</strong>
        <small>Clique ou arraste uma imagem aqui</small>
      </label>
      {organizerProfile.photoUrl ? <button className="removePhotoBtn" type="button" onClick={removeOrganizerPhoto}>Remover foto</button> : null}
    </div>

    <div className="organizerProfileGrid">
      <div className="formField">
        <label>Nome da arena</label>
        <input value={organizerProfile.arenaName} onChange={(e) => updateOrganizerProfile("arenaName", e.target.value)} placeholder="Ex: Arena Beach Sports" />
      </div>

      <div className="formField">
        <label>Nome do organizador</label>
        <input value={organizerProfile.organizerName} onChange={(e) => updateOrganizerProfile("organizerName", e.target.value)} placeholder="Ex: Cristiano Sampaio" />
      </div>

      <div className="profileFormSectionHeader fullField">
        <span><MessageCircle aria-hidden="true" /></span>
        <div>
          <strong>Contato público</strong>
          <small>Dados usados pelos atletas para falar com a organização.</small>
        </div>
      </div>

      <div className="formField">
        <label>WhatsApp</label>
        <input value={organizerProfile.whatsapp} onChange={(e) => updateOrganizerProfile("whatsapp", e.target.value)} placeholder="(85) 99999-9999" />
      </div>

      <div className="formField">
        <label>@ do Instagram</label>
        <input value={organizerProfile.instagramHandle} onChange={(e) => updateOrganizerProfile("instagramHandle", e.target.value)} placeholder="@suaarena" />
      </div>

      <div className="formField">
        <label>Link do Instagram</label>
        <input value={organizerProfile.instagramLink} onChange={(e) => updateOrganizerProfile("instagramLink", e.target.value)} placeholder="https://instagram.com/suaarena" />
      </div>

      <div className="formField fullField">
        <label>Link do grupo de WhatsApp</label>
        <input value={organizerProfile.whatsappGroupLink} onChange={(e) => updateOrganizerProfile("whatsappGroupLink", e.target.value)} placeholder="https://chat.whatsapp.com/..." />
      </div>

      <div className="profileFormSectionHeader fullField">
        <span><MapPin aria-hidden="true" /></span>
        <div>
          <strong>Localização</strong>
          <small>Endereço e referência geográfica da arena.</small>
        </div>
      </div>

      <div className="formField fullField">
        <label>Endereço da arena</label>
        <input value={organizerProfile.address} onChange={(e) => updateOrganizerProfile("address", e.target.value)} placeholder="Rua, número, bairro" />
      </div>

      <div className="formField fullField">
        <label>Link do endereço da arena</label>
        <input value={organizerProfile.mapsLink || ""} onChange={(e) => updateOrganizerProfile("mapsLink", e.target.value)} placeholder="Link do Google Maps" />
      </div>

      <div className="formField">
        <label>Cidade</label>
        <input value={organizerProfile.city} onChange={(e) => updateOrganizerProfile("city", e.target.value)} placeholder="Fortaleza" />
      </div>

      <div className="formField">
        <label>Estado</label>
        <input value={organizerProfile.state} onChange={(e) => updateOrganizerProfile("state", e.target.value)} placeholder="CE" />
      </div>

    </div>

    <button className="saveProfileBtn" type="button" onClick={saveOrganizerProfile} disabled={profileSaving}>{profileSaving ? "Salvando..." : "Salvar alterações"}</button>
    {profileSaveSuccess ? (
      <div className="profileSaveMiniNotice" role="status" aria-live="polite">
        ✅ Alterado com sucesso
      </div>
    ) : null}
  </section>
  ) : null}

  {profileSubtab === "conta" ? (
    <div className="profileAccountGrid">
      <section className="card profileAccountCard">
        <div className="profileSectionHeading">
          <span>Conta</span>
          <h2>Acesso e assinatura</h2>
          <p>Informações privadas da sua conta na plataforma.</p>
        </div>

        <dl className="profileAccountDetails">
          <div>
            <dt>E-mail de acesso</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Plano</dt>
            <dd>{profile.plan}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{formatStatusBR(profile.status)}</dd>
          </div>
          <div>
            <dt>Vencimento</dt>
            <dd>{profile.expires_at ? formatDateBR(profile.expires_at) : "Não definido"}</dd>
          </div>
        </dl>
      </section>

      <section className="card profileSupportCard" id="suporte-torneio360">
        <div className="profileSectionHeading">
          <span>Atendimento</span>
          <h2>Fale com o Torneio360</h2>
          <p>Escolha o canal de sua preferência para receber suporte.</p>
        </div>

        <PlatformSupportLinks />
      </section>
    </div>
  ) : null}
</>
)}



        </main>
      </div>
    </div>
  );
}

function createInitialData(type, config) {
  const simplePlayerCount = isFlexibleSimpleType(config)
    ? getSimplePlayerCount(config)
    : null;
  const base = {
  rankingCriteria: defaultRankingCriteria,
  winningScore: 4,
  gender: "",
  eventDate: "",
  eventDay: "",
  location: "",
  schedule: [],
  courtNumbers: createDefaultCourtNumbers(
    getTournamentCourtCount(config, simplePlayerCount ? { simplePlayerCount } : null)
  ),
};

  if (!config) {
    return { ...base, players: [] };
  }

  if (isMixedType(config)) {
    return {
      ...base,
      players: {
        men: Array.from({ length: config.men }, (_, i) => `Homem ${i + 1}`),
        women: Array.from({ length: config.women }, (_, i) => `Mulher ${i + 1}`),
      },
    };
  }

  if (config.type === "fixed12" || config.type === "fixed16") {
    return {
      ...base,
      players: {
        teams: Array.from({ length: config.teams }, (_, i) => ({
          a: `Atleta 1 da dupla ${i + 1}`,
          b: `Atleta 2 da dupla ${i + 1}`,
        })),
      },
    };
  }

  if (isCupType(config)) {
    return {
      ...base,
      cupConfig: {
        format: config.cupMode || "standard",
        teamCount: config.defaultTeams,
        mainBracketName: config.defaultMainBracketName,
        repechageName: config.defaultRepechageName,
        ...(config.defaultThirdRepechageName
          ? { thirdRepechageName: config.defaultThirdRepechageName }
          : {}),
        tieBreakOverrides: {},
        groupTieBreakOverrides: {},
        campaignTieBreakOverrides: {},
      },
      players: {
        teams: Array.from({ length: config.defaultTeams }, (_, i) => ({
          a: `Atleta 1 da dupla ${i + 1}`,
          b: `Atleta 2 da dupla ${i + 1}`,
        })),
      },
      brackets: [],
    };
  }

  if (isFlexibleSimpleType(config)) {
    return {
      ...base,
      simplePlayerCount,
      players: Array.from({ length: simplePlayerCount }, (_, i) => `${config.label} ${i + 1}`),
    };
  }

  return {
    ...base,
    players: Array.from({ length: config.total }, (_, i) => `${config.label} ${i + 1}`),
  };
}

function isTournamentDataObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeNameList(values, count, label) {
  const source = Array.isArray(values) ? values : [];

  return Array.from({ length: count }, (_, index) => (
    typeof source[index] === "string" ? source[index] : `${label} ${index + 1}`
  ));
}

function normalizeTeams(values, count) {
  const source = Array.isArray(values) ? values : [];

  return Array.from({ length: count }, (_, index) => {
    const team = isTournamentDataObject(source[index]) ? source[index] : {};

    return {
      a: typeof team.a === "string" ? team.a : `Atleta 1 da dupla ${index + 1}`,
      b: typeof team.b === "string" ? team.b : `Atleta 2 da dupla ${index + 1}`,
    };
  });
}

function normalizeGameNames(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== null && item !== undefined)
      .map((item) => String(item));
  }

  return value === null || value === undefined ? [] : [String(value)];
}

function normalizeGameIds(value) {
  const source = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];

  return source
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 0);
}

function normalizeGame(game, index) {
  const source = isTournamentDataObject(game) ? game : {};
  const court = Number(source.court);
  const courtNumberOverride = normalizeCourtNumberValue(source.courtNumberOverride || source.courtLabelOverride);

  const normalized = {
    ...source,
    court: Number.isFinite(court) && court > 0 ? court : index + 1,
    team1: normalizeGameNames(source.team1),
    team2: normalizeGameNames(source.team2),
    ids1: normalizeGameIds(source.ids1),
    ids2: normalizeGameIds(source.ids2),
    s1: source.s1 ?? "",
    s2: source.s2 ?? "",
  };

  delete normalized.courtLabelOverride;
  if (courtNumberOverride) normalized.courtNumberOverride = courtNumberOverride;

  return normalized;
}

function normalizeSchedule(schedule) {
  if (!Array.isArray(schedule)) return [];

  return schedule
    .filter((round) => Array.isArray(round))
    .map((round) => round
      .filter((game) => isTournamentDataObject(game))
      .map((game, index) => normalizeGame(game, index))
    );
}

function normalizeBrackets(brackets) {
  if (!Array.isArray(brackets)) return [];

  return brackets
    .filter((game) => isTournamentDataObject(game))
    .map((game, index) => normalizeGame(game, index));
}

function formatParticipantName(value) {
  const connectors = new Set(["da", "das", "de", "do", "dos", "e"]);
  const words = String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .split(" ");

  return words.map((word, index) => {
    if (!word || (index > 0 && connectors.has(word))) return word;
    return word.replace(/(^|[-'’])(\p{L})/gu, (_, prefix, letter) => (
      `${prefix}${letter.toLocaleUpperCase("pt-BR")}`
    ));
  }).join(" ");
}

function normalizeAttendanceList(values, count) {
  const source = Array.isArray(values) ? values : [];
  return Array.from({ length: count }, (_, index) => source[index] === true);
}

function normalizeParticipantAttendance(config, players, attendance) {
  const source = attendance && typeof attendance === "object" ? attendance : {};

  if (isMixedType(config)) {
    return {
      men: normalizeAttendanceList(source.men, players?.men?.length || config.men || 0),
      women: normalizeAttendanceList(source.women, players?.women?.length || config.women || 0),
    };
  }

  if (config?.type === "fixed12" || config?.type === "fixed16" || isCupType(config)) {
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

function getParticipantAttendanceEntries(config, data) {
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

  if (config?.type === "fixed12" || config?.type === "fixed16" || isCupType(config)) {
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

function setParticipantAttendanceValue(attendance, path, confirmed) {
  if (path.kind === "normal") attendance[path.index] = confirmed;
  if (path.kind === "men") attendance.men[path.index] = confirmed;
  if (path.kind === "women") attendance.women[path.index] = confirmed;
  if (path.kind === "team") attendance.teams[path.index][path.field] = confirmed;
}

function reconcileParticipantAttendance(config, currentPlayers, nextPlayers, attendance) {
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

function normalizeTournamentData(type, rawData) {
  const config = modalityConfig[type];

  if (!config) {
    return isTournamentDataObject(rawData) ? rawData : createInitialData(type, config);
  }

  const defaults = createInitialData(type, config);
  const source = isTournamentDataObject(rawData) ? rawData : {};
  const sourcePlayers = isTournamentDataObject(source.players) ? source.players : {};
  const simplePlayerCount = isFlexibleSimpleType(config)
    ? getSimplePlayerCount(config, source)
    : null;
  const validWinningScore = [4, 6].includes(Number(source.winningScore));
  const validRankingCriteria = rankingCriteriaOptions.some((item) => item.value === source.rankingCriteria);
  const usedCourtNumbers = [
    ...(Array.isArray(source.schedule) ? source.schedule.flat() : []),
    ...(Array.isArray(source.brackets) ? source.brackets : []),
  ]
    .map((game) => Number(game?.court))
    .filter((court) => Number.isFinite(court) && court > 0);
  const sourceCourtNumbers = Array.isArray(source.courtNumbers) ? source.courtNumbers : source.courtLabels;
  const courtCount = Math.max(
    getTournamentCourtCount(config, simplePlayerCount ? { ...source, simplePlayerCount } : source),
    sourceCourtNumbers?.length || 0,
    ...usedCourtNumbers,
    1
  );
  const normalized = {
    ...defaults,
    ...source,
    rankingCriteria: validRankingCriteria ? source.rankingCriteria : defaults.rankingCriteria,
    winningScore: validWinningScore ? Number(source.winningScore) : defaults.winningScore,
    namesShuffled: Boolean(source.namesShuffled),
    schedule: normalizeSchedule(source.schedule),
    courtNumbers: normalizeCourtNumbers(sourceCourtNumbers, courtCount),
  };
  delete normalized.courtLabels;

  if (isCupType(config)) {
    const sourceCupConfig = isTournamentDataObject(source.cupConfig) ? source.cupConfig : {};
    const requestedTeamCount = Number(sourceCupConfig.teamCount);
    const teamCount = config.allowedTeamCounts.includes(requestedTeamCount)
      ? requestedTeamCount
      : config.defaultTeams;

    return {
      ...normalized,
      cupConfig: {
        ...defaults.cupConfig,
        ...sourceCupConfig,
        format: typeof sourceCupConfig.format === "string"
          ? sourceCupConfig.format
          : defaults.cupConfig.format,
        teamCount,
        mainBracketName: typeof sourceCupConfig.mainBracketName === "string"
          ? sourceCupConfig.mainBracketName
          : defaults.cupConfig.mainBracketName,
        repechageName: typeof sourceCupConfig.repechageName === "string"
          ? sourceCupConfig.repechageName
          : defaults.cupConfig.repechageName,
        thirdRepechageName: typeof sourceCupConfig.thirdRepechageName === "string"
          ? sourceCupConfig.thirdRepechageName
          : defaults.cupConfig.thirdRepechageName,
        tieBreakOverrides: isTournamentDataObject(sourceCupConfig.tieBreakOverrides)
          ? sourceCupConfig.tieBreakOverrides
          : {},
        groupTieBreakOverrides: isTournamentDataObject(sourceCupConfig.groupTieBreakOverrides)
          ? sourceCupConfig.groupTieBreakOverrides
          : {},
        campaignTieBreakOverrides: isTournamentDataObject(sourceCupConfig.campaignTieBreakOverrides)
          ? sourceCupConfig.campaignTieBreakOverrides
          : {},
      },
      players: {
        teams: normalizeTeams(sourcePlayers.teams, teamCount),
      },
      participantAttendance: normalizeParticipantAttendance(
        config,
        { teams: normalizeTeams(sourcePlayers.teams, teamCount) },
        source.participantAttendance
      ),
      brackets: normalizeBrackets(source.brackets),
      groupsShuffled: Boolean(source.groupsShuffled),
    };
  }

  if (isFlexibleSimpleType(config)) {
    const players = normalizeNameList(source.players, simplePlayerCount, config.label);
    return {
      ...normalized,
      simplePlayerCount,
      players,
      participantAttendance: normalizeParticipantAttendance(config, players, source.participantAttendance),
    };
  }

  if (isMixedType(config)) {
    const players = {
      men: normalizeNameList(sourcePlayers.men, config.men, "Homem"),
      women: normalizeNameList(sourcePlayers.women, config.women, "Mulher"),
    };
    return {
      ...normalized,
      players,
      participantAttendance: normalizeParticipantAttendance(config, players, source.participantAttendance),
    };
  }

  if (config.type === "fixed12" || config.type === "fixed16") {
    const players = {
      teams: normalizeTeams(sourcePlayers.teams, config.teams),
    };
    return {
      ...normalized,
      players,
      participantAttendance: normalizeParticipantAttendance(config, players, source.participantAttendance),
    };
  }

  const players = normalizeNameList(source.players, config.total, config.label);
  return {
    ...normalized,
    players,
    participantAttendance: normalizeParticipantAttendance(config, players, source.participantAttendance),
  };
}

function needsTournamentDataRepair(type, rawData) {
  const config = modalityConfig[type];
  if (!config || !isTournamentDataObject(rawData) || !Array.isArray(rawData.schedule)) return true;

  const players = isTournamentDataObject(rawData.players) ? rawData.players : {};

  if (isCupType(config)) {
    const cupConfig = isTournamentDataObject(rawData.cupConfig) ? rawData.cupConfig : {};
    const teamCount = Number(cupConfig.teamCount);

    return !Array.isArray(players.teams)
      || !config.allowedTeamCounts.includes(teamCount)
      || players.teams.length !== teamCount
      || !Array.isArray(rawData.brackets);
  }

  if (isFlexibleSimpleType(config)) {
    const playerCount = getSimplePlayerCount(config, rawData);
    return !config.allowedPlayerCounts.includes(playerCount)
      || !Array.isArray(rawData.players)
      || rawData.players.length !== playerCount;
  }

  if (isMixedType(config)) {
    return !Array.isArray(players.men)
      || !Array.isArray(players.women)
      || players.men.length !== config.men
      || players.women.length !== config.women;
  }

  if (config.type === "fixed12" || config.type === "fixed16") {
    return !Array.isArray(players.teams) || players.teams.length !== config.teams;
  }

  return !Array.isArray(rawData.players) || rawData.players.length !== config.total;
}

function getShuffleNames(data, config) {
  if (!data?.players) return [];

  if (isMixedType(config)) {
    return [...data.players.men, ...data.players.women];
  }

  if (config.type === "fixed12" || config.type === "fixed16" || isCupType(config)) {
    return data.players.teams.map((team, index) => `Dupla ${index + 1}: ${team.a} + ${team.b}`);
  }

  return data.players || [];
}

const SHUFFLE_DURATION_SECONDS = 5;
const SHUFFLE_MOVEMENT_INTERVAL_MS = 620;

function createShuffleSlots(count, compact = false) {
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

function createShuffleAnimationItems(names) {
  const compact = typeof window !== "undefined" && window.innerWidth <= 760;
  const slots = shuffleArray(createShuffleSlots(names.length, compact));

  return names.map((name, index) => ({
    id: `shuffle-name-${index}`,
    name,
    ...slots[index],
    rotation: (index % 2 === 0 ? -1 : 1) * (1 + (index % 3)),
  }));
}

function moveShuffleAnimationItems(items) {
  if (items.length < 2) return items;

  const offset = 1 + Math.floor(Math.random() * (items.length - 1));
  const positions = items.map(({ left, top }) => ({ left, top }));

  return items.map((item, index) => ({
    ...item,
    ...positions[(index + offset) % positions.length],
    rotation: -item.rotation + (index % 2 === 0 ? 1 : -1),
  }));
}

const SHUFFLE_VIDEO_WIDTH = 720;
const SHUFFLE_VIDEO_HEIGHT = 1280;
const SHUFFLE_VIDEO_FPS = 24;

function createShuffleReceiptId() {
  const timePart = Date.now().toString(36).toUpperCase();
  const randomPart = globalThis.crypto?.getRandomValues
    ? Array.from(globalThis.crypto.getRandomValues(new Uint8Array(3)), (value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()
    : Math.random().toString(36).slice(2, 8).toUpperCase();
  return `T360-${timePart}-${randomPart}`;
}

function createShuffleVideoSnapshot(data, config, tournament) {
  const createdAt = new Date().toISOString();
  let kind = "names";
  let sections = [];

  if (isCupType(config)) {
    kind = "groups";
    const teamCount = Number(data?.cupConfig?.teamCount || data?.players?.teams?.length || 0);
    const format = data?.cupConfig?.format || data?.cupConfig?.cupMode || "";
    const groups = createCupGroups(teamCount, format);
    sections = groups.map((group) => ({
      title: group.name,
      entries: group.teamIds.map((teamId) => getTeamName(data.players.teams[teamId])).filter(Boolean),
    }));
  } else if (isMixedType(config)) {
    kind = "mixed";
    sections = [
      { title: "Masculino", entries: [...(data?.players?.men || [])] },
      { title: "Feminino", entries: [...(data?.players?.women || [])] },
    ];
  } else if (config.type === "fixed12" || config.type === "fixed16") {
    kind = "teams";
    sections = [{
      title: "Duplas sorteadas",
      entries: (data?.players?.teams || []).map((team) => getTeamName(team)),
    }];
  } else {
    sections = [{
      title: "Ordem sorteada",
      entries: Array.isArray(data?.players) ? [...data.players] : [],
    }];
  }

  return {
    version: 1,
    id: createShuffleReceiptId(),
    createdAt,
    kind,
    tournamentName: tournament?.name || "Torneio",
    modalityName: getModalityDisplayName(tournament?.type) || config?.name || "Torneio360",
    sections: sections.map((section) => ({
      title: section.title,
      entries: section.entries.map((entry) => String(entry || "Participante").trim()).filter(Boolean),
    })),
  };
}

function getShuffleVideoResultPages(snapshot) {
  const sections = Array.isArray(snapshot?.sections) ? snapshot.sections : [];
  if (snapshot?.kind === "groups") {
    const pages = [];
    for (let index = 0; index < sections.length; index += 4) pages.push(sections.slice(index, index + 4));
    return pages.length ? pages : [[]];
  }

  if (sections.length === 2 && sections.every((section) => section.entries.length <= 10)) return [sections];

  const pages = [];
  sections.forEach((section) => {
    for (let index = 0; index < section.entries.length; index += 14) {
      pages.push([{
        title: index > 0 ? `${section.title} — continuação` : section.title,
        entries: section.entries.slice(index, index + 14),
        startIndex: index,
      }]);
    }
  });
  return pages.length ? pages : [[]];
}

function drawShuffleVideoImageCover(context, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  context.drawImage(image, x - (drawWidth - width) / 2, y - (drawHeight - height) / 2, drawWidth, drawHeight);
}

function drawShuffleVideoBackground(context) {
  const gradient = context.createLinearGradient(0, 0, SHUFFLE_VIDEO_WIDTH, SHUFFLE_VIDEO_HEIGHT);
  gradient.addColorStop(0, "#06143d");
  gradient.addColorStop(0.54, "#12338d");
  gradient.addColorStop(1, "#0899c2");
  context.fillStyle = gradient;
  context.fillRect(0, 0, SHUFFLE_VIDEO_WIDTH, SHUFFLE_VIDEO_HEIGHT);

  context.save();
  context.globalAlpha = 0.18;
  context.fillStyle = "#22d3ee";
  context.beginPath();
  context.arc(650, 160, 260, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f97316";
  context.beginPath();
  context.arc(40, 1140, 250, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawShuffleVideoHeader(context, snapshot, assets, arenaName) {
  drawRoundedRect(context, 28, 24, 664, 214, 28, "rgba(4, 15, 48, 0.78)", "rgba(255, 255, 255, 0.16)");

  if (assets.logo) {
    const logoWidth = 230;
    const logoHeight = Math.min(112, logoWidth * (assets.logo.height / assets.logo.width));
    context.drawImage(assets.logo, 48, 47, logoWidth, logoHeight);
  } else {
    context.fillStyle = "#ffffff";
    context.font = "900 35px Arial";
    context.fillText("TORNEIO360", 48, 100);
  }

  const photoX = 610;
  const photoY = 91;
  const photoRadius = 47;
  context.save();
  context.beginPath();
  context.arc(photoX, photoY, photoRadius, 0, Math.PI * 2);
  context.clip();
  if (assets.arenaPhoto) {
    drawShuffleVideoImageCover(context, assets.arenaPhoto, photoX - photoRadius, photoY - photoRadius, photoRadius * 2, photoRadius * 2);
  } else {
    const avatar = context.createLinearGradient(photoX - photoRadius, photoY - photoRadius, photoX + photoRadius, photoY + photoRadius);
    avatar.addColorStop(0, "#2563eb");
    avatar.addColorStop(1, "#06b6d4");
    context.fillStyle = avatar;
    context.fillRect(photoX - photoRadius, photoY - photoRadius, photoRadius * 2, photoRadius * 2);
    context.fillStyle = "#ffffff";
    context.font = "900 30px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(arenaName || "A").slice(0, 2).toUpperCase(), photoX, photoY + 1);
  }
  context.restore();
  context.strokeStyle = "#fbbf24";
  context.lineWidth = 5;
  context.beginPath();
  context.arc(photoX, photoY, photoRadius + 2, 0, Math.PI * 2);
  context.stroke();

  context.textAlign = "right";
  context.textBaseline = "alphabetic";
  context.fillStyle = "#bae6fd";
  context.font = "800 13px Arial";
  context.fillText("ORGANIZAÇÃO", 548, 71);
  context.fillStyle = "#ffffff";
  context.font = "900 22px Arial";
  context.fillText(truncateCanvasText(context, arenaName || "Arena Torneio360", 244), 548, 103);

  context.textAlign = "left";
  context.fillStyle = "#fbbf24";
  context.font = "900 14px Arial";
  context.fillText("SORTEIO OFICIAL", 48, 166);
  context.fillStyle = "#ffffff";
  context.font = "900 27px Arial";
  context.fillText(truncateCanvasText(context, snapshot.tournamentName, 610), 48, 198);
  context.fillStyle = "#bfdbfe";
  context.font = "700 15px Arial";
  context.fillText(truncateCanvasText(context, snapshot.modalityName, 610), 48, 222);
}

function drawShuffleVideoFooter(context, snapshot, pageLabel = "") {
  context.fillStyle = "rgba(255, 255, 255, 0.8)";
  context.font = "700 13px Arial";
  context.textAlign = "left";
  context.fillText(`Código ${snapshot.id}`, 34, 1242);
  context.textAlign = "right";
  context.fillText(pageLabel || "Gerado pelo Torneio360", 686, 1242);
}

function drawShuffleVideoIntro(context, snapshot) {
  drawRoundedRect(context, 44, 294, 632, 802, 34, "rgba(4, 15, 48, 0.72)", "rgba(255, 255, 255, 0.16)");
  context.textAlign = "center";
  context.fillStyle = "#67e8f9";
  context.font = "900 18px Arial";
  context.fillText("TRANSPARÊNCIA E ORGANIZAÇÃO", 360, 470);
  context.fillStyle = "#ffffff";
  context.font = "900 58px Arial";
  context.fillText("SORTEIO", 360, 562);
  context.fillText("OFICIAL", 360, 628);
  context.fillStyle = "#fbbf24";
  context.font = "900 23px Arial";
  context.fillText(snapshot.kind === "groups" ? "FORMAÇÃO DOS GRUPOS" : "ORDEM DOS PARTICIPANTES", 360, 698);
  context.fillStyle = "#dbeafe";
  context.font = "700 19px Arial";
  context.fillText(new Date(snapshot.createdAt).toLocaleString("pt-BR"), 360, 784);
  drawRoundedRect(context, 178, 842, 364, 64, 20, "rgba(249, 115, 22, 0.95)");
  context.fillStyle = "#ffffff";
  context.font = "900 20px Arial";
  context.fillText("RESULTADO REGISTRADO", 360, 883);
}

function getShuffleVideoEntries(snapshot) {
  return (snapshot?.sections || []).flatMap((section) => section.entries || []);
}

function getShuffleVideoMotionSeed(value) {
  return String(value || "Torneio360").split("").reduce(
    (seed, character) => ((seed * 31) + character.charCodeAt(0)) >>> 0,
    2166136261
  );
}

function getShuffleVideoMotionOrder(length, seed) {
  const order = Array.from({ length }, (_, index) => index);
  let state = seed >>> 0;

  for (let index = order.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const targetIndex = state % (index + 1);
    [order[index], order[targetIndex]] = [order[targetIndex], order[index]];
  }

  return order;
}

function getShuffleVideoMotionSlots(length, cardWidth) {
  const columns = length <= 8 ? 2 : length <= 15 ? 3 : 4;
  const rows = Math.ceil(length / columns);
  const left = 48 + cardWidth / 2;
  const right = 672 - cardWidth / 2;
  const top = 430;
  const bottom = 1010;
  const columnGap = columns > 1 ? (right - left) / (columns - 1) : 0;
  const rowGap = rows > 1 ? (bottom - top) / (rows - 1) : 0;

  return Array.from({ length }, (_, index) => ({
    x: left + (index % columns) * columnGap,
    y: top + Math.floor(index / columns) * rowGap,
  }));
}

function drawShuffleVideoMotion(context, snapshot, elapsedMs) {
  drawRoundedRect(context, 36, 278, 648, 870, 32, "rgba(4, 15, 48, 0.7)", "rgba(255, 255, 255, 0.16)");
  const secondsLeft = Math.max(0, Math.ceil((5000 - elapsedMs) / 1000));
  context.textAlign = "left";
  context.fillStyle = "#67e8f9";
  context.font = "900 16px Arial";
  context.fillText(snapshot.kind === "groups" ? "SORTEANDO OS GRUPOS" : "SORTEANDO OS NOMES", 64, 327);
  context.fillStyle = "#ffffff";
  context.font = "900 30px Arial";
  context.fillText("Participantes em movimento", 64, 366);

  drawRoundedRect(context, 566, 303, 82, 66, 20, "rgba(34, 211, 238, 0.95)");
  context.textAlign = "center";
  context.fillStyle = "#06143d";
  context.font = "900 27px Arial";
  context.fillText(`${secondsLeft}s`, 607, 346);

  const entries = getShuffleVideoEntries(snapshot).slice(0, 20);
  const cardWidth = entries.length <= 8 ? 252 : entries.length <= 15 ? 184 : 138;
  const cardHeight = entries.length <= 8 ? 62 : 54;
  const slots = getShuffleVideoMotionSlots(entries.length, cardWidth);
  const movementDuration = 520;
  const movementStep = Math.floor(elapsedMs / movementDuration);
  const movementProgress = (elapsedMs % movementDuration) / movementDuration;
  const easedProgress = movementProgress * movementProgress * (3 - 2 * movementProgress);
  const baseSeed = getShuffleVideoMotionSeed(snapshot.id);
  const previousOrder = getShuffleVideoMotionOrder(entries.length, baseSeed + movementStep * 7919);
  const nextOrder = getShuffleVideoMotionOrder(entries.length, baseSeed + (movementStep + 1) * 7919);

  entries.forEach((entry, index) => {
    const previousSlot = slots[previousOrder[index]] || slots[index];
    const nextSlot = slots[nextOrder[index]] || slots[index];
    const arc = Math.sin(movementProgress * Math.PI) * (index % 2 === 0 ? -24 : 24);
    const centerX = previousSlot.x + (nextSlot.x - previousSlot.x) * easedProgress;
    const centerY = previousSlot.y + (nextSlot.y - previousSlot.y) * easedProgress + arc;
    const x = centerX - cardWidth / 2;
    const y = centerY - cardHeight / 2;
    const activeColor = (index + movementStep) % 3 === 0 ? "rgba(221,214,254,0.98)" : (index + movementStep) % 2 === 0 ? "rgba(255,255,255,0.98)" : "rgba(207,250,254,0.98)";

    context.save();
    context.translate(centerX, centerY);
    context.rotate(Math.sin(movementProgress * Math.PI) * (index % 2 === 0 ? -0.045 : 0.045));
    context.translate(-centerX, -centerY);
    context.shadowColor = "rgba(2, 6, 23, 0.28)";
    context.shadowBlur = 18;
    context.shadowOffsetY = 8;
    drawRoundedRect(context, x, y, cardWidth, cardHeight, 18, activeColor, "rgba(103,232,249,0.72)");
    context.restore();
    context.fillStyle = "#111b3f";
    context.font = entries.length <= 8 ? "900 18px Arial" : "800 15px Arial";
    context.textAlign = "center";
    context.fillText(truncateCanvasText(context, entry, cardWidth - 22), centerX, centerY + 5);
  });

  drawRoundedRect(context, 64, 1082, 592, 12, 6, "rgba(255,255,255,0.18)");
  const progress = Math.max(0, Math.min(1, elapsedMs / 5000));
  drawRoundedRect(context, 64, 1082, 592 * progress, 12, 6, "#22d3ee");
}

function drawShuffleVideoResultPage(context, snapshot, sections, pageIndex, totalPages) {
  drawRoundedRect(context, 28, 268, 664, 890, 32, "rgba(248, 250, 252, 0.97)", "rgba(255, 255, 255, 0.4)");
  context.textAlign = "left";
  context.fillStyle = "#ea580c";
  context.font = "900 15px Arial";
  context.fillText("RESULTADO DO SORTEIO", 54, 312);
  context.fillStyle = "#111b3f";
  context.font = "900 31px Arial";
  context.fillText(snapshot.kind === "groups" ? "Grupos definidos" : "Ordem definida", 54, 350);
  context.fillStyle = "#64748b";
  context.font = "700 14px Arial";
  context.textAlign = "right";
  context.fillText(`Página ${pageIndex + 1} de ${totalPages}`, 666, 340);

  const twoColumns = sections.length > 1;
  const columns = twoColumns ? 2 : 1;
  const cardWidth = twoColumns ? 294 : 610;
  const gapX = 18;
  const top = 382;
  const availableHeight = 728;
  const rows = Math.ceil(sections.length / columns);
  const cardHeight = Math.min(availableHeight / Math.max(1, rows) - 12, snapshot.kind === "groups" ? 340 : 710);

  sections.forEach((section, sectionIndex) => {
    const column = sectionIndex % columns;
    const row = Math.floor(sectionIndex / columns);
    const x = 54 + column * (cardWidth + gapX);
    const y = top + row * (cardHeight + 16);
    drawRoundedRect(context, x, y, cardWidth, cardHeight, 22, sectionIndex % 2 === 0 ? "#eef4ff" : "#f5f3ff", "#c7d7ee");
    context.fillStyle = sectionIndex % 2 === 0 ? "#1d4ed8" : "#6d28d9";
    context.font = "900 20px Arial";
    context.textAlign = "left";
    context.fillText(truncateCanvasText(context, section.title, cardWidth - 34), x + 18, y + 38);

    const entries = section.entries || [];
    const startIndex = Number(section.startIndex || 0);
    const rowGap = Math.min(54, Math.max(40, (cardHeight - 74) / Math.max(1, entries.length)));
    entries.forEach((entry, entryIndex) => {
      const entryY = y + 68 + entryIndex * rowGap;
      if (entryY + 31 > y + cardHeight) return;
      drawRoundedRect(context, x + 14, entryY - 24, cardWidth - 28, 38, 12, "rgba(255,255,255,0.92)", "#d9e3f2");
      context.fillStyle = "#f97316";
      context.font = "900 14px Arial";
      context.textAlign = "center";
      context.fillText(`${startIndex + entryIndex + 1}`, x + 35, entryY + 2);
      context.fillStyle = "#111827";
      context.font = "800 15px Arial";
      context.textAlign = "left";
      context.fillText(truncateCanvasText(context, entry, cardWidth - 76), x + 57, entryY + 2);
    });
  });

  context.textAlign = "center";
  context.fillStyle = "#0f766e";
  context.font = "900 16px Arial";
  context.fillText("Sorteio concluído e registrado no Torneio360", 360, 1132);
}

function getShuffleVideoMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
}

async function createShuffleVideoFile({ snapshot, arenaName, arenaPhotoUrl, onProgress }) {
  if (!snapshot || !Array.isArray(snapshot.sections)) throw new Error("O resultado deste sorteio não está disponível.");
  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error("Este navegador não consegue montar o vídeo. Tente pelo Chrome ou Edge atualizado.");
  }

  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = SHUFFLE_VIDEO_WIDTH;
  canvas.height = SHUFFLE_VIDEO_HEIGHT;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Não foi possível preparar o vídeo.");

  const [logo, arenaPhoto] = await Promise.all([
    loadShareImage(TORNEIO360_LOGO),
    loadShareImage(arenaPhotoUrl),
  ]);
  const assets = { logo, arenaPhoto };
  const pages = getShuffleVideoResultPages(snapshot);
  const introDuration = 1400;
  const shuffleDuration = 5000;
  const resultPageDuration = 2200;
  const closingDuration = 900;
  const totalDuration = introDuration + shuffleDuration + pages.length * resultPageDuration + closingDuration;
  const stream = canvas.captureStream(SHUFFLE_VIDEO_FPS);
  const mimeType = getShuffleVideoMimeType();
  const recorderOptions = { videoBitsPerSecond: 4_200_000 };
  if (mimeType) recorderOptions.mimeType = mimeType;
  const recorder = new MediaRecorder(stream, recorderOptions);
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data?.size) chunks.push(event.data);
  };
  const recorded = new Promise((resolve, reject) => {
    recorder.onerror = () => reject(new Error("O navegador interrompeu a gravação do vídeo."));
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || "video/webm" }));
  });

  recorder.start(500);
  const startedAt = performance.now();

  await new Promise((resolve) => {
    function renderFrame(now) {
      const elapsed = Math.min(totalDuration, now - startedAt);
      drawShuffleVideoBackground(context);
      drawShuffleVideoHeader(context, snapshot, assets, arenaName);

      if (elapsed < introDuration) {
        drawShuffleVideoIntro(context, snapshot);
        drawShuffleVideoFooter(context, snapshot);
      } else if (elapsed < introDuration + shuffleDuration) {
        drawShuffleVideoMotion(context, snapshot, elapsed - introDuration);
        drawShuffleVideoFooter(context, snapshot, "Sorteio em andamento");
      } else {
        const resultElapsed = elapsed - introDuration - shuffleDuration;
        const pageIndex = Math.min(pages.length - 1, Math.floor(resultElapsed / resultPageDuration));
        drawShuffleVideoResultPage(context, snapshot, pages[pageIndex], pageIndex, pages.length);
        drawShuffleVideoFooter(context, snapshot, "Gerado pelo Torneio360");
      }

      onProgress?.(Math.round((elapsed / totalDuration) * 100));
      if (elapsed >= totalDuration) {
        resolve();
        return;
      }
      requestAnimationFrame(renderFrame);
    }
    requestAnimationFrame(renderFrame);
  });

  recorder.stop();
  const blob = await recorded;
  stream.getTracks().forEach((track) => track.stop());
  if (!blob.size) throw new Error("O vídeo foi gerado sem conteúdo. Tente novamente.");

  const resolvedType = blob.type || recorder.mimeType || mimeType || "video/webm";
  const extension = resolvedType.includes("mp4") ? "mp4" : "webm";
  const safeTournamentName = String(snapshot.tournamentName || "sorteio")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return new File([blob], `${safeTournamentName || "sorteio"}-sorteio-torneio360.${extension}`, { type: resolvedType });
}

function downloadShuffleVideo(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ShuffleVideoModal({ snapshot, arenaName, arenaPhotoUrl, onClose }) {
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  async function generateVideo() {
    if (status === "generating") return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl("");
    setVideoFile(null);
    setMessage("");
    setProgress(0);
    setStatus("generating");
    try {
      const file = await createShuffleVideoFile({ snapshot, arenaName, arenaPhotoUrl, onProgress: setProgress });
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setStatus("ready");
    } catch (error) {
      console.error("Erro ao gerar vídeo do sorteio:", error);
      setMessage(error?.message || "Não foi possível gerar o vídeo.");
      setStatus("error");
    }
  }

  const sections = Array.isArray(snapshot?.sections) ? snapshot.sections : [];
  const entryCount = sections.reduce((total, section) => total + section.entries.length, 0);

  return (
    <div className="shuffleVideoOverlay" role="dialog" aria-modal="true" aria-label="Vídeo do sorteio">
      <div className="shuffleVideoModal">
        <div className="shuffleVideoModalHeader">
          <div>
            <span>Sorteio concluído</span>
            <h2>Vídeo do sorteio</h2>
            <p>Gerar e baixar é opcional. Nada será publicado automaticamente.</p>
          </div>
          <button type="button" className="shuffleVideoClose" onClick={onClose} disabled={status === "generating"} aria-label="Fechar vídeo do sorteio"><X /></button>
        </div>

        {status === "idle" || status === "error" ? (
          <div className="shuffleVideoChoice">
            <div className="shuffleVideoReceipt">
              <div><strong>{snapshot.tournamentName}</strong><span>{snapshot.modalityName}</span></div>
              <div><strong>{snapshot.kind === "groups" ? `${sections.length} grupos` : `${entryCount} participantes`}</strong><span>Código {snapshot.id}</span></div>
            </div>
            <div className="shuffleVideoMiniResult">
              {sections.slice(0, 4).map((section) => (
                <div key={section.title}>
                  <strong>{section.title}</strong>
                  <span>{section.entries.slice(0, 4).join(" • ")}{section.entries.length > 4 ? " • …" : ""}</span>
                </div>
              ))}
            </div>
            {message ? <p className="shuffleVideoMessage error">{message}</p> : null}
            <div className="shuffleVideoActions">
              <button type="button" className="shuffleVideoGenerate" onClick={generateVideo}><Dices /> Gerar vídeo</button>
              <button type="button" className="shuffleVideoSecondary" onClick={onClose}>Continuar sem gerar</button>
            </div>
          </div>
        ) : null}

        {status === "generating" ? (
          <div className="shuffleVideoGenerating" aria-live="polite">
            <RefreshCw className="shuffleVideoSpinner" />
            <strong>Montando o vídeo…</strong>
            <span>O resultado do sorteio não será alterado.</span>
            <div><i style={{ width: `${progress}%` }} /></div>
            <small>{progress}%</small>
          </div>
        ) : null}

        {status === "ready" && videoUrl ? (
          <div className="shuffleVideoReady">
            <div className="shuffleVideoPreviewShell">
              <video src={videoUrl} controls playsInline preload="metadata" aria-label="Prévia do vídeo do sorteio" />
            </div>
            {message ? <p className="shuffleVideoMessage">{message}</p> : null}
            <div className="shuffleVideoActions">
              <button type="button" className="shuffleVideoDownload" onClick={() => downloadShuffleVideo(videoFile)}><Download /> Baixar vídeo</button>
              <button type="button" className="shuffleVideoSecondary" onClick={onClose}>Fechar</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

class TournamentErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Erro ao abrir torneio", error, info);
  }

  componentDidUpdate(previousProps) {
    if (previousProps.tournamentId !== this.props.tournamentId && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="playAppShell">
          <main className="playMain">
            <section className="card">
              <h1>Não foi possível abrir este torneio</h1>
              <p>Os dados salvos dessa edição precisam ser revisados. Sua conta e os outros torneios continuam preservados.</p>
              <div className="actions">
                <button type="button" onClick={this.props.onBack}>Voltar aos torneios</button>
              </div>
            </section>
          </main>
        </div>
      );
    }

    return this.props.children;
  }
}

function TournamentScreen({
  tournament,
  userId,
  onBack,
  onSave,
  onNavigationStateChange,
  onRegisterNavigationGuard,
}) {
  const config = modalityConfig[tournament.type];

  if (!config) {
    return (
      <div className="playAppShell">
        <main className="playMain">
          <section className="card">
            <h1>Modalidade não reconhecida</h1>
            <p>Este torneio usa uma modalidade que não existe mais na versão atual da plataforma.</p>
            <div className="actions">
              <button type="button" onClick={onBack}>Voltar aos torneios</button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const initialTournamentState = useMemo(() => {
    const draft = readTournamentDraft(userId, tournament);
    const sourceData = draft?.data || tournament.data;
    const normalizedData = normalizeTournamentData(tournament.type, sourceData);
    const repairNeeded = Boolean(draft) || needsTournamentDataRepair(tournament.type, tournament.data);
    const repairIsSafe = preservesTournamentCriticalData(sourceData || {}, normalizedData);
    return {
      data: normalizedData,
      recoveredDraft: Boolean(draft),
      baseUpdatedAt: draft?.baseUpdatedAt || tournament.updated_at || null,
      baseRevision: draft?.baseRevision ?? getCollaborationRevision(tournament),
      baseData: draft?.baseData || tournament.data || {},
      shouldPersistRepair: repairNeeded && repairIsSafe,
      unsafeRepairDetected: repairNeeded && !repairIsSafe,
    };
  }, [tournament.id, tournament.type, userId]);
  const initialDataWasRepairedRef = useRef(
    initialTournamentState.shouldPersistRepair
  );

  const [data, setDataState] = useState(() => initialTournamentState.data);
  const currentCourtCount = getTournamentCourtCount(config, data);
  const participantAttendanceEntries = getParticipantAttendanceEntries(config, data);
  const pendingParticipantEntries = participantAttendanceEntries.filter((entry) => !entry.confirmed);

  const [savingStatus, setSavingStatus] = useState(initialTournamentState.recoveredDraft ? "Pendente de sincronização" : "Salvo na nuvem");
  const [shuffleOverlay, setShuffleOverlay] = useState(null);
  const [shuffleVideoSnapshot, setShuffleVideoSnapshot] = useState(null);
  const [tieBreakDraw, setTieBreakDraw] = useState(null);
  const [notice, setNotice] = useState(null);
  const [regenerationConfirm, setRegenerationConfirm] = useState(null);
  const [clearScoresOpen, setClearScoresOpen] = useState(false);
  const [clearTableOpen, setClearTableOpen] = useState(false);
  const [participantImportOpen, setParticipantImportOpen] = useState(false);
  const [participantImportBackup, setParticipantImportBackup] = useState(null);
  const [courtEditor, setCourtEditor] = useState(null);
  const [courtDuplicateConfirm, setCourtDuplicateConfirm] = useState(null);
  const [courtConfigRevision, setCourtConfigRevision] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  const [shareInfo, setShareInfo] = useState({
    public_id: tournament.public_id || null,
    is_public: tournament.is_public || false,
  });

  const [voiceRepeat, setVoiceRepeat] = useState(1);
  const [activeTournamentTab, setActiveTournamentTabState] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "participantes";
  });
  const [activeMatchesTab, setActiveMatchesTabState] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("partidas") || "grupos";
  });

  async function updateTournamentUrl(next = {}) {
    const params = new URLSearchParams(window.location.search);
    params.set("aba", "criar");
    params.set("torneio", tournament.id);
    params.set("tab", next.activeTournamentTab || activeTournamentTab);
    params.set("partidas", next.activeMatchesTab || activeMatchesTab);
    const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash || ""}`;
    window.history.replaceState(null, "", nextUrl);

    if (onNavigationStateChange) {
      onNavigationStateChange({
        tournamentId: tournament.id,
        tournamentTab: params.get("tab"),
        matchesTab: params.get("partidas"),
      });
      return;
    }

    try {
      const { error } = await supabase.from("user_app_state").upsert({
        user_id: tournament.user_id,
        last_url: nextUrl,
        last_panel: "criar",
        last_tournament_id: tournament.id,
        last_tournament_tab: params.get("tab"),
        last_matches_tab: params.get("partidas"),
        scroll_y: Math.max(0, Math.round(window.scrollY || 0)),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      if (error) console.error("Erro ao salvar posição do torneio", error);
    } catch (error) {
      console.error("Erro ao salvar posição do torneio", error);
    }
  }

  function setActiveTournamentTab(tab) {
    setActiveTournamentTabState(tab);
    updateTournamentUrl({ activeTournamentTab: tab });
  }

  function setActiveMatchesTab(tab) {
    setActiveMatchesTabState(tab);
    updateTournamentUrl({ activeMatchesTab: tab });
  }

  useEffect(() => {
    updateTournamentUrl();
  }, []);

  const saveTimerRef = useRef(null);
  const latestDataRef = useRef(data);
  const dataVersionRef = useRef(0);
  const unsafeRepairDetectedRef = useRef(initialTournamentState.unsafeRepairDetected);
  const hasUnsavedChangesRef = useRef(initialDataWasRepairedRef.current);
  const saveQueueRef = useRef(Promise.resolve(true));
  const serverUpdatedAtRef = useRef(initialTournamentState.baseUpdatedAt);
  const serverRevisionRef = useRef(initialTournamentState.baseRevision);
  const baseTournamentDataRef = useRef(initialTournamentState.baseData);
  const saveRetryTimerRef = useRef(null);
  const saveRetryAttemptRef = useRef(0);
  const submittedChangesRef = useRef(new Map());
  const lastConfirmedDataVersionRef = useRef(-1);
  const localBackupStateRef = useRef({ version: -1, saved: true });
  const tournamentScreenMountedRef = useRef(true);
  const onSaveRef = useRef(onSave);
  const tournamentRef = useRef(tournament);
  const shuffleAnimationTimerRef = useRef(null);
  const shuffleCountdownTimerRef = useRef(null);
  const tieBreakDrawTimerRef = useRef(null);

  function getOfflineBackupStatus() {
    const backupState = localBackupStateRef.current;
    if (backupState.version !== dataVersionRef.current || backupState.saved === null) {
      return "Guardando neste aparelho...";
    }
    return backupState.saved ? "Salvo neste aparelho" : "Falha no backup local";
  }

  function setData(nextValue) {
    if (unsafeRepairDetectedRef.current) {
      setNotice({
        type: "warning",
        title: "Edição temporariamente protegida",
        message: "Nenhum dado foi sobrescrito. Entre em contato com o suporte para recuperar este formato antes de continuar editando.",
      });
      return;
    }

    const currentData = latestDataRef.current;
    const nextData = typeof nextValue === "function" ? nextValue(currentData) : nextValue;
    if (!nextData || Object.is(nextData, currentData)) return;

    latestDataRef.current = nextData;
    dataVersionRef.current += 1;
    const draftVersion = dataVersionRef.current;
    localBackupStateRef.current = { version: draftVersion, saved: null };
    hasUnsavedChangesRef.current = true;
    const localBackup = saveTournamentDraft(
      userId,
      tournamentRef.current,
      nextData,
      serverUpdatedAtRef.current,
      baseTournamentDataRef.current,
      serverRevisionRef.current
    );
    setDataState(nextData);
    setSavingStatus(isBrowserOffline() ? "Guardando neste aparelho..." : "Salvando...");
    void localBackup.then((saved) => {
      if (!tournamentScreenMountedRef.current) return;
      if (localBackupStateRef.current.version !== draftVersion) return;
      localBackupStateRef.current = { version: draftVersion, saved };
      if (isBrowserOffline()) setSavingStatus(getOfflineBackupStatus());
      else if (!saved) setSavingStatus("Falha no backup local");
    });

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void queueTournamentSave(latestDataRef.current, dataVersionRef.current);
    }, 500);
  }

  function clearShuffleTimers() {
    if (shuffleAnimationTimerRef.current) clearInterval(shuffleAnimationTimerRef.current);
    if (shuffleCountdownTimerRef.current) clearInterval(shuffleCountdownTimerRef.current);
    shuffleAnimationTimerRef.current = null;
    shuffleCountdownTimerRef.current = null;
  }

  function clearTieBreakDrawTimer() {
    if (tieBreakDrawTimerRef.current) clearInterval(tieBreakDrawTimerRef.current);
    tieBreakDrawTimerRef.current = null;
  }

  function clearSaveRetryTimer() {
    if (saveRetryTimerRef.current) clearTimeout(saveRetryTimerRef.current);
    saveRetryTimerRef.current = null;
  }

  function scheduleSaveRetry() {
    if (saveRetryTimerRef.current) return;
    if (isBrowserOffline()) {
      setSavingStatus(getOfflineBackupStatus());
      return;
    }

    const delays = [2000, 5000, 10000, 20000, 30000];
    const delay = delays[Math.min(saveRetryAttemptRef.current, delays.length - 1)];
    saveRetryAttemptRef.current += 1;
    saveRetryTimerRef.current = setTimeout(() => {
      saveRetryTimerRef.current = null;
      if (!hasUnsavedChangesRef.current) return;
      setSavingStatus("Tentando sincronizar...");
      void queueTournamentSave(latestDataRef.current, dataVersionRef.current);
    }, delay);
  }

  function queueTournamentSave(snapshot, version, { updateStatus = true } = {}) {
    const queuedBaseData = baseTournamentDataRef.current;
    const queuedBaseRevision = serverRevisionRef.current;
    const queuedBaseUpdatedAt = serverUpdatedAtRef.current;
    const changeId = generateCollaborationChangeId();

    const runSave = async () => {
      try {
        if (version <= lastConfirmedDataVersionRef.current) {
          return {
            ok: true,
            tournament: tournamentRef.current,
            savedData: baseTournamentDataRef.current,
            savedIsCurrent: true,
            superseded: true,
          };
        }

        let dataToPersist = snapshot;
        let attemptBaseData = queuedBaseData;
        let expectedRevision = queuedBaseRevision;
        let expectedUpdatedAt = queuedBaseUpdatedAt;
        const currentRevision = serverRevisionRef.current;
        const baseChangedWhileQueued = currentRevision !== null && queuedBaseRevision !== null
          ? currentRevision !== queuedBaseRevision
          : expectedUpdatedAt !== serverUpdatedAtRef.current;

        if (baseChangedWhileQueued) {
          dataToPersist = mergeConcurrentTournamentData(
            queuedBaseData || {},
            snapshot,
            baseTournamentDataRef.current || {}
          ).data;
          attemptBaseData = baseTournamentDataRef.current;
          expectedRevision = serverRevisionRef.current;
          expectedUpdatedAt = serverUpdatedAtRef.current;
        }

        submittedChangesRef.current.set(changeId, { version, data: dataToPersist });

        for (let attempt = 0; attempt < 5; attempt += 1) {
          let result = await onSaveRef.current({
            ...tournamentRef.current,
            data: dataToPersist,
            revision: expectedRevision,
            updated_at: expectedUpdatedAt,
            changeId,
          });

          if (result?.ok && result.tournament) {
            lastConfirmedDataVersionRef.current = Math.max(lastConfirmedDataVersionRef.current, version);
            const currentServer = tournamentRef.current;
            const savedIsCurrent = !currentServer
              || compareCollaborationVersions(result.tournament, currentServer) >= 0;
            if (savedIsCurrent) {
              tournamentRef.current = result.tournament;
              serverRevisionRef.current = getCollaborationRevision(result.tournament);
              serverUpdatedAtRef.current = result.tournament.updated_at || serverUpdatedAtRef.current;
              baseTournamentDataRef.current = result.tournament.data || dataToPersist;
            }
            return { ...result, savedData: dataToPersist, savedIsCurrent };
          }

          if (!result?.conflict || !result.serverTournament?.data) return result;

          if (tournamentScreenMountedRef.current) {
            setSavingStatus("Sincronizando a alteração mais recente...");
          }
          const remoteTournament = compareCollaborationVersions(
            result.serverTournament,
            tournamentRef.current
          ) >= 0
            ? result.serverTournament
            : tournamentRef.current;
          dataToPersist = mergeConcurrentTournamentData(
            attemptBaseData || {},
            dataToPersist,
            remoteTournament.data || {}
          ).data;
          submittedChangesRef.current.set(changeId, { version, data: dataToPersist });
          attemptBaseData = remoteTournament.data || {};
          tournamentRef.current = remoteTournament;
          serverRevisionRef.current = getCollaborationRevision(remoteTournament);
          serverUpdatedAtRef.current = remoteTournament.updated_at || null;
          baseTournamentDataRef.current = attemptBaseData;
          expectedRevision = serverRevisionRef.current;
          expectedUpdatedAt = serverUpdatedAtRef.current;
        }

        return { ok: false, retryable: true, conflict: true };
      } catch (error) {
        console.error("Erro inesperado ao salvar o torneio:", error);
        return { ok: false, error, retryable: isRetryableConnectionError(error) };
      }
    };

    const queuedSave = saveQueueRef.current.then(runSave, runSave);
    saveQueueRef.current = queuedSave.then(() => true, () => false);

    return queuedSave.then((rawResult) => {
      submittedChangesRef.current.delete(changeId);
      const result = rawResult === true ? { ok: true } : (rawResult || { ok: false });
      const ok = result.ok === true;
      const isLatestVersion = version === dataVersionRef.current;

      if (ok && isLatestVersion) {
        const confirmedTournament = result.savedIsCurrent === false
          ? tournamentRef.current
          : result.tournament;
        const normalizedSavedData = normalizeTournamentData(
          confirmedTournament?.type || tournament.type,
          confirmedTournament?.data || result.savedData || snapshot
        );
        latestDataRef.current = normalizedSavedData;
        setDataState(normalizedSavedData);
        hasUnsavedChangesRef.current = false;
        clearTournamentDraft(userId, tournament.id);
        clearSaveRetryTimer();
        saveRetryAttemptRef.current = 0;
      }

      if (!ok && (result.retryable || result.conflict) && isLatestVersion) {
        saveTournamentDraft(
          userId,
          tournamentRef.current,
          latestDataRef.current,
          serverUpdatedAtRef.current,
          baseTournamentDataRef.current,
          serverRevisionRef.current
        );
        scheduleSaveRetry();
      }

      if (updateStatus && isLatestVersion && tournamentScreenMountedRef.current) {
        if (ok) setSavingStatus("Salvo na nuvem");
        else if (result.retryable || result.conflict || result.offline) setSavingStatus(isBrowserOffline() ? getOfflineBackupStatus() : "Sincronização pendente");
        else setSavingStatus("Erro ao salvar");
      }
      return ok;
    });
  }

  const ranking = useMemo(
    () => calculateRanking(data, tournament.type, data.rankingCriteria),
    [data, tournament.type]
  );

  const cupGroupRankings = useMemo(
    () => isCupType(config) && (data.groupsShuffled || data.schedule?.length > 0)
      ? calculateCupGroupRankings(data, data.rankingCriteria)
      : [],
    [data, config.type]
  );

  const copinhaGroupCampaignTies = useMemo(
    () => isCopinhaData(data) && data.schedule?.length > 0
      ? getCopinhaSeededGroups(data).unresolvedGroupTies
      : [],
    [data, config.type]
  );

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    const submittedChange = tournament.last_change_id
      ? submittedChangesRef.current.get(tournament.last_change_id)
      : null;
    const ownSubmission = submittedChange
      && tournamentMutationDataEquals(submittedChange.data, tournament.data)
      ? submittedChange
      : null;
    if (submittedChange && !ownSubmission) {
      submittedChangesRef.current.delete(tournament.last_change_id);
    }
    const incomingIsNewer = compareCollaborationVersions(tournament, tournamentRef.current) > 0;

    if (ownSubmission) {
      submittedChangesRef.current.delete(tournament.last_change_id);
      if (incomingIsNewer) {
        serverRevisionRef.current = getCollaborationRevision(tournament);
        serverUpdatedAtRef.current = tournament.updated_at || null;
        baseTournamentDataRef.current = tournament.data || {};
        tournamentRef.current = tournament;
      }

      if (ownSubmission.version === dataVersionRef.current) {
        lastConfirmedDataVersionRef.current = Math.max(
          lastConfirmedDataVersionRef.current,
          ownSubmission.version
        );
        const confirmedData = normalizeTournamentData(tournament.type, tournament.data);
        latestDataRef.current = confirmedData;
        setDataState(confirmedData);
        hasUnsavedChangesRef.current = false;
        clearTournamentDraft(userId, tournament.id);
        clearSaveRetryTimer();
        saveRetryAttemptRef.current = 0;
        setSavingStatus("Salvo na nuvem");
      } else if (hasUnsavedChangesRef.current) {
        saveTournamentDraft(
          userId,
          tournamentRef.current,
          latestDataRef.current,
          serverUpdatedAtRef.current,
          baseTournamentDataRef.current,
          serverRevisionRef.current
        );
      }
      return;
    }

    if (!incomingIsNewer) return;

    if (hasUnsavedChangesRef.current) {
      const merged = mergeConcurrentTournamentData(
        baseTournamentDataRef.current,
        latestDataRef.current,
        tournament.data || {}
      );
      serverRevisionRef.current = getCollaborationRevision(tournament);
      serverUpdatedAtRef.current = tournament.updated_at || null;
      baseTournamentDataRef.current = tournament.data || {};
      tournamentRef.current = tournament;
      const mergedData = normalizeTournamentData(tournament.type, merged.data);

      if (!tournamentDataEquals(mergedData, latestDataRef.current)) {
        setSavingStatus("Sincronizando a alteração mais recente...");
        setData(mergedData);
      } else {
        saveTournamentDraft(
          userId,
          tournamentRef.current,
          latestDataRef.current,
          serverUpdatedAtRef.current,
          baseTournamentDataRef.current,
          serverRevisionRef.current
        );
      }
      return;
    }

    serverRevisionRef.current = getCollaborationRevision(tournament);
    serverUpdatedAtRef.current = tournament.updated_at || null;
    baseTournamentDataRef.current = tournament.data || {};
    tournamentRef.current = tournament;
    const incomingData = normalizeTournamentData(tournament.type, tournament.data);
    latestDataRef.current = incomingData;
    setDataState(incomingData);
    setSavingStatus("Atualizado de outro dispositivo");
  }, [tournament.revision, tournament.updated_at, tournament.last_change_id]);

  useEffect(() => {
    const handleOnline = () => {
      if (!hasUnsavedChangesRef.current) return;
      clearSaveRetryTimer();
      setSavingStatus("Sincronizando...");
      void queueTournamentSave(latestDataRef.current, dataVersionRef.current);
    };
    const handleOffline = () => {
      if (hasUnsavedChangesRef.current) setSavingStatus(getOfflineBackupStatus());
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const cearenseCampaignTies = useMemo(() => {
    if (!isCearenseData(data) || !data.schedule?.length) return [];
    if (!data.schedule.flat().every((game) => isGameFinished(game, getWinningScore(data)))) return [];

    const groupRankings = calculateCupGroupRankings(data, data.rankingCriteria);
    if (groupRankings.some((group) => group.unresolvedTieIds?.length > 1)) return [];

    return getCearenseQualified(data).unresolvedCampaignTies;
  }, [data, config.type]);

  useEffect(() => {
    if (initialTournamentState.recoveredDraft) return undefined;
    let cancelled = false;

    async function hydrateDurableDraft() {
      const pendingDrafts = await listPendingTournaments(userId);
      if (cancelled) return;
      const durableDraft = pendingDrafts.find((draft) => (
        String(draft.tournamentId) === String(tournament.id) && draft?.data
      ));
      if (!durableDraft) return;

      const normalizedDraft = normalizeTournamentData(tournament.type, durableDraft.data);
      if (!preservesTournamentCriticalData(durableDraft.data, normalizedDraft)) {
        unsafeRepairDetectedRef.current = true;
        setNotice({
          type: "warning",
          title: "Backup local protegido",
          message: "Há uma cópia local em formato inesperado. Nenhuma gravação automática será feita para evitar reduzir nomes, jogos ou placares.",
        });
        return;
      }

      if (tournamentMutationDataEquals(normalizedDraft, baseTournamentDataRef.current)) {
        clearTournamentDraft(userId, tournament.id);
        return;
      }

      const recoveredData = hasUnsavedChangesRef.current
        ? mergeConcurrentTournamentData(
            durableDraft.baseData || {},
            latestDataRef.current,
            normalizedDraft
          ).data
        : mergeConcurrentTournamentData(
            durableDraft.baseData || {},
            normalizedDraft,
            baseTournamentDataRef.current || {}
          ).data;
      unsafeRepairDetectedRef.current = false;
      setSavingStatus("Recuperando backup deste aparelho...");
      setData(normalizeTournamentData(tournament.type, recoveredData));
    }

    void hydrateDurableDraft();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => {
    tournamentScreenMountedRef.current = false;
    clearShuffleTimers();
    clearTieBreakDrawTimer();
    clearSaveRetryTimer();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (hasUnsavedChangesRef.current) {
      void queueTournamentSave(latestDataRef.current, dataVersionRef.current, { updateStatus: false });
    }
  }, []);

  useEffect(() => {
    if (!initialTournamentState.unsafeRepairDetected) return;
    setNotice({
      type: "warning",
      title: "Dados antigos protegidos",
      message: "A plataforma encontrou um formato inesperado e bloqueou qualquer gravação automática que pudesse reduzir nomes, jogos ou placares.",
    });
  }, []);

  useEffect(() => {
    if (!initialDataWasRepairedRef.current) return undefined;

    let cancelled = false;

    async function persistRecoveredData() {
      saveTournamentDraft(
        userId,
        tournamentRef.current,
        latestDataRef.current,
        serverUpdatedAtRef.current,
        baseTournamentDataRef.current,
        serverRevisionRef.current
      );
      setSavingStatus("Recuperando dados...");
      const ok = await queueTournamentSave(data, dataVersionRef.current, { updateStatus: false });

      if (!cancelled) {
        setSavingStatus(ok ? "Dados recuperados" : "Erro ao recuperar dados");
      }
    }

    persistRecoveredData();

    return () => {
      cancelled = true;
    };
  }, []);

  async function flushPendingTournamentSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;

    if (hasUnsavedChangesRef.current) {
      setSavingStatus("Salvando antes de sair...");
      const ok = await queueTournamentSave(
        latestDataRef.current,
        dataVersionRef.current,
        { updateStatus: false }
      );

      if (!ok) {
        setSavingStatus("Erro ao salvar");
        showNotice(
          "error",
          "Dados ainda não sincronizados",
          "A tela foi mantida aberta para proteger placares, confrontos e rankings. Verifique a conexão e tente novamente."
        );
        return false;
      }
    }

    return true;
  }

  useEffect(() => {
    if (typeof onRegisterNavigationGuard !== "function") return undefined;
    onRegisterNavigationGuard(flushPendingTournamentSave);
    return () => onRegisterNavigationGuard(null);
  }, []);

  async function handleBack() {
    const canLeave = await flushPendingTournamentSave();
    if (!canLeave) return;

    onBack();
  }

  function showNotice(type, title, message) {
    setNotice({ type, title, message });
  }

  async function enablePublicShare() {
    if (isBrowserOffline()) {
      showNotice("warning", "Sem internet", "Reconecte-se para ativar e confirmar o link público na nuvem.");
      return;
    }
    setShareLoading(true);

    const publicId = shareInfo.public_id || generatePublicId();

    const { error } = await supabase
      .from("tournaments")
      .update({
        public_id: publicId,
        is_public: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tournament.id)
      .eq("user_id", userId);

    setShareLoading(false);

    if (error) {
      console.error(error);
      showNotice("error", "Erro ao gerar link", "Não foi possível ativar o link público.");
      return;
    }

    const nextInfo = {
      public_id: publicId,
      is_public: true,
    };

    setShareInfo(nextInfo);

    const ok = await copyToClipboard(getPublicShareMessage(publicId));

    showNotice(
      "success",
      "Link público ativado",
      ok
        ? "A mensagem com o link foi ativada e copiada para a área de transferência."
        : "O link foi ativado. Copie o link na área de compartilhamento."
    );
  }

  async function disablePublicShare() {
    if (!shareInfo.public_id) return;
    if (isBrowserOffline()) {
      showNotice("warning", "Sem internet", "Reconecte-se para desativar o link público com segurança.");
      return;
    }

    setShareLoading(true);

    const { error } = await supabase
      .from("tournaments")
      .update({
        is_public: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tournament.id)
      .eq("user_id", userId);

    setShareLoading(false);

    if (error) {
      console.error(error);
      showNotice("error", "Erro ao desativar", "Não foi possível desativar o link público.");
      return;
    }

    setShareInfo((prev) => ({
      ...prev,
      is_public: false,
    }));

    showNotice("success", "Link desativado", "O link público foi desativado.");
  }

  async function copyPublicLink() {
    const ok = await copyToClipboard(getArenaPublicUrl(userId));

    showNotice(
      ok ? "success" : "error",
      ok ? "Link copiado" : "Erro ao copiar",
      ok ? "O link real do perfil da arena foi copiado para a área de transferência." : "Não foi possível copiar o link."
    );
  }

  async function sharePublicLink() {
    const url = getArenaPublicUrl(userId);

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: tournament.name || "Torneio 360",
          text: "Acompanhe os torneios e circuitos desta arena no Torneio360.",
          url,
        });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    const ok = await copyToClipboard(url);
    showNotice(
      ok ? "success" : "error",
      ok ? "Link pronto para compartilhar" : "Erro ao compartilhar",
      ok ? "O navegador não abriu o compartilhamento, então copiamos o link para você." : "Não foi possível compartilhar o link."
    );
  }

  function updateRankingCriteria(value) {
    setData((prev) => {
      const copy = { ...prev, rankingCriteria: value };

      if (isCearenseData(copy)) {
        copy.brackets = [];
        resetCopinhaTieBreaks(copy);
      }

      return copy;
    });
  }

  function updateCupConfig(field, value) {
    setParticipantImportBackup(null);
    setData((prev) => {
      const copy = structuredClone(prev);

      copy.cupConfig = {
        ...(copy.cupConfig || {}),
        [field]: value,
      };

      if (field === "teamCount") {
        const teamCount = Number(value);
        copy.cupConfig.teamCount = teamCount;
        const previousPlayers = structuredClone(copy.players);
        const nextTeams = Array.from({ length: teamCount }, (_, i) => {
          return copy.players.teams[i] || {
            a: `Atleta 1 da dupla ${i + 1}`,
            b: `Atleta 2 da dupla ${i + 1}`,
          };
        });
        copy.players.teams = nextTeams;
        copy.participantAttendance = reconcileParticipantAttendance(
          config,
          previousPlayers,
          copy.players,
          copy.participantAttendance
        );

        copy.schedule = [];
        copy.brackets = [];
        copy.groupsShuffled = false;
        delete copy.lastShuffleVideo;
        resetCopinhaTieBreaks(copy);
      }

      return copy;
    });
  }

  function applySimplePlayerCount(value) {
    const playerCount = Number(value);
    if (!isFlexibleSimpleType(config) || !config.allowedPlayerCounts.includes(playerCount)) return;

    setParticipantImportBackup(null);
    setData((prev) => {
      const copy = structuredClone(prev);
      const previousPlayers = structuredClone(copy.players);
      copy.simplePlayerCount = playerCount;
      copy.players = Array.from({ length: playerCount }, (_, index) => (
        copy.players?.[index] || `${config.label} ${index + 1}`
      ));
      copy.participantAttendance = reconcileParticipantAttendance(
        config,
        previousPlayers,
        copy.players,
        copy.participantAttendance
      );
      copy.schedule = [];
      copy.namesShuffled = false;
      delete copy.lastShuffleVideo;
      copy.courtNumbers = normalizeCourtNumbers(copy.courtNumbers, playerCount / 2);
      return copy;
    });
    setCourtConfigRevision((revision) => revision + 1);
    showNotice(
      "success",
      "Quantidade atualizada",
      `${playerCount} jogadores selecionados. Cada atleta enfrentará os outros ${playerCount - 1} uma vez.`
    );
  }

  function requestSimplePlayerCount(value) {
    const playerCount = Number(value);
    if (playerCount === getSimplePlayerCount(config, data)) return;

    if (!data.schedule?.length) {
      applySimplePlayerCount(playerCount);
      return;
    }

    setRegenerationConfirm({
      action: "simple-player-count",
      playerCount,
      title: "Alterar a quantidade de jogadores?",
      message: `O torneio passará a ter ${playerCount} jogadores no formato todos contra todos.`,
      impacts: [
        "As rodadas, os jogos e os placares atuais serão apagados.",
        "Os nomes que ainda couberem nas novas vagas serão preservados.",
        "Será necessário criar novamente as rodadas e os jogos.",
      ],
      confirmLabel: "Alterar e recriar os jogos",
    });
  }

  function startTieBreakDraw({ kind, tieKey, ids, candidates, title }) {
    if (!Array.isArray(ids) || ids.length < 2 || tieBreakDrawTimerRef.current) return;

    const order = shuffleArray([...ids]);
    const providedCandidateNames = new Map(
      (candidates || []).map((candidate) => [String(candidate.id), candidate.name])
    );
    const candidateNames = new Map(
      ids.map((id) => [String(id), providedCandidateNames.get(String(id)) || "Participante"])
    );
    const orderNames = order.map((id) => candidateNames.get(String(id)) || "Participante");
    const endsAt = Date.now() + 5000;

    setTieBreakDraw({
      phase: "drawing",
      title,
      seconds: 5,
      spotlight: orderNames[0],
      candidates: [...candidateNames.values()],
    });

    tieBreakDrawTimerRef.current = setInterval(() => {
      const remaining = endsAt - Date.now();

      if (remaining > 0) {
        const names = [...candidateNames.values()];
        setTieBreakDraw((current) => current ? {
          ...current,
          seconds: Math.max(1, Math.ceil(remaining / 1000)),
          spotlight: names[Math.floor(Math.random() * names.length)] || current.spotlight,
        } : current);
        return;
      }

      clearTieBreakDrawTimer();
      setData((prev) => {
        const copy = structuredClone(prev);
        const cupConfig = copy.cupConfig || {};

        if (kind === "group") {
          copy.cupConfig = {
            ...cupConfig,
            tieBreakOverrides: {
              ...(cupConfig.tieBreakOverrides || {}),
              [String(tieKey)]: order,
            },
            ...(isCearenseData(copy) ? { campaignTieBreakOverrides: {} } : {}),
          };
        } else if (kind === "groupCampaign") {
          copy.cupConfig = {
            ...cupConfig,
            groupTieBreakOverrides: {
              ...(cupConfig.groupTieBreakOverrides || {}),
              [tieKey]: order,
            },
          };
        } else {
          copy.cupConfig = {
            ...cupConfig,
            campaignTieBreakOverrides: {
              ...(cupConfig.campaignTieBreakOverrides || {}),
              [tieKey]: order,
            },
          };
        }

        copy.brackets = [];
        return copy;
      });
      setTieBreakDraw({
        phase: "result",
        title,
        winner: orderNames[0],
        orderNames,
      });
    }, 140);
  }

  function resolveCopinhaTie(groupId, teamIds) {
    const group = cupGroupRankings.find((item) => String(item.id) === String(groupId));
    const candidates = (group?.rows || []).filter((row) => (
      teamIds.some((id) => String(id) === String(row.id))
    ));

    startTieBreakDraw({
      kind: "group",
      tieKey: groupId,
      ids: teamIds,
      candidates,
      title: `Desempate do ${group?.name || "grupo"}`,
    });
  }

  function resolveCopinhaGroupTie(tieKey, groupIds) {
    const candidates = cupGroupRankings
      .filter((group) => groupIds.some((id) => String(id) === String(group.id)))
      .map((group) => ({ id: group.id, name: group.name }));

    startTieBreakDraw({
      kind: "groupCampaign",
      tieKey,
      ids: groupIds,
      candidates,
      title: "Sorteio da melhor campanha",
    });
  }

  function resolveCearenseCampaignTie(tieKey, teamIds) {
    const tie = cearenseCampaignTies.find((item) => item.tieKey === tieKey);

    startTieBreakDraw({
      kind: "campaign",
      tieKey,
      ids: teamIds,
      candidates: tie?.rows || teamIds.map((id) => ({ id, name: getCupTeamName(data, id) })),
      title: "Desempate entre grupos",
    });
  }

  function refreshGameParticipantNames(nextData) {
    function getTeamNames(ids = []) {
      if (!ids.length) return ["Aguardando"];

      if (isMixedType(config)) {
        const allPlayers = [...(nextData.players?.men || []), ...(nextData.players?.women || [])];
        return ids.map((id) => allPlayers[id] || "");
      }

      if (config.type === "fixed12" || config.type === "fixed16" || isCupType(config)) {
        return ids.map((id) => getTeamName(nextData.players?.teams?.[id]));
      }

      return ids.map((id) => nextData.players?.[id] || "");
    }

    function refreshGame(game) {
      return {
        ...game,
        team1: game.ids1?.length ? getTeamNames(game.ids1) : game.team1,
        team2: game.ids2?.length ? getTeamNames(game.ids2) : game.team2,
      };
    }

    nextData.schedule = (nextData.schedule || []).map((round) =>
      round.map((game) => refreshGame(game))
    );

    nextData.brackets = (nextData.brackets || []).map((game) => refreshGame(game));

    return nextData;
  }

  function updatePlayer(path, value) {
    const copy = structuredClone(data);
    const formattedValue = formatParticipantName(value);
    copy.participantAttendance = normalizeParticipantAttendance(config, copy.players, copy.participantAttendance);

    if (path.kind === "normal") copy.players[path.index] = formattedValue;
    if (path.kind === "men") copy.players.men[path.index] = formattedValue;
    if (path.kind === "women") copy.players.women[path.index] = formattedValue;
    if (path.kind === "team") copy.players.teams[path.index][path.field] = formattedValue;
    setParticipantAttendanceValue(copy.participantAttendance, path, false);
    delete copy.lastShuffleVideo;

    setParticipantImportBackup(null);
    setData(refreshGameParticipantNames(copy));
  }

  function updateParticipantAttendance(path, confirmed) {
    setData((prev) => {
      const copy = structuredClone(prev);
      copy.participantAttendance = normalizeParticipantAttendance(config, copy.players, copy.participantAttendance);
      setParticipantAttendanceValue(copy.participantAttendance, path, confirmed);
      return copy;
    });
  }

  function setAllParticipantAttendance(confirmed) {
    setData((prev) => ({
      ...prev,
      participantAttendance: normalizeParticipantAttendance(
        config,
        prev.players,
        confirmed
          ? (() => {
              const attendance = normalizeParticipantAttendance(config, prev.players, null);
              getParticipantAttendanceEntries(config, { players: prev.players, participantAttendance: attendance })
                .forEach((entry) => setParticipantAttendanceValue(attendance, entry.path, true));
              return attendance;
            })()
          : null
      ),
    }));
    showNotice(
      "success",
      confirmed ? "Presenças confirmadas" : "Presenças redefinidas",
      confirmed ? "Todos os participantes foram marcados como confirmados." : "Todos os participantes foram marcados como pendentes."
    );
  }

  function ensureParticipantsConfirmed() {
    if (pendingParticipantEntries.length === 0) return true;

    const pendingNames = pendingParticipantEntries
      .slice(0, 5)
      .map((entry) => entry.name || "Participante sem nome")
      .join(", ");
    const remaining = pendingParticipantEntries.length - Math.min(5, pendingParticipantEntries.length);
    showNotice(
      "warning",
      `${pendingParticipantEntries.length} presença${pendingParticipantEntries.length === 1 ? " pendente" : "s pendentes"}`,
      `Confirme todos antes de criar os jogos. Pendentes: ${pendingNames}${remaining > 0 ? ` e mais ${remaining}` : ""}.`
    );
    setActiveTournamentTab("participantes");
    return false;
  }

  function commitDefaultCourtNumber(index, value) {
    const nextNumber = normalizeCourtNumberValue(value) || String(index + 1);
    setData((prev) => {
      const copy = structuredClone(prev);
      copy.courtNumbers = normalizeCourtNumbers(copy.courtNumbers, Math.max(currentCourtCount, index + 1));
      copy.courtNumbers[index] = nextNumber;
      return copy;
    });
  }

  function requestDefaultCourtNumber(index, value) {
    const nextNumber = normalizeCourtNumberValue(value) || String(index + 1);
    const numbers = normalizeCourtNumbers(data.courtNumbers, currentCourtCount);
    if (numbers[index] === nextNumber) return;

    const duplicateIndex = numbers.findIndex((number, currentIndex) => currentIndex !== index && number === nextNumber);

    if (duplicateIndex >= 0) {
      setCourtDuplicateConfirm({
        kind: "default",
        index,
        number: nextNumber,
        duplicatePosition: duplicateIndex + 1,
      });
      return;
    }

    commitDefaultCourtNumber(index, nextNumber);
  }

  function resetDefaultCourtNumbers() {
    setData((prev) => {
      const copy = structuredClone(prev);
      copy.courtNumbers = createDefaultCourtNumbers(Math.max(currentCourtCount, prev.courtNumbers?.length || 0));
      copy.schedule = (copy.schedule || []).map((round) => round.map((game) => {
        const nextGame = { ...game };
        delete nextGame.courtLabelOverride;
        delete nextGame.courtNumberOverride;
        return nextGame;
      }));
      copy.brackets = (copy.brackets || []).map((game) => {
        const nextGame = { ...game };
        delete nextGame.courtLabelOverride;
        delete nextGame.courtNumberOverride;
        return nextGame;
      });
      return copy;
    });
    setCourtConfigRevision((value) => value + 1);
    showNotice("success", "Quadras restauradas", "Os números das quadras voltaram ao padrão desta modalidade.");
  }

  function getCourtAssignmentContext(source, editor) {
    if (!editor) return { game: null, peers: [] };

    if (editor.scope === "schedule") {
      const peers = source.schedule?.[editor.roundIndex] || [];
      return { game: peers[editor.gameIndex] || null, peers };
    }

    const game = (source.brackets || []).find((item) => item.matchKey === editor.matchKey) || null;
    const peers = game
      ? (source.brackets || []).filter((item) => item.phase === game.phase && item.roundName === game.roundName)
      : [];
    return { game, peers };
  }

  function commitGameCourtNumber(editor, value) {
    const nextNumber = normalizeCourtNumberValue(value);
    if (!editor || !nextNumber) return;
    setData((prev) => {
      const copy = structuredClone(prev);
      const courtNumbers = normalizeCourtNumbers(copy.courtNumbers, getTournamentCourtCount(config, copy));
      const { game } = getCourtAssignmentContext(copy, editor);
      if (!game) return prev;
      applyCourtNumberToGame(game, nextNumber, courtNumbers);
      return copy;
    });

    setCourtEditor(null);
    setCourtDuplicateConfirm(null);
    showNotice(
      "success",
      "Quadra alterada",
      `O jogo agora aparece como Quadra ${nextNumber}.`
    );
  }

  function requestGameCourtNumber(value) {
    const nextNumber = normalizeCourtNumberValue(value);
    if (!courtEditor || !nextNumber) return;

    const courtNumbers = normalizeCourtNumbers(data.courtNumbers, currentCourtCount);
    const context = getCourtAssignmentContext(data, courtEditor);
    if (context.game && getGameCourtNumber(context.game, courtNumbers) === nextNumber) {
      setCourtEditor(null);
      return;
    }

    const duplicateGame = context.peers.find((game) => (
      game !== context.game && getGameCourtNumber(game, courtNumbers) === nextNumber
    ));

    if (duplicateGame) {
      setCourtDuplicateConfirm({ kind: "game", editor: courtEditor, number: nextNumber });
      setCourtEditor(null);
      return;
    }

    commitGameCourtNumber(courtEditor, nextNumber);
  }

  function confirmDuplicateCourtNumber() {
    if (!courtDuplicateConfirm) return;

    if (courtDuplicateConfirm.kind === "default") {
      commitDefaultCourtNumber(courtDuplicateConfirm.index, courtDuplicateConfirm.number);
      setCourtDuplicateConfirm(null);
      return;
    }

    commitGameCourtNumber(courtDuplicateConfirm.editor, courtDuplicateConfirm.number);
  }

  function cancelDuplicateCourtNumber() {
    if (courtDuplicateConfirm?.kind === "default") {
      setCourtConfigRevision((value) => value + 1);
    }
    setCourtDuplicateConfirm(null);
  }

  function importParticipants(nextPlayers, summary) {
    const copy = structuredClone(data);

    setParticipantImportBackup({
      players: structuredClone(data.players),
      participantAttendance: structuredClone(data.participantAttendance),
    });
    copy.participantAttendance = reconcileParticipantAttendance(
      config,
      copy.players,
      nextPlayers,
      copy.participantAttendance
    );
    copy.players = structuredClone(nextPlayers);
    delete copy.lastShuffleVideo;
    setData(refreshGameParticipantNames(copy));
    setParticipantImportOpen(false);
    showNotice(
      "success",
      "Lista importada",
      `${summary.imported} nome${summary.imported === 1 ? "" : "s"} preenchido${summary.imported === 1 ? "" : "s"}. ${summary.preserved} nome${summary.preserved === 1 ? "" : "s"} já editado${summary.preserved === 1 ? " foi preservado" : "s foram preservados"}.`
    );
  }

  function undoParticipantImport() {
    if (!participantImportBackup) return;

    const copy = structuredClone(data);
    copy.players = structuredClone(participantImportBackup.players);
    copy.participantAttendance = structuredClone(participantImportBackup.participantAttendance);
    setParticipantImportBackup(null);
    setData(refreshGameParticipantNames(copy));
    showNotice("success", "Importação desfeita", "A lista de participantes voltou ao estado anterior.");
  }

  function finishShuffle() {
    const copy = structuredClone(data);
    copy.participantAttendance = normalizeParticipantAttendance(config, copy.players, copy.participantAttendance);

    const shuffledIndexes = (length) => shuffleArray(Array.from({ length }, (_, index) => index));

    if (isMixedType(config)) {
      const menOrder = shuffledIndexes(copy.players.men.length);
      const womenOrder = shuffledIndexes(copy.players.women.length);
      copy.players.men = menOrder.map((index) => copy.players.men[index]);
      copy.participantAttendance.men = menOrder.map((index) => copy.participantAttendance.men[index]);
      copy.players.women = womenOrder.map((index) => copy.players.women[index]);
      copy.participantAttendance.women = womenOrder.map((index) => copy.participantAttendance.women[index]);
    } else if (config.type === "fixed12" || config.type === "fixed16" || isCupType(config)) {
      const teamOrder = shuffledIndexes(copy.players.teams.length);
      copy.players.teams = teamOrder.map((index) => copy.players.teams[index]);
      copy.participantAttendance.teams = teamOrder.map((index) => copy.participantAttendance.teams[index]);
    } else {
      const playerOrder = shuffledIndexes(copy.players.length);
      copy.players = playerOrder.map((index) => copy.players[index]);
      copy.participantAttendance = playerOrder.map((index) => copy.participantAttendance[index]);
    }

    copy.schedule = [];

    if (isCupType(config)) {
      copy.brackets = [];
      copy.groupsShuffled = true;
      resetCopinhaTieBreaks(copy);
    } else {
      copy.namesShuffled = true;
    }

    const videoSnapshot = createShuffleVideoSnapshot(copy, config, tournament);
    copy.lastShuffleVideo = videoSnapshot;

    setData(copy);
    setShuffleOverlay(null);
    setShuffleVideoSnapshot(videoSnapshot);
  }

function shuffleNames() {
  clearShuffleTimers();
  const names = getShuffleNames(data, config);

  if (!names.length) {
    showNotice("warning", "Sem participantes", "Adicione os nomes antes do sorteio.");
    return;
  }

  let seconds = SHUFFLE_DURATION_SECONDS;

  setShuffleOverlay({
    seconds,
    items: createShuffleAnimationItems(names),
  });

  const interval = setInterval(() => {
    setShuffleOverlay((prev) => (prev ? {
      ...prev,
      items: moveShuffleAnimationItems(prev.items),
    } : null));
  }, SHUFFLE_MOVEMENT_INTERVAL_MS);
  shuffleAnimationTimerRef.current = interval;

  const countdown = setInterval(() => {
    seconds -= 1;
    setShuffleOverlay((prev) => (prev ? { ...prev, seconds } : null));

    if (seconds <= 0) {
      clearShuffleTimers();
      finishShuffle();
    }
  }, 1000);
  shuffleCountdownTimerRef.current = countdown;
}

function generate() {
  if (isCupType(config)) {
    const schedule = generateCupGroupSchedule(data.players, data.cupConfig || {});

    setData((prev) => ({
      ...prev,
      schedule,
      brackets: [],
      groupsShuffled: prev.groupsShuffled || false,
    }));

    setActiveTournamentTab("partidas");
    setActiveMatchesTab("grupos");
    showNotice(
      "success",
      "Rodadas e jogos criados",
      isCearenseData(data)
        ? isPlayRankingData(data)
          ? "A fase de grupos do Modelo Torneio 360 foi montada com sucesso."
          : "A fase de grupos do Campeonato Cearense foi montada com sucesso."
        : "A fase de grupos da Copa foi montada com sucesso."
    );
    return;
  }

  const schedule = generateSchedule(tournament.type, data.players);

  setData({
    ...data,
    schedule,
  });

  setActiveTournamentTab("partidas");
  showNotice("success", "Rodadas e jogos criados", "As rodadas e os jogos foram criados com sucesso.");
}

function generateBrackets() {
  if (!isCupType(config)) return;

  const allGroupGames = (data.schedule || []).flat();
  const pendingGames = allGroupGames.some((game) => !isGameFinished(game, getWinningScore(data)));

  if (!data.schedule || data.schedule.length === 0) {
    showNotice(
      "warning",
      "Fase de grupos não gerada",
      "Gere a tabela da fase de grupos antes de montar as chaves."
    );
    return;
  }

  if (pendingGames) {
    showNotice(
      "warning",
      "Placares pendentes",
      "Preencha todos os placares da fase de grupos com um resultado válido antes de gerar as chaves."
    );
    return;
  }

  if (isCopinhaData(data)) {
    const hasUnresolvedTie = calculateCupGroupRankings(data, data.rankingCriteria)
      .some((group) => group.unresolvedTieIds?.length > 1);
    const hasUnresolvedGroupTie = getCopinhaSeededGroups(data).unresolvedGroupTies.length > 0;

    if (hasUnresolvedTie || hasUnresolvedGroupTie) {
      showNotice(
        "warning",
        "Desempate pendente",
        "Realize o sorteio de desempate indicado na aba Grupos antes de gerar as chaves."
      );
      setActiveTournamentTab("grupos");
      return;
    }
  }

  if (isCearenseData(data)) {
    const hasUnresolvedGroupTie = calculateCupGroupRankings(data, data.rankingCriteria)
      .some((group) => group.unresolvedTieIds?.length > 1);
    const hasUnresolvedCampaignTie = getCearenseQualified(data).unresolvedCampaignTies.length > 0;

    if (hasUnresolvedGroupTie || hasUnresolvedCampaignTie) {
      showNotice(
        "warning",
        "Desempate pendente",
        "Registre os sorteios de desempate indicados na aba Grupos antes de gerar as chaves."
      );
      setActiveTournamentTab("grupos");
      return;
    }
  }

  const bracketSource = isCampeonatoCearenseData(data)
    ? {
      ...structuredClone(data),
      cupConfig: { ...(data.cupConfig || {}), cearenseBracketVersion: 2 },
    }
    : data;
  const copy = syncCupBracketScores(bracketSource);
  setData(copy);

  showNotice(
    "success",
    "Chaves geradas",
    isPlayRankingData(copy)
      ? "A Eliminatória Principal foi montada. A Disputa Paralela será completada automaticamente após todos os placares da primeira fase da chave principal."
      : "As chaves finais foram montadas com sucesso."
  );
}

function requestShuffleNames() {
  const alreadyUsed = isCupType(config)
    ? Boolean(data.groupsShuffled || data.schedule?.length || data.brackets?.length)
    : Boolean(data.namesShuffled || data.schedule?.length);

  if (!alreadyUsed) {
    shuffleNames();
    return;
  }

  setRegenerationConfirm(isCupType(config) ? {
    action: "shuffle",
    title: "Sortear os grupos novamente?",
    message: "Um novo sorteio muda a posição das duplas e refaz a organização da fase de grupos.",
    impacts: [
      "As rodadas e os jogos atuais serão apagados.",
      "Placares e chaves finais já gerados serão removidos.",
      "Os participantes cadastrados serão mantidos.",
    ],
    confirmLabel: "Sim, sortear novamente",
  } : {
    action: "shuffle",
    title: "Sortear os nomes novamente?",
    message: "Um novo sorteio altera a ordem atual dos participantes.",
    impacts: [
      "As rodadas, os jogos e os placares atuais serão apagados.",
      "Os nomes cadastrados serão mantidos.",
      "Depois será necessário criar novamente as rodadas e os jogos.",
    ],
    confirmLabel: "Sim, sortear novamente",
  });
}

function requestGenerate() {
  if (!ensureParticipantsConfirmed()) return;

  if (!data.schedule?.length) {
    generate();
    return;
  }

  setRegenerationConfirm(isCupType(config) ? {
    action: "generate",
    title: "Gerar a fase de grupos novamente?",
    message: "A fase de grupos atual será substituída por uma nova tabela.",
    impacts: [
      "Rodadas, jogos e placares atuais serão recriados.",
      "As chaves finais já geradas serão removidas.",
      "Participantes e grupos sorteados serão mantidos.",
    ],
    confirmLabel: "Sim, gerar novamente",
  } : {
    action: "generate",
    title: "Criar rodadas e jogos novamente?",
    message: "A tabela atual será substituída pela mesma lógica de geração da modalidade.",
    impacts: [
      "Rodadas, jogos e placares atuais serão recriados.",
      "Os participantes cadastrados serão mantidos.",
      "A ação não poderá recuperar os placares substituídos.",
    ],
    confirmLabel: "Sim, criar novamente",
  });
}

function requestGenerateBrackets() {
  if (!data.brackets?.length) {
    generateBrackets();
    return;
  }

  setRegenerationConfirm({
    action: "brackets",
    title: "Gerar as chaves finais novamente?",
    message: "As chaves serão recalculadas a partir da classificação atual da fase de grupos.",
    impacts: [
      "Confrontos das eliminatórias podem mudar.",
      "Placares e resultados já preenchidos nas chaves podem ser removidos.",
      "A fase de grupos e seus placares serão mantidos.",
    ],
    confirmLabel: "Sim, gerar novamente",
  });
}

function confirmRegeneration() {
  const action = regenerationConfirm?.action;
  const scoreChange = regenerationConfirm?.scoreChange;
  const simplePlayerCount = regenerationConfirm?.playerCount;
  setRegenerationConfirm(null);

  if (action === "shuffle") shuffleNames();
  if (action === "generate") generate();
  if (action === "brackets") generateBrackets();
  if (action === "group-score" && scoreChange) applyScheduleScoreChange(scoreChange, true);
  if (action === "simple-player-count" && simplePlayerCount) applySimplePlayerCount(simplePlayerCount);
}

function applyScheduleScoreChange({ roundIndex, gameIndex, field, value }, clearCupBrackets = false) {
  setData((currentData) => {
    const copy = structuredClone(currentData);
    const winningScore = getWinningScore(copy);

    copy.schedule[roundIndex][gameIndex][field] = normalizeScoreInput(value, winningScore);
    if (getScoreWinnerSide(copy.schedule[roundIndex][gameIndex], winningScore) !== null) {
      copy.schedule[roundIndex][gameIndex].inProgress = false;
    }

    if (isCupType(config) && (clearCupBrackets || !copy.brackets?.some((game) => game.s1 !== "" || game.s2 !== ""))) {
      copy.brackets = [];
      resetCopinhaTieBreaks(copy);
    }

    return copy;
  });
}

function updateScore(roundIndex, gameIndex, field, value) {
  const cupBracketHasScores = isCupType(config)
    && data.brackets?.some((game) => game.s1 !== "" || game.s2 !== "");

  if (cupBracketHasScores) {
    setRegenerationConfirm({
      action: "group-score",
      scoreChange: { roundIndex, gameIndex, field, value },
      title: "Alterar o placar da fase de grupos?",
      message: "As chaves finais já possuem resultados e dependem desta classificação.",
      impacts: [
        "O novo placar da fase de grupos será salvo.",
        "As chaves finais e seus placares serão removidos para evitar resultados incompatíveis.",
        "Os participantes e os demais placares da fase de grupos serão mantidos.",
      ],
      confirmLabel: "Alterar e recriar as chaves",
    });
    return;
  }

  applyScheduleScoreChange({ roundIndex, gameIndex, field, value });
}

function prepareEditableBracketData(currentData) {
  const copy = structuredClone(currentData);

  // Torneios cearenses antigos podem exibir a 3ª disputa gerada em memória,
  // embora os novos jogos ainda não existam no array salvo. Sincronizar antes
  // da edição torna esses jogos persistentes sem perder placares anteriores.
  if (isCampeonatoCearenseData(copy) && copy.cupConfig?.cearenseBracketVersion === 2) {
    return syncCupBracketScores(copy);
  }

  if (!copy.brackets || copy.brackets.length === 0) {
    copy.brackets = rebuildCupBracketGames(copy);
  }

  return copy;
}

function toggleScheduleGameStatus(roundIndex, gameIndex) {
  setData((prev) => {
    const copy = structuredClone(prev);
    const game = copy.schedule?.[roundIndex]?.[gameIndex];

    if (!game || getScoreWinnerSide(game, getWinningScore(copy)) !== null) return prev;

    game.inProgress = game.inProgress !== true;
    return copy;
  });
}

function toggleBracketGameStatus(matchKey) {
  setData((prev) => {
    const copy = prepareEditableBracketData(prev);

    const resolvedGames = copy.brackets.map((game) => resolveBracketGame(game, copy.brackets, copy));
    const targetGame = resolvedGames.find((game) => game.matchKey === matchKey);

    if (
      !targetGame
      || targetGame.isBye
      || !targetGame.ids1?.length
      || !targetGame.ids2?.length
      || getScoreWinnerSide(targetGame, getWinningScore(copy)) !== null
    ) {
      return prev;
    }

    copy.brackets = copy.brackets.map((game) =>
      game.matchKey === matchKey
        ? { ...game, inProgress: game.inProgress !== true }
        : game
    );

    return copy;
  });
}

function updateBracketScore(matchKey, field, value) {
  setData((prev) => {
    const copy = prepareEditableBracketData(prev);

    const allResolved = copy.brackets.map((game) =>
      resolveBracketGame(game, copy.brackets, copy)
    );

    const targetGame = allResolved.find((game) => game.matchKey === matchKey);

    if (!targetGame?.ids1?.length || !targetGame?.ids2?.length) {
      return copy;
    }

  const winningScore = getWinningScore(copy);

    copy.brackets = copy.brackets.map((game) => {
      if (game.matchKey !== matchKey) return game;

      const updatedGame = { ...game, [field]: normalizeScoreInput(value, winningScore) };
      if (getScoreWinnerSide(updatedGame, winningScore) !== null) updatedGame.inProgress = false;
      return updatedGame;
    });

    if (isCampeonatoCearenseData(copy) && copy.cupConfig?.cearenseBracketVersion !== 2) {
      const resolvedStoredGames = copy.brackets.map((game) => resolveBracketGame(game, copy.brackets, copy));
      copy.brackets = resolvedStoredGames.map((game) => resolveBracketGame(game, resolvedStoredGames, copy));
      return copy;
    }

    const existingScores = {};

    copy.brackets.forEach((game) => {
      existingScores[game.matchKey] = {
        s1: game.s1,
        s2: game.s2,
        ids1: game.ids1,
        ids2: game.ids2,
        inProgress: game.inProgress === true,
        courtNumberOverride: game.courtNumberOverride,
      };
    });

    copy.brackets = rebuildCupBracketGames(copy, existingScores);
    return copy;
  });
}

function clearScores() {
  const copy = structuredClone(data);

  copy.schedule = (copy.schedule || []).map((round) =>
    round.map((game) => ({ ...game, s1: "", s2: "", inProgress: false }))
  );

  if (isCupType(config)) {
    copy.brackets = [];
    resetCopinhaTieBreaks(copy);
  }

  setData(copy);
  setClearScoresOpen(false);
  showNotice("success", "Placares apagados", "Todos os placares foram removidos.");
}

function clearTable() {
  const copy = structuredClone(data);
  copy.schedule = [];

  if (isCupType(config)) {
    copy.brackets = [];
    resetCopinhaTieBreaks(copy);
  }

  setData(copy);
  setClearTableOpen(false);
  showNotice("success", "Jogos e placares apagados", "Todos os jogos e placares foram removidos. Os participantes foram mantidos.");
}

const { currentBrackets, parallelRanking, mainCupPodium, consolationCupPodium, thirdParallelPodium } = getSafeCupPresentation(data, config);
const rankingOrganizer = data.publicInfo?.organizer || {};
const tournamentRankingShareContext = {
  title: tournament.name,
  subtitle: getModalityDisplayName(tournament.type),
  arenaName: rankingOrganizer.arenaName || rankingOrganizer.organizerName || "Arena Torneio360",
  arenaPhotoUrl: rankingOrganizer.photoUrl || "",
  rankingCriteria: data.rankingCriteria || defaultRankingCriteria,
};
const courtEditorContext = getCourtAssignmentContext(data, courtEditor);
const courtEditorGame = courtEditorContext.game;
const courtEditorUsedNumbers = courtEditorContext.peers
  .filter((game) => game !== courtEditorGame)
  .map((game) => getGameCourtNumber(game, data.courtNumbers || []));

  function SavingStatusBadge() {
    const normalizedStatus = savingStatus.toLowerCase();
    const statusClass = /erro|revisão/.test(normalizedStatus)
      ? "error"
      : /salvando|sincronizando|tentando|unindo|enviando|recuperando|pendente/.test(normalizedStatus)
        ? "saving"
        : /aparelho|offline/.test(normalizedStatus)
          ? "offline"
          : "saved";
    return (
      <span className={`savingBadge ${statusClass}`}>
        💾 {savingStatus}
      </span>
    );
  }

return (
  <>
    <NoticeModal notice={notice} onClose={() => setNotice(null)} />

    <ConfirmRegenerationModal
      confirmation={regenerationConfirm}
      onCancel={() => setRegenerationConfirm(null)}
      onConfirm={confirmRegeneration}
    />

    {participantImportOpen && createPortal(
      <ParticipantImportModal
        type={tournament.type}
        data={data}
        onClose={() => setParticipantImportOpen(false)}
        onApply={importParticipants}
      />,
      document.body
    )}

    {courtEditor && courtEditorGame && createPortal(
      <CourtAssignmentModal
        editor={{ ...courtEditor, game: courtEditorGame }}
        courtNumbers={normalizeCourtNumbers(data.courtNumbers, currentCourtCount)}
        currentNumber={getGameCourtNumber(courtEditorGame, data.courtNumbers || [])}
        usedNumbers={courtEditorUsedNumbers}
        onSelect={requestGameCourtNumber}
        onClose={() => setCourtEditor(null)}
      />,
      document.body
    )}

    {courtDuplicateConfirm && createPortal(
      <ConfirmDuplicateCourtModal
        kind={courtDuplicateConfirm.kind}
        number={courtDuplicateConfirm.number}
        onCancel={cancelDuplicateCourtNumber}
        onConfirm={confirmDuplicateCourtNumber}
      />,
      document.body
    )}

    {tieBreakDraw && createPortal(
      <TieBreakDrawOverlay
        draw={tieBreakDraw}
        onClose={() => setTieBreakDraw(null)}
      />,
      document.body
    )}

    {shuffleVideoSnapshot && createPortal(
      <ShuffleVideoModal
        snapshot={shuffleVideoSnapshot}
        arenaName={data.publicInfo?.organizer?.arenaName || data.publicInfo?.organizer?.organizerName || "Arena Torneio360"}
        arenaPhotoUrl={data.publicInfo?.organizer?.photoUrl || ""}
        onClose={() => setShuffleVideoSnapshot(null)}
      />,
      document.body
    )}

    <ConfirmClearScoresModal
      open={clearScoresOpen}
      onCancel={() => setClearScoresOpen(false)}
      onConfirm={clearScores}
    />

    <ConfirmClearTableModal
      open={clearTableOpen}
      onCancel={() => setClearTableOpen(false)}
      onConfirm={clearTable}
    />

    {shuffleOverlay && createPortal(
      <div className="shuffleOverlay" role="dialog" aria-modal="true" aria-label="Sorteio dos participantes">
        <div className="shuffleBox">
          <div className="shuffleHeader">
            <div>
              <span className="shuffleEyebrow">Sorteio em andamento</span>
              <h2>{isCupType(config) ? "Sorteando grupos..." : "Sorteando nomes..."}</h2>
              <p>Os participantes estão trocando de posição até a formação final.</p>
            </div>

            <div className="shuffleTimer" aria-live="polite">{shuffleOverlay.seconds}s</div>
          </div>

          <div className="shuffleStage">
            {shuffleOverlay.items.map((item) => (
              <div
                className="floatingName"
                key={item.id}
                title={item.name}
                style={{
                  left: `${item.left}%`,
                  top: `${item.top}%`,
                  transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
                }}
              >
                <span>{item.name}</span>
              </div>
            ))}
          </div>

          <div className="shuffleProgress">
            <div />
          </div>
        </div>
      </div>,
      document.body
    )}

    <div className="appPage">
      <header>
        <div>
          <h1>{tournament.name}</h1>
          <div className="tournamentHeaderMeta">
            <span><Trophy aria-hidden="true" /> {getModalityDisplayName(tournament.type)}</span>
            {data.multiCategoryEvent ? <span><Grid3X3 aria-hidden="true" /> Várias categorias</span> : null}
            {data.gender ? <span><Tag aria-hidden="true" /> {data.gender}</span> : null}
            {data.eventPeriodLabel || data.eventDate ? <span><CalendarDays aria-hidden="true" /> {data.eventPeriodLabel || formatDateBR(data.eventDate)}</span> : null}
            {data.eventDay ? <span><CalendarDays aria-hidden="true" /> {data.eventDay}</span> : null}
            {data.registrationDeadline ? <span><CalendarDays aria-hidden="true" /> Inscrições até {formatDateBR(data.registrationDeadline)}</span> : null}
            {data.eventStartTime ? <span><Clock3 aria-hidden="true" /> Início {data.eventStartTime}</span> : null}
            {data.dailyStartTimes && Object.keys(data.dailyStartTimes).length > 0 ? (
              <span><Clock3 aria-hidden="true" /> Horários por dia definidos</span>
            ) : null}
            {data.location ? <span><MapPin aria-hidden="true" /> {data.location}</span> : null}
            {data.winningScore ? <span><Target aria-hidden="true" /> {data.winningScore} games</span> : null}
          </div>
        </div>

        <div className="actions tournamentHeaderActions">
          <button type="button" onClick={handleBack}>Voltar</button>
        </div>
      </header>

        <section className="shareHighlightBox">
          <div>
            <strong><Share2 aria-hidden="true" /> Compartilhar perfil da arena</strong>
            <p>Envie um único link para atletas e convidados encontrarem os torneios e circuitos da arena sem login.</p>
          </div>

          <button
            type="button"
            className="shareHighlightBtn"
            onClick={() => setShareOpen((prev) => !prev)}
          >
            <Share2 aria-hidden="true" />
            {shareOpen ? "Fechar" : "Compartilhar"}
          </button>
        </section>

              {shareOpen && (
          <section className="card shareCard">
            <h2>Link público da arena</h2>
            <p>Atletas e convidados poderão escolher um torneio no perfil e acompanhar participantes, jogos e resultados.</p>

            <label>Link permanente do perfil</label>

            <div className="shareLinkBox">
              <input
                readOnly
                value={getArenaPublicUrl(userId)}
                onFocus={(event) => event.target.select()}
              />
            </div>

            <div className="shareActionRow">
              <button type="button" className="sharePrimaryAction" onClick={sharePublicLink}>
                <Share2 aria-hidden="true" /> Compartilhar perfil
              </button>
              <button type="button" className="secondaryBtn" onClick={copyPublicLink}>
                <Copy aria-hidden="true" /> Copiar link
              </button>
            </div>
          </section>
        )}

        <nav className="tournamentTopTabs" aria-label="Organização do torneio">
          <button type="button" className={activeTournamentTab === "participantes" ? "active" : ""} onClick={() => setActiveTournamentTab("participantes")}><Users aria-hidden="true" /> Participantes</button>
          {isCupType(config) && (
            <button type="button" className={activeTournamentTab === "grupos" ? "active" : ""} onClick={() => setActiveTournamentTab("grupos")}><Grid3X3 aria-hidden="true" /> Grupos</button>
          )}
          <button type="button" className={activeTournamentTab === "partidas" ? "active" : ""} onClick={() => setActiveTournamentTab("partidas")}><Flame aria-hidden="true" /> Partidas</button>
          <button type="button" className={activeTournamentTab === "ranking" ? "active" : ""} onClick={() => setActiveTournamentTab("ranking")}><Trophy aria-hidden="true" /> Ranking</button>
        </nav>

        <section className="card" style={{ display: activeTournamentTab === "participantes" ? undefined : "none" }}>
          <div className="cardTitleRow">
            <h2>Participantes</h2>
            <SavingStatusBadge />
          </div>


          {isCupType(config) && (
            <CupConfigPanel
              data={data}
              config={config}
              updateCupConfig={updateCupConfig}
            />
          )}

          {isFlexibleSimpleType(config) && (
            <SimpleConfigPanel
              data={data}
              config={config}
              onPlayerCountChange={requestSimplePlayerCount}
            />
          )}

          <CourtConfigPanel
            key={`court-config-${courtConfigRevision}`}
            courtNumbers={data.courtNumbers || createDefaultCourtNumbers(currentCourtCount)}
            onCommit={requestDefaultCourtNumber}
            onReset={resetDefaultCourtNumbers}
          />

          <div className="participantImportBar">
            <div>
              <strong><ClipboardPaste aria-hidden="true" /> Preencher vários participantes</strong>
              <p>Cole uma lista do WhatsApp ou de outro lugar e confira as vagas antes de aplicar.</p>
            </div>

            <div className="participantImportActions">
              {participantImportBackup && (
                <button type="button" className="secondaryBtn" onClick={undoParticipantImport}>
                  <Undo2 aria-hidden="true" /> Desfazer importação
                </button>
              )}
              <button type="button" onClick={() => setParticipantImportOpen(true)}>
                <ClipboardPaste aria-hidden="true" /> Colar lista
              </button>
            </div>
          </div>

          <div className="participantAttendanceToolbar">
            <div>
              <strong>Presença no local</strong>
              <span>{participantAttendanceEntries.length - pendingParticipantEntries.length} de {participantAttendanceEntries.length} confirmados</span>
            </div>
            <div className="participantAttendanceBulkActions">
              <button type="button" className="confirmAllParticipantsBtn" onClick={() => setAllParticipantAttendance(true)}>
                Confirmar todos
              </button>
              <button type="button" className="pendingAllParticipantsBtn" onClick={() => setAllParticipantAttendance(false)}>
                Marcar todos como pendentes
              </button>
            </div>
          </div>

          <PlayerInputs
            type={tournament.type}
            data={data}
            updatePlayer={updatePlayer}
            updateParticipantAttendance={updateParticipantAttendance}
          />

          {!isCupType(config) && (
            <div className="actions">
              <button type="button" onClick={requestShuffleNames}>Sortear nomes</button>
              <button type="button" onClick={requestGenerate}>Criar rodadas e jogos</button>
              {data.namesShuffled && data.lastShuffleVideo ? (
                <button type="button" className="shuffleVideoReopenButton" onClick={() => setShuffleVideoSnapshot(data.lastShuffleVideo)}>
                  <Share2 aria-hidden="true" /> Vídeo do último sorteio
                </button>
              ) : null}
            </div>
          )}
        </section>

        {isCupType(config) && (
          <section className="card" style={{ display: activeTournamentTab === "grupos" ? undefined : "none" }}>
            <div className="cardTitleRow">
              <h2>Grupos</h2>
              <SavingStatusBadge />
            </div>
            <p>Use o sorteio para embaralhar as duplas e depois gere a fase de grupos.</p>
            <div className="actions">
              <button type="button" onClick={requestShuffleNames}>Sortear grupos</button>
              <button type="button" onClick={requestGenerate}>Gerar fase de grupos</button>
              {data.groupsShuffled && data.lastShuffleVideo ? (
                <button type="button" className="shuffleVideoReopenButton" onClick={() => setShuffleVideoSnapshot(data.lastShuffleVideo)}>
                  <Share2 aria-hidden="true" /> Vídeo do último sorteio
                </button>
              ) : null}
            </div>
            {cupGroupRankings.length > 0 && (
              <div className="groupsPreviewBox">
                {(isCopinhaData(data) || isCearenseData(data)) && (
                  <CopinhaTieBreakPanel
                    groupRankings={cupGroupRankings}
                    onResolveTie={resolveCopinhaTie}
                    groupCampaignTies={copinhaGroupCampaignTies}
                    onResolveGroupTie={resolveCopinhaGroupTie}
                    campaignTies={cearenseCampaignTies}
                    onResolveCampaignTie={resolveCearenseCampaignTie}
                    isCearense={isCearenseData(data)}
                    isOfficialCearense={isCampeonatoCearenseData(data)}
                    drawInProgress={tieBreakDraw?.phase === "drawing"}
                  />
                )}
                <h3>Classificação dos grupos</h3>
                <CupGroupRankingView
                  groupRankings={cupGroupRankings}
                  rankingCriteria={data.rankingCriteria || defaultRankingCriteria}
                />
              </div>
            )}
          </section>
        )}

        <section className="card" style={{ display: activeTournamentTab === "partidas" ? undefined : "none" }}>
          <div className="cardTitleRow">
            <h2>{isCupType(config) ? "Partidas" : "Rodadas"}</h2>
            <SavingStatusBadge />
          </div>
          {isCupType(config) && (
            <div className="matchesSubTabs">
              <button type="button" className={activeMatchesTab === "grupos" ? "active" : ""} onClick={() => setActiveMatchesTab("grupos")}>Fase de grupos</button>
              <button type="button" className={activeMatchesTab === "chaves" ? "active" : ""} onClick={() => setActiveMatchesTab("chaves")}>Chaves finais</button>
              <button type="button" className={activeMatchesTab === "paralela" ? "active" : ""} onClick={() => setActiveMatchesTab("paralela")}>{data.cupConfig?.repechageName || "Disputa paralela"}</button>
              {isCampeonatoCearenseData(data) ? (
                <button type="button" className={activeMatchesTab === "paralela3" ? "active" : ""} onClick={() => setActiveMatchesTab("paralela3")}>{data.cupConfig?.thirdRepechageName || "3ª Disputa Paralela"}</button>
              ) : null}
            </div>
          )}
          <div style={{ display: !isCupType(config) || activeMatchesTab === "grupos" ? undefined : "none" }}>

          {!data.schedule || data.schedule.length === 0 ? (
            <p>Clique em “Criar rodadas e jogos” para montar os jogos.</p>
          ) : (
            <>
             <ScheduleView
  schedule={data.schedule}
  updateScore={updateScore}
  onStatusToggle={toggleScheduleGameStatus}
  showGroupName={isCupType(config)}
  voiceRepeat={voiceRepeat}
  setVoiceRepeat={setVoiceRepeat}
  winningScore={getWinningScore(data)}
  courtNumbers={data.courtNumbers || []}
  onEditCourt={setCourtEditor}
/>

              <div className="actions">
                <button
                  type="button"
                  className="deleteBtn"
                  onClick={() => setClearScoresOpen(true)}
                >
                  Apagar somente os placares
                </button>

                <button
                  type="button"
                  className="deleteBtn"
                  onClick={() => setClearTableOpen(true)}
                >
                  Apagar todos os jogos e placares
                </button>
              </div>
            </>
          )}
          </div>
        </section>

        {isCupType(config) ? (
          <>
            <section className="card" style={{ display: "none" }}>
              <h2>Classificação dos grupos</h2>

              <CupGroupRankingView
                groupRankings={cupGroupRankings}
                rankingCriteria={data.rankingCriteria || defaultRankingCriteria}
              />

              <div className="actions">
                <button type="button" onClick={requestGenerateBrackets}>
                  Gerar chaves finais
                </button>
              </div>
            </section>

            <section className="card" style={{ display: activeTournamentTab === "partidas" && activeMatchesTab === "chaves" ? undefined : "none" }}>
              <div className="cardTitleRow">
                <h2>Chaves finais</h2>
                <div className="cardTitleControls">
                  {currentBrackets && (
                    <button type="button" className="secondaryBtn compactRegenerateBtn" onClick={requestGenerateBrackets}>
                      Gerar chaves novamente
                    </button>
                  )}
                  <SavingStatusBadge />
                </div>
              </div>

              {!currentBrackets ? (
                <>
                  <p>
                    Após preencher todos os placares da fase de grupos, clique em
                    “Gerar chaves finais”.
                  </p>

                  <div className="actions">
                    <button type="button" onClick={requestGenerateBrackets}>
                      Gerar chaves finais
                    </button>
                  </div>
                </>
              ) : (
            <>
  <CupBracketView
    groupedBrackets={{ main: currentBrackets.main, repechage: [] }}
    data={data}
    updateBracketScore={updateBracketScore}
    toggleBracketGameStatus={toggleBracketGameStatus}
    voiceRepeat={voiceRepeat}
    setVoiceRepeat={setVoiceRepeat}
    winningScore={getWinningScore(data)}
    onEditCourt={setCourtEditor}
  />

</>
              )}
            </section>

            <section className="card" style={{ display: activeTournamentTab === "ranking" ? undefined : "none" }}>
              <div className="cardTitleRow">
                <h2>Ranking</h2>
                <SavingStatusBadge />
              </div>

              <div className="cupRankingSplit">
                <div className="cupRankingPanel">
                  <h3>{data.cupConfig?.mainBracketName || "Chave Principal"}</h3>
                  {mainCupPodium.length > 0 ? (
                    <CupPodiumView podium={mainCupPodium} title={data.cupConfig?.mainBracketName || "Principal"} shareContext={tournamentRankingShareContext} />
                  ) : (
                    <p>Finalize a chave principal para ver o ranking da chave principal.</p>
                  )}
                </div>

                <div className="cupRankingPanel">
                  <h3>{data.cupConfig?.repechageName || "Disputa Paralela"}</h3>
                  {isCopinhaData(data) ? (
                    data.cupConfig?.teamCount === 6 ? (
                      <p>Com 2 grupos, não há consolação neste formato.</p>
                    ) : consolationCupPodium.length > 0 ? (
                      <CupPodiumView
                        podium={consolationCupPodium}
                        title={data.cupConfig?.repechageName || "Consolação"}
                        variant="parallel"
                        shareContext={tournamentRankingShareContext}
                      />
                    ) : (
                      <p>Finalize a consolação para ver o pódio.</p>
                    )
                  ) : parallelRanking.length > 0 ? (
                    <CupPodiumView
                      podium={parallelRanking.slice(0, 3).map((item, index) => ({
                        position: index === 0 ? "🏆 Campeão" : index === 1 ? "🥈 Vice" : "🥉 3º lugar",
                        name: item.name,
                      }))}
                      title={data.cupConfig?.repechageName || "Disputa Paralela"}
                      variant="parallel"
                      shareContext={tournamentRankingShareContext}
                    />
                  ) : (
                    <p>Gere ou finalize a disputa paralela para ver o ranking separado.</p>
                  )}
                </div>
                {isCampeonatoCearenseData(data) ? (
                  <div className="cupRankingPanel">
                    <h3>{data.cupConfig?.thirdRepechageName || "3ª Disputa Paralela"}</h3>
                    {thirdParallelPodium.length > 0 ? (
                      <CupPodiumView
                        podium={thirdParallelPodium}
                        title={data.cupConfig?.thirdRepechageName || "3ª Disputa Paralela"}
                        variant="parallel"
                        shareContext={tournamentRankingShareContext}
                      />
                    ) : (
                      <p>Finalize a 3ª disputa paralela para ver o pódio.</p>
                    )}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="card" style={{ display: activeTournamentTab === "partidas" && activeMatchesTab === "paralela" ? undefined : "none" }}>
              <div className="cardTitleRow">
                <h2>{data.cupConfig?.repechageName || "Disputa Paralela"}</h2>
                <div className="cardTitleControls">
                  {currentBrackets && (
                    <button type="button" className="secondaryBtn compactRegenerateBtn" onClick={requestGenerateBrackets}>
                      Gerar chaves novamente
                    </button>
                  )}
                  <SavingStatusBadge />
                </div>
              </div>
              {!currentBrackets ? (
                <>
                  <p>Gere as chaves finais para visualizar a disputa paralela.</p>

                  <div className="actions">
                    <button type="button" onClick={requestGenerateBrackets}>
                      Gerar chaves finais
                    </button>
                  </div>
                </>
              ) : currentBrackets.repechage?.length > 0 ? (
                <CupBracketView groupedBrackets={{ main: [], repechage: currentBrackets.repechage }} data={data} updateBracketScore={updateBracketScore} toggleBracketGameStatus={toggleBracketGameStatus} voiceRepeat={voiceRepeat} setVoiceRepeat={setVoiceRepeat} winningScore={getWinningScore(data)} onEditCourt={setCourtEditor} />
              ) : (
                <p>{isPlayRankingData(data)
                  ? "A Disputa Paralela será montada automaticamente quando todos os placares da primeira fase da Eliminatória Principal estiverem preenchidos."
                  : "Com 2 grupos, a Copinha segue o modelo da planilha e não possui chave de consolação."}</p>
              )}
            </section>

            {isCampeonatoCearenseData(data) ? (
              <section className="card" style={{ display: activeTournamentTab === "partidas" && activeMatchesTab === "paralela3" ? undefined : "none" }}>
                <div className="cardTitleRow">
                  <h2>{data.cupConfig?.thirdRepechageName || "3ª Disputa Paralela"}</h2>
                  <SavingStatusBadge />
                </div>
                {!currentBrackets ? (
                  <p>Gere as chaves finais para visualizar a 3ª disputa paralela.</p>
                ) : currentBrackets.thirdParallel?.length > 0 ? (
                  <CupBracketView groupedBrackets={{ main: [], repechage: [], thirdParallel: currentBrackets.thirdParallel }} data={data} updateBracketScore={updateBracketScore} toggleBracketGameStatus={toggleBracketGameStatus} voiceRepeat={voiceRepeat} setVoiceRepeat={setVoiceRepeat} winningScore={getWinningScore(data)} onEditCourt={setCourtEditor} />
                ) : (
                  <p>Nesta quantidade de grupos não há duplas elegíveis para a 3ª disputa paralela.</p>
                )}
              </section>
            ) : null}
          </>
        ) : (
          <section className="card" style={{ display: activeTournamentTab === "ranking" ? undefined : "none" }}>
            <div className="cardTitleRow">
              <h2>Ranking do dia</h2>
              <SavingStatusBadge />
            </div>

            <RankingView
              ranking={ranking}
              type={tournament.type}
              rankingCriteria={data.rankingCriteria || defaultRankingCriteria}
              shareContext={tournamentRankingShareContext}
            />
          </section>
        )}
      </div>
    </>
  );
}

function TournamentFormatInfoButton({ data, config, publicView = false }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const isPlayRanking = config.type === "playranking";
  const isSupported = config.type === "cearense" || isPlayRanking;
  const teamCount = data.cupConfig?.teamCount || config.defaultTeams;
  const summary = useMemo(
    () => getCearenseFormatSummary(teamCount, isPlayRanking),
    [teamCount, isPlayRanking]
  );

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => closeRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    };
  }, [open]);

  if (!isSupported) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`formatInfoTrigger ${publicView ? "public" : ""}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CircleHelp aria-hidden="true" />
        <span>Como funciona com {summary.teamCount} duplas</span>
      </button>

      {open && createPortal(
        <div
          className="formatInfoOverlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="formatInfoDialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Explicação do formato ${getModalityDisplayName(config.type === "playranking" ? "Modelo Play Ranking" : "Campeonato Cearense")}`}
          >
            <header className="formatInfoHeader">
              <div>
                <span>Formato calculado para {summary.teamCount} duplas</span>
                <h2>{isPlayRanking ? "Modelo Torneio 360" : "Torneio modelo Campeonato Cearense"}</h2>
                <p>Veja o caminho das duplas desde os grupos até {isPlayRanking ? "as duas chaves eliminatórias" : "as três chaves eliminatórias"}.</p>
              </div>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Fechar explicação">×</button>
            </header>

            <div className={`formatInfoHighlights ${isPlayRanking ? "hasTransfer" : ""}`} aria-label="Resumo do formato">
              <div><strong>{summary.groupCount}</strong><span>{summary.groupCount === 1 ? "grupo" : "grupos"}</span></div>
              <div><strong>{summary.mainCount}</strong><span>na principal</span></div>
              <div><strong>{summary.initialParallelCount}</strong><span>na paralela após os grupos</span></div>
              {isPlayRanking ? <div><strong>+{summary.transferredCount}</strong><span>vindas da primeira fase</span></div> : null}
              {!isPlayRanking ? <div><strong>QF</strong><span>derrotadas na 3ª paralela</span></div> : null}
            </div>

            <div className="formatInfoSections">
              <article>
                <span className="formatInfoStep">1</span>
                <div>
                  <h3>Fase de grupos</h3>
                  <p>As {summary.teamCount} duplas serão distribuídas em <strong>{summary.groupDescription}</strong>.</p>
                  <p>Cada dupla fará <strong>{summary.gamesPerTeamDescription} jogos</strong> na fase de grupos, totalizando {summary.groupMatches} partidas.</p>
                  {!isPlayRanking ? <p>A classificação de cada grupo segue: vitórias, saldo de games, confronto direto quando restarem exatamente duas duplas empatadas e sorteio quando três ou mais permanecerem empatadas.</p> : null}
                </div>
              </article>

              <article>
                <span className="formatInfoStep">2</span>
                <div>
                  <h3>Destino depois dos grupos</h3>
                  <p>O 1º e o 2º lugar de cada grupo avançam. Assim, <strong>{summary.mainCount} duplas</strong> entram na Eliminatória Principal.</p>
                  <p>As outras <strong>{summary.initialParallelCount} duplas</strong> entram na {isPlayRanking ? "Disputa Paralela" : (data.cupConfig?.repechageName || "2ª Disputa Paralela")}.</p>
                </div>
              </article>

              <article>
                <span className="formatInfoStep">3</span>
                <div>
                  <h3>Eliminatória Principal</h3>
                  <p>A chave começa em <strong>{summary.mainOpeningRound}</strong>, com tamanho de {summary.mainBracketSize} posições.</p>
                  <p>{summary.mainByes > 0 ? `${summary.mainByes} dupla${summary.mainByes === 1 ? " recebe" : "s recebem"} BYE nessa abertura.` : "A primeira fase começa sem BYEs."}</p>
                </div>
              </article>

              {isPlayRanking ? (
                <article className="formatInfoTransfer">
                  <span className="formatInfoStep">4</span>
                  <div>
                    <h3>A diferença do Modelo Torneio 360</h3>
                    <p>Quando todos os placares de {summary.mainOpeningRound} estiverem preenchidos, as <strong>{summary.transferredCount} duplas derrotadas nos jogos dessa primeira fase</strong> também entram na Disputa Paralela.</p>
                    <p>As derrotadas das fases seguintes continuam eliminadas da Principal e não mudam mais de chave.</p>
                    <p>Entre elas, fica à frente quem perdeu pela menor diferença de games; depois, quem fez mais games na derrota e, em seguida, quem teve a melhor campanha nos grupos.</p>
                    <p>Elas recebem prioridade na montagem. Quando precisam jogar na abertura da Paralela, enfrentam uma dupla que já veio dos grupos — nunca outra transferida, sempre que matematicamente possível.</p>
                  </div>
                </article>
              ) : null}

              <article>
                <span className="formatInfoStep">{isPlayRanking ? 5 : 4}</span>
                <div>
                  <h3>{isPlayRanking ? "Disputa Paralela" : (data.cupConfig?.repechageName || "2ª Disputa Paralela")}</h3>
                  <p>A chave terá <strong>{summary.finalParallelCount} duplas</strong>{isPlayRanking ? `: ${summary.initialParallelCount} vindas dos grupos e ${summary.transferredCount} da primeira fase da Principal` : " vindas da fase de grupos"}.</p>
                  <p>{summary.parallelByes > 0 ? `A chave terá ${summary.parallelBracketSize} posições e ${summary.parallelByes} BYE${summary.parallelByes === 1 ? "" : "s"}.` : `A chave terá ${summary.parallelBracketSize} posições, sem BYEs.`} Sempre que possível, o sistema também evita um confronto imediato entre duplas do mesmo grupo.</p>
                </div>
              </article>

              {!isPlayRanking ? (
                <article>
                  <span className="formatInfoStep">5</span>
                  <div>
                    <h3>{data.cupConfig?.thirdRepechageName || "3ª Disputa Paralela"}</h3>
                    <p>Entram somente as duplas derrotadas nas quartas de final da Eliminatória Principal.</p>
                    <p>Quando a chave principal tiver apenas duas partidas de quartas, as duas derrotadas fazem a final direta. Se a Principal começar nas semifinais, as derrotadas dessas semifinais também fazem uma final direta. Quando houver apenas a final principal, esta disputa não é criada.</p>
                  </div>
                </article>
              ) : null}

              <article>
                <span className="formatInfoStep">{isPlayRanking ? 6 : 6}</span>
                <div>
                  <h3>Critérios e independência das chaves</h3>
                  {isPlayRanking ? (
                    <p>Dentro de cada grupo continuam valendo os critérios escolhidos pelo organizador. Entre grupos, o sistema compara percentual de vitórias, saldo médio e média de games.</p>
                  ) : (
                    <p>Os melhores grupos são definidos comparando somente os campeões. O saldo do campeão de grupo com quatro duplas é dividido por 1,5; em empate, o organizador realiza o sorteio. Todo o grupo herda essa posição MG.</p>
                  )}
                  <p>A Eliminatória Principal e {isPlayRanking ? "a Disputa Paralela" : "as 2ª e 3ª Disputas Paralelas"} seguem separadas, cada uma com seus confrontos, resultados, campeão e vice-campeão.</p>
                </div>
              </article>
            </div>

            <footer className="formatInfoFooter">
              {publicView ? <span>Esta explicação é somente para consulta.</span> : <span>O resumo se atualiza automaticamente quando a quantidade de duplas muda.</span>}
              <button type="button" onClick={() => setOpen(false)}>Entendi</button>
            </footer>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}

function SimpleConfigPanel({ data, config, onPlayerCountChange }) {
  const playerCount = getSimplePlayerCount(config, data);
  const totalMatches = (playerCount * (playerCount - 1)) / 2;

  return (
    <div className="cupConfigBox simpleConfigBox">
      <div className="twoCols participantAttendanceColumns">
        <div>
          <label>Quantidade de jogadores</label>
          <select
            value={playerCount}
            onChange={(event) => onPlayerCountChange(Number(event.target.value))}
          >
            {config.allowedPlayerCounts.map((count) => (
              <option key={count} value={count}>{count} jogadores</option>
            ))}
          </select>
        </div>

        <div className="infoBox">
          <p><strong>Todos contra todos:</strong> {playerCount - 1} rodadas, {playerCount / 2} jogos por rodada e {totalMatches} partidas no total.</p>
          <p>Cada jogador enfrenta todos os demais exatamente uma vez, sem folgas.</p>
        </div>
      </div>
    </div>
  );
}

function CupConfigPanel({ data, config, updateCupConfig, showInfo = true }) {
  const cupConfig = data.cupConfig || {};
  const isFixedCupSize = config.type === "cup18" || config.type === "cup21";
  const isCup18 = config.type === "cup18";
  const isCup21 = config.type === "cup21";
  const isCopinha = config.type === "copinha";
  const isCearense = config.type === "cearense";
  const isPlayRanking = config.type === "playranking";
  const isCearenseFamily = isCearense || isPlayRanking;

  return (
    <div className="cupConfigBox">
      <div className="twoCols participantAttendanceColumns">
        <div>
          <label>Quantidade de duplas</label>
          <select
            value={cupConfig.teamCount || config.defaultTeams}
            onChange={(e) => updateCupConfig("teamCount", Number(e.target.value))}
            disabled={isFixedCupSize}
          >
            {config.allowedTeamCounts.map((count) => (
              <option key={count} value={count}>{count} duplas</option>
            ))}
          </select>
          {showInfo && isCearenseFamily ? (
            <TournamentFormatInfoButton data={data} config={config} />
          ) : null}
        </div>

        <div>
          <label>Nome da chave principal</label>
          <input
            value={cupConfig.mainBracketName || config.defaultMainBracketName}
            onChange={(e) => updateCupConfig("mainBracketName", e.target.value)}
            placeholder="Principal"
          />
        </div>

        <div>
          <label>{isCopinha ? "Nome da consolação" : isCearense ? "Nome da 2ª disputa paralela" : isCearenseFamily || isCup18 || isCup21 ? "Nome da disputa paralela" : "Nome da repescagem"}</label>
          <input
            value={cupConfig.repechageName || config.defaultRepechageName}
            onChange={(e) => updateCupConfig("repechageName", e.target.value)}
            placeholder={isCopinha ? "Consolação" : isCearense ? "2ª Disputa Paralela" : isCearenseFamily || isCup18 || isCup21 ? "Disputa Paralela" : "Repescagem"}
          />
        </div>

        {isCearense ? (
          <div>
            <label>Nome da 3ª disputa paralela</label>
            <input
              value={cupConfig.thirdRepechageName || config.defaultThirdRepechageName}
              onChange={(e) => updateCupConfig("thirdRepechageName", e.target.value)}
              placeholder="3ª Disputa Paralela"
            />
          </div>
        ) : null}
      </div>

      {showInfo && !isCearenseFamily && (
        <div className="infoBox">
          {isCup18 ? (
          <>
            <p><strong>Formato:</strong> 18 duplas divididas em 6 grupos de 3.</p>
            <p><strong>Fase de grupos:</strong> cada dupla joga 2 partidas.</p>
            <p><strong>Classificação:</strong> 1º e 2º de cada grupo avançam. Os 2 melhores terceiros também entram na chave principal.</p>
            <p><strong>Chave principal:</strong> 14 duplas, com os 2 melhores gerais entrando direto nas quartas.</p>
            <p><strong>Disputa paralela:</strong> os 4 terceiros restantes jogam todos contra todos.</p>
          </>
        ) : isCup21 ? (
          <>
            <p><strong>Formato:</strong> 21 duplas divididas em 7 grupos de 3.</p>
            <p><strong>Fase de grupos:</strong> cada dupla joga 2 partidas.</p>
            <p><strong>Chave principal:</strong> passam 1º e 2º de cada grupo. As 2 melhores campanhas recebem BYE para as quartas.</p>
            <p><strong>Disputa paralela:</strong> os 7 terceiros colocados entram; o melhor terceiro recebe BYE para a semifinal.</p>
          </>
        ) : isCopinha ? (
          <>
            <p><strong>Formato:</strong> escolha de 6 a 36 duplas, sempre em grupos de 3.</p>
            <p><strong>Fase de grupos:</strong> cada dupla joga duas partidas.</p>
            <p><strong>Classificação:</strong> vitórias, saldo de games, confronto direto e, se ainda necessário, sorteio registrado pelo organizador.</p>
            <p><strong>Chaves:</strong> 1º e 2º de cada grupo entram na chave principal; a partir de 3 grupos, os 3º colocados seguem para a consolação.</p>
          </>
        ) : (
          <>
            <p><strong>Formato:</strong> grupos de 3 duplas.</p>
            <p><strong>Fase de grupos:</strong> cada dupla joga 2 partidas.</p>
            <p><strong>Classificação:</strong> 1º e 2º de cada grupo avançam para a chave principal. O 3º vai para a repescagem.</p>
          </>
          )}
        </div>
      )}
    </div>
  );
}

function isMixedParticipantConfig(config) {
  return isMixedType(config);
}

function isTeamParticipantConfig(config) {
  return config.type === "fixed12" || config.type === "fixed16" || isCupType(config);
}

function isFixedMixedTeamConfig(config) {
  return config.type === "fixed12" || config.type === "fixed16";
}

function prepareParticipantLine(value) {
  let line = String(value || "")
    .normalize("NFKC")
    .replace(/[–—]/g, "-")
    .replace(/[^\p{L}\p{M}\p{N}\s+&/'’.\-:()[\]{}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const withoutPrefix = line
      .replace(/^\s*(?:(?:dupla|participante|atleta|jogador|homem|mulher)\s*\p{N}{1,3}\s*[.)\-:]\s*|\p{N}{1,3}\s*[.)\-:]\s*|[-–—•*▪◦]+\s*)/iu, "")
      .trim();

    if (withoutPrefix === line) break;
    line = withoutPrefix;
  }

  return line;
}

function sanitizeParticipantName(value) {
  const sanitized = String(value || "")
    .normalize("NFKC")
    .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, " ")
    .replace(/[^\p{L}\p{M}\s'’.]/gu, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.'’]+|[.'’]+$/g, "")
    .trim();

  return formatParticipantName(sanitized);
}

function parseParticipantList(value, { splitTeams = false, fixedMixedTeams = false } = {}) {
  const names = [];
  let ignored = 0;
  let recognizedTeams = 0;

  String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((rawLine) => {
      const preparedLine = prepareParticipantLine(rawLine);
      const parts = splitTeams
        ? preparedLine.split(/\s*(?:\+|&|\/|-|\s+[xX]\s+|\s+[eE]\s+)\s*/u)
        : [preparedLine];
      const cleanedNames = parts.map(sanitizeParticipantName).filter(Boolean);

      if (!cleanedNames.length) {
        ignored += 1;
        return;
      }

      if (splitTeams && cleanedNames.length === 2) {
        recognizedTeams += 1;
        names.push(...(fixedMixedTeams ? orderFixedMixedPair(...cleanedNames) : cleanedNames));
        return;
      }

      names.push(...cleanedNames);
    });

  return { names, ignored, recognizedTeams };
}

function normalizeParticipantPlaceholder(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

function isAutomaticParticipantName(value, expectedValue) {
  const normalized = normalizeParticipantPlaceholder(value);
  const expected = normalizeParticipantPlaceholder(expectedValue);

  if (!normalized || normalized === expected) return true;

  return /^(?:atleta [12](?: da dupla \d+)?|participante \d+|jogador \d+|homem \d+|mulher \d+)$/u.test(normalized);
}

function countDuplicateParticipantNames(names) {
  const occurrences = new Map();

  names.forEach((name) => {
    const key = name.normalize("NFKC").toLocaleLowerCase("pt-BR");
    occurrences.set(key, (occurrences.get(key) || 0) + 1);
  });

  return [...occurrences.values()].filter((count) => count > 1).reduce((total, count) => total + count - 1, 0);
}

function fillParticipantSlots(currentValues, incomingNames, expectedName, replaceAll) {
  const nextValues = [...currentValues];
  const automaticIndexes = currentValues
    .map((value, index) => isAutomaticParticipantName(value, expectedName(index)) ? index : null)
    .filter((index) => index !== null);
  const targetIndexes = replaceAll ? currentValues.map((_, index) => index) : automaticIndexes;
  const imported = Math.min(incomingNames.length, targetIndexes.length);

  targetIndexes.forEach((targetIndex, incomingIndex) => {
    nextValues[targetIndex] = incomingIndex < incomingNames.length
      ? incomingNames[incomingIndex]
      : expectedName(targetIndex);
  });

  return {
    nextValues,
    imported,
    preserved: replaceAll ? 0 : currentValues.length - automaticIndexes.length,
    vacancies: targetIndexes.length - imported,
    overflow: Math.max(0, incomingNames.length - targetIndexes.length),
  };
}

function buildParticipantImportPreview(config, data, drafts, mode) {
  const replaceAll = mode === "replace";

  if (isMixedParticipantConfig(config)) {
    const menList = parseParticipantList(drafts.men);
    const womenList = parseParticipantList(drafts.women);
    const menResult = fillParticipantSlots(
      data.players.men,
      menList.names,
      (index) => `Homem ${index + 1}`,
      replaceAll
    );
    const womenResult = fillParticipantSlots(
      data.players.women,
      womenList.names,
      (index) => `Mulher ${index + 1}`,
      replaceAll
    );
    const incomingNames = [...menList.names, ...womenList.names];

    return {
      nextPlayers: {
        men: menResult.nextValues,
        women: womenResult.nextValues,
      },
      imported: menResult.imported + womenResult.imported,
      preserved: menResult.preserved + womenResult.preserved,
      vacancies: menResult.vacancies + womenResult.vacancies,
      overflow: menResult.overflow + womenResult.overflow,
      ignored: menList.ignored + womenList.ignored,
      duplicates: countDuplicateParticipantNames(incomingNames),
      oddTeamList: false,
      groups: [
        { label: "Homens", values: menResult.nextValues },
        { label: "Mulheres", values: womenResult.nextValues },
      ],
    };
  }

  if (isTeamParticipantConfig(config)) {
    const fixedMixedTeams = isFixedMixedTeamConfig(config);
    const parsed = parseParticipantList(drafts.general, { splitTeams: true, fixedMixedTeams });
    const currentValues = data.players.teams.flatMap((team) => [team.a, team.b]);
    const result = fillParticipantSlots(
      currentValues,
      parsed.names,
      (index) => `Atleta ${(index % 2) + 1} da dupla ${Math.floor(index / 2) + 1}`,
      replaceAll
    );
    const nextTeams = data.players.teams.map((_, teamIndex) => ({
      a: result.nextValues[teamIndex * 2],
      b: result.nextValues[(teamIndex * 2) + 1],
    }));

    return {
      nextPlayers: { teams: nextTeams },
      imported: result.imported,
      preserved: result.preserved,
      vacancies: result.vacancies,
      overflow: result.overflow,
      ignored: parsed.ignored,
      duplicates: countDuplicateParticipantNames(parsed.names),
      oddTeamList: parsed.names.length % 2 !== 0,
      recognizedTeams: parsed.recognizedTeams,
      groups: [{
        label: "Duplas",
        values: nextTeams.map((team) => `${team.a} + ${team.b}`),
      }],
    };
  }

  const parsed = parseParticipantList(drafts.general);
  const result = fillParticipantSlots(
    data.players,
    parsed.names,
    (index) => `${config.label} ${index + 1}`,
    replaceAll
  );

  return {
    nextPlayers: result.nextValues,
    imported: result.imported,
    preserved: result.preserved,
    vacancies: result.vacancies,
    overflow: result.overflow,
    ignored: parsed.ignored,
    duplicates: countDuplicateParticipantNames(parsed.names),
    oddTeamList: false,
    recognizedTeams: 0,
    groups: [{ label: "Participantes", values: result.nextValues }],
  };
}

function ParticipantImportModal({ type, data, onClose, onApply }) {
  const config = modalityConfig[type];
  const isMixed = isMixedParticipantConfig(config);
  const isTeams = isTeamParticipantConfig(config);
  const isFixedMixedTeams = isFixedMixedTeamConfig(config);
  const [drafts, setDrafts] = useState({ general: "", men: "", women: "" });
  const [mode, setMode] = useState("available");
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const preview = useMemo(
    () => buildParticipantImportPreview(config, data, drafts, mode),
    [config, data, drafts, mode]
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    function closeOnEscape(event) {
      if (event.key === "Escape") onClose();
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  function updateDraft(field, value) {
    setDrafts((current) => ({ ...current, [field]: value }));
    setReplaceConfirmed(false);
  }

  function chooseMode(nextMode) {
    setMode(nextMode);
    setReplaceConfirmed(false);
  }

  function handleApply() {
    if (!preview.imported) return;

    if (mode === "replace" && !replaceConfirmed) {
      setReplaceConfirmed(true);
      return;
    }

    onApply(preview.nextPlayers, preview);
  }

  return (
    <div className="participantImportOverlay" role="dialog" aria-modal="true" aria-labelledby="participant-import-title">
      <div className="participantImportModal">
        <div className="participantImportHeader">
          <div>
            <span>Participantes</span>
            <h2 id="participant-import-title">Colar lista de nomes</h2>
            <p>
              {isFixedMixedTeams
                ? "Uma dupla mista por linha. O homem será colocado no primeiro campo e a mulher no segundo. Separe os nomes por +, /, -, e ou &."
                : isTeams
                ? "Uma dupla por linha. Separe os dois nomes por +, /, -, e ou &. Espaços dentro do nome continuam sendo nome e sobrenome."
                : "Numeração, marcadores e emojis serão retirados automaticamente."}
            </p>
          </div>
          <button type="button" className="participantImportClose" onClick={onClose} aria-label="Fechar importação">×</button>
        </div>

        <div className="participantImportMode" aria-label="Modo da importação">
          <button type="button" className={mode === "available" ? "active" : ""} onClick={() => chooseMode("available")}>
            <strong>Preencher vagas ainda não editadas</strong>
            <small>Recomendado — preserva todos os nomes digitados.</small>
          </button>
          <button type="button" className={mode === "replace" ? "active danger" : ""} onClick={() => chooseMode("replace")}>
            <strong>Substituir todos os participantes</strong>
            <small>Apaga os nomes atuais e exige confirmação.</small>
          </button>
        </div>

        <div className={`participantImportEditors ${isMixed ? "mixed" : ""}`}>
          {isMixed ? (
            <>
              <label>
                <span>Lista de homens</span>
                <textarea
                  value={drafts.men}
                  onChange={(event) => updateDraft("men", event.target.value)}
                  placeholder={"1. João\n2. Marcos\n3. André"}
                />
              </label>
              <label>
                <span>Lista de mulheres</span>
                <textarea
                  value={drafts.women}
                  onChange={(event) => updateDraft("women", event.target.value)}
                  placeholder={"1. Ana\n2. Carla\n3. Beatriz"}
                />
              </label>
            </>
          ) : (
            <label>
              <span>{isTeams ? "Duplas ou nomes, um por linha" : "Um participante por linha"}</span>
              <textarea
                value={drafts.general}
                onChange={(event) => updateDraft("general", event.target.value)}
                placeholder={isFixedMixedTeams
                  ? "Ana + João\nCarla / Marcos\nBeatriz e Pedro"
                  : isTeams
                  ? "Ana + Carla\nBeatriz / Fernanda\nJoão e Marcos\nPaulo-Sérgio\n\nSem separador: João da Silva"
                  : "1. Ana\n2. Beatriz\n3. Carla"}
              />
            </label>
          )}
        </div>

        <div className="participantImportSummary" aria-live="polite">
          <div><strong>{preview.imported}</strong><span>nomes a preencher</span></div>
          <div><strong>{preview.preserved}</strong><span>nomes preservados</span></div>
          <div><strong>{preview.vacancies}</strong><span>vagas automáticas restantes</span></div>
          {isTeams ? <div><strong>{preview.recognizedTeams}</strong><span>duplas reconhecidas por linha</span></div> : null}
        </div>

        {(preview.overflow > 0 || preview.duplicates > 0 || preview.ignored > 0 || preview.oddTeamList || replaceConfirmed) && (
          <div className="participantImportWarnings">
            {preview.overflow > 0 && <p><strong>Atenção:</strong> {preview.overflow} nome{preview.overflow === 1 ? " não cabe" : "s não cabem"} nas vagas disponíveis.</p>}
            {preview.duplicates > 0 && <p><strong>Confira:</strong> a lista contém {preview.duplicates} nome{preview.duplicates === 1 ? " repetido" : "s repetidos"}.</p>}
            {preview.ignored > 0 && <p>{preview.ignored} linha{preview.ignored === 1 ? " foi ignorada" : "s foram ignoradas"} porque não continha um nome válido.</p>}
            {preview.oddTeamList && <p><strong>Dupla incompleta:</strong> há um número ímpar de nomes; a última vaga continuará com o nome automático.</p>}
            {replaceConfirmed && <p><strong>Confirmação final:</strong> todos os nomes atuais serão substituídos pela lista abaixo.</p>}
          </div>
        )}

        <div className="participantImportPreview">
          <div className="participantImportPreviewTitle">
            <strong>Prévia antes de aplicar</strong>
            <small>É assim que os participantes ficarão.</small>
          </div>
          <div className={`participantImportPreviewGroups ${preview.groups.length > 1 ? "multiple" : ""}`}>
            {preview.groups.map((group) => (
              <section key={group.label}>
                <h3>{group.label}</h3>
                <ol>
                  {group.values.map((value, index) => <li key={`${group.label}-${index}`}>{value}</li>)}
                </ol>
              </section>
            ))}
          </div>
        </div>

        <div className="participantImportFooter">
          <button type="button" className="secondaryBtn" onClick={onClose}>Cancelar</button>
          <button type="button" onClick={handleApply} disabled={!preview.imported}>
            {mode === "replace" && replaceConfirmed ? "Sim, substituir todos" : mode === "replace" ? "Revisar substituição" : "Aplicar lista"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ParticipantAttendanceButton({ confirmed, onChange }) {
  return (
    <button
      type="button"
      className={`participantAttendanceStatus ${confirmed ? "confirmed" : "pending"}`}
      onClick={() => onChange(!confirmed)}
      aria-pressed={confirmed}
      title={confirmed ? "Clique para marcar como pendente" : "Clique para confirmar a presença"}
    >
      {confirmed ? "Confirmado" : "Pendente"}
    </button>
  );
}

function PlayerInputs({ type, data, updatePlayer, updateParticipantAttendance }) {
  const config = modalityConfig[type];
  const attendance = normalizeParticipantAttendance(config, data.players, data.participantAttendance);

  function isConfirmed(path) {
    if (path.kind === "normal") return attendance[path.index] === true;
    if (path.kind === "men") return attendance.men[path.index] === true;
    if (path.kind === "women") return attendance.women[path.index] === true;
    return attendance.teams[path.index]?.[path.field] === true;
  }

  function renderAttendance(path) {
    return (
      <ParticipantAttendanceButton
        confirmed={isConfirmed(path)}
        onChange={(confirmed) => updateParticipantAttendance(path, confirmed)}
      />
    );
  }

  if (isMixedType(config)) {
    return (
      <div className="twoCols">
        <div>
          <h3>Homens</h3>

          {data.players.men.map((name, i) => (
            <div className="numberedInput participantAttendanceRow" key={i}>
              <span>{i + 1}</span>
              <input
                value={name}
                onChange={(e) => updatePlayer({ kind: "men", index: i }, e.target.value)}
              />
              {renderAttendance({ kind: "men", index: i })}
            </div>
          ))}
        </div>

        <div>
          <h3>Mulheres</h3>

          {data.players.women.map((name, i) => (
            <div className="numberedInput participantAttendanceRow" key={i}>
              <span>{config.men + i + 1}</span>
              <input
                value={name}
                onChange={(e) => updatePlayer({ kind: "women", index: i }, e.target.value)}
              />
              {renderAttendance({ kind: "women", index: i })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (config.type === "fixed12" || config.type === "fixed16" || isCupType(config)) {
    return (
      <div className="twoCols">
        {data.players.teams.map((team, i) => (
          <div key={i} className="miniCard">
            <h3>Dupla {i + 1}</h3>

            <div className="numberedInput participantAttendanceRow">
              <span>{i + 1}</span>
              <input
                value={team.a}
                onChange={(e) => updatePlayer({ kind: "team", index: i, field: "a" }, e.target.value)}
              />
              {renderAttendance({ kind: "team", index: i, field: "a" })}
            </div>

            <div className="numberedInput participantAttendanceRow teamSecondParticipantRow">
              <span aria-hidden="true" />
              <input
                value={team.b}
                onChange={(e) => updatePlayer({ kind: "team", index: i, field: "b" }, e.target.value)}
              />
              {renderAttendance({ kind: "team", index: i, field: "b" })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="twoCols participantAttendanceColumns">
      {data.players.map((name, i) => (
        <div className="numberedInput participantAttendanceRow" key={i}>
          <span>{i + 1}</span>
          <input
            value={name}
            onChange={(e) => updatePlayer({ kind: "normal", index: i }, e.target.value)}
          />
          {renderAttendance({ kind: "normal", index: i })}
        </div>
      ))}
    </div>
  );
}

function buildFromPairTemplate(template, players) {
  return template.map((round) =>
    round.map((game, index) => {
      const [a, b] = game[0];
      const [c, d] = game[1];

      return {
        court: index + 1,
        team1: [players[a - 1], players[b - 1]],
        ids1: [a - 1, b - 1],
        team2: [players[c - 1], players[d - 1]],
        ids2: [c - 1, d - 1],
        s1: "",
        s2: "",
      };
    })
  );
}

function buildFromMixedTemplate(template, players) {
  const men = players.men;
  const women = players.women;
  const menCount = men.length;

  function getName(num) {
    if (num <= menCount) return men[num - 1];
    return women[num - menCount - 1];
  }

  function getId(num) {
    return num - 1;
  }

  return template.map((round) =>
    round.map((game, index) => {
      const [a, b, c, d] = game;

      return {
        court: index + 1,
        team1: [getName(a), getName(b)],
        ids1: [getId(a), getId(b)],
        team2: [getName(c), getName(d)],
        ids2: [getId(c), getId(d)],
        s1: "",
        s2: "",
      };
    })
  );
}

function generateSchedule(type, players) {
  const config = modalityConfig[type];

  if (config.type === "super8") {
    return optimizeCourts(buildFromPairTemplate(super8Template, players));
  }

  if (config.type === "super12") {
    return optimizeCourts(buildFromPairTemplate(super12IndividualTemplate, players));
  }

  if (config.type === "mixed10") {
    return optimizeCourts(buildFromMixedTemplate(super10MixedTemplate, players));
  }

  if (config.type === "mixed12") {
    return optimizeCourts(buildFromMixedTemplate(super12MixedTemplate, players));
  }

  if (config.type === "mixed16") {
    return optimizeCourts(buildFromMixedTemplate(super16MixedTemplate, players));
  }

  if (config.type === "mixed20") {
    return optimizeCourts(buildFromMixedTemplate(super20MixedTemplate, players));
  }

  if (config.type === "fixed12") {
    const teamNames = players.teams.map((t) => `${t.a} + ${t.b}`);

    const schedule = fixed12Template.map((round) =>
      round.map((game, index) => ({
        court: index + 1,
        team1: [teamNames[game[0] - 1]],
        ids1: [game[0] - 1],
        team2: [teamNames[game[1] - 1]],
        ids2: [game[1] - 1],
        s1: "",
        s2: "",
      }))
    );

    return optimizeCourts(schedule);
  }

  if (config.type === "fixed16") {
    const teamNames = players.teams.map((t) => `${t.a} + ${t.b}`);

    const schedule = berger(8).map((round) =>
      round.map((game, index) => ({
        court: index + 1,
        team1: [teamNames[game[0]]],
        ids1: [game[0]],
        team2: [teamNames[game[1]]],
        ids2: [game[1]],
        s1: "",
        s2: "",
      }))
    );

    return optimizeCourts(schedule);
  }

  if (config.type === "simple8") {
    const schedule = berger(players.length).map((round) =>
      round.map((game, index) => ({
        court: index + 1,
        team1: [players[game[0]]],
        ids1: [game[0]],
        team2: [players[game[1]]],
        ids2: [game[1]],
        s1: "",
        s2: "",
      }))
    );

    return optimizeCourts(schedule);
  }

  return [];
}

function VoiceRepeatSelector({ voiceRepeat, setVoiceRepeat }) {
  return (
    <div className="voiceRepeatBox">
      <span>🔊 Chamada de Jogos</span>

      <select
        value={voiceRepeat}
        onChange={(e) => setVoiceRepeat(Number(e.target.value))}
      >
        <option value={1}>Apenas 1 vez</option>
        <option value={2}>2 vezes</option>
      </select>
    </div>
  );
}

function CourtBadge({ label, editable = false, onClick = null }) {
  const content = (
    <>
      <span>{label}</span>
      {editable ? <ChevronDown aria-hidden="true" /> : null}
    </>
  );

  if (editable) {
    return (
      <button
        type="button"
        className="courtNameBadge courtNameBadgeEditable"
        onClick={onClick}
        title="Alterar a quadra deste jogo"
        aria-label={`${label}. Toque para alterar a quadra deste jogo.`}
      >
        {content}
      </button>
    );
  }

  return <strong className="courtNameBadge">{content}</strong>;
}

function CourtConfigPanel({ courtNumbers, onCommit, onReset }) {
  return (
    <section className="courtConfigPanel" aria-labelledby="court-config-title">
      <div className="courtConfigHeader">
        <div>
          <span className="courtConfigEyebrow">Organização das partidas</span>
          <h3 id="court-config-title">Quadras do torneio</h3>
          <p>Defina somente o número de cada quadra. A palavra “Quadra” permanecerá fixa em todos os jogos.</p>
        </div>
        <button type="button" className="courtConfigReset" onClick={onReset}>Restaurar padrão</button>
      </div>

      <div className="courtConfigGrid">
        {courtNumbers.map((number, index) => (
          <label className="courtConfigField" key={index}>
            <span>Posição {index + 1}</span>
            <div className="courtNumberInputWrap">
              <strong>Quadra</strong>
              <input
                defaultValue={number}
                key={`${index}-${number}`}
                maxLength={4}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={String(index + 1)}
                aria-label={`Número da quadra na posição ${index + 1}`}
                onInput={(event) => {
                  event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 4);
                }}
                onBlur={(event) => onCommit(index, event.target.value)}
              />
            </div>
          </label>
        ))}
      </div>

      <div className="courtConfigExample">
        <span>Exemplo:</span>
        <strong>Quadra 1</strong>
        <strong>Quadra 2</strong>
        <strong>Quadra 4</strong>
        <strong>Quadra 5</strong>
      </div>
    </section>
  );
}

function CourtAssignmentModal({ editor, courtNumbers, currentNumber, usedNumbers, onSelect, onClose }) {
  const [customNumber, setCustomNumber] = useState("");
  const normalizedCurrent = normalizeCourtNumberValue(currentNumber);
  const selectableNumbers = Array.from(new Set(
    courtNumbers.map((number, index) => normalizeCourtNumberValue(number) || String(index + 1))
  ));

  return (
    <div className="courtEditorOverlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="courtEditorSheet" role="dialog" aria-modal="true" aria-labelledby="court-editor-title">
        <div className="courtEditorHandle" aria-hidden="true" />
        <div className="courtEditorHeader">
          <div>
            <span>Alteração rápida</span>
            <h2 id="court-editor-title">Escolha o número da quadra</h2>
            <p>Se o número já estiver em uso nesta rodada, você poderá confirmar a repetição antes de salvar.</p>
          </div>
          <button type="button" className="courtEditorClose" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className="courtEditorCurrent">
          <small>Quadra atual</small>
          <CourtBadge label={`Quadra ${normalizedCurrent || editor?.game?.court || 1}`} />
        </div>

        <div className="courtEditorOptions">
          {selectableNumbers.map((normalized) => {
            const isCurrent = normalized === normalizedCurrent;
            const isUsed = usedNumbers.some((usedNumber) => normalizeCourtNumberValue(usedNumber) === normalized);

            return (
              <button
                type="button"
                className={`courtEditorOption ${isCurrent ? "current" : ""}`}
                key={normalized}
                disabled={isCurrent}
                onClick={() => onSelect(normalized)}
              >
                <span>Quadra {normalized}</span>
                <small>{isCurrent ? "Atual" : isUsed ? "Em uso" : "Livre"}</small>
              </button>
            );
          })}
        </div>

        <div className="courtEditorCustom">
          <label htmlFor="custom-court-number">Outro número</label>
          <div className="courtEditorNumberInput">
            <strong>Quadra</strong>
            <input
              id="custom-court-number"
              value={customNumber}
              maxLength={4}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="5"
              onChange={(event) => setCustomNumber(event.target.value.replace(/\D/g, "").slice(0, 4))}
            />
            <button type="button" disabled={!normalizeCourtNumberValue(customNumber)} onClick={() => onSelect(customNumber)}>Aplicar</button>
          </div>
        </div>

        <button
          type="button"
          className="courtEditorRestore"
          onClick={() => onSelect(courtNumbers[Math.max(0, Number(editor?.game?.court || 1) - 1)] || String(editor?.game?.court || 1))}
        >
          Restaurar quadra padrão deste jogo
        </button>
      </section>
    </div>
  );
}

function ConfirmDuplicateCourtModal({ kind, number, onCancel, onConfirm }) {
  const isDefaultConfiguration = kind === "default";

  return (
    <div className="courtDuplicateOverlay" role="presentation">
      <section className="courtDuplicateModal" role="alertdialog" aria-modal="true" aria-labelledby="duplicate-court-title">
        <div className="courtDuplicateIcon">!</div>
        <span className="courtDuplicateEyebrow">Número já utilizado</span>
        <h2 id="duplicate-court-title">A Quadra {number} já está em uso</h2>
        <p>
          {isDefaultConfiguration
            ? "Se você confirmar, duas posições da configuração usarão o mesmo número de quadra."
            : "Se você confirmar, dois jogos ficarão identificados com o mesmo número de quadra."}
        </p>
        <div className="courtDuplicatePreview">
          <CourtBadge label={`Quadra ${number}`} />
          <strong>{isDefaultConfiguration ? "Número repetido na configuração" : "2 jogos com este número"}</strong>
        </div>
        <div className="courtDuplicateActions">
          <button type="button" className="secondaryBtn" onClick={onCancel}>Cancelar</button>
          <button type="button" onClick={onConfirm}>Confirmar repetição</button>
        </div>
      </section>
    </div>
  );
}

function UniversalMatchCard({
  game,
  phaseLabel,
  courtNumbers = [],
  winningScore = 4,
  readOnly = false,
  blocked = false,
  isBye = false,
  onEditCourt = null,
  onScoreChange = null,
  onCallGame = null,
  onStatusToggle = null,
}) {
  const winnerSide = isBye ? null : getScoreWinnerSide(game, winningScore);
  const isFinished = winnerSide !== null;
  const isInProgress = !isBye && !isFinished && !blocked && game?.inProgress === true;
  const hasScore = game?.s1 !== "" && game?.s1 != null && game?.s2 !== "" && game?.s2 != null;
  const qualifiedTeam = game?.ids1?.length
    ? game?.team1
    : game?.ids2?.length
      ? game?.team2
      : null;
  const team1 = isBye
    ? qualifiedTeam
    : game?.team1;
  const team2 = isBye
    ? ["BYE"]
    : game?.team2;
  const teamName = (team, fallback = "Aguardando") => {
    if (Array.isArray(team)) {
      const names = team.filter(Boolean);
      return names.length > 0 ? names.join(" + ") : fallback;
    }
    return team ? String(team) : fallback;
  };
  const statusLabel = isBye
    ? "BYE"
    : isFinished
      ? "Finalizado"
      : blocked
        ? "Aguardando definição"
        : isInProgress
          ? "Jogo em andamento"
          : "Aguardando placar";
  const statusClassName = `matchCardStatus ${
    isBye
      ? "is-bye"
      : isFinished
        ? "is-finished"
        : blocked
          ? "is-blocked"
          : isInProgress
            ? "is-in-progress"
            : "is-waiting"
  }`;
  const canToggleStatus = !readOnly && !isBye && !isFinished && !blocked && Boolean(onStatusToggle);

  const renderScore = (field, value, side) => {
    if (isBye) {
      return side === "team2"
        ? <span className="matchByeScore">BYE</span>
        : <span className="matchScorePlaceholder" aria-hidden="true">—</span>;
    }

    if (readOnly) {
      return hasScore
        ? <output className="matchScoreOutput">{value}</output>
        : <span className="matchScorePlaceholder" aria-label="Placar ainda não informado">—</span>;
    }

    return (
      <input
        className="matchScoreInput"
        type="text"
        min="0"
        max={getMaxScore(winningScore)}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value ?? ""}
        onChange={(event) => onScoreChange?.(field, event.target.value)}
        disabled={blocked}
        aria-label={`Placar de ${teamName(side === "team1" ? team1 : team2)}`}
      />
    );
  };

  return (
    <article
      className={`gameCard universalMatchCard ${isBye ? "byeGameCard universalMatchCard--bye" : ""} ${isFinished || isBye ? "gameFinished universalMatchCard--finished" : "gameWaiting"} ${readOnly ? "publicReadOnlyGame universalMatchCard--readonly" : ""}`}
      aria-label={`${phaseLabel}: ${teamName(team1)} versus ${teamName(team2)}`}
    >
      <div className="matchCardMeta">
        <span className="matchCardPhase" title={phaseLabel}>{phaseLabel}</span>
        {canToggleStatus ? (
          <button
            type="button"
            className={statusClassName}
            onClick={onStatusToggle}
            aria-pressed={isInProgress}
            title={isInProgress ? "Marcar como aguardando placar" : "Marcar como jogo em andamento"}
          >
            {statusLabel}
          </button>
        ) : (
          <span className={statusClassName}>{statusLabel}</span>
        )}
      </div>

      {!isBye ? (
        <div className="matchCardControls">
          <CourtBadge
            label={getGameCourtLabel(game, courtNumbers)}
            editable={!readOnly && Boolean(onEditCourt)}
            onClick={onEditCourt || undefined}
          />
          {!readOnly && onCallGame ? (
            <button type="button" className="voiceBtn matchCallButton" onClick={onCallGame} disabled={blocked}>
              🔊 Chamar jogo
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="matchTeamStack">
        <div className={`matchTeamRow ${winnerSide === "team1" ? "is-winner" : winnerSide === "team2" ? "is-loser" : ""}`}>
          <span className="matchTeamName">{teamName(team1)}</span>
          <span className="matchScoreCell">{renderScore("s1", game?.s1, "team1")}</span>
        </div>

        <div className="matchVsDivider" aria-hidden="true"><span>VS</span></div>

        <div className={`matchTeamRow ${isBye ? "is-bye" : winnerSide === "team2" ? "is-winner" : winnerSide === "team1" ? "is-loser" : ""}`}>
          <span className="matchTeamName">{teamName(team2)}</span>
          <span className="matchScoreCell">{renderScore("s2", game?.s2, "team2")}</span>
        </div>
      </div>
    </article>
  );
}

function ScheduleView({
  schedule,
  updateScore = () => {},
  onStatusToggle = null,
  showGroupName = false,
  voiceRepeat = 1,
  setVoiceRepeat = () => {},
  winningScore = 4,
  readOnly = false,
  courtNumbers = [],
  onEditCourt = null,
}) {
  return (
    <div className={`schedule ${readOnly ? "readOnlySchedule publicSchedule" : ""}`}>
      {!readOnly ? (
        <VoiceRepeatSelector
          voiceRepeat={voiceRepeat}
          setVoiceRepeat={setVoiceRepeat}
        />
      ) : null}

      {schedule.map((round, roundIndex) => (
        <div className={`roundCard ${readOnly ? "readOnlyRoundCard publicReadOnlyRound" : ""}`} key={roundIndex}>
          <div className="roundHeader">
            <h3>Rodada {roundIndex + 1}</h3>

            {!readOnly ? (
              <div className="voiceActions">
                <button
                  type="button"
                  className="voiceBtn"
                  onClick={() =>
                    speakRound(round, roundIndex, {
                      includeGroup: showGroupName,
                      repeat: voiceRepeat,
                      courtNumbers,
                    })
                  }
                >
                  Chamar rodada
                </button>

                <button
                  type="button"
                  className="secondaryBtn stopBtn"
                  onClick={stopSpeech}
                >
                  ⏹️ Parar
                </button>
              </div>
            ) : null}
          </div>

          {round.map((game, gameIndex) => {
            return (
              <UniversalMatchCard
                key={gameIndex}
                game={game}
                phaseLabel={showGroupName && game.groupName ? `${game.groupName} · Rodada ${roundIndex + 1}` : `Rodada ${roundIndex + 1}`}
                courtNumbers={courtNumbers}
                winningScore={winningScore}
                readOnly={readOnly}
                onEditCourt={!readOnly && onEditCourt ? () => onEditCourt({ scope: "schedule", roundIndex, gameIndex, game }) : null}
                onScoreChange={!readOnly ? (field, value) => updateScore(roundIndex, gameIndex, field, value) : null}
                onStatusToggle={!readOnly && onStatusToggle ? () => onStatusToggle(roundIndex, gameIndex) : null}
                onCallGame={!readOnly ? () => speakGame(game, {
                  roundLabel: `Rodada ${roundIndex + 1}`,
                  includeGroup: showGroupName,
                  repeat: voiceRepeat,
                  courtNumbers,
                }) : null}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function calculateRanking(data, type, rankingCriteriaValue = defaultRankingCriteria) {
  const config = modalityConfig[type];
  const winningScore = getWinningScore(data);

  if (!data.players) return [];

  if (isCupType(config)) {
    const qualified = getCupQualified(data);
    return [...qualified.main, ...qualified.repechage];
  }

  let names = [];

  if (isMixedType(config)) {
    names = [...data.players.men, ...data.players.women];
  } else if (config.type === "fixed12" || config.type === "fixed16") {
    names = data.players.teams.map((t) => `${t.a} + ${t.b}`);
  } else {
    names = data.players;
  }

  const table = names.map((name, id) => ({
    id,
    name,
    pts: 0,
    w: 0,
    bal: 0,
    played: 0,
  }));

  (data.schedule || []).flat().forEach((game) => {
    const s1 = Number(game.s1);
    const s2 = Number(game.s2);

    if (game.s1 === "" || game.s2 === "" || Number.isNaN(s1) || Number.isNaN(s2)) return;

   const winnerSide = getScoreWinnerSide(game, winningScore);
if (!winnerSide) return;

const win1 = winnerSide === "team1";
const win2 = winnerSide === "team2";

    game.ids1.forEach((id) => {
      if (!table[id]) return;
      table[id].pts += s1;
      table[id].bal += s1 - s2;
      table[id].played += 1;
      if (win1) table[id].w += 1;
    });

    game.ids2.forEach((id) => {
      if (!table[id]) return;
      table[id].pts += s2;
      table[id].bal += s2 - s1;
      table[id].played += 1;
      if (win2) table[id].w += 1;
    });
  });

  const criteria = getRankingCriteria(rankingCriteriaValue);

  return table.sort((a, b) => {
    for (const key of criteria.order) {
      const diff = b[key] - a[key];
      if (diff !== 0) return diff;
    }

    return a.name.localeCompare(b.name);
  });
}

function calculateCircuitTournamentRanking(data, type, rankingCriteriaValue = defaultRankingCriteria) {
  const config = modalityConfig[type];

  if (!isCupType(config)) {
    return calculateRanking(data, type, rankingCriteriaValue).filter((row) => Number(row.played || 0) > 0);
  }

  const teams = Array.isArray(data?.players?.teams) ? data.players.teams : [];
  const table = teams.map((team, id) => ({
    id,
    name: getTeamName(team),
    pts: 0,
    w: 0,
    bal: 0,
    played: 0,
  }));
  const bracketGames = (data.brackets || []).map((game) => (
    resolveBracketGame(game, data.brackets || [], data)
  ));
  const games = [...(data.schedule || []).flat(), ...bracketGames];
  const winningScore = getWinningScore(data);

  games.forEach((game) => {
    const s1 = Number(game.s1);
    const s2 = Number(game.s2);
    const id1 = game.ids1?.[0];
    const id2 = game.ids2?.[0];
    const winnerSide = getScoreWinnerSide(game, winningScore);

    if (!winnerSide || !Number.isInteger(id1) || !Number.isInteger(id2)) return;
    if (!table[id1] || !table[id2] || Number.isNaN(s1) || Number.isNaN(s2)) return;

    table[id1].pts += s1;
    table[id1].bal += s1 - s2;
    table[id1].played += 1;
    if (winnerSide === "team1") table[id1].w += 1;

    table[id2].pts += s2;
    table[id2].bal += s2 - s1;
    table[id2].played += 1;
    if (winnerSide === "team2") table[id2].w += 1;
  });

  const criteria = getRankingCriteria(rankingCriteriaValue);
  return table
    .filter((row) => row.played > 0)
    .sort((first, second) => {
      for (const key of criteria.order) {
        const difference = Number(second[key] || 0) - Number(first[key] || 0);
        if (difference !== 0) return difference;
      }
      return first.name.localeCompare(second.name, "pt-BR");
    });
}

function buildPublicCircuitRankingGroups(circuit, tournaments = []) {
  const selectedIds = new Set(
    (circuit?.tournament_ids || circuit?.tournamentIds || []).map((id) => String(id))
  );
  const groups = {
    geral: { key: "geral", title: "Ranking geral acumulado", rows: new Map() },
    masculino: { key: "masculino", title: "Ranking Masculino", rows: new Map() },
    feminino: { key: "feminino", title: "Ranking Feminino", rows: new Map() },
  };

  tournaments
    .filter((tournament) => (
      selectedIds.has(String(tournament.id))
      && !tournament.data?.deletedAt
    ))
    .forEach((tournament) => {
      const config = modalityConfig[tournament.type];
      if (!config) return;

      const rows = calculateCircuitTournamentRanking(
        tournament.data || {},
        tournament.type,
        tournament.data?.rankingCriteria || defaultRankingCriteria
      );
      const separated = isMixedType(config);
      const teamRanking = isCupType(config) || config.type === "fixed12" || config.type === "fixed16";

      rows.forEach((row) => {
        if (Number(row.played || 0) <= 0) return;

        const groupKey = separated ? (row.id < config.men ? "masculino" : "feminino") : "geral";
        const name = String(row.name || "Sem nome").trim() || "Sem nome";
        const normalizedParts = name
          .split(teamRanking ? /\s+\+\s+/ : /$^/)
          .map((part) => part.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR"))
          .filter(Boolean);
        const playerKey = teamRanking && normalizedParts.length > 1
          ? normalizedParts.sort((first, second) => first.localeCompare(second, "pt-BR")).join(" + ")
          : normalizedParts[0] || "sem nome";
        const current = groups[groupKey].rows.get(playerKey) || {
          id: `${groupKey}:${playerKey}`,
          name,
          pts: 0,
          w: 0,
          bal: 0,
          played: 0,
          tournaments: 0,
        };

        groups[groupKey].rows.set(playerKey, {
          ...current,
          pts: current.pts + Number(row.pts || 0),
          w: current.w + Number(row.w || 0),
          bal: current.bal + Number(row.bal || 0),
          played: current.played + Number(row.played || 0),
          tournaments: current.tournaments + 1,
        });
      });
    });

  const criteria = getRankingCriteria(circuit?.ranking_criteria || defaultRankingCriteria);
  const sortRows = (rows) => Array.from(rows.values()).sort((first, second) => {
    for (const key of criteria.order) {
      const difference = Number(second[key] || 0) - Number(first[key] || 0);
      if (difference !== 0) return difference;
    }
    return first.name.localeCompare(second.name, "pt-BR");
  });

  return [groups.masculino, groups.feminino, groups.geral]
    .map((group) => ({ ...group, rows: sortRows(group.rows) }))
    .filter((group) => group.rows.length > 0);
}

function podium(i) {
  if (i === 0) return "🏆";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return i + 1;
}

function RankingView({ ranking, type, rankingCriteria, shareContext = null }) {
  const config = modalityConfig[type];

  if (isMixedType(config)) {
    const menLimit = config.men;
    const men = ranking.filter((p) => p.id < menLimit);
    const women = ranking.filter((p) => p.id >= menLimit);

    return (
      <div className="twoCols">
        <RankingTable
          title="Ranking Masculino"
          rows={men}
          rankingCriteria={rankingCriteria}
          shareConfig={shareContext ? { ...shareContext, groups: [{ title: "Ranking Masculino", rows: men }] } : null}
        />
        <RankingTable
          title="Ranking Feminino"
          rows={women}
          rankingCriteria={rankingCriteria}
          shareConfig={shareContext ? { ...shareContext, groups: [{ title: "Ranking Feminino", rows: women }] } : null}
        />
      </div>
    );
  }

  return (
    <RankingTable
      title="Ranking do dia"
      rows={ranking}
      rankingCriteria={rankingCriteria}
      shareConfig={shareContext ? { ...shareContext, groups: [{ title: "Ranking do dia", rows: ranking }] } : null}
    />
  );
}

function RankingTable({ title, rows, rankingCriteria, showPodium = true, shareConfig = null }) {
  const criteria = getRankingCriteria(rankingCriteria);
  const effectiveShareConfig = shareConfig ? { ...shareConfig, rankingCriteria: criteria.value } : null;

  return (
    <div className="rankingTablePanel">
      <div className="rankingTableHeading">
        <h3>{title}</h3>
        <RankingShareButton config={effectiveShareConfig} compact />
      </div>

      <p className="rankingScrollHint" aria-hidden="true">Deslize a tabela para ver todos os dados →</p>
      <div
        className="rankingTableScroll"
        tabIndex="0"
        aria-label={`Tabela ${title}; deslize horizontalmente para ver todas as colunas`}
      >
        <table className="rankingTable">
          <thead>
            <tr>
              <th className="rankingRankCell">#</th>
              <th className="rankingNameCell">Nome</th>
              {criteria.order.map((key) => (
                <th className="rankingStatCell" key={key}>{getRankingColumnLabel(key)}</th>
              ))}
              <th className="rankingStatCell">Jogos</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((p, i) => (
              <tr key={p.id}>
                <td className="rankingRankCell">{showPodium ? podium(i) : i + 1}</td>
                <td className="rankingNameCell">{p.name}</td>
                {criteria.order.map((key) => (
                  <td className="rankingStatCell" key={key}>{p[key]}</td>
                ))}
                <td className="rankingStatCell">{p.played}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TieBreakDrawOverlay({ draw, onClose }) {
  const isDrawing = draw.phase === "drawing";

  return (
    <div className="tieBreakDrawOverlay" role="alertdialog" aria-modal="true" aria-live="polite">
      <div className={`tieBreakDrawCard ${isDrawing ? "drawing" : "result"}`}>
        <div className="tieBreakDrawIcon">{isDrawing ? <Dices /> : <Trophy />}</div>
        <span className="tieBreakDrawEyebrow">{isDrawing ? "Sorteio em andamento" : "Sorteio concluído"}</span>
        <h2>{draw.title}</h2>

        {isDrawing ? (
          <>
            <div className="tieBreakDrawCountdown">{draw.seconds}</div>
            <div className="tieBreakDrawSpotlight">{draw.spotlight}</div>
            <div className="tieBreakDrawCandidates">
              {draw.candidates.map((name, index) => <span key={`${name}-${index}`}>{name}</span>)}
            </div>
            <div className="tieBreakDrawProgress"><span /></div>
            <p>Aguarde 5 segundos. A ordem está sendo definida aleatoriamente.</p>
          </>
        ) : (
          <>
            <span className="tieBreakWinnerLabel">Vencedor do sorteio</span>
            <strong className="tieBreakWinnerName">{draw.winner}</strong>
            <div className="tieBreakResultOrder">
              {draw.orderNames.map((name, index) => (
                <span key={`${name}-${index}`}><b>{index + 1}º</b>{name}</span>
              ))}
            </div>
            <button type="button" onClick={onClose}>Entendi</button>
          </>
        )}
      </div>
    </div>
  );
}

function CopinhaTieBreakPanel({
  groupRankings,
  onResolveTie,
  groupCampaignTies = [],
  onResolveGroupTie,
  campaignTies = [],
  onResolveCampaignTie,
  isCearense = false,
  isOfficialCearense = false,
  drawInProgress = false,
}) {
  const tiedGroups = (groupRankings || []).filter((group) => group.unresolvedTieIds?.length > 1);

  if (!tiedGroups.length && !groupCampaignTies.length && !campaignTies.length) return null;

  return (
    <div className="infoBox tieBreakPanel">
      <div className="tieBreakIntro">
        <span className="tieBreakIntroIcon"><Dices /></span>
        <p>
          <strong>Desempate por sorteio necessário</strong>
          {isOfficialCearense
            ? "As duplas abaixo permaneceram iguais em vitórias e saldo. Entre duas duplas vale o confronto direto; entre três ou mais, faça o sorteio antes de gerar as chaves."
            : isCearense
            ? "As duplas abaixo permaneceram iguais em vitórias, saldo e Total de Games. Faça o sorteio antes de gerar as chaves."
            : "Há duplas empatadas após todos os critérios de classificação. Faça o sorteio antes de continuar."}
        </p>
      </div>

      <div className="tieBreakList">
        {tiedGroups.map((group) => {
          const tiedRows = group.rows.filter((row) => group.unresolvedTieIds.includes(row.id));

          return (
            <div className="tieBreakItem" key={group.id}>
              <span><strong>{group.name}</strong>{tiedRows.map((row) => row.name).join(" · ")}</span>
              <button
                type="button"
                disabled={drawInProgress}
                onClick={() => onResolveTie(group.id, group.unresolvedTieIds)}
              >
                <Dices /> Sortear em 5 segundos
              </button>
            </div>
          );
        })}

        {groupCampaignTies.map((tie) => {
          const groups = groupRankings.filter((group) => tie.groupIds.includes(group.id));

          return (
            <div className="tieBreakItem" key={`campaign-${tie.tieKey}`}>
              <span><strong>Melhor campanha empatada</strong>{groups.map((group) => group.name).join(" · ")}</span>
              <button
                type="button"
                disabled={drawInProgress}
                onClick={() => onResolveGroupTie?.(tie.tieKey, tie.groupIds)}
              >
                <Dices /> Sortear em 5 segundos
              </button>
            </div>
          );
        })}

        {campaignTies.map((tie) => {
          const scopeLabel = {
            campeoes: "Campeões de grupo",
            segundos: "Segundos colocados",
            paralela: "Disputa Paralela",
          }[tie.scope] || "Campanhas entre grupos";

          return (
            <div className="tieBreakItem" key={tie.tieKey}>
              <span>
                <strong>{scopeLabel}</strong>
                {tie.rows.map((row) => {
                  if (isOfficialCearense) {
                    const adjusted = getOfficialCearenseAdjustedBalance(row);
                    return `${row.name} (saldo ajustado ${(adjusted.numerator / adjusted.denominator).toFixed(2)})`;
                  }
                  return `${row.name} (${((row.w / Math.max(1, row.played)) * 100).toFixed(2)}% vit.; saldo médio ${(row.bal / Math.max(1, row.played)).toFixed(2)}; média de games ${(row.pts / Math.max(1, row.played)).toFixed(2)})`;
                }).join(" · ")}
              </span>
              <button
                type="button"
                disabled={drawInProgress}
                onClick={() => onResolveCampaignTie?.(tie.tieKey, tie.teamIds)}
              >
                <Dices /> Sortear em 5 segundos
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CupGroupRankingView({ groupRankings, rankingCriteria, className = "" }) {
  const isOfficialCearense = groupRankings?.[0]?.rankingMode === "cearense-official";
  const hasDefinedGroupOrder = isOfficialCearense && groupRankings.every((group) => group.groupRank);
  const effectiveCriteria = ["copinha", "cearense-official"].includes(groupRankings?.[0]?.rankingMode)
    ? "wins_balance_points"
    : rankingCriteria;

  return (
    <div className={`${hasDefinedGroupOrder ? "cearenseGroupRankingStack" : "twoCols"} ${className}`.trim()}>
      {groupRankings.map((group) => (
        <RankingTable
          key={group.id}
          title={hasDefinedGroupOrder && group.groupRank
            ? `${group.groupRank}º melhor grupo · ${group.name}`
            : group.name}
          rows={group.rows}
          rankingCriteria={effectiveCriteria}
          showPodium={false}
        />
      ))}
    </div>
  );
}

function groupStoredBracketGames(data) {
  const cupConfig = data.cupConfig || {};
  const mainName = cupConfig.mainBracketName || "Principal";
  const repechageName = cupConfig.repechageName || "Repescagem";
  const thirdRepechageName = cupConfig.thirdRepechageName || "3ª Disputa Paralela";

  const mainGames = (data.brackets || []).filter((game) => game.phase === "main");
  const repechageGames = (data.brackets || []).filter((game) => game.phase === "repechage");
  const thirdParallelGames = (data.brackets || []).filter((game) => game.phase === "thirdParallel");

  function groupByRound(games, bracketTitle) {
    const map = {};

    games.forEach((game) => {
      if (!map[game.roundName]) {
        map[game.roundName] = [];
      }

      map[game.roundName].push(resolveBracketGame(game, data.brackets || [], data));
    });

    return Object.entries(map).map(([title, gamesList]) => ({
      title,
      bracketTitle,
      games: gamesList,
    }));
  }

  return {
    main: groupByRound(mainGames, mainName),
    repechage: groupByRound(repechageGames, repechageName),
    thirdParallel: groupByRound(thirdParallelGames, thirdRepechageName),
  };
}

function getSafeCupPresentation(data, config) {
  if (!isCupType(config) || !data?.brackets?.length) {
    return { currentBrackets: null, parallelRanking: [], mainCupPodium: [], consolationCupPodium: [], thirdParallelPodium: [] };
  }

  try {
    const presentationData = isCampeonatoCearenseData(data) && data.cupConfig?.cearenseBracketVersion === 2
      ? syncCupBracketScores(data)
      : data;
    return {
      currentBrackets: groupStoredBracketGames(presentationData),
      parallelRanking: calculateParallelRanking(presentationData, data.rankingCriteria || defaultRankingCriteria),
      mainCupPodium: calculateMainCupPodium(presentationData),
      consolationCupPodium: isCopinhaData(data) ? calculateCopinhaConsolationPodium(presentationData) : [],
      thirdParallelPodium: isCampeonatoCearenseData(data) ? calculateCupBracketPodium(presentationData, "thirdParallel") : [],
    };
  } catch (error) {
    console.error("Chaves salvas inválidas; exibindo a Copa sem as chaves", error);
    return { currentBrackets: null, parallelRanking: [], mainCupPodium: [], consolationCupPodium: [], thirdParallelPodium: [] };
  }
}

function CupBracketView({
  groupedBrackets,
  data,
  updateBracketScore,
  toggleBracketGameStatus = null,
  voiceRepeat = 1,
  setVoiceRepeat,
  winningScore = 4,
  onEditCourt = null,
}) {
  return (
    <div>
      <VoiceRepeatSelector
        voiceRepeat={voiceRepeat}
        setVoiceRepeat={setVoiceRepeat}
      />

      <div className="cupBrackets bracketTreeCollection">
        {groupedBrackets.main?.length > 0 && (
          <BracketColumn
            title={data.cupConfig?.mainBracketName || "Principal"}
            rounds={groupedBrackets.main}
            updateBracketScore={updateBracketScore}
            toggleBracketGameStatus={toggleBracketGameStatus}
            voiceRepeat={voiceRepeat}
            winningScore={winningScore}
            courtNumbers={data.courtNumbers || []}
            onEditCourt={onEditCourt}
          />
        )}

        {groupedBrackets.repechage?.length > 0 && (
          <BracketColumn
            title={data.cupConfig?.repechageName || "Repescagem"}
            rounds={groupedBrackets.repechage}
            updateBracketScore={updateBracketScore}
            toggleBracketGameStatus={toggleBracketGameStatus}
            voiceRepeat={voiceRepeat}
            winningScore={winningScore}
            courtNumbers={data.courtNumbers || []}
            onEditCourt={onEditCourt}
          />
        )}

        {groupedBrackets.thirdParallel?.length > 0 && (
          <BracketColumn
            title={data.cupConfig?.thirdRepechageName || "3ª Disputa Paralela"}
            rounds={groupedBrackets.thirdParallel}
            updateBracketScore={updateBracketScore}
            toggleBracketGameStatus={toggleBracketGameStatus}
            voiceRepeat={voiceRepeat}
            winningScore={winningScore}
            courtNumbers={data.courtNumbers || []}
            onEditCourt={onEditCourt}
          />
        )}
      </div>
    </div>
  );
}

function BracketColumn({
  title,
  rounds,
  updateBracketScore,
  toggleBracketGameStatus = null,
  voiceRepeat = 1,
  winningScore = 4,
  courtNumbers = [],
  onEditCourt = null,
}) {
  const isPlacementRound = (round) => {
    const normalizedTitle = String(round?.title || "").toLocaleLowerCase("pt-BR");
    return normalizedTitle.includes("3º")
      || normalizedTitle.includes("3°")
      || normalizedTitle.includes("terceiro");
  };
  const treeRounds = rounds.filter((round) => !isPlacementRound(round));
  const placementRounds = rounds.filter(isPlacementRound);
  const openingGames = Math.max(1, treeRounds[0]?.games?.length || 1);

  const renderBracketGame = (game, round) => {
    const blocked =
      game.isBye
      || !game.ids1?.length
      || !game.ids2?.length
      || game.team1?.[0] === "Aguardando"
      || game.team2?.[0] === "Aguardando";

    return (
      <UniversalMatchCard
        game={game}
        phaseLabel={round.title === "Disputa Paralela" ? title : round.title}
        courtNumbers={courtNumbers}
        winningScore={winningScore}
        blocked={blocked}
        isBye={Boolean(game.isBye)}
        onEditCourt={onEditCourt && !game.isBye ? () => onEditCourt({ scope: "bracket", matchKey: game.matchKey, game }) : null}
        onScoreChange={!game.isBye ? (field, value) => updateBracketScore(game.matchKey, field, value) : null}
        onStatusToggle={!game.isBye && toggleBracketGameStatus ? () => toggleBracketGameStatus(game.matchKey) : null}
        onCallGame={!game.isBye ? () => speakGame(game, {
          roundLabel: `${round.title} da chave ${title}`,
          includeGroup: false,
          repeat: voiceRepeat,
        }) : null}
      />
    );
  };

  return (
    <section className={`bracketColumn bracketTree ${rounds?.[0]?.games?.[0]?.phase === "repechage" ? "repechageBracket" : "mainBracket"}`}>
      <div className="bracketTreeHeading">
        <div>
          <span>Chave eliminatória</span>
          <h3>{title}</h3>
        </div>
        <span className="bracketSwipeHint">Deslize para acompanhar as fases →</span>
      </div>

      <div className="bracketTreeViewport" tabIndex="0" aria-label={`Chave ${title}. Role horizontalmente para acompanhar as fases.`}>
        <div className="bracketTreeCanvas" style={{ "--bracket-opening-games": openingGames }}>
          {treeRounds.map((round, roundIndex) => (
            <section className="roundCard bracketRoundLane" key={`${round.title}-${roundIndex}`}>
              <div className="roundHeader bracketRoundHeader">
                <h3>{round.title === "Disputa Paralela" ? title : round.title}</h3>
                <div className="voiceActions bracketRoundActions">
                  <button type="button" className="voiceBtn" onClick={() => speakBracketRound(round, voiceRepeat, courtNumbers)}>
                    🔊 Chamar fase
                  </button>
                  <button type="button" className="secondaryBtn stopBtn" onClick={stopSpeech}>⏹️ Parar</button>
                </div>
              </div>

              <div className="bracketRoundTrack">
                {round.games.map((game, gameIndex) => (
                  <div
                    className={`bracketMatchNode ${roundIndex > 0 ? "hasPrevious" : ""} ${roundIndex < treeRounds.length - 1 ? "hasNext" : ""} ${gameIndex % 2 === 0 ? "isTopSeed" : "isBottomSeed"}`}
                    key={game.matchKey}
                  >
                    {renderBracketGame(game, round)}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {placementRounds.length > 0 ? (
        <div className="bracketPlacementSection">
          {placementRounds.map((round, roundIndex) => (
            <section className="roundCard bracketPlacementRound" key={`${round.title}-placement-${roundIndex}`}>
              <div className="roundHeader bracketRoundHeader">
                <h3>{round.title}</h3>
                <div className="voiceActions bracketRoundActions">
                  <button type="button" className="voiceBtn" onClick={() => speakBracketRound(round, voiceRepeat, courtNumbers)}>🔊 Chamar fase</button>
                  <button type="button" className="secondaryBtn stopBtn" onClick={stopSpeech}>⏹️ Parar</button>
                </div>
              </div>
              <div className="bracketPlacementGames">
                {round.games.map((game) => <div key={game.matchKey}>{renderBracketGame(game, round)}</div>)}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PublicArenaHeroHeader({ arenaName, organizer, label = "Perfil oficial da arena" }) {
  const location = [organizer?.city, organizer?.state].filter(Boolean).join("/");
  const hasMetadata = Boolean(organizer?.organizerName || location);

  return (
    <header className="publicHeader publicHeaderWithLogo publicArenaStandardHeader">
      <div className="publicBrandRow">
        <BeachLogo />
        <div className="brandTaglineOnly"><span>{TORNEIO360_TAGLINE}</span></div>
      </div>

      <div className="publicTitleBlock publicArenaTitleBlock">
        <span>{label}</span>
        <div className="publicArenaTitleMain">
          {organizer?.photoUrl ? (
            <img src={organizer.photoUrl} alt={`Foto de ${arenaName}`} />
          ) : (
            <span className="publicArenaInitials">{arenaName.slice(0, 2).toUpperCase()}</span>
          )}
          <div className="publicArenaTitleCopy">
            <h1>{arenaName}</h1>
            {hasMetadata ? (
              <p className="publicArenaTitleMeta">
                {organizer?.organizerName ? <span>Organização: {organizer.organizerName}</span> : null}
                {location ? <span><MapPin aria-hidden="true" /> {location}</span> : null}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="publicTournamentHeaderActions publicArenaHeaderActions">
        <button type="button" className="publicBackToPlatform" onClick={() => window.location.assign(window.location.origin)}>← Voltar às arenas</button>
        <button type="button" className="publicOrganizerAccess" onClick={openOrganizerAccess}>Área do organizador</button>
      </div>
    </header>
  );
}

function getBrazilDateTimeKey(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
  } catch (error) {
    const datePart = getBrazilTodayISO(date);
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${datePart}T${hour}:${minute}`;
  }
}

function PublicArenaTournamentCards({ items, organizer, onOpen, openingPublicId = null }) {
  const groups = (items || []).reduce((result, tournament) => {
    const details = tournament.data || {};
    const key = details.multiCategoryEvent === true && details.eventGroupKey
      ? details.eventGroupKey
      : tournament.id;
    const existing = result.find((group) => String(group.key) === String(key));
    if (existing) existing.items.push(tournament);
    else result.push({ key, items: [tournament] });
    return result;
  }, []);

  return groups.map((group) => {
    const first = group.items[0];
    const firstDetails = first.data || {};
    const isGroup = group.items.length > 1 || firstDetails.multiCategoryEvent === true;
    const title = isGroup ? firstDetails.eventName || first.name : first.name;
    const coverImage = firstDetails.coverImageUrl || organizer.photoUrl;
    const registrationOpen = group.items.some((item) => isRegistrationDeadlineOpen(getTournamentRegistrationDeadline(item)));

    return (
      <article className={`card publicArenaEventCard publicArenaEventCardWithCover ${isGroup ? "publicArenaGroupedEvent" : ""}`} key={group.key}>
        <div className="publicArenaEventCover">
          {coverImage ? <img src={coverImage} alt={`Capa de ${title}`} /> : <span><Trophy aria-hidden="true" /></span>}
        </div>
        <div className="publicArenaEventBody">
          <small>{isGroup ? `${group.items.length} ${group.items.length === 1 ? "categoria" : "categorias"}` : getModalityDisplayName(first.type)}</small>
          <h2>{title}</h2>
          <p>
            {firstDetails.eventDate ? <span><CalendarDays aria-hidden="true" /> {formatDateBR(firstDetails.eventDate)}</span> : null}
            {firstDetails.location ? <span><MapPin aria-hidden="true" /> {firstDetails.location}</span> : null}
          </p>
          <PublicRegistrationStatus open={registrationOpen} whatsapp={organizer.whatsapp} eventName={title} />
          {isGroup ? (
            <div className="publicGroupedCategoryList">
              {sortTournamentsByEventSchedule(group.items).map((item) => (
                <button type="button" key={item.id} onClick={() => onOpen(item)} disabled={openingPublicId === item.public_id}>
                  <span>{item.name}</span><small>{getModalityDisplayName(item.type)}</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {!isGroup ? (
          <button type="button" onClick={() => onOpen(first)} disabled={openingPublicId === first.public_id}>
            {openingPublicId === first.public_id ? "Abrindo..." : "Ver torneio"}
          </button>
        ) : null}
      </article>
    );
  });
}

function PublicArenaPage({ arenaId = null, publicId = null }) {
  const [loading, setLoading] = useState(true);
  const [bundle, setBundle] = useState(null);
  const [error, setError] = useState("");
  const [activeArenaTab, setActiveArenaTab] = useState("tournaments");
  const [activeStatusTab, setActiveStatusTab] = useState("active");
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [selectedCircuit, setSelectedCircuit] = useState(null);

  async function loadBundle({ silent = false } = {}) {
    if (!silent) setLoading(true);

    const result = await supabase.rpc("get_public_arena_bundle", {
      p_organizer_id: arenaId || null,
      p_public_id: publicId || null,
    });

    if (result.error || !result.data?.profile) {
      console.error(result.error);
      setError("Não foi possível abrir o perfil desta arena.");
      setBundle(null);
    } else {
      const normalizedCircuits = (result.data.circuits || []).map((circuit) => {
        const criteria = getRankingCriteria(circuit.ranking_criteria || defaultRankingCriteria);
        const rankingGroups = (circuit.ranking_groups || []).map((group) => ({
          ...group,
          rows: [...(group.rows || [])].sort((first, second) => {
            for (const key of criteria.order) {
              const difference = Number(second[key] || 0) - Number(first[key] || 0);
              if (difference !== 0) return difference;
            }
            return String(first.name || "").localeCompare(String(second.name || ""), "pt-BR");
          }),
        }));
        return { ...circuit, ranking_groups: rankingGroups };
      });
      const normalizedBundle = { ...result.data, circuits: normalizedCircuits };
      setBundle(normalizedBundle);
      setSelectedTournament((current) => {
        if (!current) return null;
        return (normalizedBundle.tournaments || []).find((item) => item.id === current.id) || null;
      });
      setSelectedCircuit((current) => {
        if (!current) return null;
        return normalizedCircuits.find((item) => String(item.id) === String(current.id)) || null;
      });
      setError("");
    }

    if (!silent) setLoading(false);
  }

  useEffect(() => {
    void loadBundle();
    const interval = window.setInterval(() => void loadBundle({ silent: true }), 20000);
    return () => window.clearInterval(interval);
  }, [arenaId, publicId]);

  useEffect(() => {
    setActiveStatusTab("active");
  }, [activeArenaTab]);

  if (loading) {
    return <div className="publicPage"><div className="center"><h1>Carregando perfil da arena...</h1></div></div>;
  }

  if (error || !bundle?.profile) {
    return (
      <div className="publicPage publicUnavailablePage">
        <div className="center">
          <BeachLogo />
          <h1>Perfil indisponível</h1>
          <p>{error || "Este perfil não está disponível."}</p>
          <button type="button" onClick={() => window.location.assign(window.location.origin)}>Explorar outras arenas</button>
        </div>
      </div>
    );
  }

  const profile = bundle.profile;
  const tournaments = sortTournamentsForDisplay(Array.isArray(bundle.tournaments) ? bundle.tournaments : []);
  const circuits = sortCircuitsForDisplay(Array.isArray(bundle.circuits) ? bundle.circuits : []);
  const arenaName = profile.arena_name || profile.name || "Arena Torneio360";
  const organizer = {
    photoUrl: profile.photo_url || "",
    arenaName,
    organizerName: profile.name || "",
    whatsapp: profile.phone || "",
    address: profile.address || "",
    mapsLink: profile.maps_link || "",
    instagramHandle: profile.instagram_handle || "",
    instagramLink: profile.instagram_link || "",
    whatsappGroupLink: profile.whatsapp_group_link || "",
    city: profile.city || "",
    state: profile.state || "",
  };

  if (selectedTournament) {
    return (
      <PublicTournamentScreen
        tournament={selectedTournament}
        organizer={organizer}
        onBackToArena={() => setSelectedTournament(null)}
      />
    );
  }

  if (selectedCircuit) {
    return (
      <PublicCircuitScreen
        circuit={selectedCircuit}
        tournaments={tournaments}
        organizer={organizer}
        onBackToArena={() => setSelectedCircuit(null)}
      />
    );
  }

  const activeItems = activeArenaTab === "tournaments"
    ? tournaments.filter((item) => !isPublicItemFinished(item, "tournament"))
    : circuits.filter((item) => !isPublicItemFinished(item, "circuit"));
  const finishedItems = activeArenaTab === "tournaments"
    ? tournaments.filter((item) => isPublicItemFinished(item, "tournament"))
    : circuits.filter((item) => isPublicItemFinished(item, "circuit"));
  const visibleItems = activeStatusTab === "finished" ? finishedItems : activeItems;

  return (
    <div className="publicPage publicArenaPage publicArenaRealPage">
      <PublicArenaHeroHeader arenaName={arenaName} organizer={organizer} />

      <main className="publicContent publicArenaContent">
        <section className="card publicArenaContacts">
          <div><h2>Eventos da arena</h2><p>Torneios e circuitos aparecem aqui automaticamente desde a criação.</p></div>
          <div className="publicOrganizerLinks">
            {organizer.whatsapp ? <a href={getBrazilianWhatsAppUrl(organizer.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" /> WhatsApp</a> : null}
            {organizer.whatsappGroupLink ? <a href={organizer.whatsappGroupLink} target="_blank" rel="noreferrer"><Users aria-hidden="true" /> Grupo do WhatsApp</a> : null}
            {organizer.instagramLink ? <a href={organizer.instagramLink} target="_blank" rel="noreferrer"><AtSign aria-hidden="true" /> Instagram</a> : null}
            {organizer.mapsLink ? <a href={organizer.mapsLink} target="_blank" rel="noreferrer"><MapPin aria-hidden="true" /> Google Maps</a> : null}
          </div>
        </section>

        <nav className="publicArenaTabs" aria-label="Conteúdo público da arena">
          <button type="button" className={activeArenaTab === "tournaments" ? "active" : ""} onClick={() => setActiveArenaTab("tournaments")}><Trophy aria-hidden="true" /> Torneios</button>
          <button type="button" className={activeArenaTab === "circuits" ? "active" : ""} onClick={() => setActiveArenaTab("circuits")}><GitBranch aria-hidden="true" /> Circuitos</button>
        </nav>

        <nav className="publicArenaStatusTabs" aria-label="Situação dos eventos">
          <button type="button" className={activeStatusTab === "active" ? "active" : ""} onClick={() => setActiveStatusTab("active")}>Ativos <span>{activeItems.length}</span></button>
          <button type="button" className={activeStatusTab === "finished" ? "active" : ""} onClick={() => setActiveStatusTab("finished")}>Encerrados <span>{finishedItems.length}</span></button>
        </nav>

        <section className="publicArenaEventGrid" aria-live="polite">
          {visibleItems.length === 0 ? (
            <div className="card publicArenaEmpty">Nenhum {activeArenaTab === "tournaments" ? "torneio" : "circuito"} {activeStatusTab === "finished" ? "encerrado" : "ativo"} neste perfil.</div>
          ) : activeArenaTab === "tournaments" ? (
            <PublicArenaTournamentCards items={visibleItems} organizer={organizer} onOpen={setSelectedTournament} />
          ) : visibleItems.map((item) => {
            const circuitStatus = normalizeCircuitStatus(getAutomaticEventStatus(item.end_date || item.endDate));
            return (
              <article className="card publicArenaEventCard publicArenaCircuitCard" key={item.id}>
                <div className="publicArenaEventIcon"><GitBranch aria-hidden="true" /></div>
                <div>
                  <small>Circuito</small><h2>{item.name}</h2>
                  <span className={`publicCircuitStatus ${circuitStatus}`}>{circuitStatus === "closed" ? "Encerrado" : "Em andamento"}</span>
                  <p>{item.start_date ? <span><CalendarDays aria-hidden="true" /> {formatDateBR(item.start_date)} até {formatDateBR(item.end_date)}</span> : null}<span>{(item.tournament_ids || []).length} torneio(s)</span></p>
                </div>
                <button type="button" onClick={() => setSelectedCircuit(item)}>Ver circuito</button>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}

function PublicTournamentPage({ publicId }) {
  const [loading, setLoading] = useState(true);
  const [anchorTournament, setAnchorTournament] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [circuits, setCircuits] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [selectedCircuit, setSelectedCircuit] = useState(null);
  const [activeArenaTab, setActiveArenaTab] = useState("tournaments");
  const [activeStatusTab, setActiveStatusTab] = useState("active");
  const [openingPublicId, setOpeningPublicId] = useState(null);
  const [error, setError] = useState(null);

  async function loadPublicArena({ silent = false } = {}) {
    if (!silent) setLoading(true);

    const { data: publicTournament, error: publicTournamentError } = await supabase
      .rpc("get_public_tournament", { p_public_id: publicId })
      .maybeSingle();

    if (publicTournamentError || !publicTournament) {
      console.error(publicTournamentError);
      setError("Link público não encontrado ou desativado.");
      setAnchorTournament(null);
      setTournaments([]);
      setCircuits([]);
    } else {
      const visibleAnchor = { ...publicTournament, is_public: true };
      const ownerId = publicTournament.user_id;
      const [tournamentsResult, circuitsResult] = await Promise.all([
        supabase
          .from("tournaments")
          .select("*")
          .eq("user_id", ownerId)
          .eq("is_public", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("circuits")
          .select("id, user_id, name, start_date, end_date, status, tournament_ids, updated_at")
          .eq("user_id", ownerId)
          .order("updated_at", { ascending: false }),
      ]);

      const tournamentDirectory = Array.isArray(publicTournament.data?.publicArenaDirectory)
        ? publicTournament.data.publicArenaDirectory.filter((item) => item?.public_id)
        : [];
      const publicTournaments = tournamentsResult.error
        ? tournamentDirectory
        : (tournamentsResult.data || []).filter((item) => !item.data?.deletedAt);
      const uniqueTournaments = Array.from(
        new Map([...publicTournaments, visibleAnchor].map((item) => [item.public_id || item.id, item])).values()
      );
      const circuitSnapshot = Array.isArray(publicTournament.data?.publicArenaCircuits)
        ? publicTournament.data.publicArenaCircuits
        : [];
      const circuitSnapshotById = new Map(circuitSnapshot.map((item) => [String(item.id), item]));
      const publicCircuits = circuitsResult.error
        ? circuitSnapshot
        : (circuitsResult.data || []).map((item) => {
          const snapshot = circuitSnapshotById.get(String(item.id)) || {};
          return {
            ...snapshot,
            ...item,
            ranking_criteria: snapshot.ranking_criteria || item.ranking_criteria || defaultRankingCriteria,
            ranking_groups: snapshot.ranking_groups || item.ranking_groups || [],
          };
        });

      if (tournamentsResult.error) {
        console.warn("A listagem pública completa de torneios não está disponível; exibindo o torneio do link.", tournamentsResult.error);
      }

      if (circuitsResult.error && circuitSnapshot.length === 0) {
        console.warn("A listagem pública de circuitos ainda não está disponível.", circuitsResult.error);
      }

      setAnchorTournament(visibleAnchor);
      setTournaments(uniqueTournaments);
      setCircuits(sortCircuitsForDisplay(publicCircuits));
      setSelectedTournament((current) => {
        if (!current) return null;
        return uniqueTournaments.find((item) => item.id === current.id) || current;
      });
      setSelectedCircuit((current) => {
        if (!current) return null;
        return publicCircuits.find((item) => String(item.id) === String(current.id)) || current;
      });
      setError(null);
    }

    if (!silent) setLoading(false);
  }

  useEffect(() => {
    loadPublicArena();

    const interval = setInterval(() => {
      loadPublicArena({ silent: true });
    }, 20000);

    return () => clearInterval(interval);
  }, [publicId]);

  useEffect(() => {
    setActiveStatusTab("active");
  }, [activeArenaTab]);

  async function openPublicTournament(item) {
    if (!item?.directoryEntry) {
      setSelectedTournament(item);
      return;
    }

    setOpeningPublicId(item.public_id);
    const { data, error: tournamentError } = await supabase
      .rpc("get_public_tournament", { p_public_id: item.public_id })
      .maybeSingle();
    setOpeningPublicId(null);

    if (tournamentError || !data) {
      console.error(tournamentError);
      setError("Este torneio não está mais disponível no perfil da arena.");
      return;
    }

    setSelectedTournament(data);
  }

  if (loading) {
    return (
      <div className="publicPage">
        <div className="center">
          <h1>Carregando tabela...</h1>
        </div>
      </div>
    );
  }

  if (error || !anchorTournament) {
    return (
      <div className="publicPage">
        <div className="center">
          <h1>Link indisponível</h1>
          <p>{error || "Não foi possível carregar esta tabela."}</p>
        </div>
      </div>
    );
  }

  if (selectedTournament) {
    return (
      <PublicTournamentScreen
        tournament={selectedTournament}
        onBackToArena={() => setSelectedTournament(null)}
      />
    );
  }

  const anchorData = normalizeTournamentData(anchorTournament.type, anchorTournament.data);
  const publicOrganizer = anchorData.publicInfo?.organizer || {};
  const orderedPublicTournaments = sortTournamentsForDisplay(tournaments);
  if (selectedCircuit) {
    return (
      <PublicCircuitScreen
        circuit={selectedCircuit}
        tournaments={orderedPublicTournaments}
        organizer={publicOrganizer}
        onBackToArena={() => setSelectedCircuit(null)}
      />
    );
  }
  const activeItems = activeArenaTab === "tournaments"
    ? orderedPublicTournaments.filter((item) => !isPublicItemFinished(item, "tournament"))
    : circuits.filter((item) => !isPublicItemFinished(item, "circuit"));
  const finishedItems = activeArenaTab === "tournaments"
    ? orderedPublicTournaments.filter((item) => isPublicItemFinished(item, "tournament"))
    : circuits.filter((item) => isPublicItemFinished(item, "circuit"));
  const visibleItems = activeStatusTab === "finished" ? finishedItems : activeItems;
  const arenaName = publicOrganizer.arenaName || anchorTournament.name || "Arena Torneio360";

  return (
    <div className="publicPage publicArenaPage">
      <PublicArenaHeroHeader arenaName={arenaName} organizer={publicOrganizer} label="Perfil da arena" />

      <main className="publicContent publicArenaContent">
        <section className="card publicArenaContacts">
          <div>
            <h2>Eventos da arena</h2>
            <p>Escolha um torneio para acompanhar participantes, jogos, chaves e resultados sem fazer login.</p>
          </div>
          <div className="publicOrganizerLinks">
            {publicOrganizer.whatsapp ? <a href={getBrazilianWhatsAppUrl(publicOrganizer.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" /> WhatsApp</a> : null}
            {publicOrganizer.whatsappGroupLink ? <a href={publicOrganizer.whatsappGroupLink} target="_blank" rel="noreferrer"><Users aria-hidden="true" /> Grupo do WhatsApp</a> : null}
            {publicOrganizer.instagramLink ? <a href={publicOrganizer.instagramLink} target="_blank" rel="noreferrer"><AtSign aria-hidden="true" /> Instagram</a> : null}
            {publicOrganizer.mapsLink ? <a href={publicOrganizer.mapsLink} target="_blank" rel="noreferrer"><MapPin aria-hidden="true" /> Google Maps</a> : null}
          </div>
        </section>

        <nav className="publicArenaTabs" aria-label="Conteúdo público da arena">
          <button type="button" className={activeArenaTab === "tournaments" ? "active" : ""} onClick={() => setActiveArenaTab("tournaments")}>
            <Trophy aria-hidden="true" /> Torneios
          </button>
          <button type="button" className={activeArenaTab === "circuits" ? "active" : ""} onClick={() => setActiveArenaTab("circuits")}>
            <GitBranch aria-hidden="true" /> Circuitos
          </button>
        </nav>

        <nav className="publicArenaStatusTabs" aria-label="Situação dos eventos">
          <button type="button" className={activeStatusTab === "active" ? "active" : ""} onClick={() => setActiveStatusTab("active")}>Ativos <span>{activeItems.length}</span></button>
          <button type="button" className={activeStatusTab === "finished" ? "active" : ""} onClick={() => setActiveStatusTab("finished")}>Encerrados <span>{finishedItems.length}</span></button>
        </nav>

        <section className="publicArenaEventGrid" aria-live="polite">
          {visibleItems.length === 0 ? (
            <div className="card publicArenaEmpty">
              Nenhum {activeArenaTab === "tournaments" ? "torneio" : "circuito"} {activeStatusTab === "finished" ? "encerrado" : "ativo"} neste perfil.
            </div>
          ) : activeArenaTab === "tournaments" ? (
            <PublicArenaTournamentCards items={visibleItems} organizer={publicOrganizer} onOpen={openPublicTournament} openingPublicId={openingPublicId} />
          ) : (
            visibleItems.map((item) => {
              const circuitStatus = normalizeCircuitStatus(getAutomaticEventStatus(item.end_date || item.endDate));
              return (
                <article className="card publicArenaEventCard publicArenaCircuitCard" key={item.id}>
                  <div className="publicArenaEventIcon"><GitBranch aria-hidden="true" /></div>
                  <div>
                    <small>Circuito</small>
                    <h2>{item.name}</h2>
                    <span className={`publicCircuitStatus ${circuitStatus}`}>{circuitStatus === "closed" ? "Encerrado" : "Em andamento"}</span>
                    <p>
                      {item.start_date || item.startDate ? <span><CalendarDays aria-hidden="true" /> {formatDateBR(item.start_date || item.startDate)}</span> : null}
                      <span>{(item.tournament_ids || item.tournamentIds || []).length} torneio(s)</span>
                    </p>
                  </div>
                  <button type="button" onClick={() => setSelectedCircuit(item)}>Ver circuito</button>
                </article>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}

function PublicCircuitScreen({ circuit, tournaments = [], organizer = {}, onBackToArena }) {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [circuit?.id]);
  const liveRankingGroups = buildPublicCircuitRankingGroups(circuit, tournaments);
  const storedRankingGroups = Array.isArray(circuit?.ranking_groups)
    ? circuit.ranking_groups.filter((group) => Array.isArray(group?.rows) && group.rows.length > 0)
    : [];
  const rankingGroups = liveRankingGroups.length > 0 ? liveRankingGroups : storedRankingGroups;
  const arenaName = organizer.arenaName || "Arena Torneio360";
  const selectedTournamentIds = new Set((circuit?.tournament_ids || circuit?.tournamentIds || []).map((id) => String(id)));
  const circuitTournaments = sortTournamentsChronologically(
    tournaments.filter((tournament) => selectedTournamentIds.has(String(tournament.id)))
  );
  const shareConfig = {
    title: circuit?.name || "Ranking do circuito",
    subtitle: "Ranking geral acumulado",
    arenaName,
    arenaPhotoUrl: organizer.photoUrl || "",
    rankingCriteria: circuit?.ranking_criteria || defaultRankingCriteria,
    groups: rankingGroups,
  };

  return (
    <div className="publicPage publicCircuitPage">
      <header className="publicHeader publicHeaderWithLogo publicCircuitHeader">
        <div className="publicBrandRow">
          <BeachLogo />
          <div className="brandTaglineOnly"><span>{TORNEIO360_TAGLINE}</span></div>
        </div>

        <div className="publicTitleBlock">
          <span>Ranking público do circuito</span>
          <h1>{circuit?.name || "Circuito"}</h1>
          <p>
            {circuit?.start_date || circuit?.startDate ? formatDateBR(circuit.start_date || circuit.startDate) : "Data inicial não informada"}
            {circuit?.end_date || circuit?.endDate ? ` até ${formatDateBR(circuit.end_date || circuit.endDate)}` : ""}
          </p>
        </div>

        <div className="publicTournamentHeaderActions">
          <button type="button" onClick={onBackToArena}>← Voltar ao perfil da arena</button>
          <div className="publicBadge">Somente visualização</div>
        </div>
      </header>

      <main className="publicContent publicCircuitContent">
        <section className="card publicCircuitIdentityCard">
          {organizer.photoUrl ? (
            <img src={organizer.photoUrl} alt={`Foto de ${arenaName}`} />
          ) : (
            <span>{arenaName.slice(0, 2).toUpperCase()}</span>
          )}
          <div>
            <small>Organização</small>
            <h2>{arenaName}</h2>
            <p>{(circuit?.tournament_ids || circuit?.tournamentIds || []).length} torneio(s) neste circuito</p>
          </div>
          <RankingShareButton config={shareConfig} />
        </section>

        <section className="card publicCircuitStagesCard">
          <div className="cardTitleRow">
            <div><small>Etapas</small><h2>Torneios do circuito</h2></div>
            <span>{circuitTournaments.length} torneio(s)</span>
          </div>
          {circuitTournaments.length === 0 ? (
            <p className="publicCircuitEmptyRanking">Nenhum torneio público está vinculado a este circuito.</p>
          ) : (
            <div className="publicCircuitStageGrid">
              {circuitTournaments.map((tournament) => {
                const details = tournament.data || {};
                return (
                  <article key={tournament.id}>
                    <div><small>{getModalityDisplayName(tournament.type)}</small><h3>{tournament.name}</h3></div>
                    <p>{details.eventDate ? <span><CalendarDays aria-hidden="true" /> {formatDateBR(details.eventDate)} {details.eventStartTime || ""}</span> : null}</p>
                    {tournament.public_id ? <button type="button" onClick={() => window.location.assign(getPublicUrl(tournament.public_id))}>Ver torneio</button> : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="card publicCircuitRankingCard">
          <div className="cardTitleRow">
            <div>
              <small className="publicCircuitName">{circuit?.name || "Circuito"}</small>
              <h2>Ranking geral acumulado</h2>
            </div>
          </div>

          {rankingGroups.length === 0 ? (
            <div className="publicCircuitEmptyRanking">
              O ranking aparecerá aqui assim que houver placares válidos nos torneios do circuito.
            </div>
          ) : rankingGroups.length === 1 ? (
            <RankingTable
              title={rankingGroups[0].title}
              rows={rankingGroups[0].rows}
              rankingCriteria={circuit.ranking_criteria || defaultRankingCriteria}
            />
          ) : (
            <div className="twoCols publicCircuitRankingTables">
              {rankingGroups.map((group) => (
                <RankingTable
                  key={group.key || group.title}
                  title={group.title}
                  rows={group.rows}
                  rankingCriteria={circuit.ranking_criteria || defaultRankingCriteria}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function getRegisteredAthletesForPublic(data, config) {
  if (!data?.players) return [];

  if (isMixedType(config)) {
    return [
      {
        title: "Masculino",
        names: (data.players.men || []).filter(Boolean),
      },
      {
        title: "Feminino",
        names: (data.players.women || []).filter(Boolean),
      },
    ];
  }

  if (config.type === "fixed12" || config.type === "fixed16" || isCupType(config)) {
    return [
      {
        title: "Duplas cadastradas",
        names: (data.players.teams || [])
          .map((team, index) => `${index + 1}. ${team.a || "Atleta 1"} + ${team.b || "Atleta 2"}`)
          .filter(Boolean),
      },
    ];
  }

  return [
    {
      title: "Atletas cadastrados",
      names: (data.players || []).filter(Boolean),
    },
  ];
}

function PublicTournamentScreen({ tournament, organizer: liveOrganizer = null, onBackToArena = null }) {
  const publicTabStorageKey = `publicTournamentTab:${tournament.public_id || tournament.id}`;
  const publicMatchesTabStorageKey = `publicTournamentMatchesTab:${tournament.public_id || tournament.id}`;
  const [activePublicTab, setActivePublicTabState] = useState(() => readPublicViewStorage(publicTabStorageKey, "participantes"));
  const [activePublicMatchesTab, setActivePublicMatchesTabState] = useState(() => readPublicViewStorage(publicMatchesTabStorageKey, "grupos"));

  function setActivePublicTab(tab) {
    savePublicViewStorage(publicTabStorageKey, tab);
    setActivePublicTabState(tab);
  }

  function setActivePublicMatchesTab(tab) {
    savePublicViewStorage(publicMatchesTabStorageKey, tab);
    setActivePublicMatchesTabState(tab);
  }
  const config = modalityConfig[tournament.type];
  const data = normalizeTournamentData(tournament.type, tournament.data);

  if (!config) {
    return (
      <div className="publicPage">
        <div className="center">
          <h1>Modalidade indisponível</h1>
          <p>Esta tabela foi criada com uma modalidade que não está disponível na versão atual.</p>
        </div>
      </div>
    );
  }

  const publicInfo = data.publicInfo || {};
  const publicVisibility = publicInfo.visibility || {};
  const storedOrganizer = publicInfo.organizer || {};
  const publicOrganizer = liveOrganizer
    ? { ...storedOrganizer, ...liveOrganizer }
    : storedOrganizer;
  const registrationClosed = data.registrationDeadline ? new Date() > new Date(`${data.registrationDeadline}T23:59:59`) : false;
  const ranking = calculateRanking(data, tournament.type, data.rankingCriteria);
  const isCup = isCupType(config);
  const publicCompletionState = getTournamentCompletionState({
    type: tournament.type,
    data,
  });
  const publicRankingReady = isCup || publicCompletionState.completed;

  const cupGroupRankings = isCup
    ? calculateCupGroupRankings(data, data.rankingCriteria)
    : [];

  const { currentBrackets, parallelRanking, mainCupPodium, consolationCupPodium, thirdParallelPodium } = getSafeCupPresentation(data, config);
  const publicRankingShareContext = {
    title: tournament.name,
    subtitle: getModalityDisplayName(tournament.type),
    arenaName: publicOrganizer.arenaName || publicOrganizer.organizerName || "Arena Torneio360",
    arenaPhotoUrl: publicOrganizer.photoUrl || "",
    rankingCriteria: data.rankingCriteria || defaultRankingCriteria,
  };

  const publicAthletes = getRegisteredAthletesForPublic(data, config);

  return (
    <div className="publicPage">
      <header className="publicHeader publicHeaderWithLogo">
        <div className="publicBrandRow">
          <BeachLogo />
          <div className="brandTaglineOnly">
            <span>{TORNEIO360_TAGLINE}</span>
          </div>
        </div>

        <div className="publicTitleBlock">
          <span>Tabela pública</span>
          <h1>{tournament.name}</h1>
          <p>
            {getModalityDisplayName(tournament.type)}
            {data.gender ? ` · ${data.gender}` : ""}
            {data.eventDay ? ` · ${data.eventDay}` : ""}
            {data.eventDate ? ` · ${formatDateBR(data.eventDate)}` : ""}
            {data.location ? ` · ${data.location}` : ""}
          </p>
        </div>

        <div className="publicTournamentHeaderActions">
          {onBackToArena ? <button type="button" onClick={onBackToArena}>← Voltar ao perfil da arena</button> : null}
          <div className="publicBadge">
            {registrationClosed ? "Inscrições encerradas" : "Somente visualização"}
          </div>
        </div>
      </header>

      <main className="publicContent">
        {data.coverImageUrl ? (
          <figure className="publicTournamentCover">
            <img src={data.coverImageUrl} alt={`Foto do torneio ${tournament.name}`} />
          </figure>
        ) : null}

        <section className="card publicTournamentInfoCard">
          <h2>Informações do torneio</h2>
          <div className="publicInfoGrid">
            {data.registrationDeadline ? <span><CalendarDays aria-hidden="true" /> Inscrições até {formatDateBR(data.registrationDeadline)}</span> : null}
            {registrationClosed ? <span className="closedInfo"><LockKeyhole aria-hidden="true" /> Inscrições encerradas</span> : null}
            {data.eventStartTime ? <span><Clock3 aria-hidden="true" /> Início {data.eventStartTime}</span> : null}
            {data.location ? <span><MapPin aria-hidden="true" /> {data.location}</span> : null}
            {data.winningScore ? <span><Target aria-hidden="true" /> {data.winningScore} games</span> : null}
          </div>
        </section>

        {(publicVisibility.showArenaName && publicOrganizer.arenaName) ||
          (publicVisibility.showOrganizerName && publicOrganizer.organizerName) ||
          (publicVisibility.showWhatsapp && publicOrganizer.whatsapp) ||
          (publicVisibility.showWhatsappGroupLink && publicOrganizer.whatsappGroupLink) ||
          (publicVisibility.showInstagram && (publicOrganizer.instagramHandle || publicOrganizer.instagramLink)) ||
          (publicVisibility.showAddress && publicOrganizer.address) ||
          (publicVisibility.showMapsLink && publicOrganizer.mapsLink) ||
          (publicVisibility.showCityState && (publicOrganizer.city || publicOrganizer.state)) ? (
          <section className="card publicOrganizerCard">
            <h2>Organização</h2>
            <div className="publicOrganizerHeader">
              {publicOrganizer.photoUrl ? <img src={publicOrganizer.photoUrl} alt="Foto do organizador" /> : null}
              <div>
                {publicVisibility.showArenaName && publicOrganizer.arenaName ? <strong>{publicOrganizer.arenaName}</strong> : null}
                {publicVisibility.showOrganizerName && publicOrganizer.organizerName ? <span>{publicOrganizer.organizerName}</span> : null}
              </div>
            </div>
            <div className="publicOrganizerLinks">
              {publicVisibility.showWhatsapp && publicOrganizer.whatsapp ? <a href={getBrazilianWhatsAppUrl(publicOrganizer.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" /> WhatsApp</a> : null}
              {publicVisibility.showWhatsappGroupLink && publicOrganizer.whatsappGroupLink ? <a href={publicOrganizer.whatsappGroupLink} target="_blank" rel="noreferrer"><Users aria-hidden="true" /> Grupo do WhatsApp</a> : null}
              {publicVisibility.showInstagram && publicOrganizer.instagramLink ? <a href={publicOrganizer.instagramLink} target="_blank" rel="noreferrer"><AtSign aria-hidden="true" /> {publicOrganizer.instagramHandle || "Instagram"}</a> : null}
              {publicVisibility.showInstagram && !publicOrganizer.instagramLink && publicOrganizer.instagramHandle ? <span><AtSign aria-hidden="true" /> {publicOrganizer.instagramHandle}</span> : null}
              {publicVisibility.showAddress && publicOrganizer.address ? <span><MapPin aria-hidden="true" /> {publicOrganizer.address}</span> : null}
              {publicVisibility.showCityState && (publicOrganizer.city || publicOrganizer.state) ? <span><MapPin aria-hidden="true" /> {[publicOrganizer.city, publicOrganizer.state].filter(Boolean).join("/")}</span> : null}
              {publicVisibility.showMapsLink && publicOrganizer.mapsLink ? <a href={publicOrganizer.mapsLink} target="_blank" rel="noreferrer"><MapPin aria-hidden="true" /> Ver endereço no mapa</a> : null}
            </div>
          </section>
        ) : null}

        <nav className="tournamentTopTabs publicTournamentTabs" aria-label="Visualização pública do torneio">
          <button type="button" className={activePublicTab === "participantes" ? "active" : ""} onClick={() => setActivePublicTab("participantes")}><Users aria-hidden="true" /> Participantes</button>
          {isCup ? <button type="button" className={activePublicTab === "grupos" ? "active" : ""} onClick={() => setActivePublicTab("grupos")}><Grid3X3 aria-hidden="true" /> Grupos</button> : null}
          <button type="button" className={activePublicTab === "partidas" ? "active" : ""} onClick={() => setActivePublicTab("partidas")}><Flame aria-hidden="true" /> Partidas</button>
          <button type="button" className={activePublicTab === "ranking" ? "active" : ""} onClick={() => setActivePublicTab("ranking")}><Trophy aria-hidden="true" /> Ranking</button>
        </nav>

        <section className="card publicAthletesCard" style={{ display: activePublicTab === "participantes" ? undefined : "none" }}>
          <div className="cardTitleRow">
            <h2>Participantes</h2>
            <span className="readOnlyBadge">Somente visualização</span>
          </div>
          {config.type === "cearense" || config.type === "playranking" ? (
            <div className="formatInfoPublicPlacement">
              <TournamentFormatInfoButton data={data} config={config} publicView />
            </div>
          ) : null}
          <div className="publicAthletesGrid organizerLikeParticipants">
            {publicAthletes.map((group) => (
              <div className="publicAthleteGroup" key={group.title}>
                <h3>{group.title}</h3>
                {group.names.length === 0 ? (
                  <p>Nenhum atleta cadastrado ainda.</p>
                ) : (
                  <div className="publicAthleteList">
                    {group.names.map((name, index) => (
                      <span key={`${group.title}-${index}`}>{name}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {isCup ? (
          <section className="card" style={{ display: activePublicTab === "grupos" ? undefined : "none" }}>
            <div className="cardTitleRow">
              <h2>Grupos</h2>
              <span className="readOnlyBadge">Somente visualização</span>
            </div>
            {!publicRankingReady ? (
              <div className="publicRankingLocked">
                <LockKeyhole aria-hidden="true" />
                <div>
                  <strong>Classificação ainda não liberada</strong>
                  <p>Ela ficará disponível após o preenchimento do último placar do torneio.</p>
                </div>
              </div>
            ) : cupGroupRankings.length > 0 ? (
              <div className="groupsPreviewBox">
                <h3>Classificação dos grupos</h3>
                <CupGroupRankingView
                  className="publicGroupRankings"
                  groupRankings={cupGroupRankings}
                  rankingCriteria={data.rankingCriteria || defaultRankingCriteria}
                />
              </div>
            ) : (
              <p>Os grupos ainda não foram gerados pelo organizador.</p>
            )}
          </section>
        ) : null}

        <section className="card" style={{ display: activePublicTab === "partidas" ? undefined : "none" }}>
          <div className="cardTitleRow">
            <h2>{isCup ? "Partidas" : "Rodadas"}</h2>
            <span className="readOnlyBadge">Somente visualização</span>
          </div>
          {isCup ? (
            <div className="matchesSubTabs">
              <button type="button" className={activePublicMatchesTab === "grupos" ? "active" : ""} onClick={() => setActivePublicMatchesTab("grupos")}>Fase de grupos</button>
              <button type="button" className={activePublicMatchesTab === "chaves" ? "active" : ""} onClick={() => setActivePublicMatchesTab("chaves")}>Chaves finais</button>
              <button type="button" className={activePublicMatchesTab === "paralela" ? "active" : ""} onClick={() => setActivePublicMatchesTab("paralela")}>{data.cupConfig?.repechageName || "Disputa paralela"}</button>
              {isCampeonatoCearenseData(data) ? (
                <button type="button" className={activePublicMatchesTab === "paralela3" ? "active" : ""} onClick={() => setActivePublicMatchesTab("paralela3")}>{data.cupConfig?.thirdRepechageName || "3ª Disputa Paralela"}</button>
              ) : null}
            </div>
          ) : null}

          <div style={{ display: !isCup || activePublicMatchesTab === "grupos" ? undefined : "none" }}>
            {!data.schedule || data.schedule.length === 0 ? (
              <p>A tabela ainda não foi gerada pelo organizador.</p>
            ) : (
              <ScheduleView schedule={data.schedule} showGroupName={isCup} winningScore={getWinningScore(data)} courtNumbers={data.courtNumbers || []} readOnly />
            )}
          </div>

          {isCup ? (
            <div style={{ display: activePublicMatchesTab === "chaves" ? undefined : "none" }}>
              {!currentBrackets ? <p>As chaves finais ainda não foram geradas pelo organizador.</p> : (
                <PublicCupBracketView
                  groupedBrackets={{ main: currentBrackets.main, repechage: [] }}
                  mainTitle={data.cupConfig?.mainBracketName || "Chave principal"}
                  courtNumbers={data.courtNumbers || []}
                />
              )}
            </div>
          ) : null}

          {isCup ? (
            <div style={{ display: activePublicMatchesTab === "paralela" ? undefined : "none" }}>
              {!currentBrackets
                ? <p>A disputa paralela ainda não foi gerada pelo organizador.</p>
                : currentBrackets.repechage?.length > 0
                  ? (
                    <PublicCupBracketView
                      groupedBrackets={{ main: [], repechage: currentBrackets.repechage }}
                      repechageTitle={data.cupConfig?.repechageName || "Disputa paralela"}
                      courtNumbers={data.courtNumbers || []}
                    />
                  )
                  : <p>{isPlayRankingData(data)
                    ? "A Disputa Paralela aparecerá aqui após o preenchimento de todos os placares da primeira fase da Eliminatória Principal."
                    : "Esta Copinha de 2 grupos não possui chave de consolação."}</p>}
            </div>
          ) : null}

          {isCup && isCampeonatoCearenseData(data) ? (
            <div style={{ display: activePublicMatchesTab === "paralela3" ? undefined : "none" }}>
              {!currentBrackets
                ? <p>A 3ª disputa paralela ainda não foi gerada pelo organizador.</p>
                : currentBrackets.thirdParallel?.length > 0
                  ? (
                    <PublicCupBracketView
                      groupedBrackets={{ main: [], repechage: [], thirdParallel: currentBrackets.thirdParallel }}
                      thirdRepechageTitle={data.cupConfig?.thirdRepechageName || "3ª Disputa Paralela"}
                      courtNumbers={data.courtNumbers || []}
                    />
                  )
                  : <p>Nesta quantidade de grupos não há duplas elegíveis para a 3ª disputa paralela.</p>}
            </div>
          ) : null}
        </section>

        <section className="card" style={{ display: activePublicTab === "ranking" ? undefined : "none" }}>
          <div className="cardTitleRow">
            <h2>{isCup ? "Ranking das chaves" : "Ranking do dia"}</h2>
            <span className="readOnlyBadge">Somente visualização</span>
          </div>
          {!publicRankingReady ? (
            <div className="publicRankingLocked">
              <LockKeyhole aria-hidden="true" />
              <div>
                <strong>Ranking ainda não liberado</strong>
                <p>
                  O ranking será exibido quando todos os jogos reais estiverem concluídos.
                  {publicCompletionState.requiredGames > 0
                    ? ` ${publicCompletionState.completedGames} de ${publicCompletionState.requiredGames} placares foram finalizados.`
                    : " As partidas ainda não foram geradas pelo organizador."}
                </p>
              </div>
            </div>
          ) : isCup ? (
            <div className="cupRankingSplit">
              <div className="cupRankingPanel">
                <h3>{data.cupConfig?.mainBracketName || "Chave Principal"}</h3>
                {mainCupPodium.length > 0 ? <CupPodiumView podium={mainCupPodium} title={data.cupConfig?.mainBracketName || "Principal"} shareContext={publicRankingShareContext} /> : <p>Finalize a chave principal para ver o ranking.</p>}
              </div>
              <div className="cupRankingPanel">
                <h3>{data.cupConfig?.repechageName || "Disputa Paralela"}</h3>
                {isCopinhaData(data)
                  ? (data.cupConfig?.teamCount === 6
                    ? <p>Com 2 grupos, não há consolação neste formato.</p>
                    : consolationCupPodium.length > 0
                    ? <CupPodiumView podium={consolationCupPodium} title={data.cupConfig?.repechageName || "Consolação"} variant="parallel" shareContext={publicRankingShareContext} />
                    : <p>A consolação ainda não foi finalizada.</p>)
                  : (parallelRanking.length > 0
                    ? <CupPodiumView
                        podium={parallelRanking.slice(0, 3).map((item, index) => ({
                          position: index === 0 ? "🏆 Campeão" : index === 1 ? "🥈 Vice" : "🥉 3º lugar",
                          name: item.name,
                        }))}
                        title={data.cupConfig?.repechageName || "Disputa Paralela"}
                        variant="parallel"
                        shareContext={publicRankingShareContext}
                      />
                    : <p>A disputa paralela ainda não tem ranking.</p>)}
              </div>
              {isCampeonatoCearenseData(data) ? (
                <div className="cupRankingPanel">
                  <h3>{data.cupConfig?.thirdRepechageName || "3ª Disputa Paralela"}</h3>
                  {thirdParallelPodium.length > 0
                    ? <CupPodiumView podium={thirdParallelPodium} title={data.cupConfig?.thirdRepechageName || "3ª Disputa Paralela"} variant="parallel" shareContext={publicRankingShareContext} />
                    : <p>A 3ª disputa paralela ainda não foi finalizada.</p>}
                </div>
              ) : null}
            </div>
          ) : (
            <RankingView ranking={ranking} type={tournament.type} rankingCriteria={data.rankingCriteria || defaultRankingCriteria} shareContext={publicRankingShareContext} />
          )}
        </section>

      </main>
    </div>
  );
}

function PublicScheduleView({ schedule, showGroupName = false, courtNumbers = [] }) {
  return (
    <div className="schedule readOnlySchedule publicSchedule">
      {schedule.map((round, roundIndex) => (
        <div className="roundCard readOnlyRoundCard publicReadOnlyRound" key={roundIndex}>
          <div className="roundHeader"><h3>Rodada {roundIndex + 1}</h3></div>

          {round.map((game, gameIndex) => (
            <UniversalMatchCard
              key={gameIndex}
              game={game}
              phaseLabel={showGroupName && game.groupName ? `${game.groupName} · Rodada ${roundIndex + 1}` : `Rodada ${roundIndex + 1}`}
              courtNumbers={courtNumbers}
              readOnly
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function PublicCupBracketView({
  groupedBrackets,
  mainTitle = "Chave principal",
  repechageTitle = "Disputa paralela",
  thirdRepechageTitle = "3ª Disputa Paralela",
  courtNumbers = [],
}) {
  const mainRounds = Array.isArray(groupedBrackets?.main) ? groupedBrackets.main : [];
  const repechageRounds = Array.isArray(groupedBrackets?.repechage) ? groupedBrackets.repechage : [];
  const thirdParallelRounds = Array.isArray(groupedBrackets?.thirdParallel) ? groupedBrackets.thirdParallel : [];

  if (mainRounds.length === 0 && repechageRounds.length === 0 && thirdParallelRounds.length === 0) return null;

  return (
    <div className="cupBrackets publicCupBrackets bracketTreeCollection">
      {mainRounds.length > 0 ? (
        <PublicBracketColumn
          rounds={mainRounds}
          title={mainRounds[0]?.bracketTitle || mainTitle}
          variant="main"
          courtNumbers={courtNumbers}
        />
      ) : null}
      {repechageRounds.length > 0 ? (
        <PublicBracketColumn
          rounds={repechageRounds}
          title={repechageRounds[0]?.bracketTitle || repechageTitle}
          variant="repechage"
          courtNumbers={courtNumbers}
        />
      ) : null}
      {thirdParallelRounds.length > 0 ? (
        <PublicBracketColumn
          rounds={thirdParallelRounds}
          title={thirdParallelRounds[0]?.bracketTitle || thirdRepechageTitle}
          variant="repechage"
          courtNumbers={courtNumbers}
        />
      ) : null}
    </div>
  );
}

function PublicBracketColumn({ rounds = [], title, variant, courtNumbers = [] }) {
  if (rounds.length === 0) return null;

  const isPlacementRound = (round) => {
    const normalizedTitle = String(round?.title || "").toLocaleLowerCase("pt-BR");
    return normalizedTitle.includes("3º")
      || normalizedTitle.includes("3°")
      || normalizedTitle.includes("terceiro");
  };
  const treeRounds = rounds.filter((round) => !isPlacementRound(round));
  const placementRounds = rounds.filter(isPlacementRound);
  const openingGames = Math.max(1, treeRounds[0]?.games?.length || 1);

  const renderPublicBracketGame = (game, round) => (
    <UniversalMatchCard
      game={game}
      phaseLabel={round.title || title}
      courtNumbers={courtNumbers}
      readOnly
      isBye={Boolean(game.isBye)}
    />
  );

  return (
    <section className={`bracketColumn bracketTree publicBracketColumn publicBracketColumn--${variant || "main"}`}>
      <div className="bracketTreeHeading">
        <div>
          <span>Chave eliminatória</span>
          {title ? <h3 className="publicBracketTitle">{title}</h3> : null}
        </div>
        <span className="bracketSwipeHint">Deslize para acompanhar as fases →</span>
      </div>

      <div className="bracketTreeViewport" tabIndex="0" aria-label={`Chave ${title}. Role horizontalmente para acompanhar as fases.`}>
        <div className="bracketTreeCanvas" style={{ "--bracket-opening-games": openingGames }}>
          {treeRounds.map((round, roundIndex) => (
            <section className="roundCard publicBracketRound bracketRoundLane" key={`${round.title}-${roundIndex}`}>
              <div className="roundHeader bracketRoundHeader"><h3>{round.title || title}</h3></div>
              <div className="bracketRoundTrack">
                {round.games.map((game, gameIndex) => (
                  <div
                    className={`bracketMatchNode ${roundIndex > 0 ? "hasPrevious" : ""} ${roundIndex < treeRounds.length - 1 ? "hasNext" : ""} ${gameIndex % 2 === 0 ? "isTopSeed" : "isBottomSeed"}`}
                    key={game.matchKey}
                  >
                    {renderPublicBracketGame(game, round)}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {placementRounds.length > 0 ? (
        <div className="bracketPlacementSection publicBracketPlacementSection">
          {placementRounds.map((round, roundIndex) => (
            <section className="roundCard publicBracketRound bracketPlacementRound" key={`${round.title}-placement-${roundIndex}`}>
              <div className="roundHeader bracketRoundHeader"><h3>{round.title}</h3></div>
              <div className="bracketPlacementGames">
                {round.games.map((game) => <div key={game.matchKey}>{renderPublicBracketGame(game, round)}</div>)}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function AppUpdateNotice() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const currentVersion = typeof __APP_BUILD_VERSION__ === "string" ? __APP_BUILD_VERSION__ : "development";

  useEffect(() => {
    if (!import.meta.env.PROD || currentVersion === "development") return undefined;
    let active = true;

    async function checkVersion() {
      try {
        const response = await fetch(`/app-version.json?t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!response.ok) return;
        const latest = await response.json();
        if (active && latest?.version && latest.version !== currentVersion) setUpdateAvailable(true);
      } catch {
        // O app continua funcionando offline e tenta novamente depois.
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkVersion();
    };
    const onFocus = () => void checkVersion();
    void checkVersion();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(checkVersion, 5 * 60 * 1000);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [currentVersion]);

  async function applyUpdate() {
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      await registration?.update();
      registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    } finally {
      window.location.reload();
    }
  }

  if (!updateAvailable) return null;

  return (
    <aside className="appUpdateNotice" role="status" aria-live="polite">
      <div>
        <strong>Nova versão disponível</strong>
        <span>Atualize sem sair da sua conta. Seus dados salvos serão mantidos.</span>
      </div>
      <button type="button" onClick={applyUpdate}>Atualizar agora</button>
      <button type="button" className="appUpdateLater" onClick={() => setUpdateAvailable(false)}>Depois</button>
    </aside>
  );
}

const torneio360Root = globalThis.__torneio360ReactRoot || createRoot(document.getElementById("root"));
if (import.meta.env.DEV) globalThis.__torneio360ReactRoot = torneio360Root;

torneio360Root.render(
  <>
    <App />
    <InstallAppBanner />
    <AppUpdateNotice />
  </>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Não foi possível registrar o atalho instalável:", error);
    });
  });
}
