const EMPTY_GRAPH = Object.freeze({
  identityKind: "athlete",
  followersCount: 0,
  followingCount: 0,
  followers: [],
  following: [],
  schemaAvailable: true,
});

function normalizeGraph(data, identityKind, schemaAvailable = true) {
  return {
    identityKind: data?.identity_kind || identityKind,
    followersCount: Math.max(0, Number(data?.followers_count) || 0),
    followingCount: Math.max(0, Number(data?.following_count) || 0),
    followers: Array.isArray(data?.followers) ? data.followers : [],
    following: Array.isArray(data?.following) ? data.following : [],
    schemaAvailable,
  };
}

function isUnavailable(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return code === "PGRST202" || code === "42883" || message.includes("get_my_social_graph") || message.includes("profile_follows");
}

export async function loadMySocialGraph({ supabase, identityKind }) {
  const { data, error } = await supabase.rpc("get_my_social_graph", { p_identity_kind: identityKind });
  if (error) {
    if (isUnavailable(error)) return { ...EMPTY_GRAPH, identityKind, schemaAvailable: false };
    throw error;
  }
  return normalizeGraph(data, identityKind);
}

export async function setProfileFollow({ supabase, followerKind, followedUserId, followedKind, follow }) {
  const { data, error } = await supabase.rpc("set_profile_follow", {
    p_follower_kind: followerKind,
    p_followed_user_id: followedUserId,
    p_followed_kind: followedKind,
    p_follow: Boolean(follow),
  });
  if (error) throw error;
  return normalizeGraph(data, followerKind);
}
