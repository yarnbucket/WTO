// WTO Phase 2D — read-only scoring of immutable prospective predictions.
// No live model updates, reconstructed picks, or synthetic final scores.
import {readdir,readFile,mkdir,writeFile} from "node:fs/promises";
import {join,relative,sep} from "node:path";
import {createHash} from "node:crypto";
import {pathToFileURL} from "node:url";
import {archivalIdentity} from "./wto-stage-permanent-archive.mjs";
import {validateSnapshot} from "./wto-prospective-snapshot.mjs";
import {gradeWinner} from "./wto-historical-audit.mjs";
import {parseScoreboard} from "./build-wto-historical-report.mjs";

const ROOT=new URL("../",import.meta.url);
const API="https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const hash=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const oneDecimal=x=>Number(x.toFixed(1));

export function verifyArchivedRecord(record,path=null){
 const lock=record?.lock;
 const check=validateSnapshot(lock?.snapshot);
 if(!check.ok)throw Error("Invalid locked source: "+check.errors.join("; "));
 if(hash(lock.snapshot)!==lock.sha256)throw Error("Archive SHA-256 lock mismatch");
 const identity=archivalIdentity(lock);
 if(record.schema_version!==1||record.identity_sha256!==identity.fingerprint)
  throw Error("Immutable archive identity mismatch");
 if(path!==null&&path.replaceAll("\\","/")!==identity.path)
  throw Error("Archive filename/path fingerprint mismatch");
 return {snapshot:lock.snapshot,game:lock.snapshot.games[0],identity};
}
export function scoreRecord(record,scoreboard=new Map(),now=new Date(),path=null){
 const {snapshot,game,identity}=verifyArchivedRecord(record,path);
 const base={
  season:snapshot.season,week:snapshot.week,game_id:game.game_id,
  model_version:snapshot.model_version,
  confidence_policy_id:game.projection.confidence_policy_id??"original_grade_unversioned",
  original_grade:game.projection.confidence_grade,
  projection_revision_id:game.projection_revision_id,
  projection_generated_at:game.projection_generated_at,
  market_as_of:game.market_as_of,
  lock_sha256:record.lock.sha256,identity_sha256:identity.fingerprint,
  kickoff:game.kickoff,away:game.away,home:game.home,
  predicted_winner:game.projection.winner,win_probability:game.projection.win_probability,
  market_favorite:game.market.favorite
 };
 if(new Date(now).getTime()<Date.parse(game.kickoff))return {...base,status:"pending_kickoff"};
 const final=scoreboard.get(game.away+"-"+game.home);
 if(!final||final.status!=="final"||!final.eventId||
    !Number.isInteger(final.awayScore)||!Number.isInteger(final.homeScore)||
    final.awayScore<0||final.homeScore<0||final.away!==game.away||final.home!==game.home)
  return {...base,status:"pending_verified_final"};
 const winner=gradeWinner(game.projection.winner,game.away,game.home,final.awayScore,final.homeScore);
 const marketWinner=gradeWinner(game.market.favorite,game.away,game.home,final.awayScore,final.homeScore);
 const truth=winner==="win"?1:winner==="loss"?0:null;
 return {...base,status:"scored",final_source:"ESPN completed NFL scoreboard",
  final_event_id:String(final.eventId),away_score:final.awayScore,home_score:final.homeScore,
  winner,market_favorite_winner:marketWinner,
  brier:truth===null?null:Number(((game.projection.win_probability-truth)**2).toFixed(6))};
}
export function summarize(rows,minimumSample=20){
 const scored=rows.filter(x=>x.status==="scored");
 const groups=new Map();
 for(const row of scored){
  const key=JSON.stringify([row.model_version,row.confidence_policy_id]);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(row);
 }
 return {
  archived_games:rows.length,scored_games:scored.length,
  pending_kickoff:rows.filter(x=>x.status==="pending_kickoff").length,
  pending_verified_final:rows.filter(x=>x.status==="pending_verified_final").length,
  minimum_sample:minimumSample,auto_recalibration:false,
  cohorts:[...groups].map(([key,g])=>{
   const [model_version,confidence_policy_id]=JSON.parse(key);
   const decided=g.filter(x=>x.winner==="win"||x.winner==="loss");
   const wins=decided.filter(x=>x.winner==="win").length;
   const mv=g.filter(x=>x.market_favorite_winner==="win"||x.market_favorite_winner==="loss");
   const briers=decided.filter(x=>Number.isFinite(x.brier));
   const grades=[...new Set(g.map(x=>x.original_grade))].sort().map(grade=>{
    const d=g.filter(x=>x.original_grade===grade&&(x.winner==="win"||x.winner==="loss"));
    return {grade,n:d.length,wins:d.filter(x=>x.winner==="win").length,
      observed_win_percent:d.length?oneDecimal(100*d.filter(x=>x.winner==="win").length/d.length):null,
      sufficient_sample:d.length>=minimumSample};
   });
   return {model_version,confidence_policy_id,scored:g.length,decided:decided.length,
    wins,losses:decided.length-wins,
    observed_win_percent:decided.length?oneDecimal(100*wins/decided.length):null,
    market_favorite_wins:mv.filter(x=>x.market_favorite_winner==="win").length,
    market_favorite_decided:mv.length,
    brier:briers.length?Number((briers.reduce((s,r)=>s+r.brier,0)/briers.length).toFixed(4)):null,
    sufficient_sample:decided.length>=minimumSample,grades};
  })
 };
}
export async function scoreRecords(records,{now=new Date(),fetcher=fetch}={}){
 const checked=records.map(({record,path})=>({record,path,verified:verifyArchivedRecord(record,path)}));
 const keys=new Map();
 for(const x of checked){
  const {snapshot,game}=x.verified;
  if(new Date(now).getTime()<Date.parse(game.kickoff))continue;
  const key=snapshot.season+"-"+snapshot.week;
  if(!keys.has(key))keys.set(key,{season:snapshot.season,week:snapshot.week});
 }
 const boards=new Map();
 for(const [key,{season,week}] of keys){
  const url=API+"?dates="+season+"&seasontype=2&week="+week+"&limit=1000";
  const response=await fetcher(url);
  if(!response?.ok)throw Error("Verified final source unavailable for "+key+" (HTTP "+response?.status+")");
  boards.set(key,parseScoreboard(await response.json()));
 }
 const rows=checked.map(x=>{
  const {snapshot}=x.verified;
  const key=snapshot.season+"-"+snapshot.week;
  return scoreRecord(x.record,boards.get(key)??new Map(),now,x.path);
 }).sort((a,b)=>a.season-b.season||a.week-b.week||a.game_id.localeCompare(b.game_id));
 const unique=new Set();
 for(const r of rows){const id=r.season+"-"+r.week+"-"+r.game_id;
  if(unique.has(id))throw Error("Duplicate prospective game identity: "+id);
  unique.add(id);
 }
 return {schema_version:1,generated_at:new Date(now).toISOString(),
  status:"observational_only",final_source:"ESPN completed NFL scoreboard",
  policy:"Only locked pregame winner and favorite are graded; ATS/O-U are unavailable without actual model-side picks.",
  summary:summarize(rows),rows};
}
export async function listArchivedRecords(root=ROOT){
 const base=new URL("archive/prospective/",root);
 const folderPath=decodeURIComponent(base.pathname);
 const out=[];
 async function visit(dir){
  let entries;try{entries=await readdir(dir,{withFileTypes:true});}catch(e){if(e.code==="ENOENT")return;throw e;}
  for(const entry of entries){
   const full=join(dir,entry.name);
   if(entry.isDirectory())await visit(full);
   else if(entry.isFile()&&entry.name.endsWith(".json")){
    const path="archive/prospective/"+relative(folderPath,full).split(sep).join("/");
    out.push({path,record:JSON.parse(await readFile(full,"utf8"))});
   }
  }
 }
 await visit(folderPath);
 return out;
}
export function reportMarkdown(report){
 const s=report.summary,lines=["# WTO Phase 2D — verified postgame scorecard","",
 "Read-only. Only original locked pregame winner calls and completed ESPN finals are scored. This report does not change the predictor or MY PICKS.","",
 "Archived: "+s.archived_games+" | Scored: "+s.scored_games+" | Awaiting kickoff: "+s.pending_kickoff+" | Awaiting verified final: "+s.pending_verified_final,"",
 "ATS and Over/Under are deliberately **not graded**: the locked format does not contain those specific model picks.",""];
 for(const c of s.cohorts){
  lines.push("## "+c.model_version+" / "+c.confidence_policy_id,"",
   "Winner: "+c.wins+"–"+c.losses+" (sample "+c.decided+") | Market favorite: "+c.market_favorite_wins+"/"+c.market_favorite_decided+
   " | Brier: "+(c.brier??"—"),"",
   "Sample >= "+s.minimum_sample+"? "+(c.sufficient_sample?"Yes":"No; not actionable"),"",
   "| Original grade | Games | Wins | Observed % | Sufficient? |","|---|---:|---:|---:|---|");
  for(const g of c.grades)lines.push("| "+g.grade+" | "+g.n+" | "+g.wins+" | "+(g.observed_win_percent??"—")+" | "+(g.sufficient_sample?"Yes":"No")+" |");
  lines.push("");
 }
 for(const r of report.rows)lines.push("- Week "+r.week+" "+r.game_id+": "+r.status+(r.status==="scored"?" ("+r.away_score+"–"+r.home_score+", winner "+r.winner+")":""));
 lines.push("","Source final-game evidence is the provider event ID in outcomes.json. No confidence weights or historical data are overwritten.");
 return lines.join("\n")+"\n";
}
export async function buildOutcomeReport({root=ROOT,now=new Date(),fetcher=fetch}={}){
 const records=await listArchivedRecords(root);
 const report=await scoreRecords(records,{now,fetcher});
 const output=new URL("reports/prospective-scoring/",root);
 await mkdir(output,{recursive:true});
 await writeFile(new URL("outcomes.json",output),JSON.stringify(report,null,2)+"\n");
 await writeFile(new URL("outcomes.md",output),reportMarkdown(report));
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=await buildOutcomeReport();
 console.log("Phase 2D: "+result.summary.scored_games+" verified finals graded; "+
 result.summary.pending_verified_final+" awaiting final; "+result.summary.pending_kickoff+" not started.");
}
