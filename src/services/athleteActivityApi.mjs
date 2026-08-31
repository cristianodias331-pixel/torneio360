import { loadMyRegistrationWorkflows } from "./tournamentRegistrationApi.mjs";

function isUnavailableActivityError(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLocaleLowerCase("pt-BR");
  return code === "PGRST202"
    || code === "42883"
    || code === "42P01"
    || message.includes("athlete_activity")
    || message.includes("athlete_achievements")
    || message.includes("athlete_challenge")
    || message.includes("partner_search");
}

function normalizeActivity(data) {
  return {
    registrations: Array.isArray(data?.registrations) ? data.registrations : [],
    circuits: Array.isArray(data?.circuits) ? data.circuits : [],
    myPartnerSearches: Array.isArray(data?.my_partner_searches) ? data.my_partner_searches : [],
    partnerMatches: Array.isArray(data?.partner_matches) ? data.partner_matches : [],
    challenges: Array.isArray(data?.challenges) ? data.challenges : [],
    achievements: Array.isArray(data?.achievements) ? data.achievements : [],
    circuitAchievements: Array.isArray(data?.circuit_achievements)
      ? data.circuit_achievements
      : Array.isArray(data?.circuitAchievements) ? data.circuitAchievements : [],
  };
}

async function loadAchievements({ supabase, userId = "" }) {
  const rpcName = userId ? "get_athlete_achievements" : "get_my_athlete_achievements";
  const rpcArgs = userId ? { p_user_id: userId } : undefined;
  const { data, error } = await supabase.rpc(rpcName, rpcArgs);
  if (error) {
    if (isUnavailableActivityError(error)) return { achievements: [], schemaAvailable: false };
    throw error;
  }
  return { achievements: Array.isArray(data) ? data : [], schemaAvailable: true };
}

async function loadExpandedChallenges({ supabase }) {
  const { data, error } = await supabase.rpc("list_my_expanded_athlete_challenges");
  if (error) {
    if (isUnavailableActivityError(error) || /list_my_expanded_athlete_challenges/i.test(String(error?.message || ""))) return null;
    throw error;
  }
  return Array.isArray(data) ? data : null;
}

export async function loadMyAthleteActivity({ supabase }) {
  let workflowResult = { registrations: [], schemaAvailable: false };
  try {
    workflowResult = await loadMyRegistrationWorkflows({ supabase });
  } catch (error) {
    if (!isUnavailableActivityError(error)) throw error;
  }
  const [{ data, error }, achievementResult, expandedChallenges] = await Promise.all([
    supabase.rpc("get_my_athlete_activity"),
    loadAchievements({ supabase }),
    loadExpandedChallenges({ supabase }),
  ]);
  if (error) {
    if (isUnavailableActivityError(error)) {
      if (workflowResult.schemaAvailable) {
        return {
          activity: normalizeActivity({ registrations: workflowResult.registrations, achievements: achievementResult.achievements }),
          schemaAvailable: achievementResult.schemaAvailable,
        };
      }
      if (typeof supabase.from === "function") {
        const fallbackResult = await supabase
          .from("tournament_registrations")
          .select("id,status,category,partner_name,created_at,tournaments(id,public_id,name,type,data)")
          .in("status", ["pending", "confirmed"])
          .order("created_at", { ascending: false });
        if (!fallbackResult.error) {
          const today = new Date().toISOString().slice(0, 10);
          return {
            activity: normalizeActivity({
              achievements: achievementResult.achievements,
              registrations: (fallbackResult.data || []).map((registration) => {
                const tournament = registration.tournaments || {};
                const details = tournament.data || {};
                const endDate = details.eventEndDate || details.eventDate || details.eventStartDate || "";
                return {
                  ...registration,
                  bucket: registration.status === "pending" ? "registered" : endDate && endDate < today ? "past" : "participating",
                  tournament: {
                    id: tournament.id,
                    public_id: tournament.public_id,
                    name: tournament.name,
                    type: tournament.type,
                    event_date: details.eventDate || details.eventStartDate || "",
                    event_end_date: details.eventEndDate || details.eventDate || "",
                    location: details.location || "",
                    cover_url: details.coverImageThumbnailUrl || details.coverImageUrl || "",
                  },
                };
              }),
            }),
            schemaAvailable: false,
          };
        }
      }
      return { activity: normalizeActivity(null), schemaAvailable: false };
    }
    throw error;
  }
  return {
    activity: normalizeActivity({
      ...data,
      achievements: achievementResult.achievements,
      registrations: workflowResult.schemaAvailable ? workflowResult.registrations : data?.registrations,
      challenges: expandedChallenges || data?.challenges,
    }),
    schemaAvailable: workflowResult.schemaAvailable && achievementResult.schemaAvailable,
  };
}

export async function loadPublicAthleteActivity({ supabase, userId }) {
  const [{ data, error }, achievementResult] = await Promise.all([
    supabase.rpc("get_public_athlete_activity", { p_user_id: userId }),
    loadAchievements({ supabase, userId }),
  ]);
  if (error) {
    if (isUnavailableActivityError(error)) return { activity: normalizeActivity(null), schemaAvailable: false };
    throw error;
  }
  return {
    activity: normalizeActivity({ ...data, achievements: achievementResult.achievements }),
    schemaAvailable: achievementResult.schemaAvailable,
  };
}

export async function approveTournamentPodium({ supabase, tournamentId, entries }) {
  const { data, error } = await supabase.rpc("approve_tournament_podium", {
    p_tournament_id: tournamentId,
    p_entries: entries,
  });
  if (error) throw error;
  return data;
}

export async function setMyPartnerSearch({ supabase, tournamentId, category, active }) {
  const { data, error } = await supabase.rpc("set_my_partner_search", {
    p_tournament_id: tournamentId,
    p_category: category || "",
    p_active: Boolean(active),
  });
  if (error) throw error;
  return data;
}

export async function sendAthleteChallenge({ supabase, challengedUserId, challengeType }) {
  const { data, error } = await supabase.rpc("send_athlete_challenge", {
    p_challenged_user_id: challengedUserId,
    p_challenge_type: challengeType,
  });
  if (error) throw error;
  return data;
}

export async function createAthleteChallenge({
  supabase,
  challengedUserId = null,
  challengeType,
  challengerPartnerUserId = null,
  challengedPartnerUserId = null,
  doublesCategoryMode = null,
  goalPeriod = null,
}) {
  const { data, error } = await supabase.rpc("create_athlete_challenge", {
    p_challenged_user_id: challengedUserId,
    p_challenge_type: challengeType,
    p_challenger_partner_user_id: challengerPartnerUserId,
    p_challenged_partner_user_id: challengedPartnerUserId,
    p_doubles_category_mode: doublesCategoryMode,
    p_goal_period: goalPeriod,
  });
  if (error) throw error;
  return data;
}

export async function respondAthleteChallenge({ supabase, challengeId, status }) {
  const { data, error } = await supabase.rpc("respond_athlete_challenge", {
    p_challenge_id: challengeId,
    p_status: status,
  });
  if (error) throw error;
  return data;
}
