// Recovered baseline probability: matches archived Weeks 8–11 at 3 decimals.
export function baselineWinProbability(margin){
 if(!Number.isFinite(margin)||margin<0)throw Error('Invalid absolute projected margin');
 return Number(Math.min(.75,1/(1+Math.exp(-margin/7))).toFixed(3));
}
