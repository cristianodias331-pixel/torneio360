import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileSpreadsheet, Printer, Share2, X } from "lucide-react";
import {
  canNativeShareRankingFiles,
  downloadRankingFiles,
  nativeShareRankingFiles,
  printRankingDocument,
  shareRankingImages,
} from "./rankingShareExport.mjs";
import { downloadRankingWorkbook } from "./rankingWorkbookExport.mjs";

export default function RankingShareButton({ config }) {
  const [status, setStatus] = useState("idle");
  const [exportFiles, setExportFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [workbookStatus, setWorkbookStatus] = useState("idle");

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
    setWorkbookStatus("idle");
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
                : config.buttonLabel || "Compartilhar ranking";

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
              {config.editableWorkbook ? (
                <button
                  type="button"
                  className="workbook"
                  disabled={workbookStatus === "loading"}
                  onClick={async () => {
                    setWorkbookStatus("loading");
                    try {
                      await downloadRankingWorkbook(config);
                      setWorkbookStatus("downloaded");
                    } catch (error) {
                      console.error("Erro ao gerar planilha do ranking:", error);
                      setWorkbookStatus("error");
                    }
                  }}
                >
                  <FileSpreadsheet aria-hidden="true" /> {workbookStatus === "loading"
                    ? "Preparando planilha…"
                    : workbookStatus === "downloaded"
                      ? "Planilha baixada"
                      : workbookStatus === "error"
                        ? "Tentar baixar planilha"
                        : "Baixar planilha editável (.xlsx)"}
                </button>
              ) : null}
            </div>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}
