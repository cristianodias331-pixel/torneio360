import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { orderFixedMixedPair } from "../src/fixedMixedTeamOrder.mjs";
import { super12IndividualTemplate } from "../src/super12Schedule.mjs";
import { super20MixedTemplate } from "../src/super20MixedSchedule.mjs";
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
const offlineStoreSource = readFileSync(new URL("src/offlineDataStore.mjs", root), "utf8");
const serviceWorkerSource = readFileSync(new URL("public/sw.js", root), "utf8");

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
  "Super 6 (dupla fixa)",
  "Super 8",
  "Super 8 (dupla fixa)",
  "Super 12",
  "Super 10 mista",
  "Super 12 mista",
  "Super 16 mista",
  "Super 20 mista",
  "Simples 8 (1 contra 1 por jogo)",
  "Torneio modelo Campeonato Cearense",
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

assert.ok(mainSource.includes('type: "playranking"'), "A configuração do Modelo Play Ranking está ausente.");
assert.ok(mainSource.includes("function getPlayRankingOpeningLosses"), "A transferência das derrotadas da primeira fase está ausente.");
assert.ok(mainSource.includes("function buildPlayRankingParallelRounds"), "A chave paralela especial do Modelo Play Ranking está ausente.");
assert.ok(mainSource.includes("function TournamentFormatInfoButton"), "A explicação dinâmica dos modelos está ausente.");
assert.ok(mainSource.includes("getCearenseFormatSummary(teamCount, isPlayRanking)"), "A explicação não acompanha a quantidade escolhida.");
assert.ok(mainSource.includes("publicView />"), "A explicação do formato não está acessível ao visitante.");
assert.ok(styleSource.includes(".formatInfoDialog"), "A explicação dinâmica está sem acabamento responsivo.");

assert.ok(
  mainSource.includes("function rankOfficialCearenseGroupRows")
    && mainSource.includes("function getOfficialCearenseQualified")
    && mainSource.includes("const cearenseMainBracketPlans")
    && mainSource.includes("function expandBracketPlanWithVisualByes")
    && mainSource.includes("isBye: Boolean(firstEntry) !== Boolean(secondEntry)")
    && mainSource.includes("realQuarterfinalGames.length === 4")
    && mainSource.includes("realQuarterfinalGames.length === 2")
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
assert.ok(mainSource.includes('<h2>Ranking geral acumulado</h2>'), "O ranking público do circuito não usa o título acumulado correto.");
assert.ok(mainSource.includes('tournaments={tournaments}'), "O ranking público do circuito não recebe os torneios para cálculo imediato.");
assert.ok(mainSource.includes('className="publicCircuitName"'), "O nome do circuito não recebe destaque no ranking público.");
assert.ok(mainSource.includes('pts: "Total de Games"'), "A coluna de games ainda usa a nomenclatura antiga.");
assert.ok(!/\bpontos\b/i.test(mainSource), "A nomenclatura Pontos ainda aparece na interface.");
assert.ok(
  mainSource.includes("const stats = criteria.order")
    && mainSource.includes("`Critério: ${criteria.label}`"),
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
assert.ok(mainSource.includes(': "Compartilhar ranking";'), "O botão compacto não identifica que compartilha o ranking.");
assert.ok(
  mainSource.includes('const [newRankingCriteria, setNewRankingCriteria] = useState("");')
    && mainSource.includes('showNotice("warning", "Critério obrigatório"')
    && mainSource.includes('<option value="">Escolha a ordem dos critérios</option>')
    && mainSource.includes('rankingCriteria: newRankingCriteria,'),
  "A criação do torneio ainda permite salvar sem escolher explicitamente o critério do ranking."
);
assert.ok(mainSource.includes('allowedTeamCounts: Array.from({ length: 29 }, (_, index) => index + 4)'), "O Campeonato Cearense não aceita todas as quantidades de 4 a 32 duplas.");
assert.ok(mainSource.includes('function createCearenseGroups(teamCount)'), "A distribuição própria de grupos do Campeonato Cearense está ausente.");
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
  mainSource.includes("const rankingHistorySaved = await saveCircuitHistoryToSupabase("),
  "O salvamento do circuito ainda ignora falhas no histórico do ranking."
);
assert.ok(
  mainSource.includes("if (Number(row.played || 0) <= 0) return;"),
  "Participantes sem jogo válido ainda podem entrar no ranking do circuito."
);
assert.ok(
  mainSource.includes("const games = [...(data.schedule || []).flat(), ...bracketGames];"),
  "O ranking do circuito não soma a fase de grupos e o mata-mata das Copas."
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
