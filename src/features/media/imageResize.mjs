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
