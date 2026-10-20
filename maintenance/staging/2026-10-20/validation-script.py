import json, pathlib, datetime, math, collections, hashlib
R=pathlib.Path('tuesday-20261020');B=R/'base';S=R/'staging'
def read(p):return json.load(open(p))
def base(n):return read(B/(n+'.json'))
def cand(n):return read(S/(n+'.candidate.json'))
def date(x):return datetime.datetime.fromisoformat(x.replace('Z','+00:00'))
checks=[]
def check(x,n):
 assert x,n
 checks.append(n)
L=cand('ff26-nfl-lines-2026');old=base('ff26-nfl-lines-2026');games={g['game_id']:g for w in L['weeks'] for g in w['games']};oldg={g['game_id']:g for w in old['weeks'] for g in w['games']};weeks={g['game_id']:w['week'] for w in L['weeks'] for g in w['games']}
check(len(games)==272 and games.keys()==oldg.keys(),'272 regular-season identities preserved')
immutable=['market_snapshots','opening_verification_snapshots','kickoff_weather_snapshots']
verified=0;reselected=0
for id,g in games.items():
 o=oldg[id]
 check(all(g.get(k)==o.get(k) for k in ['away','home','kickoff_et','schedule_game_id']),'identity '+id)
 for k in immutable:check(g.get(k,[])[:len(o.get(k,[]))]==o.get(k,[]),'immutable '+k+' '+id)
 if o.get('opening_line_type')=='explicit_sportsbook_open' and o.get('opening_verified_at'):
  check(all(g.get(k)==v for k,v in o.items() if k.startswith('opening_') and k!='opening_verification_snapshots'),'verified opener retained '+id);verified+=1
 elif g.get('opening_line_type')=='explicit_sportsbook_open':
  legacy=[x for x in g['opening_verification_snapshots'] if x.get('record_type')=='preserved_legacy_opening_observation']
  check(len(legacy)==1,'legacy observation retained '+id);reselected+=1
 if g['status']=='final':
  check(all(g.get(k)==o.get(k) for k in ['away_score','home_score','straight_up_winner','combined_points','ats_winner','total_result','closing_favorite','closing_spread','closing_total','postgame_summary','postgame_evidence']),'final facts unchanged '+id)
  a,h=g['away_score'],g['home_score'];check(g['combined_points']==a+h,'combined '+id)
  check(g['straight_up_winner']==(g['away'] if a>h else g['home'] if h>a else 'TIE'),'winner '+id)
  f=g.get('closing_favorite') or g.get('grading_favorite');s=g.get('closing_spread') if g.get('closing_spread') is not None else g.get('grading_spread');t=g.get('closing_total') if g.get('closing_total') is not None else g.get('grading_total')
  if s is not None:
   delta=(a-h if f==g['away'] else h-a)+s
   check(g['ats_winner']==('PUSH' if delta==0 else f if delta>0 else g['home'] if f==g['away'] else g['away']),'ATS '+id)
  if t is not None:check(g['total_result']==('over' if a+h>t else 'under' if a+h<t else 'push'),'total '+id)
check(verified==44 and reselected==63,'44 previously verified retained;63 source-labeled opener selections')
finals=[g for g in games.values() if g['status']=='final'];W7=L['weeks'][6]['games'];check(len(finals)==93 and len(W7)==14,'93 finals;14 Week7 matchups')
for g in W7:
 q=g['market_snapshots'][-1];check(q['provider']=='DraftKings via ESPN' and q['market_scope']=='full_game' and q['favorite_spread']<0 and q['favorite'] in [g['away'],g['home']],'full-game sign/provider '+g['game_id'])
 check(date(q['captured_at'])<date(g['kickoff_et']) and q['captured_at']==g['market_as_of'],'current quote timestamp '+g['game_id'])
 for k in ['away_spread_price','home_spread_price','over_price','under_price']:check(q[k] is None or abs(q[k])>=100,'price '+k+g['game_id'])
 raw=read(R/'raw'/('summary-'+g['schedule_game_id']+'.json')) if (R/'raw'/('summary-'+g['schedule_game_id']+'.json')).exists() else None
 w=g.get('kickoff_weather')
 if w:
  check(w['provider']=='National Weather Service' and w['kickoff']==g['kickoff_et'] and date(w['forecast_period_start'])<=date(g['kickoff_et'])<date(w['forecast_period_end']),'weather time/provider '+g['game_id'])
  check(w['stadium']==g['venue'] and w['forecast_resolution']=='hourly' and w['source_url'].startswith('https://api.weather.gov/'),'weather venue/resolution '+g['game_id'])
  if w.get('roof_status')=='unknown':check(w['indoor'] is not True,'unknown roof not indoor '+g['game_id'])
