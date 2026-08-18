const PLATFORM_WHATSAPP_NUMBER = "5585988739056";
const PLATFORM_WHATSAPP_DEFAULT_MESSAGE = "Olá! Preciso de ajuda com o Torneio360.";

export function getPlatformWhatsAppUrl(message = PLATFORM_WHATSAPP_DEFAULT_MESSAGE) {
  return `https://wa.me/${PLATFORM_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function getBrazilianWhatsAppUrl(value, message = "") {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";

  const numberWithCountryCode = digits.startsWith("55") && digits.length >= 12
    ? digits
    : `55${digits}`;

  const url = `https://wa.me/${numberWithCountryCode}`;
  return message ? `${url}?text=${encodeURIComponent(message)}` : url;
}

export function getPlanRegularizationWhatsAppUrl(profile, user) {
  const plan = profile?.plan ? ` Plano atual: ${profile.plan}.` : "";
  const email = user?.email ? ` E-mail da conta: ${user.email}.` : "";
  return getPlatformWhatsAppUrl(`Olá! Meu período de acesso ao Torneio360 terminou e quero regularizar o pagamento do meu plano.${plan}${email}`);
}
