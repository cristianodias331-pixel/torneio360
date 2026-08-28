const RESTORABLE_ORGANIZER_PANELS = new Set([
  "inicio",
  "notificacoes",
  "ajustes",
  "lixeira",
]);

const LEGACY_ORGANIZER_MANAGEMENT_PANELS = new Set([
  "criar",
  "circuitos",
  "modalidades",
]);

export function isLegacyOrganizerManagementPanel(value) {
  return LEGACY_ORGANIZER_MANAGEMENT_PANELS.has(String(value || "").trim());
}

export function normalizePersistedOrganizerPanel(value) {
  const requested = String(value || "").trim();
  if (RESTORABLE_ORGANIZER_PANELS.has(requested)) return requested;
  if (isLegacyOrganizerManagementPanel(requested)) return "ajustes";
  return "inicio";
}
