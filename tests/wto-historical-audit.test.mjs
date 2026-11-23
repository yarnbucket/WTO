import test from "node:test";
import assert from "node:assert/strict";
import { gradeWinner, gradeSpread, gradeTotal, inferProjectedSpreadSide, inferProjectedTotalSide, pairedWinnerAudit, confidenceBuckets } from "../scripts/wto-historical-audit.mjs";

test("winner picks and abstentions are distinguished", () => {
  assert.equal(gradeWinner("BUF","MIA","BUF",9,26),"win");
  assert.equal(gradeWinner("MIA","MIA","BUF",9,26),"loss");
  assert.equal(gradeWinner("NO EDGE","MIA","BUF",9,26),null);
});
test("spread grading uses original line and supports pushes", () => {
  assert.equal(gradeSpread("BUF","BUF",-16.5,"MIA","BUF",9,26),"win");
  assert.equal(gradeSpread("MIA","BUF",-17,"MIA","BUF",9,26),"push");
  assert.equal(gradeSpread("BUF","BUF",-17.5,"MIA","BUF",9,26),"loss");
});
test("total grading handles half points and integer pushes", () => {
  assert.equal(gradeTotal("UNDER",44.5,9,26),"win");
  assert.equal(gradeTotal("OVER",34.5,9,26),"win");
  assert.equal(gradeTotal("OVER",35,9,26),"push");
});
test("projected sides are inferred from original score margin", () => {
  const g={away:"MIA",home:"BUF",projection:{away_score:9,home_score:26,projected_total:35},market:{favorite:"BUF",spread:-16.5,total:44.5}};
  assert.equal(inferProjectedSpreadSide(g),"BUF");
  assert.equal(inferProjectedTotalSide(g),"UNDER");
});
test("market comparison excludes abstentions from both denominators", () => {
  const rows=[
    {gameId:"one",away:"MIA",home:"BUF",awayScore:9,homeScore:26,aiWinner:"BUF",marketFavorite:"BUF"},
    {gameId:"two",away:"NYG",home:"NO",awayScore:20,homeScore:17,aiWinner:"NYG",marketFavorite:"NO"},
    {gameId:"three",away:"PIT",home:"TB",awayScore:26,homeScore:19,aiWinner:"NO EDGE",marketFavorite:"PIT"}
  ];
  const {summary,disagreements}=pairedWinnerAudit(rows);
  assert.deepEqual(summary,{games:2,aiWins:2,marketWins:1,disagreements:1,aiOnly:1,marketOnly:0,bothCorrect:1,bothWrong:0});
  assert.equal(disagreements.length,1);
});
test("grade buckets report sample counts rather than implied probabilities",()=>{
  assert.deepEqual(confidenceBuckets([{grade:"A++",result:"win"},{grade:"A++",result:"loss"},{grade:"A+",result:"push"}]),{"A++":{wins:1,losses:1,games:2,rate:0.5}});
});
