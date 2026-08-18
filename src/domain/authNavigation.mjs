const AUTH_FLOW_QUERY_KEY = "auth";

function getLocation(location) {
  return location || globalThis.window?.location;
}

export function getAuthRedirectUrl(flow, location = null) {
  const currentLocation = getLocation(location);
  const url = new URL(currentLocation.origin + currentLocation.pathname);
  url.searchParams.set(AUTH_FLOW_QUERY_KEY, flow);
  return url.toString();
}

export function getAuthFlowFromLocation(location = null) {
  const currentLocation = getLocation(location);
  const url = new URL(currentLocation.href);
  const queryFlow = url.searchParams.get(AUTH_FLOW_QUERY_KEY);
  const hashParams = new URLSearchParams(currentLocation.hash.replace(/^#/, ""));
  const hashType = hashParams.get("type");

  if (queryFlow === "recovery" || hashType === "recovery") return "recovery";
  if (queryFlow === "confirm" || hashType === "signup" || hashType === "email") return "confirm";
  return null;
}

export function getAuthCallbackError(location = null) {
  const currentLocation = getLocation(location);
  const url = new URL(currentLocation.href);
  const hashParams = new URLSearchParams(currentLocation.hash.replace(/^#/, ""));
  const rawMessage = hashParams.get("error_description") || url.searchParams.get("error_description") || "";

  if (!rawMessage) return null;

  if (/expired|invalid|otp/i.test(rawMessage)) {
    return "Este link expirou ou já foi usado. Solicite um novo link para continuar.";
  }

  return "Não foi possível concluir este link de acesso. Solicite um novo link e tente novamente.";
}

export function clearAuthCallbackUrl(location = null, history = null) {
  const currentLocation = getLocation(location);
  const currentHistory = history || globalThis.window?.history;
  const url = new URL(currentLocation.href);
  url.searchParams.delete(AUTH_FLOW_QUERY_KEY);
  url.searchParams.delete("code");
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  url.hash = "";
  currentHistory.replaceState(null, "", `${url.pathname}${url.search}`);
}
