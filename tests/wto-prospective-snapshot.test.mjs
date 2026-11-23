import test from "node:test";
import assert from "node:assert/strict";
import {validateSnapshot,freezeSnapshot} from "../scripts/wto-prospective-snapshot.mjs";
const sample=()=>({schema_version:1,season:2026,week:12,captured_at:"2026-11-25T12:00:00-05:00",model_version:"empirical-errors-v1",games:[{
 game_id:"2026-W12-AAA-BBB",away:"AAA",home:"BBB",kickoff:"2026-11-26T20:00:00-05:00",
 projection_generated_at:"2026-11-25T11:50:00-05:00",projection_revision_id:"immutable-revision-123",
 market_as_of:"2026-11-25T11:49:00-05:00",
 projection:{winner:"BBB",win_probability:0.72,confidence_grade:"A"},
 market:{favorite:"BBB",spread:-3.5,total:43.5}
}]});
test("valid pregame source freezes deterministically with a hash",()=>{
 const x=sample(),a=freezeSnapshot(x),b=freezeSnapshot(x);
 assert.equal(a.sha256,b.sha256);assert.equal(a.sha256.length,64);
 assert.equal(a.snapshot.games[0].projection.confidence_grade,"A");
});
test("missing grade is rejected rather than reconstructed",()=>{
 const x=sample();delete x.games[0].projection.confidence_grade;
 assert.equal(validateSnapshot(x).ok,false);
 assert.throws(()=>freezeSnapshot(x),/confidence_grade/);
});
test("post-kickoff, missing market timestamps and duplicate IDs rejected",()=>{
 const x=sample();x.captured_at="2026-11-27T12:00:00-05:00";
 x.games[0].market_as_of=null;
 x.games.push({...x.games[0]});
 const v=validateSnapshot(x);assert.equal(v.ok,false);
 assert.ok(v.errors.some(e=>e.includes("unique game_id")));
 assert.ok(v.errors.some(e=>e.includes("timestamps")));
});