check(sum(g.get('kickoff_weather') is not None for g in W7)==12,'12 covering NWS forecasts;2 explicit gaps')
# Derived team records independently from scores/results.
T=cand('wto-team-betting-2026')['teams'];check(len(T)==32,'all32 teams rebuilt')
for t,v in T.items():
 rows=[g for g in finals if t in [g['away'],g['home']]];own=lambda g:g['away_score'] if t==g['away'] else g['home_score'];opp=lambda g:g['home_score'] if t==g['away'] else g['away_score']
 check(v['straight_up']=={'wins':sum(own(g)>opp(g) for g in rows),'losses':sum(own(g)<opp(g) for g in rows),'ties':sum(own(g)==opp(g) for g in rows)},'SU team '+t)
 check(v['points_for']==sum(map(own,rows)) and v['points_against']==sum(map(opp,rows)) and len(v['games'])==len(rows),'scores/history '+t)
 for field,subset in [('ats',rows),('home_ats',[g for g in rows if g['home']==t]),('away_ats',[g for g in rows if g['away']==t]),('favorite_ats',[g for g in rows if (g.get('closing_favorite') or g.get('grading_favorite'))==t]),('underdog_ats',[g for g in rows if (g.get('closing_favorite') or g.get('grading_favorite')) not in [None,t]])]:
  check(v[field]=={'wins':sum(g['ats_winner']==t for g in subset),'losses':sum(g['ats_winner'] not in [None,'PUSH',t] for g in subset),'pushes':sum(g['ats_winner']=='PUSH' for g in subset)},field+' '+t)
 check(v['totals']=={'overs':sum(g['total_result']=='over' for g in rows),'unders':sum(g['total_result']=='under' for g in rows),'pushes':sum(g['total_result']=='push' for g in rows)},'O/U team '+t)
 for row in v['games']:
  g=games[row['game_id']];check(all(row.get(k)==g.get(k) for k in ['opening_favorite','opening_spread','opening_total','combined_points','total_result']),'team UI mapping '+t+g['game_id'])
# Append-only snapshot families.
for name,keys in [('wto-player-leaders-2026',['snapshots','conference_position_snapshots']),('wto-futures-2026',['snapshots'])]:
 n=cand(name);o=base(name)
 for k in keys:check(n[k][:len(o[k])]==o[k] and len(n[k])==len(o[k])+1,'immutable '+name+k)
P=cand('wto-player-leaders-2026')['conference_position_snapshots'][-1]
check(P['through_week']==6 and P['coverage']['verified_games']==93 and not P['coverage']['missing_games'] and not P['coverage']['missing_positions'],'complete player coverage')
F=cand('wto-futures-2026');FT=F['teams']
for scope,groups in P['scopes'].items():
 for pos,rows in groups.items():
  check(len(rows)==5 and len({r['player_id'] for r in rows})==5,'five unique '+scope+pos)
  metric=P['ranking_metrics'][pos];values=[r['stats'][metric] for r in rows];check(values==sorted(values,reverse=True),'rank metric '+scope+pos)
  for r in rows:
   st=r['stats'];check(r['position']==pos and FT[r['team']]['conference'] in scope,'position/conference '+r['player'])
   check(r['rank']==1+sum(v>st[metric] for v in values),'competition rank '+r['player'])
   if pos=='QB':check(st['completion_pct']==round(100*st['completions']/st['passingAttempts'],1),'completion percentage '+r['player'])
   if pos=='RB':check(st['yards_per_carry']==round(st['rushingYards']/st['rushingAttempts'],1),'YPC '+r['player'])
for m,v in F['snapshots'][-1]['markets'].items():
 ts=v['teams'];expected=32 if m=='super_bowl' else 16 if m in ['AFC','NFC'] else 4;check(len(ts)==expected,'futures coverage '+m)
 check(abs(sum(t['normalized_probability'] for t in ts.values())-100)<.0001,'normalized futures '+m)
for w in base('wto-game-insights-2026')['weeks']:
 check(w==next(x for x in cand('wto-game-insights-2026')['weeks'] if x['week']==w['week']),'immutable predictions week'+str(w['week']))
