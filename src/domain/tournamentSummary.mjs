export const tournamentSummarySelect = [
  "id", "user_id", "public_id", "is_public", "name", "type", "status",
  "created_at", "updated_at", "revision", "last_change_id",
  "summary_deleted_at:data->>deletedAt",
  "summary_display_order:data->>displayOrder",
  "summary_display_order_mode:data->>displayOrderMode",
  "summary_event_name:data->>eventName",
  "summary_event_date:data->>eventDate",
  "summary_event_start_date:data->>eventStartDate",
  "summary_event_end_date:data->>eventEndDate",
  "summary_event_start_time:data->>eventStartTime",
  "summary_event_day:data->>eventDay",
  "summary_event_period_label:data->>eventPeriodLabel",
  "summary_registration_deadline:data->>registrationDeadline",
  "summary_location:data->>location",
  "summary_winning_score:data->>winningScore",
  "summary_ranking_criteria:data->>rankingCriteria",
  "summary_category:data->>category",
  "summary_participant_gender_mode:data->>participantGenderMode",
  "summary_gender_other:data->>genderOther",
  "summary_gender:data->>gender",
  "summary_multi_category_event:data->>multiCategoryEvent",
  "summary_event_group_key:data->>eventGroupKey",
  "summary_event_group_start_date:data->>eventGroupStartDate",
  "summary_event_group_end_date:data->>eventGroupEndDate",
  "summary_cover_image_url:data->>coverImageUrl",
  "summary_event_cover_image_url:data->>eventCoverImageUrl",
  "summary_uses_event_cover:data->>usesEventCover",
  "summary_lifecycle_status:data->>lifecycleStatus",
  "summary_published_on_profile:data->>publishedOnProfile",
].join(",");

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function definedEntries(entries) {
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined && value !== null));
}

export function normalizeTournamentSummaryRow(row = {}) {
  const data = definedEntries([
    ["deletedAt", row.summary_deleted_at],
    ["displayOrder", parseNumber(row.summary_display_order)],
    ["displayOrderMode", row.summary_display_order_mode],
    ["eventName", row.summary_event_name],
    ["eventDate", row.summary_event_date],
    ["eventStartDate", row.summary_event_start_date],
    ["eventEndDate", row.summary_event_end_date],
    ["eventStartTime", row.summary_event_start_time],
    ["eventDay", row.summary_event_day],
    ["eventPeriodLabel", row.summary_event_period_label],
    ["registrationDeadline", row.summary_registration_deadline],
    ["location", row.summary_location],
    ["winningScore", parseNumber(row.summary_winning_score)],
    ["rankingCriteria", row.summary_ranking_criteria],
    ["category", row.summary_category],
    ["participantGenderMode", row.summary_participant_gender_mode],
    ["genderOther", row.summary_gender_other],
    ["gender", row.summary_gender],
    ["multiCategoryEvent", parseBoolean(row.summary_multi_category_event)],
    ["eventGroupKey", row.summary_event_group_key],
    ["eventGroupStartDate", row.summary_event_group_start_date],
    ["eventGroupEndDate", row.summary_event_group_end_date],
    ["coverImageUrl", row.summary_cover_image_url],
    ["eventCoverImageUrl", row.summary_event_cover_image_url],
    ["usesEventCover", parseBoolean(row.summary_uses_event_cover)],
    ["lifecycleStatus", row.summary_lifecycle_status],
    ["publishedOnProfile", parseBoolean(row.summary_published_on_profile)],
  ]);

  return {
    id: row.id,
    user_id: row.user_id,
    public_id: row.public_id,
    is_public: row.is_public,
    name: row.name || "",
    type: row.type || "",
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    revision: row.revision,
    last_change_id: row.last_change_id,
    data,
    __summary: true,
  };
}

export function isTournamentSummary(tournament) {
  return tournament?.__summary === true;
}
