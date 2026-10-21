export function projectMatchup(g,games){
 const league=games.reduce((a,g)=>a+g.away_score+g.home_score,0)/(games.length*2);
 function rate(team,exclude=null){const rows=games.filter(x=>x.game_id!==exclude&&(x.away===team||x.home===team));let pf=0,pa=0;for(const x of rows){pf+=x.away===team?x.away_score:x.home_score;pa+=x.away===team?x.home_score:x.away_score}return {count:rows.length,pf:(pf+2*league)/(rows.length+2),pa:(pa+2*league)/(rows.length+2)}}
 function profile(team){const rows=games.filter(x=>x.away===team||x.home===team),base=rate(team);let oppOff=0,oppDef=0;for(const x of rows){const opp=x.away===team?x.home:x.away,r=rate(opp,x.game_id);oppOff+=r.pf-league;oppDef+=r.pa-league}return {...base,offense:base.pf-(oppDef/rows.length)*.5,defense:base.pa-(oppOff/rows.length)*.5,opponents:rows.map(x=>x.away===team?x.home:x.away)}}
 const away=profile(g.away),home=profile(g.home),neutral=g.away==='PHI'&&g.home==='JAX';
 const a=Math.max(10,Math.min(40,league+(away.offense-league)+(home.defense-league)-(neutral?0:.75)));
 const h=Math.max(10,Math.min(40,league+(home.offense-league)+(away.defense-league)+(neutral?0:.75)));
 return {away,home,league,away_points:a,home_points:h};
}
