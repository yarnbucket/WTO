import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { appendRevision, calculateEditorialProjection, gradeRevision, validateEditorialRevision, validateRevision, validateInsightFile } from '../scripts/wto-insights-lib.mjs';

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
test('tuesday_baseline_preserves_its_timestamped_market',()=>{const insights=JSON.parse(fs.readFileSync(new URL('../wto-game-insights-2026.json',import.meta.url)));for(const entry of insights.weeks[0].games){const market=entry.revisions[0].market_comparison;assert.ok(market.favorite);assert.ok(Number.isFinite(market.spread));assert.ok(Number.isFinite(market.total));assert.ok(market.provider);assert.ok(!Number.isNaN(Date.parse(market.market_as_of)));}});
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
test('accepts_game_day_weather_change',()=>{const next=sundayRevision();next.factor_summary.weather={forecast_stage:'game_day',effect:'negative',detail:'Verified wind.',location:'Cleveland, OH',forecast_as_of:'2026-10-01T11:55:00-04:00',source_url:'https://weather.gov/'};assert.equal(appendRevision(insightFile(),game.id,next,{games:[game]}).weeks[0].games[0].revisions.length,2);});
test('rejects_post_kickoff_revision',()=>{const next=sundayRevision();next.generated_at='2026-10-02T01:00:00Z';assert.throws(()=>appendRevision(insightFile(),game.id,next,{games:[game]}),/REVISION_AFTER_KICKOFF/);});

