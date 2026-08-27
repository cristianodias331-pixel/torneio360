const REGULATIONS_BUCKET = "tournament-regulations";
export const MAX_REGULATIONS_PDF_SIZE = 10 * 1024 * 1024;

export function validateTournamentRegulationsPdf(file) {
  if (!file) return "Escolha o PDF do regulamento.";
  if (String(file.type || "").toLowerCase() !== "application/pdf") return "O regulamento deve ser enviado em PDF.";
  if (Number(file.size || 0) <= 0 || Number(file.size || 0) > MAX_REGULATIONS_PDF_SIZE) return "O PDF deve ter no máximo 10 MB.";
  return "";
}
export async function uploadTournamentRegulationsPdf({ supabase, userId, file }) {
  const errorMessage = validateTournamentRegulationsPdf(file);
  if (errorMessage) throw new Error(errorMessage);
  if (!userId) throw new Error("Organização não identificada.");
  const randomPart = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const path = `${userId}/regulamentos/${randomPart}.pdf`;
  const upload = await supabase.storage.from(REGULATIONS_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: "application/pdf",
    upsert: false,
  });
  if (upload.error) throw upload.error;
  const { data } = supabase.storage.from(REGULATIONS_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("O endereço público do regulamento não foi gerado.");
  return { url: data.publicUrl, path, name: file.name || "regulamento.pdf" };
}
