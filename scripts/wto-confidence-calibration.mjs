// Phase 2: observational calibration only. Never writes picks or model weights.
import {readFile,writeFile,mkdir} from "node:fs/promises";
const root=new URL("../",import.meta.url);
export const BUCKETS=[{label:"50–59%",min:0.5,max:0.6},{label:"60–69%",min:0.6,max:0.7},{label:"70–79%",min:0.7,max:0.8},{label:"80–89%",min:0.8,max:0.9},{label:"90–100%",min:0.9,max:1.0000001}];
const pct=x=>x===null?null:Number((x*100).toFixed(1));
export function calibrate(rows,{minimumSample=20}={}){
 const eligible=rows.filter(r=>!r.issue && r.marketProvenance==="timestamp_verified" && (r.winner==="win"||r.winner==="loss") && Number.isFinite(r.pregameWinProbability) && r.pregameWinProbability>=0.5 && r.pregameWinProbability<=1);
 const groups=new Map();
 for(const r of eligible){const key=r.cohort+" | "+r.modelVersion; if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 const cohorts=[...groups].map(([key,games])=>({
  cohort:key,games:games.length,gradeEvidenceAvailable:games.filter(r=>r.confidenceGrade).length,
  bins:BUCKETS.map(b=>{
   const g=games.filter(r=>r.pregameWinProbability>=b.min&&r.pregameWinProbability<b.max);
   const n=g.length,correct=g.filter(r=>r.winner==="win").length;
   const predicted=n?g.reduce((v,r)=>v+r.pregameWinProbability,0)/n:null;
   const observed=n?correct/n:null;
   return {bucket:b.label,n,correct,incorrect:n-correct,meanPredictedPercent:pct(predicted),observedWinPercent:pct(observed),calibrationGapPoints:n?Number((100*(observed-predicted)).toFixed(1)):null,sufficientSample:n>=minimumSample};
  }),
  brierScore:games.length?Number((games.reduce((v,r)=>v+(r.pregameWinProbability-(r.winner==="win"?1:0))**2,0)/games.length).toFixed(4)):null,
  actionable:false
 }));
 return {schema_version:1,method:"observational reliability bins; original pregame probabilities; no recalibration weights",minimumSample,eligibleGames:eligible.length,excludedGames:rows.length-eligible.length,cohorts,gradeCalibrationStatus:"unavailable_without_original_pregame_grades",predictionEngineModified:false};
}
export function calibrationMarkdown(d){
 const lines=["# WTO Phase 2 — observational confidence calibration","",
 "Read-only. Only timestamp-verified original pregame probabilities with completed outcomes are included. Week 6 legacy is excluded. Different model cohorts are not pooled.","",
 "A++/A+/A grade calibration is unavailable until original timestamped grades exist. Do not reconstruct grades after kickoff.","",
 "Small samples do not justify automatic changes to the predictor.",""];
 for(const c of d.cohorts){lines.push("## "+c.cohort+" ("+c.games+" games)","",
 "| Pregame probability | Games | Correct | Mean predicted | Observed win | Gap (points) | Adequate sample? |","|---|---:|---:|---:|---:|---:|---|");
  for(const b of c.bins)lines.push("| "+b.bucket+" | "+b.n+" | "+b.correct+" | "+(b.meanPredictedPercent??"—")+"% | "+(b.observedWinPercent??"—")+"% | "+(b.calibrationGapPoints??"—")+" | "+(b.sufficientSample?"Yes":"No")+" |");
  lines.push("","Brier score: "+(c.brierScore??"—")+" (lower is better). No automated weight changes.","");
 }
 return lines.join("\n")+"\n";
}
if(process.argv[1] && import.meta.url===new URL("file://"+process.argv[1]).href){
 const input=JSON.parse(await readFile(new URL("reports/wto-historical-audit-2026.json",root),"utf8"));
 const result=calibrate(input.rows);
 await mkdir(new URL("reports/",root),{recursive:true});
 await writeFile(new URL("reports/wto-confidence-calibration-2026.json",root),JSON.stringify(result,null,2)+"\n");
 await writeFile(new URL("reports/wto-confidence-calibration-2026.md",root),calibrationMarkdown(result));
 console.log("Phase 2 read-only calibration: "+result.eligibleGames+" eligible games; "+result.cohorts.length+" model cohorts");
}
