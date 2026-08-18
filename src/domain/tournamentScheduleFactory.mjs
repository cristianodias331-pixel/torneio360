import { buildReizinhoGames } from "../reizinhoSchedule.mjs";
import { super12IndividualTemplate } from "../super12Schedule.mjs";
import { super20MixedTemplate } from "../super20MixedSchedule.mjs";
import { modalityConfig } from "./modalityConfig.mjs";
import { berger, optimizeCourts } from "./scheduleGeneration.mjs";
import {
  fixed12Template,
  super10MixedTemplate,
  super12MixedTemplate,
  super16MixedTemplate,
  super8Template,
} from "./scheduleTemplates.mjs";

export function buildFromPairTemplate(template, players) {
  return template.map((round) =>
    round.map((game, index) => {
      const [a, b] = game[0];
      const [c, d] = game[1];

      return {
        court: index + 1,
        team1: [players[a - 1], players[b - 1]],
        ids1: [a - 1, b - 1],
        team2: [players[c - 1], players[d - 1]],
        ids2: [c - 1, d - 1],
        s1: "",
        s2: "",
      };
    })
  );
}

export function buildFromMixedTemplate(template, players) {
  const men = players.men;
  const women = players.women;
  const menCount = men.length;

  function getName(num) {
    if (num <= menCount) return men[num - 1];
    return women[num - menCount - 1];
  }

  function getId(num) {
    return num - 1;
  }

  return template.map((round) =>
    round.map((game, index) => {
      const [a, b, c, d] = game;

      return {
        court: index + 1,
        team1: [getName(a), getName(b)],
        ids1: [getId(a), getId(b)],
        team2: [getName(c), getName(d)],
        ids2: [getId(c), getId(d)],
        s1: "",
        s2: "",
      };
    })
  );
}

export function generateSchedule(type, players) {
  const config = modalityConfig[type];

  if (config.type === "reizinho") {
    return buildReizinhoGames(players.length).map((round) => (
      round.map((game) => {
        const [firstPair, secondPair] = game;
        return {
          court: 1,
          team1: firstPair.map((playerNumber) => players[playerNumber - 1]),
          ids1: firstPair.map((playerNumber) => playerNumber - 1),
          team2: secondPair.map((playerNumber) => players[playerNumber - 1]),
          ids2: secondPair.map((playerNumber) => playerNumber - 1),
          s1: "",
          s2: "",
        };
      })
    ));
  }

  if (config.type === "super8") {
    return optimizeCourts(buildFromPairTemplate(super8Template, players));
  }

  if (config.type === "super12") {
    return optimizeCourts(buildFromPairTemplate(super12IndividualTemplate, players));
  }

  if (config.type === "mixed10") {
    return optimizeCourts(buildFromMixedTemplate(super10MixedTemplate, players));
  }

  if (config.type === "mixed12") {
    return optimizeCourts(buildFromMixedTemplate(super12MixedTemplate, players));
  }

  if (config.type === "mixed16") {
    return optimizeCourts(buildFromMixedTemplate(super16MixedTemplate, players));
  }

  if (config.type === "mixed20") {
    return optimizeCourts(buildFromMixedTemplate(super20MixedTemplate, players));
  }

  if (config.type === "fixed12") {
    const teamNames = players.teams.map((team) => `${team.a} + ${team.b}`);
    const schedule = fixed12Template.map((round) =>
      round.map((game, index) => ({
        court: index + 1,
        team1: [teamNames[game[0] - 1]],
        ids1: [game[0] - 1],
        team2: [teamNames[game[1] - 1]],
        ids2: [game[1] - 1],
        s1: "",
        s2: "",
      }))
    );

    return optimizeCourts(schedule);
  }

  if (config.type === "fixed16") {
    const teamNames = players.teams.map((team) => `${team.a} + ${team.b}`);
    const schedule = berger(8).map((round) =>
      round.map((game, index) => ({
        court: index + 1,
        team1: [teamNames[game[0]]],
        ids1: [game[0]],
        team2: [teamNames[game[1]]],
        ids2: [game[1]],
        s1: "",
        s2: "",
      }))
    );

    return optimizeCourts(schedule);
  }

  if (config.type === "simple8") {
    const schedule = berger(players.length).map((round) =>
      round.map((game, index) => ({
        court: index + 1,
        team1: [players[game[0]]],
        ids1: [game[0]],
        team2: [players[game[1]]],
        ids2: [game[1]],
        s1: "",
        s2: "",
      }))
    );

    return optimizeCourts(schedule);
  }

  return [];
}
