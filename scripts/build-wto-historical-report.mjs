// Run: node scripts/build-wto-historical-report.mjs
// Fetches only public completed ESPN results; NEVER rewrites source predictions or user picks.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { gradeWinner, gradeSpread, gradeTotal, inferProjectedSpreadSide, inferProjectedTotalSide, pairedWinnerAudit } from "./wto-historical-audit.mjs";
const ROOT = new URL("../", import.meta.url);
const SOURCES = new Map([[6,"wto-ex-week6-20261015.json"],[7,"wto-ex-week7-20261025.json"],[8,"wto-ex-week8-20261027.json"],[9,"wto-ex-week9-20261108.json"],[10,"wto-ex-week10-20261112.json"],[11,"wto-ex-week11-20261122.json"]]);
const API = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const count = (rows,key) => ({win:rows.filter(r=>r[key]==="win").length,loss:rows.filter(r=>r[key]==="loss").length,push:rows.filter(r=>r[key]==="push").length,unavailable:rows.filter(r=>r[key]===null).length});
const pct = (r) => r.win+r.loss ? (100*r.win/(r.win+r.loss)).toFixed(1)+"%" : "—";
const record = (r) => r.win+"–"+r.loss+(r.push?"–"+r.push:"")+" ("+pct(r)+")";
export function normalizeTeamAbbreviation(code) {
  const aliases = { WSH: "WAS" };
  return aliases[code] ?? code;
}
export function parseScoreboard(payload) {
  const scores = new Map();
  for (const event of payload.events ?? []) {
    const competition = event.competitions?.[0];
    const status = competition?.status?.type ?? event.status?.type;
    if (!status?.completed) continue;
    const teams = competition?.competitors ?? [];
    const away = teams.find(c=>c.homeAway==="away");
    const home = teams.find(c=>c.homeAway==="home");
    if (!away || !home || !Number.isFinite(Number(away.score)) || !Number.isFinite(Number(home.score))) continue;
    const awayAbbr=normalizeTeamAbbreviation(away.team?.abbreviation),homeAbbr=normalizeTeamAbbreviation(home.team?.abbreviation);
    if (!awayAbbr || !homeAbbr) continue;
    const id=event.id;
    const key=awayAbbr+"-"+homeAbbr;
    if (scores.has(key)) throw new Error("Duplicate scoreboard matchup "+key);
    scores.set(key,{away:awayAbbr,home:homeAbbr,awayScore:Number(away.score),homeScore:Number(home.score),eventId:id,status:"final"});
  }
  return scores;
}
export function gradeArchive(archive, scoreboard) {
  const rows=[];
  for(const g of archive.games??[]){
    const s=scoreboard.get(g.away+"-"+g.home);
    if(!s) {rows.push({week:archive.week,gameId:g.game_id,issue:"missing_verified_final"});continue;}
    const projectedAt=g.projection_generated_at??archive.generated_at;
    const marketAt=g.market_as_of;
    if(!projectedAt || !marketAt || !Number.isFinite(Date.parse(projectedAt)) || !Number.isFinite(Date.parse(marketAt)) || Date.parse(projectedAt)>=Date.parse(g.kickoff) || Date.parse(marketAt)>=Date.parse(g.kickoff)){
      rows.push({week:archive.week,gameId:g.game_id,issue:"prediction_not_verified_pregame"});continue;
    }
    const aiWinner=[g.away,g.home].includes(g.projection?.winner)?g.projection.winner:null;
    const favorite=[g.away,g.home].includes(g.market?.favorite)?g.market.favorite:null;
    const spreadSide=inferProjectedSpreadSide(g);
    const totalSide=inferProjectedTotalSide(g);
    rows.push({
      week:archive.week,gameId:g.game_id,eventId:s.eventId,away:g.away,home:g.home,
      awayScore:s.awayScore,homeScore:s.homeScore,
      aiWinner,marketFavorite:favorite,spreadSide,totalSide,
      spread:g.market?.spread,totalLine:g.market?.total,
      projectionGeneratedAt:projectedAt,modelVersion:g.model_version??archive.model_version,
      marketAsOf:marketAt,cohort:archive.week===11?"week11_sunday_archive":"weeks6to10_experimental",
      winner:gradeWinner(aiWinner,g.away,g.home,s.awayScore,s.homeScore),
      marketWinner:gradeWinner(favorite,g.away,g.home,s.awayScore,s.homeScore),
      ats:gradeSpread(spreadSide,favorite,g.market?.spread,g.away,g.home,s.awayScore,s.homeScore),
      total:gradeTotal(totalSide,g.market?.total,s.awayScore,s.homeScore)
    });
  }
  return rows;
}
export function reportMarkdown(rows) {
  const weeks=[...new Set(rows.map(r=>r.week))].sort((a,b)=>a-b);
  const lines=["# WTO historical audit — archived experimental model","",
    "Weeks 6–10 are the original historical baseline. Week 11 is a separate Sunday archive cohort, not the manual poster-board picks. Do not combine cohorts to claim a single continuous model record.","",
    "Original pregame projections and lines; completed ESPN finals only. Abstentions and pushes are excluded from win-rate denominators.","",
    "| Week | Final games | AI winners | Market favorites | AI ATS | AI totals |","|---|---:|---:|---:|---:|---:|"];
  for(const w of weeks){
    const r=rows.filter(x=>x.week===w&&!x.issue);
    lines.push("| "+w+" | "+r.length+" | "+record(count(r,"winner"))+" | "+record(count(r,"marketWinner"))+" | "+record(count(r,"ats"))+" | "+record(count(r,"total"))+" |");
  }
  const valid=rows.filter(x=>!x.issue);
  lines.push("| **Pooled (descriptive only)** | **"+valid.length+"** | **"+record(count(valid,"winner"))+"** | **"+record(count(valid,"marketWinner"))+"** | **"+record(count(valid,"ats"))+"** | **"+record(count(valid,"total"))+"** |","","## Paired winner audit");
  const paired=pairedWinnerAudit(valid);
  lines.push("Comparable games: "+paired.summary.games+"; AI wins: "+paired.summary.aiWins+"; market wins: "+paired.summary.marketWins+"; disagreements: "+paired.summary.disagreements+"; AI-only correct: "+paired.summary.aiOnly+"; market-only correct: "+paired.summary.marketOnly+".","","## Disagreements");
  for(const r of paired.disagreements) lines.push("- "+r.gameId+": AI "+r.aiWinner+" vs market "+r.marketFavorite+" — "+(r.aiCorrect?"AI correct":"Market correct"));
  const issues=rows.filter(x=>x.issue);
  lines.push("","## Exclusions ("+issues.length+")");
  for(const r of issues)lines.push("- "+r.gameId+": "+r.issue);
  lines.push("","Week 5 is excluded because an original locked AI snapshot has not been recovered. Week 11 poster picks are a different prediction series and are not silently merged. Week 12 is not scored until a timestamped pregame archive and completed finals exist.");
  return lines.join("\n")+"\n";
}
export async function build({load=async path=>JSON.parse(await readFile(new URL(path,ROOT),"utf8")),fetcher=fetch}={}){
  const all=[];
  for(const [week,path] of SOURCES){
    const archive=await load(path);
    if(archive.week!==week)throw new Error("Week mismatch in "+path);
    const url=API+"?dates=2026&seasontype=2&week="+week+"&limit=1000";
    const response=await fetcher(url);
    if(!response.ok)throw new Error("ESPN scoreboard HTTP "+response.status+" for week "+week);
    const scoreboard=parseScoreboard(await response.json());
    all.push(...gradeArchive(archive,scoreboard));
  }
  const output={schema_version:1,season:2026,source:"ESPN public final-score scoreboard + immutable WTO pregame archives",cohorts:{"weeks6to10_experimental":[6,7,8,9,10],"week11_sunday_archive":[11]},weeks:[...SOURCES.keys()],rows:all};
  const folder=new URL("../reports/",import.meta.url);
  await mkdir(folder,{recursive:true});
  await writeFile(new URL("wto-historical-audit-2026.json",folder),JSON.stringify(output,null,2)+"\n");
  await writeFile(new URL("wto-historical-audit-2026.md",folder),reportMarkdown(all));
  return output;
}
if(process.argv[1] && import.meta.url===new URL("file://"+process.argv[1]).href){
  build().then(x=>{console.log("Audited "+x.rows.filter(r=>!r.issue).length+" games; excluded "+x.rows.filter(r=>r.issue).length);}).catch(e=>{console.error(e);process.exitCode=1;});
}
