export const reizinhoPairRounds = {
  4: [
    [[1, 2], [3, 4]],
    [[1, 3], [2, 4]],
    [[1, 4], [2, 3]],
  ],
  6: [
    [[1, 2], [3, 4], [5, 6]],
    [[1, 3], [2, 5], [4, 6]],
    [[1, 4], [2, 6], [3, 5]],
    [[1, 5], [2, 4], [3, 6]],
    [[1, 6], [2, 3], [4, 5]],
  ],
};

export function getReizinhoPairRounds(playerCount) {
  return reizinhoPairRounds[Number(playerCount)] || reizinhoPairRounds[4];
}

export function buildReizinhoGames(playerCount) {
  return getReizinhoPairRounds(playerCount).map((pairs) => {
    const games = [];

    for (let first = 0; first < pairs.length; first += 1) {
      for (let second = first + 1; second < pairs.length; second += 1) {
        games.push([pairs[first], pairs[second]]);
      }
    }

    return games;
  });
}