I=cand('wto-game-insights-2026')['weeks'][-1];check({g['game_id'] for g in I['games']}=={g['game_id'] for g in W7},'Week7 insight identity coverage')
for ig in I['games']:
 r=ig['revisions'][-1];g=games[ig['game_id']];check(r['independent_projection'] is None and r['revision_type']=='insufficient_evidence' and date(r['generated_at'])<date(g['kickoff_et']),'honest pregame unavailability '+g['game_id'])
 check(set(r['team_reads'])=={g['away'],g['home']},'shared both team reads '+g['game_id'])
tr=cand('wto-weekly-spread-tracker-2026');ot=base('wto-weekly-spread-tracker-2026')
check(tr['weeks'][:5]==ot['weeks'][:5],'immutable tracker earlier finalized weeks')
for w,o in zip(tr['weeks'],ot['weeks']):check(w['tuesday_snapshot']==o['tuesday_snapshot'],'immutable Tuesday week'+str(w['week']))
for w in tr['weeks']:
 if w['week']!=6:continue
 ts={g['game_id']:g for g in w['tuesday_snapshot']['games']}
 for row in w['following_tuesday_comparison']['games']:
  g=games[row['game_id']];q=ts[g['game_id']];f=q['favorite'];s=q['favorite_spread'];delta=(g['away_score']-g['home_score'] if g['away']==f else g['home_score']-g['away_score'])+s
  check(row['tuesday_side_result']==('push' if delta==0 else 'win' if delta>0 else 'loss'),'Tuesday grading '+g['game_id'])
  check(row['comparison_label']=='Last Verified' and row['closing_spread_movement_points'] is None,'fallback not closing '+g['game_id'])
# Frozen models and histories untouched; held artifacts do not become operative predictions.
held=read(S/'week7-projections.held.json');ex=read(S/'wto-ex-week7-20261020.held.json');frozen=base('wto-ex-week6-20261015')
check(ex['training_residuals']==frozen['training_residuals'] and len(ex['training_residuals'])==63,'frozen residual distribution unchanged')
check(len(held['games'])==14 and sum(r['projection'] is None for r in held['games'])==1,'neutral rule separately held')
report=read(S/'validation-report.json');report['validated_at']=datetime.datetime.now(datetime.timezone.utc).isoformat();report['publish_decision']='PUBLISH_VERIFIED_DATA_WITH_EXPLICIT_FORECAST_UNAVAILABLE_STATUS';report['validation_pending']=[];report['validation']={'passed':True,'assertions':len(checks),'families':['272 schedule identities','93 final score/winner/ATS/O-U calculations','32 independently recomputed team records','44 immutable verified openers;63 named-provider selections with legacy observations retained','market/weather/opening immutable prefixes','player/futures/tracker/prediction immutable histories','40 positional leaders:coverage,rank,scope,ratio checks','11 normalized futures markets','12 NWS kickoff-hour records;2 documented gaps','null unsupported numerical predictions and frozen63-residual distribution'],'checks':checks}
report['required_numerical_release_blockers']={'all_14_games':'Current availability, role/OL and material context verification incomplete; no approved personnel adjustment may be invented. Published statuses clearly show scores unavailable.','2026-W07-PIT-NO':'Actual Stade de France neutral venue is outside the approved hardcoded neutral-site rule. Formula change requires review.','effect':'Numerical Week7 projections and EX artifacts held outside live paths. Factual inputs and null-status records are authorized data maintenance; no unsupported numerical dependent outputs released.'}
report['model_review']='Week6 saved forecasts/EX evaluated only; no production/training/shadow promotion. No shadow candidate: agreement not evaluable.'
report['source_gap_note']='Closing market gaps remain null and Last Verified grading retained; opening timestamps null where unavailable. No new final scores required; Week6 highlights previously finalized and unchanged.'
report['changed_live_files']=[n+'.json' for n in ['ff26-nfl-lines-2026','wto-team-betting-2026','wto-game-insights-2026','wto-weekly-spread-tracker-2026','wto-futures-2026','wto-player-leaders-2026']]
report['unresolved_optional_fields'][1]='63 unverified legacy aggregate openers superseded by explicit named DraftKings openers; all original observations preserved. No incompatible-bookmaker movement inferred.'
json.dump(report,open(S/'validation-report.json','w'),indent=2);print(json.dumps({'passed':len(checks),'finals':93,'new_current_markets':14,'opener_coverage':107,'numeric_release':'HOLD','data_release':report['publish_decision']}))
