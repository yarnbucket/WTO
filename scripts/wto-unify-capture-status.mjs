// Unified Phase 2B report. Legacy diagnostics remain separately available,
// but their zero counts must never overwrite genuine publisher captures.
import {readFile,writeFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
export function unifyReports(publisher,legacyReadiness={},legacyCapture={}){
 const unique=publisher.published??[];
 const ids=new Set(unique.map(x=>[x.week,x.game_id].join("|")));
 if(ids.size!==unique.length)throw Error("Duplicate active matchup in publisher report");
 return {
  schema_version:1,checked_at:publisher.checked_at,
  status:unique.length?"prospective_snapshots_locked":"awaiting_eligible_pregame_source",
  authoritative_source:"publisher-status.json",
  counts:{unique_locked:unique.length,duplicate_snapshots:(publisher.duplicates??[]).length,superseded_revisions:(publisher.superseded??[]).length,invalid_future_records:(publisher.rejected??[]).length,historical_records:(publisher.historical??[]).length},
  locked:unique.map(x=>({week:x.week,game_id:x.game_id,source:x.source,sha256:x.sha256})),
  duplicates:publisher.duplicates??[],superseded:publisher.superseded??[],
  ineligible:publisher.rejected??[],
  legacy:{readiness_ready:legacyReadiness.ready??0,archive_locked:legacyCapture.locked?.length??0,note:"Legacy reports inspect pre-existing original grades only; their zero counts do not negate prospective publisher locks."}
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const dir=new URL("../reports/prospective/",import.meta.url);
 const load=async n=>{try{return JSON.parse(await readFile(new URL(n,dir),"utf8"))}catch(e){if(e.code==="ENOENT")return {};throw e}};
 const report=unifyReports(await load("publisher-status.json"),await load("source-readiness.json"),await load("capture-status.json"));
 await writeFile(new URL("phase2b-status.json",dir),JSON.stringify(report,null,2)+"\n");
 console.log("Phase 2B unified: "+report.counts.unique_locked+" unique locked; "+report.counts.duplicate_snapshots+" duplicates excluded; "+report.counts.invalid_future_records+" invalid future records.");
}
