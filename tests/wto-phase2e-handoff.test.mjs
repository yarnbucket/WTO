import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,writeFile,mkdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {pathToFileURL,fileURLToPath} from "node:url";
import {validateOriginalPublisherExport,receiveProducerHandoff,resolveSourceSeason} from "../scripts/wto-phase2e-handoff.mjs";
import {packageOriginalOutput} from "../scripts/wto-phase2e-package.mjs";
import {processIncoming} from "../scripts/wto-publish-and-lock.mjs";
import {stageArchive} from "../scripts/wto-stage-permanent-archive.mjs";
const when=new Date("2026-11-24T12:00:00.000Z");
const filename="wto-ex-week12-20261124.json";
const runId="45250000001";
const artifactName="wto-original-predictions-"+runId;
const sha=x=>createHash("sha256").update(x).digest("hex");
const original=()=>({
 schema_version:1,season:2026,week:12,model_version:"empirical-errors-v1",generated_at:"2026-11-24T10:00:00Z",
 games:[{game_id:"2026-W12-CIN-WAS",kickoff:"2026-11-29T13:00:00-05:00",
  away:"CIN",home:"WAS",projection_generated_at:"2026-11-24T10:00:00Z",
  projection_revision_id:"CIN-WAS-20261124T100000Z",
  projection:{winner:"CIN",win_probability:0.76},
  market_as_of:"2026-11-24T09:59:00Z",
  market:{favorite:"CIN",spread:-3.5,total:45.5}}]});
async function harness(archive=original()){
 const dir=await mkdtemp(join(tmpdir(),"wto-phase2e-"));
 const root=pathToFileURL(dir+"/");
 const bytes=Buffer.from(JSON.stringify(archive,null,2)+"\n");
 const source=join(dir,"artifact-source.json");
 await writeFile(source,bytes);
 const args={root,now:when,sourcePath:source,sourceName:filename,
  expectedSha256:sha(bytes),producerRunId:runId,artifactName};
 return {dir,root,bytes,source,args};
}
test("accepts genuine original future source and preserves every original byte",async()=>{
 const h=await harness();
 const receipt=await receiveProducerHandoff(h.args);
 assert.equal(receipt.status,"accepted");
 assert.equal(receipt.eligible,1);
 assert.equal(receipt.historical,0);
 assert.equal(receipt.original_sha256,sha(h.bytes));
 assert.deepEqual(await readFile(new URL("incoming/"+filename,h.root)),h.bytes);
 assert.equal(JSON.parse(await readFile(new URL("reports/prospective/phase2e-handoff.json",h.root))).producer_run_id,runId);
 const originalGame=JSON.parse(h.bytes).games[0];
 assert.equal("confidence_grade" in originalGame.projection,false);
 assert.equal("confidence_grade" in JSON.parse(await readFile(new URL("incoming/"+filename,h.root))).games[0].projection,false);
});
test("receipt is idempotent, but cannot overwrite a different incoming source",async()=>{
 const h=await harness();
 await receiveProducerHandoff(h.args);
 assert.equal((await receiveProducerHandoff(h.args)).status,"already_received");
 await writeFile(new URL("incoming/"+filename,h.root),"{}");
 await assert.rejects(receiveProducerHandoff(h.args),/Immutable incoming source conflict/);
});
test("rejects artifacts with mismatched SHA or identity before writing any source",async()=>{
 const h=await harness();
 await assert.rejects(receiveProducerHandoff({...h.args,expectedSha256:"0".repeat(64)}),/SHA-256 mismatch/);
 await assert.rejects(receiveProducerHandoff({...h.args,artifactName:"attacker"}),/artifact identity/);
 await assert.rejects(receiveProducerHandoff({...h.args,sourceName:"../wto-ex-week12-20261124.json"}),/Unsafe original source name/);
 await assert.rejects(receiveProducerHandoff({...h.args,producerRunId:"invalid"}),/run ID/);
 await assert.rejects(readFile(new URL("incoming/"+filename,h.root)),/ENOENT/);
});
test("rejects fabricated, missing, or future-dated model provenance",()=>{
 for(const mutate of [
  a=>{delete a.games[0].projection_revision_id},
  a=>{delete a.games[0].projection.win_probability},
  a=>{a.games[0].projection_generated_at="2026-11-30T10:00:00Z"},
  a=>{a.games[0].market_as_of="2026-11-30T10:00:00Z"},
  a=>{a.generated_at="2026-11-26T10:00:00Z"},
  a=>{a.games[0].market.favorite="BUF"},
  a=>{a.games[0].game_id="2026-W12-FOO-BAR"},
  a=>{a.games.push(a.games[0])}
 ]){
  const a=original();mutate(a);
  assert.throws(()=>validateOriginalPublisherExport(a,filename,when));
 }
});
test("historical games cannot be reconstructed, even from an otherwise well-formed original source",()=>{
 const a=original();a.games[0].kickoff="2026-11-23T13:00:00-05:00";
 a.games[0].projection_generated_at="2026-11-20T10:00:00Z";
 a.games[0].market_as_of="2026-11-20T09:59:00Z";
 assert.throws(()=>validateOriginalPublisherExport(a,filename,when),/No original pre-kickoff games/);
});
test("mixed sources retain historical games without grading; at least one future game required",()=>{
 const a=original();
 a.games.push({...a.games[0],game_id:"2026-W12-ARI-KC",away:"ARI",home:"KC",kickoff:"2026-11-23T13:00:00-05:00",
  projection_generated_at:"2026-11-20T10:00:00Z",market_as_of:"2026-11-20T09:59:00Z",
  projection:{winner:"KC",win_probability:0.63},market:{favorite:"KC",spread:-7,total:44}});
 const s=validateOriginalPublisherExport(a,filename,when);
 assert.equal(s.eligible,1);
 assert.equal(s.historical,1);
});
test("conflicting original root archive is never silently overwritten",async()=>{
 const h=await harness();
 await writeFile(new URL(filename,h.root),"{}");
 await assert.rejects(receiveProducerHandoff(h.args),/Conflicting original root source/);
});
test("source week and filename must agree",()=>{
 assert.throws(()=>validateOriginalPublisherExport(original(),"wto-ex-week13-20261124.json",when),/week does not match/);
});

