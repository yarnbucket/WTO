import test from 'node:test';
import assert from 'node:assert/strict';
import '../wto-division-read.js';
const game=(week,away,home,a,h,status='final')=>({week,away,home,awayScore:a,homeScore:h,status});
test('preserves tied leaders and excludes future, scheduled and missing scores',()=>{
 const r=WTODivision.compare([game(1,'BUF','NE',20,10),game(2,'NE','BUF',20,10),game(3,'BUF','NE',30,0),game(2,'BUF','NE',40,0,'scheduled'),game(2,'BUF','NE',null,0)],['BUF','NE'],2);
 assert.equal(r.leaders.length,2);assert.deepEqual(r.favorites,['BUF','NE']);assert.equal(r.throughWeek,2);assert.equal(r.leaders[0].played,2);assert.equal(r.gamesAhead,null);
});
test('calculates games ahead and scoring margin',()=>{
 const r=WTODivision.compare([game(1,'JAX','HOU',20,10),game(2,'JAX','HOU',30,20)],['JAX','HOU'],2);
 assert.equal(r.leaders[0].team,'JAX');assert.equal(r.gamesAhead,2);assert.match(r.reads[0],/\+20 scoring margin/);assert.deepEqual(r.favorites,['HOU']);
});
test('empty season has no invented leader',()=>assert.equal(WTODivision.compare([],['BUF','NE'],1).leaders.length,0));
test('baseline is immutable',()=>assert.equal(Object.isFrozen(WTODivision.baseline),true));
