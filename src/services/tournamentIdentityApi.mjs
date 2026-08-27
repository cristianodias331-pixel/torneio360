function isUnavailableIdentityError(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLocaleLowerCase("pt-BR");
  return ["PGRST202", "42883", "42P01", "42703"].includes(code)
    || message.includes("tournament_athlete_identities");
}
export async function loadPublicTournamentAthleteIdentities({ supabase, tournamentId }) {
  if (!tournamentId) return { identities: [], schemaAvailable: true };
  const { data, error } = await supabase.rpc("get_public_tournament_athlete_identities", {
    p_tournament_id: tournamentId,
  });
  if (error) {
    if (isUnavailableIdentityError(error)) return { identities: [], schemaAvailable: false };
    throw error;
  }
  return { identities: Array.isArray(data) ? data : [], schemaAvailable: true };
}
