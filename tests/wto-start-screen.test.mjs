import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('WTO opens on matchups while keeping the weekly summary available', () => {
  assert.match(html, /<div class="summary-screen" id="summaryScreen">/);
  assert.match(html, /<div class="screen app-hidden" id="trackerScreen">/);
  assert.match(html, /function openSummary\(\)/);
  assert.match(html, /function openTracker\(\)/);
});

test('installed WTO app points to the refreshed shell', () => {
  const manifest = fs.readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8');
  const serviceWorker = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(manifest, /"start_url": "\.\/\?v=54"/);
  assert.match(serviceWorker, /wto-shell-v55/);
});

test('all inline application scripts parse', () => {
  const blocks = html.split('<script').slice(1).map(x => x.slice(x.indexOf('>') + 1, x.indexOf('</script>')));
  for (const block of blocks) assert.doesNotThrow(() => new vm.Script(block));
});
