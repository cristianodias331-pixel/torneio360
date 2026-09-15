import { normalizeCircuitTournamentIds } from "./circuitDirectory.mjs";
import { isTournamentSummary } from "./tournamentSummary.mjs";

// A seleção antiga pode conter IDs purgados da lixeira. Uma falha de leitura
// nunca prova exclusão: só o sinal de DELETE do banco permite retirar o vínculo.
export async function resolveCircuitTournamentSelection({
  tournamentIds,
  previousTournamentIds = [],
  loadFullTournamentRows,
  supabase,
  userId,
}) {
  const selectedIds = normalizeCircuitTournamentIds(tournamentIds);
  const selectedSet = new Set(selectedIds);
  const fullRows = (await loadFullTournamentRows(selectedIds, { silentError: true }))
    .filter((row) => selectedSet.has(String(row.id)) && !isTournamentSummary(row));
  const loadedIds = new Set(fullRows.map((row) => String(row.id)));
  const missingIds = selectedIds.filter((id) => !loadedIds.has(id));
  const previousIds = new Set(normalizeCircuitTournamentIds(previousTournamentIds));
  const legacyMissingIds = missingIds.filter((id) => previousIds.has(id));
  let removedTournamentIds = [];

  if (legacyMissingIds.length && userId) {
    try {
      const { data, error } = await supabase
        .from("tournament_change_feed")
        .select("tournament_id, deleted")
        .eq("user_id", userId)
        .in("tournament_id", legacyMissingIds);
      if (!error && Array.isArray(data)) {
        const deletedIds = new Set(data
          .filter((row) => row.deleted === true)
          .map((row) => String(row.tournament_id)));
        removedTournamentIds = legacyMissingIds.filter((id) => deletedIds.has(id));
      }
    } catch {
      // Sem confirmação, preserva todos os vínculos e bloqueia o recálculo.
    }
  }

  const removedIds = new Set(removedTournamentIds);
  return {
    tournamentIds: selectedIds.filter((id) => !removedIds.has(id)),
    fullRows,
    removedTournamentIds,
    missingTournamentIds: missingIds.filter((id) => !removedIds.has(id)),
  };
}
