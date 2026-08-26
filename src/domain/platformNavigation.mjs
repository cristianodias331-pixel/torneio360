export const PLATFORM_NAVIGATION_EVENT = "torneio360:platform-navigation";

export function navigatePlatform(params = {}, { replace = false } = {}) {
  const url = new URL(window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") url.searchParams.set(key, String(value));
  });
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({}, "", url);
  window.dispatchEvent(new CustomEvent(PLATFORM_NAVIGATION_EVENT, { detail: { url: url.toString() } }));
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

export function subscribePlatformNavigation(listener) {
  const handleNavigation = () => listener(window.location.href);
  window.addEventListener("popstate", handleNavigation);
  window.addEventListener(PLATFORM_NAVIGATION_EVENT, handleNavigation);
  return () => {
    window.removeEventListener("popstate", handleNavigation);
    window.removeEventListener(PLATFORM_NAVIGATION_EVENT, handleNavigation);
  };
}
