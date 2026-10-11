/* WTO team trivia: standalone progress, never modifies picks or season data. */
let wtoTriviaBank=null,wtoTriviaLoading=null;
function triviaNormalize(value){return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[.'’]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/^(it is|its|the answer is|i think|the)\s+/,'')}
function triviaDistance(a,b){
 const rows=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
 for(let i=0;i<=a.length;i++)rows[i][0]=i;for(let j=0;j<=b.length;j++)rows[0][j]=j;
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
 rows[i][j]=Math.min(rows[i-1][j]+1,rows[i][j-1]+1,rows[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
 if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])rows[i][j]=Math.min(rows[i][j],rows[i-2][j-2]+1);
 }return rows[a.length][b.length];
}
function triviaMatch(question,input,questions){
 const value=triviaNormalize(input);if(!value)return 'empty';
 const aliases=question.aliases.map(triviaNormalize);
 if(question.answer_type!=='person')return aliases.includes(value)?'correct':'wrong';
 const matches=(alias)=>{if(alias===value)return true;if(value.length<4||alias.length<4)return false;const limit=Math.min(alias.length>=8?2:1,Math.floor(alias.length*.2));return triviaDistance(value,alias)<=limit};
 const people=questions.filter(q=>q.answer_type==='person');
 const exact=people.filter(q=>q.aliases.map(triviaNormalize).includes(value));
 if(new Set(exact.map(q=>triviaNormalize(q.answer))).size>1)return 'ambiguous';
 if(aliases.includes(value))return 'correct';
 const candidates=people.filter(q=>q.aliases.map(triviaNormalize).some(matches));
 if(new Set(candidates.map(q=>triviaNormalize(q.answer))).size>1)return 'ambiguous';
 return aliases.some(matches)?'correct':'wrong';
}
function triviaProgress(team){try{const all=JSON.parse(localStorage.getItem('wto-team-trivia-v1')||'{}'),p=all[team];return p&&Number.isInteger(p.cursor)&&Array.isArray(p.solved)?p:{cursor:0,solved:[],revealed:[]}}catch(e){return {cursor:0,solved:[],revealed:[]}}}
function triviaSave(team,p){try{const all=JSON.parse(localStorage.getItem('wto-team-trivia-v1')||'{}');all[team]=p;localStorage.setItem('wto-team-trivia-v1',JSON.stringify(all))}catch(e){}}
function teamTriviaHtml(team){return '<details class="team-trivia" data-trivia-team="'+team+'" ontoggle="loadTeamTrivia(this)"><summary>TEAM TRIVIA ▸</summary><div class="team-trivia-body">Open to play ten questions. Type your answer—small spelling mistakes are okay.</div></details>'}
async function loadTeamTrivia(panel){
 if(!panel.open)return;
 const body=panel.querySelector('.team-trivia-body');
 try{
 if(!wtoTriviaBank){body.textContent='Loading trivia…';if(!wtoTriviaLoading)wtoTriviaLoading=fetch('./wto-team-trivia.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Unavailable');return r.json()}).then(j=>wtoTriviaBank=j).catch(e=>{wtoTriviaLoading=null;throw e});await wtoTriviaLoading}
 renderTeamTrivia(panel);
 }catch(e){body.textContent='Trivia is unavailable right now. Close and reopen to try again.'}
}
function renderTeamTrivia(panel){
 const team=panel.dataset.triviaTeam,questions=wtoTriviaBank?.teams[team]?.questions;if(!questions?.length)return;
 const p=triviaProgress(team);p.revealed=Array.isArray(p.revealed)?p.revealed:[];p.solved=[...new Set(p.solved)].filter(id=>questions.some(q=>q.id===id));p.cursor=((p.cursor%questions.length)+questions.length)%questions.length;
 const q=questions[p.cursor],revealed=p.solved.includes(q.id)||p.revealed.includes(q.id),body=panel.querySelector('.team-trivia-body');
 body.innerHTML=triviaRewardProgressHtml()+'<p class="trivia-progress">Question '+(p.cursor+1)+' of '+questions.length+' · '+p.solved.length+' correct</p><p class="trivia-question">'+safeText(q.question)+'</p><form onsubmit="return submitTeamTrivia(this)"><label>Your answer<input name="answer" autocomplete="off" autocapitalize="words" spellcheck="false" maxlength="100" '+(revealed?'disabled':'')+' required></label><button type="submit" '+(revealed?'disabled':'')+'>CHECK ANSWER</button></form><p class="trivia-feedback" aria-live="polite"></p><div class="trivia-actions"><button type="button" onclick="hintTeamTrivia(this)">HINT</button><button type="button" onclick="revealTeamTrivia(this)">SHOW ANSWER</button><button type="button" onclick="nextTeamTrivia(this)">NEXT →</button><button type="button" onclick="resetTeamTrivia(this)">RESET QUIZ</button></div><small>Records checked '+safeText(q.verified_at)+'. Franchise history includes earlier names and cities.</small>';
 if(revealed)showTriviaAnswer(panel,q,p.solved.includes(q.id)?'Correct!':'Answer revealed.');
}
function currentTrivia(panel){const team=panel.dataset.triviaTeam,p=triviaProgress(team),qs=wtoTriviaBank.teams[team].questions;return {team,p,qs,q:qs[p.cursor%qs.length]}}
function showTriviaAnswer(panel,q,message){
 const feedback=panel.querySelector('.trivia-feedback');feedback.innerHTML='<strong>'+safeText(message)+' '+safeText(q.answer)+'</strong><br>'+safeText(q.explanation)+' <a href="'+safeText(q.source_url)+'" target="_blank" rel="noopener noreferrer">Source ↗</a>';
 panel.querySelector('input').disabled=true;panel.querySelector('button[type="submit"]').disabled=true;
}
function submitTeamTrivia(form){
 const panel=form.closest('.team-trivia'),{team,p,qs,q}=currentTrivia(panel),result=triviaMatch(q,form.elements.answer.value,qs);
 const feedback=panel.querySelector('.trivia-feedback');
 if(result==='correct'){if(!p.solved.includes(q.id))p.solved.push(q.id);triviaSave(team,p);renderTeamTrivia(panel);const reward=unlockTriviaTrophy(team,p,qs);if(reward){renderTeamTrivia(panel);panel.querySelector('.trivia-feedback').insertAdjacentHTML('beforeend','<br><strong>'+safeText(reward)+' unlocked!</strong>')}}
 else feedback.textContent=result==='ambiguous'?'Be more specific—try the full name.':result==='empty'?'Type an answer first.':'Not quite. Try again or use a hint.';
 return false;
}
function hintTeamTrivia(button){const panel=button.closest('.team-trivia'),{q}=currentTrivia(panel);if(!panel.querySelector('input').disabled)panel.querySelector('.trivia-feedback').textContent=q.hint}
function revealTeamTrivia(button){const panel=button.closest('.team-trivia'),{team,p,q}=currentTrivia(panel);p.revealed=Array.isArray(p.revealed)?p.revealed:[];if(!p.revealed.includes(q.id))p.revealed.push(q.id);triviaSave(team,p);renderTeamTrivia(panel)}
function nextTeamTrivia(button){const panel=button.closest('.team-trivia'),{team,p,qs}=currentTrivia(panel);p.cursor=(p.cursor+1)%qs.length;triviaSave(team,p);renderTeamTrivia(panel)}

