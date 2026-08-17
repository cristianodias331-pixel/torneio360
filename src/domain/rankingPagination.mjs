export function normalizeRankingExportGroups(groups = []) {
  return groups
    .map((group) => ({
      title: group?.title || "Ranking",
      rows: Array.isArray(group?.rows) ? group.rows : [],
      startIndex: Number(group?.startIndex || 0),
    }))
    .filter((group) => group.rows.length > 0);
}

export function paginateRankingGroups(groups, {
  maxHeight,
  rowHeight,
  groupOverhead,
}) {
  const pages = [];
  let currentPage = [];
  let usedHeight = 0;

  function finishPage() {
    if (currentPage.length > 0) pages.push(currentPage);
    currentPage = [];
    usedHeight = 0;
  }

  groups.forEach((group) => {
    let rowIndex = 0;

    while (rowIndex < group.rows.length) {
      const availableHeight = maxHeight - usedHeight - groupOverhead;
      const availableRows = Math.floor(availableHeight / rowHeight);

      if (availableRows <= 0) {
        finishPage();
        continue;
      }

      const pageRows = group.rows.slice(rowIndex, rowIndex + availableRows);
      currentPage.push({
        title: rowIndex > 0 ? `${group.title} — continuação` : group.title,
        rows: pageRows,
        startIndex: rowIndex,
      });
      usedHeight += groupOverhead + (pageRows.length * rowHeight);
      rowIndex += pageRows.length;

      if (rowIndex < group.rows.length) finishPage();
    }
  });

  finishPage();
  return pages;
}
