import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { createInitialData } from "../src/domain/tournamentDataNormalization.mjs";
import { modalityConfig } from "../src/domain/modalityConfig.mjs";
import { createTeamCupData, generateTeamCupGroups, generateTeamCupBrackets, teamCupQualified, updateTeamCupLeg } from "../src/domain/teamCup.mjs";
import { makeExample } from "../src/domain/reiDoSol.mjs";
import { applyReiDoSolState } from "../src/domain/reiDoSolData.mjs";
import { createTournamentOperations } from "../src/domain/tournamentOperations.mjs";

const sessionValues = new Map();
const previousStorage = globalThis.sessionStorage;
globalThis.sessionStorage = { getItem: key => sessionValues.get(key) || null, setItem: (key, value) => sessionValues.set(key, value) };
const runtime = {
  tagline: "Gestão inteligente de torneios",
  getTournamentTimingSummary: createTournamentOperations().getTournamentTimingSummary,
  calculateRanking: () => { throw new Error("Specialized public views must not use the generic ranking engine"); },
  getSafeCupPresentation: () => { throw new Error("Specialized public views must not use generic cup brackets"); },
};
let capturedShareConfigs = [];
const previousCapture = globalThis.__capturePublicShareConfig;
globalThis.__capturePublicShareConfig = config => { if (config) capturedShareConfigs.push(config); };
const server = await createServer({ server: { middlewareMode: true }, appType: "custom", plugins: [{
  name: "inspect-public-share-props", enforce: "pre",
  transform(code, id) {
    if (id.endsWith("/features/rankingShare/RankingShareButton.jsx")) return code.replace(
      "export default function RankingShareButton({ config }) {",
      "export default function RankingShareButton({ config }) { globalThis.__capturePublicShareConfig?.(config);"
    );
  },
}] });
try {
  const { default: Public } = await server.ssrLoadModule("/src/features/publicArena/PublicTournamentScreen.jsx");
  const fixtures = [{ type: "Rei do Sol", data: applyReiDoSolState(createInitialData("Rei do Sol", modalityConfig["Rei do Sol"]), makeExample(20, 4, "finished")) }];
  for (const kind of ["trio", "squad"]) {
    let data = createTeamCupData({ winningScore: 4, courtNumbers: ["1", "2", "3", "4"] }, 6, kind);
    data.players.teams.forEach((team, i) => team.athletes.forEach((athlete, j) => { athlete.name = `Pessoa ${i + 1} ${j + 1}`; }));
    data = generateTeamCupGroups(data, () => .4);
    for (const game of data.schedule.flat()) for (let leg = 0; leg < 2; leg++) {
      const firstWins = game.ids1[0] < game.ids2[0];
      data = updateTeamCupLeg(data, game.matchKey, leg, { s1: firstWins ? "4" : "1", s2: firstWins ? "1" : "4" });
    }
    for (const tie of teamCupQualified(data).unresolvedCampaignTies) data.cupConfig.campaignTieBreakOverrides[tie.tieKey] = tie.teamIds;
    data = generateTeamCupBrackets(data);
    for (const game of data.brackets) if (!game.isBye) for (let leg = 0; leg < 2; leg++) data = updateTeamCupLeg(data, game.matchKey, leg, { s1: "4", s2: "1" });
    fixtures.push({ type: "Times/Equipes", data });
  }
  for (const [index, fixture] of fixtures.entries()) {
    const data = { ...fixture.data, coverImageUrl: "/fixture-cover.png", coverImageThumbnailUrl: "/fixture-cover-small.png",
      registrationDeadline: "2020-01-01", eventStartTime: "18:00", location: "Praia de teste",
      publicInfo: { visibility: { showArenaName: true, showOrganizerName: true, showInstagram: true },
        organizer: { arenaName: "Arena antiga", organizerName: "Organizador salvo", photoUrl: "/saved-organizer.png", whatsapp: "85999990000" } } };
    const tournament = { id: `shell-${index}`, public_id: `public-shell-${index}`, type: fixture.type, name: `Torneio ${index}`, data };
    const before = JSON.stringify(tournament);
    const organizer = { arenaName: "Arena atual", instagramHandle: "perfilatual" };
    const tabs = fixture.type === "Rei do Sol"
      ? [["participantes", "grupos"], ["partidas", "grupos"], ["partidas", "chaves"], ["ranking", "chaves"], ["inexistente", "chaves"]]
      : [["participantes", "grupos"], ["grupos", "grupos"], ["partidas", "grupos"], ["partidas", "chaves"], ["partidas", "paralela"], ["ranking", "grupos"]];
    for (const [tab, matchesTab] of tabs) {
      sessionValues.set(`publicTournamentTab:${tournament.public_id}`, tab);
      sessionValues.set(`publicTournamentMatchesTab:${tournament.public_id}`, matchesTab);
      const html = renderToStaticMarkup(React.createElement(Public, { tournament, organizer, onBackToArena: () => {}, runtime }));
      for (const text of ["Tabela pública", "Torneio 360", "Voltar ao perfil da arena", "Informações do torneio", "Inscrições encerradas", "18:00", "Praia de teste", "Organização", "Arena atual", "Organizador salvo", "perfilatual", "Ver foto maior"]) assert.ok(html.includes(text), `${fixture.type}/${tab} retains public shell: ${text}`);
      assert.match(html, /publicHeader publicHeaderWithLogo/);
      assert.match(html, /publicEventMediaInfo hasCover/);
      assert.match(html, /src="\/fixture-cover-small.png"/);
      assert.equal((html.match(/aria-label="Visualização pública do torneio"/g) || []).length, 1, "Exactly one shared public navigation");
      assert.doesNotMatch(html, /Arena antiga|wa\.me|85999990000/, "Live organizer merge and contact visibility remain respected");
      assert.doesNotMatch(html, /tournamentWorkspaceHeader|Etapas do Rei do Sol|aria-label="Organização do torneio"|tournamentHeaderDetailsToggle/, "Organizer shell is not duplicated in the public page");
      assert.doesNotMatch(html, /scoreInput|<textarea|Sortear desempate|Escolher manualmente|Confirmar todos|Criar rodadas e jogos|Gerar fase final|Gerar chaves finais|Aplicar quantidade|Configuração do torneio/, "Read-only viewers cannot edit tournament data");
      if (fixture.type === "Rei do Sol" && tab === "partidas") {
        assert.match(html, /aria-label="Etapas das partidas do Rei do Sol"/);
        assert.ok(html.includes("Classificatória") && html.includes("Fase final"));
        if (matchesTab === "chaves") assert.ok(html.includes("Ouro") && html.includes("Lango"));
        else assert.ok(html.includes("4 partidas por atleta"));
      }
      if (fixture.type === "Times/Equipes" && tab === "participantes") assert.ok(html.includes("Pessoa 1 1") && html.includes("Pessoa 6 3"));
      assert.equal(JSON.stringify(tournament), before, "Public rendering never changes the saved tournament");
    }
    const hidden = { ...tournament, data: { ...data, publicInfo: { ...data.publicInfo, visibility: {} } } };
    sessionValues.set(`publicTournamentTab:${tournament.public_id}`, "ranking");
    capturedShareConfigs = [];
    const hiddenHtml = renderToStaticMarkup(React.createElement(Public, { tournament: hidden, organizer, runtime }));
    assert.doesNotMatch(hiddenHtml, /publicOrganizerCard|Arena atual|perfilatual/, "Hidden organization fields remain private");
    assert.ok(capturedShareConfigs.length > 0, "Completed specialized rankings expose their real export config to the check");
    assert.ok(capturedShareConfigs.every(config => config.arenaName === "Torneio360" && config.arenaPhotoUrl === ""), "Exports cannot reintroduce hidden organizer identities");
    if (fixture.type === "Times/Equipes") assert.ok(capturedShareConfigs.every(config => config.criteriaLabel === "Pódio definido pelas eliminatórias"));
    for (const [visibility, expectedName, expectedPhoto] of [
      [{ showArenaName: true }, "Arena atual", "/saved-organizer.png"],
      [{ showOrganizerName: true }, "Organizador salvo", "/saved-organizer.png"],
      [{ showInstagram: true }, "Torneio360", "/saved-organizer.png"],
    ]) {
      capturedShareConfigs = [];
      const shown = { ...tournament, data: { ...data, publicInfo: { ...data.publicInfo, visibility } } };
      renderToStaticMarkup(React.createElement(Public, { tournament: shown, organizer, runtime }));
      assert.ok(capturedShareConfigs.every(config => config.arenaName === expectedName && config.arenaPhotoUrl === expectedPhoto), "Export branding matches the visible organizer card");
    }
  }
  const EmptyView = () => null;
  for (const type of ["Super 08", "Campeonato Cearense"]) {
    const data = createInitialData(type, modalityConfig[type]);
    let rankingCalls = 0, bracketCalls = 0;
    const legacyRuntime = { ...runtime,
      calculateRanking: () => { rankingCalls++; return []; },
      getSafeCupPresentation: () => { bracketCalls++; return { currentBrackets: null, parallelRanking: [], mainCupPodium: [], consolationCupPodium: [], secondParallelPodium: [], thirdParallelPodium: [], sunsetPodium: [] }; },
      CupGroupRankingView: EmptyView, CupPodiumView: EmptyView, PublicCupBracketView: EmptyView,
      RankingView: EmptyView, ScheduleView: EmptyView, SimpleFormatInfoButton: EmptyView,
      TournamentFormatInfoButton: EmptyView, TournamentTimingSummary: EmptyView,
    };
    const html = renderToStaticMarkup(React.createElement(Public, { tournament: { id: `legacy-${type}`, name: type, type, data }, runtime: legacyRuntime }));
    assert.equal(rankingCalls, 1, `${type} retains its generic ranking path`);
    assert.equal(bracketCalls, 1, `${type} retains its existing bracket presentation path`);
    assert.match(html, /publicHeader publicHeaderWithLogo/);
    assert.match(html, /publicAthletesCard/);
    assert.doesNotMatch(html, /rds-workspace|tc-workspace/, "Other modalities do not enter the new embedded path");
  }
} finally {
  await server.close();
  if (previousStorage === undefined) delete globalThis.sessionStorage;
  else globalThis.sessionStorage = previousStorage;
  if (previousCapture === undefined) delete globalThis.__capturePublicShareConfig;
  else globalThis.__capturePublicShareConfig = previousCapture;
}
console.log("Rei do Sol and Trio/Squad public shell: shared header, media, organizer visibility, all public tabs and read-only rules passed.");
