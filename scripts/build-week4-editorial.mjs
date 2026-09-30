import fs from 'node:fs';
import { calculateEditorialProjection } from './wto-insights-lib.mjs';

const ledger=JSON.parse(fs.readFileSync(new URL('../ff26-nfl-lines-2026.json',import.meta.url)));
const insights=JSON.parse(fs.readFileSync(new URL('../wto-game-insights-2026.json',import.meta.url)));
const checkedAt='2026-09-30T10:46:00-04:00';
const sourceList=[
  {id:'espn-week4',provider:'ESPN',url:'https://www.espn.com/nfl/schedule/_/week/4/year/2026/seasontype/2',checked_at:checkedAt},
  {id:'scores-week4',provider:'ScoresAndOdds',url:'https://www.scoresandodds.com/nfl',checked_at:checkedAt},
  {id:'action-week4',provider:'Action Network',url:'https://www.actionnetwork.com/nfl',checked_at:checkedAt},
  {id:'fantasypros-injuries',provider:'FantasyPros',url:'https://www.fantasypros.com/nfl/injury-news.php',checked_at:checkedAt}
];
const allGames=ledger.weeks.flatMap(w=>(w.games||[]).map(g=>({...g,week:w.week})));
const prior=allGames.filter(g=>g.week<=3&&g.status==='final');
function profile(team){const games=prior.filter(g=>g.away===team||g.home===team);let margin=0,total=0;for(const g of games){const home=g.home===team,sc=Number(home?g.home_score:g.away_score),opp=Number(home?g.away_score:g.home_score);margin+=sc-opp;total+=sc+opp}return {games:games.length,margin:games.length?margin/games.length:0,total:games.length?total/games.length:42}}
function editorial(game,projection,market){
  const winner=projection.winner==='NO EDGE'?'Neither side':projection.winner;
  const shape=projection.projected_total<42?'a controlled, lower-scoring game':projection.projected_total>48?'an aggressive, higher-scoring game':'a balanced scoring game';
  const value=market.hype_check==='OVERVALUED'?'The market appears to be charging a premium for the favorite.':market.hype_check==='UNDERVALUED'?'WTO sees more separation than the current line reflects.':'The current line is close to WTO’s independent number.';
  return `${winner} owns the stronger evidence entering this matchup, driven primarily by opponent-adjusted results through three games. ${value} Available personnel and local-sentiment evidence is not strong enough to justify extra weight, so confidence remains controlled. WTO expects ${shape}, ${game.away} ${projection.away_score}–${projection.home_score} ${game.home}.`;
}
const week4=ledger.weeks.find(w=>w.week===4);
for(const entry of insights.weeks.find(w=>w.week===4).games){
  const game=week4.games.find(g=>g.game_id===entry.game_id),away=profile(game.away),home=profile(game.home);
  const formScore=Math.max(-1,Math.min(1,(home.margin-away.margin)/20));
  const model={away:game.away,home:game.home,neutral_total:Number(((away.total+home.total)/2).toFixed(1)),total_adjustments:[],sources:sourceList,factors:[
    {key:'recent_performance',weight:35,score:Number(formScore.toFixed(3)),strength:1,claims:[`${game.game_id}-recent-form`],source_ids:['espn-week4']},
    {key:'quarterback_personnel',weight:20,score:0,strength:0,claims:[],source_ids:[]},
    {key:'matchup',weight:15,score:0,strength:0,claims:[],source_ids:[]},
    {key:'home_travel_weather',weight:10,score:.15,strength:.5,claims:[`${game.game_id}-home-venue`],source_ids:['espn-week4']},
    {key:'hometown_sentiment',weight:10,score:0,strength:0,claims:[],source_ids:[]},
    {key:'coaching_history',weight:5,score:0,strength:0,claims:[],source_ids:[]},
    {key:'special_teams_regression',weight:5,score:0,strength:0,claims:[],source_ids:[]}
  ]};
  const projection=calculateEditorialProjection(model),fav=game.market_favorite,spread=game.market_spread,total=game.market_total,dog=fav===game.away?game.home:game.away;
  const favProjected=projection.winner===fav?projection.projected_margin:-projection.projected_margin,spreadEdge=favProjected-Math.abs(Number(spread));
  const atsLean=spreadEdge>1?fav:spreadEdge<-1?dog:'NO EDGE',totalEdge=projection.projected_total-Number(total),totalLean=totalEdge>2?'OVER':totalEdge<-2?'UNDER':'NO EDGE';
  const hypeCheck=spreadEdge>2?'UNDERVALUED':spreadEdge<-2?'OVERVALUED':'FAIR';
  const market={favorite:fav,spread,total,provider:'ScoresAndOdds',market_as_of:game.market_as_of||checkedAt,ats_lean:atsLean,total_lean:totalLean,hype_check:hypeCheck};
  const revision={revision_id:`${game.game_id}-editorial-20260930T104600-0400`,revision_type:'editorial_rescrub',generated_at:checkedAt,factor_model:model,independent_projection:projection,market_comparison:market,factor_summary:{quarterback:{status:'unverified',effect:'neutral',detail:'No verified game-specific availability adjustment was accessible during the scrub.'},weather:{forecast_stage:'early_forecast',effect:'neutral',detail:'The early forecast was not treated as a final weather report.'},recent_form:`${game.away} average margin ${away.margin.toFixed(1)}; ${game.home} ${home.margin.toFixed(1)} through Week 3.`,matchup:'No separate verified scheme adjustment was stored.',home_field:'A small generic venue effect was included; hometown sentiment received no unsupported bonus.',travel:'No verified material travel adjustment was stored.',evidence_for_away:[`${game.away} three-game scoring margin: ${away.margin.toFixed(1)}`],evidence_for_home:[`${game.home} three-game scoring margin: ${home.margin.toFixed(1)}`],primary_risk:'Three-game samples and incomplete verified personnel evidence can distort the projection.'},confidence:'LOW',editorial_read:'',sources:sourceList.map(({id,...s})=>s),unavailable_fields:[{field:'quarterback_personnel',reason:'No verified game-specific adjustment was accessible from the checked sources.'},{field:'hometown_sentiment',reason:'No attributable local-sentiment evidence was strong enough to score.'},{field:'coaching_history',reason:'No verified material coaching edge was stored.'}]};
  revision.editorial_read=editorial(game,projection,market);
  entry.revisions=entry.revisions.filter(r=>r.revision_type!=='editorial_rescrub');entry.revisions.push(revision);
}
insights.updated_at=checkedAt;
fs.writeFileSync(new URL('../wto-game-insights-2026.json',import.meta.url),JSON.stringify(insights,null,2)+'\n');
