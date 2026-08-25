import React, { useEffect, useRef, useState } from "react";
import "../../styles/41-responsive-public-covers.css";
import {
  STORY_COVER_HEIGHT,
  STORY_COVER_WIDTH,
  clampStoryCoverTransform,
  getStoryCoverBackgroundRect,
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
  const overlayRef = useRef(null);
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

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return undefined;

    const html = document.documentElement;
    const body = document.body;
    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    const previouslyFocused = document.activeElement;
    const previousHtmlStyles = {
      overflow: html.style.overflow,
      overscrollBehavior: html.style.overscrollBehavior,
    };
    const previousBodyStyles = {
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    const underlyingDialogs = Array.from(document.querySelectorAll('[aria-modal="true"]'))
      .filter((dialog) => dialog !== overlay && !dialog.contains(overlay))
      .map((dialog) => ({
        dialog,
        ariaHidden: dialog.getAttribute("aria-hidden"),
        inert: dialog.inert,
        hadInertAttribute: dialog.hasAttribute("inert"),
      }));

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    body.style.position = "fixed";
    body.style.top = `${-scrollY}px`;
    body.style.left = `${-scrollX}px`;
    body.style.right = "0";
    body.style.width = "100%";
    body.classList.add("storyCoverScrollLocked");

    underlyingDialogs.forEach(({ dialog }) => {
      dialog.inert = true;
      dialog.setAttribute("aria-hidden", "true");
      dialog.classList.add("storyCoverUnderlyingModalLocked");
    });
    overlay.focus({ preventScroll: true });

    return () => {
      underlyingDialogs.forEach(({ dialog, ariaHidden, inert, hadInertAttribute }) => {
        dialog.classList.remove("storyCoverUnderlyingModalLocked");
        dialog.inert = inert;
        if (!hadInertAttribute) dialog.removeAttribute("inert");
        if (ariaHidden === null) dialog.removeAttribute("aria-hidden");
        else dialog.setAttribute("aria-hidden", ariaHidden);
      });
      Object.assign(html.style, previousHtmlStyles);
      Object.assign(body.style, previousBodyStyles);
      body.classList.remove("storyCoverScrollLocked");
      window.scrollTo(scrollX, scrollY);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, []);

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
    const backgroundRect = getStoryCoverBackgroundRect(imageSize.width, imageSize.height);
    const outputScale = width / STORY_COVER_WIDTH;
    const backgroundBlur = Math.max(9, Math.round(34 * outputScale));
    const backgroundBleed = backgroundBlur * 2;
    canvas.width = width;
    canvas.height = height;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#071524";
    context.fillRect(0, 0, width, height);
    context.save();
    context.filter = `blur(${backgroundBlur}px) brightness(0.5) saturate(0.85)`;
    context.drawImage(
      image,
      backgroundRect.left * outputScale - backgroundBleed,
      backgroundRect.top * outputScale - backgroundBleed,
      backgroundRect.width * outputScale + (backgroundBleed * 2),
      backgroundRect.height * outputScale + (backgroundBleed * 2)
    );
    context.restore();
    context.fillStyle = "rgba(3, 12, 24, 0.18)";
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
      const thumbnailCanvas = document.createElement("canvas");
      if (!drawCover(thumbnailCanvas, PREVIEW_WIDTH, PREVIEW_HEIGHT)) {
        throw new Error("Não foi possível preparar a miniatura.");
      }
      const imageUrl = canvas.toDataURL("image/jpeg", 0.88);
      const thumbnailUrl = thumbnailCanvas.toDataURL("image/jpeg", 0.8);
      await onApply?.({ imageUrl, thumbnailUrl });
    } catch (applyError) {
      setError(applyError?.message || "Não foi possível preparar a imagem.");
      setProcessing(false);
    }
  }

  const nativeResolution = imageSize
    ? storyCoverHasNativeResolution(imageSize.width, imageSize.height)
    : false;

  return (
    <div
      ref={overlayRef}
      className="storyCoverEditorOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-cover-editor-title"
      tabIndex={-1}
      onWheel={(event) => event.stopPropagation()}
    >
      <section className="storyCoverEditorModal">
        <header>
          <div>
            <span className="storyCoverEditorEyebrow">Capa vertical 9:16</span>
            <h2 id="story-cover-editor-title">Enquadrar foto</h2>
            <p>A foto inteira aparece por padrão. O fundo desfocado completa o formato 9:16.</p>
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
            <div className="storyCoverGestureHint">Aproxime para recortar · arraste para mover · pinça no celular</div>
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
