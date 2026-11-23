// Phase 2E producer-side packager: wraps ORIGINAL model output only.
// Does not calculate, backfill, modify, or infer any prediction or betting line.
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {basename,resolve,sep} from "node:path";
import {pathToFileURL} from "node:url";
import {validateOriginalPublisherExport} from "./wto-phase2e-handoff.mjs";
export async function packageOriginalOutput({sourcePath,runId,outputDir,now=new Date()}){
 if(!/^[1-9]\d{0,17}$/.test(String(runId)))throw Error("Valid producer run ID required");
 const name=basename(sourcePath);
 const bytes=await readFile(sourcePath);
 if(!bytes.length||bytes.length>=5_000_000)throw Error("Invalid source size");
 const original=JSON.parse(bytes.toString("utf8"));
 const validation=validateOriginalPublisherExport(original,name,now);
 await mkdir(outputDir,{recursive:true});
 const digest=createHash("sha256").update(bytes).digest("hex");
 const manifest={schema_version:1,producer_run_id:String(runId),source_name:name,sha256:digest,
  season:validation.season,week:validation.week,model_version:validation.model_version,
  eligible:validation.eligible,prepared_at:now.toISOString()};
 await writeFile(new URL(name,outputDir),bytes,{flag:"wx"});
 await writeFile(new URL("manifest.json",outputDir),JSON.stringify(manifest,null,2)+"\n",{flag:"wx"});
 return {manifest,artifact_name:"wto-original-predictions-"+runId};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [sourcePath,runId,outputPath]=process.argv.slice(2);
 if(!sourcePath||!runId||!outputPath)throw Error("Usage: node scripts/wto-phase2e-package.mjs <original-wto-ex-weekNN-YYYYMMDD.json> <github-run-id> <empty-output-dir>");
 const out=pathToFileURL(resolve(outputPath)+sep);
 const result=await packageOriginalOutput({sourcePath,runId,outputDir:out});
 console.log("Phase 2E: ready to upload authenticated producer artifact "+result.artifact_name);
}
