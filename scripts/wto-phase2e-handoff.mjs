// Phase 2E: authenticated upstream artifact intake. Never computes a prediction,
// guesses a market, edits the PWA or overwrites an original forecast.
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {basename} from "node:path";
import {pathToFileURL} from "node:url";
const sourcePattern=/^wto-ex-week(0?[1-9]|1[0-8])-\d{8}\.json$/;
const iso=x=>typeof x==="string"&&/\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x));
const requireField=(ok,message)=>{if(!ok)throw Error(message)};
const sha256=data=>createHash("sha256").update(data).digest("hex");
// Existing WTO EX sources identify the 2026 season in each game_id, not a top-level field.
// Derive that *metadata* only; never synthesize a missing score, odds or probability.
export function resolveSourceSeason(archive){
 if(archive?.season!==undefined&&archive?.season!==null){
  requireField(Number.isInteger(archive.season)&&archive.season>=2026&&archive.season<=2100,"Invalid source season");
  return archive.season;
 }
 requireField(Array.isArray(archive?.games)&&archive.games.length>0,"Source games required for season provenance");
 const years=new Set(archive.games.map(g=>/^([0-9]{4})-W[0-9]{1,2}-[A-Z]{2,3}-[A-Z]{2,3}$/.exec(g?.game_id??"")?.[1]));
 requireField(years.size===1&&!years.has(undefined),"Season missing or inconsistent in original game IDs");
 const season=Number([...years][0]);
 requireField(season===2026,"An explicit season is required for later-season exports");
 return season;
}
export function validateOriginalPublisherExport(archive,sourceName,now=new Date()){
 requireField(sourcePattern.test(sourceName),"Unexpected publisher source filename");
 const today=now.getTime();
 requireField(archive?.schema_version===1,"Source schema_version must be 1");
 const season=resolveSourceSeason(archive);
 requireField(Number.isInteger(archive?.week)&&archive.week>=1&&archive.week<=18,"Invalid source week");
 requireField(Number(sourceName.match(sourcePattern)[1])===archive.week,"Source week does not match filename");
 requireField(typeof archive.model_version==="string"&&archive.model_version.length>0,"Missing original model version");
 requireField(iso(archive.generated_at)&&Date.parse(archive.generated_at)<=today,"Missing or future original generation timestamp");
 requireField(Array.isArray(archive.games)&&archive.games.length>0,"Original source games required");
 const seen=new Set();
 let eligible=0,historical=0;
 for(const game of archive.games){
  const id=game?.game_id;
  const padded=String(archive.week).padStart(2,"0"),compact=String(archive.week);
  requireField(typeof id==="string"&&[season+"-W"+padded+"-"+game.away+"-"+game.home,season+"-W"+compact+"-"+game.away+"-"+game.home].includes(id),"Invalid original game ID");
  requireField(!seen.has(id),"Duplicate original game ID: "+id);seen.add(id);
  requireField(/^[A-Z]{2,3}$/.test(game.away)&&/^[A-Z]{2,3}$/.test(game.home)&&game.away!==game.home,"Invalid original teams");
  requireField(iso(game.kickoff)&&iso(game.projection_generated_at)&&iso(game.market_as_of),"Missing original offset-aware timestamps");
  const kickoff=Date.parse(game.kickoff),projected=Date.parse(game.projection_generated_at),market=Date.parse(game.market_as_of);
  requireField(projected<kickoff&&market<kickoff&&projected<=today&&market<=today,"Late/future original prediction or market timestamp: "+id);
  requireField(typeof game.projection_revision_id==="string"&&game.projection_revision_id.length>0,"Missing original projection revision: "+id);
  requireField([game.away,game.home].includes(game.projection?.winner),"Missing original winner: "+id);
  requireField(Number.isFinite(game.projection?.win_probability)&&game.projection.win_probability>=0.5&&game.projection.win_probability<=1,"Missing original model win probability: "+id);
  requireField([game.away,game.home].includes(game.market?.favorite)&&Number.isFinite(game.market.spread)&&Number.isFinite(game.market.total),"Missing original market evidence: "+id);
  if(kickoff>today)eligible++;else historical++;
 }
 requireField(eligible>0,"No original pre-kickoff games available; historical data cannot be backfilled");
 return {season,season_source:archive.season==null?"original_game_ids":"explicit_field",week:archive.week,model_version:archive.model_version,eligible,historical,source_games:archive.games.length};
}
export async function receiveProducerHandoff({sourcePath,sourceName,expectedSha256,producerRunId,artifactName,root=new URL("../",import.meta.url),now=new Date()}){
 requireField(sourcePattern.test(sourceName)&&basename(sourceName)===sourceName,"Unsafe original source name");
 requireField(/^[a-f0-9]{64}$/.test(expectedSha256),"Valid SHA-256 receipt required");
 requireField(/^[1-9]\d{0,17}$/.test(String(producerRunId)),"Producer workflow run ID required");
 requireField(artifactName==="wto-original-predictions-"+producerRunId,"Unexpected producer artifact identity");
 const bytes=await readFile(sourcePath);
 requireField(bytes.length>0&&bytes.length<5_000_000,"Original publisher export size invalid");
 const digest=sha256(bytes);
 requireField(digest===expectedSha256,"Upstream artifact SHA-256 mismatch");
 const archive=JSON.parse(bytes.toString("utf8"));
 const validated=validateOriginalPublisherExport(archive,sourceName,now);
 const existingRoot=new URL(sourceName,root);
 let existing;
 try{existing=await readFile(existingRoot);}catch(e){if(e.code!=="ENOENT")throw e}
 if(existing)requireField(sha256(existing)===digest,"Conflicting original root source: "+sourceName);
 const dest=new URL("incoming/"+sourceName,root);
 await mkdir(new URL("incoming/",root),{recursive:true});
 let status="already_received";
 try{
  await writeFile(dest,bytes,{flag:"wx"});
  status="accepted";
 }catch(e){
  if(e.code!=="EEXIST")throw e;
  const prior=await readFile(dest);
  requireField(sha256(prior)===digest,"Immutable incoming source conflict: "+sourceName);
 }
 const receipt={schema_version:1,phase:"2E",status,received_at:now.toISOString(),original_source:sourceName,
  original_sha256:digest,producer_run_id:String(producerRunId),artifact_name:artifactName,...validated};
 const reportDir=new URL("reports/prospective/",root);
 await mkdir(reportDir,{recursive:true});
 await writeFile(new URL("phase2e-handoff.json",reportDir),JSON.stringify(receipt,null,2)+"\n");
 return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [sourcePath,sourceName,expectedSha256,producerRunId,artifactName]=process.argv.slice(2);
 if(!sourcePath||!sourceName||!expectedSha256||!producerRunId||!artifactName)
  throw Error("Usage: node scripts/wto-phase2e-handoff.mjs <artifact-file-path> <original-filename> <sha256> <producer-run-id> <artifact-name>");
 const r=await receiveProducerHandoff({sourcePath,sourceName,expectedSha256,producerRunId,artifactName});
 console.log("Phase 2E: "+r.status+"; "+r.eligible+" future games, "+r.historical+" historical excluded, source SHA-256 "+r.original_sha256);
}
