import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { appendRevision, gradeRevision, validateRevision, validateInsightFile } from '../scripts/wto-insights-lib.mjs';

const game = { id:'2026-W04-PIT-CLE', week:4, kickoff:'2026-10-01T20:15:00-04:00', away:'PIT', home:'CLE' };
const valid = () => ({
  revision_id:'2026-W04-PIT-CLE-tuesday-20260929T055807-0400', revision_type:'tuesday_baseline', generated_at:'2026-09-29T05:58:07-04:00',
  independent_projection:{ winner:'PIT', away_score:21, home_score:18, projected_margin:3, projected_total:39, win_probability:0.58 },
  market_comparison:{ favorite:'PIT', spread:-2.5, total:38.5, provider:'ScoresAndOdds', market_as_of:'2026-09-29T05:58:07-04:00', ats_lean:'PIT', total_lean:'OVER', hype_check:'SUPPORTED' },
  factor_summary:{ quarterback:{ effect:'positive', status:'starter', detail:'Verified starter context.' }, weather:{ forecast_stage:'early_forecast', effect:'neutral', detail:'Early forecast only.' }, evidence_for_away:['Recent form'], evidence_for_home:['Home field'], primary_risk:'Availability may change.' },
  confidence:'LOW', sources:[{provider:'ScoresAndOdds',url:'https://www.scoresandodds.com/nfl',checked_at:'2026-09-29T05:58:07-04:00'}], unavailable_fields:[]
});

test('accepts_valid_week4_tuesday_baseline',()=>assert.deepEqual(validateRevision(valid(),game),[]));
test('rejects_score_margin_mismatch',()=>{const r=valid();r.independent_projection.projected_margin=4;assert.ok(validateRevision(r,game).includes('PROJECTED_MARGIN_MISMATCH'));});
test('rejects_score_total_mismatch',()=>{const r=valid();r.independent_projection.projected_total=40;assert.ok(validateRevision(r,game).includes('PROJECTED_TOTAL_MISMATCH'));});
test('rejects_duplicate_revision_id',()=>{const r=valid();const f={schema_version:'1.0',season:2026,model_version:'week4-trial-v1',updated_at:r.generated_at,weeks:[{week:4,status:'trial',games:[{game_id:game.id,revisions:[r,{...r}]}]}]};assert.ok(validateInsightFile(f,{games:[game]}).errors.includes('DUPLICATE_REVISION_ID'));});
test('rejects_revision_after_kickoff',()=>{const r=valid();r.generated_at='2026-10-02T01:00:00Z';assert.ok(validateRevision(r,game).includes('REVISION_AFTER_KICKOFF'));});
test('requires_unavailable_reason_for_missing_core_input',()=>{const r=valid();delete r.factor_summary.quarterback;assert.ok(validateRevision(r,game).includes('MISSING_CORE_INPUT_REASON'));});
test('permits_positive_backup_qb_effect',()=>{const r=valid();r.factor_summary.quarterback={status:'backup',effect:'positive',detail:'Verified favorable history.'};assert.ok(!validateRevision(r,game).includes('INVALID_QB_EFFECT'));});
test('rejects_game_day_weather_label_for_early_forecast',()=>{const r=valid();r.factor_summary.weather={forecast_stage:'early_forecast',effect:'neutral',detail:'Verified game-day weather.'};assert.ok(validateRevision(r,game).includes('EARLY_FORECAST_LABELED_GAME_DAY'));});

test('week4_contains_exactly_16_games',()=>{const f=JSON.parse(fs.readFileSync(new URL('../wto-game-insights-2026.json',import.meta.url)));assert.equal(f.weeks[0].games.length,16);});
test('every_game_has_tuesday_baseline_or_insufficient_evidence',()=>{const f=JSON.parse(fs.readFileSync(new URL('../wto-game-insights-2026.json',import.meta.url)));assert.ok(f.weeks[0].games.every(g=>g.revisions.some(r=>['tuesday_baseline','insufficient_evidence'].includes(r.revision_type))));});
test('every_revision_has_source_timestamp',()=>{const f=JSON.parse(fs.readFileSync(new URL('../wto-game-insights-2026.json',import.meta.url)));assert.ok(f.weeks[0].games.flatMap(g=>g.revisions).every(r=>r.sources.length&&r.sources.every(s=>s.url&&!Number.isNaN(Date.parse(s.checked_at)))));});
test('market_fields_match_week4_ledger_snapshot',()=>{const insights=JSON.parse(fs.readFileSync(new URL('../wto-game-insights-2026.json',import.meta.url))),ledger=JSON.parse(fs.readFileSync(new URL('../ff26-nfl-lines-2026.json',import.meta.url))),games=new Map(ledger.weeks.find(w=>w.week===4).games.map(g=>[g.game_id,g]));for(const entry of insights.weeks[0].games){const market=entry.revisions[0].market_comparison,g=games.get(entry.game_id);assert.equal(market.favorite,g.market_favorite);assert.equal(market.spread,g.market_spread);assert.equal(market.total,g.market_total);}});
test('independent_projection_does_not_copy_market_as_input',()=>{const f=JSON.parse(fs.readFileSync(new URL('../wto-game-insights-2026.json',import.meta.url)));for(const r of f.weeks[0].games.flatMap(g=>g.revisions)){assert.ok(!('spread' in r.independent_projection));assert.ok(!('market_total' in r.independent_projection));assert.ok(!('favorite' in r.independent_projection));}});

