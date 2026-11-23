// WTO Phase 2B — prospective pregame snapshot validator.
// Does not calculate grades, rewrite predictions, or access MY PICKS.
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {pathToFileURL} from "node:url";
const isIso=x=>typeof x==="string"&&Number.isFinite(Date.parse(x))&&/T/.test(x)&&/(Z|[+-]\d\d:\d\d)$/.test(x);
export function validateSnapshot(snapshot){
 const errors=[];
 if(snapshot?.schema_version!==1)errors.push("schema_version must be 1");
 if(!Number.isInteger(snapshot?.season)||!Number.isInteger(snapshot?.week))errors.push("season and week must be integers");
 if(!isIso(snapshot?.captured_at))errors.push("captured_at must be offset-aware ISO time");
 if(typeof snapshot?.model_version!=="string"||!snapshot.model_version)errors.push("model_version required");
 if(!Array.isArray(snapshot?.games)||!snapshot.games.length)errors.push("games required");
 const ids=new Set();
 for(const [i,g] of (snapshot?.games??[]).entries()){
  const prefix="games["+i+"]";
  if(typeof g.game_id!=="string"||!g.game_id||ids.has(g.game_id))errors.push(prefix+": unique game_id required");
  ids.add(g.game_id);
  if(!isIso(g.kickoff)||!isIso(g.projection_generated_at)||!isIso(g.market_as_of))errors.push(prefix+": kickoff and prediction/market timestamps required");
  else if(Date.parse(g.projection_generated_at)>=Date.parse(g.kickoff)||Date.parse(g.market_as_of)>=Date.parse(g.kickoff)||Date.parse(snapshot.captured_at)>=Date.parse(g.kickoff))errors.push(prefix+": timestamps must be strictly before kickoff");
  if(![g.away,g.home].includes(g.projection?.winner))errors.push(prefix+": original winner required");
  if(!Number.isFinite(g.projection?.win_probability)||g.projection.win_probability<0.5||g.projection.win_probability>1)errors.push(prefix+": pregame win_probability must be 0.5–1");
  if(typeof g.projection?.confidence_grade!=="string"||!g.projection.confidence_grade.trim())errors.push(prefix+": original confidence_grade required (never infer after kickoff)");
  if(![g.away,g.home].includes(g.market?.favorite)||!Number.isFinite(g.market?.spread)||!Number.isFinite(g.market?.total))errors.push(prefix+": original market favorite, spread, and total required");
  if(typeof g.projection_revision_id!=="string"||!g.projection_revision_id)errors.push(prefix+": projection_revision_id required");
 }
 return {ok:errors.length===0,errors};
}
export function freezeSnapshot(snapshot){
 const validation=validateSnapshot(snapshot);
 if(!validation.ok)throw Error(validation.errors.join("; "));
 const canonical=JSON.stringify(snapshot);
 return {schema_version:1,sha256:createHash("sha256").update(canonical).digest("hex"),snapshot};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const source=process.argv[2];
 if(!source)throw Error("Usage: node scripts/wto-prospective-snapshot.mjs <pregame-source.json> [output.json]");
 const raw=JSON.parse(await readFile(source,"utf8"));
 const frozen=freezeSnapshot(raw);
 const dest=process.argv[3]??"reports/wto-prospective-week"+raw.week+"-2026.json";
 await mkdir(new URL("../reports/",import.meta.url),{recursive:true});
 await writeFile(dest,JSON.stringify(frozen,null,2)+"\n",{flag:"wx"});
 console.log("Frozen "+raw.games.length+" pregame records; SHA-256 "+frozen.sha256);
}
