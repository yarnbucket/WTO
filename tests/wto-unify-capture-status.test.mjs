import test from "node:test";
import assert from "node:assert/strict";
import {unifyReports} from "../scripts/wto-unify-capture-status.mjs";
test("publisher lock remains authoritative even if legacy reports show zero",()=>{
 const p={checked_at:"2026-11-23T16:52:20Z",published:[{week:11,game_id:"2026-W11-CIN-WAS",source:"week11",sha256:"abc"}],duplicates:[{game_id:"2026-W11-CIN-WAS"}],historical:[{}],rejected:[]};
 const report=unifyReports(p,{ready:0},{locked:[]});
 assert.equal(report.counts.unique_locked,1);
 assert.equal(report.counts.duplicate_snapshots,1);
 assert.equal(report.legacy.archive_locked,0);
 assert.equal(report.status,"prospective_snapshots_locked");
});
test("duplicate active matches fail report integrity",()=>{
 const row={week:12,game_id:"same",sha256:"a"};
 assert.throws(()=>unifyReports({published:[row,row]}),/Duplicate/);
});
