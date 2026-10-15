(function(root){
 function estimate(snapshot,gameId,type,side,line){
  if(line===null||line===undefined||line===''||!Number.isFinite(Number(line)))return null;
  const g=snapshot?.games?.find(g=>g.game_id===gameId),rows=snapshot?.training_residuals;
  if(!g||!rows?.length||!['spread','total'].includes(type))return null;
  if(type==='spread'&&side!==g.away&&side!==g.home||type==='total'&&!['over','under'].includes(side))return null;
  const p=g.projection;if(!Number.isFinite(p?.away_score)||!Number.isFinite(p?.home_score))return null;
  const threshold=Number(line);let won=0,lost=0,push=0;
  for(const r of rows){
   if(r.week>=snapshot.week)return null;
   const outcome=type==='spread'?(p.away_score-p.home_score+r.margin_error)*(side===g.away?1:-1)+threshold:(p.away_score+p.home_score+r.total_error-threshold)*(side==='over'?1:-1);
   if(!Number.isFinite(outcome))return null;
   if(outcome>0)won++;else if(outcome<0)lost++;else push++;
  }
  const integer=Number.isInteger(threshold),denom=rows.length+(integer?3:2);
  return {probability:(won+1)/denom,loss_probability:(lost+1)/denom,push_probability:integer?(push+1)/denom:0,sample_size:rows.length,model_version:snapshot.model_version};
 }
 root.WTOEX={estimate};
})(typeof globalThis!=='undefined'?globalThis:this);
