import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  reiDoSolTabFromNavigation,
  reiDoSolNavigationFromTab,
  teamCupTabFromNavigation,
  teamCupNavigationFromTab,
  teamCupMatchesTabFromNavigation,
  teamCupNavigationFromMatchesTab,
} from "../src/domain/specializedTournamentNavigation.mjs";

for (const [tab, tournamentTab, matchesTab] of [
  ["organization", "participantes", "grupos"],
  ["qualifying", "partidas", "grupos"],
  ["finals", "partidas", "chaves"],
  ["ranking", "ranking", "grupos"],
]) {
  assert.deepEqual(reiDoSolNavigationFromTab(tab), { tournamentTab, matchesTab });
  assert.equal(reiDoSolTabFromNavigation(tournamentTab, matchesTab), tab);
}
for (const tab of ["organization", "ranking"]) {
  assert.equal(reiDoSolNavigationFromTab(tab, "chaves").matchesTab, "chaves", "Leaving matches preserves the previous phase");
}
assert.equal(reiDoSolTabFromNavigation("unknown", "chaves"), "organization");
assert.equal(reiDoSolTabFromNavigation("partidas", "unknown"), "qualifying");
assert.deepEqual(reiDoSolNavigationFromTab("unknown"), { tournamentTab: "participantes", matchesTab: "grupos" });

for (const [tab, navigation] of Object.entries({ teams: "participantes", groups: "grupos", games: "partidas", ranking: "ranking" })) {
  assert.equal(teamCupNavigationFromTab(tab), navigation);
  assert.equal(teamCupTabFromNavigation(navigation), tab);
}
for (const [tab, navigation] of Object.entries({ groups: "grupos", main: "chaves", repechage: "paralela" })) {
  assert.equal(teamCupNavigationFromMatchesTab(tab), navigation);
  assert.equal(teamCupMatchesTabFromNavigation(navigation, true), tab);
}
assert.equal(teamCupMatchesTabFromNavigation("paralela", false), "main", "Hidden parallel phase returns to the main finals");
for (const invalid of [undefined, "unknown", "toString", "__proto__"]) {
  assert.equal(teamCupTabFromNavigation(invalid), "teams");
  assert.equal(teamCupNavigationFromTab(invalid), "participantes");
  assert.equal(teamCupMatchesTabFromNavigation(invalid), "groups");
  assert.equal(teamCupNavigationFromMatchesTab(invalid), "grupos");
}

// The existing parent owns URL/storage persistence. A Rei stage transition
// must save its two canonical keys in one call, not separate stale updates.
const organizer = readFileSync(new URL("../src/OrganizerWorkspace.jsx", import.meta.url), "utf8");
const stageHandler = organizer.match(/function setReiDoSolTab\(tab\) \{([\s\S]*?)\n  \}/)?.[1] || "";
assert.equal((stageHandler.match(/updateTournamentUrl\(/g) || []).length, 1);
assert.match(stageHandler, /setActiveTournamentTabState\(next\.tournamentTab\)/);
assert.match(stageHandler, /setActiveMatchesTabState\(next\.matchesTab\)/);
assert.match(stageHandler, /updateTournamentUrl\(\{ activeTournamentTab: next\.tournamentTab, activeMatchesTab: next\.matchesTab \}\)/);
assert.match(organizer, /if \(config\.type === "teamCup"\) \{\s*if \(activeMatchesTab === "paralela" && !data\.cupConfig\?\.repechageEnabled\) \{\s*setActiveMatchesTab\("chaves"\);\s*\}\s*return;/);
console.log("Specialized tournament navigation checks passed.");