test('index_fetches_insight_artifact',()=>assert.match(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),/wto-game-insights-2026\.json/));
test('scheduled_game_uses_latest_pregame_revision',()=>assert.match(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),/latestPregameInsight/));
test('missing_insight_renders_insufficient_evidence',()=>assert.match(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),/Insufficient Evidence/));
test('old_market_led_reason_copy_is_absent',()=>assert.doesNotMatch(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),/Market line plus \$\{p\.games\}/));
test('last_verified_is_not_rendered_as_closing',()=>assert.match(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),/Last Verified/));

function insightFile(revision=valid()){return {schema_version:'1.0',season:2026,model_version:'week4-trial-v1',updated_at:revision.generated_at,weeks:[{week:4,status:'trial',games:[{game_id:game.id,revisions:[revision]}]}]}}
function sundayRevision(){const r=structuredClone(valid());r.revision_id='2026-W04-PIT-CLE-sunday-20261001T120000-0400';r.revision_type='sunday_refresh';r.generated_at='2026-10-01T12:00:00-04:00';return r}

test('preserves_tuesday_baseline_byte_for_byte',()=>{const file=insightFile(),before=JSON.stringify(file.weeks[0].games[0].revisions[0]);const next=sundayRevision();next.independent_projection.projected_margin=4;next.independent_projection.away_score=22;next.independent_projection.projected_total=40;const result=appendRevision(file,game.id,next,{games:[game]});assert.equal(JSON.stringify(result.weeks[0].games[0].revisions[0]),before);});
test('rejects_non_material_sunday_revision',()=>assert.throws(()=>appendRevision(insightFile(),game.id,sundayRevision(),{games:[game]}),/NON_MATERIAL_REVISION/));
test('accepts_verified_qb_status_change',()=>{const next=sundayRevision();next.factor_summary.quarterback.status='backup';assert.equal(appendRevision(insightFile(),game.id,next,{games:[game]}).weeks[0].games[0].revisions.length,2);});
test('accepts_game_day_weather_change',()=>{const next=sundayRevision();next.factor_summary.weather={forecast_stage:'game_day',effect:'negative',detail:'Verified wind.'};assert.equal(appendRevision(insightFile(),game.id,next,{games:[game]}).weeks[0].games[0].revisions.length,2);});
test('rejects_post_kickoff_revision',()=>{const next=sundayRevision();next.generated_at='2026-10-02T01:00:00Z';assert.throws(()=>appendRevision(insightFile(),game.id,next,{games:[game]}),/REVISION_AFTER_KICKOFF/);});

const finalGame={...game,status:'final',away_score:24,home_score:21,closing_favorite:'PIT',closing_spread:-2.5,closing_total:45};
test('grades_straight_up_prediction',()=>assert.equal(gradeRevision(valid(),finalGame).winner_correct,true));
test('grades_ats_with_verified_or_last_verified_line',()=>{const grade=gradeRevision(valid(),{...finalGame,closing_favorite:null,closing_spread:null,grading_favorite:'PIT',grading_spread:-3.5,grading_total:45,grading_line_type:'latest_verified_pregame_snapshot'});assert.equal(grade.grading_line_type,'latest_verified_pregame_snapshot');assert.equal(grade.ats_result,'CLE');});
test('grades_total_push',()=>assert.equal(gradeRevision(valid(),finalGame).total_result,'PUSH'));
test('calculates_score_and_margin_error',()=>{const grade=gradeRevision(valid(),finalGame);assert.equal(grade.absolute_score_error,6);assert.equal(grade.absolute_margin_error,0);});
test('service_worker_caches_insight_artifact',()=>assert.match(fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8'),/wto-game-insights-2026\.json/));
test('service_worker_cache_version_is_incremented',()=>assert.match(fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8'),/wto-shell-v10/));
