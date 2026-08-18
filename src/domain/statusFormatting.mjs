export function formatStatusBR(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "active") return "ATIVO";
  if (normalized === "inactive") return "INATIVO";
  if (normalized === "blocked") return "BLOQUEADO";
  if (normalized === "pending") return "PENDENTE";
  if (normalized === "expired") return "VENCIDO";
  return String(value || "").toUpperCase();
}

export function normalizeCircuitStatus(status) {
  return status === "finished" || status === "closed" || status === "archived" ? "closed" : "active";
}
