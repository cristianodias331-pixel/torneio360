import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isLegacyOrganizerManagementPanel,
  normalizePersistedOrganizerPanel,
} from "../src/domain/organizerWorkspaceNavigation.mjs";

const mainSource = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const workspaceSource = readFileSync(new URL("../src/features/profile/MemberProfileWorkspace.jsx", import.meta.url), "utf8");
const frameSource = readFileSync(new URL("../src/features/appShell/UnifiedPlatformFrame.jsx", import.meta.url), "utf8");
const organizerSource = readFileSync(new URL("../src/OrganizerWorkspace.jsx", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../supabase/migrations/202608280002_unified_account_organization_access.sql", import.meta.url), "utf8");
const threeDayTrialMigrationSource = readFileSync(new URL("../supabase/migrations/202608280003_three_day_organization_trial.sql", import.meta.url), "utf8");

assert.match(migrationSource, /create or replace function public\.activate_my_organization\(\)/i);
assert.match(migrationSource, /organization_activated_at is null/i, "O período da organização só pode começar uma vez.");
assert.match(migrationSource, /jsonb_build_object\('role', 'organizer'\)/i, "A promoção deve ocorrer somente no app_metadata protegido.");
assert.match(migrationSource, /grant execute on function public\.activate_my_organization\(\) to authenticated/i);
assert.match(threeDayTrialMigrationSource, /trial_end date :=[\s\S]*\+ 2;/i, "O teste deve incluir hoje e mais dois dias, totalizando três dias corridos.");
assert.doesNotMatch(threeDayTrialMigrationSource, /trial_end date :=[\s\S]*\+ 6;/i, "A regra nova não pode manter os sete dias anteriores.");

assert.match(mainSource, /supabase\.rpc\("activate_my_organization"\)/, "O frontend deve ativar a identidade por uma RPC protegida.");
assert.match(mainSource, /supabase\.auth\.refreshSession\(\)/, "O JWT deve ser renovado após a promoção.");
assert.match(mainSource, /return renderMemberWorkspace\(\{[\s\S]*state:[\s\S]*expired/i, "O fim da assinatura não pode bloquear o perfil gratuito do atleta.");

assert.match(frameSource, /panel: "organization", label: "Organizar"/, "A assinatura precisa estar visível na navegação do atleta.");
assert.match(workspaceSource, /Use esta conta também como organização/);
assert.match(workspaceSource, /Perfil de atleta preservado/);
assert.match(workspaceSource, /Um login, permissões diferentes/);
assert.match(workspaceSource, /Ativar 3 dias grátis/);

assert.equal(normalizePersistedOrganizerPanel("notificacoes"), "notificacoes", "Notificações deve continuar sendo uma área principal independente.");
assert.equal(normalizePersistedOrganizerPanel("criar"), "ajustes", "A antiga aba Criar não pode ser restaurada fora do perfil da organização.");
assert.equal(normalizePersistedOrganizerPanel("circuitos"), "ajustes");
assert.equal(normalizePersistedOrganizerPanel("modalidades"), "ajustes");
assert.equal(isLegacyOrganizerManagementPanel("criar"), true);
assert.match(organizerSource, /activePanel === "notificacoes" \? \([\s\S]*?<NotificationCenter/);
assert.match(organizerSource, /onCreateTournament=\{\(\) => setCreateTournamentOpen\(true\)\}/, "A criação deve ser iniciada dentro do perfil da organização.");

console.log("Conta unificada: atleta preservado, organização ativável e assinatura isolada passaram.");
