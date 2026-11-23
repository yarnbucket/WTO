import test from "node:test";
import assert from "node:assert/strict";
import {calibrate,calibrationMarkdown} from "../scripts/wto-confidence-calibration.mjs";
const row=(overrides={})=>({week:11,marketProvenance:"timestamp_verified",cohort:"week11_sunday_archive",modelVersion:"empirical-errors-v1",winner:"win",pregameWinProbability:.75,confidenceGrade:null,...overrides});
test("only completed timestamp-verified pregame outcomes enter confidence calibration",()=>{
 const d=calibrate([row(),row({winner:"loss",pregameWinProbability:.65}),row({marketProvenance:"legacy_untimestamped"}),row({issue:"missing_verified_final"}),row({pregameWinProbability:null}),row({winner:null})]);
 assert.equal(d.eligibleGames,2);assert.equal(d.excludedGames,4);assert.equal(d.cohorts[0].games,2);
 assert.equal(d.cohorts[0].bins.find(b=>b.bucket==="70–79%").correct,1);
 assert.equal(d.cohorts[0].bins.find(b=>b.bucket==="60–69%").incorrect,1);
 assert.equal(d.cohorts[0].bins.every(b=>!b.sufficientSample),true);
 assert.equal(d.predictionEngineModified,false);
});
test("separate model cohorts and do not invent confidence grades",()=>{
 const d=calibrate([row(),row({cohort:"weeks7to10_experimental"}),row({modelVersion:"different-model"})]);
 assert.equal(d.cohorts.length,3);
 assert.equal(d.gradeCalibrationStatus,"unavailable_without_original_pregame_grades");
 assert.match(calibrationMarkdown(d),/A\+\+\/A\+\/A grade calibration is unavailable/);
});
