import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=html.slice(html.indexOf('function matchupPredictionHeader'),html.indexOf('function teamLeadersHtml'));
function setup(revision){const ctx={latestPregameInsight:()=>revision,safeText:v=>String(v??'').replaceAll('<','&lt;'),signed:v=>v>0?'+'+v:String(v),completedQuickReadHtml:()=>'<p>Verified outcome vs prediction</p>'};vm.createContext(ctx);vm.runInContext(code,ctx);return ctx}
const g={id:'x',away:'TB',home:'DAL',status:'scheduled'};
test('team read uses selected team evidence and does not invent player upside',()=>{const c=setup({factor_summary:{recent_form:'Four-game form',quarterback:{detail:'Availability unresolved'}},team_reads:{DAL:{player_upside:'Verified Dallas player upside',keys_to_compete:'Protect the pocket',watch_out:'Run defense'}},injuries:[{team:'DAL',player:'Dallas player',position:'G',status:'Limited'},{team:'TB',player:'Other player',status:'Out'}],sources:[]});assert.match(c.teamOutcomeSummary(g,'DAL'),/Protect the pocket/);assert.match(c.teamOutcomeSummary(g,'DAL'),/Dallas player · G · Limited/);assert.doesNotMatch(c.teamOutcomeSummary(g,'DAL'),/Other player/);assert.match(c.teamOutcomeSummary(g,'TB'),/Player-specific upside has not been verified/)});
test('prediction displays complementary probabilities and completed review',()=>{const c=setup({independent_projection:{winner:'DAL',win_probability:.702,away_score:24,home_score:30},confidence:'LOW',model_audit:{probability_calibrated:false}});assert.match(c.matchupPredictionHeader(g),/TB 30%/);assert.match(c.matchupPredictionHeader(g),/DAL 70%/);assert.match(c.matchupPredictionHeader(g),/Uncalibrated/);assert.match(c.teamOutcomeSummary({...g,status:'final'},'TB'),/Verified outcome vs prediction/)});
