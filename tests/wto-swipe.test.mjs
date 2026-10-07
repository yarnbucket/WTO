import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),c={};vm.createContext(c);vm.runInContext(html.slice(html.indexOf('function swipeDecision'),html.indexOf('async function navigateSelectedGame')),c);
test('horizontal drag commits while diagonal scrolling and short taps do not',()=>{assert.equal(c.swipeDecision(110,15,400,500),true);assert.equal(c.swipeDecision(90,120,400,200),false);assert.equal(c.swipeDecision(12,0,400,10),false)});
test('quick intentional flick commits and slow partial drag returns',()=>{assert.equal(c.swipeDecision(-45,0,400,60),true);assert.equal(c.swipeDecision(45,0,400,500),false)});
