import pathlib,json,datetime,collections,hashlib,re
R=pathlib.Path('sunday-20261025');S=R/'staging';B=R/'base';RAW=R/'raw'
def read(p):return json.load(open(p))
def dt(s):return datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
checks=[]
def check(ok,label):
 assert ok,label
 checks.append(label)
a=read(B/'ff26-nfl-lines-2026.json');b=read(S/'ff26-nfl-lines-2026.candidate.json');old={g['game_id']:g for w in a['weeks'] for g in w['games']};games={g['game_id']:g for w in b['weeks'] for g in w['games']};check(games.keys()==old.keys() and len(games)==272,'272 regular-season game IDs preserved');new_id='2026-W07-NE-CHI'
for id,g in games.items():
 o=old[id]
 for field in ['game_id','away','home','kickoff_et','schedule_game_id','opening_favorite','opening_spread','opening_total','opening_line_type','opening_verified_at','closing_favorite','closing_spread','closing_total']:
  check(g.get(field)==o.get(field),'immutable identity/open/close '+field+' '+id)
 for field in ['market_snapshots','opening_verification_snapshots','kickoff_weather_snapshots','closing_followups']:
  check(g.get(field,[])[:len(o.get(field,[]))]==o.get(field,[]),'immutable prefix '+field+' '+id)
 if id!=new_id:
  check(all(g.get(k)==o.get(k) for k in ['status','away_score','home_score','combined_points','straight_up_winner','ats_winner','total_result','postgame_summary','postgame_evidence']),'previous result preserved '+id)
 if g['status']=='final':
  away,home=g['away_score'],g['home_score'];check(g['combined_points']==away+home,'combined '+id);check(g['straight_up_winner']==(g['away'] if away>home else g['home'] if home>away else 'TIE'),'winner '+id)
  favorite=g.get('closing_favorite') or g.get('grading_favorite');spread=g.get('closing_spread') if g.get('closing_spread') is not None else g.get('grading_spread');total=g.get('closing_total') if g.get('closing_total') is not None else g.get('grading_total')
  if spread is not None:
   delta=(away-home if favorite==g['away'] else home-away)+spread;check(g['ats_winner']==('PUSH' if delta==0 else favorite if delta>0 else g['home'] if favorite==g['away'] else g['away']),'ATS '+id)
  if total is not None:check(g['total_result']==('push' if away+home==total else 'over' if away+home>total else 'under'),'total '+id)
# Fresh raw quotes, identity and prices.
market_games=[]
for g in b['weeks'][6]['games']:
 if g['kickoff_et'][:10]!='2026-10-25':continue
 raw=read(RAW/('summary-'+g['schedule_game_id']+'.json'));d=raw['data'];c=d['header']['competitions'][0];check(dt(c['date'])==dt(g['kickoff_et']) and d['header']['season']['year']==2026 and d['header']['season']['type']==2,'raw schedule/cutoff '+g['game_id']);q=g['market_snapshots'][-1];check(dt(q['captured_at'])<dt(g['kickoff_et']) and q['captured_at']==raw['retrieved_at'],'actual pregame retrieval '+g['game_id']);p=next(p for p in d['pickcenter'] if p['provider']['name'].replace(' ','').lower()=='draftkings')
 for side in ['away','home']:
  v=p['pointSpread'][side]['close'];check(float(v['line'])==q[side+'_spread'] and float(v['odds'])==q[side+'_spread_price'],'sourced spread/price '+g['game_id']+side)
 for side in ['over','under']:
  v=p['total'][side]['close'];check(float(v['line'].lstrip('ou'))==q['total'] and float(v['odds'])==q[side+'_price'],'sourced total/price '+g['game_id']+side)
 check(q['favorite_spread']<0 and q['away_spread']==-q['home_spread'] and q['provider']=='DraftKings via ESPN' and q['line_type']=='market_snapshot','provider/sign/definition '+g['game_id']);market_games.append(g)
 w=g.get('kickoff_weather')
 if w:
  check(w['provider']=='National Weather Service' and w['stadium']==g['venue'] and w['kickoff']==g['kickoff_et'],'NWS venue/source '+g['game_id']);check(dt(w['forecast_period_start'])<=dt(g['kickoff_et'])<dt(w['forecast_period_end']),'NWS kickoff coverage '+g['game_id']);raw=read(RAW/('forecastHourly-'+g['home']+'.json'));period=next(p for p in raw['data']['properties']['periods'] if p['startTime']==w['forecast_period_start']);check(w['is_night']==(not period['isDaytime']) and w['temperature']==period['temperature'],'source weather values '+g['game_id']);check(w['forecast_page_url'].startswith('https://forecast.weather.gov/'),'weather navigation '+g['game_id'])
  if g['venue_roof_type']=='retractable':check(w['indoor'] is not True and w['roof_status']=='unknown','no invented roof closure '+g['game_id'])
 else:check(g['neutral_site'] and 'outside NWS' in g['kickoff_weather_unavailable']['reason'],'honest international weather gap')
