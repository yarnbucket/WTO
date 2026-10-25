import pathlib,json,collections,datetime,copy
R=pathlib.Path('sunday-20261025');S=R/'staging';raw=json.load(open(R/'raw/summary-401873010.json'));x=raw['data'];old=json.load(open(R/'base/wto-weekly-highlights-2026.json'));new=copy.deepcopy(old);pos={};urls={}
for p in list(pathlib.Path('top20-raw').glob('roster-*.json'))+list(pathlib.Path('top20-raw').glob('athlete-*.json')):
 r=json.load(open(p));a=r['data'];rows=[v for group in a['athletes'] for v in group['items']] if 'athletes' in a else [a]
 for v in rows:pos[str(v['id'])]=v.get('position',{}).get('abbreviation');urls[str(v['id'])]=r['url']
candidates=collections.defaultdict(list);missing=[]
for side in x['boxscore']['players']:
 team=side['team']['abbreviation']
 for cat in side['statistics']:
  category=cat['name'];fields={'passing':['passingYards','passingTouchdowns','interceptions'],'rushing':['rushingAttempts','rushingYards','rushingTouchdowns'],'receiving':['receptions','receivingYards','receivingTouchdowns']}.get(category)
  if not fields:continue
  sums=collections.Counter()
  for row in cat['athletes']:
   a=row['athlete'];id=str(a['id']);p=pos.get(id);vals=dict(zip(cat['keys'],row['stats']));stats={k:int(vals[k].replace(',','')) for k in fields};sums.update(stats)
   if not p:missing.append({'player':a['displayName'],'id':id});continue
   if {'QB':'passing','RB':'rushing','WR':'receiving','TE':'receiving'}.get(p)!=category:continue
   if p=='RB':stats['yards_per_carry']=round(stats['rushingYards']/stats['rushingAttempts'],1) if stats['rushingAttempts'] else None
   candidates[p].append({'player_id':id,'player':a['displayName'],'position':p,'team':team,'game_id':'2026-W07-NE-CHI','stats':stats,'source_url':raw['url'],'verified_at':raw['retrieved_at'],'position_evidence':{'source_url':urls[id]},'market_independent':True})
  if category in ['rushing','receiving']:
   totals=dict(zip(cat['keys'],cat['totals']));assert all(sums[k]==int(totals[k].replace(',','')) for k in fields)
assert not missing,missing
groups={}
for p in ['QB','RB','WR','TE']:
 metric={'QB':'passingYards','RB':'rushingYards','WR':'receivingYards','TE':'receivingYards'}[p];pool=sorted(candidates[p],key=lambda r:(-r['stats'][metric],r['player']))
 for r in pool:r['rank']=1+sum(x['stats'][metric]>r['stats'][metric] for x in pool)
 groups[p]=pool[:5]
stamp=datetime.datetime.now(datetime.timezone.utc).isoformat();entry={'week':7,'status':'in_progress','scheduled_games':14,'final_games':1,'player_coverage':{'verified_box_scores':1,'missing_game_ids':[],'missing_positions':[],'category_totals_reconciled':True,'scope':'Only completed games so far; remaining13 games unfinished. Fewer than5 players per position retained when that is all verified finals provide.'},'players':groups,'upsets':[],'upset_market_unavailable_game_ids':[],'source_urls':[raw['url']],'verified_at':stamp}
existing=next((w for w in new['weeks'] if w['week']==7),None)
if existing:assert existing['status']!='final';existing.clear();existing.update(entry)
else:new['weeks'].append(entry)
new['updated_at']=stamp;(S/'wto-weekly-highlights-2026.candidate.json').write_text(json.dumps(new,indent=2)+'\n');print({p:[(r['player'],r['stats']) for r in rows[:1]] for p,rows in groups.items()})
