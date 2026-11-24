// Phase 2F: assemble authentic pregame revisions; never invent predictions.
import {readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';
import {gradeAtPublication} from './wto-prospective-grade-policy.mjs';
import {validateOriginalPublisherExport} from './wto-phase2e-handoff.mjs';
export function assemble({ledger,insights,prior,week,estimate,now=new Date()}){
 const stamp=now.toISOString(), games=[], unresolved=[];
 const slate=ledger.weeks.find(w=>w.week===week)?.games;
 if(!slate?.length)throw Error('Missing target slate');
 const residuals=prior.training_residuals;
 if(!Array.isArray(residuals)||!residuals.length||residuals.some(r=>!Number.isInteger(r.week)||r.week>=week||!Number.isFinite(r.margin_error)||!Number.isFinite(r.total_error)))throw Error('Invalid training residuals');
 const archive={schema_version:1,season:ledger.season,week,model_version:prior.model_version,generated_at:stamp,training_residuals:residuals,games};
 for(const g of slate){
  const kickoff=Date.parse(g.kickoff_et);
  if(!Number.isFinite(kickoff)){unresolved.push({id:g.game_id,reason:'invalid kickoff'});continue;}
  if(kickoff<=+now)continue;
  const revisions=insights.weeks.find(w=>w.week===week)?.games.find(x=>x.game_id===g.game_id)?.revisions??[];
  const r=revisions.filter(x=>x.independent_projection&&Date.parse(x.generated_at)<=+now&&Date.parse(x.generated_at)<kickoff).sort((a,b)=>Date.parse(b.generated_at)-Date.parse(a.generated_at))[0];
  const p=r?.independent_projection,m=r?.market_comparison;
  if(!r?.revision_id||!Number.isFinite(p?.win_probability)||p.win_probability<.5||p.win_probability>1||![g.away,g.home].includes(p.winner)||!Number.isFinite(p.away_score)||!Number.isFinite(p.home_score)){unresolved.push({id:g.game_id,reason:'original projection missing'});continue;}
  const marketAt=m?.market_as_of;
  const quote=(g.market_snapshots??[]).find(x=>(x.market_as_of??x.as_of??x.verified_at)===marketAt);
  if(!quote?.source_url||!Number.isFinite(Date.parse(marketAt))||Date.parse(marketAt)>+now||Date.parse(marketAt)>=kickoff||![g.away,g.home].includes(m.favorite)||!Number.isFinite(m.spread)||!Number.isFinite(m.total)){unresolved.push({id:g.game_id,reason:'original market evidence missing'});continue;}
  games.push({game_id:g.game_id,kickoff:g.kickoff_et,away:g.away,home:g.home,projection_revision_id:r.revision_id,projection_generated_at:r.generated_at,projection:p,model_version:prior.model_version,market:{favorite:m.favorite,spread:m.spread,total:m.total},market_as_of:marketAt,market_source_url:quote.source_url,residual_ids:residuals.map(x=>x.game_id),sample_size:residuals.length});
 }
 for(const g of games){const line=g.market.favorite===g.away?g.market.spread:-g.market.spread;g.market_probabilities={spread:{away_line:line,home_line:-line,away:estimate(archive,g.game_id,'spread',g.away,line),home:estimate(archive,g.game_id,'spread',g.home,-line)},total:{line:g.market.total,over:estimate(archive,g.game_id,'total','over',g.market.total),under:estimate(archive,g.game_id,'total','under',g.market.total)}};}
 return {archive:games.length?gradeAtPublication(archive,stamp):null,unresolved};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const [week,priorPath,out]=process.argv.slice(2);
 if(!week||!priorPath||!out)throw Error('Usage: node scripts/wto-weekly-producer.mjs WEEK PRIOR_ARCHIVE OUTPUT');
 const read=async p=>JSON.parse(await readFile(p,'utf8'));
 const ctx={};vm.createContext(ctx);vm.runInContext(await readFile('wto-ex.js','utf8'),ctx);
 const result=assemble({ledger:await read('ff26-nfl-lines-2026.json'),insights:await read('wto-game-insights-2026.json'),prior:await read(priorPath),week:Number(week),estimate:ctx.WTOEX.estimate});
 console.log(JSON.stringify({ready:result.archive?.games.length??0,unresolved:result.unresolved}));
 if(!result.archive||result.unresolved.length)throw Error('Incomplete original evidence; no archive published');
 validateOriginalPublisherExport(result.archive,out.split('/').at(-1));
 await writeFile(out,JSON.stringify(result.archive,null,2)+'\n',{flag:'wx'});
}
