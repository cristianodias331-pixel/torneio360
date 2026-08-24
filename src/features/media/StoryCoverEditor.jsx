import React, { useEffect, useRef, useState } from "react";
import {
  STORY_COVER_HEIGHT,
  STORY_COVER_WIDTH,
  clampStoryCoverTransform,
  getStoryCoverRenderRect,
  storyCoverHasNativeResolution,
} from "./storyCoverCrop.mjs";

const PREVIEW_WIDTH = 270;
const PREVIEW_HEIGHT = 480;

function getPointerDistance(points) {
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

export default function StoryCoverEditor({ sourceUrl, fileName = "", onCancel, onApply }) {
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
    image.onerror = () => {
      imageRef.current = null;
      setImageSize(null);
      setError("Esta imagem não pôde ser aberta. Tente JPG, PNG ou WebP.");
    };
    image.onload = () => {
      imageRef.current = image;
      setImageSize({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height });
      setTransform({ zoom: 1, x: 0, y: 0 });
      setError("");
    };
    image.src = sourceUrl;

    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [sourceUrl]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !processing) onCancel?.();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, processing]);

  function drawCover(canvas, width, height) {
    const image = imageRef.current;
    if (!canvas || !image || !imageSize) return false;
    const context = canvas.getContext("2d");
    if (!context) return false;

    const rect = getStoryCoverRenderRect({
      sourceWidth: imageSize.width,
      sourceHeight: imageSize.height,
      ...transform,
    });
    const outputScale = width / STORY_COVER_WIDTH;
    canvas.width = width;
    canvas.height = height;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(
      image,
      rect.left * outputScale,
      rect.top * outputScale,
      rect.width * outputScale,
      rect.height * outputScale
    );
    return true;
  }

  useEffect(() => {
    drawCover(canvasRef.current, PREVIEW_WIDTH, PREVIEW_HEIGHT);
  }, [imageSize, transform]);

  function updateTransform(updater) {
    if (!imageSize) return;
    setTransform((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      return clampStoryCoverTransform({
        sourceWidth: imageSize.width,
        sourceHeight: imageSize.height,
        ...next,
      });
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
      const frameWidth = frameRef.current?.getBoundingClientRect().width || PREVIEW_WIDTH;
      const outputPerPreviewPixel = STORY_COVER_WIDTH / frameWidth;
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
    const multiplier = event.deltaY > 0 ? 0.92 : 1.08;
    updateTransform((current) => ({ ...current, zoom: current.zoom * multiplier }));
  }

  async function applyCover() {
    if (!imageSize || processing) return;
    setProcessing(true);
    setError("");

    try {
      const canvas = document.createElement("canvas");
      if (!drawCover(canvas, STORY_COVER_WIDTH, STORY_COVER_HEIGHT)) {
        throw new Error("Não foi possível preparar a imagem.");
      }
      const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
      await onApply?.(dataUrl);
    } catch (applyError) {
      setError(applyError?.message || "Não foi possível preparar a imagem.");
      setProcessing(false);
    }
  }

  const nativeResolution = imageSize
    ? storyCoverHasNativeResolution(imageSize.width, imageSize.height)
    : false;

  return (
    <div className="storyCoverEditorOverlay" role="dialog" aria-modal="true" aria-labelledby="story-cover-editor-title">
      <section className="storyCoverEditorModal">
        <header>
          <div>
            <span className="storyCoverEditorEyebrow">Capa vertical 9:16</span>
            <h2 id="story-cover-editor-title">Enquadrar foto</h2>
            <p>Arraste para posicionar. Use a roda do mouse ou dois dedos para aproximar.</p>
          </div>
          <button type="button" className="secondaryBtn" onClick={onCancel} disabled={processing}>Fechar</button>
        </header>

        <div className="storyCoverEditorBody">
          <div
            ref={frameRef}
            className={`storyCoverEditorFrame ${imageSize ? "ready" : "loading"}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onWheel={handleWheel}
          >
            <canvas ref={canvasRef} aria-label="Prévia da capa vertical enquadrada" />
            {!imageSize && !error ? <span>Carregando foto...</span> : null}
            <div className="storyCoverSafeArea" aria-hidden="true" />
          </div>

          <aside className="storyCoverEditorInfo">
            <strong>Saída: 1080 × 1920 px</strong>
            <span>Formato Stories do Instagram, proporção 9:16.</span>
            {imageSize ? (
              <div className={`storyCoverQuality ${nativeResolution ? "good" : "warning"}`}>
                <strong>{nativeResolution ? "Boa resolução" : "Resolução limitada"}</strong>
                <span>
                  Original: {imageSize.width} × {imageSize.height} px.
                  {nativeResolution
                    ? " A imagem será reduzida com alta qualidade."
                    : " A imagem precisará ser ampliada e poderá perder nitidez."}
                </span>
              </div>
            ) : null}
            {fileName ? <small title={fileName}>{fileName}</small> : null}
            <div className="storyCoverGestureHint">Arraste para mover · roda para zoom · pinça no celular</div>
            {error ? <div className="storyCoverEditorError" role="alert">{error}</div> : null}
          </aside>
        </div>

        <footer>
          <button type="button" className="cancelBtn" onClick={onCancel} disabled={processing}>Cancelar</button>
          <button type="button" className="actionConfirmBtn" onClick={() => void applyCover()} disabled={!imageSize || processing}>
            {processing ? "Preparando foto..." : "Aplicar enquadramento"}
          </button>
        </footer>
      </section>
    </div>
  );
}
