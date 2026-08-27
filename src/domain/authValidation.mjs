export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeBrazilianTaxId(value) {
  return String(value || "").replace(/\D+/g, "");
}

function hasRepeatedDigits(value) {
  return /^(\d)\1+$/.test(value);
}

export function isValidCpf(value) {
  const digits = normalizeBrazilianTaxId(value);
  if (digits.length !== 11 || hasRepeatedDigits(digits)) return false;
  const calculateDigit = (length) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(digits[index]) * (length + 1 - index);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calculateDigit(9) === Number(digits[9]) && calculateDigit(10) === Number(digits[10]);
}

export function isValidCnpj(value) {
  const digits = normalizeBrazilianTaxId(value);
  if (digits.length !== 14 || hasRepeatedDigits(digits)) return false;
  const calculateDigit = (length) => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculateDigit(12) === Number(digits[12]) && calculateDigit(13) === Number(digits[13]);
}

export function isValidBrazilianTaxId(value, type = "cpf") {
  return type === "cnpj" ? isValidCnpj(value) : isValidCpf(value);
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
