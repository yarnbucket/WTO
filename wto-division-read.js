(function(root){
  // Fixed preseason source: Mike Clay, ESPN, updated September 9, 2026.
  const baseline=Object.freeze({BUF:10.1,NE:10.1,NYJ:7.1,MIA:2.5,BAL:11.5,CIN:10.2,PIT:8.7,CLE:6.2,HOU:9.5,JAX:8.6,IND:8.2,TEN:4.8,DEN:11,KC:10,LAC:9.5,LV:4.7,PHI:11,DAL:10.4,NYG:7.5,WAS:6.4,DET:12.1,GB:9.5,CHI:8.4,MIN:8,TB:8.9,NO:7.6,CAR:6.3,ATL:5.7,LAR:13.2,SEA:11.2,SF:9.5,ARI:3.5});
  const source='https://g.espncdn.com/s/ffldraftkit/26/NFLDK2026_CS_ClayProjections2026.pdf';
  function compare(games,teams,throughWeek){
    const finals=games.filter(g=>g.status==='final'&&g.week<=throughWeek&&g.awayScore!=null&&g.homeScore!=null&&Number.isFinite(Number(g.awayScore))&&Number.isFinite(Number(g.homeScore)));
    const records={};
    for(const g of finals)for(const [team,own,other] of [[g.away,Number(g.awayScore),Number(g.homeScore)],[g.home,Number(g.homeScore),Number(g.awayScore)]]){
      const r=records[team]??={team,w:0,l:0,t:0,pf:0,pa:0,played:0};r.played++;r.pf+=own;r.pa+=other;if(own>other)r.w++;else if(own<other)r.l++;else r.t++;
    }
    const rows=teams.map(team=>records[team]||{team,w:0,l:0,t:0,pf:0,pa:0,played:0});
    const rate=r=>r.played?(r.w+r.t/2)/r.played:0;
    const top=Math.max(...rows.filter(r=>r.played).map(rate));
    const leaders=rows.filter(r=>r.played&&rate(r)===top);
    const expected=Math.max(...teams.map(t=>baseline[t]??-Infinity)),favorites=teams.filter(t=>baseline[t]===expected);
    const runner=rows.filter(r=>!leaders.includes(r)).sort((a,b)=>rate(b)-rate(a))[0];
    const lead=leaders[0];
    const gamesAhead=lead&&runner?((lead.w-runner.w)+(runner.l-lead.l))/2:null;
    const reads=leaders.map(r=>{
      const delta=rate(r)-baseline[r.team]/17;
      const label=r.played<4?'Early read':delta>.15?'Exceeding expectations':delta<-.15?'Falling behind':'On track';
      const opponents=finals.filter(g=>g.away===r.team||g.home===r.team).map(g=>g.away===r.team?g.home:g.away);
      let ow=0,og=0;
      for(const opp of opponents)for(const g of finals.filter(g=>(g.away===opp||g.home===opp)&&g.away!==r.team&&g.home!==r.team)){
        const own=Number(g.away===opp?g.awayScore:g.homeScore),other=Number(g.away===opp?g.homeScore:g.awayScore);og++;ow+=own>other?1:own===other?.5:0;
      }
      const margin=r.pf-r.pa;
      return `${r.team}: ${label.toLowerCase()} — ${margin>0?'+':''}${margin} scoring margin; opponents ${og?Math.round(ow/og*100)+'% wins outside this matchup':'not yet measurable'}.`;
    });
    return {leaders,favorites,gamesAhead,reads,throughWeek:Math.max(0,...finals.map(g=>g.week))};
  }
  root.WTODivision={baseline,source,compare};
})(globalThis);
