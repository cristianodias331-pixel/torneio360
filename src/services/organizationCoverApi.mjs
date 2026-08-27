function isMissingOrganizationCoverSchema(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLocaleLowerCase("pt-BR");
  return message.includes("get_my_organization_profile_cover")
    || message.includes("set_my_organization_profile_cover")
    || message.includes("cover_url")
    || message.includes("schema cache")
    || message.includes("does not exist");
}

function normalizeCoverUrl(value, fallback = "") {
  return String(value ?? fallback ?? "").trim();
}

export async function loadMyOrganizationCover({ supabase, fallback = "" }) {
  const { data, error } = await supabase.rpc("get_my_organization_profile_cover");
  if (error) {
    if (isMissingOrganizationCoverSchema(error)) {
      return { coverUrl: normalizeCoverUrl(fallback), schemaAvailable: false };
    }
    throw error;
  }
  return {
    coverUrl: normalizeCoverUrl(data, fallback),
    schemaAvailable: true,
  };
}

export async function saveMyOrganizationCover({ supabase, coverUrl }) {
  const normalizedCoverUrl = normalizeCoverUrl(coverUrl);
  const { data, error } = await supabase.rpc("set_my_organization_profile_cover", {
    p_cover_url: normalizedCoverUrl,
  });
  if (error) {
    if (isMissingOrganizationCoverSchema(error)) {
      return { coverUrl: normalizedCoverUrl, schemaAvailable: false };
    }
    throw error;
  }
  return {
    coverUrl: normalizeCoverUrl(data, normalizedCoverUrl),
    schemaAvailable: true,
  };
}
