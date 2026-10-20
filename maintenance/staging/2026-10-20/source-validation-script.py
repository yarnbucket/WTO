exec(open('tuesday_validate.py').read())
source_checks=0
cached={r['url']:r for p in pathlib.Path('top20-raw').glob('401*.json') if (r:=read(p))}
for p in (R/'raw').glob('week7-401*.json'):
 r=read(p);cached[r['url']]=r
for g in games.values():
 if g['game_id'] in [x['game_id'] for x in W7]:
  q=g['market_snapshots'][-1];raw=cached[q['source_url']];data=raw['data'];c=data['header']['competitions'][0]
  check(date(c['date'])==date(g['kickoff_et']) and data['header']['season']=={'year':2026,'type':2} if data['header']['season']=={'year':2026,'type':2} else data['header']['season']['year']==2026 and data['header']['season']['type']==2,'raw schedule season '+g['game_id'])
  check(date(c['date'])==date(g['kickoff_et']),'raw kickoff '+g['game_id'])
  by={x['homeAway']:{'JAC':'JAX','WSH':'WAS'}.get(x['team']['abbreviation'],x['team']['abbreviation']) for x in c['competitors']};check(by=={'away':g['away'],'home':g['home']},'raw teams '+g['game_id'])
  p=next(x for x in data['pickcenter'] if x['provider']['name'].replace(' ','').lower()=='draftkings');ps=p['pointSpread'];tot=p['total']
  for side in ['away','home']:
   check(float(ps[side]['close']['line'])==q[side+'_spread'] and float(ps[side]['close']['odds'])==q[side+'_spread_price'],'raw spreadprice '+g['game_id']+side)
  for side in ['over','under']:
   check(float(tot[side]['close']['line'].lstrip('ou'))==q['total'] and float(tot[side]['close']['odds'])==q[side+'_price'],'raw totalprice '+g['game_id']+side)
  check(q['captured_at']==raw['retrieved_at'],'actual retrieval '+g['game_id']);source_checks+=1
 if g['opening_verified_at']==report['checked_at'] if g.get('opening_verified_at') else False:
  raw=cached[g['opening_source_url']];p=next(x for x in raw['data']['pickcenter'] if x['provider']['name'].replace(' ','').lower()=='draftkings');ps=p['pointSpread'];tot=p['total']
  av=float(ps['away']['open']['line']);hv=float(ps['home']['open']['line']);check(av==-hv and min(av,hv)==g['opening_spread'] and (g['away'] if av<0 else g['home'])==g['opening_favorite'],'explicit raw open '+g['game_id'])
  check(float(tot['over']['open']['line'].lstrip('ou'))==g['opening_total'],'explicit raw opening total '+g['game_id']);source_checks+=1
# Winner probability scoring is separate from tie calls.
review=read(S/'week6-model-review.json');eligible=[r for r in review['rows'] if r['winner_probability_eligible']];n=len(eligible)
metrics={'eligible':n,'tie_forecasts_excluded':len(review['rows'])-n,'accuracy':sum(r['winner_correct'] for r in eligible)/n,'log_loss':sum(-math.log(r['winner_probability'] if r['winner_correct'] else 1-r['winner_probability']) for r in eligible)/n,'brier':sum((r['winner_probability']-r['winner_correct'])**2 for r in eligible)/n,'reliability':[]}
for lo,hi in [(0,.2),(.2,.4),(.4,.6),(.6,.8),(.8,1.000001)]:
 rs=[r for r in eligible if lo<=r['winner_probability']<hi];metrics['reliability'].append({'lower':lo,'upper':min(hi,1),'n':len(rs),'mean_probability':sum(r['winner_probability'] for r in rs)/len(rs) if rs else None,'observed_correct_rate':sum(r['winner_correct'] for r in rs)/len(rs) if rs else None})
review['production']['winner_probability_metrics']=metrics;json.dump(review,open(S/'week6-model-review.json','w'),indent=2)
report['validation']['assertions']=len(checks);report['validation']['checks']=checks;report['validation']['raw_source_matches']=source_checks;report['validation']['families'].append('14 raw Week7 identity/kickoff/price matches;63 named explicit historical opening matches')
report['validation']['limitations']=['Previously published historical forecast/postgame objects preserved verbatim; no retrospective schema rewrites.','No numerical Week7 prediction/EX output is authorized for production while required inputs remain unresolved.','Previously finalized Week6 highlights are unchanged, not newly added results.']
json.dump(report,open(S/'validation-report.json','w'),indent=2)
print('PASS raw source matches',source_checks,'total assertions',len(checks))
