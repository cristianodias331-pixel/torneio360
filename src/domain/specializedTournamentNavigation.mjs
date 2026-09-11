// Adapt specialized screens to the platform's existing URL and saved-tab keys.
// These helpers only describe navigation; tournament data is never changed.
export function reiDoSolTabFromNavigation(tournamentTab, matchesTab) {
  if (tournamentTab === "ranking") return "ranking";
  if (tournamentTab === "partidas") return matchesTab === "chaves" ? "finals" : "qualifying";
  return "organization";
}

export function reiDoSolNavigationFromTab(tab, matchesTab = "grupos") {
  if (tab === "qualifying") return { tournamentTab: "partidas", matchesTab: "grupos" };
  if (tab === "finals") return { tournamentTab: "partidas", matchesTab: "chaves" };
  return { tournamentTab: tab === "ranking" ? "ranking" : "participantes", matchesTab };
}

const teamCupTabs = Object.freeze({ teams: "participantes", groups: "grupos", games: "partidas", ranking: "ranking" });
const teamCupMatchTabs = Object.freeze({ groups: "grupos", main: "chaves", repechage: "paralela" });

export function teamCupTabFromNavigation(tab) {
  return Object.keys(teamCupTabs).find(key => teamCupTabs[key] === tab) || "teams";
}

export function teamCupNavigationFromTab(tab) {
  return Object.hasOwn(teamCupTabs, tab) ? teamCupTabs[tab] : "participantes";
}

export function teamCupMatchesTabFromNavigation(tab, parallelEnabled = true) {
  if (tab === "paralela" && !parallelEnabled) return "main";
  return Object.keys(teamCupMatchTabs).find(key => teamCupMatchTabs[key] === tab) || "groups";
}

export function teamCupNavigationFromMatchesTab(tab) {
  return Object.hasOwn(teamCupMatchTabs, tab) ? teamCupMatchTabs[tab] : "grupos";
}
