export const EVENT_MEDIA_BUCKET = "event-media";

function getDataUrlMetadata(dataUrl) {
  const match = /^data:([^;,]+);base64,(.+)$/i.exec(String(dataUrl || ""));
  if (!match) return null;
  return { mimeType: match[1].toLowerCase(), base64: match[2] };
}

function decodeBase64(base64) {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function getImageExtension(mimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function createMediaPath(userId, kind, extension) {
  const randomPart = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const safeKind = String(kind || "image").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  return `${userId}/${safeKind}/${randomPart}.${extension}`;
}

async function uploadDataUrl({ supabase, userId, dataUrl, kind }) {
  const metadata = getDataUrlMetadata(dataUrl);
  if (!metadata) return { publicUrl: String(dataUrl || ""), path: "" };
  if (!userId) throw new Error("Usuário não identificado para enviar a imagem.");

  const path = createMediaPath(userId, kind, getImageExtension(metadata.mimeType));
  const file = new Blob([decodeBase64(metadata.base64)], { type: metadata.mimeType });
  const { error } = await supabase.storage
    .from(EVENT_MEDIA_BUCKET)
    .upload(path, file, {
      cacheControl: "31536000",
      contentType: metadata.mimeType,
      upsert: false,
    });
  if (error) throw error;

  const { data } = supabase.storage.from(EVENT_MEDIA_BUCKET).getPublicUrl(path);
  const publicUrl = String(data?.publicUrl || "");
  if (!publicUrl) throw new Error("O endereço público da imagem não foi gerado.");
  return { publicUrl, path };
}

export async function uploadPreparedImagePair({ supabase, userId, imageUrl, thumbnailUrl, kind = "event-cover" }) {
  const uploadedPaths = [];
  try {
    const image = await uploadDataUrl({ supabase, userId, dataUrl: imageUrl, kind });
    if (image.path) uploadedPaths.push(image.path);
    const thumbnail = await uploadDataUrl({
      supabase,
      userId,
      dataUrl: thumbnailUrl,
      kind: `${kind}-thumbnail`,
    });
    if (thumbnail.path) uploadedPaths.push(thumbnail.path);
    return { imageUrl: image.publicUrl, thumbnailUrl: thumbnail.publicUrl };
  } catch (error) {
    if (uploadedPaths.length > 0) {
      try {
        await supabase.storage.from(EVENT_MEDIA_BUCKET).remove(uploadedPaths);
      } catch {
        // A limpeza é uma proteção auxiliar e não esconde a falha original.
      }
    }
    throw error;
  }
}

export async function uploadProfilePhoto({ supabase, userId, photoUrl }) {
  const uploaded = await uploadDataUrl({
    supabase,
    userId,
    dataUrl: photoUrl,
    kind: "profile-photo",
  });
  return uploaded.publicUrl;
}

export async function uploadMemberProfilePhoto({ supabase, userId, photoUrl }) {
  const uploaded = await uploadDataUrl({
    supabase,
    userId,
    dataUrl: photoUrl,
    kind: "member-profile-photo",
  });
  return uploaded.publicUrl;
}

export async function uploadMemberProfileCover({ supabase, userId, coverUrl }) {
  const uploaded = await uploadDataUrl({
    supabase,
    userId,
    dataUrl: coverUrl,
    kind: "member-profile-cover",
  });
  return uploaded.publicUrl;
}
