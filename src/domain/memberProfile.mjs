import { moderatePublicText } from "./contentModeration.mjs";

const maximumLengths = {
  displayName: 80,
  handle: 30,
  bio: 240,
  city: 80,
  state: 80,
  sportsCategory: 40,
  whatsapp: 20,
  telegram: 64,
  instagram: 64,
};

const dominantHandOptions = new Set(["Destro", "Canhoto", "Ambidestro", "Não informado"]);
const shirtSizeOptions = new Set(["PP", "P", "M", "G", "GG", "XGG", "Não informado"]);
const genderOptions = new Set(["Masculino", "Feminino"]);

export const MEMBER_SPORT_OPTIONS = Object.freeze([
  { value: "Beach Tennis", color: "#ff6b1a" },
  { value: "Vôlei", color: "#2f9dff" },
  { value: "Futevôlei", color: "#22c983" },
  { value: "Tênis", color: "#e6c91e" },
  { value: "Pickleball", color: "#a875ff" },
]);
const memberSports = new Set(MEMBER_SPORT_OPTIONS.map((sport) => sport.value));

export const MAX_MEMBER_GALLERY_PHOTOS = 10;

export function normalizeMemberGender(value) {
  const normalized = String(value || "").normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
  if (["masculino", "homem", "m"].includes(normalized)) return "Masculino";
  if (["feminino", "mulher", "f"].includes(normalized)) return "Feminino";
  return "";
}

function cleanText(value, maximumLength) {
  return String(value || "").trim().slice(0, maximumLength);
}

function normalizeSocialHandle(value, provider) {
  const source = String(value || "").trim();
  const withoutUrl = source
    .replace(/^https?:\/\/(?:www\.)?/i, "")
    .replace(provider === "telegram" ? /^(?:t\.me|telegram\.me)\//i : /^(?:instagram\.com)\//i, "")
    .replace(/[/?#].*$/, "");
  return withoutUrl.replace(/^@+/, "");
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

export function normalizeMemberSports(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || "").split(",");
  return [...new Set(source.map((entry) => String(entry || "").trim()))]
    .filter((entry) => memberSports.has(entry))
    .slice(0, MEMBER_SPORT_OPTIONS.length);
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
    sports: normalizeMemberSports(user?.user_metadata?.sports).length
      ? normalizeMemberSports(user?.user_metadata?.sports)
      : ["Beach Tennis"],
    gender: normalizeMemberGender(user?.user_metadata?.gender || user?.user_metadata?.sex),
    dominantHand: dominantHandOptions.has(user?.user_metadata?.dominant_hand) ? user.user_metadata.dominant_hand : "Não informado",
    shirtSize: shirtSizeOptions.has(user?.user_metadata?.shirt_size) ? user.user_metadata.shirt_size : "Não informado",
    whatsapp: "",
    telegram: "",
    instagram: "",
    showContacts: false,
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
    sports: normalizeMemberSports(row?.sports ?? fallback.sports).length
      ? normalizeMemberSports(row?.sports ?? fallback.sports)
      : ["Beach Tennis"],
    gender: normalizeMemberGender(row?.gender ?? fallback.gender),
    dominantHand: dominantHandOptions.has(row?.dominant_hand ?? row?.dominantHand)
      ? (row?.dominant_hand ?? row?.dominantHand)
      : dominantHandOptions.has(fallback.dominantHand) ? fallback.dominantHand : "Não informado",
    shirtSize: shirtSizeOptions.has(row?.shirt_size ?? row?.shirtSize)
      ? (row?.shirt_size ?? row?.shirtSize)
      : shirtSizeOptions.has(fallback.shirtSize) ? fallback.shirtSize : "Não informado",
    whatsapp: String(row?.whatsapp ?? fallback.whatsapp ?? "").replace(/[^0-9+]/g, "").slice(0, maximumLengths.whatsapp),
    telegram: normalizeSocialHandle(row?.telegram ?? fallback.telegram, "telegram").slice(0, maximumLengths.telegram),
    instagram: normalizeSocialHandle(row?.instagram ?? fallback.instagram, "instagram").slice(0, maximumLengths.instagram),
    showContacts: Boolean(row?.show_contacts ?? row?.showContacts ?? fallback.showContacts),
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
  const requestedSports = Array.isArray(profile?.sports) ? normalizeMemberSports(profile.sports) : normalized.sports;
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
  if (!requestedSports.length) {
    errors.sports = "Escolha pelo menos uma modalidade esportiva.";
  }
  if (!genderOptions.has(normalized.gender)) {
    errors.gender = "Selecione a categoria esportiva do atleta para validar inscrições e duplas mistas.";
  }

  if (normalized.whatsapp && !/^\+?[0-9]{10,15}$/.test(normalized.whatsapp)) {
    errors.whatsapp = "Informe o WhatsApp com DDD e apenas números.";
  }
  if (normalized.telegram && !/^[a-zA-Z0-9_]{5,64}$/.test(normalized.telegram)) {
    errors.telegram = "Informe apenas o nome de usuário do Telegram.";
  }
  if (normalized.instagram && !/^[a-zA-Z0-9._]{1,64}$/.test(normalized.instagram)) {
    errors.instagram = "Informe apenas o nome de usuário do Instagram.";
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
    p_sports_category: normalized.sportsCategory,
    p_sports: normalized.sports,
    p_gender: normalized.gender,
    p_dominant_hand: normalized.dominantHand,
    p_shirt_size: normalized.shirtSize,
    p_whatsapp: normalized.whatsapp,
    p_telegram: normalized.telegram,
    p_instagram: normalized.instagram,
    p_show_contacts: normalized.showContacts,
  };
}
