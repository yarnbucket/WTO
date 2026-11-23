// Phase 2B source readiness: distinguish a missing future archive from missing authentic grades.
import {readdir,readFile,writeFile,mkdir} from "node:fs/promises";
import {pathToFileURL} from "node:url";
export function inspectReadiness(archives,now=new Date()){
 const upcoming=[],issues=[];
 for(const {name,archive} of archives){
  for(const g of archive.games??[]){
   const kickoff=Date.parse(g.kickoff);
   if(!Number.isFinite(kickoff)||kickoff<=now.getTime())continue;
   const problems=[];
   if(!g.projection?.confidence_grade)problems.push("original_grade_missing");
   if(!Number.isFinite(g.projection?.win_probability))problems.push("probability_missing");
   if(!g.projection_generated_at||Date.parse(g.projection_generated_at)>=kickoff)problems.push("projection_timestamp_invalid");
   if(!g.market_as_of||Date.parse(g.market_as_of)>=kickoff)problems.push("market_timestamp_invalid");
   upcoming.push({game_id:g.game_id,week:archive.week,source:name,kickoff:g.kickoff,ready:problems.length===0,problems});
  }
 }
 if(!upcoming.length)issues.push("no_upcoming_archived_predictions");
 if(upcoming.length&&!upcoming.some(g=>g.ready))issues.push("no_graded_pregame_predictions_ready");
 return {checked_at:now.toISOString(),upcoming,issues,ready:upcoming.filter(g=>g.ready).length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=new URL("../",import.meta.url);
 const names=(await readdir(root)).filter(n=>/^wto-ex-week\d+-\d{8}\.json$/.test(n));
 const archives=await Promise.all(names.map(async name=>({name,archive:JSON.parse(await readFile(new URL("../"+name,import.meta.url),"utf8"))})));
 const report=inspectReadiness(archives);
 await mkdir(new URL("../reports/prospective/",import.meta.url),{recursive:true});
 await writeFile(new URL("../reports/prospective/source-readiness.json",import.meta.url),JSON.stringify(report,null,2)+"\n");
 console.log("Phase 2B readiness: "+report.ready+" ready; "+report.upcoming.length+" future archived records; "+report.issues.join(", "));
}
