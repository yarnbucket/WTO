(function(root){
  const number=value=>value==null||value===''?null:Number(value);
  const upper=value=>String(value??'').trim().toUpperCase();

  function latestMarket(game){
    if(!game)return {label:'Unavailable',favorite:null,spread:null,total:null,provider:null,market_as_of:null};
    const closeFavorite=game.closingFavorite??game.closing_favorite;
    const closeSpread=game.closingSpread??game.closing_spread;
    const closeTotal=game.closingTotal??game.closing_total;
    const explicitClose=closeFavorite&&closeSpread!=null&&closeTotal!=null;
    const scheduled=game.status!=='final';
    const favorite=explicitClose?closeFavorite:(scheduled?(game.marketFavorite??game.market_favorite??game.favorite??null):(game.gradingFavorite??game.grading_favorite??game.favorite??null));
    const spread=explicitClose?closeSpread:(scheduled?(game.marketSpread??game.market_spread??game.spread??null):(game.gradingSpread??game.grading_spread??game.spread??null));
    const total=explicitClose?closeTotal:(scheduled?(game.marketTotal??game.market_total??game.total??null):(game.gradingTotal??game.grading_total??game.total??null));
    const available=favorite&&spread!=null&&total!=null;
    const result={
      favorite:favorite??null,
      spread:spread??null,
      total:total??null,
      provider:explicitClose?(game.closingProvider??game.closing_provider??null):(scheduled?(game.priceProvider??game.price_provider??null):(game.gradingProvider??game.grading_provider??game.priceProvider??game.price_provider??null)),
      market_as_of:explicitClose?(game.closingMarketAsOf??game.closing_market_as_of??null):(scheduled?(game.marketAsOf??game.market_as_of??null):(game.gradingMarketAsOf??game.grading_market_as_of??game.marketAsOf??game.market_as_of??null))
    };
    Object.defineProperty(result,'label',{value:explicitClose?'Closing':available?'Last Verified':'Unavailable',enumerable:false});
    return result;
  }

  function marketOutcome(game,market=latestMarket(game)){
    const awayScore=number(game?.awayScore??game?.away_score),homeScore=number(game?.homeScore??game?.home_score),spread=number(market?.spread),total=number(market?.total),favorite=market?.favorite;
    if((game?.status&&game.status!=='final')||awayScore==null||homeScore==null)return {ats_result:null,total_result:null,combined_points:null};
    const combined=awayScore+homeScore;
    let ats=null;
    if(favorite&&spread!=null&&(favorite===game.away||favorite===game.home)){
      const favoriteScore=favorite===game.away?awayScore:homeScore,opponentScore=favorite===game.away?homeScore:awayScore,adjusted=favoriteScore+spread;
      ats=adjusted===opponentScore?'PUSH':adjusted>opponentScore?favorite:(favorite===game.away?game.home:game.away);
    }
    const totalResult=total==null?null:combined===total?'PUSH':combined>total?'OVER':'UNDER';
    return {ats_result:ats??game.ats??game.ats_winner??null,total_result:totalResult??game.ou??game.total_result??null,combined_points:combined};
  }

  function evaluatePredictionOutcome(game,revision,names={}){
    const projection=revision?.independent_projection;
    const generated=Date.parse(revision?.generated_at??'');
    const kickoff=Date.parse(game?.kickoff??game?.kickoff_et??'');
    if(!projection||(game?.status&&game.status!=='final')||(revision?.generated_at&&!Number.isFinite(generated))||(Number.isFinite(kickoff)&&Number.isFinite(generated)&&generated>=kickoff))return null;
    const awayScore=number(game.awayScore??game.away_score),homeScore=number(game.homeScore??game.home_score);
    if(awayScore==null||homeScore==null)return null;
    const winner=awayScore===homeScore?'TIE':awayScore>homeScore?game.away:game.home;
    const outcome=marketOutcome(game),atsResult=upper(outcome.ats_result),totalResult=upper(outcome.total_result);
    const atsLean=upper(revision.market_comparison?.ats_lean)||'NO EDGE';
    const totalLean=upper(revision.market_comparison?.total_lean)||'NO EDGE';
    const scored=(lean,result)=>lean==='NO EDGE'||!result||result==='PUSH'?null:lean===result;
    const winnerCorrect=upper(projection.winner)==='NO EDGE'?null:projection.winner===winner;
    const atsCorrect=scored(atsLean,atsResult),totalCorrect=scored(totalLean,totalResult);
    const scoredResults=[winnerCorrect,atsCorrect,totalCorrect].filter(value=>value!==null),hits=scoredResults.filter(Boolean).length;
    const verdict=scoredResults.length&&hits===scoredResults.length&&winnerCorrect!==null?'ACCURATE':hits>0?'PARTIALLY ACCURATE':'MISSED';
    const projectedScore=`${game.away} ${projection.away_score}–${projection.home_score} ${game.home}`,finalScore=`${game.away} ${awayScore}–${homeScore} ${game.home}`;
    const scoreError=Math.abs(awayScore-number(projection.away_score))+Math.abs(homeScore-number(projection.home_score));
    const name=team=>names[team]||team;
    const winnerSentence=winnerCorrect===null?`${name(winner)} won ${homeScore}–${awayScore} after WTO recorded no straight-up edge at ${projection.away_score}–${projection.home_score}.`:`${name(winner)} won ${homeScore}–${awayScore} after WTO projected ${name(projection.winner)} ${projection.away_score}–${projection.home_score}.`;
    const atsSentence=atsCorrect===null?'the ATS call was not scored':`the ${atsLean} ATS lean ${atsCorrect?'hit':'missed'}`;
    const totalSentence=totalCorrect===null?'the total call was not scored':`the ${totalLean[0]+totalLean.slice(1).toLowerCase()} lean ${totalCorrect?'hit':'missed'}`;
    const summary=`${winnerSentence} ${winnerCorrect===null?'The straight-up call was not scored':`The straight-up call ${winnerCorrect?'hit':'missed'}`}, ${atsSentence}, and ${totalSentence}. The final score differed from the projection by ${scoreError} combined team points.`;
    return {
      verdict,
      winner_correct:winnerCorrect,
      ats_correct:atsCorrect,
      total_correct:totalCorrect,
      winner,
      ats_result:atsResult||null,
      total_result:totalResult||null,
      prediction_revision_id:revision.revision_id??null,
      projected_score:projectedScore,
      final_score:finalScore,
      score_error:scoreError,
      summary
    };
  }

  function selectOutcomeSummary(game,result){
    const stored=String(game?.postgameSummary??game?.postgame_summary??'').trim();
    return stored||String(result?.summary??'').trim();
  }

  function weatherView(revision){
    const weather=revision?.factor_summary?.weather;
    if(!weather)return {visible:false,stage:'unavailable',effect:'unavailable',text:'Weather unavailable'};
    const stage=weather.forecast_stage??'unavailable',effect=weather.effect??'neutral';
    if(stage==='controlled_environment')return {visible:false,stage,effect,text:'Indoor · Low impact'};
    const detail=String(weather.detail??'Weather unavailable').trim(),material=effect!=='neutral'&&(stage==='game_day'||stage==='early_forecast');
    return {visible:material,stage,effect,text:stage==='early_forecast'&&material?`Early forecast · ${detail}`:detail};
  }

  function compactRead(game,revision){
    const projection=revision?.independent_projection,market=revision?.market_comparison??{},factors=revision?.factor_summary??{};
    if(!projection)return {edge:'Insufficient evidence',game_script:null,watch:null,confidence:'UNAVAILABLE'};
    const script=projection.projected_total>=49?'High-scoring look':projection.projected_total<=41?'Defensive game':'Balanced game';
    return {
      edge:`${projection.winner} edge`,
      game_script:script,
      watch:factors.primary_risk??factors.matchup??null,
      confidence:upper(revision.confidence)||'UNAVAILABLE',
      ats:market.ats_lean??'NO EDGE',
      total:market.total_lean??'NO EDGE'
    };
  }

  function pickSummary(game,picks={},advancedPicks={}){
    const winner=picks?.[game?.id]??null,advanced=advancedPicks?.[game?.id]??{};
    const ats=advanced.ats??null,total=advanced.total??null;
    return {winner,ats,total,saved:Boolean(winner||ats||total)};
  }

  function postgameBullets(game,review,grade){
    const stored=review?.bullets??{};
    const ordered=['final','why_winner_won','matchup_coaching_edge','player_rising','weakness_exposed','carry_forward'];
    const items=ordered.filter(key=>String(stored[key]??'').trim()).map(key=>({key,text:String(stored[key]).trim()}));
    if(items.length)return items.slice(0,6);
    if(game?.status!=='final')return [];
    const awayScore=game.awayScore??game.away_score,homeScore=game.homeScore??game.home_score;
    const outcome=marketOutcome(game),ats=upper(outcome.ats_result)||'PENDING',total=upper(outcome.total_result)||'PENDING';
    const final=`${game.away} ${awayScore}–${homeScore} ${game.home} · ATS ${ats} · ${total}`;
    const bullets=[{key:'final',text:final}];
    if(grade){
      bullets.push({key:'prediction_comparison',text:`WTO projected ${grade.projected_score}; final ${grade.final_score}. ${grade.verdict.replaceAll('_',' ')}.`});
      bullets.push({key:'prediction_analysis',text:grade.summary});
    }
    return bullets;
  }

  function scoringTrendAxis(rows,maxValue){
    const max=Math.max(10,Math.ceil(Number(maxValue||0)/10)*10),yTop=26,yBottom=176,xLeft=40,xRight=455;
    const ticks=Array.from({length:max/5+1},(_,i)=>{const value=i*5;return {value,major:value%10===0,y:yBottom-value/max*(yBottom-yTop)}});
    const step=rows.length>1?(xRight-(xLeft+5))/(rows.length-1):0,weekXs=rows.map((_,i)=>xLeft+5+i*step);
    return {max,yTop,yBottom,xLeft,xRight,ticks,weekXs};
  }

  root.WTOUI={latestMarket,marketOutcome,evaluatePredictionOutcome,selectOutcomeSummary,weatherView,compactRead,pickSummary,postgameBullets,scoringTrendAxis};
})(typeof globalThis!=='undefined'?globalThis:this);
