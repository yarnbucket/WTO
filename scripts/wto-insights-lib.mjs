const iso = value => Number.isFinite(Date.parse(value));

export function validateRevision(revision, game) {
  const errors = [];
  const p = revision?.independent_projection;
  if (!revision?.revision_id) errors.push('MISSING_REVISION_ID');
  if (!iso(revision?.generated_at)) errors.push('INVALID_GENERATED_AT');
  if (iso(revision?.generated_at) && iso(game?.kickoff ?? game?.kickoff_et) && Date.parse(revision.generated_at) >= Date.parse(game.kickoff ?? game.kickoff_et)) errors.push('REVISION_AFTER_KICKOFF');
  if (p) {
    if (Math.abs(Math.abs(p.away_score - p.home_score) - p.projected_margin) > 0.001) errors.push('PROJECTED_MARGIN_MISMATCH');
    if (Math.abs(p.away_score + p.home_score - p.projected_total) > 0.001) errors.push('PROJECTED_TOTAL_MISMATCH');
    const scoreWinner = p.away_score === p.home_score ? 'TIE' : p.away_score > p.home_score ? game.away : game.home;
    if (p.winner !== scoreWinner) errors.push('PROJECTED_WINNER_MISMATCH');
  } else if (revision?.revision_type !== 'insufficient_evidence') errors.push('MISSING_PROJECTION');
  for (const key of ['quarterback','weather']) {
    if (!revision?.factor_summary?.[key] && !revision?.unavailable_fields?.some(x => x.field === key && x.reason)) errors.push('MISSING_CORE_INPUT_REASON');
  }
  const q = revision?.factor_summary?.quarterback;
  if (q && !['positive','neutral','negative'].includes(q.effect)) errors.push('INVALID_QB_EFFECT');
  const w = revision?.factor_summary?.weather;
  if (w?.forecast_stage === 'early_forecast' && /verified game-day/i.test(w.detail ?? '')) errors.push('EARLY_FORECAST_LABELED_GAME_DAY');
  if (!revision?.market_comparison?.provider || !iso(revision?.market_comparison?.market_as_of)) errors.push('INVALID_MARKET_COMPARISON');
  if (!revision?.sources?.length || revision.sources.some(s => !s.url || !iso(s.checked_at))) errors.push('INVALID_SOURCE');
  return [...new Set(errors)];
}

export function validateInsightFile(file, ledger) {
  const errors = [], warnings = [];
  if (file?.schema_version !== '1.0') errors.push('INVALID_SCHEMA_VERSION');
  const ledgerGames = new Map((ledger?.games ?? ledger?.weeks?.flatMap(w => w.games) ?? []).map(g => [g.game_id ?? g.id, g]));
  const ids = new Set();
  for (const week of file?.weeks ?? []) for (const entry of week.games ?? []) {
    const game = ledgerGames.get(entry.game_id);
    if (!game) { errors.push('UNKNOWN_GAME_ID'); continue; }
    for (const revision of entry.revisions ?? []) {
      if (ids.has(revision.revision_id)) errors.push('DUPLICATE_REVISION_ID');
      ids.add(revision.revision_id);
      errors.push(...validateRevision(revision, game));
    }
  }
  return { errors:[...new Set(errors)], warnings };
}

