import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadUI(){
  const context={};
  context.globalThis=context;
  vm.runInNewContext(fs.readFileSync(new URL('../wto-ui-lib.js',import.meta.url),'utf8'),context);
  return context.WTOUI;
}

const kickoff='2026-10-04T13:00:00-04:00';
const finalGame={id:'2026-W04-PIT-CLE',kickoff,status:'final',away:'PIT',home:'CLE',awayScore:24,homeScore:21,ats:'CLE',ou:'UNDER',gradingFavorite:'PIT',gradingSpread:-3.5,gradingTotal:46,gradingLineType:'latest_verified_pregame_snapshot'};
const revision={revision_id:'baseline',generated_at:'2026-09-29T06:00:00-04:00',confidence:'MEDIUM',independent_projection:{winner:'PIT',away_score:21,home_score:18,projected_margin:3,projected_total:39,win_probability:.58},market_comparison:{ats_lean:'PIT',total_lean:'UNDER'},factor_summary:{weather:{forecast_stage:'early_forecast',effect:'neutral',detail:'Early forecast.'},matchup:'Pittsburgh owns the trench edge.'}};

test('labels grading fallback as Last Verified',()=>{
  const ui=loadUI();
  assert.equal(ui.latestMarket(finalGame).label,'Last Verified');
});

test('labels complete explicit close as Closing',()=>{
  const ui=loadUI();
  const game={...finalGame,closingFavorite:'PIT',closingSpread:-3,closingTotal:45};
  assert.equal(ui.latestMarket(game).label,'Closing');
});

test('does not score NO EDGE as correct',()=>{
  const ui=loadUI();
  const noEdge={...revision,market_comparison:{ats_lean:'NO EDGE',total_lean:'NO EDGE'}};
  assert.equal(ui.evaluatePredictionOutcome(finalGame,noEdge).ats_correct,null);
  assert.equal(ui.evaluatePredictionOutcome(finalGame,noEdge).total_correct,null);
});

test('rejects post-kickoff revision from prediction grading',()=>{
  const ui=loadUI();
  const late={...revision,generated_at:'2026-10-04T13:00:00-04:00'};
  assert.equal(ui.evaluatePredictionOutcome(finalGame,late),null);
});

test('summarizes indoor weather without showing a material chip',()=>{
  const ui=loadUI();
  const indoor={...revision,factor_summary:{weather:{forecast_stage:'controlled_environment',effect:'neutral',detail:'Indoor venue.'}}};
  assert.deepEqual({...ui.weatherView(indoor)},{visible:false,stage:'controlled_environment',effect:'neutral',text:'Indoor · Low impact'});
});

test('shows material windy weather',()=>{
  const ui=loadUI();
  const windy={...revision,factor_summary:{weather:{forecast_stage:'game_day',effect:'negative',detail:'31°F and windy · passing and kicking risk'}}};
  const result=ui.weatherView(windy);
  assert.equal(result.visible,true);
  assert.match(result.text,/31°F.*windy/i);
});

test('shows a material early forecast with a preliminary label',()=>{
  const ui=loadUI();
  const early={...revision,factor_summary:{weather:{forecast_stage:'early_forecast',effect:'negative',detail:'Cold rain and strong wind possible.'}}};
  const result=ui.weatherView(early);
  assert.equal(result.visible,true);
  assert.match(result.text,/Early forecast.*Cold rain/i);
});

test('grades results from the same latest market that is displayed',()=>{
  const ui=loadUI(),game={...finalGame,ats:'PIT',ou:'OVER'};
  assert.deepEqual({...ui.marketOutcome(game,ui.latestMarket(game))},{ats_result:'CLE',total_result:'UNDER',combined_points:45});
});

test('builds a compact read from the latest insight',()=>{
  const ui=loadUI();
  assert.equal(ui.compactRead(finalGame,revision).confidence,'MEDIUM');
});

test('summarizes existing basic and advanced picks',()=>{
  const ui=loadUI();
  const picks={[finalGame.id]:'PIT'},advancedPicks={[finalGame.id]:{ats:'PIT',total:'UNDER'}};
  assert.deepEqual({...ui.pickSummary(finalGame,picks,advancedPicks)},{winner:'PIT',ats:'PIT',total:'UNDER',saved:true});
});

