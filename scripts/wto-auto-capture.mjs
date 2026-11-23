// Phase 2B capture adapter: read existing WTO pregame archives only.
// Missing original grades are not fabricated or backfilled.
import {readdir,readFile,mkdir,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {freezeSnapshot} from "./wto-prospective-snapshot.mjs";
import {pathToFileURL} from "node:url";
export function captureFromArchives(archives,now=new Date()){
 const at=now.toISOString(),eligible=[],skipped=[];
 for(const {name,archive} of archives){
  if(!Number.isInteger(archive?.week)||!Array.isArray(archive?.games))continue;
  for(const g of archive.games){
   const id=g.game_id??"unknown";
   const reason=(!Number.isFinite(Date.parse(g.kickoff))||Date.parse(g.kickoff)<=now.getTime())?"kickoff_passed":
     (!g.projection?.confidence_grade||typeof g.projection.confidence_grade!=="string")?"original_grade_unavailable":
     (!g.projection_generated_at||!g.market_as_of)?"pregame_timestamp_missing":null;
   if(reason){skipped.push({source:name,game_id:id,reason});continue;}
   eligible.push({name,week:archive.week,season:2026,model_version:archive.model_version,game:g});
  }
 }
 // A game can appear in multiple archives. Select latest original projection made before capture,
 // and never mix games from different weeks/models into a single snapshot.
 const byId=new Map();
 for(const x of eligible){
  const prev=byId.get(x.game.game_id);
  if(!prev||Date.parse(x.game.projection_generated_at)>Date.parse(prev.game.projection_generated_at))byId.set(x.game.game_id,x);
 }
 const groups=new Map();
 for(const x of byId.values()){
  const key=x.week+"|"+x.model_version;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(x);
 }
 const frozen=[];
 for(const [key,items] of groups){
  const first=items[0],games=items.map(x=>({
   game_id:x.game.game_id,away:x.game.away,home:x.game.home,kickoff:x.game.kickoff,
   projection_generated_at:x.game.projection_generated_at,projection_revision_id:x.game.projection_revision_id,
   market_as_of:x.game.market_as_of,
   projection:{winner:x.game.projection.winner,win_probability:x.game.projection.win_probability,confidence_grade:x.game.projection.confidence_grade},
   market:{favorite:x.game.market?.favorite,spread:x.game.market?.spread,total:x.game.market?.total}
  }));
  try{
   const locked=freezeSnapshot({schema_version:1,season:first.season,week:first.week,captured_at:at,model_version:first.model_version,games});
   frozen.push({week:first.week,model_version:first.model_version,...locked});
  }catch(e){skipped.push({source:items.map(x=>x.name).join(","),reason:"validation_failed",detail:e.message});}
 }
 return {captured_at:at,frozen,skipped};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=new URL("../",import.meta.url),files=(await readdir(root)).filter(x=>/^wto-ex-week\d+-\d{8}\.json$/.test(x));
 const archives=await Promise.all(files.map(async name=>({name,archive:JSON.parse(await readFile(new URL("../"+name,import.meta.url),"utf8"))})));
 const result=captureFromArchives(archives);
 const out=new URL("../reports/prospective/",import.meta.url);await mkdir(out,{recursive:true});
 for(const [i,item] of result.frozen.entries())await writeFile(new URL("week"+item.week+"-"+i+"-"+item.sha256.slice(0,12)+".json",out),JSON.stringify(item,null,2)+"\n",{flag:"wx"});
 await writeFile(new URL("capture-status.json",out),JSON.stringify({captured_at:result.captured_at,locked:result.frozen.map(x=>({week:x.week,sha256:x.sha256,games:x.snapshot.games.length})),skipped:result.skipped},null,2)+"\n");
 console.log("Phase 2B: "+result.frozen.length+" valid pregame snapshots; "+result.skipped.length+" skipped records. Missing grades are not inferred.");
}
