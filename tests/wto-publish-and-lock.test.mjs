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
 assert.equal(r.published.length,0);assert.equal(r.rejected.length,1);assert.equal(r.historical.length,1);
});

test("old weekly archives are reported as historical, not publishing failures",()=>{
 const old=fixture();old.archive.games[0].kickoff="2026-11-20T01:00:00Z";
 const result=processIncoming([old],now);
 assert.equal(result.historical.length,1);assert.equal(result.rejected.length,0);
});

test("mixed archives lock valid future games while isolating past and incomplete records",()=>{
 const mixed=fixture();
 const valid=mixed.archive.games[0];
 mixed.archive.games.push({...valid,game_id:"past",kickoff:"2026-11-20T01:00:00Z"});
 mixed.archive.games.push({...valid,game_id:"missing-market",market_as_of:null});
 const result=processIncoming([mixed],now);
 assert.equal(result.published.length,1);
 assert.equal(result.historical.length,1);
 assert.equal(result.rejected.length,1);
 assert.equal(result.readiness.filter(x=>x.status==="eligible").length,1);
 assert.equal(result.published[0].game_id,valid.game_id);
});

test("identical matchups from two weekly archives lock only once",()=>{
 const first=fixture(),second=fixture();
 second.name="wto-ex-week12-20261127.json";
 const result=processIncoming([first,second],now);
 assert.equal(result.published.length,1);
 assert.equal(result.duplicates.length,1);
 assert.equal(result.duplicates[0].reason,"identical_snapshot");
 assert.equal(result.rejected.length,0);
});
test("distinct valid revisions select latest original prediction",()=>{
 const first=fixture(),second=fixture();
 second.name="wto-ex-week12-20261127.json";
 second.archive.games[0].projection_generated_at="2026-11-26T11:00:00Z";
 second.archive.games[0].projection_revision_id="rev2";
 second.archive.games[0].projection.win_probability=.86;
 const result=processIncoming([first,second],now);
 assert.equal(result.published.length,1);
 assert.equal(result.published[0].snapshot.snapshot.games[0].projection.confidence_grade,"A++");
 assert.equal(result.superseded.length,1);
 assert.equal(result.duplicates.length,0);
});