test('omits unsupported player-rising recap bullet',()=>{
  const ui=loadUI();
  const review={bullets:{final:'PIT won 24–21.',why_winner_won:'PIT protected the ball.',weakness_exposed:'CLE struggled on third down.',carry_forward:'Watch the protection next week.'}};
  const grade=ui.evaluatePredictionOutcome(finalGame,revision);
  assert.equal(ui.postgameBullets(finalGame,review,grade).some(x=>x.key==='player_rising'),false);
});

test('fallback recap contains only the verified mechanical final',()=>{
  const ui=loadUI(),grade=ui.evaluatePredictionOutcome(finalGame,revision),items=ui.postgameBullets(finalGame,null,grade);
  assert.deepEqual([...items.map(item=>item.key)],['final']);
});

test('loads WTOUI helper before application code',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const helper=html.indexOf('<script src="./wto-ui-lib.js"></script>');
  const app=html.indexOf('const TEAM=');
  assert.ok(helper>=0&&helper<app);
});

test('scheduled compact matchup cards expose the WTO read, market, weather, and saved picks',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/function compactMatchupCard\(g\)/);
  assert.match(html,/WTOUI\.compactRead\(g,revision\)/);
  assert.match(html,/WTOUI\.weatherView\(revision\)/);
  assert.match(html,/WTOUI\.pickSummary\(g,picks,advancedPicks\)/);
  assert.match(html,/WTO READ/);
  assert.match(html,/CURRENT SPREAD/);
  assert.match(html,/CURRENT TOTAL/);
  assert.match(html,/weather\.visible/);
  assert.match(html,/PICKS SAVED/);
});

test('compact market display does not manufacture standard juice',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const start=html.indexOf('function compactMatchupCard(g)');
  const end=html.indexOf('function selectGame(',start);
  assert.ok(start>=0&&end>start);
  assert.doesNotMatch(html.slice(start,end),/-110/);
});

test('weekly render starts collapsed and retains existing Pick em handlers',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/if\(!selectedGameId\)selectedGameId=/);
  assert.match(html,/onclick="pickTeam\('/);
  assert.match(html,/onclick="setAdvancedPick\('/);
});

test('compact matchup cards meet the minimum touch target',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/\.compact-game\{[^}]*min-height:\s*44px/s);
});

test('Quick Read uses one market source and limits the fan recap to six bullets',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/function completedQuickReadHtml\(g\)/);
  assert.match(html,/WTOUI\.latestMarket\(g\)/);
  assert.match(html,/WTOUI\.marketOutcome\(g,market\)/);
  assert.match(html,/WTOUI\.postgameBullets\(g,review,grade\)\.slice\(0,6\)/);
  assert.doesNotMatch(html,/GAME &amp; ODDS EXECUTIVE SUMMARY/);
  assert.equal((html.match(/class="final-executive-score"/g)||[]).length,0);
});

test('postgame grading honors the review prediction revision id',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/review\?\.prediction_revision_id/);
  assert.match(html,/revision_id===review\.prediction_revision_id/);
});

test('WTO REVIEW displays Winner, Spread, Total, and NO EDGE for unscored calls',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/WTO REVIEW/);
  assert.match(html,/gradeItem\('Winner',grade\?\.winner_correct\)/);
  assert.match(html,/gradeItem\('Spread',grade\?\.ats_correct\)/);
  assert.match(html,/gradeItem\('Total',grade\?\.total_correct\)/);
  assert.match(html,/function reviewGradeLabel\(value\).*NO EDGE/s);
});

test('completed game detail renders exactly three collapsed accessible accordions',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/function detailAccordionHtml\(g,kind\)/);
  assert.match(html,/aria-expanded="false"/);
  assert.match(html,/panelId=`detail-\$\{kind\}-\$\{g\.id\}`/);
  assert.match(html,/aria-controls="\$\{panelId\}"/);
  assert.match(html,/TOP PERFORMERS/);
  assert.match(html,/GAME STATS &amp; ODDS/);
  assert.match(html,/HISTORY &amp; TRENDS/);
  assert.match(html,/toggleDetailAccordion\('/);
});

test('detail accordions lazy-load data and keep natural unavailable states',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/async function toggleDetailAccordion\(gameId,kind\)/);
  assert.match(html,/panel\.dataset\.loaded/);
  assert.match(html,/Top performers are not available yet\./);
  assert.match(html,/Detailed stats are not available yet\./);
  assert.match(html,/Historical records could not be loaded\./);
});
