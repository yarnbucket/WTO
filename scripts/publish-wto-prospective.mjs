// Publish a NEW future archive with an explicit confidence policy.
// Does not rewrite source archive, index.html, wto-ex.js or MY PICKS.
import {readFile,writeFile} from "node:fs/promises";
import {gradeAtPublication} from "./wto-prospective-grade-policy.mjs";
import {pathToFileURL} from "node:url";
export async function publishFutureArchive(source,destination,now=new Date()){
 const raw=JSON.parse(await readFile(source,"utf8"));
 const graded=gradeAtPublication(raw,now.toISOString());
 // Source must already contain original market evidence and prediction revisions.
 for(const g of graded.games){
  if(!g.market_as_of||Date.parse(g.market_as_of)>=Date.parse(g.kickoff)||Date.parse(g.market_as_of)>now.getTime())throw Error("Missing or late original market timestamp: "+g.game_id);
  if(!g.projection_revision_id)throw Error("Missing original prediction revision: "+g.game_id);
  if(![g.away,g.home].includes(g.market?.favorite)||!Number.isFinite(g.market?.spread)||!Number.isFinite(g.market?.total))throw Error("Missing original market: "+g.game_id);
 }
 await writeFile(destination,JSON.stringify(graded,null,2)+"\n",{flag:"wx"});
 return graded;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.argv[2]||!process.argv[3])throw Error("Usage: node scripts/publish-wto-prospective.mjs <new-pregame-archive.json> <new-unique-output.json>");
 const a=await publishFutureArchive(process.argv[2],process.argv[3]);
 console.log("Published "+a.games.length+" prospective games using "+a.confidence_policy_id);
}