const finalGame={...game,status:'final',away_score:24,home_score:21,closing_favorite:'PIT',closing_spread:-2.5,closing_total:45};
test('grades_straight_up_prediction',()=>assert.equal(gradeRevision(valid(),finalGame).winner_correct,true));
test('grades_ats_with_verified_or_last_verified_line',()=>{const grade=gradeRevision(valid(),{...finalGame,closing_favorite:null,closing_spread:null,grading_favorite:'PIT',grading_spread:-3.5,grading_total:45,grading_line_type:'latest_verified_pregame_snapshot'});assert.equal(grade.grading_line_type,'latest_verified_pregame_snapshot');assert.equal(grade.ats_result,'CLE');});
test('grades_total_push',()=>assert.equal(gradeRevision(valid(),finalGame).total_result,'PUSH'));
test('calculates_score_and_margin_error',()=>{const grade=gradeRevision(valid(),finalGame);assert.equal(grade.absolute_score_error,6);assert.equal(grade.absolute_margin_error,0);});
test('service_worker_caches_insight_artifact',()=>assert.match(fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8'),/wto-game-insights-2026\.json/));
test('service_worker_cache_version_is_incremented',()=>assert.match(fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8'),/wto-shell-v35/));

const editorialModel=()=>({
  away:'PIT',home:'CLE',neutral_total:42,total_adjustments:[{key:'weather',points:-1}],
  factors:[
    ['recent_performance',35,-.3,1],['quarterback_personnel',20,-.2,.8],['matchup',15,.2,.7],
    ['home_travel_weather',10,.4,.9],['hometown_sentiment',10,.3,.5],['coaching_history',5,0,0],['special_teams_regression',5,-.1,.6]
  ].map(([key,weight,score,strength])=>({key,weight,score,strength,claims:strength?[key+'-claim']:[],source_ids:strength?['src-1']:[]})),
  sources:[{id:'src-1',provider:'ESPN',url:'https://www.espn.com/nfl/',checked_at:'2026-09-30T10:00:00-04:00'}]
});
test('editorial_weights_sum_to_100',()=>assert.equal(validateEditorialRevision({factor_model:editorialModel()},game).includes('INVALID_FACTOR_WEIGHTS'),false));
test('hometown_weight_is_exactly_10',()=>{const m=editorialModel();m.factors.find(f=>f.key==='hometown_sentiment').weight=11;assert.ok(validateEditorialRevision({factor_model:m},game).includes('INVALID_HOMETOWN_WEIGHT'));});
test('factor_score_is_between_negative_one_and_one',()=>{const m=editorialModel();m.factors[0].score=1.1;assert.ok(validateEditorialRevision({factor_model:m},game).includes('INVALID_FACTOR_SCORE'));});
test('unverified_factor_has_zero_strength',()=>{const m=editorialModel();m.factors[0].claims=[];m.factors[0].source_ids=[];assert.ok(validateEditorialRevision({factor_model:m},game).includes('UNVERIFIED_FACTOR_STRENGTH'));});
test('rejects_duplicate_evidence_claim',()=>{const m=editorialModel();m.factors[1].claims=[m.factors[0].claims[0]];assert.ok(validateEditorialRevision({factor_model:m},game).includes('DUPLICATE_EVIDENCE_CLAIM'));});
test('permits_positive_backup_qb_evidence',()=>{const m=editorialModel();m.factors[1].score=.4;assert.ok(!validateEditorialRevision({factor_model:m},game).includes('INVALID_FACTOR_SCORE'));});
test('requires_source_and_timestamp_for_material_claim',()=>{const m=editorialModel();m.sources[0].checked_at=null;assert.ok(validateEditorialRevision({factor_model:m},game).includes('UNSOURCED_MATERIAL_CLAIM'));});
test('calculate_editorial_projection_is_reproducible',()=>{const a=calculateEditorialProjection(editorialModel()),b=calculateEditorialProjection(editorialModel());assert.deepEqual(a,b);assert.equal(a.away_score+a.home_score,a.projected_total);assert.equal(Math.abs(a.home_score-a.away_score),a.projected_margin);});

test('week4_has_16_editorial_rescrub_revisions',()=>{const f=JSON.parse(fs.readFileSync(new URL('../wto-game-insights-2026.json',import.meta.url)));assert.equal(f.weeks[0].games.filter(g=>g.revisions.some(r=>r.revision_type==='editorial_rescrub')).length,16);});
test('tuesday_baselines_are_unchanged',()=>{const f=JSON.parse(fs.readFileSync(new URL('../wto-game-insights-2026.json',import.meta.url))),hash=crypto.createHash('sha256').update(JSON.stringify(f.weeks[0].games.map(g=>g.revisions[0]))).digest('hex');assert.equal(hash,'4de70bde79c8225eb5acca5de11485feed867971c25eb022f115a3a47dd8160b');});
test('all_editorial_numbers_recalculate_exactly',()=>{const f=JSON.parse(fs.readFileSync(new URL('../wto-game-insights-2026.json',import.meta.url)));for(const r of f.weeks[0].games.map(g=>g.revisions.find(x=>x.revision_type==='editorial_rescrub'))){assert.deepEqual(r.independent_projection,calculateEditorialProjection(r.factor_model));}});
test('all_material_claims_resolve_to_sources',()=>{const f=JSON.parse(fs.readFileSync(new URL('../wto-game-insights-2026.json',import.meta.url)));for(const r of f.weeks[0].games.map(g=>g.revisions.find(x=>x.revision_type==='editorial_rescrub'))){assert.deepEqual(validateEditorialRevision(r),[]);}});
test('no_market_field_appears_in_factor_model',()=>{const f=JSON.parse(fs.readFileSync(new URL('../wto-game-insights-2026.json',import.meta.url)));for(const r of f.weeks[0].games.map(g=>g.revisions.find(x=>x.revision_type==='editorial_rescrub'))){assert.doesNotMatch(JSON.stringify(r.factor_model),/market_|spread|favorite/);}});
test('editorial_tie_uses_no_edge',()=>{const r=structuredClone(valid());r.revision_type='editorial_rescrub';r.factor_model=editorialModel();r.independent_projection={winner:'NO EDGE',winner_side:'NO EDGE',away_score:20,home_score:20,projected_margin:0,projected_total:40,win_probability:.5,audit:{}};assert.ok(!validateRevision(r,game).includes('PROJECTED_WINNER_MISMATCH'));});
test('editorial_early_weather_is_not_labeled_game_day',()=>{const f=JSON.parse(fs.readFileSync(new URL('../wto-game-insights-2026.json',import.meta.url)));for(const [entry] of f.weeks[0].games.map(g=>[g.revisions.find(x=>x.revision_type==='editorial_rescrub')]))assert.ok(!validateRevision(entry,game).includes('EARLY_FORECAST_LABELED_GAME_DAY'));});
test('renders_wtos_read_heading',()=>assert.match(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),/WTO READ/));
test('renders_compact_read',()=>assert.match(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),/compactRead/));
test('retains_win_score_ats_total_hype_confidence_and_risk',()=>{const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');for(const label of ['Win Lean','Projected Score','ATS Lean','Total Lean','Hype Check','Confidence','Primary Risk'])assert.match(html,new RegExp(label));});
test('keeps_sources_out_of_collapsed_quick_read',()=>assert.doesNotMatch(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),/Sources checked:/));
test('does_not_render_factor_weight_list',()=>assert.doesNotMatch(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),/recent_performance.*35/));
test('grades_no_edge_as_not_applicable',()=>{const r=valid();r.market_comparison.ats_lean='NO EDGE';r.market_comparison.total_lean='NO EDGE';const grade=gradeRevision(r,finalGame);assert.equal(grade.ats_lean_correct,null);assert.equal(grade.total_lean_correct,null);});
