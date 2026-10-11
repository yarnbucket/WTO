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
 const p=triviaProgress(team);p.revealed=Array.isArray(p.revealed)?p.revealed:[];p.cursor=((p.cursor%questions.length)+questions.length)%questions.length;
 const q=questions[p.cursor],revealed=p.solved.includes(q.id)||p.revealed.includes(q.id),body=panel.querySelector('.team-trivia-body');
 body.innerHTML='<p class="trivia-progress">Question '+(p.cursor+1)+' of '+questions.length+' · '+p.solved.length+' correct</p><p class="trivia-question">'+safeText(q.question)+'</p><form onsubmit="return submitTeamTrivia(this)"><label>Your answer<input name="answer" autocomplete="off" autocapitalize="words" spellcheck="false" maxlength="100" '+(revealed?'disabled':'')+' required></label><button type="submit" '+(revealed?'disabled':'')+'>CHECK ANSWER</button></form><p class="trivia-feedback" aria-live="polite"></p><div class="trivia-actions"><button type="button" onclick="hintTeamTrivia(this)">HINT</button><button type="button" onclick="revealTeamTrivia(this)">SHOW ANSWER</button><button type="button" onclick="nextTeamTrivia(this)">NEXT →</button></div><small>Records checked '+safeText(q.verified_at)+'. Franchise history includes earlier names and cities.</small>';
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
 if(result==='correct'){if(!p.solved.includes(q.id))p.solved.push(q.id);triviaSave(team,p);renderTeamTrivia(panel)}
 else feedback.textContent=result==='ambiguous'?'Be more specific—try the full name.':result==='empty'?'Type an answer first.':'Not quite. Try again or use a hint.';
 return false;
}
function hintTeamTrivia(button){const panel=button.closest('.team-trivia'),{q}=currentTrivia(panel);if(!panel.querySelector('input').disabled)panel.querySelector('.trivia-feedback').textContent=q.hint}
function revealTeamTrivia(button){const panel=button.closest('.team-trivia'),{team,p,q}=currentTrivia(panel);p.revealed=Array.isArray(p.revealed)?p.revealed:[];if(!p.revealed.includes(q.id))p.revealed.push(q.id);triviaSave(team,p);renderTeamTrivia(panel)}
function nextTeamTrivia(button){const panel=button.closest('.team-trivia'),{team,p,qs}=currentTrivia(panel);p.cursor=(p.cursor+1)%qs.length;triviaSave(team,p);renderTeamTrivia(panel)}
