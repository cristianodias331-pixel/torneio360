import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { orderFixedMixedPair } from "../src/fixedMixedTeamOrder.mjs";
import { super12IndividualTemplate } from "../src/super12Schedule.mjs";
import { super20MixedTemplate } from "../src/super20MixedSchedule.mjs";
import { buildReizinhoGames, reizinhoPairRounds } from "../src/reizinhoSchedule.mjs";
import {
  chooseCircuitParticipantDisplayName,
  normalizeCircuitParticipantKey,
} from "../src/circuitNameIdentity.mjs";
import {
  mergeConcurrentTournamentData,
  preservesTournamentCriticalData,
} from "../src/offlineDataStore.mjs";

const root = new URL("../", import.meta.url);
const mainSource = readFileSync(new URL("src/main.jsx", root), "utf8");
const styleSource = readFileSync(new URL("src/style.css", root), "utf8");
const installSource = readFileSync(new URL("src/InstallAppBanner.jsx", root), "utf8");
const indexSource = readFileSync(new URL("index.html", root), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
const manifest = JSON.parse(readFileSync(new URL("public/manifest.webmanifest", root), "utf8"));
const appVersion = JSON.parse(readFileSync(new URL("public/app-version.json", root), "utf8"));
const publicArenaMigrationUrl = new URL("supabase/migrations/202608030001_public_arena_platform.sql", root);
assert.ok(existsSync(fileURLToPath(publicArenaMigrationUrl)), "A migração segura da plataforma pública está ausente.");
const publicArenaMigration = readFileSync(publicArenaMigrationUrl, "utf8");
const arenaDirectoryRulesMigrationUrl = new URL("supabase/migrations/202608040001_arena_directory_access_rules.sql", root);
assert.ok(existsSync(fileURLToPath(arenaDirectoryRulesMigrationUrl)), "A migração das regras do diretório de arenas está ausente.");
const arenaDirectoryRulesMigration = readFileSync(arenaDirectoryRulesMigrationUrl, "utf8");
const collaborationMigrationUrl = new URL("supabase/migrations/202608080001_data_integrity_and_collaboration.sql", root);
assert.ok(existsSync(fileURLToPath(collaborationMigrationUrl)), "A migração de integridade e colaboração está ausente.");
const collaborationMigration = readFileSync(collaborationMigrationUrl, "utf8");
const serverRevisionMigrationUrl = new URL("supabase/migrations/202608080002_server_revisions.sql", root);
assert.ok(existsSync(fileURLToPath(serverRevisionMigrationUrl)), "A migração de revisões do servidor está ausente.");
const serverRevisionMigration = readFileSync(serverRevisionMigrationUrl, "utf8");
const circuitScoringMigrationUrl = new URL("supabase/migrations/202608120001_circuit_scoring_models.sql", root);
assert.ok(existsSync(fileURLToPath(circuitScoringMigrationUrl)), "A migração dos modelos de pontuação dos circuitos está ausente.");
const circuitScoringMigration = readFileSync(circuitScoringMigrationUrl, "utf8");
const offlineStoreSource = readFileSync(new URL("src/offlineDataStore.mjs", root), "utf8");
const serviceWorkerSource = readFileSync(new URL("public/sw.js", root), "utf8");
const prepareParticipantLineSource = mainSource.slice(
  mainSource.indexOf("function prepareParticipantLine(value)"),
  mainSource.indexOf("function sanitizeParticipantName(value)")
);
const prepareParticipantLineForTest = Function(
  `"use strict"; ${prepareParticipantLineSource}; return prepareParticipantLine;`
)();

assert.equal(normalizeCircuitParticipantKey("B\u00e1rbara"), normalizeCircuitParticipantKey("barbara"));
assert.equal(normalizeCircuitParticipantKey("Jo\u00e3o da Silva"), normalizeCircuitParticipantKey("joao da silva"));
assert.equal(chooseCircuitParticipantDisplayName("Barbara", "B\u00e1rbara"), "B\u00e1rbara");
assert.equal(chooseCircuitParticipantDisplayName("B\u00e1rbara", "barbara"), "B\u00e1rbara");
assert.equal(
  chooseCircuitParticipantDisplayName("Jo\u00e3o Barbara", "Joao B\u00e1rbara"),
  "Jo\u00e3o B\u00e1rbara"
);
assert.equal(
  normalizeCircuitParticipantKey("B\u00e1rbara + Jo\u00e3o", true),
  normalizeCircuitParticipantKey("joao + barbara", true)
);
assert.equal(
  chooseCircuitParticipantDisplayName("Jo\u00e3o + Barbara", "B\u00e1rbara + Joao", true),
  "Jo\u00e3o + B\u00e1rbara"
);

assert.equal(prepareParticipantLineForTest("🏆 1. João da Silva"), "João da Silva");
assert.equal(prepareParticipantLineForTest("✅✅ 2️⃣ - Maria"), "Maria");
assert.equal(prepareParticipantLineForTest("• #3 Carlos + Ana"), "Carlos + Ana");
assert.equal(prepareParticipantLineForTest("👉 (4) Pedro / Beatriz"), "Pedro / Beatriz");
assert.equal(prepareParticipantLineForTest("⚽ - 5º Lucas e Carla"), "Lucas e Carla");
assert.equal(prepareParticipantLineForTest("✨ Dupla 12: Roberto & Fernanda"), "Roberto & Fernanda");

const requiredApplicationMarkers = [
  "supabase.auth.signInWithPassword",
  "supabase.auth.signUp",
  "supabase.auth.resetPasswordForEmail",
  'function Dashboard(',
  'function TournamentScreen(',
  'function PublicTournamentPage(',
  'function PublicPlatformHome(',
  'function PublicArenaPage(',
  'function calculateRanking(',
  'function calculateCircuitTournamentRanking(',
  'function buildPublicCircuitRankingGroups(',
  'function generateCupBrackets(',
  '.from("profiles")',
  '.from("tournaments")',
  '.from("circuits")',
  '.eq("user_id", user.id)',
  '.eq("is_public", true)',
  '?public=${publicId}',
  'panel: "inicio"',
  'panel: "criar"',
  'panel: "circuitos"',
  'panel: "modalidades"',
];

for (const marker of requiredApplicationMarkers) {
  assert.ok(mainSource.includes(marker), `Fluxo essencial ausente: ${marker}`);
}

assert.ok(
  mainSource.includes('const advanceScoreFocus = (side, currentInput) =>')
    && mainSource.includes('side === "team1" ? game?.s2 : game?.s1')
    && mainSource.includes('advanceScoreFocus(side, currentInput)')
    && mainSource.includes('advanceScoreFocus(side, event.currentTarget)'),
  "O preenchimento do placar deve avançar para o adversário independentemente do lado iniciado."
);

const noticeModalSource = mainSource.slice(
  mainSource.indexOf("function NoticeModal("),
  mainSource.indexOf("function ConfirmRegenerationModal(")
);
assert.ok(
  noticeModalSource.includes("return createPortal(")
    && noticeModalSource.includes("document.body"),
  "Os avisos devem ser renderizados acima das abas e dos cabeçalhos fixos."
);

assert.ok(
  mainSource.includes('event.target.closest("#torneio360-main-sidebar, .sidebarMobileToggle")')
    && mainSource.includes('document.addEventListener("pointerdown", closeOnOutsidePress)')
    && mainSource.includes('document.removeEventListener("pointerdown", closeOnOutsidePress)'),
  "O menu principal deve ser recolhido ao clicar ou tocar fora dele."
);

assert.ok(
  mainSource.includes("function ModalityPicker(")
    && mainSource.includes('title: "Duplas fixas"')
    && mainSource.includes('title: "Ranking individual"')
    && mainSource.includes('title: "Mistas"')
    && mainSource.includes('title: "Copas e modelos"')
    && mainSource.includes('placeholder="Ex.: Super 8, Copa ou Simples"')
    && mainSource.includes("<ModalityPicker value={newType}")
    && mainSource.includes("<ModalityPicker value={item.type}")
    && styleSource.includes(".modalityPickerPanel")
    && styleSource.includes(".modalityPickerItems > button.selected")
    && styleSource.includes("z-index: 22010")
    && styleSource.includes('html[data-theme="dark"] .proDashboard.playAppShell .modalityPickerTrigger')
    && styleSource.includes("top: max(10px, env(safe-area-inset-top)) !important")
    && styleSource.includes("max-height: none !important")
    && mainSource.includes('querySelector(".playTopbar")'),
  "O seletor de modalidades perdeu a busca, os grupos, a seleção lilás ou a adaptação para celular."
);

assert.ok(
  mainSource.includes('aria-label="Pesquisar torneios cadastrados"')
    && mainSource.includes('aria-label="Pesquisar circuitos cadastrados"')
    && mainSource.includes('placeholder="Ex.: nome, modalidade, categoria ou local"')
    && mainSource.includes('placeholder="Ex.: nome do circuito, torneio ou modalidade"')
    && styleSource.includes(".platformUnifiedSearch")
    && styleSource.includes(".eventListToolbar .eventListSearch")
    && styleSource.includes('.proDashboard.theme-dark .platformUnifiedSearch'),
  "As pesquisas unificadas de torneios e circuitos perderam o filtro, o padrao visual ou o tema noturno."
);

assert.ok(
  mainSource.includes('const [sidebarExpanded, setSidebarExpanded] = useState(false)')
    && mainSource.includes('className="sidebarMobileToggle"')
    && mainSource.includes('className={`sidebarBackdrop ${sidebarExpanded ? "visible" : ""}`}')
    && mainSource.includes('playSidebar proSidebar ${sidebarExpanded ? "isExpanded" : ""}')
    && mainSource.includes("<Menu aria-hidden=\"true\"")
    && !mainSource.includes('className="sidebarExpandToggle"')
    && styleSource.includes(".playSidebar.proSidebar:hover")
    && styleSource.includes("@media (min-width: 1025px)")
    && styleSource.includes("button.sidebarMobileToggle")
    && styleSource.includes("padding-left: 84px !important")
    && styleSource.includes("translateX(-104%)")
    && styleSource.includes("@media (max-width: 1024px)")
    && styleSource.includes("button.sidebarBackdrop.visible"),
  "O menu lateral perdeu o estado compacto, a expansão flutuante ou a adaptação por toque."
);

for (const actionClass of [
  "actionCreateBtn",
  "actionConfirmBtn",
  "actionRestoreBtn",
  "actionShuffleBtn",
  "actionGenerateBtn",
  "actionOpenBtn",
  "actionNavigateBtn",
]) {
  assert.ok(
    mainSource.includes(actionClass) && styleSource.includes(`button.${actionClass}`),
    `A cor semantica da acao ${actionClass} esta ausente.`
  );
}

assert.ok(
  styleSource.includes("background: var(--ui-surface-raised) !important;")
    && styleSource.includes("color: var(--ui-text-strong) !important;"),
  "A base visual dos botoes voltou a impor uma cor de acao generica."
);

assert.ok(
  mainSource.includes("ensureArenaProfileReadyForPublication")
    && mainSource.includes("Informe o nome da arena e o nome do responsável"),
  "A criação de eventos não exige o perfil público mínimo da arena."
);
assert.ok(
  arenaDirectoryRulesMigration.includes("private.promote_confirmed_organizer")
    && arenaDirectoryRulesMigration.includes("private.provision_profile_from_auth_user")
    && arenaDirectoryRulesMigration.includes("public.t360_arena_directory_visible")
    && arenaDirectoryRulesMigration.includes("profile.arena_name")
    && arenaDirectoryRulesMigration.includes("profile.name")
    && arenaDirectoryRulesMigration.includes("account.email_confirmed_at")
    && arenaDirectoryRulesMigration.includes("event_end_value::date")
    && arenaDirectoryRulesMigration.includes("circuit.end_date"),
  "A migração perdeu critérios essenciais de ativação, teste ou visibilidade pública."
);

assert.ok(
  mainSource.includes("fetchPublicArenaDirectory")
    && mainSource.includes("ARENA_DIRECTORY_REFRESH_INTERVAL_MS")
    && mainSource.includes("hasSuccessfulLoad")
    && mainSource.includes("publicArenaProfilesInFlightRef")
    && mainSource.includes("refreshVisibleArenas")
    && mainSource.includes("refreshVisibleProfiles")
    && mainSource.includes('window.addEventListener("focus", refreshArenas)')
    && mainSource.includes('document.addEventListener("visibilitychange", handleVisibilityChange)')
    && mainSource.includes('className="publicArenaDirectoryOrganizer"')
    && mainSource.includes('className="arenaFeedOrganizer"'),
  "O diretório de arenas não atualiza automaticamente ou não identifica o organizador nos cartões."
);

const expectedModalityLabels = [
  "Reizinho",
  "Super 6 (dupla fixa)",
  "Super 8",
  "Super 8 (dupla fixa)",
  "Super 12",
  "Super 10 mista",
  "Super 12 mista",
  "Super 16 mista",
  "Super 20 mista",
  "Simples (1 contra 1 por jogo)",
  "Torneio modelo Campeonato Cearense",
  "Torneio modelo Campeonato Cearense — Individual",
  "Modelo Torneio 360",
];

for (const label of expectedModalityLabels) {
  assert.ok(mainSource.includes(label), `Nome de modalidade ausente: ${label}`);
}

const premiumModalities = mainSource.slice(
  mainSource.indexOf("premium: ["),
  mainSource.indexOf("const modalityConfig")
);
const premiumOrder = [
  '"Super 12 Mista (Dupla Fixa)"',
  '"Super 08"',
  '"Super 16 Mista (Dupla Fixa)"',
  '"Super 12"',
  '"Super 10 Mista (Dupla Aleatória)"',
  '"Super 12 Mista (Dupla Aleatória)"',
  '"Super 16 Mista (Dupla Aleatória)"',
  '"Super 20 Mista (Dupla Aleatória)"',
  '"Simples 8"',
];
const premiumPositions = premiumOrder.map((type) => premiumModalities.indexOf(type));
assert.ok(premiumPositions.every((position) => position >= 0), "A lista Premium perdeu uma modalidade obrigatória.");
assert.deepEqual([...premiumPositions].sort((a, b) => a - b), premiumPositions, "A ordem das modalidades está incorreta.");
assert.ok(premiumModalities.includes('"Modelo Play Ranking"'), "O Modelo Play Ranking não está liberado no plano Premium.");
assert.ok(
  mainSource.includes('"Modelo Play Ranking": "Modelo Torneio 360"'),
  "O nome público do Modelo Torneio 360 não preserva a modalidade interna existente."
);
assert.ok(
  mainSource.includes("allowedPlayerCounts: [4, 6, 8, 10, 12, 14]")
    && mainSource.includes("function SimpleConfigPanel")
    && mainSource.includes("berger(players.length)"),
  "A modalidade Simples não permite escolher as quantidades pares de 4 a 14 ou perdeu o todos contra todos."
);

assert.ok(mainSource.includes('type: "playranking"'), "A configuração do Modelo Play Ranking está ausente.");
assert.ok(mainSource.includes("function getPlayRankingOpeningLosses"), "A transferência das derrotadas da primeira fase está ausente.");
assert.ok(mainSource.includes("function buildPlayRankingParallelRounds"), "A chave paralela especial do Modelo Play Ranking está ausente.");
assert.ok(mainSource.includes("function TournamentFormatInfoButton"), "A explicação dinâmica dos modelos está ausente.");
assert.ok(
  mainSource.includes("getCearenseFormatSummary(")
    && mainSource.includes('isSunset ? data.cupConfig?.groupFormation : "automatic"'),
  "A explicação não acompanha a quantidade, o formato individual ou a formação dos grupos escolhida."
);
assert.ok(mainSource.includes("publicView />"), "A explicação do formato não está acessível ao visitante.");
assert.ok(styleSource.includes(".formatInfoDialog"), "A explicação dinâmica está sem acabamento responsivo.");

assert.ok(
  mainSource.includes("function rankOfficialCearenseGroupRows")
    && mainSource.includes("function getOfficialCearenseQualified")
    && mainSource.includes("const cearenseMainBracketPlans")
    && mainSource.includes("function expandBracketPlanWithVisualByes")
    && mainSource.includes("isBye: Boolean(firstEntry) !== Boolean(secondEntry)")
    && mainSource.includes("function getCearenseThirdParallelSources")
    && mainSource.includes("games: [...quarterfinalGames, ...previousRoundGames]")
    && mainSource.includes("getNextPowerOfTwo(thirdParallelEligibleCount)")
    && mainSource.includes("sourceEntries.length === 2")
    && mainSource.includes("sourceEntries.length === 4")
    && mainSource.includes("function buildCearenseThirdParallelRounds")
    && mainSource.includes('"thirdParallel",')
    && mainSource.includes('defaultThirdRepechageName: "3ª Disputa Paralela"')
    && mainSource.includes('phase === "thirdParallel"')
    && mainSource.includes('activeMatchesTab === "paralela3"')
    && mainSource.includes('activePublicMatchesTab === "paralela3"'),
  "O Campeonato Cearense perdeu a classificação oficial, o chaveamento definido ou a 3ª disputa paralela."
);
assert.ok(
  styleSource.includes(".cearenseGroupRankingStack")
    && mainSource.includes("melhor grupo ·"),
  "A ordem visual dos melhores grupos do Campeonato Cearense está ausente."
);

for (const removedType of ["Copa - 12 ou 24 duplas", "Copa - 21 duplas", "Copinha - grupos de 3"]) {
  assert.ok(!premiumModalities.includes(`"${removedType}"`), `A modalidade removida ainda pode ser criada: ${removedType}`);
}

assert.equal(super12IndividualTemplate.length, 11, "O Super 12 deve possuir 11 rodadas.");
const super12Partners = new Map();
const super12Opponents = new Map();
const super12PairKey = (first, second) => [first, second].sort((a, b) => a - b).join("-");

for (const round of super12IndividualTemplate) {
  assert.equal(round.length, 3, "Cada rodada do Super 12 deve usar 3 quadras.");
  assert.deepEqual(
    round.flat(2).sort((a, b) => a - b),
    Array.from({ length: 12 }, (_, index) => index + 1),
    "Todos os 12 participantes devem jogar exatamente uma vez por rodada."
  );

  for (const [firstTeam, secondTeam] of round) {
    for (const team of [firstTeam, secondTeam]) {
      const key = super12PairKey(...team);
      super12Partners.set(key, (super12Partners.get(key) || 0) + 1);
    }

    for (const first of firstTeam) {
      for (const second of secondTeam) {
        const key = super12PairKey(first, second);
        super12Opponents.set(key, (super12Opponents.get(key) || 0) + 1);
      }
    }
  }
}

for (let first = 1; first <= 12; first += 1) {
  for (let second = first + 1; second <= 12; second += 1) {
    const key = super12PairKey(first, second);
    assert.equal(super12Partners.get(key), 1, `A parceria ${key} deve acontecer uma vez.`);
    assert.equal(super12Opponents.get(key), 2, `O confronto ${key} deve acontecer duas vezes.`);
  }
}

assert.ok(mainSource.includes('type: "super12"'), "A modalidade Super 12 individual não está cadastrada.");
assert.ok(mainSource.includes('config.type === "super12"'), "A geração da tabela fixa do Super 12 está ausente.");

assert.deepEqual(
  reizinhoPairRounds[4],
  [
    [[1, 2], [3, 4]],
    [[1, 3], [2, 4]],
    [[1, 4], [2, 3]],
  ],
  "O Reizinho tradicional deve ter as três parcerias possíveis para quatro atletas."
);
assert.equal(buildReizinhoGames(4).length, 3, "O Reizinho de 4 atletas deve ter 3 rodadas.");
assert.equal(buildReizinhoGames(4).flat().length, 3, "O Reizinho de 4 atletas deve ter 3 partidas.");

const reizinhoSixGames = buildReizinhoGames(6);
assert.equal(reizinhoSixGames.length, 5, "O Reizinho de 6 atletas deve ter 5 rodadas.");
assert.ok(reizinhoSixGames.every((round) => round.length === 3), "Cada rodada do Reizinho de 6 atletas deve ter 3 partidas.");
assert.equal(reizinhoSixGames.flat().length, 15, "O Reizinho de 6 atletas deve ter 15 partidas.");

const reizinhoPartners = new Map();
const reizinhoOpponents = new Map();
const reizinhoGamesPerAthlete = Array(7).fill(0);
const reizinhoPairKey = (first, second) => [first, second].sort((a, b) => a - b).join("-");

for (const pairs of reizinhoPairRounds[6]) {
  assert.deepEqual(
    pairs.flat().sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6],
    "Cada atleta deve integrar exatamente uma dupla por rodada no Reizinho de 6."
  );
  for (const pair of pairs) {
    const key = reizinhoPairKey(...pair);
    reizinhoPartners.set(key, (reizinhoPartners.get(key) || 0) + 1);
  }
}

