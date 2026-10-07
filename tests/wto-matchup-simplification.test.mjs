import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const body=html.slice(html.indexOf('function matchupArchiveSummary'),html.indexOf('function historyHtml'));
function render(h){const c={historyData:null,recordLabel:r=>r?'record':'—',NFL_GROUP:{},gameLabel:()=> 'meeting'};vm.createContext(c);vm.runInContext(body,c);return c.matchupArchiveSummary({away:'PHI',home:'JAX'},h)}
test('empty archive gives an honest note without zero betting records',()=>{const s=render({});assert.match(s,/No verified meetings available in our 2021–2025 archive/);assert.doesNotMatch(s,/0O|0–0–0/)});
test('scores remain visible when closing markets are missing',()=>{const s=render({last_10:[{away:'PHI',home:'JAX',away_score:21,home_score:17,winner:'PHI',date:'2025-01-01'}]});assert.match(s,/PHI 21/);assert.match(s,/JAX 17/);assert.match(s,/Unavailable/);assert.doesNotMatch(s,/No verified meetings/)});
test('scheduled shared card exposes lazy insight without routing to a duplicate prediction',()=>{assert.match(html,/function matchupMoreInsightHtml/);assert.match(html,/g\.status!=='final'&&g\.week>=5/);assert.match(html,/panel\.dataset\.loaded='loading'/)});
