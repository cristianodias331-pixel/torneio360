import {
  createMemberProfileFallback,
  MAX_MEMBER_GALLERY_PHOTOS,
  normalizeMemberHandle,
  normalizeMemberGalleryPhotos,
  normalizeMemberProfile,
  toMemberProfileRpcPayload,
  validateMemberProfile,
} from "../src/domain/memberProfile.mjs";
import {
  createAthleteChallenge,
  loadMyAthleteActivity,
  loadPublicAthleteActivity,
} from "../src/services/athleteActivityApi.mjs";
import { loadMySocialGraph, setProfileFollow } from "../src/services/socialGraphApi.mjs";
import { getOrganizationSubscriptionWhatsAppUrl } from "../src/domain/contactLinks.mjs";
import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const fallback = createMemberProfileFallback({
  user: { id: "member-1", email: "pessoa@teste.com" },
  accessProfile: { name: "Pessoa Teste" },
});

assert(fallback.displayName === "Pessoa Teste", "O perfil legado deve preencher somente o nome pessoal inicial.");
assert(fallback.photoUrl === "", "A foto da arena não deve virar foto pessoal.");
assert(fallback.galleryPhotos.length === 0, "A galeria deve começar vazia.");
assert(fallback.followersCount === 0, "O perfil deve começar sem seguidores artificiais.");
assert(normalizeMemberHandle(" @Meu Nome ") === "meunome", "O nome de usuário deve ser normalizado.");
assert(normalizeMemberGalleryPhotos(["foto-1.webp", "", "foto-2.webp"]).length === 2, "A galeria deve ignorar posições vazias.");
const subscriptionWhatsAppUrl = getOrganizationSubscriptionWhatsAppUrl({ email: "atleta@teste.com" });
assert(subscriptionWhatsAppUrl.startsWith("https://wa.me/5585988739056"), "A assinatura da organização deve usar o WhatsApp oficial da plataforma.");
assert(decodeURIComponent(subscriptionWhatsAppUrl).includes("atleta@teste.com"), "O pedido de assinatura deve identificar a conta do atleta.");

const validation = validateMemberProfile({
  ...fallback,
  handle: "pessoa.teste",
  coverUrl: "https://example.test/capa.webp",
  sportsCategory: "Iniciante",
  sports: ["Beach Tennis", "Vôlei"],
  gender: "Masculino",
  dominantHand: "Destro",
  whatsapp: "85999999999",
  telegram: "pessoa_teste",
  instagram: "pessoa.teste",
  showContacts: true,
  galleryPhotos: ["https://example.test/foto-1.webp", "https://example.test/foto-2.webp"],
  isPublic: false,
});
assert(validation.valid, "O perfil válido deve passar pela validação.");
assert(validation.profile.isPublic === true, "O perfil esportivo deve permanecer público.");

const missingSports = validateMemberProfile({ ...fallback, gender: "Feminino", sports: [] });
assert(!missingSports.valid && missingSports.errors.sports, "O atleta deve escolher pelo menos uma modalidade.");

const rpcPayload = toMemberProfileRpcPayload(validation.profile);
assert(rpcPayload.p_display_name === "Pessoa Teste", "O nome deve chegar ao RPC.");
assert(rpcPayload.p_handle === "pessoa.teste", "O identificador deve chegar ao RPC.");
assert(rpcPayload.p_cover_url.endsWith("capa.webp"), "A capa deve chegar ao RPC.");
assert(rpcPayload.p_sports_category === "Iniciante", "A categoria deve chegar ao RPC.");
assert(rpcPayload.p_sports.join(",") === "Beach Tennis,Vôlei", "As modalidades escolhidas devem chegar ao RPC.");
assert(rpcPayload.p_gender === "Masculino", "A categoria esportiva obrigatória deve chegar ao RPC.");
assert(rpcPayload.p_dominant_hand === "Destro", "A mão dominante deve chegar ao RPC.");
assert(rpcPayload.p_whatsapp === "85999999999", "O contato autorizado deve chegar ao RPC privado.");
assert(rpcPayload.p_show_contacts === true, "A autorização de contato deve chegar ao RPC.");

