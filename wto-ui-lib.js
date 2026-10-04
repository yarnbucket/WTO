(function(root){
  function latestMarket(game){
    if(!game)return {favorite:null,spread:null,total:null,market_as_of:null,provider:null};
    return {
      favorite:game.market_favorite??game.favorite??null,
      spread:game.market_spread??game.spread??null,
      total:game.market_total??game.total??null,
      market_as_of:game.market_as_of??game.marketAsOf??null,
      provider:game.price_provider??game.priceProvider??null
    };
  }
  function evaluatePredictionOutcome(game,revision,names={}){
    if(!game||!revision?.independent_projection)return null;
    const p=revision.independent_projection,m=revision.market_comparison||{};
    const actualWinner=Number(game.awayScore)>Number(game.homeScore)?game.away:Number(game.homeScore)>Number(game.awayScore)?game.home:'TIE';
    const predictedWinner=p.winner;
    const winnerCorrect=predictedWinner==='NO EDGE'||!predictedWinner?null:predictedWinner===actualWinner;
    const atsLean=String(m.ats_lean||'NO EDGE').toUpperCase(),actualAts=String(game.ats||'').toUpperCase();
    const atsCorrect=atsLean==='NO EDGE'||!actualAts||actualAts==='PUSH'?null:atsLean===actualAts;
    const totalLean=String(m.total_lean||'NO EDGE').toUpperCase(),actualTotal=String(game.ou||'').toUpperCase();
    const totalCorrect=totalLean==='NO EDGE'||!actualTotal||actualTotal==='PUSH'?null:totalLean===actualTotal;
    const scored=[winnerCorrect,atsCorrect,totalCorrect].filter(v=>v!==null),hits=scored.filter(Boolean).length,fullyCalled=winnerCorrect!==null;
    const verdict=scored.length&&hits===scored.length&&fullyCalled?'ACCURATE':hits>0?'PARTIALLY ACCURATE':'MISSED';
    const name=team=>names[team]||team,projectedScore=`${game.away} ${p.away_score}–${p.home_score} ${game.home}`,finalScore=`${game.away} ${game.awayScore}–${game.homeScore} ${game.home}`;
    const scoreError=Math.abs(Number(game.awayScore)-Number(p.away_score))+Math.abs(Number(game.homeScore)-Number(p.home_score));
    const winnerSentence=winnerCorrect===null?`${name(actualWinner)} won ${game.homeScore}–${game.awayScore} after WTO recorded no straight-up edge at ${p.away_score}–${p.home_score}.`:`${name(actualWinner)} won ${game.homeScore}–${game.awayScore} after WTO projected ${name(predictedWinner)} ${p.away_score}–${p.home_score}.`;
    const atsSentence=atsCorrect===null?'the ATS call was not scored':`the ${atsLean} ATS lean ${atsCorrect?'hit':'missed'}`;
    const totalSentence=totalCorrect===null?'the total call was not scored':`the ${totalLean[0]+totalLean.slice(1).toLowerCase()} lean ${totalCorrect?'hit':'missed'}`;
    const summary=`${winnerSentence} ${winnerCorrect===null?'The straight-up call was not scored':`The straight-up call ${winnerCorrect?'hit':'missed'}`}, ${atsSentence}, and ${totalSentence}. The final score differed from the projection by ${scoreError} combined team points.`;
    return {verdict,winner_correct:winnerCorrect,ats_correct:atsCorrect,total_correct:totalCorrect,projected_score:projectedScore,final_score:finalScore,score_error:scoreError,summary};
  }
  root.WTOUI={latestMarket,evaluatePredictionOutcome};
})(typeof globalThis!=='undefined'?globalThis:this);
