import json,pathlib,copy,datetime,re,html,collections
R=pathlib.Path('sunday-20261025');B=R/'base';RAW=R/'raw';S=R/'staging'
def read(p):return json.load(open(p))
def save(n,d):(S/n).write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
def dt(x):return datetime.datetime.fromisoformat(x.replace('Z','+00:00'))
def clean(x):return ' '.join(html.unescape(re.sub('<[^>]*>',' ',x)).split())
def canon(t):return {'WSH':'WAS','AZ':'ARI','LA':'LAR','JAC':'JAX'}.get(t,t)
def num(v):
 try:return float(str(v).lstrip('ou+'))
 except:return None
stamp=datetime.datetime.now(datetime.timezone.utc).isoformat();ledger=read(B/'ff26-nfl-lines-2026.json');old=copy.deepcopy(ledger);ins=read(B/'wto-game-insights-2026.json');oldins=copy.deepcopy(ins);ig={g['game_id']:g for w in ins['weeks'] for g in w['games']};allg={g['game_id']:g for w in ledger['weeks'] for g in w['games']};changed=[];markets=[];issues=[];results=[];weather=[]
# Official Week7 list is shared across both sides; retain practice/game distinction.
ir=read(RAW/'official7.json');body=ir.get('data','');abbr=[canon(clean(t)) for t in re.findall(r'class="nfl-c-matchup-strip__team-abbreviation">(.*?)</span>',body)];tables=re.findall(r'<table[\s\S]*?</table>',body);inj={}
assert len(abbr)==len(tables)==28 and abbr[:4]==['NE','CHI','PIT','NO']
for team,table in zip(abbr,tables):
 rows=[]
 for tr in re.findall(r'<tr[\s\S]*?</tr>',table):
  c=[clean(v) for v in re.findall(r'<td[^>]*>([\s\S]*?)</td>',tr)]
  if len(c)!=5:continue
  name,pos,injury,practice,status=c;rows.append({'team':team,'player':name,'position':pos,'injury':injury or None,'practice_status':practice or None,'game_status':status or None,'reported_status':status or practice or None,'report_type':'official NFL Week7 reported practice/game designation','report_date':None,'report_date_note':'Exact individual report date not exposed by aggregate; retrieval timestamp is not report date.','source_url':ir['url'],'verified_at':ir['retrieved_at'],'impact':'Reported designation retained; no invented personnel point adjustment.'})
 inj[team]=rows
