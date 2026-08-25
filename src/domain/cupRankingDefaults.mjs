import { modalityConfig } from "./modalityConfig.mjs";
import { isCupType } from "./modalityClassification.mjs";
import {
  cupRankingCriteria,
  getRankingCriteria,
} from "./rankingCriteria.mjs";

export const PLAY_RANKING_GROUP_CRITERIA_LABEL =
  "Vitórias > Saldo de games > Confronto direto > Coeficiente > Sorteio";

export function getAutomaticCupRankingLabel(type) {
  return modalityConfig[type]?.type === "playranking"
    ? PLAY_RANKING_GROUP_CRITERIA_LABEL
    : getRankingCriteria(cupRankingCriteria).label;
}

export function getNewTournamentRankingCriteria(type, selectedCriteria = "") {
  return isCupType(modalityConfig[type]) ? cupRankingCriteria : selectedCriteria;
}
