import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mainSource = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const workspaceSource = readFileSync(new URL("../src/features/profile/MemberProfileWorkspace.jsx", import.meta.url), "utf8");
const frameSource = readFileSync(new URL("../src/features/appShell/UnifiedPlatformFrame.jsx", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../supabase/migrations/202608280002_unified_account_organization_access.sql", import.meta.url), "utf8");

assert.match(migrationSource, /create or replace function public\.activate_my_organization\(\)/i);
assert.match(migrationSource, /organization_activated_at is null/i, "O período da organização só pode começar uma vez.");
assert.match(migrationSource, /jsonb_build_object\('role', 'organizer'\)/i, "A promoção deve ocorrer somente no app_metadata protegido.");
assert.match(migrationSource, /grant execute on function public\.activate_my_organization\(\) to authenticated/i);

assert.match(mainSource, /supabase\.rpc\("activate_my_organization"\)/, "O frontend deve ativar a identidade por uma RPC protegida.");
assert.match(mainSource, /supabase\.auth\.refreshSession\(\)/, "O JWT deve ser renovado após a promoção.");
assert.match(mainSource, /return renderMemberWorkspace\(\{[\s\S]*state:[\s\S]*expired/i, "O fim da assinatura não pode bloquear o perfil gratuito do atleta.");

assert.match(frameSource, /panel: "organization", label: "Organizar"/, "A assinatura precisa estar visível na navegação do atleta.");
assert.match(workspaceSource, /Use esta conta também como organização/);
assert.match(workspaceSource, /Perfil de atleta preservado/);
assert.match(workspaceSource, /Um login, permissões diferentes/);
assert.match(workspaceSource, /Ativar organização/);

console.log("Conta unificada: atleta preservado, organização ativável e assinatura isolada passaram.");
