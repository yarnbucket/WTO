import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectMatchup} from '../scripts/wto-points-model.mjs';
const ledger=JSON.parse(fs.readFileSync(new URL('../ff26-nfl-lines-2026.json',import.meta.url)));
const insights=JSON.parse(fs.readFileSync(new URL('../wto-game-insights-2026.json',import.meta.url)));
const games=ledger.weeks.filter(w=>w.week<=4).flatMap(w=>w.games).filter(g=>g.status==='final');
const matchup=ledger.weeks.find(w=>w.week===5).games[0];
test('independent projection is unchanged by spread total and favorite',()=>{
 assert.deepEqual(projectMatchup(matchup,games),projectMatchup({...matchup,market_favorite:matchup.away,market_spread:-30,market_total:99},games));
});
test('opponent model uses only other opponent games for strength adjustment',()=>{
 const rows=[{game_id:'ab',away:'A',home:'B',away_score:21,home_score:14},{game_id:'ac',away:'A',home:'C',away_score:21,home_score:14},{game_id:'bd',away:'B',home:'D',away_score:35,home_score:7},{game_id:'cd',away:'C',home:'D',away_score:35,home_score:7}];
 const r=projectMatchup({away:'A',home:'D'},rows);
 assert.deepEqual(r.away.opponents,['B','C']);assert.ok(Number.isFinite(r.away.offense));assert.equal(r.away.count,2);
});
test('all Week 5 games preserve baseline and append a distinct audited revision',()=>{
 for(const e of insights.weeks.find(w=>w.week===5).games){assert.ok(e.revisions.length>=2);const r=e.revisions.at(-1);assert.equal(r.revision_type,'evidence_revision');assert.equal(r.model_audit.market_used_as_input,false);assert.equal(r.model_audit.probability_calibrated,false);assert.ok(r.what_changed);assert.ok(r.why_changed);}
});
test('Week 4 reviews grade original pregame predictions and remain retrospective',()=>{
 for(const e of insights.weeks.find(w=>w.week===4).games){const g=ledger.weeks.find(w=>w.week===4).games.find(g=>g.game_id===e.game_id),r=e.revisions.find(r=>r.revision_id===e.postgame_review.prediction_revision_id);assert.equal(e.postgame_review.analysis_type,'retrospective');assert.ok(Date.parse(r.generated_at)<Date.parse(g.kickoff_et));assert.ok(e.postgame_review.bullets.weakness_exposed.includes('WTO projected'));}
});
