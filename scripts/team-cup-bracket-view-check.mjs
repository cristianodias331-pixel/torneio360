import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { fixture, finishGroups } from "./team-cup-check.mjs";
import * as cup from "../src/domain/teamCup.mjs";
import { teamCupPodium } from "../src/domain/teamCupPodium.mjs";
import { prepareTeamCupFormation } from "../src/domain/teamCupOrganization.mjs";

const server = await createServer({ configFile: false, logLevel: "error", server: { middlewareMode: true, hmr: false }, appType: "custom" });
try {
  const { default: TeamCupBracketView } = await server.ssrLoadModule("/src/features/teamCup/TeamCupBracketView.jsx");
  const { TeamCupMatchCard } = await server.ssrLoadModule("/src/features/teamCup/TeamCupWorkspace.jsx");
  const { BracketColumn } = await server.ssrLoadModule("/src/features/brackets/CupBracketView.jsx");
  const { default: CupPodiumView } = await server.ssrLoadModule("/src/features/ranking/CupPodiumView.jsx");
  const { default: TeamCupRoster } = await server.ssrLoadModule("/src/features/teamCup/TeamCupRoster.jsx");
  const { default: TeamCupParticipants } = await server.ssrLoadModule("/src/features/teamCup/TeamCupParticipants.jsx");
  const { drawPodiumParticipantRows } = await server.ssrLoadModule("/src/features/rankingShare/rankingShareExport.mjs");
  for (const kind of ["trio", "squad"]) {
    const fixed = fixture(9, kind);
    fixed.players.teams.forEach(team => { team.captainId = team.athletes.at(-1).id; });
    const pending = prepareTeamCupFormation(fixed, "random");
    const captains = cup.drawTeamCaptains(pending, () => .4);
    const drawn = cup.drawTeamMembers(captains, () => .4);
    for (const data of [fixed, pending, captains, drawn]) {
      const original = JSON.stringify(data);
      const markup = renderToStaticMarkup(React.createElement(TeamCupParticipants, { data, onChange() {} }));
      const sections = markup.split('<section class="tcp-team"').slice(1);
      assert.equal(sections.length, 9, "Manual participants always show one card per team, including pending draws");
      assert(!markup.includes("Lista para sorteio") && !markup.includes("tcp-pool-list"));
      assert.equal((markup.match(/class="tcp-captain-label"/g) || []).length, 9, "Exactly one captain label, with crown, per team");
      assert.equal((markup.match(/<select/g) || []).length, 9 * cup.teamSize(data) * 2, "Only composition and level selectors; no extra captain selector");
      assert(!/<(?:input|select)[^>]*disabled/.test(markup), "Pending draws do not disable manual names, composition or level");
      for (const [index, section] of sections.entries()) {
        const team = data.players.teams[index], captain = team.athletes.find(a => a.id === team.captainId);
        const firstRow = section.slice(section.indexOf('class="tcp-row"'));
        assert.equal(firstRow.match(/aria-label="Nome de ([^"]+)"/)[1], captain.name, "First name is always the existing captain, regardless of saved roster order");
        assert.equal((section.match(/class="tcp-row"/g) || []).length, cup.teamSize(data));
      }
      assert.equal(JSON.stringify(data), original, "Rendering preserves team IDs, roster order, captains and draw state");
    }
  }
  for (const kind of ["trio", "squad"]) {
    let data = cup.generateTeamCupGroups(fixture(6, kind), () => .4);
    const key = data.schedule[0][0].matchKey;
    data = cup.updateTeamCupLeg(data, key, 0, { inProgress: true }, 1000000);
    data = cup.updateTeamCupLeg(data, key, 0, { s1: "6", s2: "2" }, 1030000);
    const waiting = renderToStaticMarkup(React.createElement(TeamCupMatchCard, { data, game: data.schedule[0][0], number: 1, round: "Rodada 1", now: 1500000 }));
    assert(waiting.includes(`aria-label="2º set${kind === "squad" ? " feminino" : ""} · Iniciar cronômetro"`), "Reopening the card selects the next waiting set");
    assert(waiting.includes("▷ A chamar") && waiting.includes('<time class="matchStatusTimer">00:00</time>'));
    data = cup.updateTeamCupLeg(data, key, 1, { inProgress: true }, 1600000);
    data = cup.updateTeamCupLeg(data, key, 1, { s1: "6", s2: "2" }, 1645000);
    const completed = renderToStaticMarkup(React.createElement(TeamCupMatchCard, { data, game: data.schedule[0][0], number: 1, round: "Rodada 1", now: 2000000 }));
    assert(completed.includes("Finalizado") && completed.includes('<time class="matchStatusTimer">00:45</time>'), "A completed confrontation displays the last played set's saved duration");
  }
  for (const kind of ["trio", "squad"]) for (const count of cup.TEAM_COUNTS) {
    const data = cup.generateTeamCupBrackets(finishGroups(cup.generateTeamCupGroups(fixture(count, kind), () => .4)));
    const original = JSON.stringify(data);
    const groupGame = data.schedule[0][0];
    const groupMarkup = renderToStaticMarkup(React.createElement(TeamCupMatchCard, { data, game: groupGame, number: 1, round: "Rodada 1", onLegChange() {} }));
    assert.equal((groupMarkup.match(/<input/g) || []).length, 4);
    assert(!/<input[^>]*disabled/.test(groupMarkup), "Completed group scores remain editable after generating both brackets");
    const publicGroup = renderToStaticMarkup(React.createElement(TeamCupMatchCard, { data, game: groupGame, number: 1, round: "Rodada 1", readOnly: true }));
    assert(!publicGroup.includes("<input"), "Unlocking organizer scores never enables public editing");
    for (const phase of ["main", "repechage"]) for (const readOnly of [false, true]) {
      const games = data.brackets.filter(game => game.phase === phase);
      const placement = games.filter(game => game.roundName.includes("3º"));
      const calls = [];
      const markup = renderToStaticMarkup(React.createElement(TeamCupBracketView, {
        brackets: data.brackets, phase, title: phase,
        renderMatch(game, number, round) {
          calls.push({ game, number, round });
          return React.createElement(TeamCupMatchCard, { data, game, number, round, readOnly, onLegChange() {} });
        },
      }));
      assert.equal(calls.length, games.length, "Every match, including BYEs, is shown exactly once");
      assert.deepEqual(calls.map(c => c.game.matchKey).sort(), games.map(g => g.matchKey).sort());
      assert.equal((markup.match(/class="bracketMatchNode /g) || []).length, games.length - placement.length);
      assert.equal(markup.includes("bracketPlacementSection"), placement.length > 0);
      assert.equal((markup.match(/class="roundCard bracketRoundLane"/g) || []).length, new Set(games.filter(g => !placement.includes(g)).map(g => g.roundName)).size);
      assert(!markup.includes("Chamar fase"), "Custom match cards do not expose unwired round actions");
      if (readOnly) assert(!markup.includes("<input"), "Public bracket has no editable scores");
      for (const game of games.filter(g => g.isBye)) {
        const bye = renderToStaticMarkup(React.createElement(TeamCupMatchCard, { data, game, number: 1, round: game.roundName, readOnly }));
        assert(!bye.includes("tc-score-heading") && !bye.includes("matchScoreCell") && !bye.includes("matchVsDivider"), "BYEs show no sets, scores or opponent row");
        assert.equal((bye.match(/class="matchTeamRow /g) || []).length, 1);
        assert.equal((bye.match(/class="tc-roster-member"/g) || []).length, cup.teamSize(data));
        assert.equal((bye.match(/class="tc-roster-separator"/g) || []).length, kind === "squad" ? 2 : 1);
      }
    }
    assert.equal(JSON.stringify(data), original, "Rendering never changes seeds, BYEs, scores or progression");
  }
  const classic = renderToStaticMarkup(React.createElement(BracketColumn, {
    title: "Copa existente", rounds: [{ title: "Final", games: [] }],
    speakBracketRound() {}, stopSpeech() {},
  }));
  assert(classic.includes("Chamar fase") && classic.includes("Parar"), "Existing Copa actions keep their default behavior");
  for (const kind of ["trio", "squad"]) {
    let data = cup.generateTeamCupBrackets(finishGroups(cup.generateTeamCupGroups(fixture(6, kind), () => .4)));
    data = cup.setTeamCupConsolationEnabled(data, true);
    for (const game of data.brackets) if (!game.isBye) {
      for (let set = 0; set < 2; set++) data = cup.updateTeamCupLeg(data, game.matchKey, set, { s1: "6", s2: "2" });
    }
    const original = JSON.stringify(data);
    for (const phase of ["main", "repechage"]) {
      const podium = teamCupPodium(data, phase).map(item => ({ ...item, playTimeSeconds: 123 })), variant = phase === "main" ? "main" : "parallel";
      const shown = podium.slice(0, phase === "main" ? 3 : 1);
      const markup = renderToStaticMarkup(React.createElement(CupPodiumView, { podium, variant, showPlayTime: false,
        renderParticipants: item => React.createElement(TeamCupRoster, { team: data.players.teams[item.id] }),
      }));
      assert.equal((markup.match(/class="tc-roster-member"/g) || []).length, shown.length * cup.teamSize(data));
      assert.equal((markup.match(/cupPodiumNameWithRoster/g) || []).length, shown.length);
      assert(markup.includes("cupPodiumRosterViewport"));
      assert(!markup.includes("Tempo em jogo"), "Team podium hides play time without deleting timer data");
      for (const item of shown) assert.deepEqual(item.participants, data.players.teams[item.id].athletes.map(a => a.name + (a.id === data.players.teams[item.id].captainId ? " (C)" : "")), "PNG receives full participant names and captain markers");
      for (const item of shown) for (const athlete of data.players.teams[item.id].athletes) assert(markup.includes(athlete.name), "Podium includes each winning team's complete roster");
      const legacy = renderToStaticMarkup(React.createElement(CupPodiumView, { podium, variant }));
      assert(legacy.includes("Tempo em jogo"), "Other modalities retain their play time by default");
      assert(!legacy.includes("tc-roster") && !legacy.includes("cupPodiumRosterViewport"), "Other modalities retain their original podium layout");
    }
    assert.equal(JSON.stringify(data), original, "Adding roster labels does not alter ranking results");
  }
  for (const names of [["Danilo Sousa (C)", "Nicolas Ferreira", "Cristian Munos"], ["Danilo Sousa (C)", "Nicolas Ferreira", "Cristian Munos", "Maria Oliveira"]]) {
    const drawn = [];
    const context = { font: "", save() {}, restore() {},
      measureText(text) { return { width: text.length * parseFloat(this.font.split(" ")[1]) * .6 }; },
      fillText(text, x, y) { drawn.push({ text, x, y, font: this.font, width: this.measureText(text).width }); },
    };
    drawPodiumParticipantRows(context, names, 235, 960, 250);
    assert.deepEqual(drawn.map(row => row.text), [names.slice(0, 2).join(" | "), names.slice(2).join(" | ")]);
    assert(drawn.every(row => row.font.startsWith("400 ") && row.width <= 250.001), "PNG uses normal-weight names and keeps full rows inside their podium space");
    assert.equal(drawn[1].y - drawn[0].y, 30);
  }
  console.log("Team cup bracket view: 56 formats, main/parallel/public trees, compact BYEs, podium rosters and preserved data approved.");
} finally {
  await server.close();
}
