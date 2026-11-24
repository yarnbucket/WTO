import test from 'node:test';
import assert from 'node:assert/strict';
import {baselineWinProbability} from '../scripts/wto-baseline-probability.mjs';
import {generateBaseline} from '../scripts/wto-generate-baseline.mjs';
test('recovered probability regression',()=>{for(const [m,p] of [[0,.5],[1,.536],[2,.571],[3,.606],[4,.639],[6,.702],[7,.731],[8,.75],[16,.75]])assert.equal(baselineWinProbability(m),p);});
test('reject incomplete history',()=>{assert.throws(()=>generateBaseline({away:'A',home:'B'},[]));assert.throws(()=>generateBaseline({away:'A',home:'B'},[{status:'scheduled'}]));});
test('baseline independent of market',()=>{const h=[{game_id:'1',away:'A',home:'B',status:'final',away_score:10,home_score:30}];const a=generateBaseline({away:'A',home:'B'},h);const b=generateBaseline({away:'A',home:'B',market_spread:99},h);assert.deepEqual(a,b);});
