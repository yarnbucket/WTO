import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {archivalIdentity,stageArchive} from "../scripts/wto-stage-permanent-archive.mjs";
import {freezeSnapshot} from "../scripts/wto-prospective-snapshot.mjs";
test("content identity ignores capture timestamp but preserves prediction revision",()=>{
 const game={game_id:"2026-W12-AAA-BBB",away:"AAA",home:"BBB",kickoff:"2026-11-27T01:00:00Z",projection_generated_at:"2026-11-26T10:00:00Z",projection_revision_id:"rev1",market_as_of:"2026-11-26T09:00:00Z",projection:{winner:"BBB",win_probability:.78,confidence_grade:"A+"},market:{favorite:"BBB",spread:-3.5,total:44.5}};
 const snapshot={schema_version:1,season:2026,week:12,captured_at:"2026-11-26T12:00:00Z",model_version:"test-v1",games:[game]};
 const first=freezeSnapshot(snapshot),second=freezeSnapshot({...snapshot,captured_at:"2026-11-26T12:05:00Z"});
 assert.equal(archivalIdentity(first).path,archivalIdentity(second).path);
 assert.notEqual(first.sha256,second.sha256);
 assert.notEqual(archivalIdentity(first).path,archivalIdentity(freezeSnapshot({...snapshot,games:[{...game,projection_revision_id:"rev2"}]})).path);
});
test("archive staging is exclusive-create and idempotent",async()=>{
 const root=await mkdtemp(join(tmpdir(),"wto-archive-")),reports=join(root,"reports","prospective");
 await mkdir(reports,{recursive:true});
 const {writeFile}=await import("node:fs/promises");
 const snapshot={schema_version:1,season:2026,week:12,captured_at:"2026-11-26T12:00:00Z",model_version:"test-v1",games:[{game_id:"2026-W12-AAA-BBB",away:"AAA",home:"BBB",kickoff:"2026-11-27T01:00:00Z",projection_generated_at:"2026-11-26T10:00:00Z",projection_revision_id:"rev1",market_as_of:"2026-11-26T09:00:00Z",projection:{winner:"BBB",win_probability:.78,confidence_grade:"A+"},market:{favorite:"BBB",spread:-3.5,total:44.5}}]};
 await writeFile(join(reports,"locked-abcdef.json"),JSON.stringify(freezeSnapshot(snapshot)));
 const args={root:pathToFileURL(root+"/"),reportDir:pathToFileURL(reports+"/")};
 const first=await stageArchive(args),second=await stageArchive(args);
 assert.equal(first.staged.length,1);
 assert.equal(second.existing.length,1);
 const record=JSON.parse(await readFile(join(root,first.staged[0].path),"utf8"));
 assert.equal(record.lock.sha256,freezeSnapshot(snapshot).sha256);
});
