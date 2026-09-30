import fs from 'node:fs';
import { validateInsightFile } from './wto-insights-lib.mjs';
const insights=JSON.parse(fs.readFileSync(new URL('../wto-game-insights-2026.json',import.meta.url)));
const ledger=JSON.parse(fs.readFileSync(new URL('../ff26-nfl-lines-2026.json',import.meta.url)));
const result=validateInsightFile(insights,ledger);
for(const error of result.errors) console.error(error);
console.log(`${result.errors.length} errors`);
process.exitCode=result.errors.length?1:0;
