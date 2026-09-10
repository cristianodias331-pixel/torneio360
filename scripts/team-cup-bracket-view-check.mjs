import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { fixture, finishGroups } from "./team-cup-check.mjs";
import * as cup from "../src/domain/teamCup.mjs";
import { teamCupPodium } from "../src/domain/teamCupPodium.mjs";

const server = await createServer({ configFile: false, logLevel: "error", server: { middlewareMode: true, hmr: false }, appType: "custom" });
try {
  const { default: TeamCupBracketView } = await server.ssrLoadModule("/src/features/teamCup/TeamCupBracketView.jsx");
  const { TeamCupMatchCard } = await server.ssrLoadModule("/src/features/teamCup/TeamCupWorkspace.jsx");
  const { BracketColumn } = await server.ssrLoadModule("/src/features/brackets/CupBracketView.jsx");
  const { default: CupPodiumView } = await server.ssrLoadModule("/src/features/ranking/CupPodiumView.jsx");
  const { default: TeamCupRoster } = await server.ssrLoadModule("/src/features/teamCup/TeamCupRoster.jsx");
  for (const kind of ["trio", "squad"]) for (const count of cup.TEAM_COUNTS) {
    const data = cup.generateTeamCupBrackets(finishGroups(cup.generateTeamCupGroups(fixture(count, kind), () => .4)));
    const original = JSON.stringify(data);
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
      const podium = teamCupPodium(data, phase), variant = phase === "main" ? "main" : "parallel";
      const shown = podium.slice(0, phase === "main" ? 3 : 1);
      const markup = renderToStaticMarkup(React.createElement(CupPodiumView, { podium, variant,
        renderParticipants: item => React.createElement(TeamCupRoster, { team: data.players.teams[item.id] }),
      }));
      assert.equal((markup.match(/class="tc-roster-member"/g) || []).length, shown.length * cup.teamSize(data));
      assert.equal((markup.match(/cupPodiumNameWithRoster/g) || []).length, shown.length);
      assert(markup.includes("cupPodiumRosterViewport"));
      for (const item of shown) for (const athlete of data.players.teams[item.id].athletes) assert(markup.includes(athlete.name), "Podium includes each winning team's complete roster");
      const legacy = renderToStaticMarkup(React.createElement(CupPodiumView, { podium, variant }));
      assert(!legacy.includes("tc-roster") && !legacy.includes("cupPodiumRosterViewport"), "Other modalities retain their original podium layout");
    }
    assert.equal(JSON.stringify(data), original, "Adding roster labels does not alter ranking results");
  }
  console.log("Team cup bracket view: 56 formats, main/parallel/public trees, compact BYEs, podium rosters and preserved data approved.");
} finally {
  await server.close();
}
