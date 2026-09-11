import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { createInitialData } from "../src/domain/tournamentDataNormalization.mjs";
import { modalityConfig } from "../src/domain/modalityConfig.mjs";
import { makeExample, phaseRanking } from "../src/domain/reiDoSol.mjs";
import { applyReiDoSolState, resizeReiDoSol } from "../src/domain/reiDoSolData.mjs";
import { generateTeamCupGroups, generateTeamCupBrackets } from "../src/domain/teamCup.mjs";
import { fixture, finishGroups } from "./team-cup-check.mjs";

const textOf = html => html.replace(/<[^>]*>/g, "").trim();
const buttons = html => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
  .map(([, attributes, contents]) => ({ attributes, text: textOf(contents) }));
const disabled = button => /(?:^|\s)disabled(?:=|\s|$)/.test(button.attributes);
const generateButtons = html => buttons(html).filter(button => /^Gerar fase final(?: novamente)?$/.test(button.text));
function activeNavButton(html, className) {
  const nav = [...html.matchAll(/<nav\b([^>]*)>([\s\S]*?)<\/nav>/g)]
    .find(([, attributes]) => new RegExp(`class="[^"]*\\b${className}\\b`).test(attributes));
  assert.ok(nav, `${className} exists`);
  const active = buttons(nav[2]).filter(button => /class="[^"]*\bactive\b/.test(button.attributes));
  assert.equal(active.length, 1, `${className} has exactly one active tab`);
  return active[0].text;
}
function assertEmbedded(html) {
  assert.doesNotMatch(html, /class="[^"]*\bappPage\b|tournamentWorkspaceHeader|tournamentTopTabs/, "Embedded content does not duplicate its parent shell");
}
const initial = createInitialData("Rei do Sol", modalityConfig["Rei do Sol"]);
const settledState = makeExample(20, 4, "finals");
assert.equal(phaseRanking(settledState.players, settledState.qualifying, 4, settledState.draws.qualifying).settled, true);
const settled = applyReiDoSolState(initial, { ...settledState, finals: [] });
const finals = applyReiDoSolState(initial, settledState);
const progress = applyReiDoSolState(initial, makeExample(20, 4, "progress"));
const tiedState = makeExample(20, 4, "qualifying");
tiedState.qualifying.flat().forEach(game => { game.s1 = "4"; game.s2 = "0"; });
const tiedRanking = phaseRanking(tiedState.players, tiedState.qualifying, 4);
assert.equal(tiedRanking.complete, true);
assert.ok(tiedRanking.pending.length > 0);
const tied = applyReiDoSolState(initial, tiedState);
const server = await createServer({ configFile: false, logLevel: "error", server: { middlewareMode: true, hmr: false }, appType: "custom" });
try {
  const { default: Rei } = await server.ssrLoadModule("/src/features/reiDoSol/ReiDoSolWorkspace.jsx");
  const { default: Team, TeamCupMatchCard } = await server.ssrLoadModule("/src/features/teamCup/TeamCupWorkspace.jsx");
  const render = (Component, data, extra = {}) => {
    const before = JSON.stringify(data);
    const html = renderToStaticMarkup(React.createElement(Component, {
      data, tournament: { id: "ui-check", name: "Torneio de teste" },
      setData: () => { throw new Error("Rendering cannot change tournament data"); }, ...extra,
    }));
    assert.equal(JSON.stringify(data), before, "Changing the displayed panel preserves all tournament data");
    return html;
  };

  // Generation is an action belonging to the final phase, never qualifying.
  for (const [data, canGenerate, hasFinals] of [[initial, false, false], [progress, false, false], [tied, false, false], [settled, true, false], [finals, true, true]]) {
    for (const tab of ["organization", "qualifying", "finals", "ranking"]) {
      const html = render(Rei, data, { activeTab: tab });
      const generation = generateButtons(html);
      assert.equal(generation.length, tab === "finals" ? 1 : 0, `Generation appears only in finals, not ${tab}`);
      if (tab === "finals") {
        assert.equal(disabled(generation[0]), !canGenerate, "Finals require completed games and resolved ties");
        assert.equal(generation[0].text, hasFinals ? "Gerar fase final novamente" : "Gerar fase final");
      }
      const publicHtml = render(Rei, data, { activeTab: tab, readOnly: true, embedded: true });
      assert.equal(generateButtons(publicHtml).length, 0, "Public viewers cannot generate or regenerate finals");
      assertEmbedded(publicHtml);
    }
  }

  for (const [tab, label] of [["organization", "Organização"], ["qualifying", "Classificatória"], ["finals", "Fase final"], ["ranking", "Ranking"]]) {
    const html = render(Rei, finals, { activeTab: tab });
    assert.equal(activeNavButton(html, "tournamentTopTabs"), label);
    assert.match(html, new RegExp(`<h2>${tab === "organization" ? "Organização do torneio" : tab === "ranking" ? "Campeões do Rei do Sol" : label}</h2>`));
  }
  const players = render(Rei, initial, { activeTab: "organization", activeOrganizationTab: "players" });
  assert.equal(activeNavButton(players, "organizationSubTabs"), "Participantes");
  assert.ok(buttons(players).some(button => button.text === "Colar lista"));
  assert.doesNotMatch(players, /id="rds-player-count"/);

  for (const count of [16, 19]) {
    const data = resizeReiDoSol(initial, count);
    const html = render(Rei, data, { activeTab: "organization", activeOrganizationTab: "format" });
    assert.equal(activeNavButton(html, "organizationSubTabs"), "Formato do torneio");
    assert.match(html, /<label for="rds-player-count">Quantidade de atletas<\/label>/);
    const input = html.match(/<input\b[^>]*id="rds-player-count"[^>]*>/)?.[0];
    assert.ok(input);
    for (const attribute of ['type="number"', 'inputMode="numeric"', 'min="16"', 'step="1"', 'aria-describedby="rds-count-help"', 'aria-invalid="false"', `value="${count}"`]) assert.ok(input.includes(attribute), attribute);
    assert.match(html, /<p id="rds-count-help">Mínimo de 16 atletas\./);
    const apply = buttons(html).filter(button => button.text === "Aplicar quantidade");
    assert.equal(apply.length, 1);
    assert.equal(disabled(apply[0]), true, "The current quantity cannot be applied again");
  }
  const invalidHtml = render(Rei, { ...initial, players: initial.players.slice(0, 15) }, { activeTab: "organization", activeOrganizationTab: "format" });
  assert.match(invalidHtml, /aria-invalid="true"/);
  assert.equal(disabled(buttons(invalidHtml).find(button => button.text === "Aplicar quantidade")), true);
  for (const invalid of [0, 15, 16.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => resizeReiDoSol(initial, invalid), /quantidade inteira/);
  }
  // SSR cannot type into local state; verify the matching UI guard remains in
  // addition to the rendered numeric constraints and tested domain validation.
  const reiSource = readFileSync(new URL("../src/features/reiDoSol/ReiDoSolWorkspace.jsx", import.meta.url), "utf8");
  assert.match(reiSource, /const countValid = Number\.isSafeInteger\(Number\(count\)\) && Number\(count\) >= 16/);
  assert.match(reiSource, /if \(!Number\.isSafeInteger\(quantity\) \|\| quantity < 16\) return tell/);

  for (const kind of ["trio", "squad"]) {
    const source = fixture(6, kind);
    source.cupConfig.repechageEnabled = true;
    const data = generateTeamCupBrackets(finishGroups(generateTeamCupGroups(source, () => .4)));
    for (const [tab, label] of [["teams", "Organização"], ["groups", "Grupos"], ["games", "Partidas"], ["ranking", "Ranking"]]) {
      const html = render(Team, data, { activeTab: tab });
      assert.equal(activeNavButton(html, "tournamentTopTabs"), label);
      assert.match(html, new RegExp(`<h2>${tab === "teams" ? "Organização do torneio" : label}</h2>`));
      assertEmbedded(render(Team, data, { activeTab: tab, readOnly: true, embedded: true }));
    }
    for (const [tab, label] of [["groups", "Fase de grupos"], ["main", "Chaves finais"], ["repechage", data.cupConfig.repechageName]]) {
      const html = render(Team, data, { activeTab: "games", activeMatchesTab: tab });
      assert.equal(activeNavButton(html, "matchesSubTabs"), label, "Controlled match phase overrides local default");
      assertEmbedded(render(Team, data, { activeTab: "games", activeMatchesTab: tab, readOnly: true, embedded: true }));
    }
    const html = render(Team, data, { activeTab: "teams", activeOrganizationTab: "players" });
    assert.equal(activeNavButton(html, "organizationSubTabs"), "Participantes");
    assert.ok(buttons(html).some(button => button.text === "Colar lista"));
    assert.doesNotMatch(html, /Quantidade de equipes/);
  }

  // Public mobile cards keep the established names-beside-scores layout.
  // Only their typography is reduced; the organizer retains its own controls.
  for (const kind of ["trio", "squad"]) {
    const source = fixture(6, kind);
    source.players.teams.forEach((team, teamIndex) => {
      team.name = `Equipe ${teamIndex + 1} de participantes com nomes completos`;
      team.athletes.forEach((athlete, index) => {
        athlete.name = `Participante ${teamIndex + 1} ${index + 1} com sobrenome de Almeida Albuquerque`;
      });
    });
    const data = generateTeamCupGroups(source, () => .4);
    const game = data.schedule[0][0];
    [[6, 2], [2, 6], [6, 3]].forEach(([first, second], index) => {
      game.teamCupLegs[index].s1 = String(first);
      game.teamCupLegs[index].s2 = String(second);
    });
    const before = JSON.stringify(data);
    const card = readOnly => renderToStaticMarkup(React.createElement(TeamCupMatchCard, {
      data, game, number: 1, round: "Grupo de teste", readOnly, now: 0,
      onLegChange: () => { throw new Error("Rendering cannot change a score"); },
    }));
    const publicCard = card(true);
    assert.match(publicCard, /class="[^"]*\btc-match\b[^\"]*\btc-match--public\b/);
    assert.doesNotMatch(publicCard, /tc-mobile-score-label/, "Scores stay beside names without repeated stacked-row labels");
    assert.match(publicCard, /class="tc-score-scroll"><div class="tc-score-table">/);
    assert.match(publicCard, /class="tc-score-heading tc-score-columns"><span>Equipes<\/span>/);
    assert.equal((publicCard.match(/class="matchTeamRow tc-score-columns/g) || []).length, 2, "Both teams retain the shared names-and-three-scores columns");
    assert.equal((publicCard.match(/class="tc-roster tc-roster-paired"/g) || []).length, 2);
    assert.equal((publicCard.match(/class="tc-roster-separator"/g) || []).length, kind === "squad" ? 4 : 2);
    assert.equal(buttons(publicCard).filter(button => button.attributes.includes('aria-label="Selecionar ')).length, 3, "All three set selectors remain usable publicly");
    assert.doesNotMatch(publicCard, /<input\b|<textarea\b|<select\b/);
    const scores = [...publicCard.matchAll(/<output class="matchScoreOutput"[^>]*>([^<]*)<\/output>/g)].map(([, value]) => value);
    assert.deepEqual(scores, ["6", "2", "6", "2", "6", "3"], "Responsive score grouping preserves set and team order");
    assert.equal((publicCard.match(/<output[^>]*aria-label="[^"]+ · [123]º set[^"]* · games"/g) || []).length, 6, "Score outputs keep accessible team and set descriptions");
    for (const id of [...game.ids1, ...game.ids2]) {
      const team = data.players.teams[id];
      assert.ok(publicCard.includes(team.name));
      for (const athlete of team.athletes) assert.ok(publicCard.includes(athlete.name + (athlete.id === team.captainId ? " (C)" : "")), "Full names and captain marker survive the mobile layout");
    }
    const organizerCard = card(false);
    assert.doesNotMatch(organizerCard, /tc-match--public|tc-mobile-score-label/, "Public mobile hooks do not change organizer cards");
    assert.equal((organizerCard.match(/class="matchScoreInput"/g) || []).length, 6);
    assert.match(organizerCard, /tc-roster-paired/);
    assert.equal(JSON.stringify(data), before);
  }
  // Bracket cards retain measured slots rather than fixed heights.
  // Browser geometry is checked separately; this protects the resize wiring.
  const bracketSource = readFileSync(new URL("../src/features/teamCup/TeamCupBracketView.jsx", import.meta.url), "utf8");
  assert.match(bracketSource, /querySelectorAll\("\.tc-match"\)/);
  assert.match(bracketSource, /Math\.max\(\.\.\.cards\.map\(card => card\.getBoundingClientRect\(\)\.height\)\)/);
  assert.match(bracketSource, /new ResizeObserver\(measure\)/);
  assert.match(bracketSource, /cards\.forEach\(card => observer\.observe\(card\)\)/);
  assert.match(bracketSource, /"--tc-bracket-node-height": `\$\{nodeHeight\}px`/);
  const teamCss = readFileSync(new URL("../src/features/teamCup/teamCup.css", import.meta.url), "utf8");
  assert.doesNotMatch(teamCss, /tc-mobile-score-label/);
  assert.match(teamCss, /\.tc-score-table\s*\{[^}]*grid-template-columns:\s*minmax\(max-content,\s*1fr\) repeat\(2,\s*52px\) 73px/);
  assert.match(teamCss, /\.tc-roster\.tc-roster-paired\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*max-content\)/);
  assert.match(teamCss, /\.tc-score-scroll\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(teamCss, /--bracket-node-height:\s*var\(--tc-bracket-node-height,\s*360px\)\s*!important/);
  const publicPhoneRules = teamCss.slice(teamCss.lastIndexOf("@media (max-width:760px)"));
  assert.match(publicPhoneRules, /^@media \(max-width:760px\)/);
  const publicBracketWrappers = new Set([
    ".tc-workspace.tc-embedded .tc-brackets .roundCard.bracketPlacementRound",
    ".tc-workspace.tc-embedded .tc-brackets .bracketColumn.bracketTree",
  ]);
  for (const [, selector] of publicPhoneRules.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    assert.ok(selector.includes(".tc-match--public") || publicBracketWrappers.has(selector.trim()), "Phone-card changes stay scoped to public cards and their two embedded bracket wrappers");
  }
  assert.match(publicPhoneRules, /\.tc-workspace\.tc-embedded \.tc-brackets \.roundCard\.bracketPlacementRound\s*\{\s*padding:\s*0\s*!important/);
  assert.match(publicPhoneRules, /@supports\s*\(width:\s*1cqi\)\s*\{\s*\.tc-workspace\.tc-embedded \.tc-brackets \.bracketColumn\.bracketTree\s*\{\s*container-type:\s*inline-size;\s*--bracket-round-width:\s*calc\(100cqi - 4px\)/);
  assert.doesNotMatch(publicPhoneRules, /\.(?:tc-score-scroll|tc-score-table|tc-score-columns|tc-team-identity|tc-roster-member|tc-roster-separator|matchScoreCell)\b/, "Public typography overrides do not replace the paired roster or score grid");
  assert.match(publicPhoneRules, /\.tc-roster(?:\.tc-roster-paired)?\s*\{[^}]*font-size:\s*12px/);
  assert.match(publicPhoneRules, /\.matchTeamName\s*\{[^}]*font-size:\s*12px/);
  assert.match(publicPhoneRules, /\.matchScoreOutput\s*\{[^}]*font-size:\s*13px/);
  assert.match(publicPhoneRules, /\.tc-score-heading button\s*\{[^}]*font-size:\s*11px/);
  assert.match(publicPhoneRules, /\.tc-set-detail(?:[^{}]*)\{[^}]*font-size:\s*8px/);
  const reiCss = readFileSync(new URL("../src/features/reiDoSol/reiDoSol.css", import.meta.url), "utf8");
  const reiPhoneRules = reiCss.slice(reiCss.lastIndexOf("@media (max-width: 640px)"));
  assert.match(reiPhoneRules, /^@media \(max-width: 640px\)/);
  const toolbarRules = new Map([...reiPhoneRules.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [selector.trim(), body]));
  const reiOrganizerScope = ".proDashboard .rds-workspace:not(.rds-embedded)";
  for (const selector of toolbarRules.keys()) assert.ok(selector.startsWith(reiOrganizerScope), "Rei toolbar fix excludes public embedded views and other modalities");
  assert.match(toolbarRules.get(`${reiOrganizerScope} .scheduleStatusFilters`) || "", /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  const searchRules = toolbarRules.get(`${reiOrganizerScope} .scheduleSearch`) || "";
  assert.match(searchRules, /flex:\s*0 0 auto\s*!important/);
  assert.match(searchRules, /height:\s*40px\s*!important/);
  assert.match(toolbarRules.get(`${reiOrganizerScope} .scheduleOverviewPrimary`) || "", /flex:\s*0 0 auto\s*!important/);
} finally { await server.close(); }
console.log("Specialized workspaces: controlled tabs, public/mobile cards, measured brackets, final-generation placement and quantity safeguards passed.");
