import React, { useEffect, useState } from "react";
import { Dices, Download, RefreshCw, X } from "lucide-react";

export default function ShuffleVideoModal({
  snapshot,
  arenaName,
  arenaPhotoUrl,
  onClose,
  createVideoFile,
  downloadVideo,
}) {
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
      const file = await createVideoFile({ snapshot, arenaName, arenaPhotoUrl, onProgress: setProgress });
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
              <button type="button" className="shuffleVideoDownload" onClick={() => downloadVideo(videoFile)}><Download /> Baixar vídeo</button>
              <button type="button" className="shuffleVideoSecondary" onClick={onClose}>Fechar</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
