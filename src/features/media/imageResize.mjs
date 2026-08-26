export function resizeImageFile(file, {
  maxWidth = 1400,
  maxHeight = 900,
  quality = 0.84,
  outputType = "image/jpeg",
} = {}) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) {
      reject(new Error("Escolha um arquivo de imagem."));
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("Escolha uma imagem com até 8 MB."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("A imagem escolhida não pôde ser aberta."));
      image.onload = () => {
        const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Não foi possível preparar a imagem."));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(outputType, quality));
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

export const SOCIAL_POST_SQUARE = Object.freeze({ width: 1080, height: 1080, label: "1:1" });
export const SOCIAL_POST_PORTRAIT = Object.freeze({ width: 1080, height: 1350, label: "4:5" });

export function prepareSocialPostImageFile(file, { quality = 0.86 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) {
      reject(new Error("Escolha um arquivo de imagem."));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("Escolha uma imagem com até 8 MB."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("A imagem escolhida não pôde ser aberta."));
      image.onload = () => {
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;
        const sourceRatio = sourceWidth / Math.max(1, sourceHeight);
        const format = sourceRatio < 0.92 ? SOCIAL_POST_PORTRAIT : SOCIAL_POST_SQUARE;
        const canvas = document.createElement("canvas");
        canvas.width = format.width;
        canvas.height = format.height;
        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Não foi possível preparar a imagem."));
          return;
        }

        const coverScale = Math.max(format.width / sourceWidth, format.height / sourceHeight);
        const coverWidth = sourceWidth * coverScale;
        const coverHeight = sourceHeight * coverScale;
        const containScale = Math.min(format.width / sourceWidth, format.height / sourceHeight);
        const containWidth = sourceWidth * containScale;
        const containHeight = sourceHeight * containScale;

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.fillStyle = "#0b1728";
        context.fillRect(0, 0, format.width, format.height);
        context.save();
        context.filter = "blur(34px) brightness(0.55) saturate(0.86)";
        context.drawImage(
          image,
          (format.width - coverWidth) / 2 - 40,
          (format.height - coverHeight) / 2 - 40,
          coverWidth + 80,
          coverHeight + 80
        );
        context.restore();
        context.fillStyle = "rgba(4, 12, 24, 0.12)";
        context.fillRect(0, 0, format.width, format.height);
        context.drawImage(
          image,
          (format.width - containWidth) / 2,
          (format.height - containHeight) / 2,
          containWidth,
          containHeight
        );

        resolve({
          imageUrl: canvas.toDataURL("image/webp", quality),
          format: format.label,
          width: format.width,
          height: format.height,
        });
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}
