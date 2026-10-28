import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('saving from an older tab retains picks saved in another tab',()=>{
 const src=fs.readFileSync(new URL('../wto-slip.js',import.meta.url),'utf8');
 const commit=src.match(/ window\.slipCommit=function[^\n]+/)[0];
 const stored=[{game_id:'old',kind:'winner',side:'A',season:2026,week:5},{game_id:'new',kind:'winner',side:'B',season:2026,week:6}];
 const db={'wto-weekly-slip-2026':JSON.stringify(stored),'wto-basic-picks':JSON.stringify({old:'A',new:'B'}),'wto-advanced-picks':'{}'};
 const ctx={window:{},key:'wto-weekly-slip-2026',saved:[stored[0]],picks:{old:'A'},advancedPicks:{},game:id=>({id,week:8,away:'X',home:'Y'}),draft:()=>({winner:'X'}),WTOSlip:{locked:()=>false,save:(_p,g,x)=>({...x,game_id:g.id,season:2026,week:g.week}),select:(arr,p)=>[...arr.filter(x=>x.game_id!==p.game_id||x.kind!==p.kind),p]},localStorage:{getItem:k=>db[k]??null,setItem:(k,v)=>db[k]=v},submitted:()=>true,updateRecords(){},document:{getElementById:()=>({textContent:''})}};
 vm.createContext(ctx);vm.runInContext(commit,ctx);ctx.window.slipCommit('current');
 assert.deepEqual(JSON.parse(db['wto-weekly-slip-2026']).map(x=>x.game_id).sort(),['current','new','old']);assert.equal(JSON.parse(db['wto-basic-picks']).new,'B');
});
test('an older tab cannot overwrite a newer pick for the same game',()=>{
 const src=fs.readFileSync(new URL('../wto-slip.js',import.meta.url),'utf8');const commit=src.match(/ window\.slipCommit=function[^\n]+/)[0];
 const old={game_id:'g',kind:'winner',side:'X',season:2026},newer={...old,side:'Y'};const db={'wto-weekly-slip-2026':JSON.stringify([newer]),'wto-basic-picks':'{}','wto-advanced-picks':'{}'};const msg={textContent:''};
 const ctx={window:{},key:'wto-weekly-slip-2026',saved:[old],picks:{},advancedPicks:{},game:id=>({id,week:8,away:'X',home:'Y'}),draft:()=>({winner:'X'}),WTOSlip:{locked:()=>false,save:(_p,g,x)=>({...x,game_id:g.id}),select:(a,p)=>[...a,p]},localStorage:{getItem:k=>db[k]??null,setItem:(k,v)=>db[k]=v},submitted:()=>true,updateRecords(){},document:{getElementById:()=>msg}};vm.createContext(ctx);vm.runInContext(commit,ctx);ctx.window.slipCommit('g');assert.equal(JSON.parse(db['wto-weekly-slip-2026'])[0].side,'Y');assert.match(msg.textContent,/changed|reload/i);
});
