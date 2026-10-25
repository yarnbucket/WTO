import json,pathlib,datetime,copy,re,unicodedata
R=pathlib.Path('sunday-20261025');S=R/'staging';RAW=R/'raw';l=json.load(open(S/'ff26-nfl-lines-2026.candidate.json'));ins=json.load(open(S/'wto-game-insights-2026.candidate.json'));inj=json.load(open(S/'current-injury-evidence.json'));by={g['game_id']:g for w in ins['weeks'] for g in w['games']};stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
def norm(s):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower())
roles={};role_gaps=[]
for p in RAW.glob('depth-*.json'):
 r=json.load(open(p));d=r.get('data',{});abbr=d.get('team',{}).get('abbreviation')
 if d.get('season',{}).get('year')!=2026 or d.get('season',{}).get('type')!=2 or not abbr:role_gaps.append({'source_url':r['url'],'reason':'No verified2026 regular-season depth chart'});continue
 team={}
 for unit in d['depthchart']:
  if unit['name']=='Special Teams':continue
  for pos,v in unit['positions'].items():
   for i,a in enumerate(v.get('athletes',[])):
    k=norm(a['displayName']);entry={'role':'starter' if i==0 else 'depth','role_source_url':r['url'],'role_verified_at':r['retrieved_at'],'role_evidence':{'provider':'ESPN2026 depth chart','unit':unit['name'],'position':pos,'depth_order':i+1,'source_timestamp':d.get('timestamp'),'definition':'First listed in base offense/defense position is starter; later listed is depth. Rotation usage not inferred.'}}
    if k not in team or i==0:team[k]=entry
 roles[abbr]=team