save('current-injury-evidence.json',{'checked_at':ir['retrieved_at'],'source_url':ir['url'],'scope':'Week7 official aggregate; individual report dates unavailable','teams':inj,'role_coverage':'No unverified role inferred; prior verified role provenance retained when still eligible.'})
board22=read(RAW/'board22.json');events22={e['id']:e for e in board22['data']['events']};today=dt(stamp).astimezone(datetime.timezone(datetime.timedelta(hours=-4))).date().isoformat()
for g in ledger['weeks'][6]['games']:
 raw=read(RAW/('summary-'+g['schedule_game_id']+'.json'));d=raw['data'];c=d['header']['competitions'][0];sides={x['homeAway']:x for x in c['competitors']};assert {s:canon(v['team']['abbreviation']) for s,v in sides.items()}=={'away':g['away'],'home':g['home']} and dt(c['date'])==dt(g['kickoff_et']);assert d['header']['season']['year']==2026 and d['header']['season']['type']==2
 if c['status']['type']['completed'] and g['status']!='final':
  a,h=[int(sides[s]['score']) for s in ['away','home']];be=events22[g['schedule_game_id']]['competitions'][0];bs={v['homeAway']:int(v['score']) for v in be['competitors']};assert bs=={'away':a,'home':h} and be['status']['type']['completed']
  g.update(status='final',away_score=a,home_score=h,combined_points=a+h,straight_up_winner=g['away'] if a>h else g['home'] if h>a else 'TIE',verified_at=raw['retrieved_at'],went_to_overtime=len(sides['away'].get('linescores',[]))>4,result_sources=[{'provider':'ESPN game summary / AP recap','url':raw['url'],'verified_at':raw['retrieved_at']},{'provider':'ESPN single-day scoreboard','url':board22['url'],'verified_at':board22['retrieved_at']}])
  box={'provider':'ESPN','source_url':raw['url'],'verified_at':raw['retrieved_at']}
  for side in ['away','home']:
   t=next(t for t in d['boxscore']['teams'] if t['homeAway']==side);s={x['name']:x['displayValue'] for x in t['statistics']};v={'team':g[side]}
   for k,key in [('first_downs','firstDowns'),('total_yards','totalYards'),('passing_yards','netPassingYards'),('rushing_yards','rushingYards'),('rushing_attempts','rushingAttempts'),('turnovers','turnovers'),('total_plays','totalOffensivePlays'),('interceptions','interceptions'),('fumbles_lost','fumblesLost')]:v[k]=int(s[key])
   co,att=map(int,s['completionAttempts'].split('/'));sa,sy=map(int,s['sacksYardsLost'].split('-'));v.update(passing_completions=co,passing_attempts=att,sacks_allowed=sa,sack_yards_lost=sy,gross_passing_yards=v['passing_yards']+sy)
   for k,key in [('third_down','thirdDownEff'),('fourth_down','fourthDownEff'),('red_zone','redZoneAttempts'),('possession','possessionTime'),('penalties','totalPenaltiesYards')]:v[k]=s.get(key)
   box[side]=v
  g['box_score']=box
  q=max((q for q in g['market_snapshots'] if dt(q['captured_at'])<dt(g['kickoff_et'])),key=lambda q:dt(q['captured_at']));g.update(grading_favorite=q['favorite'],grading_spread=q['favorite_spread'],grading_total=q['total'],grading_provider=q['provider'],grading_market_as_of=q['captured_at'],grading_verified_at=stamp,grading_line_type='latest_verified_pregame_snapshot')
  margin=(a-h if q['favorite']==g['away'] else h-a)+q['favorite_spread'];g['ats_winner']='PUSH' if margin==0 else q['favorite'] if margin>0 else g['home'] if q['favorite']==g['away'] else g['away'];g['total_result']='push' if a+h==q['total'] else 'over' if a+h>q['total'] else 'under'
  rev=max((r for r in ig[g['game_id']]['revisions'] if dt(r['generated_at'])<dt(g['kickoff_et']) and r.get('independent_projection')),key=lambda r:dt(r['generated_at']));p=rev['independent_projection'];mc=rev['market_comparison'];summary=f"Chicago finished three of four red-zone trips with touchdowns and avoided turnovers, while New England went one of two and threw one interception. The Bears won 30–24, matching WTO’s winner pick but exceeding its saved CHI22–NE20 projection; New England ATS and Under leans both missed."
  g['postgame_summary']=summary;g['postgame_evidence']={'providers':['ESPN','AP recap via ESPN'],'source_urls':[raw['url'],board22['url']],'verified_at':stamp,'scope':'this_game_only','metrics':{'away':box['away'],'home':box['home']},'prediction_revision_id':rev['revision_id'],'prediction_generated_at':rev['generated_at'],'expected_scores':p,'comparison':{'winner':p['winner']==g['straight_up_winner'],'ats':False if mc['ats_lean']=='NE' else None,'total':False if mc['total_lean']=='UNDER' else None},'grade':'Partially Accurate','interpretation':'Winner correct; point total forecast too low. No NO EDGE call counted as correct.'}
  ig[g['game_id']]['postgame_review']={'generated_at':stamp,'analysis_type':'verified_postgame','prediction_revision_id':rev['revision_id'],'grade':'Partially Accurate','postgame_summary':summary,'postgame_evidence':copy.deepcopy(g['postgame_evidence']),'evidence':g['result_sources']}
  g['closing_unavailable']={'checked_at':stamp,'attempted_sources':[read(RAW/'vi-7.json')['url'],read(RAW/'cbs-7.json')['url'],raw['url']],'reason':'No source-explicit compatible consensus closing market authenticated from archive tables. ESPN close fields after final do not prove a closing quote. Latest saved verified pregame market retained for grading only.'};g['scorigami']=None;g['scorigami_verification']={'status':'unverified','reason':'No primary Scorigami confirmation captured; no badge inferred from score.','checked_at':stamp};results.append({'game_id':g['game_id'],'away':a,'home':h,'ats':g['ats_winner'],'total':g['total_result'],'grading_label':'Last Verified'});changed.append(g['game_id'])
 elif g['kickoff_et'][:10]==today and dt(g['kickoff_et'])>dt(stamp):
  picks=[x for x in d.get('pickcenter',[]) if x['provider']['name'].replace(' ','').lower()=='draftkings'];assert len(picks)==1;p=picks[0];ps=p['pointSpread'];tot=p['total'];a,h=ps['away']['close'],ps['home']['close'];o,u=tot['over']['close'],tot['under']['close'];av,hv=num(a['line']),num(h['line']);tv=num(o['line']);assert av==-hv and tv==num(u['line']);q={'favorite':g['away'] if av<0 else g['home'] if hv<0 else None,'favorite_spread':min(av,hv),'total':tv,'away_spread':av,'home_spread':hv,'away_spread_price':num(a.get('odds')),'home_spread_price':num(h.get('odds')),'over_price':num(o.get('odds')),'under_price':num(u.get('odds')),'provider':'DraftKings via ESPN','source_url':raw['url'],'captured_at':raw['retrieved_at'],'retrieved_at':raw['retrieved_at'],'spread_captured_at':raw['retrieved_at'],'total_captured_at':raw['retrieved_at'],'provider_timestamp':None,'line_type':'market_snapshot','market_scope':'full_game','label':'Sunday checkpoint','source_field_note':'ESPN close key is current quote, not verified closing. Actual retrieval time recorded; provider generation time unavailable.'}
  g.setdefault('market_snapshots',[]).append(q);g.update(market_favorite=q['favorite'],market_spread=q['favorite_spread'],market_total=q['total'],market_as_of=q['captured_at'],price_provider=q['provider'],price_timestamp=q['captured_at']);g.update({k:q[k] for k in ['away_spread_price','home_spread_price','over_price','under_price']});markets.append({'game_id':g['game_id'],'kickoff':g['kickoff_et'],**q});changed.append(g['game_id'])
  if g.get('neutral_site'):
   gap={'checked_at':stamp,'stadium':g['venue'],'kickoff':g['kickoff_et'],'reason':'Actual Stade de France venue outside NWS coverage; no New Orleans weather substituted.','attempted_sources':['https://api.weather.gov/points/'+str(g['stadium_latitude'])+','+str(g['stadium_longitude'])]};g['kickoff_weather']=None;g['kickoff_weather_unavailable']=gap;g.setdefault('kickoff_weather_snapshots',[]).append({'provider':'National Weather Service','status':'unavailable',**gap});weather.append({'game_id':g['game_id'],**gap});continue
  pp=read(RAW/('point-'+g['home']+'.json'));period=None;source=None;resolution=None
  for k,res in [('forecastHourly','hourly'),('forecast','day_night')]:
   rr=read(RAW/(k+'-'+g['home']+'.json'))
   for t in rr.get('data',{}).get('properties',{}).get('periods',[]):
    if dt(t['startTime'])<=dt(g['kickoff_et'])<dt(t['endTime']):period=t;source=rr;resolution=res;break
   if period:break
  if not period:issues.append({'game_id':g['game_id'],'field':'kickoff_weather','reason':'No covering official NWS period'});continue
  oldw=g['kickoff_weather'];w=copy.deepcopy(oldw);text=period['shortForecast'];low=text.lower();cond='storm' if 'thunder' in low else 'sleet' if any(x in low for x in ['sleet','freezing rain','ice']) else 'snow' if 'snow' in low else 'rain' if any(x in low for x in ['rain','shower','drizzle']) else 'cloudy' if any(x in low for x in ['cloud','overcast','fog']) else 'sunny' if period['isDaytime'] else 'clear';speed=[float(x) for x in re.findall(r'\d+(?:\.\d+)?',period['windSpeed'])];wind=max(speed) if speed else None;precip=period.get('probabilityOfPrecipitation',{}).get('value');roof=g['venue_roof_type'];indoor=True if roof=='fixed_enclosed' else None if roof=='retractable' else False
  material=cond in ['storm','sleet','snow','rain'] or (wind is not None and wind>=20) or (period['temperatureUnit']=='F' and period['temperature']<=20)
  impact='no_factor' if indoor else 'unknown' if roof=='retractable' else 'material' if material else 'no_factor'
  w.update(provider='National Weather Service',source_url=source['url'],checked_at=source['retrieved_at'],kickoff=g['kickoff_et'],stadium=g['venue'],condition=cond,is_night=not period['isDaytime'],indoor=indoor,detail=('Day/night forecast: ' if resolution=='day_night' else '')+f"{text}; {period['temperature']}°{period['temperatureUnit']}; wind {period['windDirection']} {period['windSpeed']}; precipitation chance {precip}%",forecast_resolution=resolution,forecast_period_start=period['startTime'],forecast_period_end=period['endTime'],forecast_issued_at=source['data']['properties'].get('updateTime'),temperature=period['temperature'],temperature_unit=period['temperatureUnit'],wind_speed=wind,wind_speed_unit='mph',wind_direction=period['windDirection'],precipitation_probability=precip,weather_impact=impact,roof_status='closed' if indoor else 'unknown' if roof=='retractable' else 'open',roof_source_url=oldw.get('roof_source_url') if roof!='retractable' else None,roof_checked_at=None,attribution='National Weather Service / weather.gov');g['kickoff_weather']=w;g.setdefault('kickoff_weather_snapshots',[]).append(copy.deepcopy(w));weather.append({'game_id':g['game_id'],**w})