for (const round of reizinhoSixGames) {
  for (const [firstPair, secondPair] of round) {
    for (const athlete of [...firstPair, ...secondPair]) reizinhoGamesPerAthlete[athlete] += 1;
    for (const first of firstPair) {
      for (const second of secondPair) {
        const key = reizinhoPairKey(first, second);
        reizinhoOpponents.set(key, (reizinhoOpponents.get(key) || 0) + 1);
      }
    }
  }
}

for (let first = 1; first <= 6; first += 1) {
  assert.equal(reizinhoGamesPerAthlete[first], 10, `O atleta ${first} deve jogar 10 partidas no Reizinho de 6.`);
  for (let second = first + 1; second <= 6; second += 1) {
    const key = reizinhoPairKey(first, second);
    assert.equal(reizinhoPartners.get(key), 1, `A parceria ${key} deve ocorrer exatamente uma vez no Reizinho de 6.`);
    assert.equal(reizinhoOpponents.get(key), 4, `Os atletas ${key} devem se enfrentar exatamente quatro vezes no Reizinho de 6.`);
  }
}

assert.ok(
  mainSource.includes('type: "cearenseIndividual"')
    && mainSource.includes('cupMode: "cearense-individual"')
    && mainSource.includes('individualCup: true')
    && mainSource.includes('isIndividualCupType(config)'),
  "O Campeonato Cearense Individual perdeu a configuração de partidas um contra um."
);
assert.ok(
  mainSource.includes("function ConfirmModalityChangeModal")
    && mainSource.includes("function ConfirmEventGroupModalityChangeModal")
    && mainSource.includes("const modalityChanged = editForm.type !== editTarget.type")
    && mainSource.includes("createInitialData(editForm.type, nextModalityConfig)")
    && mainSource.includes("confirmModalityChanges: true")
    && mainSource.includes("Trocar modalidade"),
  "A edição segura da modalidade de um torneio existente está ausente."
);
assert.ok(
  styleSource.includes("z-index: 22010")
    && styleSource.includes("z-index: 22000"),
  "O seletor de modalidades precisa permanecer acima do modal de edição."
);

