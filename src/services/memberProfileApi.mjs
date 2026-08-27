import {
  normalizeMemberProfile,
  toMemberProfileRpcPayload,
} from "../domain/memberProfile.mjs";

function isUnavailableSchemaError(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLocaleLowerCase("pt-BR");
  return code === "PGRST202"
    || code === "42883"
    || code === "42P01"
    || message.includes("get_my_member_profile")
    || message.includes("upsert_my_member_profile")
    || message.includes("replace_my_member_profile_photos")
    || message.includes("get_public_member_profile")
    || message.includes("member_profiles");
}

export async function loadMyMemberProfile({ supabase, fallback }) {
  const { data, error } = await supabase.rpc("get_my_member_profile");
  if (error) {
    if (isUnavailableSchemaError(error)) {
      return { profile: normalizeMemberProfile(null, fallback), schemaAvailable: false };
    }
    throw error;
  }

  return {
    profile: normalizeMemberProfile(data, fallback),
    schemaAvailable: true,
  };
}

export async function saveMyMemberProfile({ supabase, profile, fallback }) {
  const { data, error } = await supabase.rpc(
    "upsert_my_member_profile",
    toMemberProfileRpcPayload(profile)
  );

  if (error) {
    if (isUnavailableSchemaError(error)) {
      return { profile: normalizeMemberProfile(profile, fallback), schemaAvailable: false };
    }
    throw error;
  }

  const { data: galleryData, error: galleryError } = await supabase.rpc(
    "replace_my_member_profile_photos",
    { p_photo_urls: profile.galleryPhotos || [] }
  );

  if (galleryError) {
    if (isUnavailableSchemaError(galleryError)) {
      return { profile: normalizeMemberProfile(profile, fallback), schemaAvailable: false };
    }
    throw galleryError;
  }

  return {
    profile: normalizeMemberProfile({
      ...data,
      gallery_photos: galleryData,
    }, fallback),
    schemaAvailable: true,
  };
}

export async function loadPublicMemberProfile({ supabase, identifier }) {
  const { data, error } = await supabase.rpc("get_public_member_profile", {
    p_identifier: String(identifier || "").trim(),
  });

  if (error) {
    if (isUnavailableSchemaError(error)) return { profile: null, schemaAvailable: false };
    throw error;
  }

  if (!data?.profile) return { profile: null, schemaAvailable: true };

  return {
    profile: normalizeMemberProfile(data.profile),
    organization: data.organization || null,
    schemaAvailable: true,
  };
}

export async function loadPublicMemberPublications({ supabase, organizationId, limit = 6 }) {
  if (!organizationId) {
    return { tournaments: [], circuits: [], error: null };
  }

  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 6, 12));
  const loadKind = (kind) => supabase.rpc("list_public_arena_events_page", {
    p_organizer_id: organizationId,
    p_public_id: null,
    p_kind: kind,
    p_status: "active",
    p_limit: normalizedLimit,
    p_offset: 0,
  });

  const [tournamentsResult, circuitsResult] = await Promise.all([
    loadKind("tournaments"),
    loadKind("circuits"),
  ]);

  return {
    tournaments: Array.isArray(tournamentsResult.data?.items) ? tournamentsResult.data.items : [],
    circuits: Array.isArray(circuitsResult.data?.items) ? circuitsResult.data.items : [],
    error: tournamentsResult.error || circuitsResult.error || null,
  };
}

export async function fetchPublicMemberDirectory({
  supabase,
  search = "",
  limit = 24,
  cursor = null,
}) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 24, 48));
  const { data, error } = await supabase.rpc("list_public_member_profiles", {
    p_search: String(search || "").trim() || null,
    p_limit: normalizedLimit,
    p_after_sort_name: cursor?.sortName || null,
    p_after_user_id: cursor?.userId || null,
  });

  if (error) {
    return { items: [], hasMore: false, nextCursor: null, error };
  }

  const items = Array.isArray(data?.items) ? data.items : [];
  const nextCursor = data?.next_cursor?.user_id ? {
    userId: data.next_cursor.user_id,
    sortName: data.next_cursor.sort_name || "",
  } : null;

  return {
    items,
    hasMore: data?.has_more === true,
    nextCursor,
    error: null,
  };
}
