const TRIAL_DAYS = 7;
const MILLISECONDS_PER_DAY = 86_400_000;

export function formatDateBR(value) {
  if (!value) return "";

  const [year, month, day] = String(value).split("-");

  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}

export function getBrazilTodayISO(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch (error) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

export function getBrazilDateTimeKey(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
  } catch (error) {
    const datePart = getBrazilTodayISO(date);
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${datePart}T${hour}:${minute}`;
  }
}

export function getBrazilDateISO(value) {
  if (!value) return "";

  const rawValue = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) return rawValue;

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return "";

  return getBrazilTodayISO(date);
}

export function isoDateToUtcDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcTime = Date.UTC(year, month - 1, day);
  const parsed = new Date(utcTime);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return Math.floor(utcTime / MILLISECONDS_PER_DAY);
}

export function getCalendarDayDifference(startValue, endValue) {
  const startDay = isoDateToUtcDay(getBrazilDateISO(startValue));
  const endDay = isoDateToUtcDay(getBrazilDateISO(endValue));

  if (startDay === null || endDay === null) return null;
  return endDay - startDay;
}

export function getFreeTrialDetails(profile, user) {
  if (String(profile?.status || "").toLowerCase() !== "active") return null;

  const trialEndValue = profile?.trial_ends_at || profile?.trial_end_at;
  const accessEndValue = trialEndValue || profile?.expires_at;
  const accessEndDate = getBrazilDateISO(accessEndValue);
  if (!accessEndDate) return null;

  const accessType = String(
    profile?.access_type || profile?.access_kind || profile?.subscription_status || ""
  ).toLowerCase();
  const hasExplicitTrial =
    profile?.is_trial === true ||
    Boolean(trialEndValue) ||
    ["trial", "free_trial", "free-trial", "gratuito", "teste"].includes(accessType);
  const hasExplicitPaidAccess =
    profile?.is_trial === false ||
    ["paid", "active_paid", "subscribed", "assinante", "pago"].includes(accessType);

  const trialStartValue =
    profile?.trial_started_at ||
    profile?.trial_start_at ||
    user?.email_confirmed_at ||
    user?.confirmed_at ||
    profile?.created_at ||
    user?.created_at;
  const inferredTrialLength = getCalendarDayDifference(trialStartValue, accessEndDate);
  const isInitialPremiumTrial =
    !hasExplicitPaidAccess &&
    String(profile?.plan || "").toLowerCase() === "premium" &&
    inferredTrialLength !== null &&
    inferredTrialLength >= 0 &&
    inferredTrialLength <= TRIAL_DAYS;

  if (!hasExplicitTrial && !isInitialPremiumTrial) return null;

  const remainingDifference = getCalendarDayDifference(getBrazilTodayISO(), accessEndDate);
  if (remainingDifference === null || remainingDifference < 0) return null;

  return {
    daysRemaining: remainingDifference + 1,
    expiresAt: accessEndDate,
  };
}

export function getWeekdayBR(value) {
  if (!value) return "";

  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return "";

  const date = new Date(year, month - 1, day);

  return [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
  ][date.getDay()];
}
