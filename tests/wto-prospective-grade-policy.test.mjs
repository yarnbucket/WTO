import test from "node:test";
import assert from "node:assert/strict";
import {prospectiveGrade,gradeAtPublication,POLICY_ID} from "../scripts/wto-prospective-grade-policy.mjs";
test("explicit prospective-only grades are deterministic",()=>{
 assert.equal(prospectiveGrade(.9),"A++");assert.equal(prospectiveGrade(.8),"A+");assert.equal(prospectiveGrade(.7),"A");assert.equal(prospectiveGrade(.55),"UNRATED");
});
test("grades only original predictions published before kickoff",()=>{
 const source={games:[{game_id:"2026-W12-AAA-BBB",kickoff:"2026-11-27T01:00:00Z",projection_generated_at:"2026-11-26T10:00:00Z",projection:{win_probability:.77}}]};
 const result=gradeAtPublication(source,"2026-11-26T12:00:00Z");
 assert.equal(result.games[0].projection.confidence_grade,"A+");
 assert.equal(result.confidence_policy_id,POLICY_ID);
 assert.equal(source.games[0].projection.confidence_grade,undefined);
 assert.throws(()=>gradeAtPublication(source,"2026-11-27T02:00:00Z"),/kickoff/);
});
