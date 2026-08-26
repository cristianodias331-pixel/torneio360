import {
  normalizeMemberProfile,
  toMemberProfileRpcPayload,
} from "../domain/memberProfile.mjs";

function isUnavailableSchemaError(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLocaleLowerCase("pt-BR");
  return code === "PGRST202"
    || code === "42883"
    || code === "42P01"
    || message.includes("get_my_member_profile")
    || message.includes("upsert_my_member_profile")
    || message.includes("member_profiles");
}

export async function loadMyMemberProfile({ supabase, fallback }) {
  const { data, error } = await supabase.rpc("get_my_member_profile");
  if (error) {
    if (isUnavailableSchemaError(error)) {
      return { profile: normalizeMemberProfile(null, fallback), schemaAvailable: false };
    }
    throw error;
  }

  return {
    profile: normalizeMemberProfile(data, fallback),
    schemaAvailable: true,
  };
}

export async function saveMyMemberProfile({ supabase, profile, fallback }) {
  const { data, error } = await supabase.rpc(
    "upsert_my_member_profile",
    toMemberProfileRpcPayload(profile)
  );

  if (error) {
    if (isUnavailableSchemaError(error)) {
      return { profile: normalizeMemberProfile(profile, fallback), schemaAvailable: false };
    }
    throw error;
  }

  return {
    profile: normalizeMemberProfile(data, fallback),
    schemaAvailable: true,
  };
}