assert.deepEqual(
  orderFixedMixedPair("Ana Beatriz", "João Pedro"),
  ["João Pedro", "Ana Beatriz"],
  "A importação deve colocar o homem no primeiro campo da dupla mista fixa."
);
assert.deepEqual(
  orderFixedMixedPair("Marcos", "Carla"),
  ["Marcos", "Carla"],
  "A importação deve manter uma dupla mista que já esteja na ordem correta."
);
assert.deepEqual(
  orderFixedMixedPair("Raquel", "Wadson"),
  ["Wadson", "Raquel"],
  "A importação deve reconhecer nomes que não terminam em A ou O."
);
assert.deepEqual(
  orderFixedMixedPair("Ana", "Carla"),
  ["Ana", "Carla"],
  "Duas mulheres devem permanecer na ordem em que foram coladas."
);
assert.deepEqual(
  orderFixedMixedPair("João", "Marcos"),
  ["João", "Marcos"],
  "Dois homens devem permanecer na ordem em que foram colados."
);
assert.deepEqual(
  orderFixedMixedPair("Gaivola", "Junior"),
  ["Gaivola", "Junior"],
  "Um nome desconhecido não deve ser reorganizado por suposição."
);
assert.deepEqual(
  orderFixedMixedPair("Maria", "Carlo"),
  ["Carlo", "Maria"],
  "Uma mulher seguida de um homem reconhecido deve ser invertida."
);
assert.deepEqual(
  orderFixedMixedPair("Giovana", "Junior"),
  ["Junior", "Giovana"],
  "A ordem da linha colada deve preencher o homem antes da mulher."
);
assert.ok(
  mainSource.includes("fixedMixedTeams ? orderFixedMixedPair(...cleanedNames) : cleanedNames"),
  "O importador em massa não está aplicando a ordem das duplas mistas fixas."
);

assert.equal(super20MixedTemplate.length, 10, "O Super 20 mista deve possuir 10 rodadas.");
const super20Partners = new Set();
const super20Opponents = new Map();

for (const round of super20MixedTemplate) {
  assert.equal(round.length, 5, "Cada rodada do Super 20 mista deve usar 5 quadras.");
  assert.deepEqual(
    round.flat().sort((a, b) => a - b),
    Array.from({ length: 20 }, (_, index) => index + 1),
    "Todos os 20 participantes devem jogar exatamente uma vez por rodada."
  );

  for (const [firstMan, firstWoman, secondMan, secondWoman] of round) {
    assert.ok(firstMan <= 10 && secondMan <= 10, "Cada dupla deve possuir um homem.");
    assert.ok(firstWoman > 10 && secondWoman > 10, "Cada dupla deve possuir uma mulher.");

    for (const [man, woman] of [[firstMan, firstWoman], [secondMan, secondWoman]]) {
      const partnership = `${man}-${woman}`;
      assert.ok(!super20Partners.has(partnership), `A parceria ${partnership} não pode se repetir.`);
      super20Partners.add(partnership);
    }

    for (const [first, second] of [
      [firstMan, secondMan],
      [firstWoman, secondWoman],
      [firstMan, secondWoman],
      [secondMan, firstWoman],
    ]) {
      const opponentKey = super12PairKey(first, second);
      super20Opponents.set(opponentKey, (super20Opponents.get(opponentKey) || 0) + 1);
    }
  }
}

assert.equal(super20Partners.size, 100, "Cada homem deve formar dupla uma vez com cada mulher.");
assert.ok(
  [...super20Opponents.values()].every((count) => count <= 2),
  "Nenhum adversário deve ser repetido mais de duas vezes no Super 20 mista."
);
assert.ok(mainSource.includes('type: "mixed20"'), "A modalidade Super 20 mista não está cadastrada.");
assert.ok(mainSource.includes('config.type === "mixed20"'), "A tabela fixa do Super 20 mista não está ligada ao gerador.");

assert.ok(mainSource.includes("function normalizeCourtNumbers"), "Os números personalizados das quadras não são normalizados.");
assert.ok(mainSource.includes("function getGameCourtNumber"), "A exibição das quadras não possui uma fonte numérica única e segura.");
assert.ok(mainSource.includes('return `Quadra ${getGameCourtNumber(game, courtNumbers)}`'), "A palavra Quadra não permanece fixa na apresentação.");
assert.ok(mainSource.includes('courtNumbers: createDefaultCourtNumbers'), "Novos torneios não recebem os números padrão das quadras.");
assert.ok(mainSource.includes("function CourtConfigPanel"), "A configuração prévia das quadras está ausente.");
assert.ok(mainSource.includes("function CourtAssignmentModal"), "A troca rápida de quadra durante os jogos está ausente.");
assert.ok(mainSource.includes("courtNumberOverride"), "O número escolhido para um jogo não é persistido.");
assert.ok(mainSource.includes("function ConfirmDuplicateCourtModal"), "A confirmação de número de quadra repetido está ausente.");
assert.ok(mainSource.includes("Confirmar repetição"), "O usuário não consegue confirmar duas partidas na mesma quadra.");
assert.ok(!mainSource.includes("Quadras trocadas"), "O sistema ainda troca automaticamente os números das quadras.");
assert.ok(mainSource.includes("getGameCourtLabel(game, courtNumbers)"), "A chamada por voz não usa o número visível da quadra.");
assert.ok(styleSource.includes("QUADRAS PERSONALIZADAS — AGOSTO 2026"), "O acabamento visual das quadras personalizadas está ausente.");
assert.ok(styleSource.includes(".courtNameBadge"), "O selo visual da quadra está ausente.");
assert.ok(styleSource.includes(".courtEditorSheet"), "O editor responsivo de quadras está sem estilo.");
assert.ok(styleSource.includes(".courtDuplicateModal"), "O aviso de quadra repetida está sem apresentação visual.");