function resetTeamTrivia(button){const panel=button.closest('.team-trivia');triviaSave(panel.dataset.triviaTeam,{cursor:0,solved:[],revealed:[]});renderTeamTrivia(panel)}


/* Mastered teams are permanent achievements, independent of resettable quiz progress. */
function triviaRewardState(){
 let state;try{state=JSON.parse(localStorage.getItem('wto-trivia-rewards-v2')||'null')}catch(e){}
 if(!state||typeof state.mastered!=='object'||!state.mastered)state={mastered:{},celebrated:0};
 const valid=Object.keys(wtoTriviaBank?.teams||{});
 if(valid.length){for(const team of Object.keys(state.mastered))if(!valid.includes(team))delete state.mastered[team];
 for(const team of valid){const qs=wtoTriviaBank.teams[team].questions,p=triviaProgress(team);if(qs.length===10&&qs.every(q=>p.solved.includes(q.id))&&!state.mastered[team])state.mastered[team]=new Date().toISOString()}}
 return state;
}
function saveTriviaRewardState(state){try{localStorage.setItem('wto-trivia-rewards-v2',JSON.stringify(state));return true}catch(e){return false}}
function triviaRewardTier(count){return count>=32?4:count>=16?3:count>=6?2:count>=1?1:0}
function triviaRewardName(tier){return ['','Bronze team badge','Silver team badge','Golden football','Trivia champion'][tier]}
function triviaRewardProgressHtml(){
 const state=triviaRewardState();saveTriviaRewardState(state);const count=Object.keys(state.mastered).length,tier=triviaRewardTier(count);
 return '<p class="trivia-reward-progress">'+(tier?triviaRewardIcon(tier,true)+' ':'')+'<strong>Teams mastered: '+count+'/32</strong>'+(tier?' · '+triviaRewardName(tier):'')+'</p>';
}
function unlockTriviaTrophy(team,progress,questions){
 const state=triviaRewardState(),before=triviaRewardTier(Object.keys(state.mastered).length);
 if(!wtoTriviaBank?.teams[team]||questions.length!==10||!questions.every(q=>progress.solved.includes(q.id)))return '';
 // Rendering may already have recorded this newly mastered team; celebration still follows the earned tier.
 if(!state.mastered[team])state.mastered[team]=new Date().toISOString();
 const tier=triviaRewardTier(Object.keys(state.mastered).length);
 if(!saveTriviaRewardState(state))return '';
 return tier>Number(state.celebrated||0)?triviaRewardName(tier):'';
}
function triviaRewardIcon(tier,small){
 const size=small?24:90;
 if(tier===4)return "<svg viewBox=\"0 0 120 180\" width=\"90\" height=\"135\" aria-hidden=\"true\"><defs><linearGradient id=\"trivia-silver\"><stop stop-color=\"#6d7982\"/><stop offset=\".4\" stop-color=\"#fff\"/><stop offset=\".6\" stop-color=\"#bccbd5\"/><stop offset=\"1\" stop-color=\"#56636d\"/></linearGradient></defs><path d=\"M48 67L72 67 88 155 32 155Z\" fill=\"url(#trivia-silver)\" stroke=\"#edf6ff\"/><path d=\"M60 70L68 155\" stroke=\"#596a78\"/><ellipse cx=\"60\" cy=\"40\" rx=\"23\" ry=\"38\" transform=\"rotate(38 60 40)\" fill=\"url(#trivia-silver)\" stroke=\"#edf6ff\" stroke-width=\"2\"/><path d=\"M43 59L77 20M50 43L62 52M55 36L68 45M60 29L73 38\" stroke=\"#586877\" stroke-width=\"2\"/><rect x=\"29\" y=\"155\" width=\"62\" height=\"10\" rx=\"2\" fill=\"url(#trivia-silver)\"/></svg>".replace('width="90" height="135"','width="'+size+'" height="'+Math.round(size*1.5)+'"');
 const color=tier===1?'#cc8b54':tier===2?'#dce5ed':'#ffd149';
 return '<svg viewBox="0 0 100 100" width="'+size+'" height="'+size+'" aria-hidden="true">'+(tier===3?'<ellipse cx="50" cy="50" rx="24" ry="43" transform="rotate(45 50 50)" fill="'+color+'" stroke="#fff1b1" stroke-width="3"/><path d="M27 73L73 27M40 48L52 60M46 42L58 54M52 36L64 48" stroke="#8b6018" stroke-width="3"/>':'<path d="M50 5L85 20V53Q85 80 50 95Q15 80 15 53V20Z" fill="'+color+'" stroke="#f7ecd4" stroke-width="3"/><path d="M50 26L56 40 72 42 60 53 63 69 50 61 37 69 40 53 28 42 44 40Z" fill="#283429"/>')+'</svg>';
}
async function showTriviaStartupTrophy(){
 try{
 if(!wtoTriviaBank){const r=await fetch('./wto-team-trivia.json',{cache:'no-store'});if(!r.ok)return;wtoTriviaBank=await r.json()}
 const state=triviaRewardState();saveTriviaRewardState(state);const count=Object.keys(state.mastered).length,tier=triviaRewardTier(count);
 if(!tier||tier<=Number(state.celebrated||0)||document.getElementById('trivia-startup-trophy'))return;
 const home=document.getElementById('summaryScreen');if(!home||home.classList.contains('app-hidden'))return;
 const badge=document.createElement('div');badge.id='trivia-startup-trophy';badge.className='trivia-startup-trophy';badge.setAttribute('role','status');
 badge.innerHTML=triviaRewardIcon(tier,false)+'<strong>'+triviaRewardName(tier).toUpperCase()+'</strong><span>Teams mastered: '+count+'/32</span>';
 home.appendChild(badge);state.celebrated=tier;saveTriviaRewardState(state);setTimeout(()=>badge.remove(),2800);
 }catch(e){}
}
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',()=>setTimeout(showTriviaStartupTrophy,800));
