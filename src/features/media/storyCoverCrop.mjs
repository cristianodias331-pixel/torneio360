export const STORY_COVER_WIDTH = 1080;
export const STORY_COVER_HEIGHT = 1920;
export const STORY_COVER_ASPECT_RATIO = STORY_COVER_WIDTH / STORY_COVER_HEIGHT;
export const STORY_COVER_MAX_ZOOM = 4;
export const STORY_COVER_MAX_FILE_BYTES = 20 * 1024 * 1024;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

export function getStoryCoverBaseScale(sourceWidth, sourceHeight) {
  const width = Math.max(1, Number(sourceWidth) || 1);
  const height = Math.max(1, Number(sourceHeight) || 1);
  return Math.min(STORY_COVER_WIDTH / width, STORY_COVER_HEIGHT / height);
}

export function getStoryCoverBackgroundScale(sourceWidth, sourceHeight) {
  const width = Math.max(1, Number(sourceWidth) || 1);
  const height = Math.max(1, Number(sourceHeight) || 1);
  return Math.max(STORY_COVER_WIDTH / width, STORY_COVER_HEIGHT / height);
}

export function getStoryCoverBackgroundRect(sourceWidth, sourceHeight) {
  const width = Math.max(1, Number(sourceWidth) || 1);
  const height = Math.max(1, Number(sourceHeight) || 1);
  const scale = getStoryCoverBackgroundScale(width, height);
  const renderedWidth = width * scale;
  const renderedHeight = height * scale;

  return {
    width: renderedWidth,
    height: renderedHeight,
    left: (STORY_COVER_WIDTH - renderedWidth) / 2,
    top: (STORY_COVER_HEIGHT - renderedHeight) / 2,
  };
}

export function clampStoryCoverTransform({
  sourceWidth,
  sourceHeight,
  zoom = 1,
  x = 0,
  y = 0,
} = {}) {
  const safeZoom = clamp(zoom, 1, STORY_COVER_MAX_ZOOM);
  const baseScale = getStoryCoverBaseScale(sourceWidth, sourceHeight);
  const renderedWidth = Math.max(1, Number(sourceWidth) || 1) * baseScale * safeZoom;
  const renderedHeight = Math.max(1, Number(sourceHeight) || 1) * baseScale * safeZoom;
  const maxX = Math.max(0, (renderedWidth - STORY_COVER_WIDTH) / 2);
  const maxY = Math.max(0, (renderedHeight - STORY_COVER_HEIGHT) / 2);

  return {
    zoom: safeZoom,
    x: clamp(x, -maxX, maxX),
    y: clamp(y, -maxY, maxY),
  };
}

export function getStoryCoverRenderRect({
  sourceWidth,
  sourceHeight,
  zoom = 1,
  x = 0,
  y = 0,
} = {}) {
  const transform = clampStoryCoverTransform({ sourceWidth, sourceHeight, zoom, x, y });
  const baseScale = getStoryCoverBaseScale(sourceWidth, sourceHeight);
  const width = Math.max(1, Number(sourceWidth) || 1) * baseScale * transform.zoom;
  const height = Math.max(1, Number(sourceHeight) || 1) * baseScale * transform.zoom;

  return {
    ...transform,
    width,
    height,
    left: (STORY_COVER_WIDTH - width) / 2 + transform.x,
    top: (STORY_COVER_HEIGHT - height) / 2 + transform.y,
  };
}

export function storyCoverHasNativeResolution(sourceWidth, sourceHeight) {
  return getStoryCoverBaseScale(sourceWidth, sourceHeight) <= 1;
}

export function readStoryCoverFile(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) {
      reject(new Error("Escolha um arquivo de imagem JPG, PNG ou WebP."));
      return;
    }

    if (file.size > STORY_COVER_MAX_FILE_BYTES) {
      reject(new Error("Escolha uma imagem com até 20 MB."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}
