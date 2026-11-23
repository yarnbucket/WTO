// Phase 2B bridge: process new, genuine pregame archives from incoming/.
// No synthetic projections, no retrospective grading, no live predictor changes.
import {readdir,readFile,mkdir,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {gradeAtPublication} from "./wto-prospective-grade-policy.mjs";
import {freezeSnapshot} from "./wto-prospective-snapshot.mjs";
import {pathToFileURL} from "node:url";
export function processIncoming(entries,now=new Date()){
 const published=[],rejected=[],historical=[],readiness=[],duplicates=[],superseded=[];
 for(const {name,archive} of entries){
  if(!/^wto-ex-week\d+-\d{8}\.json$/.test(name)||!Number.isInteger(archive?.week)||!Number.isInteger(archive?.season??2026)||!Array.isArray(archive?.games)){
   rejected.push({name,reason:"Invalid archive structure"});continue;
  }
  const valid=[];
  for(const g of archive.games){
   const kickoff=Date.parse(g?.kickoff);
   if(Number.isFinite(kickoff)&&kickoff<=now.getTime()){
    historical.push({name,week:archive.week,game_id:g.game_id??null,reason:"kickoff_passed"});continue;
   }
   if(!Number.isFinite(kickoff)){
    rejected.push({name,game_id:g?.game_id??null,reason:"Invalid kickoff timestamp"});continue;
   }
   try{
    const graded=gradeAtPublication({...archive,games:[g]},now.toISOString());
    const item=graded.games[0];
    if(!item.market_as_of||!Number.isFinite(Date.parse(item.market_as_of))||Date.parse(item.market_as_of)>now.getTime()||Date.parse(item.market_as_of)>=kickoff)throw Error("Missing/late market timestamp");
    if(!item.projection_revision_id)throw Error("Missing original revision");
    if(![item.away,item.home].includes(item.market?.favorite)||!Number.isFinite(item.market?.spread)||!Number.isFinite(item.market?.total))throw Error("Missing original market data");
    const normalized={game_id:item.game_id,away:item.away,home:item.home,kickoff:item.kickoff,projection_generated_at:item.projection_generated_at,projection_revision_id:item.projection_revision_id,market_as_of:item.market_as_of,projection:{winner:item.projection.winner,win_probability:item.projection.win_probability,confidence_grade:item.projection.confidence_grade,confidence_policy_id:item.projection.confidence_policy_id},market:{favorite:item.market.favorite,spread:item.market.spread,total:item.market.total}};
    freezeSnapshot({schema_version:1,season:archive.season??2026,week:archive.week,captured_at:now.toISOString(),model_version:archive.model_version,games:[normalized]});
    valid.push({item,normalized});
    readiness.push({source:name,game_id:item.game_id,status:"eligible"});
   }catch(e){
    rejected.push({name,game_id:g.game_id??null,reason:e.message});
    readiness.push({source:name,game_id:g.game_id??null,status:"ineligible",reason:e.message});
   }
  }
  if(!valid.length)continue;
  // Lock each valid game independently; one invalid record cannot block another.
  for(const {item,normalized} of valid){
   const graded={...archive,games:[item],confidence_policy_id:item.projection.confidence_policy_id,confidence_published_at:now.toISOString()};
   const snapshot=freezeSnapshot({schema_version:1,season:archive.season??2026,week:archive.week,captured_at:now.toISOString(),model_version:archive.model_version,games:[normalized]});
   published.push({name,game_id:item.game_id,graded,snapshot});
  }
 }
 // One active snapshot per matchup. Identical fingerprints are duplicates; distinct
 // revisions are preserved in diagnostics, but only the newest valid revision is published.
 const selected=new Map();
 for(const x of published){
  const key=[x.graded.season??2026,x.graded.week,x.game_id].join("|");
  const prev=selected.get(key);
  if(!prev){selected.set(key,x);continue;}
  if(prev.snapshot.sha256===x.snapshot.sha256){
   duplicates.push({game_id:x.game_id,source:x.name,kept_source:prev.name,sha256:x.snapshot.sha256,reason:"identical_snapshot"});
   continue;
  }
  const a=Date.parse(x.snapshot.snapshot.games[0].projection_generated_at);
  const b=Date.parse(prev.snapshot.snapshot.games[0].projection_generated_at);
  const newer=a>b||(a===b&&x.name>prev.name);
  const kept=newer?x:prev,older=newer?prev:x;
  selected.set(key,kept);
  superseded.push({game_id:x.game_id,source:older.name,kept_source:kept.name,reason:"different_valid_revision",older_sha256:older.snapshot.sha256,kept_sha256:kept.snapshot.sha256});
 }
 return {published:[...selected.values()],rejected,historical,readiness,duplicates,superseded};
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
  const id=createHash("sha256").update(x.name+x.game_id+x.snapshot.sha256).digest("hex").slice(0,16);
  await writeFile(new URL("published-"+id+".json",out),JSON.stringify(x.graded,null,2)+"\n",{flag:"wx"});
  await writeFile(new URL("locked-"+id+".json",out),JSON.stringify(x.snapshot,null,2)+"\n",{flag:"wx"});
 }
 await writeFile(new URL("publisher-status.json",out),JSON.stringify({checked_at:new Date().toISOString(),sources:entries.length,published:result.published.map(x=>({source:x.name,game_id:x.game_id,week:x.graded.week,game_count:x.graded.games.length,sha256:x.snapshot.sha256})),rejected:result.rejected,historical:result.historical,readiness:result.readiness,duplicates:result.duplicates,superseded:result.superseded,counts:{eligible:result.published.length,unique_locked:result.published.length,duplicate_snapshots:result.duplicates.length,superseded_revisions:result.superseded.length,ineligible:result.rejected.length,historical:result.historical.length}},null,2)+"\n");
 console.log("Phase 2B bridge: "+result.published.length+" published/locked; "+result.rejected.length+" rejected; "+result.historical.length+" historical; "+entries.length+" source files");
}
