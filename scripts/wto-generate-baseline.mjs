import {projectMatchup} from './wto-points-model.mjs';
import {baselineWinProbability} from './wto-baseline-probability.mjs';
// Pure baseline generator; callers must supply independently verified completed prior-week games.
export function generateBaseline(game,history){
 if(!history.length||history.some(g=>g.status!=='final'||!Number.isFinite(g.away_score)||!Number.isFinite(g.home_score)))throw Error('Verified final inputs required');
 if(new Set(history.map(g=>g.game_id)).size!==history.length)throw Error('Duplicate training games');
 if(!history.some(g=>[g.away,g.home].includes(game.away))||!history.some(g=>[g.away,g.home].includes(game.home)))throw Error('Missing team history');
 const audit=projectMatchup(game,history);
 const away_score=Math.round(audit.away_points),home_score=Math.round(audit.home_points);
 const projected_margin=Math.abs(home_score-away_score);
 if(!Number.isFinite(projected_margin)||projected_margin===0)throw Error('Unsupported tied or invalid baseline');
 const winner_side=home_score>away_score?'HOME':'AWAY';
 return {projection:{away_score,home_score,projected_total:away_score+home_score,projected_margin,winner:winner_side==='HOME'?game.home:game.away,winner_side,win_probability:baselineWinProbability(projected_margin),estimate_label:'Conditional best-available baseline'},audit:{...audit,market_used_as_input:false,injury_point_adjustment:0,probability_calibrated:false,input_game_ids:history.map(g=>g.game_id)}};
}
