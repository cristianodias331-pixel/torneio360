import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Film, Share2, X } from "lucide-react";
import { getTeamCupVideoSnapshot } from "../../domain/teamCupVideo.mjs";

function VideoDialog({ snapshot, draft, onClose }) {
  const [status, setStatus] = useState("idle"), [progress, setProgress] = useState(0), [scene, setScene] = useState("");
  const [file, setFile] = useState(null), [url, setUrl] = useState(""), [message, setMessage] = useState("");
  const controller = useRef(null), canvas = useRef(null), container = useRef(null), busy = useRef(false), currentUrl = useRef("");
  const title = snapshot.kind === "team-cup-teams" ? "Vídeo dos times — capitães e integrantes" : "Vídeo da formação dos grupos";
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; container.current?.querySelector("button")?.focus();
    function key(event) {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); if (!busy.current) onClose(); }
      if (event.key === "Tab") {
        const controls = [...container.current.querySelectorAll('button:not(:disabled), video')].filter(e => e.getClientRects().length), first = controls[0], last = controls.at(-1);
        event.stopImmediatePropagation();
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener("keydown", key, true);
    return () => { controller.current?.abort(); URL.revokeObjectURL(currentUrl.current); document.body.style.overflow = overflow; document.removeEventListener("keydown", key, true); previous?.focus?.(); };
  }, []);
  async function generate() {
    if (busy.current) return;
    busy.current = true; setStatus("generating"); setMessage(""); setProgress(0);
    URL.revokeObjectURL(currentUrl.current); currentUrl.current = ""; setUrl(""); setFile(null);
    const abort = new AbortController(); controller.current = abort;
    try {
      const { createTeamCupVideoFile } = await import("./teamCupVideoExport.mjs");
      const result = await createTeamCupVideoFile({ snapshot, canvas: canvas.current, signal: abort.signal, onProgress: setProgress, onScene: setScene });
      if (abort.signal.aborted) return;
      currentUrl.current = URL.createObjectURL(result); setUrl(currentUrl.current); setFile(result); setStatus("ready");
    } catch (error) { setStatus("idle"); setMessage(error.name === "AbortError" ? "Geração cancelada. O resultado do sorteio não mudou." : error.message); }
    finally { busy.current = false; }
  }
  async function share() {
    if (!file) return;
    if (!navigator.canShare?.({ files: [file] }) || !navigator.share) { setMessage("Este navegador não permite compartilhar esse arquivo diretamente. Baixe o vídeo e anexe no aplicativo desejado."); return; }
    try { await navigator.share({ title, files: [file] }); }
    catch (error) { if (error.name !== "AbortError") setMessage("Não foi possível compartilhar. Baixe o vídeo e anexe no aplicativo desejado."); }
  }
  async function download() { const { downloadShuffleVideo } = await import("../media/shuffleVideoExport.mjs"); downloadShuffleVideo(file); }
  return createPortal(<div className="tc-video-overlay" role="dialog" aria-modal="true" aria-label={title}>
    <section className="tc-video-dialog" ref={container}>
      <header><div><span>TIMES/EQUIPES</span><h2>{title}</h2><p>Apresentação gerada a partir do resultado registrado. Não realiza um novo sorteio.</p></div><button type="button" disabled={status === "generating"} onClick={onClose} aria-label="Fechar vídeo"><X /></button></header>
      <div className="tc-video-body">
        {draft && <p className="tc-video-warning">Prévia da formação: clique em Salvar formação ao voltar para manter este resultado no torneio.</p>}
        {status === "idle" && <><p>{snapshot.tournamentName} · {snapshot.modalityName}</p><p>{snapshot.kind === "team-cup-teams" ? `${snapshot.teams.length} equipes: capitães e integrantes no mesmo vídeo.` : `${snapshot.groups.length} grupos com os times definidos.`}</p><p>Formato vertical, com a identidade do Torneio360. A geração ocorre neste dispositivo; nada é publicado automaticamente.</p></>}
        <canvas ref={canvas} className="tc-video-canvas" hidden={status !== "generating"} width="720" height="1280" aria-label="Vídeo sendo montado" />
        {status === "generating" && <div role="status"><b>{scene} · {progress}%</b><progress max="100" value={progress} /><p>Mantenha esta aba aberta até terminar.</p></div>}
        {url && <><video src={url} controls playsInline preload="metadata" aria-label="Prévia do vídeo gerado" /><p>{file.type.includes("mp4") ? "MP4" : "WebM"} · {(file.size / 1024 / 1024).toFixed(1)} MB{!file.type.includes("mp4") && " · O navegador gerou WebM; a aceitação varia conforme o aplicativo."}</p></>}
        {message && <p role="alert">{message}</p>}
      </div>
      <footer>{status === "generating" ? <button type="button" onClick={() => controller.current?.abort()}>Cancelar geração</button> : <>
        <button type="button" onClick={onClose}>Voltar</button>
        {status === "ready" ? <><button type="button" onClick={download}><Download /> Baixar vídeo</button><button type="button" className="tc-video-primary" onClick={share}><Share2 /> Compartilhar vídeo</button></> : <button type="button" className="tc-video-primary" onClick={generate}><Film /> Gerar vídeo</button>}
      </>}</footer>
    </section>
  </div>, document.body);
}

export default function TeamCupVideoActions({ data, tournament, draft = false, only }) {
  const [snapshot, setSnapshot] = useState(null);
  const kinds = only ? [only] : ["teams", "groups"];
  const options = kinds.map(kind => {
    try { return { kind, snapshot: getTeamCupVideoSnapshot(data, tournament, kind) }; }
    catch (error) { return { kind, error: error.message }; }
  });
  return <div className="tc-video-actions">
    {options.map(option => <button type="button" key={option.kind} disabled={Boolean(option.error)} title={option.error || "Gerar, baixar ou compartilhar o vídeo"} onClick={() => setSnapshot(option.snapshot)}><Film /> {option.kind === "teams" ? "Vídeo dos times" : "Vídeo dos grupos"}</button>)}
    {draft && <small>Vídeos disponíveis após concluir os sorteios ou salvar a formação dos grupos.</small>}
    {snapshot && <VideoDialog snapshot={snapshot} draft={draft} onClose={() => setSnapshot(null)} />}
  </div>;
}