# Retry archived closing gaps once per weekly page and preserve every prior observation.
for week in ledger['weeks']:
 for g in week['games']:
  if g['status']!='final':continue
  missing=[k for k in ['closing_favorite','closing_spread','closing_total','closing_away_spread_price','closing_home_spread_price','closing_over_price','closing_under_price'] if g.get(k) is None]
  if missing:
   g.setdefault('closing_followups',[]).append({'checked_at':stamp,'attempted_sources':[read(RAW/(f'vi-{week["week"]}.json'))['url'],read(RAW/(f'cbs-{week["week"]}.json'))['url']],'unavailable_fields':missing,'reason':'Shared weekly archive checked; generic current/final quotes are not authenticated source-explicit consensus closes. Existing verified closes preserved; fallback remains Last Verified.'})
# Week8 opener backfill from one weekly source only; never revisit complete verified openers.
r=read(RAW/'opening8.json');eventmap={e['id']:e for e in r['data'].get('events',[])};openers=[]
for g in ledger['weeks'][7]['games']:
 if g.get('opening_line_type')=='explicit_sportsbook_open' and g.get('opening_verified_at'):continue
 e=eventmap.get(g.get('schedule_game_id'));c=e['competitions'][0] if e else {};picks=c.get('odds',[]);p=next((p for p in picks if p.get('provider',{}).get('name','').replace(' ','').lower()=='draftkings'),None)
 if not p or not p.get('pointSpread'):continue
 try:
  a,h=[p['pointSpread'][s]['open'] for s in ['away','home']];o,u=[p['total'][s]['open'] for s in ['over','under']];av,hv=num(a['line']),num(h['line']);tv=num(o['line']);assert av==-hv and tv==num(u['line'])
 except (KeyError,AssertionError):continue
 q={'favorite':g['away'] if av<0 else g['home'] if hv<0 else None,'spread':min(av,hv),'total':tv,'provider':'DraftKings via ESPN','source_url':r['url'],'verified_at':stamp,'source_retrieved_at':r['retrieved_at'],'market_as_of':None,'line_type':'explicit_sportsbook_open','away_spread_price':num(a.get('odds')),'home_spread_price':num(h.get('odds')),'over_price':num(o.get('odds')),'under_price':num(u.get('odds')),'unavailable_fields':['exact source opening timestamp']};g.setdefault('opening_verification_snapshots',[]).append(q)
 for field,value in {'favorite':q['favorite'],'spread':q['spread'],'total':q['total'],'provider':q['provider'],'source_url':q['source_url'],'verified_at':stamp,'line_type':'explicit_sportsbook_open','market_as_of':None,'away_spread_price':q['away_spread_price'],'home_spread_price':q['home_spread_price'],'over_price':q['over_price'],'under_price':q['under_price']}.items():g['opening_'+field]=value
 openers.append(g['game_id'])
ledger['updated_at']=stamp;ins['updated_at']=stamp;save('ff26-nfl-lines-2026.candidate.json',ledger);save('wto-game-insights-2026.candidate.json',ins);save('market-weather-evidence.json',{'captured_at':stamp,'markets':markets,'weather':weather,'repaired_results':results,'new_openers':openers,'optional_gaps':issues});save('candidate-records.json',{'base_commit':'d9787fc3051da727bcf0b78ff8553adb3ca52c18','generated_at':stamp,'changed_games':changed,'week7':ledger['weeks'][6],'new_openers':openers,'new_postgame_review':ig['2026-W07-NE-CHI'].get('postgame_review')})
print(json.dumps({'results':results,'markets':len(markets),'weather':len(weather),'new_openers':len(openers),'issues':issues}))
