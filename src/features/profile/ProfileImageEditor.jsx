import React, { useEffect, useRef, useState } from "react";
import { Check, Crosshair, Image as ImageIcon, X } from "lucide-react";
import "../../styles/54-profile-image-editor.css";

const IMAGE_PRESETS = {
  photo: {
    title: "Enquadrar foto do perfil",
    eyebrow: "Foto do perfil",
    description: "A área circular mostra exatamente como a foto aparecerá no perfil.",
    outputWidth: 900,
    outputHeight: 900,
    outputLabel: "900 × 900 px",
    frameClass: "profileImageEditorFramePhoto",
  },
  cover: {
    title: "Enquadrar foto de capa",
    eyebrow: "Foto de capa",
    description: "A imagem inteira aparece por padrão na proporção de capa do Facebook. Use o zoom somente se quiser aproximar.",
    outputWidth: 1702,
    outputHeight: 630,
    outputLabel: "1702 × 630 px · proporção 851:315",
    frameClass: "profileImageEditorFrameCover",
    fit: "contain",
  },
};

function getBaseScale(imageSize, preset) {
  const widthScale = preset.outputWidth / imageSize.width;
  const heightScale = preset.outputHeight / imageSize.height;
  return preset.fit === "contain"
    ? Math.min(widthScale, heightScale)
    : Math.max(widthScale, heightScale);
}

