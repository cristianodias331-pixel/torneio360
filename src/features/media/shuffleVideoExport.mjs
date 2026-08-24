import { createCupGroups, getTeamName } from "../../domain/cupGroups.mjs";
import { isCupType, isFixedTeamType, isMixedType } from "../../domain/modalityClassification.mjs";
import { getModalityDisplayName } from "../../domain/modalityCatalog.mjs";
import {
  TORNEIO360_LOGO,
  drawRoundedRect,
  loadShareImage,
  truncateCanvasText,
} from "./canvasTools.mjs";

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

export function createShuffleVideoSnapshot(data, config, tournament) {
  const createdAt = new Date().toISOString();
  let kind = "names";
  let sections = [];

  if (isCupType(config)) {
    kind = "groups";
    const teamCount = Number(data?.cupConfig?.teamCount || data?.players?.teams?.length || 0);
    const format = data?.cupConfig?.format || data?.cupConfig?.cupMode || "";
    const groups = createCupGroups(teamCount, format, data?.cupConfig || {});
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
  } else if (isFixedTeamType(config)) {
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

export async function createShuffleVideoFile({ snapshot, arenaName, arenaPhotoUrl, onProgress }) {
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

export function downloadShuffleVideo(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
