function isUnavailableRegistrantsError(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLocaleLowerCase("pt-BR");
  return code === "PGRST202"
    || code === "42883"
    || code === "42P01"
    || code === "42703"
    || message.includes("organization_registrations")
    || message.includes("payment_status")
    || message.includes("athlete_partner_searches");
}

function normalizeRegistrations(value) {
  return Array.isArray(value) ? value : [];
}

function mapFallbackRegistration(registration, tournament) {
  return {
    id: registration.id,
    athlete_user_id: registration.athlete_user_id,
    athlete_name: registration.athlete_name || "Atleta",
    partner_name: registration.partner_name || "",
    category: registration.category || tournament?.data?.category || "Sem categoria",
    registration_status: registration.status || "pending",
    payment_status: "pending",
    workflow_status: "draft",
    payment_proof_path: "",
    payment_proof_name: "",
    looking_for_partner: false,
    created_at: registration.created_at || "",
    athlete: null,
    tournament: tournament ? {
      id: tournament.id,
      name: tournament.name,
      type: tournament.type,
      data: tournament.data || {},
    } : null,
  };
}

export async function reviewOrganizationRegistration({ supabase, registrationId, decision, reason = "" }) {
  const { data, error } = await supabase.rpc("review_tournament_registration_workflow", {
    p_registration_id: registrationId,
    p_decision: decision,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function pairApprovedOrganizationRegistrations({ supabase, registrationIds }) {
  const ids = Array.from(new Set((registrationIds || []).map(String).filter(Boolean)));
  if (ids.length < 2 || ids.length % 2 !== 0) {
    throw new Error("Selecione uma quantidade par de atletas para formar as duplas.");
  }
  const { data, error } = await supabase.rpc("pair_approved_tournament_registrations", {
    p_registration_ids: ids,
  });
  if (error) throw error;
  return data;
}

export async function openOrganizationRegistrationReceipt({ supabase, path }) {
  if (!path) throw new Error("Esta inscrição ainda não possui comprovante.");
  const { data, error } = await supabase.storage.from("registration-receipts").createSignedUrl(path, 300);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Não foi possível abrir o comprovante.");
  return data.signedUrl;
}

export async function removeOrganizationRegistration({ supabase, registrationId, reason = "" }) {
  const { data, error } = await supabase.rpc("remove_organization_tournament_registration", {
    p_registration_id: registrationId,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function loadOrganizationRegistrants({ supabase, tournaments = [] }) {
  const { data, error } = await supabase.rpc("get_my_organization_registrations");
  if (!error) {
    return { registrations: normalizeRegistrations(data), schemaAvailable: true };
  }
  if (!isUnavailableRegistrantsError(error)) throw error;

  if (typeof supabase.from !== "function") {
    return { registrations: [], schemaAvailable: false };
  }

  const fallback = await supabase
    .from("tournament_registrations")
    .select("id,tournament_id,athlete_user_id,athlete_name,partner_name,category,status,created_at")
    .in("status", ["pending", "confirmed"])
    .order("created_at", { ascending: false });

  if (fallback.error) {
    if (isUnavailableRegistrantsError(fallback.error)) {
      return { registrations: [], schemaAvailable: false };
    }
    throw fallback.error;
  }

  const tournamentById = new Map((tournaments || []).map((tournament) => [String(tournament.id), tournament]));
  return {
    registrations: normalizeRegistrations(fallback.data)
      .filter((registration) => tournamentById.has(String(registration.tournament_id)))
      .map((registration) => mapFallbackRegistration(
        registration,
        tournamentById.get(String(registration.tournament_id))
      )),
    schemaAvailable: false,
  };
}

export async function setOrganizationRegistrationPayment({ supabase, registrationId, paymentStatus }) {
  const { data, error } = await supabase.rpc("set_organization_registration_payment_status", {
    p_registration_id: registrationId,
    p_payment_status: paymentStatus,
  });
  if (error) throw error;
  return data;
}