const databaseProfile = normalizeMemberProfile({
  user_id: "member-1",
  display_name: "Nome no banco",
  photo_url: "foto.webp",
  cover_url: "capa.webp",
  gallery_photos: ["foto-1.webp", "foto-2.webp"],
  followers_count: 32,
  sports_category: "Iniciante",
  sports: ["Tênis", "Pickleball"],
  gender: "Feminino",
  dominant_hand: "Destro",
  show_contacts: true,
  is_public: false,
}, fallback);
assert(databaseProfile.displayName === "Nome no banco", "O retorno do banco deve ser normalizado.");
assert(databaseProfile.isPublic === true, "O perfil armazenado deve ser tratado como público.");
assert(databaseProfile.galleryPhotos.length === 2, "As fotos públicas devem ser normalizadas.");
assert(databaseProfile.followersCount === 32, "A contagem de seguidores deve ser normalizada.");
assert(databaseProfile.sportsCategory === "Iniciante", "A categoria armazenada deve ser normalizada.");
assert(databaseProfile.sports.join(",") === "Tênis,Pickleball", "As modalidades armazenadas devem ser normalizadas.");
assert(databaseProfile.gender === "Feminino", "A categoria esportiva armazenada deve ser normalizada.");
assert(databaseProfile.dominantHand === "Destro", "A mão dominante armazenada deve ser normalizada.");

const galleryOverflow = validateMemberProfile({
  ...fallback,
  galleryPhotos: Array.from({ length: MAX_MEMBER_GALLERY_PHOTOS + 1 }, (_, index) => `foto-${index}.webp`),
});
assert(!galleryOverflow.valid, "A sétima foto deve ser rejeitada.");

const activityCalls = [];
const activitySupabase = {
  rpc: async (name, payload) => {
    activityCalls.push({ name, payload });
    if (name === "get_my_registration_workflows") {
      return { data: [{ id: "registration-1", workflow_status: "submitted" }], error: null };
    }
    if (name === "get_my_athlete_achievements" || name === "get_athlete_achievements") {
      return { data: [], error: null };
    }
    return { data: { registrations: [{ id: "registration-1" }], circuits: [], circuit_achievements: [{ id: "circuit-achievement-1" }], partner_matches: [], challenges: [] }, error: null };
  },
};
const ownActivityResult = await loadMyAthleteActivity({
  supabase: activitySupabase,
});
const publicActivityResult = await loadPublicAthleteActivity({
  supabase: activitySupabase,
  userId: "member-1",
});
assert(activityCalls[0].name === "get_my_registration_workflows", "O próprio perfil deve carregar o estado da inscrição e do comprovante.");
assert(activityCalls.some((call) => call.name === "get_my_athlete_activity"), "O próprio perfil deve carregar inscrições, duplas e desafios.");
assert(activityCalls.some((call) => call.name === "get_my_athlete_achievements"), "O próprio perfil deve carregar somente conquistas oficiais.");
const publicActivityCall = activityCalls.find((call) => call.name === "get_public_athlete_activity");
assert(publicActivityCall, "O visitante deve carregar somente participações públicas.");
assert(publicActivityCall.payload.p_user_id === "member-1", "A atividade pública deve permanecer vinculada ao atleta visitado.");
assert(activityCalls.some((call) => call.name === "get_athlete_achievements" && call.payload.p_user_id === "member-1"), "O visitante deve carregar os pódios confirmados do atleta visitado.");
assert(ownActivityResult.activity.registrations.length === 1, "As inscrições do atleta devem chegar à aba Torneios/Circuitos.");
assert(ownActivityResult.activity.registrations[0].workflow_status === "submitted", "O atleta deve acompanhar o comprovante em análise.");
assert(ownActivityResult.activity.circuitAchievements.length === 1, "As conquistas de circuitos devem permanecer separadas dos pódios de torneios.");
assert(publicActivityResult.activity.registrations.length === 1, "As participações confirmadas devem chegar ao perfil público.");

let expandedChallengePayload = null;
await createAthleteChallenge({
  supabase: {
    rpc: async (name, payload) => {
      assert(name === "create_athlete_challenge", "A criação expandida deve usar o RPC próprio da V2.");
      expandedChallengePayload = payload;
      return { data: { id: "challenge-1" }, error: null };
    },
  },
  challengedUserId: "member-2",
  challengeType: "podium_goal",
  goalPeriod: "3_months",
});
assert(expandedChallengePayload.p_goal_period === "3_months" && expandedChallengePayload.p_doubles_category_mode === null, "A Meta de pódios deve salvar o período escolhido.");