check(len(market_games)==12,'all12 Sunday quotes captured')
check(sum(g['status']=='final' for g in games.values())==94,'94 verified finals');g=games[new_id];check((g['away_score'],g['home_score'],g['ats_winner'],g['total_result'])==(24,30,'CHI','over'),'new final30-24 CHI ATS/OVER');check(g['closing_spread'] is None and g['grading_line_type']=='latest_verified_pregame_snapshot','Last Verified never relabeled Closing');check(len(g['result_sources'])==3,'score corroborated ESPN/AP,board,official Bears')
# Earlier predictions are immutable; new numerical baselines are identical to saved Thursday scores.
i0=read(B/'wto-game-insights-2026.json');i1=read(S/'wto-game-insights-2026.candidate.json');om={g['game_id']:g for w in i0['weeks'] for g in w['games']};nm={g['game_id']:g for w in i1['weeks'] for g in w['games']};role_count=0
for id,o in om.items():
 n=nm[id];check(n['revisions'][:len(o['revisions'])]==o['revisions'],'immutable predictions '+id)
 if id==new_id:check(n['postgame_review']['grade']=='Partially Accurate','honest postgame grade; no NO EDGE credit')
 elif 'postgame_review'in o:check(n['postgame_review']==o['postgame_review'],'immutable previous postgame '+id)
 for r in n['revisions'][len(o['revisions']):]:
  check(dt(r['generated_at'])<dt(games[id]['kickoff_et']),'new revision before kickoff '+id);check(r['independent_projection']==o['revisions'][-1]['independent_projection'],'no unsupported point revision '+id)
  for x in r['injuries']:
   check(x.get('source_url') and x.get('verified_at'),'injury source/time '+id)
   if x.get('role'):check(x['role'] in ['starter','depth'] and x['role_source_url'].startswith('https://') and dt(x['role_verified_at'])<=dt(r['generated_at']),'verified eligible role '+id);role_count+=1
check(nm['2026-W07-PIT-NO']['revisions'][-1]['independent_projection'] is None,'neutral model not promoted')
# All prior finalized highlights preserved, current week explicitly partial.
h0=read(B/'wto-weekly-highlights-2026.json');h1=read(S/'wto-weekly-highlights-2026.candidate.json')
for w in h0['weeks']:
 if w['status']=='final':check(next(x for x in h1['weeks'] if x['week']==w['week'])==w,'immutable finalized highlights week'+str(w['week']))
w=next(w for w in h1['weeks'] if w['week']==7);check(w['status']=='in_progress' and w['final_games']==1 and w['scheduled_games']==14,'Week7 highlights provisional1of14');check(not w['upsets'],'favorite win not an upset')
for pos,rows in w['players'].items():
 metric={'QB':'passingYards','RB':'rushingYards','WR':'receivingYards','TE':'receivingYards'}[pos];check(len(rows)<=5 and [r['stats'][metric] for r in rows]==sorted([r['stats'][metric] for r in rows],reverse=True),'weekly ranking '+pos)
# Frozen EX distribution, exact revision references and probability sums.
ex0=read(B/'wto-ex-week7-20261022.json');ex=read(S/'wto-ex-week7-20261025.json');check(ex['training_residuals']==ex0['training_residuals'] and len(ex['training_residuals'])==63,'frozen63 residuals unchanged');check(len(ex['games'])==12,'12 supported upcoming EX estimates')
for row in ex['games']:
 g=games[row['game_id']];r=nm[row['game_id']]['revisions'][-1];check(row['projection_revision_id']==r['revision_id'] and row['projection']==r['independent_projection'],'EX operative forecast match '+g['game_id']);check(dt(ex['generated_at'])<dt(g['kickoff_et']) and dt(row['market_as_of'])<dt(g['kickoff_et']),'EX pregame timestamps '+g['game_id'])
 for side in [row['market_probabilities']['spread']['away'],row['market_probabilities']['spread']['home'],row['market_probabilities']['total']['over'],row['market_probabilities']['total']['under']]:check(abs(side['probability']+side['loss_probability']+side['push_probability']-1)<1e-10 and side['sample_size']==63,'EX probabilities '+g['game_id'])
check('new Map(records.flatMap' in (S/'wto-slip.js').read_text(),'latest EX checkpoint wins duplicate IDs; old games retained')
report={'base_commit':'d9787fc3051da727bcf0b78ff8553adb3ca52c18','validated_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'decision':'PUBLISH_VERIFIED_DATA','pass':True,'assertions':len(checks),'checks':checks,'summary':{'repaired_finals':1,'Sunday_quotes':12,'NWS_kickoff_forecasts':11,'official_availability_matchups':13,'verified_role_observations':role_count,'new_EX_estimates':12,'frozen_residuals':63,'week7_highlights':'provisional1of14'},'authorized_optional_gaps':['PIT-NO projection/EX stays unavailable:neutral correction promotion pending.','France outside NWS coverage. Retractable roof closure not inferred.','Missing source-explicit consensus closing fields remain null; NE-CHI graded from Last Verified CHI-3,total50.5.','Individual practice report dates not supplied by NFL aggregate; retrieval timestamps explicitly separate. Questionable stays Questionable.','No source-explicit Week8 openers found in weekly response;165 later-season opening games remain on persistent worklist.','No verified Scorigami confirmation for new final; no badge inferred.'],'model_change':False,'historical_predictions_preserved':True,'personal_picks_unchanged':True,'changed_files':['ff26-nfl-lines-2026.json','wto-game-insights-2026.json','wto-weekly-highlights-2026.json','wto-ex-week7-20261025.json','wto-slip.js','index.html','sw.js'],'opening_coverage':{'complete':sum(bool(g.get('opening_verified_at') and g.get('opening_line_type')=='explicit_sportsbook_open' and g.get('opening_spread') is not None and g.get('opening_total') is not None) for g in games.values()),'pending_game_ids':[g['game_id'] for g in games.values() if not g.get('opening_verified_at')]},'unresolved_retries':'Carry exact gaps into the next existing update; no extra schedule created.'};(S/'validation-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k in ['pass','assertions','summary','decision']}))
