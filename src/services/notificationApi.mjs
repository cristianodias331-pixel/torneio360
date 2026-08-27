function isUnavailableNotificationError(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLocaleLowerCase("pt-BR");
  return ["PGRST202", "42883", "42P01", "42703"].includes(code)
    || message.includes("platform_notifications")
    || message.includes("partner_invitation");
}
export async function loadMyNotifications({ supabase, limit = 60 }) {
  const { data, error } = await supabase.rpc("list_my_platform_notifications", {
    p_limit: Math.max(1, Math.min(Number(limit) || 60, 100)),
  });
  if (error) {
    if (isUnavailableNotificationError(error)) return { notifications: [], schemaAvailable: false };
    throw error;
  }
  return { notifications: Array.isArray(data) ? data : [], schemaAvailable: true };
}

export async function markMyNotificationsRead({ supabase, notificationId = null }) {
  const { data, error } = await supabase.rpc("mark_my_platform_notifications_read", {
    p_notification_id: notificationId,
  });
  if (error) throw error;
  return Number(data || 0);
}

export async function respondToPartnerInvitation({ supabase, registrationId, decision }) {
  const { data, error } = await supabase.rpc("respond_to_tournament_partner_invitation", {
    p_registration_id: registrationId,
    p_decision: decision,
  });
  if (error) throw error;
  return data;
}
