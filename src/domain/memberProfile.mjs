import { moderatePublicText } from "./contentModeration.mjs";

const maximumLengths = {
  displayName: 80,
  handle: 30,
  bio: 240,
  city: 80,
  state: 80,
  sportsCategory: 40,
};

const dominantHandOptions = new Set(["Destro", "Canhoto", "Ambidestro", "Não informado"]);
const shirtSizeOptions = new Set(["PP", "P", "M", "G", "GG", "XGG", "Não informado"]);

export const MAX_MEMBER_GALLERY_PHOTOS = 6;

function cleanText(value, maximumLength) {
  return String(value || "").trim().slice(0, maximumLength);
}

export function normalizeMemberHandle(value) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, "");
}

export function normalizeMemberGalleryPhotos(value) {
  const source = Array.isArray(value) ? value : [];
  return source
    .map((entry) => String(entry?.photo_url ?? entry?.photoUrl ?? entry ?? "").trim())
    .filter(Boolean)
    .slice(0, MAX_MEMBER_GALLERY_PHOTOS);
}

export function createMemberProfileFallback({ user, accessProfile } = {}) {
  const emailName = String(user?.email || "").split("@")[0];
  const metadataName = user?.user_metadata?.full_name || user?.user_metadata?.name || "";

  return {
    userId: user?.id || "",
    handle: "",
    displayName: cleanText(accessProfile?.name || metadataName || emailName || "Participante", maximumLengths.displayName),
    photoUrl: "",
    coverUrl: "",
    bio: "",
    city: "",
    state: "",
    sportsCategory: cleanText(user?.user_metadata?.sports_category || "", maximumLengths.sportsCategory),
    dominantHand: dominantHandOptions.has(user?.user_metadata?.dominant_hand) ? user.user_metadata.dominant_hand : "Não informado",
    shirtSize: shirtSizeOptions.has(user?.user_metadata?.shirt_size) ? user.user_metadata.shirt_size : "Não informado",
    galleryPhotos: [],
    followersCount: 0,
    isPublic: true,
  };
}

export function normalizeMemberProfile(row, fallback = {}) {
  return {
    userId: row?.user_id || row?.userId || fallback.userId || "",
    handle: normalizeMemberHandle(row?.handle ?? fallback.handle),
    displayName: cleanText(row?.display_name ?? row?.displayName ?? fallback.displayName, maximumLengths.displayName),
    photoUrl: String(row?.photo_url ?? row?.photoUrl ?? fallback.photoUrl ?? "").trim(),
    coverUrl: String(row?.cover_url ?? row?.coverUrl ?? fallback.coverUrl ?? "").trim(),
    bio: cleanText(row?.bio ?? fallback.bio, maximumLengths.bio),
    city: cleanText(row?.city ?? fallback.city, maximumLengths.city),
    state: cleanText(row?.state ?? fallback.state, maximumLengths.state),
    sportsCategory: cleanText(row?.sports_category ?? row?.sportsCategory ?? fallback.sportsCategory, maximumLengths.sportsCategory),
    dominantHand: dominantHandOptions.has(row?.dominant_hand ?? row?.dominantHand)
      ? (row?.dominant_hand ?? row?.dominantHand)
      : dominantHandOptions.has(fallback.dominantHand) ? fallback.dominantHand : "Não informado",
    shirtSize: shirtSizeOptions.has(row?.shirt_size ?? row?.shirtSize)
      ? (row?.shirt_size ?? row?.shirtSize)
      : shirtSizeOptions.has(fallback.shirtSize) ? fallback.shirtSize : "Não informado",
    galleryPhotos: normalizeMemberGalleryPhotos(
      row?.gallery_photos ?? row?.galleryPhotos ?? fallback.galleryPhotos
    ),
    followersCount: Math.max(0, Number(row?.followers_count ?? row?.followersCount ?? fallback.followersCount) || 0),
    isPublic: true,
  };
}

export function getMemberProfileInitials(profile) {
  return String(profile?.displayName || "T3")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("pt-BR"))
    .join("") || "T3";
}

export function validateMemberProfile(profile) {
  const normalized = normalizeMemberProfile(profile);
  const errors = {};
  const requestedGalleryPhotos = Array.isArray(profile?.galleryPhotos)
    ? profile.galleryPhotos.filter((entry) => String(entry || "").trim())
    : [];

  if (normalized.displayName.length < 2) {
    errors.displayName = "Informe um nome com pelo menos 2 caracteres.";
  } else if (!moderatePublicText(normalized.displayName).allowed) {
    errors.displayName = "Este nome contém conteúdo não permitido.";
  }

  if (normalized.handle && !/^[a-z0-9._]{3,30}$/.test(normalized.handle)) {
    errors.handle = "Use de 3 a 30 caracteres: letras minúsculas, números, ponto ou sublinhado.";
  }

  if (requestedGalleryPhotos.length > MAX_MEMBER_GALLERY_PHOTOS) {
    errors.galleryPhotos = `Escolha no máximo ${MAX_MEMBER_GALLERY_PHOTOS} fotos.`;
  }

  if (!moderatePublicText(normalized.bio).allowed) {
    errors.bio = "A apresentação contém conteúdo não permitido.";
  }

  if (!moderatePublicText(normalized.sportsCategory).allowed) {
    errors.sportsCategory = "A categoria contém conteúdo não permitido.";
  }

  return { valid: Object.keys(errors).length === 0, errors, profile: normalized };
}

export function toMemberProfileRpcPayload(profile) {
  const normalized = normalizeMemberProfile(profile);
  return {
    p_display_name: normalized.displayName,
    p_handle: normalized.handle || null,
    p_photo_url: normalized.photoUrl,
    p_cover_url: normalized.coverUrl,
    p_bio: normalized.bio,
    p_city: normalized.city,
    p_state: normalized.state,
    p_is_public: true,
  };
}
