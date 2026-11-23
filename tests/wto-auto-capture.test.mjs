import test from "node:test";
import assert from "node:assert/strict";
import {captureFromArchives} from "../scripts/wto-auto-capture.mjs";
const now=new Date("2026-11-26T12:00:00Z");
const game=(grade="A")=>({game_id:"2026-W12-AAA-BBB",away:"AAA",home:"BBB",kickoff:"2026-11-27T01:00:00Z",projection_generated_at:"2026-11-26T10:00:00Z",projection_revision_id:"rev1",market_as_of:"2026-11-26T09:00:00Z",projection:{winner:"BBB",win_probability:.7,confidence_grade:grade},market:{favorite:"BBB",spread:-3.5,total:44.5}});
const archive=g=>[{name:"wto-ex-week12-20261126.json",archive:{week:12,model_version:"empirical-errors-v1",games:[g]}}];
test("locks original graded future game with hash",()=>{
 const d=captureFromArchives(archive(game()),now);
 assert.equal(d.frozen.length,1);assert.equal(d.frozen[0].snapshot.games[0].projection.confidence_grade,"A");assert.equal(d.frozen[0].sha256.length,64);
});
test("never manufactures absent confidence grades",()=>{
 const d=captureFromArchives(archive(game(undefined)),now);
 assert.equal(d.frozen.length,0);assert.equal(d.skipped[0].reason,"original_grade_unavailable");
});
test("rejects past kickoff and invalid pregame timestamps",()=>{
 const g=game();g.kickoff="2026-11-25T01:00:00Z";
 assert.equal(captureFromArchives(archive(g),now).frozen.length,0);
 const g2=game();g2.market_as_of="2026-11-27T02:00:00Z";
 assert.equal(captureFromArchives(archive(g2),now).frozen.length,0);
});
