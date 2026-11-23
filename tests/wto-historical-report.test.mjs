import test from "node:test";
import assert from "node:assert/strict";
import {parseScoreboard,gradeArchive,reportMarkdown,normalizeTeamAbbreviation} from "../scripts/build-wto-historical-report.mjs";
const payload={events:[{id:"401",status:{type:{completed:true}},competitions:[{competitors:[{homeAway:"away",score:"9",team:{abbreviation:"MIA"}},{homeAway:"home",score:"26",team:{abbreviation:"BUF"}}]}]},{id:"402",status:{type:{completed:false}},competitions:[{competitors:[{homeAway:"away",score:"0",team:{abbreviation:"NYG"}},{homeAway:"home",score:"0",team:{abbreviation:"NO"}}]}]}]};
test("only completed ESPN events are graded",()=>{
  const m=parseScoreboard(payload);
  assert.equal(m.size,1);
  assert.deepEqual(m.get("MIA-BUF"),{away:"MIA",home:"BUF",awayScore:9,homeScore:26,eventId:"401",status:"final"});
});
test("archive grading retains original lines and source timestamps",()=>{
  const a={week:11,generated_at:"2026-11-19T10:00:00Z",model_version:"test",games:[{game_id:"2026-W11-MIA-BUF",kickoff:"2026-11-22T18:00:00Z",away:"MIA",home:"BUF",projection:{winner:"BUF",away_score:9,home_score:26,projected_total:35},market:{favorite:"BUF",spread:-16.5,total:44.5},market_as_of:"2026-11-19T10:00:00Z"}]};
  const r=gradeArchive(a,parseScoreboard(payload));
  assert.equal(r.length,1);
  assert.deepEqual([r[0].winner,r[0].marketWinner,r[0].ats,r[0].total],["win","win","win","win"]);
  assert.match(reportMarkdown(r),/Paired winner audit/);
});
test("post-kickoff projections are excluded rather than silently graded",()=>{
  const a={week:11,generated_at:"2026-11-23T10:00:00Z",games:[{game_id:"late",kickoff:"2026-11-22T18:00:00Z",away:"MIA",home:"BUF",projection:{winner:"BUF"},market:{favorite:"BUF",spread:-16.5,total:44.5}}]};
  assert.equal(gradeArchive(a,parseScoreboard(payload))[0].issue,"prediction_not_verified_pregame");
});

test("Washington WSH ESPN code maps to WTO WAS in either home or away position",()=>{
  assert.equal(normalizeTeamAbbreviation("WSH"),"WAS");
  assert.equal(normalizeTeamAbbreviation("WAS"),"WAS");
  assert.equal(normalizeTeamAbbreviation("SF"),"SF");
  const makeEvent=(id,away,home)=>({id,status:{type:{completed:true}},competitions:[{competitors:[
    {homeAway:"away",score:"17",team:{abbreviation:away}},
    {homeAway:"home",score:"23",team:{abbreviation:home}}
  ]}]});
  const m=parseScoreboard({events:[makeEvent("w1","WSH","SF"),makeEvent("w2","PHI","WSH")]});
  assert.ok(m.has("WAS-SF"));
  assert.ok(m.has("PHI-WAS"));
  assert.equal(m.get("WAS-SF").awayScore,17);
  assert.equal(m.get("PHI-WAS").homeScore,23);
});

test("incomplete Week 11 games remain excluded and never get invented scores",()=>{
  const archive={week:11,generated_at:"2026-11-22T11:00:00Z",games:[{
    game_id:"2026-W11-CIN-WAS",kickoff:"2026-11-23T20:15:00-05:00",away:"CIN",home:"WAS",
    projection:{winner:"CIN",away_score:24,home_score:20,projected_total:44},
    market:{favorite:"CIN",spread:-6.5,total:53.5},
    market_as_of:"2026-11-19T16:58:13Z"
  }]};
  const rows=gradeArchive(archive,new Map());
  assert.equal(rows.length,1);
  assert.equal(rows[0].issue,"missing_verified_final");
  assert.match(reportMarkdown(rows),/Exclusions \(1\)/);
});

test("Week 6 missing market timestamp is graded only as explicitly labeled legacy",()=>{
  const archive={week:6,generated_at:"2026-10-15T19:35:45Z",games:[{
    game_id:"2026-W06-MIA-BUF",kickoff:"2026-10-15T20:15:00-04:00",
    away:"MIA",home:"BUF",projection:{winner:"BUF",away_score:9,home_score:26,projected_total:35},
    market:{favorite:"BUF",spread:-16.5,total:44.5},market_as_of:null
  }]};
  const rows=gradeArchive(archive,parseScoreboard(payload));
  assert.equal(rows[0].issue,undefined);
  assert.equal(rows[0].marketProvenance,"legacy_untimestamped");
  assert.equal(rows[0].cohort,"week6_legacy_untimestamped");
  assert.match(reportMarkdown(rows),/Legacy untimestamped Week 6/);
});
test("Missing market timestamp in later weeks is excluded",()=>{
  const archive={week:11,generated_at:"2026-11-19T10:00:00Z",games:[{
    game_id:"2026-W11-MIA-BUF",kickoff:"2026-11-22T18:00:00Z",
    away:"MIA",home:"BUF",projection:{winner:"BUF",away_score:9,home_score:26,projected_total:35},
    market:{favorite:"BUF",spread:-16.5,total:44.5},market_as_of:null
  }]};
  assert.equal(gradeArchive(archive,parseScoreboard(payload))[0].issue,"prediction_or_market_not_verified_pregame");
});
