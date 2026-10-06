const iso = value => Number.isFinite(Date.parse(value));
const EDITORIAL_WEIGHTS = {recent_performance:35,quarterback_personnel:20,matchup:15,home_travel_weather:10,hometown_sentiment:10,coaching_history:5,special_teams_regression:5};
const roundHalf = value => Math.round(Number(value)*2)/2;
const clamp = (min,max,value) => Math.max(min,Math.min(max,value));

export function validateWeather(weather) {
  const errors=[];
  if (!weather) return errors;
  const stages=['early_forecast','game_day','controlled_environment','unavailable'];
  if (!stages.includes(weather.forecast_stage)) errors.push('INVALID_WEATHER_STAGE');
  if (weather.forecast_stage==='early_forecast' && /verified game-day/i.test(weather.detail??'')) errors.push('EARLY_FORECAST_LABELED_GAME_DAY');
  if (weather.forecast_stage==='game_day' && weather.effect!=='neutral' && (!weather.location || !iso(weather.forecast_as_of) || !weather.source_url)) errors.push('MISSING_WEATHER_PROVENANCE');
  if (weather.forecast_stage==='controlled_environment' && !String(weather.detail??'').trim()) errors.push('MISSING_CONTROLLED_ENVIRONMENT_DETAIL');
  return errors;
}

export function validatePostgameReview(review, game, revisions=[]) {
  const errors=[];
  if (!review) return errors;
  if (!iso(review.generated_at)) errors.push('INVALID_POSTGAME_GENERATED_AT');
  const revision=revisions.find(item=>item.revision_id===review.prediction_revision_id);
  if (!revision) errors.push('UNKNOWN_PREDICTION_REVISION');
  else {
    const kickoff=Date.parse(game?.kickoff??game?.kickoff_et??'');
    if (!iso(revision.generated_at) || (Number.isFinite(kickoff)&&Date.parse(revision.generated_at)>=kickoff)) errors.push('INVALID_POSTGAME_PREDICTION_REVISION');
  }
  if (game?.status!=='final') errors.push('POSTGAME_REVIEW_FOR_NONFINAL');
  const finalAt=Date.parse(game?.verified_at??game?.kickoff??game?.kickoff_et??'');
  if (iso(review.generated_at)&&Number.isFinite(finalAt)&&Date.parse(review.generated_at)<finalAt) errors.push('POSTGAME_REVIEW_BEFORE_FINAL');
  const bullets=review.bullets??{},required=['final','why_winner_won','weakness_exposed','carry_forward'];
  if (required.some(key=>!String(bullets[key]??'').trim())) errors.push('MISSING_POSTGAME_BULLET');
  if (Object.keys(bullets).filter(key=>String(bullets[key]??'').trim()).length>6) errors.push('TOO_MANY_POSTGAME_BULLETS');
  if (!review.evidence?.length || review.evidence.some(item=>!item.label||!item.url||!iso(item.checked_at))) errors.push('MISSING_POSTGAME_EVIDENCE');
  return [...new Set(errors)];
}

export function calculateEditorialProjection(model) {
  const weightedEdge=(model?.factors??[]).reduce((sum,f)=>sum+Number(f.weight)*Number(f.score)*Number(f.strength),0)/100;
  const rawHomeMargin=roundHalf(weightedEdge*14)||0;
  const adjustment=clamp(-8,8,(model?.total_adjustments??[]).reduce((sum,x)=>sum+Number(x.points||0),0));
  const rawTotal=roundHalf(Number(model?.neutral_total||0)+adjustment);
  const awayScore=Math.round((rawTotal-rawHomeMargin)/2),homeScore=Math.round((rawTotal+rawHomeMargin)/2);
  const margin=Math.abs(homeScore-awayScore),total=homeScore+awayScore;
  const side=homeScore===awayScore?'NO EDGE':homeScore>awayScore?'HOME':'AWAY';
  const probability=side==='NO EDGE'?.5:side==='HOME'?clamp(.15,.85,1/(1+Math.exp(-rawHomeMargin/6.5))):1-clamp(.15,.85,1/(1+Math.exp(-rawHomeMargin/6.5)));
  const winner=side==='HOME'?model.home:side==='AWAY'?model.away:'NO EDGE';
  return {winner,winner_side:side,away_score:awayScore,home_score:homeScore,projected_margin:margin,projected_total:total,win_probability:Number(probability.toFixed(3)),audit:{weighted_edge:Number(weightedEdge.toFixed(4)),raw_home_margin:rawHomeMargin,raw_total:rawTotal}};
}