const socialCalls = [];
const socialSupabase = {
  rpc: async (name, payload) => {
    socialCalls.push({ name, payload });
    return { data: { identity_kind: "athlete", followers_count: 2, following_count: 1, followers: [], following: [{ user_id: "organization-2", kind: "organization", is_following: true }] }, error: null };
  },
};
const socialGraph = await loadMySocialGraph({ supabase: socialSupabase, identityKind: "athlete" });
assert(socialGraph.followersCount === 2 && socialGraph.followingCount === 1, "Seguidores e seguindo devem ser carregados para a identidade ativa.");
await setProfileFollow({ supabase: socialSupabase, followerKind: "athlete", followedUserId: "organization-2", followedKind: "organization", follow: false });
assert(socialCalls[1].payload.p_follower_kind === "athlete" && socialCalls[1].payload.p_followed_kind === "organization" && socialCalls[1].payload.p_follow === false, "Seguir e deixar de seguir deve preservar as duas identidades envolvidas.");

const unavailableActivity = await loadMyAthleteActivity({
  supabase: {
    rpc: async () => ({ data: null, error: { code: "PGRST202", message: "get_my_athlete_activity" } }),
  },
});
assert(unavailableActivity.schemaAvailable === false, "A interface deve preservar os dados quando a migração ainda não estiver aplicada.");