test("trusted publisher packager copies original bytes and produces matching signed-run receipt",async()=>{
 const h=await harness();
 const outputDir=new URL("producer-artifact/",h.root);
 const authenticPath=join(h.dir,filename);
 await writeFile(authenticPath,h.bytes);
 const packaged=await packageOriginalOutput({sourcePath:authenticPath,runId,outputDir,now:when});
 assert.equal(packaged.artifact_name,artifactName);
 assert.equal(packaged.manifest.sha256,sha(h.bytes));
 assert.equal(packaged.manifest.source_name,filename);
 assert.deepEqual(await readFile(new URL(filename,outputDir)),h.bytes);
 const receipt=await receiveProducerHandoff({...h.args,sourcePath:new URL(filename,outputDir)});
 assert.equal(receipt.eligible,1);
});

test("complete Phase 2E producer intake feeds unchanged original into existing Phase 2B/2C lock",async()=>{
 const h=await harness();
 await receiveProducerHandoff(h.args);
 const incoming=JSON.parse(await readFile(new URL("incoming/"+filename,h.root)));
 const result=processIncoming([{name:filename,archive:incoming}],when);
 assert.equal(result.rejected.length,0);
 assert.equal(result.published.length,1);
 const published=result.published[0];
 assert.equal(published.snapshot.snapshot.games[0].projection.winner,"CIN");
 assert.equal(published.snapshot.snapshot.games[0].projection.confidence_grade,"A+");
 assert.equal(published.snapshot.snapshot.games[0].projection.confidence_policy_id,"wto-prospective-probability-bands-v1");
 assert.equal(incoming.games[0].projection.confidence_grade,undefined);
 const out=new URL("reports/prospective/",h.root);
 await writeFile(new URL("locked-1234567890abcdef.json",out),JSON.stringify(published.snapshot,null,2)+"\n");
 const staged=await stageArchive({root:h.root,reportDir:out});
 assert.equal(staged.staged.length,1);
 assert.equal(staged.staged[0].game_id,"2026-W12-CIN-WAS");
 const record=JSON.parse(await readFile(new URL(staged.staged[0].path,h.root)));
 assert.equal(record.lock.snapshot.games[0].projection.winner,"CIN");
 assert.equal(record.lock.snapshot.games[0].market.spread,-3.5);
});

test("accepts authentic original WTO EX Week 11 source format without inventing a top-level season",async()=>{
 // Historical original checked at its original pregame publication window for compatibility ONLY.
 // Never writes the Week 11 source back to the permanent archive.
 const sourcePath=new URL("../wto-ex-week11-20261122.json",import.meta.url);
 const originalBytes=await readFile(sourcePath);
 const source=JSON.parse(originalBytes);
 assert.equal(source.season,undefined);
 const publicationWindow=new Date("2026-11-22T11:20:00Z");
 const verified=validateOriginalPublisherExport(source,"wto-ex-week11-20261122.json",publicationWindow);
 assert.equal(verified.season,2026);
 assert.equal(verified.season_source,"original_game_ids");
 assert.equal(verified.source_games,13);
 assert.equal(verified.eligible,12);
 assert.equal(verified.historical,1);
 const tmp=await mkdtemp(join(tmpdir(),"wto-real-source-"));
 const outputDir=pathToFileURL(tmp+"/");
 const packaged=await packageOriginalOutput({sourcePath:fileURLToPath(sourcePath),runId,outputDir,now:publicationWindow});
 assert.equal(packaged.manifest.sha256,sha(originalBytes));
 assert.deepEqual(await readFile(new URL("wto-ex-week11-20261122.json",outputDir)),originalBytes);
 assert.equal(packaged.manifest.season,2026);
});
test("season provenance fails closed when game IDs conflict or next season omits explicit season",()=>{
 const a=original();delete a.season;
 assert.equal(resolveSourceSeason(a),2026);
 const wrong={...a,games:[...a.games,{...a.games[0],game_id:"2027-W12-ARI-KC",away:"ARI",home:"KC"}]};
 assert.throws(()=>resolveSourceSeason(wrong),/Season missing or inconsistent/);
 const later={...a,games:[{...a.games[0],game_id:"2027-W12-CIN-WAS"}]};
 assert.throws(()=>resolveSourceSeason(later),/explicit season is required/);
 const mismatch={...a,season:2027};
 assert.throws(()=>validateOriginalPublisherExport(mismatch,filename,when),/Invalid original game ID/);
});
test("existing zero-padded Week 06 game IDs are accepted as original provenance",()=>{
 const a={...original(),season:undefined,week:6,generated_at:"2026-10-15T19:35:45.215Z"};
 a.games=[{...a.games[0],game_id:"2026-W06-CIN-WAS",projection_generated_at:"2026-10-15T19:35:45.215Z",market_as_of:"2026-10-15T19:30:00Z",kickoff:"2026-10-18T13:00:00-04:00"}];
 const r=validateOriginalPublisherExport(a,"wto-ex-week6-20261015.json",new Date("2026-10-15T20:00:00Z"));
 assert.equal(r.season,2026);
 assert.equal(r.eligible,1);
});
