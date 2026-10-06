(function(root){
 const num=x=>x==null||x===''?null:Number(x);
 function locked(game,now=Date.now()){if(!game)return true;const k=Date.parse(game.kickoff??game.kickoff_et);return game.status==='final'||!Number.isFinite(k)||Number(now)>=k;}
 function market(game,kind,side){if(kind==='winner')return {line:null,price:null};if(kind==='total')return {line:num(game.total),price:num(side==='over'?game.overPrice:game.underPrice)};return {line:game.spread==null?null:side===game.favorite?num(game.spread):-num(game.spread),price:num(side===game.away?game.awaySpreadPrice:game.homeSpreadPrice)};}
 function save(previous,game,input,at=new Date().toISOString()){
  if(game.week<5||!Number.isFinite(Date.parse(at))||locked(game,Date.parse(at)))throw Error('This game is locked or unavailable.');
  const {kind,side}=input;if(!['winner','spread','total'].includes(kind))throw Error('Choose a pick type.');
  if(!(kind==='total'?['over','under']:[game.away,game.home]).includes(side))throw Error('Choose a valid side.');
  const line=kind==='winner'?null:num(input.line),price=num(input.price);
  if(kind!=='winner'&&(line==null||!Number.isFinite(line)||(kind==='total'&&line<=0)||Math.abs(line)>200))throw Error('Enter a valid spread or positive total.');
  if(price!=null&&(!Number.isInteger(price)||Math.abs(price)<100||Math.abs(price)>100000))throw Error('American odds must be +100 or higher, or −100 or lower.');
  const group=String(input.group||'Favorites').trim().slice(0,40)||'Favorites',m=market(game,kind,side);
  const history=previous?[...(previous.history||[]),{kind:previous.kind,side:previous.side,line:previous.line,price:previous.price,group:previous.group,saved_at:previous.saved_at}]:[];
  return {id:previous?.id??`${game.id}:${kind}:${group}`,game_id:game.id,week:game.week,season:2026,kind,side,line,price,group,custom:kind!=='winner'&&line!==m.line,market_line:m.line,market_price:m.price,market_as_of:game.marketAsOf??null,market_provider:game.priceProvider??null,saved_at:at,history};
 }
 function grade(p,g){if(!g||g.status!=='final')return 'PENDING';const a=num(g.awayScore??g.away_score),h=num(g.homeScore??g.home_score);if(a==null||h==null||!Number.isFinite(a)||!Number.isFinite(h))return 'PENDING';let delta;if(p.kind==='winner')delta=p.side===g.away?a-h:h-a;else if(p.kind==='spread')delta=(p.side===g.away?a-h:h-a)+p.line;else delta=(a+h-p.line)*(p.side==='over'?1:-1);return delta===0?'PUSH':delta>0?'WON':'LOST';}
 function select(picks,next){return [...picks.filter(p=>p.game_id!==next.game_id||p.kind!==next.kind),next]}
 root.WTOSlip={save,grade,locked,market,select};
})(typeof globalThis!=='undefined'?globalThis:this);
