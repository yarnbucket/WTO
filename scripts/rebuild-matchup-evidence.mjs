import fs from 'node:fs';
import vm from 'node:vm';
import {projectMatchup} from './wto-points-model.mjs';
const root=new URL('../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
const write=(p,x)=>fs.writeFileSync(new URL(p,root),JSON.stringify(x,null,2)+'\n');
const ledger=read('ff26-nfl-lines-2026.json'),insights=read('wto-game-insights-2026.json');
const now=new Date().toISOString();
const ui={};vm.createContext(ui);vm.runInContext(fs.readFileSync(new URL('wto-ui-lib.js',root),'utf8'),ui);
const nfl='https://fantasy-www.nfl.com/news/2026-nfl-season-week-4-what-we-learned-from-sunday-s-games';
const notes={
 'PIT-CLE':['Cleveland pressure and takeaways decided it; Pittsburgh protection failed.',{pit_sacks_allowed:5,pit_interceptions:2},'https://fantasy-www.nfl.com/news/steelers-browns-on-thursday-night-football-what-we-learned-from-cleveland-s-27-24-win'],
 'IND-WAS':['Taylor carried Indianapolis; Washington lost Mariota during the game.',{},nfl],
 'ARI-NYG':['Banks ended Arizona’s comeback with a decisive interception return.',{},nfl],
 'DAL-HOU':['Lamb overwhelmed Houston’s coverage; Dallas scored repeatedly after halftime.',{},nfl],
 'GB-TB':['Green Bay pressure stopped Tampa Bay’s final possession.',{},nfl],
 'JAX-CIN':['Burrow interceptions erased opportunities; Jacksonville capitalized.',{},nfl],
 'LAR-PHI':['Philadelphia went 0-for-12 on third down; Williams finished the comeback.',{},'https://www.philadelphiaeagles.com/news/rams-vs-eagles-game-recap-october-4-2026-nfl-week-4-regular-season-jalen-hurts-matthew-stafford'],
 'NE-BUF':['Maye delivered late; Buffalo couldn’t finish defensively.',{},nfl],
 'NYJ-CHI':['Chicago’s running game supported Bagent; New York couldn’t sustain offense.',{},nfl],
 'TEN-BAL':['Baltimore’s defense protected the lead after Jackson exited.',{},nfl],
 'MIA-MIN':['Reichard’s kicking carried Minnesota; offensive finishing remained weak.',{},nfl],
 'DEN-SF':['Kittle’s screen punished Denver; San Francisco controlled the run.',{},nfl],
 'KC-LV':['Walker and special teams supplied Kansas City’s decisive separation.',{},nfl],
 'LAC-SEA':['Herbert turnovers undermined Los Angeles; Seattle finished with pressure.',{},nfl],
 'DET-CAR':['McMillan exposed Detroit’s coverage; Carolina finished drives better.',{},nfl],
 'ATL-NO':['Atlanta ran through New Orleans; defensive absences and missed tackles mattered.',{atl_rushing_yards:205,atl_rushing_touchdowns:5,no_missed_tackles:19},'https://fantasy-www.nfl.com/news/falcons-saints-on-monday-night-football-what-we-learned-from-atlanta-s-45-24-win']
};
for(const entry of insights.weeks.find(w=>w.week===4).games){
 const g=ledger.weeks.find(w=>w.week===4).games.find(g=>g.game_id===entry.game_id);
 const r=entry.revisions.filter(r=>r.independent_projection&&Date.parse(r.generated_at)<Date.parse(g.kickoff_et)).sort((a,b)=>Date.parse(b.generated_at)-Date.parse(a.generated_at))[0];
 const grade=ui.WTOUI.evaluatePredictionOutcome(g,r),[cause,metrics,url]=notes[g.away+'-'+g.home];
 const call=(name,result)=>`${name} ${result===null?'NO EDGE / unscored':result?'hit':'missed'}`;
 const comparison=`WTO projected ${grade.projected_score}; final ${grade.final_score}. ${call('Winner',grade.winner_correct)}, ${call('spread',grade.ats_correct)}, ${call('total',grade.total_correct)} — ${grade.verdict.replaceAll('_',' ')}.`;
 g.postgame_summary=`${cause} ${comparison}`;
 g.postgame_evidence={metrics,provider:'NFL / official team recap',source_urls:[url],verified_at:now};
 entry.postgame_evaluation={...grade,verified_at:now};
 entry.postgame_review={generated_at:now,analysis_type:'retrospective',prediction_revision_id:r.revision_id,bullets:{final:`${grade.final_score} · ATS ${grade.ats_result} · ${grade.total_result}`,why_winner_won:cause,weakness_exposed:'Outcome review: '+comparison,carry_forward:'Recheck whether this matchup weakness persists against the next opponent; one result does not establish a trend.'},evidence:[{label:'Verified game recap',url,checked_at:now}]};
}

// Independent points model: shrink scoring rates, then adjust for opponents' other games.
// No spread, total or market price is accessed until the projection is complete.

const risks={
 'CHI-GB':{detail:'Bagent demonstrated productive relief play; Chicago starter remains unresolved. Green Bay lost Cooper for the season.',url:'https://www.packers.com/news/lb-edgerrin-cooper-is-tough-one-to-lose-for-packers-oct-5-2026',hold:true},
 'TB-DAL':{detail:'Mayfield estimated DNP with thumb injury; Dallas guard Tyler Smith limited. Availability unresolved.',url:'https://www.buccaneers.com/news/buccaneers-cowboys-injury-report-oct-5-week-5-2026',hold:true},
 'PHI-JAX':{detail:'Barkley left with a hamstring injury. Philadelphia’s offensive finishing needs a rebound; Week 5 availability unresolved.',url:'https://www.philadelphiaeagles.com/news/rams-vs-eagles-game-recap-october-4-2026-nfl-week-4-regular-season-jalen-hurts-matthew-stafford',hold:true},
 'CIN-MIA':{detail:'Chase exited with concussion symptoms; clearance unresolved.',url:nfl,hold:true},
 'NYG-WAS':{detail:'Washington quarterback availability unresolved after Mariota’s injury; Daniels return is unconfirmed.',url:nfl,hold:true},
 'DEN-LAC':{detail:'Slater high ankle sprain, Alt still under evaluation, Penning in concussion protocol. Protection risk is material.',url:'https://www.chargers.com/news/injury-updates-rashawn-slater-joe-alt-ladd-mcconkey',hold:true},
 'BAL-ATL':{detail:'Jackson’s Week 5 availability remains unresolved; Huntley is the alternative, not an automatic failure.',url:'https://www.baltimoreravens.com/news/lamar-jackson-ankle-injury-update-jesse-minter-ravens-pass-rush-defensive-line-tyler-loop',hold:true}
};
const prior=ledger.weeks.filter(w=>w.week<=4).flatMap(w=>w.games).filter(g=>g.status==='final');
const w5=insights.weeks.find(w=>w.week===5);
for(const g of ledger.weeks.find(w=>w.week===5).games){
 const entry=w5.games.find(x=>x.game_id===g.game_id),old=entry.revisions.at(-1),raw=projectMatchup(g,prior),risk=risks[g.away+'-'+g.home];
 const awayScore=Math.round(raw.away_points),homeScore=Math.round(raw.home_points),winner=awayScore===homeScore?'NO EDGE':awayScore>homeScore?g.away:g.home;
 const margin=Math.abs(homeScore-awayScore),total=awayScore+homeScore;
 const p={winner,away_score:awayScore,home_score:homeScore,projected_margin:margin,projected_total:total,win_probability:+Math.min(.75,1/(1+Math.exp(-margin/7))).toFixed(3)};
 const fm=g.market_favorite===g.away?awayScore-homeScore:homeScore-awayScore,edge=fm-Math.abs(g.market_spread),te=total-g.market_total,dog=g.market_favorite===g.away?g.home:g.away;
 const ats=Math.abs(edge)>=3?(edge>0?g.market_favorite:dog):'NO EDGE',ou=Math.abs(te)>=4?(te>0?'OVER':'UNDER'):'NO EDGE';
 const m={favorite:g.market_favorite,spread:g.market_spread,total:g.market_total,provider:g.price_provider,market_as_of:g.market_as_of,ats_lean:risk?.hold?'NO EDGE':ats,total_lean:risk?.hold?'NO EDGE':ou,hype_check:edge<-3?'OVERVALUED':edge>3?'UNDERVALUED':'FAIR',spread_edge_points:edge,total_edge_points:te};
 const source={provider:'WTO verified results',url:'https://github.com/yarnbucket/WTO/blob/36f2ad7ffe4e7230d6e8b1a3e75c411c3934dd62/ff26-nfl-lines-2026.json',checked_at:now};
 const why=`Opponent-adjusted scoring replaces compressed margin weighting; offense and opponent defense now determine each team’s independent score. ${risk?'Verified availability uncertainty prevents an actionable ATS/total call.':'Only differences above the conservative thresholds produce a lean.'}`;
 entry.revisions.push({revision_id:g.game_id+'-evidence-'+now.replace(/[^0-9]/g,''),revision_type:'evidence_revision',generated_at:now,independent_projection:p,market_comparison:m,confidence:'LOW',what_changed:{previous_projection:old.independent_projection,new_projection:p,previous_market_call:old.market_comparison,new_market_call:m},why_changed:why,model_audit:{version:'opponent-adjusted-points-v2',...raw,shrinkage_pseudo_games:2,opponent_adjustment_strength:.5,home_points_effect:.75,market_used_as_input:false,probability_calibrated:false,injury_point_adjustment:0,injury_policy:'Unresolved availability holds actionable calls rather than inventing a point penalty.'},factor_summary:{quarterback:{status:risk?'availability_unresolved':'not_fully_verified',effect:'neutral',detail:risk?.detail??'Current Week 5 QB status not fully verified; no assumed injury penalty.'},weather:{forecast_stage:'unavailable',effect:'neutral',detail:'Forecast wind, precipitation and roof status remain unverified; no weather points applied.'},recent_form:`Opponent-adjusted scoring through Week 4; ${g.away} faced ${raw.away.opponents.join(', ')}; ${g.home} faced ${raw.home.opponents.join(', ')}.`,matchup:risk?.detail??'Compare each offense with the opponent’s schedule-adjusted points allowed.',home_field:g.away==='PHI'&&g.home==='JAX'?'London: no home-field scoring bonus.':'Small venue allowance applied.',primary_risk:risk?.detail??'Four-game sample; detailed personnel, scheme and weather verification incomplete.'},editorial_read:`WTO projects ${g.away} ${awayScore}–${homeScore} ${g.home}, independently of the market. ${risk?'Availability uncertainty keeps the betting read on hold.':`Against ${g.market_favorite} ${g.market_spread} and ${g.market_total}, the spread read is ${m.ats_lean} and total read is ${m.total_lean}.`} ${risk?.detail??'Opponent quality is included; confidence remains low with only four games.'}`,sources:[source,{provider:g.price_provider,url:'https://www.cbssports.com/nfl/odds/2026/regular/week-5/',checked_at:g.market_as_of},...(risk?[{provider:'Official NFL/team report',url:risk.url,checked_at:now}]:[])],verification_confirmation:{status:'partial',verified_at:now,verified_fields:['prior_results','opponents','schedule_adjusted_scoring','stored_market',...(risk?['reported_injury_risk']:[])],unverified_fields:['final_week5_availability','weather','complete_scheme_metrics'],source_urls:[source.url,...(risk?[risk.url]:[])]},unavailable_fields:[{field:'weather',reason:'Current weather not verified.'},{field:'final_week5_availability',reason:'Final participation and game designations not yet confirmed.'}]});
}
insights.updated_at=now;insights.methodology.projection='Opponent-adjusted independent offensive/defensive scoring rates with two-game shrinkage; market is only compared afterward. Unresolved material personnel uncertainty holds betting calls.';
write('wto-game-insights-2026.json',insights);write('ff26-nfl-lines-2026.json',ledger);
console.log(w5.games.map(g=>{const r=g.revisions.at(-1);return {game:g.game_id,score:r.independent_projection,ats:r.market_comparison.ats_lean,total:r.market_comparison.total_lean}}));
