import assert from "node:assert/strict";
import {
  getSafePaymentLink,
  loadMyOrganizationPaymentSettings,
  loadPublicOrganizationPaymentSettings,
  saveMyOrganizationPaymentSettings,
} from "../src/services/organizationPaymentApi.mjs";

const calls = [];
const supabase = {
  async rpc(name, payload) {
    calls.push({ name, payload });
    if (name === "get_my_organization_payment_settings") {
      return { data: { pix_key: "pix-empresa", card_payment_link: "https://pagamento.example/arena" }, error: null };
    }
    if (name === "save_my_organization_payment_settings") {
      return { data: { pix_key: payload.p_pix_key, card_payment_link: payload.p_card_payment_link }, error: null };
    }
    return { data: { pix_key: "pix-publico", card_payment_link: "https://checkout.example/publico" }, error: null };
  },
};

const ownSettings = await loadMyOrganizationPaymentSettings({ supabase });
assert.equal(ownSettings.pixKey, "pix-empresa");
assert.equal(ownSettings.cardPaymentLink, "https://pagamento.example/arena");

const savedSettings = await saveMyOrganizationPaymentSettings({
  supabase,
  pixKey: "  chave-aleatoria  ",
  cardPaymentLink: " https://checkout.example/novo ",
});
assert.equal(savedSettings.pixKey, "chave-aleatoria");
assert.equal(calls[1].payload.p_card_payment_link, "https://checkout.example/novo");

const publicSettings = await loadPublicOrganizationPaymentSettings({
  supabase,
  organizationId: "organization-1",
});
assert.equal(publicSettings.pixKey, "pix-publico");
assert.equal(calls[2].payload.p_organization_id, "organization-1");

assert.equal(getSafePaymentLink("https://example.com/pagar"), "https://example.com/pagar");
assert.equal(getSafePaymentLink("javascript:alert(1)"), "");
assert.equal(getSafePaymentLink("sem-protocolo.example"), "");

const unavailableSupabase = {
  async rpc() {
    return { data: null, error: { code: "PGRST202", message: "function organization_payment_settings missing" } };
  },
};
const fallback = await loadMyOrganizationPaymentSettings({
  supabase: unavailableSupabase,
  fallback: { pixKey: "local", cardPaymentLink: "https://local.example" },
});
assert.equal(fallback.pixKey, "local");
assert.equal(fallback.schemaAvailable, false);

console.log("Pagamentos públicos da organização: carregamento, salvamento, fallback e links passaram.");