assert.ok(indexSource.includes('src/main.jsx'), "A entrada React não está ligada ao index.html.");
assert.ok(indexSource.includes('torneio360-favicon-96.png'), "O novo favicon do Torneio360 não está configurado.");
assert.ok(indexSource.includes('manifest.webmanifest'), "O manifesto instalável não está ligado ao site.");
assert.ok(indexSource.includes('torneio360-apple-touch-icon.png'), "O ícone para atalhos Apple não está configurado.");
assert.equal(manifest.display, "standalone", "O atalho não está configurado para abrir como app.");
assert.ok(installSource.includes('beforeinstallprompt'), "O convite de instalação não captura o evento do navegador.");
assert.ok(installSource.includes('appinstalled'), "A confirmação de instalação não está sendo monitorada.");
assert.ok(installSource.includes('Instalar agora'), "O botão não oferece a instalação nativa quando ela está disponível.");
assert.ok(installSource.includes('Abrir no Chrome'), "O Android não possui alternativa para navegadores internos.");
assert.ok(!installSource.includes('Já instalei'), "O Android ainda pode ocultar o aviso sem concluir a instalação.");
assert.ok(installSource.includes('torneio360_app_installed_v3'), "A mensagem corrigida não será reexibida para testes anteriores.");
assert.ok(installSource.includes('Instalação em andamento...'), "A instalação lenta não possui retorno visual para o usuário.");
assert.ok(installSource.includes('INSTALL_RECOVERY_DELAY_MS = 10 * 60 * 1000'), "A ajuda de instalação reaparece cedo demais.");
assert.ok(
  !installSource.includes('if (outcome === "accepted") confirmManualInstallation()'),
  "O aceite do prompt ainda oculta a mensagem antes da confirmação real do navegador."
);
assert.ok(
  mainSource.includes('document.getElementById("acesso")?.scrollIntoView({ behavior: "auto", block: "start" })'),
  "A recuperação de senha não leva o usuário diretamente ao formulário de nova senha."
);
assert.ok(
  mainSource.includes('.rpc("get_public_tournament", { p_public_id: publicId })'),
  "O link público voltou a consultar uma tabela protegida em vez da função segura."
);
assert.ok(
  mainSource.includes('.rpc("get_public_arena_bundle",'),
  "O perfil público não consulta o pacote seguro e atualizado da arena."
);
assert.ok(mainSource.includes('title="Ranking do dia"'), "O ranking do torneio não usa o título Ranking do dia.");
assert.ok(mainSource.includes('placementMode ? "Ranking geral por pontos" : "Ranking geral acumulado"'), "O ranking público do circuito não identifica corretamente o modelo escolhido.");
assert.ok(
  mainSource.includes("function CircuitTournamentFormatSelector")
    && mainSource.includes("Classificação final")
    && mainSource.includes("Fases alcançadas")
    && mainSource.includes("getCircuitCompatibleTournaments")
    && mainSource.includes("getTournamentCircuitFormat"),
  "O circuito não separa classificação final e fases alcançadas antes da escolha dos torneios."
);
assert.ok(
  mainSource.includes("const defaultCircuitPositionPoints = [1000, 800, 670, 500, 400, 330, 250, 200, 170, 140]")
    && mainSource.includes("defaultCircuitOtherPositionPoints")
    && mainSource.includes("normalizedSettings.points.otherPositions")
    && mainSource.includes("Outras colocações"),
  "A pontuação por classificação final não limita os campos individuais ao 10º lugar ou não pontua as demais colocações."
);
assert.ok(
  mainSource.includes("return unique.slice(0, 2)")
    && !mainSource.includes('{ value: "none", label: "Sem critério adicional"')
    && styleSource.includes("grid-template-columns: repeat(2, minmax(0, 1fr))"),
  "O ranking do circuito ainda permite um terceiro critério de desempate."
);
assert.ok(
  mainSource.includes("tournamentFormat === circuitTournamentFormats.placement ? <section>")
    && mainSource.includes("tournamentFormat === circuitTournamentFormats.cup ? <section>")
    && mainSource.includes("Disputas paralelas")
    && mainSource.includes("nunca pontuam"),
  "As configurações exclusivas de cada formato ou a explicação das disputas paralelas estão incompletas."
);
assert.ok(
  mainSource.includes('className="circuitChoiceCheck circuitFormatCheck"')
    && mainSource.includes('className="circuitChoiceCheck"')
    && styleSource.includes(".circuitFormatOptions button:is(.selected, [aria-checked=\"true\"])")
    && styleSource.includes(".circuitChoiceCheck")
    && styleSource.includes("var(--ui-surface-raised)"),
  "Os cartões de escolha não seguem a seleção com quadradinho, lilás e contraste nos dois temas."
);
assert.ok(mainSource.includes('tournaments={tournaments}'), "O ranking público do circuito não recebe os torneios para cálculo imediato.");
assert.ok(mainSource.includes('className="publicCircuitName"'), "O nome do circuito não recebe destaque no ranking público.");
assert.ok(mainSource.includes('pts: "Total de Games"'), "A coluna de games ainda usa a nomenclatura antiga.");
assert.ok(
  mainSource.includes("const stats = exportColumns")
    && mainSource.includes("criteriaLabel || criteria.label"),
  "A imagem compartilhada não respeita nem identifica a ordem de critérios do ranking."
);
assert.ok(
  mainSource.includes('rankingCriteria: effectiveCircuitCriteria')
    && mainSource.includes('rankingCriteria: circuit?.ranking_criteria || defaultRankingCriteria'),
  "O compartilhamento do ranking do circuito não recebe seu critério efetivo."
);
assert.ok(
  mainSource.includes('async function copyRankingImageToClipboard(file)')
    && mainSource.includes('new Blob([await file.arrayBuffer()], { type: "image/png" })')
    && mainSource.includes('if (isMobileShareDevice() && await nativeShareRankingFiles(files, config))')
    && mainSource.includes('const imageCopied = await copyRankingImageToClipboard(files[0]);'),
  "O compartilhamento não separa o envio móvel da cópia PNG direta no notebook."
);
assert.ok(
  mainSource.includes('className="rankingExportDialog"')
    && mainSource.includes('Imprimir / salvar PDF multipágina')
    && mainSource.includes('downloadRankingFiles(exportFiles)')
    && mainSource.includes('createRankingShareFiles(config)')
    && mainSource.includes('paginateRankingGroups(normalizedGroups')
    && styleSource.includes('.rankingExportOverlay'),
  "O ranking não apresenta exportação paginada para imagem, impressão e download."
);
assert.ok(
  mainSource.includes('async function createCupPodiumShareFile({')
    && mainSource.includes('config?.presentation === "podium"')
    && mainSource.includes('presentation: "podium"')
    && mainSource.includes('const podiumLimit = variant === "parallel" ? 1 : 3;'),
  "O compartilhamento das copas não preserva o pódio visual ou ainda mostra vice e terceiro nas disputas paralelas."
);
assert.ok(
  mainSource.includes("const RANKING_SHARE_ROW_HEIGHT = 64;")
    && mainSource.includes("const RANKING_SHARE_GROUP_OVERHEAD = 64;")
    && mainSource.includes('context.font = "800 18px Arial";'),
  "O ranking completo voltou a usar linhas grandes e pode mostrar menos de dez participantes por imagem."
);
assert.ok(
  mainSource.includes('function wrapCanvasItems(context, items, maxWidth')
    && mainSource.includes('wrapCanvasItems(context, stats, 430).forEach'),
  "O compartilhamento do ranking ainda pode ocultar critérios com reticências."
);
assert.ok(mainSource.includes(': "Compartilhar ranking";'), "O botão compacto não identifica que compartilha o ranking.");
assert.ok(
  mainSource.includes('const [newRankingCriteria, setNewRankingCriteria] = useState("");')
    && mainSource.includes('if (!isMultiCategory && !rankingCriteriaOptions.some((option) => option.value === newRankingCriteria))')
    && mainSource.includes('!rankingCriteriaOptions.some((option) => option.value === item.rankingCriteria)')
    && mainSource.includes('showNotice("warning", "Critério obrigatório"')
    && mainSource.includes('<option value="">Escolha a ordem dos critérios</option>')
    && mainSource.includes('rankingCriteria: isMultiCategory ? defaultRankingCriteria : newRankingCriteria,'),
  "A criação do torneio ainda permite salvar sem escolher explicitamente o critério do ranking."
);
assert.ok(
  mainSource.includes('function formatParticipantName(value)')
    && mainSource.includes('function normalizeParticipantAttendance(config, players, attendance)')
    && mainSource.includes('function ensureParticipantsConfirmed()')
    && mainSource.includes('Confirmar todos')
    && mainSource.includes('Marcar todos como pendentes'),
  "A padronização dos nomes ou o controle de presença dos participantes está ausente."
);
assert.ok(
  mainSource.indexOf('function formatParticipantName(value)') < mainSource.indexOf('function normalizeTournamentData(type, rawData)')
    && mainSource.indexOf('function normalizeParticipantAttendance(config, players, attendance)') < mainSource.indexOf('function normalizeTournamentData(type, rawData)')
    && mainSource.indexOf('function normalizeTournamentData(type, rawData)') < mainSource.indexOf('function TournamentScreen('),
  "Os utilitários de participantes precisam permanecer no escopo global antes da normalização dos torneios."
);
assert.ok(
    mainSource.includes('const publicRankingReady = isCup || publicCompletionState.completed;')
    && mainSource.includes('className="publicRankingLocked"')
    && mainSource.includes('O ranking será exibido quando todos os jogos reais estiverem concluídos.'),
  "O ranking público das modalidades comuns não está protegido, ou a Copa continua bloqueada indevidamente."
);
assert.ok(
  mainSource.includes('function toggleScheduleGameStatus(roundIndex, gameIndex)')
    && mainSource.includes('function toggleBracketGameStatus(matchKey)')
    && mainSource.includes('Jogo em andamento')
    && mainSource.includes('is-in-progress'),
  "O status persistente de jogo em andamento está ausente."
);
assert.ok(
  mainSource.includes('function prepareEditableBracketData(currentData)')
    && mainSource.includes('return syncCupBracketScores(copy);')
    && mainSource.includes('const copy = prepareEditableBracketData(prev);'),
  "A 3ª Disputa Paralela exibida dinamicamente não pode receber placares persistentes."
);
assert.ok(
  styleSource.includes('.proDashboard.playAppShell button.matchCardStatus.is-waiting')
    && styleSource.includes('-webkit-text-fill-color: #52657b !important;')
    && styleSource.includes('.proDashboard.playAppShell button.matchCardStatus.is-in-progress'),
  "Os textos dos status das partidas podem desaparecer no tema claro."
);
assert.ok(
  mainSource.includes('Editar evento completo')
    && mainSource.includes('function openEditEventGroup(group)')
    && mainSource.includes('function saveEditedEventGroup({ confirmModalityChanges = false } = {})')
    && mainSource.includes('Adicionar categoria'),
  "A edição conjunta de eventos com várias categorias está ausente."
);
assert.ok(mainSource.includes('allowedTeamCounts: Array.from({ length: 29 }, (_, index) => index + 4)'), "O Campeonato Cearense não aceita todas as quantidades de 4 a 32 duplas.");
assert.ok(mainSource.includes('function createCearenseGroups(teamCount, groupFormation = "automatic")'), "A distribuição própria de grupos do Campeonato Cearense está ausente.");
assert.ok(
  mainSource.includes('"Copa Sunset": {')
    && mainSource.includes('type: "sunset"')
    && mainSource.includes('function generateSunsetBrackets(data)')
    && mainSource.includes('function buildSunsetChampionsRounds(brackets, bracketTitle)')
    && mainSource.includes('groupFormation === "all-four"')
    && mainSource.includes('phase === "secondParallel"')
    && mainSource.includes('phase === "sunsetFinal"')
    && styleSource.includes('.sunsetGroupFormationChoice'),
  "A Copa Sunset perdeu a formação opcional de grupos de quatro ou suas chaves independentes."
);
assert.ok(mainSource.includes('function compareCearenseCampaignMetrics(first, second)'), "A comparação normalizada entre grupos está ausente.");
assert.ok(mainSource.includes('function generateCearenseBrackets(data)'), "As chaves Principal e Paralela do Campeonato Cearense estão ausentes.");
assert.ok(mainSource.includes('campaignTieBreakOverrides'), "O sorteio de empate absoluto entre grupos não é persistido.");
assert.ok(mainSource.includes('className="matchByeScore">BYE</span>'), "Os BYEs do Campeonato Cearense não são identificados no cartão universal da chave.");
assert.ok(!mainSource.includes('Classificação automática (BYE)'), "O texto longo de classificação automática ainda aparece no BYE.");
assert.ok(mainSource.includes('buildCearenseEliminationRounds(qualified.main, "main", mainName, true)'), "A chave principal do Campeonato Cearense não cria a disputa de 3º lugar.");
assert.ok(
  mainSource.includes("function UniversalMatchCard(")
    && mainSource.includes('className="matchTeamStack"')
    && mainSource.includes('className="matchVsDivider"')
    && mainSource.includes('className="bracketTreeViewport"')
    && mainSource.includes('className="bracketTreeCanvas"')
    && styleSource.includes(".bracketTreeViewport")
    && styleSource.includes("overflow-x: auto")
    && styleSource.includes(".bracketMatchNode.hasNext.isTopSeed::after"),
  "O cartão universal ou o esqueleto conectado da Copa não está presente."
);
assert.ok(mainSource.includes('showPodium={false}'), "A classificação da fase de grupos ainda exibe troféus de pódio.");
assert.ok(mainSource.includes('tournamentTab: "participantes"'), "Abrir um torneio não direciona para Participantes.");
assert.ok(mainSource.includes('public_id: generatePublicId()'), "Novos torneios não recebem link público automaticamente.");
assert.ok(mainSource.includes('className="publicArenaTabs"'), "O link público não abre o perfil com abas de Torneios e Circuitos.");
assert.ok(mainSource.includes('navigator.serviceWorker.register("/sw.js")'), "O service worker do app não está registrado.");
assert.ok(!mainSource.includes("@torenio360"), "O usuário do Instagram continua escrito incorretamente.");
assert.ok(!mainSource.includes("data:image/png;base64"), "Ainda existem imagens PNG Base64 no JavaScript.");
assert.ok(mainSource.includes("function ConfirmCircuitDeleteModal"), "A exclusão do circuito não possui confirmação própria.");
assert.ok(!mainSource.includes('window.confirm("Excluir este circuito?'), "A exclusão do circuito ainda usa a confirmação simples do navegador.");
assert.ok(mainSource.includes('const [circuitEditForm, setCircuitEditForm]'), "A edição do circuito não abre em um formulário separado.");
assert.ok(mainSource.includes("function getAutomaticEventStatus"), "O status de torneios e circuitos não é calculado automaticamente pelas datas.");
assert.ok(
  mainSource.includes('return String(endDate) < getBrazilTodayISO() ? "finished" : "active"')
    && publicArenaMigration.includes("then 'finished'"),
  "O status automático não respeita os valores permitidos pelo banco de produção."
);
assert.ok(mainSource.includes('<ChevronDown />'), "O circuito não usa a seta para abrir e fechar.");
assert.ok(styleSource.includes("CONTRASTE ENTRE TEMAS E CIRCUITOS"), "A camada final de contraste dos temas está ausente.");
assert.ok(styleSource.includes(".gameWaiting .gameTeams > div"), "Os jogadores sem placar continuam sem correção de contraste.");
assert.ok(styleSource.includes(".arenaPublicDetailsGrid span"), "Os dados públicos da arena continuam sem correção de contraste.");
assert.ok(
  /button\.circuitItemSummary::before\s*\{[^}]*content:\s*none\s*!important;[^}]*display:\s*none\s*!important;/s.test(styleSource),
  "O cabeçalho do circuito ainda pode exibir o monograma duplicado."
);
assert.ok(styleSource.includes(".rankingTableScroll > .rankingTable"), "Os rankings internos não possuem rolagem horizontal responsiva.");
assert.ok(mainSource.includes('className="rankingTablePanel"'), "O painel do ranking não isola a largura mínima da tabela.");
assert.ok(
  /\.rankingTablePanel\s*\{[^}]*min-width:\s*0\s*!important;/s.test(styleSource),
  "A largura da tabela ainda pode expandir a página inteira."
);
assert.ok(
  /\.rankingTableScroll\s*\{[^}]*overflow-x:\s*auto\s*!important;/s.test(styleSource),
  "A rolagem horizontal deixou de ficar disponível somente na tabela."
);
assert.ok(
  /\.circuitTournamentOption\s*\{[^}]*position:\s*relative\s*!important;[^}]*min-width:\s*0\s*!important;/s.test(styleSource),
  "O cartão de seleção do circuito não contém o checkbox invisível."
);
assert.ok(
  /\.circuitTournamentOption\s*>\s*input\[type="checkbox"\]\s*\{[^}]*inset:\s*0\s*!important;[^}]*width:\s*100%\s*!important;[^}]*height:\s*100%\s*!important;[^}]*margin:\s*0\s*!important;[^}]*padding:\s*0\s*!important;/s.test(styleSource),
  "O checkbox invisível ainda pode criar rolagem horizontal na página."
);
assert.ok(styleSource.includes(".gameFinished .gameTeams > div.winnerTeam"), "O vencedor não possui contraste próprio após o placar.");
assert.ok(styleSource.includes(".gameFinished .gameTeams > div.loserTeam"), "O perdedor não possui contraste próprio após o placar.");
assert.ok(styleSource.includes('"team1 score1"'), "No celular, cada placar não está alinhado ao respectivo atleta.");
assert.ok(mainSource.includes("function getBrazilianWhatsAppUrl"), "Os links de WhatsApp não possuem normalização brasileira.");
assert.ok(mainSource.includes('digits.startsWith("55") && digits.length >= 12'), "O código do país não é preservado quando já foi informado.");
assert.ok((mainSource.match(/getBrazilianWhatsAppUrl\(/g) || []).length >= 4, "Nem todos os links de WhatsApp usam o código +55 automático.");
assert.ok(mainSource.includes("function isUserAlreadyRegisteredError"), "O cadastro não reconhece e-mails que já possuem conta.");
assert.ok(mainSource.includes("Este e-mail já possui uma conta"), "O cadastro não orienta o usuário a entrar com a conta existente.");
assert.ok(mainSource.includes('id="contato"'), "Os contatos da plataforma não estão visíveis antes do login.");
assert.ok(mainSource.includes("landingTrialBanner"), "O destaque público dos 7 dias grátis está ausente.");
assert.ok(mainSource.includes("function getPlanRegularizationWhatsAppUrl"), "A regularização do plano não possui mensagem própria no WhatsApp.");
assert.ok(mainSource.includes("window.location.assign(regularizationUrl)"), "O acesso vencido não direciona o usuário para o WhatsApp.");
assert.ok(mainSource.includes("Regularizar pelo WhatsApp"), "A tela de acesso vencido não possui alternativa manual para abrir o WhatsApp.");
assert.ok(styleSource.includes("CONTATOS PÚBLICOS, TESTE GRÁTIS E ACESSO VENCIDO"), "Os novos destaques públicos estão sem estilos.");

assert.ok(
  mainSource.includes("const circuitPersistence = await persistCircuitRankings(")
    && mainSource.includes("persistedTournament.id"),
  "O placar pode ser marcado como salvo antes de atualizar o ranking dos circuitos."
);
assert.ok(
  mainSource.includes("rankingHistorySaved = await saveCircuitHistoryToSupabase("),
  "O salvamento do circuito ainda ignora falhas no histórico do ranking."
);
assert.ok(mainSource.includes("function applyCircuitExtraPoints"), "A pontuação extra do circuito não entra no cálculo do ranking.");
assert.ok(mainSource.includes("target.circuitPoints = Number(target.circuitPoints || 0) + entry.points"), "A pontuação extra não é somada ao total principal.");
assert.ok(mainSource.includes('className="confirmOverlay" role="dialog"') && mainSource.includes("Excluir esta pontuação extra?"), "A exclusão da pontuação extra não usa a confirmação segura da plataforma.");
assert.ok(styleSource.includes("button.createCircuitButton") && styleSource.includes("button.combineCircuitsButton"), "As cores semânticas das ações dos circuitos não estão protegidas da regra neutra global.");
assert.ok(mainSource.includes("Somar circuitos"), "A ação para somar circuitos está ausente.");
assert.ok(mainSource.includes("Masculino e feminino"), "O ranking separado das duplas mistas está ausente.");
assert.ok(
  mainSource.includes("if (Number(row.played || 0) <= 0) return;"),
  "Participantes sem jogo válido ainda podem entrar no ranking do circuito."
);
assert.ok(
  mainSource.includes("const games = [...(data.schedule || []).flat(), ...bracketGames];"),
  "O ranking do circuito não soma a fase de grupos e o mata-mata das Copas."
);
assert.ok(
  mainSource.includes('.filter((game) => game.phase === "main")')
    && mainSource.includes("function calculateCircuitPlacementRows")
    && mainSource.includes("function CircuitRankingSettingsEditor")
    && mainSource.includes('role="radiogroup" aria-label="Quem acumula os pontos"')
    && mainSource.includes('className="circuitTieBreakOrder"')
    && mainSource.includes("getCircuitTieBreakLabel(settings)")
    && mainSource.includes('const mainBracketGames = (data.brackets || []).filter((game) => game.phase === "main")')
    && styleSource.includes('button:is(.selected, [aria-checked="true"])')
    && mainSource.includes("Não concedem pontos e nenhum resultado, vitória, game, saldo, título ou colocação das paralelas participa"),
  "O ranking configurável não exclui as paralelas ou perdeu sua configuração explicativa."
);
assert.ok(
  circuitScoringMigration.includes("add column if not exists ranking_settings jsonb")
    && circuitScoringMigration.includes("add column if not exists circuit_points integer")
    && circuitScoringMigration.includes("get_public_arena_bundle_base"),
  "A persistência ou a visualização pública do novo modelo de pontuação está incompleta."
);
assert.ok(
  publicArenaMigration.includes("selected_tournament.value = history.tournament_id::text"),
  "O ranking público ainda pode somar um torneio removido do circuito."
);
assert.ok(
  publicArenaMigration.includes("create table if not exists public.circuit_ranking_history")
    && publicArenaMigration.includes("primary key (user_id, circuit_id, tournament_id, group_key, player_key)"),
  "A persistência do ranking acumulado não cria sua tabela de histórico no Supabase."
);
assert.ok(
  publicArenaMigration.includes("circuit_ranking_history_owner_update")
    && publicArenaMigration.includes("user_id = auth.uid()"),
  "O histórico do ranking do circuito não está protegido por organizador."
);
assert.ok(
  publicArenaMigration.includes("where circuit.ranking_criteria_mode = 'automatic'"),
  "Circuitos automáticos antigos não recebem o critério do torneio vinculado."
);
assert.ok(
  publicArenaMigration.includes("coalesce(linked_tournament.data ->> 'deletedAt', '') = ''"),
  "O ranking público ainda pode somar torneios enviados à lixeira."
);
assert.ok(
  publicArenaMigration.includes("as restrictive")
    && publicArenaMigration.includes("lower(coalesce(status, '')) = 'active'")
    && publicArenaMigration.includes("auth.jwt() -> 'app_metadata' ->> 'role'"),
  "Visitantes ou contas sem acesso ainda podem alterar o perfil da arena."
);
assert.ok(
  publicArenaMigration.includes("profiles_no_direct_insert_guard")
    && publicArenaMigration.includes("with check (false)"),
  "Um visitante autenticado ainda pode criar um perfil diretamente pelo cliente."
);
assert.ok(
  mainSource.includes('["athlete", "visitor", "spectator"].includes(sessionRole)'),
  "Uma conta visitante ainda pode abrir o painel administrativo."
);
assert.ok(
  mainSource.includes("organizer={organizer}"),
  "O torneio público ainda usa somente a cópia antiga dos dados da arena."
);
assert.ok(
  mainSource.includes('className="circuitIdentityHint"'),
  "O circuito não orienta sobre a identidade dos participantes pelo nome."
);
assert.ok(
  publicArenaMigration.includes("'athlete', 'visitor', 'spectator', 'organizer_pending'"),
  "Contas visitantes ou ainda pendentes podem aparecer no diretório público."
);
assert.ok(
  mainSource.includes('.rpc("set_tournament_order", {')
    && mainSource.includes("sortTournamentsByStoredOrder"),
  "A ordem escolhida ao arrastar os torneios não é persistida e recarregada."
);
assert.ok(
  publicArenaMigration.includes("create or replace function public.set_tournament_order"),
  "A ordenação dos torneios não possui uma operação transacional segura."
);
assert.ok(
  mainSource.includes('dragOverTournamentId === t.id')
    && styleSource.includes('content: "Solte aqui"'),
  "O arraste não apresenta um destino visual claro para o organizador."
);
assert.ok(
  styleSource.includes("Ordenação persistente dos cartões de torneio")
    && styleSource.includes(".proDashboard.playAppShell .moveLineBtn span"),
  "A alça de três traços não recebeu o novo contraste visual."
);
assert.ok(
  mainSource.includes('preparedLine.split(/\\s*(?:\\+|&|\\/|-|\\s+[xX]\\s+|\\s+[eE]\\s+)\\s*/u)')
    && mainSource.includes("Espaços dentro do nome continuam sendo nome e sobrenome."),
  "A importação de duplas não reconhece todos os separadores sem preservar nomes compostos."
);
const fixedPairSeparator = /\s*(?:\+|&|\/|-|\s+[xX]\s+|\s+[eE]\s+)\s*/u;
[
  ["Ana + Carla", ["Ana", "Carla"]],
  ["Ana / Carla", ["Ana", "Carla"]],
  ["Ana - Carla", ["Ana", "Carla"]],
  ["Ana e Carla", ["Ana", "Carla"]],
  ["Ana & Carla", ["Ana", "Carla"]],
  ["Ana Maria da Silva", ["Ana Maria da Silva"]],
].forEach(([line, expected]) => {
  assert.deepEqual(
    line.split(fixedPairSeparator),
    expected,
    `A importação interpretou incorretamente a linha: ${line}`
  );
});
assert.ok(
  styleSource.includes("PERFIS E TORNEIOS PÚBLICOS — COMPOSIÇÃO FINAL NO CELULAR")
    && styleSource.includes('grid-template-areas: "back logo access"'),
  "O cabeçalho público móvel não separa navegação, logo e acesso do organizador."
);
assert.ok(
  mainSource.includes("function isRegistrationDeadlineOpen(deadline)")
    && (mainSource.match(/<PublicRegistrationStatus open=\{registrationOpen\}/g) || []).length >= 1
    && !mainSource.includes("isCircuitRegistrationOpen")
    && (mainSource.match(/className=\{`publicCircuitStatus \$\{circuitStatus\}`\}/g) || []).length === 2,
  "Torneios devem mostrar inscrições; circuitos devem mostrar somente andamento ou encerramento."
);
assert.ok(
  mainSource.includes("function getTournamentCompletionState")
    && mainSource.includes("function getTournamentLifecycleStatus")
    && mainSource.includes('requiredGames.every((game) => isTournamentGameFinished(game, winningScore))'),
  "O encerramento do torneio não está vinculado à conclusão dos placares obrigatórios."
);
assert.ok(
  mainSource.includes('item.data?.displayOrderMode === "manual"')
    && mainSource.includes('persistTournamentOrderSequence(list, { manual: true })'),
  "A ordem automática ainda pode ser confundida com uma reorganização manual."
);
assert.ok(
  mainSource.includes('item.data?.multiCategoryEvent === true && item.data?.eventGroupKey')
    && mainSource.includes('const eventGroupKey = isMultiCategory ? generatePublicId() : null;')
    && mainSource.includes('categoryTournamentCard'),
  "Eventos independentes ainda podem ser agrupados ou as categorias não possuem configuração própria."
);
assert.ok(
  mainSource.includes("function AppUpdateNotice")
    && mainSource.includes('/app-version.json?t=')
    && packageJson.scripts?.prebuild === "node scripts/write-build-version.mjs"
    && typeof appVersion.version === "string",
  "O app instalado não possui verificação profissional de novas versões."
);
const expandedCircuitLayout = styleSource.match(/\.circuitManagerPage \.circuitItem\.expanded \{([\s\S]*?)\}/)?.[1] || "";
assert.ok(
  expandedCircuitLayout.includes("position: relative")
    && !expandedCircuitLayout.includes("position: fixed")
    && !expandedCircuitLayout.includes("100vmax"),
  "O circuito expandido voltou a ser exibido como uma camada sobreposta ao painel."
);
const eventEditorLayout = styleSource.match(/\.eventEditorOverlay \{([\s\S]*?)\}/)?.[1] || "";
assert.ok(
  eventEditorLayout.includes("position: relative")
    && !eventEditorLayout.includes("position: fixed")
    && !eventEditorLayout.includes("backdrop-filter: blur"),
  "A criação de torneios e circuitos voltou a cobrir o painel com uma janela sobreposta."
);
assert.ok(
  styleSource.includes(".proDashboard .circuitStatus-closed")
    && styleSource.includes(".publicCircuitStatus.closed")
    && styleSource.includes("#f97316"),
  "O status encerrado dos circuitos não recebeu a identificação laranja."
);
assert.ok(
  mainSource.includes('const [tournamentStatusFilter, setTournamentStatusFilter] = useState("active")')
    && mainSource.includes('const [circuitStatusFilter, setCircuitStatusFilter] = useState("active")')
    && mainSource.includes('aria-pressed={tournamentStatusFilter === "finished"}')
    && mainSource.includes('aria-pressed={circuitStatusFilter === "upcoming"}')
    && mainSource.includes("function getCircuitLifecycleStatus(circuit)"),
  "Os status de torneios e circuitos não funcionam como filtros completos."
);
assert.ok(
  styleSource.includes(".tournamentStatusSummary button.finished.selected")
    && styleSource.includes("background: #8b5cf6 !important")
    && styleSource.includes("background: #22c55e !important")
    && styleSource.includes("background: #fb923c !important")
    && styleSource.includes(".proDashboard .eventManagerToolbar > button")
    && styleSource.includes("linear-gradient(135deg, #fb923c, #f97316) !important"),
  "As cores dos filtros ou o destaque laranja dos botões de criação foram sobrescritos."
);
const circuitActionsPosition = mainSource.indexOf('className="circuitItemActions circuitItemActionsTop"');
const circuitRankingPosition = mainSource.indexOf('className="circuitRankingBox"', circuitActionsPosition);
assert.ok(
  circuitActionsPosition >= 0
    && circuitRankingPosition > circuitActionsPosition
    && styleSource.includes("border-bottom: 1px solid var(--ui-border-soft) !important"),
  "Editar e excluir circuito precisam aparecer antes do ranking no circuito expandido."
);
assert.ok(
  mainSource.includes("setTournaments(optimisticTournaments)")
    && mainSource.includes("setTournaments(remainingTournaments)")
    && mainSource.includes("setTrashTournaments((current) => [")
    && mainSource.includes("protectConcurrentData: true")
    && mainSource.includes('directoryUpdate = directoryUpdate.eq("updated_at", item.updated_at)'),
  "Criar e mover para a lixeira voltaram a aguardar sincronizações secundárias antes de atualizar a tela."
);
assert.ok(
  mainSource.includes("Quero me inscrever em")
    && mainSource.includes("registrationDeadline: details.registrationDeadline || \"\"")
    && styleSource.includes("PERFIL PÚBLICO DA ARENA — INSCRIÇÕES E MOBILE FINAL"),
  "A inscrição pública não preserva a data limite ou não encaminha ao WhatsApp da arena."
);
assert.ok(
  styleSource.includes(".publicPage.publicArenaPage .publicArenaHeader")
    && styleSource.includes("grid-template-columns: minmax(0, 1fr) !important;")
    && styleSource.includes("overflow-wrap: break-word !important;"),
  "O perfil público ainda pode comprimir o nome da arena no celular."
);
assert.ok(
  styleSource.includes("grid-template-columns: minmax(410px, 0.8fr) minmax(0, 1.2fr) !important;")
    && styleSource.includes("padding: 18px clamp(28px, 5vw, 84px) !important;"),
  "O cabeçalho do perfil público ainda ocupa altura excessiva no notebook."
);
assert.ok(
  styleSource.includes("grid-template-columns: minmax(240px, 0.58fr) minmax(0, 1.42fr) minmax(190px, auto) !important;")
    && styleSource.includes(".publicHeaderWithLogo:not(.publicArenaHeader)"),
  "O cabeçalho público do torneio ainda está desorganizado no notebook."
);
assert.ok(
  mainSource.includes("const saveQueueRef = useRef(Promise.resolve(true))")
    && mainSource.includes("queueTournamentSave(latestDataRef.current"),
  "As gravações do torneio podem terminar fora de ordem e sobrescrever dados mais novos."
);
assert.ok(
  mainSource.includes("function saveTournamentDraft(")
    && mainSource.includes("serverRevisionRef.current")
    && mainSource.includes("readTournamentDraft(userId, tournament)")
    && offlineStoreSource.includes('const PENDING_TOURNAMENT_STORE = "pending_tournaments"'),
  "Placares e confrontos ainda não possuem backup local durante uma falha de conexão."
);
assert.ok(
  mainSource.includes('.channel(`torneio360-collaboration-${user.id}`)')
    && mainSource.includes('"postgres_changes"')
    && mainSource.includes("syncPendingTournamentDrafts")
    && mainSource.includes('.eq("updated_at", expectedUpdatedAt)'),
  "Alterações simultâneas ainda podem sobrescrever uma versão mais nova sem sincronização."
);
assert.ok(
  collaborationMigration.includes("create or replace function public.replace_circuit_ranking_history")
    && collaborationMigration.includes("create or replace function public.set_tournament_order_safe")
    && collaborationMigration.includes("p_source_versions jsonb")
    && collaborationMigration.includes("tournament.updated_at is not distinct from source_version.updated_at")
    && collaborationMigration.includes("alter publication supabase_realtime add table"),
  "A migração não protege operações compostas ou não habilita atualização em tempo real."
);
assert.ok(
  serviceWorkerSource.includes('const STATIC_CACHE = "torneio360-app-shell-v3"')
    && serviceWorkerSource.includes("async function cacheApplicationShell()")
    && serviceWorkerSource.includes('path.startsWith("/assets/")')
    && serviceWorkerSource.includes('event.request.mode === "navigate"')
    && serviceWorkerSource.includes('await caches.match("/")'),
  "O aplicativo não possui uma base offline para reabrir a interface sem conexão."
);

const nonOverlappingMerge = mergeConcurrentTournamentData(
  { name: "Torneio", settings: { court: "1", category: "A" } },
  { name: "Torneio local", settings: { court: "1", category: "A" } },
  { name: "Torneio", settings: { court: "2", category: "A" } }
);
assert.deepEqual(nonOverlappingMerge.conflicts, [], "Campos diferentes deveriam ser unidos automaticamente.");
assert.equal(nonOverlappingMerge.data.name, "Torneio local");
assert.equal(nonOverlappingMerge.data.settings.court, "2");

const scoreMerge = mergeConcurrentTournamentData(
  { scores: [{ home: 0, away: 0 }, { home: 0, away: 0 }] },
  { scores: [{ home: 6, away: 2 }, { home: 0, away: 0 }] },
  { scores: [{ home: 0, away: 0 }, { home: 4, away: 6 }] }
);
assert.deepEqual(scoreMerge.conflicts, [], "Placares de jogos diferentes deveriam ser unidos automaticamente.");
assert.deepEqual(scoreMerge.data.scores, [{ home: 6, away: 2 }, { home: 4, away: 6 }]);

const sameFieldConflict = mergeConcurrentTournamentData(
  { score: 0 },
  { score: 6 },
  { score: 7 }
);
assert.deepEqual(sameFieldConflict.conflicts, ["score"], "O mesmo campo alterado em dois dispositivos deve gerar conflito explícito.");
assert.equal(sameFieldConflict.data.score, 6, "A alteração que está sendo salva por último deve prevalecer automaticamente.");

const createSuper20Data = () => ({
  players: {
    men: Array.from({ length: 10 }, (_, index) => `Homem ${index + 1}`),
    women: Array.from({ length: 10 }, (_, index) => `Mulher ${index + 1}`),
  },
  schedule: super20MixedTemplate.map((round) => round.map((players, courtIndex) => ({
    court: courtIndex + 1,
    ids1: [players[0] - 1, players[1] - 1],
    ids2: [players[2] - 1, players[3] - 1],
    team1: [],
    team2: [],
    s1: "",
    s2: "",
  }))),
  brackets: [],
});
const super20BaseData = createSuper20Data();
const super20LocalData = structuredClone(super20BaseData);
const super20RemoteData = structuredClone(super20BaseData);
super20LocalData.schedule[2][3].s1 = 6;
super20LocalData.schedule[2][3].s2 = 4;
super20RemoteData.schedule[7][1].s1 = 3;
super20RemoteData.schedule[7][1].s2 = 6;
const super20ConcurrentMerge = mergeConcurrentTournamentData(
  super20BaseData,
  super20LocalData,
  super20RemoteData
);
assert.equal(super20ConcurrentMerge.data.schedule.length, 10, "A sincronização não pode reduzir as rodadas do Super 20.");
assert.ok(
  super20ConcurrentMerge.data.schedule.every((round) => round.length === 5),
  "A sincronização não pode reduzir os cinco jogos de cada rodada do Super 20."
);
assert.deepEqual(
  [super20ConcurrentMerge.data.schedule[2][3].s1, super20ConcurrentMerge.data.schedule[2][3].s2],
  [6, 4],
  "O placar alterado no primeiro aparelho deve permanecer."
);
assert.deepEqual(
  [super20ConcurrentMerge.data.schedule[7][1].s1, super20ConcurrentMerge.data.schedule[7][1].s2],
  [3, 6],
  "O placar alterado no segundo aparelho deve permanecer."
);
const reorderedSuper20Data = structuredClone(super20BaseData);
[reorderedSuper20Data.schedule[2][0], reorderedSuper20Data.schedule[2][1]] = [
  reorderedSuper20Data.schedule[2][1],
  reorderedSuper20Data.schedule[2][0],
];
const structuralSuper20Merge = mergeConcurrentTournamentData(
  super20BaseData,
  super20LocalData,
  reorderedSuper20Data
);
assert.deepEqual(
  structuralSuper20Merge.data.schedule[2],
  super20LocalData.schedule[2],
  "Uma tabela reorganizada não pode receber placares por índice em confrontos diferentes."
);
const roundReorderedSuper20Data = structuredClone(super20BaseData);
[roundReorderedSuper20Data.schedule[0], roundReorderedSuper20Data.schedule[1]] = [
  roundReorderedSuper20Data.schedule[1],
  roundReorderedSuper20Data.schedule[0],
];
const roundStructuralMerge = mergeConcurrentTournamentData(
  super20BaseData,
  super20LocalData,
  roundReorderedSuper20Data
);
assert.deepEqual(
  roundStructuralMerge.data.schedule,
  super20LocalData.schedule,
  "A troca de rodadas não pode criar uma tabela híbrida nem duplicar confrontos."
);
assert.equal(
  preservesTournamentCriticalData(super20LocalData, reorderedSuper20Data),
  false,
  "A protecao deve rejeitar uma reparacao que troca os confrontos do Super 20."
);
const bracketBase = {
  brackets: [{
    matchKey: "final",
    source1: "semi-1",
    source2: "semi-2",
    team1: ["Ana", "Bia"],
    team2: ["Clara", "Duda"],
    s1: "",
    s2: "",
  }],
};
const bracketLocal = structuredClone(bracketBase);
bracketLocal.brackets[0].s1 = 6;
bracketLocal.brackets[0].s2 = 4;
const bracketRemote = structuredClone(bracketBase);
bracketRemote.brackets[0].source1 = "semi-3";
bracketRemote.brackets[0].team1 = ["Eva", "Fabi"];
const bracketStructuralMerge = mergeConcurrentTournamentData(bracketBase, bracketLocal, bracketRemote);
assert.deepEqual(
  bracketStructuralMerge.data.brackets,
  bracketLocal.brackets,
  "Um placar nao pode ser reaproveitado em participantes diferentes da mesma chave."
);
assert.ok(
  preservesTournamentCriticalData(super20LocalData, structuredClone(super20LocalData)),
  "Uma normalização segura deve preservar todos os placares do Super 20."
);
const unsafeSuper20Repair = structuredClone(super20LocalData);
unsafeSuper20Repair.schedule[2][3].s1 = "";
assert.equal(
  preservesTournamentCriticalData(super20LocalData, unsafeSuper20Repair),
  false,
  "Uma reparação que apaga placar do Super 20 precisa ser bloqueada."
);
assert.ok(
  serverRevisionMigration.includes("add column if not exists revision bigint not null default 0")
    && serverRevisionMigration.includes("new.revision := coalesce(old.revision, 0) + 1")
    && serverRevisionMigration.includes("new.updated_at := clock_timestamp()")
    && serverRevisionMigration.includes("add column if not exists last_change_id uuid"),
  "A versão de concorrência ainda depende do relógio dos aparelhos."
);
assert.ok(
  serverRevisionMigration.includes("create trigger tournaments_bump_collaboration_revision")
    && serverRevisionMigration.includes("create trigger circuits_bump_collaboration_revision"),
  "As revisões do servidor não estão ligadas às tabelas de torneios e circuitos."
);
assert.ok(
  mainSource.includes('.eq("revision", expectedRevision)')
    && mainSource.includes("selectedRef.current")
    && mainSource.includes("Sincronizando a alteração mais recente...")
    && !mainSource.includes("Qual versão deseja manter?")
    && !mainSource.includes("Usar versão da nuvem")
    && !mainSource.includes("Manter versão deste aparelho"),
  "A sincronização ainda pode pedir escolha manual ou aceitar uma versão antiga."
);
assert.ok(
  mainSource.includes("function ConfirmRegenerationModal")
    && mainSource.includes("function requestShuffleNames()")
    && mainSource.includes("function requestGenerate()")
    && mainSource.includes("function requestGenerateBrackets()")
    && mainSource.includes('action: "shuffle"')
    && mainSource.includes('action: "generate"')
    && mainSource.includes('action: "brackets"')
    && mainSource.includes('action: "group-score"')
    && mainSource.includes("Placares e resultados já preenchidos nas chaves podem ser removidos."),
  "A repetição de sorteios ou gerações não pede confirmação sobre os dados que podem mudar."
);
assert.ok(
  mainSource.includes("function FormatExplanationButton")
    && mainSource.includes("function SimpleFormatInfoButton")
    && mainSource.includes("Como funciona com ${playerCount} jogadores")
    && !mainSource.includes('<div className="infoBox">\n          <p><strong>Todos contra todos:</strong>'),
  "A modalidade Simples não está usando o mesmo padrão roxo de explicação dos demais formatos."
);
assert.ok(
  mainSource.includes("function ParallelDisputeChoice")
    && mainSource.includes("Realizar {ordinal} disputa paralela?")
    && mainSource.includes("secondRepechageEnabled: null")
    && mainSource.includes("thirdRepechageEnabled: null")
    && mainSource.includes('Object.prototype.hasOwnProperty.call(sourceCupConfig, "secondRepechageEnabled")')
    && mainSource.includes("function ensureCearenseParallelChoices")
    && mainSource.includes("isCearenseSecondParallelEnabled(data)")
    && mainSource.includes("isCearenseThirdParallelEnabled(data)"),
  "As escolhas obrigatórias das disputas paralelas ou a compatibilidade com torneios antigos estão incompletas."
);
assert.ok(
  mainSource.includes("parallelOpeningRound: getEliminationRoundName(parallelBracketSize)")
    && mainSource.includes("const thirdParallelSources = thirdParallelPlan")
    && mainSource.includes("const thirdParallel = {")
    && mainSource.includes("Todos os 3º colocados são ordenados primeiro")
    && mainSource.includes("summary.thirdParallel.sourceRound")
    && mainSource.includes("summary.thirdParallel.matchCount")
    && mainSource.includes("O que acontece ao escolher Sim ou Não"),
  "As explicações das disputas paralelas deixaram de detalhar participantes, ordem, chave, BYEs ou efeitos da escolha."
);
assert.ok(
  mainSource.includes('phase === "repechage" && !isCearenseSecondParallelEnabled(data)')
    && mainSource.includes('phase === "thirdParallel" && !isCearenseThirdParallelEnabled(data)')
    && mainSource.includes("const secondParallelVisible = isCearenseSecondParallelEnabled(data)")
    && mainSource.includes("const thirdParallelVisible = isCearenseThirdParallelEnabled(data)")
    && styleSource.includes(".parallelChoiceCard")
    && styleSource.includes(".parallelChoiceOptions button.selected.yes")
    && styleSource.includes("html[data-theme=\"dark\"] .parallelChoiceOptions button.selected.no"),
  "Disputas desativadas ainda podem aparecer, bloquear o encerramento ou perder a adaptação de tema."
);
assert.ok(
  mainSource.includes("const SHUFFLE_DURATION_SECONDS = 5")
    && mainSource.includes("function moveShuffleAnimationItems(items)")
    && mainSource.includes("items: moveShuffleAnimationItems(prev.items)")
    && mainSource.includes("window.innerWidth <= 760")
    && mainSource.includes("{shuffleOverlay && createPortal(")
    && styleSource.includes("z-index: 20000")
    && styleSource.includes("animation: shuffleProgressFill 5s linear forwards")
    && styleSource.includes("max-width: 29vw"),
  "O sorteio visual não está animado por 5 segundos ou ainda pode ficar coberto no celular."
);
assert.ok(
  mainSource.includes("function createShuffleVideoSnapshot")
    && mainSource.includes("function createShuffleVideoFile")
    && mainSource.includes("function ShuffleVideoModal")
    && mainSource.includes("function getShuffleVideoMotionOrder")
    && mainSource.includes("const previousOrder = getShuffleVideoMotionOrder")
    && mainSource.includes("const nextOrder = getShuffleVideoMotionOrder")
    && mainSource.includes("copy.lastShuffleVideo = videoSnapshot")
    && mainSource.includes("Continuar sem gerar")
    && mainSource.includes("Baixar vídeo")
    && !mainSource.includes("Compartilhar vídeo")
    && !mainSource.includes("function shareShuffleVideo")
    && mainSource.includes("const SHUFFLE_VIDEO_WIDTH = 720")
    && mainSource.includes("const SHUFFLE_VIDEO_HEIGHT = 1280")
    && styleSource.includes(".shuffleVideoOverlay")
    && styleSource.includes("html[data-theme=\"dark\"] .shuffleVideoModal")
    && styleSource.includes("width: min(240px, 72vw)")
    && styleSource.includes("max-height: calc(100dvh - 20px)")
    && styleSource.includes("html[data-theme=\"dark\"] .confirmBox"),
  "O vídeo do sorteio perdeu o embaralhamento real, o download confiável, o formato vertical ou a adaptação dos modais aos temas e ao celular."
);
assert.ok(
  styleSource.includes("JOGOS NO CELULAR — CABEÇALHO EM DUAS LINHAS")
    && styleSource.includes('"match-meta"')
    && styleSource.includes('"match-controls"')
    && styleSource.includes('"match-teams"')
    && styleSource.includes("padding-bottom: calc(92px + env(safe-area-inset-bottom)) !important"),
  "Os cartões dos jogos podem voltar a sobrepor fase, status, quadra e chamada no celular."
);
assert.ok(
  mainSource.includes("Salvando antes de sair...")
    && mainSource.includes("A tela foi mantida aberta para proteger placares, confrontos e rankings"),
  "O torneio pode ser fechado antes de concluir o último salvamento."
);
assert.ok(
  mainSource.includes("function TournamentCircuitManagerModal")
    && mainSource.includes("+ Adicionar ao circuito")
    && mainSource.includes("Gerenciar circuitos")
    && mainSource.includes("saveTournamentCircuitMembership")
    && mainSource.includes("Criar novo circuito com este torneio")
    && styleSource.includes(".tournamentCircuitOverlay")
    && styleSource.includes("max-height: calc(100dvh - 20px)")
    && styleSource.includes('html[data-theme="dark"] .tournamentCircuitDialog'),
  "O atalho do ranking para circuitos perdeu o gerenciamento, a criação guiada ou a adaptação aos temas e ao celular."
);
assert.ok(
  mainSource.includes("manualParticipants: sourceManualParticipants.map")
    && mainSource.includes("function applyCircuitManualParticipants")
    && mainSource.includes('Adicionar ${participantLabel} manualmente')
    && mainSource.includes("Participantes e resultados complementares")
    && mainSource.includes("Somar ao atleta existente?")
    && mainSource.includes("Cadastros manuais")
    && mainSource.includes("applyCircuitManualParticipants(groups, rankingSettings)")
    && mainSource.includes("getCircuitPlacementColumns(rankingSettings, { includeManual: true })")
    && !mainSource.includes('columns.push({ key: "manualPoints", label: "Manual" })')
    && styleSource.includes(".circuitManualParticipantContent")
    && styleSource.includes("--bracket-node-height: 226px"),
  "A inclusão manual no ranking ou o espaçamento seguro dos confrontos ficou incompleto."
);
assert.ok(
  publicArenaMigration.includes("jsonb_set(")
    && publicArenaMigration.includes("'{displayOrder}'"),
  "A reordenação pode substituir o objeto do torneio em vez de preservar placares e confrontos."
);

for (const logoPath of ["public/torneio360-logo.png", "public/torneio360-logo-blue.png"]) {
  assert.ok(existsSync(fileURLToPath(new URL(logoPath, root))), `Asset obrigatório ausente: ${logoPath}`);
}

for (const iconPath of [
  "public/torneio360-profile.png",
  "public/torneio360-favicon-96.png",
  "public/torneio360-apple-touch-icon.png",
  "public/torneio360-app-icon-192.png",
  "public/torneio360-app-icon-512.png",
  "public/sw.js",
]) {
  assert.ok(existsSync(fileURLToPath(new URL(iconPath, root))), `Asset instalável ausente: ${iconPath}`);
}

for (const [name, version] of Object.entries(packageJson.dependencies ?? {})) {
  assert.notEqual(version, "latest", `A dependência ${name} ainda usa latest.`);
  assert.ok(!/[xX*]/.test(version), `A dependência ${name} não está fixada: ${version}`);
}

console.log("Smoke check concluído: autenticação, torneios, circuitos, ranking, compartilhamento e entrada visual estão presentes.");