export function validateEditorialRevision(revision) {
  const errors=[],model=revision?.factor_model;
  if(!model)return ['MISSING_FACTOR_MODEL'];
  const factors=model.factors??[],sum=factors.reduce((n,f)=>n+Number(f.weight||0),0);
  if(sum!==100||Object.entries(EDITORIAL_WEIGHTS).some(([key,weight])=>factors.find(f=>f.key===key)?.weight!==weight))errors.push('INVALID_FACTOR_WEIGHTS');
  if(factors.find(f=>f.key==='hometown_sentiment')?.weight!==10)errors.push('INVALID_HOMETOWN_WEIGHT');
  if(factors.some(f=>Number(f.score)<-1||Number(f.score)>1||Number(f.strength)<0||Number(f.strength)>1))errors.push('INVALID_FACTOR_SCORE');
  if(factors.some(f=>Number(f.strength)>0&&(!(f.claims?.length)||!(f.source_ids?.length))))errors.push('UNVERIFIED_FACTOR_STRENGTH');
  const claims=factors.flatMap(f=>f.claims??[]);if(new Set(claims).size!==claims.length)errors.push('DUPLICATE_EVIDENCE_CLAIM');
  const sourceIds=new Set((model.sources??[]).filter(s=>s.id&&s.url&&iso(s.checked_at)).map(s=>s.id));
  if(factors.some(f=>(f.source_ids??[]).some(id=>!sourceIds.has(id))))errors.push('UNSOURCED_MATERIAL_CLAIM');
  return [...new Set(errors)];
}

export function validateRevision(revision, game) {
  const errors = [];
  if(revision?.revision_type==='editorial_rescrub')errors.push(...validateEditorialRevision(revision,game));
  const p = revision?.independent_projection;
  if (!revision?.revision_id) errors.push('MISSING_REVISION_ID');
  if (!iso(revision?.generated_at)) errors.push('INVALID_GENERATED_AT');
  if (iso(revision?.generated_at) && iso(game?.kickoff ?? game?.kickoff_et) && Date.parse(revision.generated_at) >= Date.parse(game.kickoff ?? game.kickoff_et)) errors.push('REVISION_AFTER_KICKOFF');
  if (p) {
    if (Math.abs(Math.abs(p.away_score - p.home_score) - p.projected_margin) > 0.001) errors.push('PROJECTED_MARGIN_MISMATCH');
    if (Math.abs(p.away_score + p.home_score - p.projected_total) > 0.001) errors.push('PROJECTED_TOTAL_MISMATCH');
    const scoreWinner = p.away_score === p.home_score ? (['editorial_rescrub','evidence_revision'].includes(revision.revision_type)?'NO EDGE':'TIE') : p.away_score > p.home_score ? game.away : game.home;
    if (p.winner !== scoreWinner) errors.push('PROJECTED_WINNER_MISMATCH');
  } else if (revision?.revision_type !== 'insufficient_evidence') errors.push('MISSING_PROJECTION');
  for (const key of ['quarterback','weather']) {
    if (!revision?.factor_summary?.[key] && !revision?.unavailable_fields?.some(x => x.field === key && x.reason)) errors.push('MISSING_CORE_INPUT_REASON');
  }
  const q = revision?.factor_summary?.quarterback;
  if (q && !['positive','neutral','negative'].includes(q.effect)) errors.push('INVALID_QB_EFFECT');
  const w = revision?.factor_summary?.weather;
  errors.push(...validateWeather(w));
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
    for (const error of validatePostgameReview(entry.postgame_review,game,entry.revisions??[])) errors.push(`${entry.game_id}:${error}`);
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
    ats_lean_correct:atsResult && atsResult !== 'PUSH' && revision.market_comparison?.ats_lean !== 'NO EDGE' ? revision.market_comparison?.ats_lean === atsResult : null,
    total_result:totalResult,
    total_lean_correct:totalResult && totalResult !== 'PUSH' && revision.market_comparison?.total_lean !== 'NO EDGE' ? revision.market_comparison?.total_lean === totalResult : null,
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
