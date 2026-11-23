// WTO historical prediction audit. Pure functions: never modify saved picks.
export function gradeWinner(pick, away, home, awayScore, homeScore) {
  if (![away, home].includes(pick)) return null;
  if (awayScore === homeScore) return "push";
  return pick === (awayScore > homeScore ? away : home) ? "win" : "loss";
}
export function gradeSpread(side, favorite, spread, away, home, awayScore, homeScore) {
  if (![away, home].includes(side) || ![away, home].includes(favorite) || !Number.isFinite(spread)) return null;
  const favoriteScore = favorite === away ? awayScore : homeScore;
  const underdogScore = favorite === away ? homeScore : awayScore;
  const adjusted = favoriteScore + spread - underdogScore;
  if (adjusted === 0) return "push";
  const winningSide = adjusted > 0 ? favorite : (favorite === away ? home : away);
  return side === winningSide ? "win" : "loss";
}
export function gradeTotal(side, line, awayScore, homeScore) {
  if (!["OVER", "UNDER"].includes(side) || !Number.isFinite(line)) return null;
  const diff = awayScore + homeScore - line;
  if (diff === 0) return "push";
  return side === (diff > 0 ? "OVER" : "UNDER") ? "win" : "loss";
}
export function inferProjectedSpreadSide(game) {
  const { away, home, projection, market } = game;
  if (!projection || !market || !Number.isFinite(market.spread)) return null;
  const margin = market.favorite === away
    ? projection.away_score - projection.home_score
    : projection.home_score - projection.away_score;
  if (margin + market.spread === 0) return null; // model is neutral
  return margin + market.spread > 0 ? market.favorite : (market.favorite === away ? home : away);
}
export function inferProjectedTotalSide(game) {
  if (!Number.isFinite(game.projection?.projected_total) || !Number.isFinite(game.market?.total)) return null;
  if (game.projection.projected_total === game.market.total) return null;
  return game.projection.projected_total > game.market.total ? "OVER" : "UNDER";
}
export function pairedWinnerAudit(rows) {
  // Only score matchups where the AI made a valid team selection and the market favorite was archived.
  const comparable = rows.filter(r =>
    [r.away, r.home].includes(r.aiWinner) &&
    [r.away, r.home].includes(r.marketFavorite) &&
    Number.isFinite(r.awayScore) && Number.isFinite(r.homeScore) &&
    r.awayScore !== r.homeScore
  );
  const summary = { games: comparable.length, aiWins: 0, marketWins: 0, disagreements: 0, aiOnly: 0, marketOnly: 0, bothCorrect: 0, bothWrong: 0 };
  const disagreements = [];
  for (const r of comparable) {
    const aiCorrect = gradeWinner(r.aiWinner, r.away, r.home, r.awayScore, r.homeScore) === "win";
    const marketCorrect = gradeWinner(r.marketFavorite, r.away, r.home, r.awayScore, r.homeScore) === "win";
    summary.aiWins += Number(aiCorrect);
    summary.marketWins += Number(marketCorrect);
    if (aiCorrect && marketCorrect) summary.bothCorrect++;
    else if (!aiCorrect && !marketCorrect) summary.bothWrong++;
    else if (aiCorrect) summary.aiOnly++;
    else summary.marketOnly++;
    if (r.aiWinner !== r.marketFavorite) {
      summary.disagreements++;
      disagreements.push({ gameId: r.gameId, aiWinner: r.aiWinner, marketFavorite: r.marketFavorite, aiCorrect, marketCorrect });
    }
  }
  return { summary, disagreements };
}
export function confidenceBuckets(rows) {
  // Grades are labels, not calibrated probabilities. Report observed rates and sample sizes.
  const out = {};
  for (const r of rows) {
    if (!r.grade || !["win", "loss"].includes(r.result)) continue;
    const b = out[r.grade] ??= { wins: 0, losses: 0, games: 0, rate: null };
    b.games++;
    b[r.result === "win" ? "wins" : "losses"]++;
    b.rate = b.wins / b.games;
  }
  return out;
}
