import test from "node:test";
import assert from "node:assert/strict";
import {freezeSnapshot} from "../scripts/wto-prospective-snapshot.mjs";
import {archivalIdentity} from "../scripts/wto-stage-permanent-archive.mjs";
import {scoreRecord,scoreRecords,summarize,verifyArchivedRecord,reportMarkdown} from "../scripts/wto-prospective-score.mjs";

function fixture(){
 const lock=freezeSnapshot({
  schema_version:1,season:2026,week:11,captured_at:"2026-11-19T17:10:00Z",model_version:"empirical-errors-v1",
  games:[{game_id:"2026-W11-CIN-WAS",away:"CIN",home:"WAS",
   kickoff:"2026-11-23T20:15:00-05:00",
   projection_generated_at:"2026-11-19T16:59:19Z",projection_revision_id:"rev1",
   market_as_of:"2026-11-19T16:58:13Z",
   projection:{winner:"CIN",win_probability:0.75,confidence_grade:"A+",confidence_policy_id:"wto-prospective-probability-bands-v1"},
   market:{favorite:"CIN",spread:-6.5,total:53.5}}]});
 const identity=archivalIdentity(lock);
 return {record:{schema_version:1,identity_sha256:identity.fingerprint,lock},path:identity.path};
}
function scoreboard(awayScore=27,homeScore=14){
 return new Map([["CIN-WAS",{away:"CIN",home:"WAS",awayScore,homeScore,eventId:"401999001",status:"final"}]]);
}
const after=new Date("2026-11-24T04:00:00Z");
const before=new Date("2026-11-23T20:00:00Z");

test("verified immutable pregame winner and market favorite score only after a completed final",()=>{
 const {record,path}=fixture();
 const row=scoreRecord(record,scoreboard(),after,path);
 assert.equal(row.status,"scored");
 assert.equal(row.winner,"win");
 assert.equal(row.market_favorite_winner,"win");
 assert.equal(row.brier,0.0625);
 assert.equal(row.final_event_id,"401999001");
 assert.equal(row.original_grade,"A+");
 assert.equal(row.predicted_winner,"CIN");
 assert.equal("ats" in row,false);
 assert.equal("total" in row,false);
});
test("pending games and missing verified finals fail closed",()=>{
 const {record,path}=fixture();
 assert.equal(scoreRecord(record,scoreboard(),before,path).status,"pending_kickoff");
 assert.equal(scoreRecord(record,new Map(),after,path).status,"pending_verified_final");
 assert.equal(scoreRecord(record,new Map([["CIN-WAS",{...scoreboard().get("CIN-WAS"),status:"in_progress"}]]),after,path).status,"pending_verified_final");
 assert.equal(scoreRecord(record,new Map([["CIN-WAS",{...scoreboard().get("CIN-WAS"),eventId:null}]]),after,path).status,"pending_verified_final");
});
test("integrity checks detect tampering and path mismatch",()=>{
 const {record,path}=fixture();
 verifyArchivedRecord(record,path);
 const fake=JSON.parse(JSON.stringify(record));
 fake.lock.snapshot.games[0].projection.winner="WAS";
 assert.throws(()=>scoreRecord(fake,scoreboard(),after,path),/SHA-256 lock mismatch/);
 assert.throws(()=>scoreRecord(record,scoreboard(),after,"archive/prospective/2026/week-11/wrong.json"),/path fingerprint mismatch/);
});
test("winner loss and probability Brier are scored independently of ATS or O/U",()=>{
 const {record,path}=fixture();
 const row=scoreRecord(record,scoreboard(7,24),after,path);
 assert.equal(row.winner,"loss");
 assert.equal(row.market_favorite_winner,"loss");
 assert.equal(row.brier,0.5625);
 assert.equal(row.win_probability,0.75);
 assert.equal(row.original_grade,"A+");
});
test("same model and confidence-policy cohort stays observational and sample-gated",()=>{
 const {record,path}=fixture();
 const r=scoreRecord(record,scoreboard(),after,path);
 const s=summarize([r],20);
 assert.equal(s.scored_games,1);
 assert.equal(s.cohorts[0].model_version,"empirical-errors-v1");
 assert.equal(s.cohorts[0].wins,1);
 assert.equal(s.cohorts[0].sufficient_sample,false);
 assert.equal(s.cohorts[0].grades[0].sufficient_sample,false);
 assert.equal(s.auto_recalibration,false);
 assert.match(reportMarkdown({summary:s,rows:[r]}),/ATS and Over\/Under are deliberately/);
});
test("before kickoff does not fetch finals; after kickoff fetches only completed matches",async()=>{
 const {record,path}=fixture();
 let fetches=0;
 const fetcher=async url=>{
  fetches++;
  assert.match(url,/week=11/);
  return {ok:true,json:async()=>({events:[{id:"401999001",
    status:{type:{completed:true}},
    competitions:[{status:{type:{completed:true}},competitors:[
      {homeAway:"away",team:{abbreviation:"CIN"},score:"27"},
      {homeAway:"home",team:{abbreviation:"WSH"},score:"14"}
    ]}]}
  ]})};
 };
 const pending=await scoreRecords([{record,path}],{now:before,fetcher});
 assert.equal(fetches,0);
 assert.equal(pending.summary.pending_kickoff,1);
 const graded=await scoreRecords([{record,path}],{now:after,fetcher});
 assert.equal(fetches,1);
 assert.equal(graded.summary.scored_games,1);
 assert.equal(graded.rows[0].winner,"win");
});
test("provider unavailable fails closed; no fabricated scores",async()=>{
 const {record,path}=fixture();
 await assert.rejects(scoreRecords([{record,path}],{now:after,fetcher:async()=>({ok:false,status:503})}),/final source unavailable/);
});
test("duplicate archive revisions are rejected instead of silently pooled",async()=>{
 const {record,path}=fixture();
 await assert.rejects(scoreRecords([{record,path},{record,path}],{now:before,fetcher:async()=>{throw Error("should not fetch");}}),/Duplicate prospective game identity/);
});
