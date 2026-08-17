export function getCupFormat(data) {
  return data?.cupConfig?.format || data?.cupConfig?.cupMode || "";
}

export function isCopinhaData(data) {
  return getCupFormat(data) === "copinha";
}

export function isCearenseData(data) {
  return getCupFormat(data) === "cearense"
    || getCupFormat(data) === "cearense-individual"
    || getCupFormat(data) === "playranking"
    || getCupFormat(data) === "sunset";
}

export function isCampeonatoCearenseData(data) {
  return getCupFormat(data) === "cearense" || getCupFormat(data) === "cearense-individual";
}

export function isSunsetData(data) {
  return getCupFormat(data) === "sunset";
}

export function isOfficialCearenseData(data) {
  return isCampeonatoCearenseData(data) || isSunsetData(data);
}

export function isCearenseSecondParallelEnabled(data) {
  return !isCampeonatoCearenseData(data)
    || data?.cupConfig?.secondRepechageEnabled === true;
}

export function isCearenseThirdParallelEnabled(data) {
  return isSunsetData(data) || (isCampeonatoCearenseData(data)
    && data?.cupConfig?.thirdRepechageEnabled === true);
}

export function isPlayRankingData(data) {
  return getCupFormat(data) === "playranking";
}
