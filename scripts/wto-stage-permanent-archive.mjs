// Phase 2C: immutable, reviewable snapshot archive staging.
// Never overwrites an existing record or fabricates a prediction.
import {readdir,readFile,mkdir,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {pathToFileURL} from "node:url";
export function archivalIdentity(lock){
 const s=lock?.snapshot;
 if(!s||!Array.isArray(s.games)||s.games.length!==1||!Number.isInteger(s.season)||!Number.isInteger(s.week))throw Error("Expected one locked game");
 const g=s.games[0];
 if(!/^[A-Za-z0-9_-]+$/.test(g.game_id))throw Error("Unsafe game ID");
 const fingerprint=createHash("sha256").update(JSON.stringify({
  season:s.season,week:s.week,model_version:s.model_version,game:g
 })).digest("hex");
 return {path:`archive/prospective/${s.season}/week-${String(s.week).padStart(2,"0")}/${g.game_id}-${fingerprint.slice(0,16)}.json`,fingerprint};
}
export async function stageArchive({reportDir=new URL("../reports/prospective/",import.meta.url),root=new URL("../",import.meta.url)}={}){
 const names=(await readdir(reportDir)).filter(n=>/^locked-[a-f0-9]+\.json$/.test(n));
 const staged=[],conflicts=[];
 for(const name of names){
  const lock=JSON.parse(await readFile(new URL(name,reportDir),"utf8"));
  const {path,fingerprint}=archivalIdentity(lock);
  const target=new URL(path,root);
  const record={schema_version:1,identity_sha256:fingerprint,lock};
  await mkdir(new URL("./",target),{recursive:true});
  try{
   await writeFile(target,JSON.stringify(record,null,2)+"\n",{flag:"wx"});
   staged.push({path,game_id:lock.snapshot.games[0].game_id,fingerprint});
  }catch(e){
   if(e.code!=="EEXIST")throw e;
   const old=JSON.parse(await readFile(target,"utf8"));
   if(old.identity_sha256!==fingerprint||JSON.stringify(old.lock.snapshot.games)!==JSON.stringify(lock.snapshot.games))throw Error("Immutable archive conflict: "+path);
   conflicts.push({path,reason:"already_archived"});
  }
 }
 return {staged,existing:conflicts};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const status=await stageArchive();
 await writeFile(new URL("../reports/prospective/archive-staging-status.json",import.meta.url),JSON.stringify(status,null,2)+"\n");
 console.log("Phase 2C archive staging: "+status.staged.length+" new; "+status.existing.length+" existing.");
}
