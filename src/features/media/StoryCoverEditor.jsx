import React, { useEffect, useRef, useState } from "react";
import "../../styles/41-responsive-public-covers.css";

const POST_COVER_FORMATS = Object.freeze({
  portrait: Object.freeze({ id: "portrait", width: 1080, height: 1350, previewWidth: 280, previewHeight: 350, label: "Vertical 4:5", note: "Recomendado" }),
  square: Object.freeze({ id: "square", width: 1080, height: 1080, previewWidth: 280, previewHeight: 280, label: "Quadrado 1:1", note: "Alternativo" }),
});
const MAX_ZOOM = 4;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function getCoverBaseScale(sourceWidth, sourceHeight, format) {
  const width = Math.max(1, Number(sourceWidth) || 1);
  const height = Math.max(1, Number(sourceHeight) || 1);
  return Math.max(format.width / width, format.height / height);
}

function clampCoverTransform({ sourceWidth, sourceHeight, format, zoom = 1, x = 0, y = 0 }) {
  const safeZoom = clamp(zoom, 1, MAX_ZOOM);
  const baseScale = getCoverBaseScale(sourceWidth, sourceHeight, format);
  const renderedWidth = Math.max(1, Number(sourceWidth) || 1) * baseScale * safeZoom;
  const renderedHeight = Math.max(1, Number(sourceHeight) || 1) * baseScale * safeZoom;
  return {
    zoom: safeZoom,
    x: clamp(x, -(renderedWidth - format.width) / 2, (renderedWidth - format.width) / 2),
    y: clamp(y, -(renderedHeight - format.height) / 2, (renderedHeight - format.height) / 2),
  };
}

function getCoverRenderRect({ sourceWidth, sourceHeight, format, zoom = 1, x = 0, y = 0 }) {
  const transform = clampCoverTransform({ sourceWidth, sourceHeight, format, zoom, x, y });
  const scale = getCoverBaseScale(sourceWidth, sourceHeight, format) * transform.zoom;
  const width = Math.max(1, Number(sourceWidth) || 1) * scale;
  const height = Math.max(1, Number(sourceHeight) || 1) * scale;
  return {
    ...transform,
    width,
    height,
    left: (format.width - width) / 2 + transform.x,
    top: (format.height - height) / 2 + transform.y,
  };
}

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
  const [formatId, setFormatId] = useState("portrait");
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
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      setImageSize({ width, height });
      setFormatId(width / Math.max(1, height) >= 0.92 ? "square" : "portrait");
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

  const format = POST_COVER_FORMATS[formatId];

  function drawCover(canvas, width, height) {
    const image = imageRef.current;
    if (!canvas || !image || !imageSize) return false;
    const context = canvas.getContext("2d");
    if (!context) return false;

    const rect = getCoverRenderRect({
      sourceWidth: imageSize.width,
      sourceHeight: imageSize.height,
      format,
      ...transform,
    });
    const outputScale = width / format.width;
    canvas.width = width;
    canvas.height = height;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#071524";
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
    drawCover(canvasRef.current, format.previewWidth, format.previewHeight);
  }, [formatId, imageSize, transform]);

  function chooseFormat(nextFormatId) {
    if (!POST_COVER_FORMATS[nextFormatId] || nextFormatId === formatId) return;
    setFormatId(nextFormatId);
    setTransform({ zoom: 1, x: 0, y: 0 });
  }

  function updateTransform(updater) {
    if (!imageSize) return;
    setTransform((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      return clampCoverTransform({
        sourceWidth: imageSize.width,
        sourceHeight: imageSize.height,
        format,
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
      const frameWidth = frameRef.current?.getBoundingClientRect().width || format.previewWidth;
      const outputPerPreviewPixel = format.width / frameWidth;
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
      if (!drawCover(canvas, format.width, format.height)) {
        throw new Error("Não foi possível preparar a imagem.");
      }
      const thumbnailCanvas = document.createElement("canvas");
      if (!drawCover(thumbnailCanvas, format.previewWidth, format.previewHeight)) {
        throw new Error("Não foi possível preparar a miniatura.");
      }
      const imageUrl = canvas.toDataURL("image/jpeg", 0.88);
      const thumbnailUrl = thumbnailCanvas.toDataURL("image/jpeg", 0.8);
      await onApply?.({ imageUrl, thumbnailUrl, format: format.id, width: format.width, height: format.height });
    } catch (applyError) {
      setError(applyError?.message || "Não foi possível preparar a imagem.");
      setProcessing(false);
    }
  }

  const nativeResolution = imageSize
    ? getCoverBaseScale(imageSize.width, imageSize.height, format) <= 1
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
            <span className="storyCoverEditorEyebrow">Capa do post</span>
            <h2 id="story-cover-editor-title">Escolher formato e enquadrar</h2>
            <p>Use 4:5 para aproveitar melhor o feed ou 1:1 para uma publicação quadrada.</p>
          </div>
          <button type="button" className="secondaryBtn" onClick={onCancel} disabled={processing}>Fechar</button>
        </header>

        <div className="storyCoverEditorBody">
          <div
            ref={frameRef}
            className={`storyCoverEditorFrame ${imageSize ? "ready" : "loading"}`}
            style={{ aspectRatio: `${format.width} / ${format.height}` }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onWheel={handleWheel}
          >
            <canvas ref={canvasRef} aria-label={`Prévia da capa ${format.label} enquadrada`} />
            {!imageSize && !error ? <span>Carregando foto...</span> : null}
            <div className="storyCoverSafeArea" aria-hidden="true" />
          </div>

          <aside className="storyCoverEditorInfo">
            <div className="storyCoverFormatPicker" role="group" aria-label="Formato da capa do post">
              {Object.values(POST_COVER_FORMATS).map((option) => (
                <button type="button" key={option.id} className={formatId === option.id ? "selected" : ""} onClick={() => chooseFormat(option.id)} disabled={processing}>
                  <strong>{option.label}</strong>
                  <small>{option.width} × {option.height} · {option.note}</small>
                </button>
              ))}
            </div>
            <strong>Saída: {format.width} × {format.height} px</strong>
            <span>Formato de post do Instagram. A imagem preencherá todo o quadro, sem faixas vazias.</span>
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