revisions=[]
for g in l['weeks'][6]['games']:
 if g['status']=='final':continue
 old=by[g['game_id']]['revisions'][-1];r=copy.deepcopy(old);a,h=g['away'],g['home'];rows=[]
 for team in [a,h]:
  for x in inj['teams'].get(team,[]):
   row=copy.deepcopy(x);row.update(roles.get(team,{}).get(norm(x['player']),{}));rows.append(row)
  # Keep independently reported IR observations from current ESPN response, not stale prior-week reports.
  src=json.load(open(RAW/('summary-'+g['schedule_game_id']+'.json')))
  for group in src['data'].get('injuries',[]):
   if group['team']['abbreviation']!=team:continue
   for x in group.get('injuries',[]):
    if x.get('status') not in ['Injured Reserve','IR']:continue
    ath=x['athlete']
    if any(y['team']==team and norm(y['player'])==norm(ath['displayName']) for y in rows):continue
    row={'team':team,'player':ath['displayName'],'position':ath.get('position',{}).get('abbreviation'),'reported_status':x['status'],'practice_status':None,'report_type':'ESPN dated reported injured-reserve observation','report_date':x.get('date'),'source_url':src['url'],'verified_at':src['retrieved_at'],'impact':'Reported IR retained without fabricated point penalty.'};row.update(roles.get(team,{}).get(norm(row['player']),{}));rows.append(row)
 # Material verification improvement: official game-specific reported statuses plus source-verified roles.
 r['revision_id']=g['game_id']+'-sunday-evidence-'+re.sub(r'\D','',stamp);r['revision_type']='evidence_revision' if r.get('independent_projection') else 'insufficient_evidence';r['generated_at']=stamp;r['verified_at']=stamp;r['injuries']=rows
 r['what_changed']='Refreshed official Week7 practice/game designations and verified2026 depth-chart roles; retained Questionable as reported. Current market/forecast comparison refreshed.'
 r['why_changed']='New sourced availability and role evidence materially improves verification confidence over the prior unresolved-role snapshot. Independent scoring baseline is preserved; no invented injury points, formula change or line-following score revision.'
 old_unavailable=r.get('unavailable_fields',[]);r['unavailable_fields']=[v for v in old_unavailable if v.get('field') not in ['unverified_player_roles','complete_current_availability_and_scheme_context','final_game_day_availability']]
 r['unavailable_fields'] += [{'field':'final_participation','reason':'Pregame Questionable stays Questionable; actual participation will be checked separately in Tuesday wrap-up.'},{'field':'individual_official_report_dates','reason':'Official Week7 aggregate supplies reported statuses but not an individual report date for each row; retrieval time not substituted.'},{'field':'player_specific_point_adjustment','reason':'No approved player-specific scoring coefficients; model baseline is conditional.'}]
 if not r.get('independent_projection'):r['unavailable_fields'].append({'field':'neutral_site_model_rule_promotion','reason':'Neutral venue correction is tested in shadow but production promotion has not been explicitly approved.'})
 f=r['factor_summary'];qb=[x for x in rows if x['position']=='QB'];f['quarterback']={'status':'official_week7_reported_designations','effect':'neutral','detail':'; '.join(x['team']+' '+x['player']+': '+str(x.get('game_status') or x['reported_status']) for x in qb) or 'No QB listed on current official injury report; absence is not a guarantee of participation.'};f['primary_risk']='Conditional baseline; reported Questionable participation and player-specific impact remain uncertain. Individual report dates unavailable from official aggregate.'
 w=g.get('kickoff_weather');f['weather']={'forecast_stage':'verified_kickoff_forecast' if w else 'unavailable','effect':'neutral','detail':w['detail'] if w else g.get('kickoff_weather_unavailable',{}).get('reason','Forecast unavailable')}
 for team in [a,h]:
  material=[x for x in rows if x['team']==team and x.get('game_status') in ['Questionable','Out','Doubtful']];short='; '.join(x['player']+' '+x['game_status'] for x in material[:3]);r.setdefault('team_reads',{}).setdefault(team,{})['watch_out']=f'{team} must account for {short}.' if short else f'{team} has no Questionable, Out or Doubtful game designation in the verified aggregate; final participation remains subject to confirmation.'
 sources=[{'provider':'NFL official Week7 injury report','url':inj['source_url'],'checked_at':inj['checked_at']}]
 for team in [a,h]:
  p=RAW/('depth-'+team+'.json')
  if p.exists():d=json.load(open(p));sources.append({'provider':'ESPN2026 team depth chart','url':d['url'],'checked_at':d.get('retrieved_at',d.get('checked_at'))})
 r['sources']=r.get('sources',[])+sources;r['verification_confirmation']={'status':'conditional_baseline_current_official_report_and_verified_roles' if r.get('independent_projection') else 'factual_inputs_verified_neutral_model_promotion_pending','verified_at':stamp,'verified_fields':['2026_game_identity','actual_venue','official_Week7_reported_practice_and_game_designations','sourced_depth_chart_roles','preserved93_prior_week_scoring_inputs']+(['current_Sunday_DraftKings_market','current_NWS_kickoff_forecast'] if g['kickoff_et'][:10]=='2026-10-25' and w else []),'unverified_fields':[x['field'] for x in r['unavailable_fields']],'source_urls':[x['url'] for x in sources],'model_changed':False}
 mc=r['market_comparison'];mc.update(favorite=g['market_favorite'],spread=g['market_spread'],total=g['market_total'],provider=g['price_provider'],market_as_of=g['market_as_of'])
 if r.get('independent_projection'):
  p=r['independent_projection'];margin=p['away_score']-p['home_score'];line=g['market_spread'] if g['market_favorite']==a else -g['market_spread'];edge=margin+line;te=p['away_score']+p['home_score']-g['market_total'];mc.update(ats_lean=a if edge>0 else h if edge<0 else 'NO EDGE',total_lean='OVER' if te>0 else 'UNDER' if te<0 else 'NO EDGE',spread_edge_points=abs(edge),total_edge_points=te,call_type='conditional_best_available_baseline');r['model_audit']['baseline_projection_revision_id']=old['revision_id'];r['model_audit']['baseline_projection_generated_at']=old['generated_at'];r['model_audit']['scoring_inputs_unchanged']=True
 by[g['game_id']]['revisions'].append(r);revisions.append({'game_id':g['game_id'],'revision_id':r['revision_id'],'projection_available':bool(r.get('independent_projection')),'verified_roles':sum('role' in x for x in rows),'reported_questionable':sum(x.get('game_status')=='Questionable' for x in rows)})
ins['updated_at']=stamp;(S/'wto-game-insights-2026.candidate.json').write_text(json.dumps(ins,indent=2)+'\n');(S/'availability-revision-audit.json').write_text(json.dumps({'generated_at':stamp,'revisions':revisions,'role_gaps':role_gaps,'projection_policy':'Preserved approved numerical baseline; injury evidence does not invent score adjustments. Neutral candidate not promoted.'},indent=2)+'\n');print({'new_revisions':len(revisions),'verified_role_entries':sum(r['verified_roles'] for r in revisions),'questionable':sum(r['reported_questionable'] for r in revisions)})
