import { teamCupVideoScenes } from "../../domain/teamCupVideo.mjs";
import { TORNEIO360_LOGO, drawRoundedRect, loadShareImage, truncateCanvasText } from "../media/canvasTools.mjs";
import { drawShuffleVideoBackground, drawShuffleVideoHeader, drawShuffleVideoFooter, drawShuffleVideoMotion, getShuffleVideoMimeType } from "../media/shuffleVideoExport.mjs";

function lines(ctx, text, x, y, width, font = "800 22px Arial", color = "#13213d") {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = "left";
  const words = String(text).split(/\s+/); let line = "", row = 0;
  for (const word of words) {
    if (line && ctx.measureText(`${line} ${word}`).width > width && row === 0) { ctx.fillText(line, x, y); line = word; row++; }
    else line = line ? `${line} ${word}` : word;
  }
  ctx.fillText(truncateCanvasText(ctx, line, width), x, y + row * 27);
}
const method = mode => ({ balanced: "Sorteio equilibrado", random: "Sorteio aleatório", similar: "Mesmo nível junto", manual: "Formação manual" })[mode] || "Formação dos grupos";

export function drawTeamCupVideoFrame(ctx, snapshot, scene, elapsed, assets, page, totalPages) {
  drawShuffleVideoBackground(ctx);
  drawShuffleVideoHeader(ctx, snapshot, assets, "Torneio360");
  drawShuffleVideoFooter(ctx, { ...snapshot, id: snapshot.id.slice(0, 17) }, `${page + 1}/${totalPages} · ${method(snapshot.mode)}`);
  if (scene.type === "motion") {
    drawShuffleVideoMotion(ctx, { ...snapshot, motionLabel: scene.title, sections: [{ entries: scene.names }] }, elapsed);
    return;
  }
  drawRoundedRect(ctx, 28, 268, 664, 922, 28, "#f5f8ff", "#c6d8ed");
  if (scene.type === "intro") {
    lines(ctx, snapshot.kind === "team-cup-teams" ? "CAPITÃES + INTEGRANTES" : "FORMAÇÃO DOS GRUPOS", 56, 410, 600, "900 32px Arial");
    lines(ctx, method(snapshot.mode), 56, 500, 600, "800 26px Arial", "#6b36a7");
    lines(ctx, "Apresentação do resultado registrado", 56, 610, 600);
    lines(ctx, "O vídeo não realiza um novo sorteio.", 56, 666, 600, "700 20px Arial");
    lines(ctx, new Date(snapshot.createdAt).toLocaleString("pt-BR"), 56, 770, 600, "700 22px Arial");
    return;
  }
  const title = scene.type === "captains" ? "1. Capitães sorteados" : scene.type === "teams" ? "2. Times completos" : scene.items[0].title;
  lines(ctx, title, 52, 316, 614, "900 29px Arial");
  const teams = scene.type === "groups" ? scene.items[0].teams : scene.items;
  const cardHeight = scene.type === "teams" ? 390 : 190;
  teams.forEach((team, i) => {
    const y = 360 + i * (cardHeight + 14);
    drawRoundedRect(ctx, 48, y, 624, cardHeight, 18, i % 2 ? "#f1eafa" : "#e7f0ff", "#c2d3ed");
    lines(ctx, team.name, 66, y + 32, 582, "900 23px Arial", "#423380");
    const captain = team.athletes.find(a => a.id === team.captainId);
    if (scene.type === "teams") {
      team.athletes.forEach((a, j) => {
        const ay = y + 87 + j * 72;
        lines(ctx, a.name, 70, ay, 572, "800 20px Arial");
        const label = [a.id === team.captainId ? "CAPITÃO/Ã" : "INTEGRANTE", a.gender === "H" ? "Masculino" : "Feminino", a.level].filter(Boolean).join(" · ");
        lines(ctx, label, 70, ay + 46, 572, "700 14px Arial", "#526887");
      });
    } else {
      lines(ctx, captain?.name || "Capitão/ã", 70, y + 91, 570, "800 22px Arial");
      lines(ctx, "CAPITÃO/Ã" + (captain?.level ? ` · ${captain.level}` : ""), 70, y + 147, 570, "700 16px Arial", "#526887");
    }
  });
}