export function appendRevision(file, gameId, revision, ledger) {
  const copy = structuredClone(file);
  const entry = copy.weeks.flatMap(w => w.games).find(g => g.game_id === gameId);
  if (!entry) throw new Error('UNKNOWN_GAME_ID');
  if (entry.revisions.some(r => r.revision_id === revision.revision_id)) throw new Error('DUPLICATE_REVISION_ID');
  const game = (ledger?.weeks?.flatMap(w => w.games) ?? ledger?.games ?? []).find(g => (g.game_id ?? g.id) === gameId);
  const errors = validateRevision(revision, game);
  if (errors.length) throw new Error(errors[0]);
  const previous = entry.revisions.at(-1);
  if (revision.revision_type === 'sunday_refresh' && previous) {
    const changed = [
      previous.factor_summary?.quarterback?.status !== revision.factor_summary?.quarterback?.status,
      previous.factor_summary?.quarterback?.effect !== revision.factor_summary?.quarterback?.effect,
      previous.factor_summary?.injuries?.effect !== revision.factor_summary?.injuries?.effect,
      revision.factor_summary?.weather?.forecast_stage === 'game_day' && previous.factor_summary?.weather?.effect !== revision.factor_summary?.weather?.effect,
      Math.abs((previous.independent_projection?.projected_margin ?? 0) - (revision.independent_projection?.projected_margin ?? 0)) >= 1,
      Math.abs((previous.independent_projection?.projected_total ?? 0) - (revision.independent_projection?.projected_total ?? 0)) >= 1,
      previous.independent_projection?.winner !== revision.independent_projection?.winner,
      previous.market_comparison?.ats_lean !== revision.market_comparison?.ats_lean,
      previous.market_comparison?.total_lean !== revision.market_comparison?.total_lean,
      previous.market_comparison?.hype_check !== revision.market_comparison?.hype_check,
      previous.confidence !== revision.confidence
    ].some(Boolean);
    if (!changed) throw new Error('NON_MATERIAL_REVISION');
  }
  entry.revisions.push(revision);
  copy.updated_at = revision.generated_at;
  return copy;
}

export function gradeRevision(revision, finalGame) {
  if (!revision?.independent_projection || finalGame?.status !== 'final') return null;
  const p = revision.independent_projection;
  const actualWinner = finalGame.away_score === finalGame.home_score ? 'TIE' : finalGame.away_score > finalGame.home_score ? finalGame.away : finalGame.home;
  const hasClose = finalGame.closing_favorite && finalGame.closing_spread != null && finalGame.closing_total != null;
  const favorite = hasClose ? finalGame.closing_favorite : finalGame.grading_favorite;
  const spread = hasClose ? finalGame.closing_spread : finalGame.grading_spread;
  const total = hasClose ? finalGame.closing_total : finalGame.grading_total;
  const lineType = hasClose ? 'verified_closing' : finalGame.grading_line_type;
  const favoriteScore = favorite === finalGame.away ? finalGame.away_score : finalGame.home_score;
  const dog = favorite === finalGame.away ? finalGame.home : finalGame.away;
  const dogScore = favorite === finalGame.away ? finalGame.home_score : finalGame.away_score;
  const adjusted = Number(favoriteScore) + Number(spread);
  const atsResult = spread == null || !favorite ? null : adjusted === Number(dogScore) ? 'PUSH' : adjusted > Number(dogScore) ? favorite : dog;
  const actualTotal = Number(finalGame.away_score) + Number(finalGame.home_score);
  const totalResult = total == null ? null : actualTotal === Number(total) ? 'PUSH' : actualTotal > Number(total) ? 'OVER' : 'UNDER';
  const actualMargin = Math.abs(Number(finalGame.away_score) - Number(finalGame.home_score));
  return {
    winner_correct:p.winner === actualWinner,
    ats_result:atsResult,
    ats_lean_correct:atsResult && atsResult !== 'PUSH' ? revision.market_comparison?.ats_lean === atsResult : null,
    total_result:totalResult,
    total_lean_correct:totalResult && totalResult !== 'PUSH' ? revision.market_comparison?.total_lean === totalResult : null,
    grading_favorite:favorite ?? null,
    grading_spread:spread ?? null,
    grading_total:total ?? null,
    grading_line_type:lineType ?? null,
    projected_total:p.projected_total,
    actual_total:actualTotal,
    absolute_total_error:Math.abs(Number(p.projected_total)-actualTotal),
    absolute_margin_error:Math.abs(Number(p.projected_margin)-actualMargin),
    absolute_score_error:Math.abs(Number(p.away_score)-Number(finalGame.away_score))+Math.abs(Number(p.home_score)-Number(finalGame.home_score))
  };
}