function getPointerDistance(points) {
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function clampTransform(transform, imageSize, preset) {
  if (!imageSize) return transform;
  const baseScale = getBaseScale(imageSize, preset);
  const zoom = Math.min(4, Math.max(1, Number(transform.zoom) || 1));
  const renderedWidth = imageSize.width * baseScale * zoom;
  const renderedHeight = imageSize.height * baseScale * zoom;
  const limitX = Math.max(0, (renderedWidth - preset.outputWidth) / 2);
  const limitY = Math.max(0, (renderedHeight - preset.outputHeight) / 2);
  return {
    zoom,
    x: Math.min(limitX, Math.max(-limitX, Number(transform.x) || 0)),
    y: Math.min(limitY, Math.max(-limitY, Number(transform.y) || 0)),
  };
}

export default function ProfileImageEditor({
  kind = "photo",
  sourceUrl,
  fileName = "",
  onCancel,
  onApply,
}) {
  const preset = IMAGE_PRESETS[kind] || IMAGE_PRESETS.photo;
  const imageRef = useRef(null);
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const pointersRef = useRef(new Map());
  const lastDragRef = useRef(null);
  const lastPinchRef = useRef(null);
  const [imageSize, setImageSize] = useState(null);
  const [transform, setTransform] = useState({ zoom: 1, x: 0, y: 0 });
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setImageSize({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
      setTransform({ zoom: 1, x: 0, y: 0 });
      setError("");
    };
    image.onerror = () => {
      imageRef.current = null;
      setImageSize(null);
      setError("Esta imagem não pôde ser aberta. Tente JPG, PNG ou WebP.");
    };
    image.src = sourceUrl;
    return () => {
      image.onload = null;
      image.onerror = null;
      if (sourceUrl?.startsWith("blob:")) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !processing) onCancel?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel, processing]);

  function drawPreview(canvas, width, height) {
    const image = imageRef.current;
    if (!canvas || !image || !imageSize) return false;
    const context = canvas.getContext("2d");
    if (!context) return false;

    const safeTransform = clampTransform(transform, imageSize, preset);
    const baseScale = getBaseScale(imageSize, preset);
    const renderedWidth = imageSize.width * baseScale * safeTransform.zoom;
    const renderedHeight = imageSize.height * baseScale * safeTransform.zoom;
    const outputLeft = ((preset.outputWidth - renderedWidth) / 2) + safeTransform.x;
    const outputTop = ((preset.outputHeight - renderedHeight) / 2) + safeTransform.y;
    const scaleX = width / preset.outputWidth;
    const scaleY = height / preset.outputHeight;

    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#071524";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      outputLeft * scaleX,
      outputTop * scaleY,
      renderedWidth * scaleX,
      renderedHeight * scaleY
    );
    return true;
  }

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !imageSize) return;
    const rect = frame.getBoundingClientRect();
    drawPreview(canvasRef.current, Math.max(1, Math.round(rect.width)), Math.max(1, Math.round(rect.height)));
  }, [imageSize, transform, kind]);

  function updateTransform(updater) {
    if (!imageSize) return;
    setTransform((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      return clampTransform(next, imageSize, preset);
    });
  }

  function handlePointerDown(event) {
    if (!imageSize || processing) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 1) {
      lastDragRef.current = { x: event.clientX, y: event.clientY };
      lastPinchRef.current = null;
    } else if (pointersRef.current.size === 2) {
      lastPinchRef.current = getPointerDistance(Array.from(pointersRef.current.values()));
      lastDragRef.current = null;
    }
  }

  function handlePointerMove(event) {
    if (!pointersRef.current.has(event.pointerId) || !imageSize || processing) return;
    event.preventDefault();
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 1 && lastDragRef.current) {
      const frameWidth = frameRef.current?.getBoundingClientRect().width || preset.outputWidth;
      const outputPerPreviewPixel = preset.outputWidth / frameWidth;
      const dx = (event.clientX - lastDragRef.current.x) * outputPerPreviewPixel;
      const dy = (event.clientY - lastDragRef.current.y) * outputPerPreviewPixel;
      lastDragRef.current = { x: event.clientX, y: event.clientY };
      updateTransform((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
    } else if (pointersRef.current.size === 2 && lastPinchRef.current) {
      const distance = getPointerDistance(Array.from(pointersRef.current.values()));
      const ratio = distance / lastPinchRef.current;
      lastPinchRef.current = distance;
      updateTransform((current) => ({ ...current, zoom: current.zoom * ratio }));
    }
  }

  function handlePointerEnd(event) {
    pointersRef.current.delete(event.pointerId);
    lastDragRef.current = null;
    lastPinchRef.current = null;
    if (pointersRef.current.size === 1) {
      const point = Array.from(pointersRef.current.values())[0];
      lastDragRef.current = { x: point.x, y: point.y };
    }
  }

  function handleWheel(event) {
    if (!imageSize || processing) return;
    event.preventDefault();
    updateTransform((current) => ({
      ...current,
      zoom: current.zoom * (event.deltaY > 0 ? 0.92 : 1.08),
    }));
  }

  async function applyImage() {
    if (!imageSize || processing) return;
    setProcessing(true);
    setError("");
    try {
      const outputCanvas = document.createElement("canvas");
      if (!drawPreview(outputCanvas, preset.outputWidth, preset.outputHeight)) {
        throw new Error("Não foi possível preparar a imagem.");
      }
      const imageUrl = outputCanvas.toDataURL("image/webp", 0.88);
      const applied = await onApply?.({ imageUrl, width: preset.outputWidth, height: preset.outputHeight });
      if (applied === false) setProcessing(false);
    } catch (applyError) {
      setError(applyError?.message || "Não foi possível preparar a imagem.");
      setProcessing(false);
    }
  }

  return (
    <div className="profileImageEditorOverlay" role="dialog" aria-modal="true" aria-labelledby="profile-image-editor-title">
      <section className="profileImageEditorModal">
        <header>
          <div>
            <span>{preset.eyebrow}</span>
            <h2 id="profile-image-editor-title">{preset.title}</h2>
            <p>{preset.description}</p>
          </div>
          <button type="button" onClick={onCancel} disabled={processing} aria-label="Fechar enquadramento"><X aria-hidden="true" /></button>
        </header>

        <div className="profileImageEditorBody">
          <div
            ref={frameRef}
            className={`profileImageEditorFrame ${preset.frameClass} ${imageSize ? "ready" : "loading"}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onWheel={handleWheel}
          >
            <canvas ref={canvasRef} aria-label="Pré-visualização da imagem enquadrada" />
            {!imageSize && !error ? <span>Carregando imagem...</span> : null}
            <div className="profileImageEditorCrosshair" aria-hidden="true"><Crosshair /></div>
          </div>

          <aside>
            <div className="profileImageEditorOutput"><ImageIcon aria-hidden="true" /><span><strong>Saída preparada</strong><small>{preset.outputLabel}</small></span></div>
            {imageSize ? <p>Original: {imageSize.width} × {imageSize.height} px</p> : null}
            <div className="profileImageEditorZoom" aria-label="Nível de aproximação">
              <span>Zoom</span>
              <input
                type="range"
                min="1"
                max="4"
                step="0.01"
                value={transform.zoom}
                onChange={(event) => updateTransform((current) => ({ ...current, zoom: Number(event.target.value) }))}
                disabled={!imageSize || processing}
              />
              <strong>{Math.round(transform.zoom * 100)}%</strong>
            </div>
            <div className="profileImageEditorHint">Arraste para posicionar · use a roda do mouse ou pinça para aproximar</div>
            {fileName ? <small className="profileImageEditorFileName" title={fileName}>{fileName}</small> : null}
            {error ? <div className="profileImageEditorError" role="alert">{error}</div> : null}
          </aside>
        </div>

        <footer>
          <button type="button" className="secondaryBtn" onClick={onCancel} disabled={processing}>Cancelar</button>
          <button type="button" className="actionConfirmBtn" onClick={() => void applyImage()} disabled={!imageSize || processing}>
            <Check aria-hidden="true" /> {processing ? "Salvando..." : "Salvar enquadramento"}
          </button>
        </footer>
      </section>
    </div>
  );
}
