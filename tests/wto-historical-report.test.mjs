import test from "node:test";
import assert from "node:assert/strict";
import {parseScoreboard,gradeArchive,reportMarkdown} from "../scripts/build-wto-historical-report.mjs";
const payload={events:[{id:"401",status:{type:{completed:true}},competitions:[{competitors:[{homeAway:"away",score:"9",team:{abbreviation:"MIA"}},{homeAway:"home",score:"26",team:{abbreviation:"BUF"}}]}]},{id:"402",status:{type:{completed:false}},competitions:[{competitors:[{homeAway:"away",score:"0",team:{abbreviation:"NYG"}},{homeAway:"home",score:"0",team:{abbreviation:"NO"}}]}]}]};
test("only completed ESPN events are graded",()=>{
  const m=parseScoreboard(payload);
  assert.equal(m.size,1);
  assert.deepEqual(m.get("MIA-BUF"),{away:"MIA",home:"BUF",awayScore:9,homeScore:26,eventId:"401",status:"final"});
});
test("archive grading retains original lines and source timestamps",()=>{
  const a={week:11,generated_at:"2026-11-19T10:00:00Z",model_version:"test",games:[{game_id:"2026-W11-MIA-BUF",kickoff:"2026-11-22T18:00:00Z",away:"MIA",home:"BUF",projection:{winner:"BUF",away_score:9,home_score:26,projected_total:35},market:{favorite:"BUF",spread:-16.5,total:44.5}}]};
  const r=gradeArchive(a,parseScoreboard(payload));
  assert.equal(r.length,1);
  assert.deepEqual([r[0].winner,r[0].marketWinner,r[0].ats,r[0].total],["win","win","win","win"]);
  assert.match(reportMarkdown(r),/Paired winner audit/);
});
test("post-kickoff projections are excluded rather than silently graded",()=>{
  const a={week:11,generated_at:"2026-11-23T10:00:00Z",games:[{game_id:"late",kickoff:"2026-11-22T18:00:00Z",away:"MIA",home:"BUF",projection:{winner:"BUF"},market:{favorite:"BUF",spread:-16.5,total:44.5}}]};
  assert.equal(gradeArchive(a,parseScoreboard(payload))[0].issue,"prediction_not_verified_pregame");
});
