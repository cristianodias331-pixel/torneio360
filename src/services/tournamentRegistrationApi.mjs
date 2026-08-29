const RECEIPT_BUCKET = "registration-receipts";
export const MAX_REGISTRATION_RECEIPT_SIZE = 10 * 1024 * 1024;
export const REGISTRATION_RECEIPT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function isUnavailableWorkflowError(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLocaleLowerCase("pt-BR");
  return ["PGRST202", "42883", "42P01", "42703"].includes(code)
    || message.includes("registration_workflow")
    || message.includes("workflow_status")
    || message.includes("registration-receipts")
    || message.includes("get_my_tournament_registration_checkout_v2")
    || message.includes("search_tournament_partner_candidates_v2")
    || message.includes("validate_tournament_registration_eligibility");
}

function getReceiptExtension(file) {
  const byType = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return byType[String(file?.type || "").toLowerCase()] || "bin";
}

export function validateRegistrationReceipt(file) {
  if (!file) return "Escolha uma foto ou PDF do comprovante.";
  if (!REGISTRATION_RECEIPT_TYPES.includes(String(file.type || "").toLowerCase())) {
    return "Envie um arquivo PDF, JPG, PNG ou WebP.";
  }
  if (Number(file.size || 0) <= 0 || Number(file.size || 0) > MAX_REGISTRATION_RECEIPT_SIZE) {
    return "O comprovante deve ter no máximo 10 MB.";
  }
  return "";
}

export async function loadMyTournamentRegistrationCheckout({ supabase, tournamentId }) {
  let { data, error } = await supabase.rpc("get_my_tournament_registration_checkout_v2", {
    p_tournament_id: tournamentId,
  });
  if (error && isUnavailableWorkflowError(error)) {
    ({ data, error } = await supabase.rpc("get_my_tournament_registration_checkout", {
      p_tournament_id: tournamentId,
    }));
  }
  if (error) {
    if (isUnavailableWorkflowError(error)) return { checkout: null, schemaAvailable: false };
    throw error;
  }
  return { checkout: data || null, schemaAvailable: true };
}

export async function submitTournamentRegistrationWorkflow({
  supabase,
  tournamentId,
  athleteName,
  partnerName = "",
  category = "",
  paymentMethod,
  receipt,
  lookingForPartner = false,
  partnerHandle = "",
}) {
  const receiptError = validateRegistrationReceipt(receipt);
  if (receiptError) throw new Error(receiptError);

  const { error: eligibilityError } = await supabase.rpc("validate_tournament_registration_eligibility", {
    p_tournament_id: tournamentId,
    p_partner_handle: String(partnerHandle || "").replace(/^@/, "").trim(),
    p_looking_for_partner: Boolean(lookingForPartner),
  });
  if (eligibilityError && !isUnavailableWorkflowError(eligibilityError)) throw eligibilityError;

  const { data: prepared, error: prepareError } = await supabase.rpc("prepare_my_tournament_registration", {
    p_tournament_id: tournamentId,
    p_athlete_name: athleteName,
    p_partner_name: "",
    p_category: category,
  });
  if (prepareError) throw prepareError;

  const registration = prepared?.registration;
  if (!registration?.id) throw new Error("Não foi possível preparar sua inscrição.");

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user?.id) throw authError || new Error("Sessão de atleta indisponível.");

  const objectPath = `${authData.user.id}/${registration.id}/comprovante.${getReceiptExtension(receipt)}`;
  const upload = await supabase.storage.from(RECEIPT_BUCKET).upload(objectPath, receipt, {
    cacheControl: "0",
    contentType: receipt.type,
    upsert: true,
  });
  if (upload.error) throw upload.error;

  const { data, error } = await supabase.rpc("submit_my_tournament_registration_proof_v2", {
    p_registration_id: registration.id,
    p_payment_method: paymentMethod,
    p_payment_proof_path: objectPath,
    p_payment_proof_name: receipt.name || "comprovante",
    p_payment_proof_mime: receipt.type,
    p_payment_proof_size: receipt.size,
    p_looking_for_partner: Boolean(lookingForPartner),
    p_partner_handle: String(partnerHandle || "").replace(/^@/, "").trim(),
  });
  if (error) throw error;
  return data;
}

export async function findTournamentPartnerByHandle({ supabase, tournamentId, handle }) {
  const normalizedHandle = String(handle || "").replace(/^@/, "").trim();
  if (!normalizedHandle) return { partner: null, schemaAvailable: true };
  const { data, error } = await supabase.rpc("find_tournament_partner_by_handle", {
    p_tournament_id: tournamentId,
    p_handle: normalizedHandle,
  });
  if (error) {
    if (isUnavailableWorkflowError(error)) return { partner: null, schemaAvailable: false };
    throw error;
  }
  return { partner: data || null, schemaAvailable: true };
}

export async function searchTournamentPartnerCandidates({ supabase, tournamentId, query, limit = 8 }) {
  const normalizedQuery = String(query || "").replace(/^@/, "").trim();
  if (normalizedQuery.length < 2) return { candidates: [], schemaAvailable: true };
  let { data, error } = await supabase.rpc("search_tournament_partner_candidates_v2", {
    p_tournament_id: tournamentId,
    p_query: normalizedQuery,
    p_limit: Math.max(1, Math.min(Number(limit) || 8, 16)),
  });
  if (error && isUnavailableWorkflowError(error)) {
    ({ data, error } = await supabase.rpc("search_tournament_partner_candidates", {
      p_tournament_id: tournamentId,
      p_query: normalizedQuery,
      p_limit: Math.max(1, Math.min(Number(limit) || 8, 16)),
    }));
  }
  if (error) {
    if (isUnavailableWorkflowError(error)) return { candidates: [], schemaAvailable: false };
    throw error;
  }
  return { candidates: Array.isArray(data) ? data : [], schemaAvailable: true };
}

export async function cancelMyTournamentRegistration({ supabase, registrationId }) {
  const { data, error } = await supabase.rpc("cancel_my_tournament_registration", {
    p_registration_id: registrationId,
  });
  if (error) throw error;
  return data;
}

export async function cancelMyTournamentPartnership({ supabase, registrationId }) {
  const { data, error } = await supabase.rpc("cancel_my_tournament_partnership", {
    p_registration_id: registrationId,
  });
  if (error) throw error;
  return data;
}

export async function reviewTournamentRegistration({ supabase, registrationId, decision, reason = "" }) {
  const { data, error } = await supabase.rpc("review_tournament_registration_workflow", {
    p_registration_id: registrationId,
    p_decision: decision,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function createRegistrationReceiptUrl({ supabase, path, expiresIn = 300 }) {
  if (!path) throw new Error("Esta inscrição ainda não possui comprovante.");
  const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Não foi possível abrir o comprovante.");
  return data.signedUrl;
}

export async function loadMyRegistrationWorkflows({ supabase }) {
  const { data, error } = await supabase.rpc("get_my_registration_workflows");
  if (error) {
    if (isUnavailableWorkflowError(error)) return { registrations: [], schemaAvailable: false };
    throw error;
  }
  return { registrations: Array.isArray(data) ? data : [], schemaAvailable: true };
}
