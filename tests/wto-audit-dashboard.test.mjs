import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const root=new URL("../",import.meta.url);
test("audit dashboard is isolated and does not modify picks or predictions",async()=>{
 const html=await readFile(new URL("wto-audit.html",root),"utf8");
 assert.match(html,/READ-ONLY/);
 assert.match(html,/wto-audit-summary-2026\.json/);
 assert.doesNotMatch(html,/localStorage\s*\.\s*setItem|localStorage\s*\[|WTOEX\s*\.|openMySlip\(/);
});
test("frozen audit summary retains Week 6 provenance and exact report totals",async()=>{
 const d=JSON.parse(await readFile(new URL("wto-audit-summary-2026.json",root),"utf8"));
 assert.equal(d.weeks.length,6);
 assert.equal(d.weeks.reduce((n,w)=>n+w.games,0),78);
 const legacy=d.weeks.filter(w=>w.cohort==="legacy_untimestamped");
 assert.deepEqual(legacy.map(w=>w.week),[6]);
 const strict=d.weeks.filter(w=>w.cohort==="timestamp_verified");
 assert.equal(strict.reduce((n,w)=>n+w.games,0),64);
 const totals=(rows,k)=>rows.reduce((a,w)=>[a[0]+w[k][0],a[1]+w[k][1]],[0,0]);
 assert.deepEqual(totals(d.weeks,"winner"),[50,26]);
 assert.deepEqual(totals(d.weeks,"market"),[56,22]);
 assert.deepEqual(totals(d.weeks,"ats"),[39,38]);
 assert.deepEqual(totals(d.weeks,"total"),[39,39]);
 assert.equal(d.pending.length,1);
});

test("disagreement tracker is sourced from the archived paired audit and respects provenance",async()=>{
 const d=JSON.parse(await readFile(new URL("wto-audit-disagreements-2026.json",root),"utf8"));
 assert.equal(d.schema_version,1);
 assert.equal(d.disagreements.length,7);
 assert.equal(d.disagreements.filter(x=>x.provenance==="legacy_untimestamped").length,1);
 assert.equal(d.disagreements.filter(x=>x.aiResult==="win").length,1);
 assert.equal(d.disagreements.filter(x=>x.marketResult==="win").length,6);
 const html=await readFile(new URL("wto-audit.html",root),"utf8");
 assert.match(html,/id="weeklycards"/);
 assert.match(html,/wto-audit-disagreements-2026\.json/);
 assert.match(html,/filter\.value/);
});
