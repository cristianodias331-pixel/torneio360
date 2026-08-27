function mediaUrlKey(value) {
  try {
    const url = new URL(String(value || "").trim(), window.location.origin);
    return `${url.origin}${decodeURIComponent(url.pathname).replace(/\/+$/, "")}`.toLocaleLowerCase("pt-BR");
  } catch {
    return String(value || "").trim().split(/[?#]/, 1)[0].toLocaleLowerCase("pt-BR");
  }
}

function loadImageSample(url) {
  return new Promise((resolve) => {
    if (!url || typeof Image === "undefined" || typeof document === "undefined") {
      resolve(null);
      return;
    }
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 12;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        resolve({ pixels, ratio: image.naturalWidth / Math.max(1, image.naturalHeight) });
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function samplesMatch(first, second) {
  if (!first || !second || first.pixels.length !== second.pixels.length) return false;
  const ratioDelta = Math.abs(first.ratio - second.ratio) / Math.max(first.ratio, second.ratio, 1);
  if (ratioDelta > 0.035) return false;
  let difference = 0;
  let compared = 0;
  for (let index = 0; index < first.pixels.length; index += 4) {
    difference += Math.abs(first.pixels[index] - second.pixels[index]);
    difference += Math.abs(first.pixels[index + 1] - second.pixels[index + 1]);
    difference += Math.abs(first.pixels[index + 2] - second.pixels[index + 2]);
    compared += 3;
  }
  return difference / Math.max(1, compared) <= 7;
}

export async function excludeOrganizationCoverFromGallery(photoUrls = [], coverUrl = "") {
  const photos = (Array.isArray(photoUrls) ? photoUrls : []).filter(Boolean);
  if (!coverUrl) return photos;
  const coverKey = mediaUrlKey(coverUrl);
  const exactFiltered = photos.filter((photoUrl) => mediaUrlKey(photoUrl) !== coverKey);
  if (!exactFiltered.length) return [];

  const coverSample = await loadImageSample(coverUrl);
  if (!coverSample) return exactFiltered;
  const samples = await Promise.all(exactFiltered.map((photoUrl) => loadImageSample(photoUrl)));
  return exactFiltered.filter((_, index) => !samplesMatch(coverSample, samples[index]));
}
