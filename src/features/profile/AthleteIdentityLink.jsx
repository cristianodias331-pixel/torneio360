import React from "react";
import { UserRound } from "lucide-react";
import { navigatePlatform } from "../../domain/platformNavigation.mjs";
import "../../styles/61-notifications-and-athlete-identity.css";

export function normalizeAthleteIdentityName(value) {
  return String(value || "").replace(/^\s*\d+\.\s*/, "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}
export function createAthleteIdentityIndex(identities = []) {
  const index = new Map();
  identities.forEach((identity) => {
    const key = normalizeAthleteIdentityName(identity.display_name);
    if (key && !index.has(key)) index.set(key, identity);
  });
  return index;
}

export default function AthleteIdentityLink({ name, identityIndex, compact = false, avatarOnly = false }) {
  const cleanName = String(name || "").replace(/^\s*\d+\.\s*/, "").trim();
  const identity = identityIndex?.get(normalizeAthleteIdentityName(cleanName));
  if (!identity) return avatarOnly ? null : <span className="athleteIdentityText">{cleanName}</span>;
  return (
    <button type="button" className={`athleteIdentityLink${compact ? " compact" : ""}${avatarOnly ? " avatarOnly" : ""}`} onClick={() => navigatePlatform({ perfil: identity.handle || identity.user_id })} title={`Abrir perfil de ${identity.display_name}`} aria-label={`Abrir perfil de ${identity.display_name}`}>
      <span>{identity.photo_url ? <img src={identity.photo_url} alt="" /> : <UserRound aria-hidden="true" />}</span>
      {!avatarOnly ? <em><strong>{identity.display_name}</strong>{identity.handle ? <small>@{identity.handle}</small> : null}</em> : null}
    </button>
  );
}

export function renderAthleteNames(value, identityIndex, compact = true) {
  const source = Array.isArray(value) ? value : String(value || "").split(/\s+\+\s+/);
  const names = source.map((name) => String(name || "").trim()).filter(Boolean);
  if (!names.length) return <span>Aguardando</span>;
  return names.map((name, index) => <React.Fragment key={`${name}-${index}`}>{index ? <span className="athleteIdentitySeparator"> + </span> : null}<AthleteIdentityLink name={name} identityIndex={identityIndex} compact={compact} /></React.Fragment>);
}
