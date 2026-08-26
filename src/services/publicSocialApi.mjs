function normalizePhotoList(value) {
  return (Array.isArray(value) ? value : [])
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .slice(0, 6);
}

export async function fetchPublicTournamentFeed({ supabase, limit = 12, cursor = null } = {}) {
  const { data, error } = await supabase.rpc("list_public_tournament_feed", {
    p_limit: Math.max(1, Math.min(Number(limit) || 12, 30)),
    p_before_updated_at: cursor?.updatedAt || null,
    p_before_id: cursor?.id || null,
  });

  if (error) return { items: [], hasMore: false, nextCursor: null, error };

  return {
    items: Array.isArray(data?.items) ? data.items : [],
    hasMore: data?.has_more === true,
    nextCursor: data?.next_cursor?.id ? {
      id: data.next_cursor.id,
      updatedAt: data.next_cursor.updated_at,
    } : null,
    error: null,
  };
}

export async function loadMyOrganizationGallery({ supabase }) {
  const { data, error } = await supabase.rpc("get_my_organization_profile_photos");
  if (error) throw error;
  return normalizePhotoList(data);
}

export async function saveMyOrganizationGallery({ supabase, photoUrls }) {
  const { data, error } = await supabase.rpc("replace_my_organization_profile_photos", {
    p_photo_urls: normalizePhotoList(photoUrls),
  });
  if (error) throw error;
  return normalizePhotoList(data);
}

export async function loadPublicOrganizationGallery({ supabase, organizationId }) {
  const { data, error } = await supabase.rpc("get_public_organization_profile_photos", {
    p_organization_id: organizationId,
  });
  if (error) return { photos: [], error };
  return { photos: normalizePhotoList(data), error: null };
}
