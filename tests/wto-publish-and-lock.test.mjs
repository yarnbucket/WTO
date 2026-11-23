import test from "node:test";
import assert from "node:assert/strict";
import {processIncoming} from "../scripts/wto-publish-and-lock.mjs";
const now=new Date("2026-11-26T12:00:00Z");
const fixture=()=>({name:"wto-ex-week12-20261126.json",archive:{season:2026,week:12,model_version:"empirical-errors-v1",games:[{
 game_id:"2026-W12-AAA-BBB",away:"AAA",home:"BBB",kickoff:"2026-11-27T01:00:00Z",projection_generated_at:"2026-11-26T10:00:00Z",projection_revision_id:"rev1",
 market_as_of:"2026-11-26T09:00:00Z",projection:{winner:"BBB",win_probability:.78},market:{favorite:"BBB",spread:-3.5,total:44.5}
}]}});
test("real pregame source is graded and locked in one workflow",()=>{
 const r=processIncoming([fixture()],now);
 assert.equal(r.rejected.length,0);assert.equal(r.published.length,1);
 assert.equal(r.published[0].snapshot.snapshot.games[0].projection.confidence_grade,"A+");
 assert.equal(r.published[0].snapshot.sha256.length,64);
});
test("past kickoff and incomplete markets fail closed",()=>{
 const late=fixture();late.archive.games[0].kickoff="2026-11-25T01:00:00Z";
 const noMarket=fixture();noMarket.archive.games[0].market_as_of=null;
 const r=processIncoming([late,noMarket],now);
 assert.equal(r.published.length,0);assert.equal(r.rejected.length,2);
});
