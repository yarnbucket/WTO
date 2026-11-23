// Phase 2B bridge: process new, genuine pregame archives from incoming/.
// No synthetic projections, no retrospective grading, no live predictor changes.
import {readdir,readFile,mkdir,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {gradeAtPublication} from "./wto-prospective-grade-policy.mjs";
import {freezeSnapshot} from "./wto-prospective-snapshot.mjs";
import {pathToFileURL} from "node:url";
export function processIncoming(entries,now=new Date()){
 const published=[],rejected=[],historical=[];
 for(const {name,archive} of entries){
  try{
   if(!/^wto-ex-week\d+-\d{8}\.json$/.test(name))throw Error("Unexpected source filename");
   if(!Number.isInteger(archive.week)||!Number.isInteger(archive.season??2026))throw Error("Missing week or season");
   if(!Array.isArray(archive.games)||!archive.games.length)throw Error("No games");
   const future=archive.games.filter(g=>Number.isFinite(Date.parse(g.kickoff))&&Date.parse(g.kickoff)>now.getTime());
   if(!future.length){historical.push({name,week:archive.week,game_count:archive.games.length,reason:"all_kickoffs_passed"});continue;}
   if(future.length!==archive.games.length)throw Error("Mixed past and future games: publish a future-only archive");
   // Only accept original archive timestamps: never backdate the publication time.
   const graded=gradeAtPublication(archive,now.toISOString());
   for(const g of graded.games){
    if(!g.market_as_of||Date.parse(g.market_as_of)>now.getTime()||Date.parse(g.market_as_of)>=Date.parse(g.kickoff))throw Error("Missing/late market timestamp: "+g.game_id);
    if(!g.projection_revision_id)throw Error("Missing revision: "+g.game_id);
    if(![g.away,g.home].includes(g.market?.favorite)||!Number.isFinite(g.market?.spread)||!Number.isFinite(g.market?.total))throw Error("Missing market data: "+g.game_id);
   }
   const snapshot=freezeSnapshot({schema_version:1,season:archive.season??2026,week:archive.week,captured_at:now.toISOString(),model_version:archive.model_version,games:graded.games.map(g=>({
    game_id:g.game_id,away:g.away,home:g.home,kickoff:g.kickoff,
    projection_generated_at:g.projection_generated_at,projection_revision_id:g.projection_revision_id,market_as_of:g.market_as_of,
    projection:{winner:g.projection.winner,win_probability:g.projection.win_probability,confidence_grade:g.projection.confidence_grade,confidence_policy_id:g.projection.confidence_policy_id},
    market:{favorite:g.market.favorite,spread:g.market.spread,total:g.market.total}
   }))});
   published.push({name,graded,snapshot});
  }catch(e){rejected.push({name,reason:e.message});}
 }
 return {published,rejected,historical};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=new URL("../",import.meta.url),incoming=new URL("../incoming/",import.meta.url),out=new URL("../reports/prospective/",import.meta.url);
 let names=[];try{names=(await readdir(incoming)).filter(n=>n.endsWith(".json"))}catch(e){if(e.code!=="ENOENT")throw e}
 const rootNames=(await readdir(root)).filter(n=>/^wto-ex-week\d+-\d{8}\.json$/.test(n));
 const all=[...names.map(name=>({name,url:new URL(name,incoming)})),...rootNames.map(name=>({name,url:new URL(name,root)}))];
 const entries=await Promise.all(all.map(async ({name,url})=>({name,archive:JSON.parse(await readFile(url,"utf8"))})));
 const result=processIncoming(entries);
 await mkdir(out,{recursive:true});
 for(const x of result.published){
  const id=createHash("sha256").update(x.name+x.snapshot.sha256).digest("hex").slice(0,16);
  await writeFile(new URL("published-"+id+".json",out),JSON.stringify(x.graded,null,2)+"\n",{flag:"wx"});
  await writeFile(new URL("locked-"+id+".json",out),JSON.stringify(x.snapshot,null,2)+"\n",{flag:"wx"});
 }
 await writeFile(new URL("publisher-status.json",out),JSON.stringify({checked_at:new Date().toISOString(),sources:entries.length,published:result.published.map(x=>({source:x.name,week:x.graded.week,game_count:x.graded.games.length,sha256:x.snapshot.sha256})),rejected:result.rejected,historical:result.historical},null,2)+"\n");
 console.log("Phase 2B bridge: "+result.published.length+" published/locked; "+result.rejected.length+" rejected; "+result.historical.length+" historical; "+entries.length+" source files");
}
