function isUnavailablePaymentSettingsError(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLocaleLowerCase("pt-BR");
  return code === "PGRST202"
    || code === "42883"
    || code === "42P01"
    || code === "42703"
    || message.includes("organization_payment_settings")
    || message.includes("pix_key")
    || message.includes("card_payment_link");
}

function normalizeSettings(value, fallback = {}) {
  const row = Array.isArray(value) ? value[0] : value;
  return {
    pixKey: String(row?.pix_key ?? row?.pixKey ?? fallback.pixKey ?? "").trim(),
    cardPaymentLink: String(row?.card_payment_link ?? row?.cardPaymentLink ?? fallback.cardPaymentLink ?? "").trim(),
    schemaAvailable: row?.schemaAvailable ?? fallback.schemaAvailable ?? true,
  };
}

export async function loadMyOrganizationPaymentSettings({ supabase, fallback = {} }) {
  const { data, error } = await supabase.rpc("get_my_organization_payment_settings");
  if (!error) return normalizeSettings(data, { ...fallback, schemaAvailable: true });
  if (!isUnavailablePaymentSettingsError(error)) throw error;
  return normalizeSettings(null, { ...fallback, schemaAvailable: false });
}

export async function saveMyOrganizationPaymentSettings({ supabase, pixKey, cardPaymentLink }) {
  const fallback = { pixKey, cardPaymentLink, schemaAvailable: false };
  const { data, error } = await supabase.rpc("save_my_organization_payment_settings", {
    p_pix_key: String(pixKey || "").trim(),
    p_card_payment_link: String(cardPaymentLink || "").trim(),
  });
  if (!error) return normalizeSettings(data, { ...fallback, schemaAvailable: true });
  if (isUnavailablePaymentSettingsError(error)) return normalizeSettings(null, fallback);
  throw error;
}

export async function loadPublicOrganizationPaymentSettings({ supabase, organizationId, fallback = {} }) {
  if (!organizationId) return normalizeSettings(null, { ...fallback, schemaAvailable: false });
  const { data, error } = await supabase.rpc("get_public_organization_payment_settings", {
    p_organization_id: organizationId,
  });
  if (!error) return normalizeSettings(data, { ...fallback, schemaAvailable: true });
  if (!isUnavailablePaymentSettingsError(error)) throw error;
  return normalizeSettings(null, { ...fallback, schemaAvailable: false });
}

export function getSafePaymentLink(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