const memberPresentationSource = await readFile(new URL("../src/features/profile/MemberProfilePresentation.jsx", import.meta.url), "utf8");
const athleteActivitySource = await readFile(new URL("../src/features/profile/AthleteProfileActivity.jsx", import.meta.url), "utf8");
const athleteExperienceSource = await readFile(new URL("../src/features/profile/AthleteProfileExperience.jsx", import.meta.url), "utf8");
const organizationPresentationSource = await readFile(new URL("../src/features/profile/OrganizationProfilePresentation.jsx", import.meta.url), "utf8");
const organizerWorkspaceSource = await readFile(new URL("../src/OrganizerWorkspace.jsx", import.meta.url), "utf8");
const memberProfileWorkspaceSource = await readFile(new URL("../src/features/profile/MemberProfileWorkspace.jsx", import.meta.url), "utf8");
const memberProfileStyles = await readFile(new URL("../src/styles/52-public-member-profile.css", import.meta.url), "utf8");
const organizationProfileStyles = await readFile(new URL("../src/styles/51-unified-profile.css", import.meta.url), "utf8");
const athleteActivityStyles = await readFile(new URL("../src/styles/57-athlete-activity.css", import.meta.url), "utf8");
const platformV2ProfileSource = await readFile(new URL("../src/features/platformV2/PlatformV2Profile.jsx", import.meta.url), "utf8");
const platformV2AppSource = await readFile(new URL("../src/features/platformV2/PlatformV2App.jsx", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
const platformV2Styles = await readFile(new URL("../src/features/platformV2/PlatformV2App.module.css", import.meta.url), "utf8");
const profileImageEditorSource = await readFile(new URL("../src/features/profile/ProfileImageEditor.jsx", import.meta.url), "utf8");
const profileImageEditorStyles = await readFile(new URL("../src/styles/54-profile-image-editor.css", import.meta.url), "utf8");
const expandedChallengeMigrationSource = await readFile(new URL("../supabase/migrations/202608310003_expanded_athlete_challenges.sql", import.meta.url), "utf8");
const socialGraphMigrationSource = await readFile(new URL("../supabase/migrations/202608310004_profile_follows.sql", import.meta.url), "utf8");
const simplifiedChallengeMigrationSource = await readFile(new URL("../supabase/migrations/202608310005_simplified_athlete_challenges.sql", import.meta.url), "utf8");

assert(memberPresentationSource.includes("OWNER_MEMBER_PROFILE_TABS = MEMBER_PROFILE_TABS"), "A busca por dupla deve ficar dentro da atividade esportiva, sem criar uma sexta aba principal.");
assert(memberPresentationSource.includes("publicMemberProfileTabs athleteProfileTabs"), "As abas do atleta devem ter uma grade responsiva própria.");
assert(athleteActivitySource.includes("Torneios") && athleteActivitySource.includes("Circuitos") && athleteActivitySource.includes("Procurando dupla"), "Torneios, circuitos e busca por dupla devem ser contextos separados.");
assert(athleteExperienceSource.includes("<Trophy aria-hidden=\"true\"") && athleteExperienceSource.includes("<Hand aria-hidden=\"true\"") && athleteExperienceSource.includes("<Shirt aria-hidden=\"true\""), "Os dados esportivos do perfil devem usar ícones neutros.");
assert(!athleteExperienceSource.includes("🎾") && !athleteExperienceSource.includes("✋") && !athleteExperienceSource.includes("👕"), "O perfil não deve voltar a exibir emojis coloridos nos dados esportivos.");
assert(athleteActivitySource.includes("Desempenho e conquistas") && athleteActivitySource.includes("Eventos por mês"), "Conquistas deve exibir gráficos simples baseados na atividade real.");
assert(memberProfileStyles.includes("repeat(5, minmax(0, 1fr))"), "As cinco abas do atleta devem permanecer na mesma linha.");
assert(organizationPresentationSource.includes("organizationProfileTabs") && organizationProfileStyles.includes("repeat(4, minmax(0, 1fr))"), "As quatro abas da organização devem permanecer na mesma linha.");
assert(organizerWorkspaceSource.includes('profileSubtabs athleteProfileTabs') && !organizerWorkspaceSource.includes('onClick={() => openProfileSection("duplas", "athlete")}'), "O perfil próprio do atleta deve usar cinco abas em uma única linha e levar a busca por dupla para dentro da atividade.");
assert(organizerWorkspaceSource.includes('["atividades", "duplas", "desafios", "conquistas"]'), "O desempenho do perfil próprio deve usar o mesmo painel de atividade do perfil visitado.");
assert(athleteActivityStyles.includes("athletePerformanceCharts") && athleteActivityStyles.includes("athleteActivityKinds"), "Os gráficos e as subdivisões da atividade devem ter estilos claros e responsivos.");
assert(athleteActivitySource.includes('role="tablist"') && athleteActivitySource.includes("aria-selected={activitySection ==="), "A subdivisão esportiva deve indicar semanticamente qual botão está selecionado.");
assert(athleteActivityStyles.includes("html body .proDashboard.playAppShell .athleteActivityKinds button.active"), "O botão selecionado da atividade deve permanecer visível nos temas claro e escuro.");
assert(organizerWorkspaceSource.includes('const returnPanel = ["inicio", "explorar"].includes(activePanel)') && memberProfileWorkspaceSource.includes('const returnPanel = ["overview", "explore"].includes(activePanel)'), "Abrir um torneio pelo perfil deve revelar a tela do evento e permitir voltar ao painel de origem.");
assert(platformV2ProfileSource.includes("Pódios em torneios") && platformV2ProfileSource.includes("Pódios em circuitos") && platformV2ProfileSource.includes("Histórico oficial"), "A V2 deve separar conquistas de torneios, circuitos e histórico oficial.");
assert(["Partida simples", "Partida em dupla", "Meta de pódios", "Próximos 30 dias", "Próximos 3 meses", "Próximos 6 meses", "Próximo 1 ano"].every((label) => platformV2ProfileSource.includes(label)) && platformV2ProfileSource.includes("searchPublicPlatform"), "A V2 deve oferecer somente as três disputas simplificadas e os quatro períodos de pódios.");
assert(!platformV2ProfileSource.includes('{ id: "open", label:'), "Desafio aberto não deve aparecer entre as opções de criação.");
assert(platformV2Styles.includes("profileAchievementSummaryGrid") && platformV2Styles.includes("profileChallengeLayout"), "Conquistas e desafios da V2 devem preservar o novo layout responsivo.");
assert(platformV2AppSource.includes("Seja organizador") && platformV2AppSource.includes("Assine e crie campeonatos") && platformV2Styles.includes("organizerCta"), "O perfil do atleta deve destacar em verde o convite para assinar e organizar campeonatos.");
assert(platformV2AppSource.includes("loadMyMemberProfile") && platformV2AppSource.includes('updateIdentitySummary("athlete"'), "A V2 deve carregar a identidade persistida do atleta já na abertura.");
assert(mainSource.includes("getOrganizationSubscriptionWhatsAppUrl(session.user)") && platformV2AppSource.includes("onOrganizationSubscription?.()"), "O convite verde deve abrir o WhatsApp oficial da assinatura.");
assert(platformV2AppSource.includes('aria-label="Recarregar página"') && platformV2AppSource.includes("window.location.reload()"), "O cabeçalho da V2 deve oferecer recarregamento explícito ao lado das notificações.");
assert(platformV2AppSource.includes('aria-label="Ações fixas da plataforma"') && platformV2Styles.includes("position: fixed"), "Menu, atualização, notificações e conta devem permanecer no cabeçalho fixo em qualquer aba.");
assert(platformV2AppSource.includes('window.setTimeout(() => setNotice(""), 5000)') && platformV2AppSource.includes("window.clearTimeout(noticeTimer)"), "Os avisos temporários da V2 devem desaparecer automaticamente após cinco segundos.");
assert(platformV2Styles.includes(".profileGalleryPreview img") && platformV2Styles.includes("object-fit: contain") && !platformV2Styles.includes(".profileGalleryPreview:hover img { filter: brightness(.82); transform:"), "As miniaturas das galerias do atleta e da organização devem mostrar a foto inteira, sem corte ou ampliação automática.");
assert(platformV2Styles.includes(".profileGalleryPreview") && platformV2Styles.includes("padding: 0") && !platformV2Styles.includes("border-radius: 10px; object-fit: contain"), "A miniatura deve aproveitar toda a moldura sem criar uma margem artificial ao redor da foto.");
assert(profileImageEditorStyles.includes("calc((100dvh - 220px) * .8)") && profileImageEditorStyles.includes(".profileImageEditorBody > aside") && profileImageEditorStyles.includes("overflow-y: auto"), "A foto do editor V2 deve caber na altura visível enquanto somente os controles podem rolar.");
assert(profileImageEditorStyles.includes("line-height: 0") && profileImageEditorStyles.includes("margin: auto"), "O ícone de fechar deve permanecer centralizado dentro do botão.");
assert(platformV2ProfileSource.includes('role="alertdialog"') && platformV2ProfileSource.includes("Apagar esta foto?") && platformV2ProfileSource.includes("confirmGalleryPhotoRemoval"), "A exclusão de fotos da galeria deve usar a confirmação visual própria da V2.");
assert(platformV2Styles.includes("profileConfirmModal") && platformV2Styles.includes("profileConfirmDelete"), "A confirmação de exclusão deve seguir o tema responsivo da plataforma.");
assert(platformV2Styles.includes("profileChallengeChoice") && platformV2Styles.includes("profileChallengeSearch label > div"), "As escolhas de pódio/dupla e a busca de atletas devem permanecer alinhadas no painel de criação.");
assert(expandedChallengeMigrationSource.includes("create_athlete_challenge") && expandedChallengeMigrationSource.includes("list_my_expanded_athlete_challenges") && expandedChallengeMigrationSource.includes("'doubles', 'open'") && expandedChallengeMigrationSource.includes("'weekly_sessions', 'win_streak'"), "A homologação deve ter suporte persistente a duplas, desafio aberto e metas configuráveis.");
assert(socialGraphMigrationSource.includes("profile_follows") && socialGraphMigrationSource.includes("get_my_social_graph") && socialGraphMigrationSource.includes("set_profile_follow"), "A homologação deve persistir seguidores separadamente por perfil ativo.");
assert(simplifiedChallengeMigrationSource.includes("'match', 'doubles', 'podium_goal'") && simplifiedChallengeMigrationSource.includes("doubles_category_mode") && simplifiedChallengeMigrationSource.includes("goal_period"), "A homologação deve persistir partidas simples, duplas e metas de pódios.");
assert(profileImageEditorSource.includes("galleryPortrait") && profileImageEditorSource.includes("4:5 vertical") && profileImageEditorSource.includes("1:1 quadrado"), "A galeria deve permitir ajustar a publicação nos dois formatos de post do Instagram.");
assert(platformV2ProfileSource.includes("profileGalleryPreview") && platformV2ProfileSource.includes("PhotoLightbox"), "As fotos dos perfis de atleta e organização devem abrir ampliadas.");
assert(platformV2ProfileSource.includes("excludeOrganizationCoverFromGallery"), "A capa da organização não deve ocupar uma posição na galeria.");

console.log("Perfil unificado: dados esportivos, contatos protegidos, atividades, duplas e desafios passaram.");
