export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isEmailNotConfirmedError(error) {
  return /email[^\n]*not[^\n]*confirm|not[^\n]*confirm[^\n]*email|email_not_confirmed/i.test(`${error?.message || ""} ${error?.code || ""}`);
}

export function isUserAlreadyRegisteredError(error) {
  const code = String(error?.code || "").toLowerCase();
  if (code === "user_already_exists" || code === "email_exists") return true;

  return /user\s+already\s+registered|user[^\n]*already[^\n]*exists|email[^\n]*already[^\n]*exists/i.test(String(error?.message || ""));
}

export function getAuthErrorMessage(error, fallback) {
  const message = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();

  if (/rate limit|too many requests|over_email_send_rate_limit/.test(message)) {
    return "Aguarde alguns minutos antes de pedir outro e-mail.";
  }

  if (/redirect|redirect_to|not allowed/.test(message)) {
    return "O retorno por e-mail ainda não está autorizado no Supabase. Confira as URLs permitidas.";
  }

  if (/not authorized|not allowed to send|email address not authorized/.test(message)) {
    return "O serviço de e-mail ainda não está configurado para este endereço. Configure o SMTP do Supabase.";
  }

  return fallback;
}

export function isProfilePendingEmailConfirmation(profile) {
  return profile?.status === "pending" && !profile?.expires_at;
}