export async function createTeamCupVideoFile({ snapshot, onProgress, onScene, signal, canvas: previewCanvas }) {
  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) throw new Error("Este navegador não consegue gerar vídeos. Tente no Chrome ou Edge atualizado.");
  signal?.throwIfAborted();
  await document.fonts?.ready;
  const logo = await loadShareImage(TORNEIO360_LOGO);
  signal?.throwIfAborted();
  const canvas = previewCanvas || document.createElement("canvas"); canvas.width = 720; canvas.height = 1280;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Não foi possível preparar o vídeo.");
  const scenes = teamCupVideoScenes(snapshot), total = scenes.reduce((sum, s) => sum + s.duration, 0);
  const stream = canvas.captureStream(24), chunks = [], mimeType = getShuffleVideoMimeType();
  let recorder, frame, cancelRecording, abort, visibility;
  try {
    recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 4_200_000 });
    let recordingError;
    const recorded = new Promise(resolve => {
      recorder.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
      recorder.onstop = resolve;
      recorder.onerror = () => { recordingError = new Error("O navegador interrompeu a gravação do vídeo."); cancelRecording?.(recordingError); resolve(); };
    });
    drawTeamCupVideoFrame(ctx, snapshot, scenes[0], 0, { logo }, 0, scenes.length);
    recorder.start(250);
    await new Promise((resolve, reject) => {
      const start = performance.now(); let lastScene = -1;
      cancelRecording = reject;
      abort = () => reject(new DOMException("Geração cancelada", "AbortError"));
      visibility = () => { if (document.hidden) reject(new Error("A aba ficou em segundo plano. Gere novamente mantendo-a visível para não perder partes do vídeo.")); };
      signal?.addEventListener("abort", abort, { once: true });
      document.addEventListener("visibilitychange", visibility);
      if (document.hidden) { visibility(); return; }
      function render(now) {
        if (signal?.aborted) { abort(); return; }
        try {
          const elapsed = Math.min(total, now - start); let offset = 0, index = 0;
          while (index < scenes.length - 1 && elapsed >= offset + scenes[index].duration) offset += scenes[index++].duration;
          drawTeamCupVideoFrame(ctx, snapshot, scenes[index], elapsed - offset, { logo }, index, scenes.length);
          if (index !== lastScene) { lastScene = index; onScene?.(scenes[index].type === "motion" ? scenes[index].title : scenes[index].type === "captains" ? "Capitães sorteados" : scenes[index].type === "teams" ? "Times completos" : scenes[index].type === "groups" ? scenes[index].items[0].title : "Apresentação"); }
          onProgress?.(Math.floor(elapsed / total * 100));
          if (elapsed >= total) { signal?.removeEventListener("abort", abort); resolve(); }
          else frame = requestAnimationFrame(render);
        } catch (error) { signal?.removeEventListener("abort", abort); reject(error); }
      }
      frame = requestAnimationFrame(render);
    });
    recorder.stop(); await recorded;
    if (recordingError) throw recordingError;
    signal?.throwIfAborted();
    const type = recorder.mimeType || mimeType || "video/webm", blob = new Blob(chunks, { type });
    if (!blob.size) throw new Error("O vídeo foi gerado sem conteúdo. Tente novamente.");
    const slug = String(snapshot.tournamentName).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
    return new File([blob], `${slug}-${snapshot.kind === "team-cup-teams" ? "capitaes-e-integrantes" : "grupos"}.${type.includes("mp4") ? "mp4" : "webm"}`, { type });
  } finally {
    signal?.removeEventListener("abort", abort);
    document.removeEventListener("visibilitychange", visibility);
    cancelAnimationFrame(frame);
    if (recorder?.state === "recording") recorder.stop();
    stream.getTracks().forEach(track => track.stop());
  }
}
