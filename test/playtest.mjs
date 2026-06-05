// Headless playtest: boots the real game in Chromium, walks start→exit, and
// screenshots key beats. Fails loudly on any console/page error.
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const graph = JSON.parse(await readFile('web/data/graph.json', 'utf8'));

// shortest path start -> exit, over hallways AND stairs down (the descent)
const navOut = (id) => {
  const n = graph.nodes[id];
  const out = n.exits.map((e) => e.to);
  if (n.descent === 'down' && n.down) out.push(n.down);
  return out;
};
function shortestPath() {
  const prev = new Map([[graph.start, null]]);
  const q = [graph.start];
  while (q.length) {
    const cur = q.shift();
    if (cur === graph.exit) break;
    for (const to of navOut(cur)) if (!prev.has(to)) { prev.set(to, cur); q.push(to); }
  }
  const path = []; let c = graph.exit;
  while (c != null) { path.unshift(c); c = prev.get(c); }
  return path;
}
const path = shortestPath();
const descents = path.filter((id, i) => i > 0 && graph.nodes[path[i - 1]].descent === 'down' && graph.nodes[path[i - 1]].down === id).length;
console.log(`shortest start→exit: ${path.length} rooms, ${descents} descents (${graph.meta.strata} strata)`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto(pathToFileURL('web/index.html').href);
try {
  await page.waitForFunction(() => window.P && window.P.app && window.P.engine && window.GRAPH, { timeout: 8000 });
} catch (e) {
  console.error('boot failed. errors:\n' + errors.join('\n'));
  await browser.close();
  process.exit(1);
}

await page.click('#screen .enter');
await page.waitForSelector('.passage');
await page.screenshot({ path: 'test/shot-01-start.png' });
console.log('· start rendered');

// add a journal note to exercise that path
await page.evaluate(() => window.P.engine.addNote('the looking-glass room. three ways on. the warm one felt false.'));

// walk the path, screenshotting the lowest-coherence room we hit
let minCoh = 1, minShotTaken = false, crossingShot = false, descentShot = false;
for (let i = 1; i < path.length; i++) {
  const next = path[i];
  // is this step a stair down, or a hallway?
  const move = await page.evaluate((nextId) => {
    const n = window.P.engine.current();
    if (n.descent === 'down' && n.down === nextId) return { descend: true };
    return { idx: n.exits.findIndex((e) => e.to === nextId) };
  }, next);
  if (move.descend) {
    if (!descentShot) { await page.screenshot({ path: 'test/shot-10-stair.png' }); descentShot = true; console.log('· stair-down room captured'); }
    await page.evaluate(() => window.P.engine.descend());
  } else {
    if (move.idx < 0) throw new Error(`no way from ${path[i - 1]} to ${next}`);
    await page.evaluate((k) => window.P.render.choose(k), move.idx);
  }
  await page.waitForTimeout(20);
  if (!crossingShot && await page.evaluate(() => window.P.engine.regionChanged())) {
    await page.waitForTimeout(450); // let the banner animate to peak
    const bannerText = await page.evaluate(() => { const b = document.getElementById('region-banner'); return b && getComputedStyle(b).opacity > 0.4 ? b.textContent : null; });
    await page.screenshot({ path: 'test/shot-06-crossing.png' });
    crossingShot = true;
    console.log(`· region banner visible: ${JSON.stringify(bannerText)}`);
    console.log(`· region crossing captured (entered "${await page.evaluate(() => window.P.engine.enteredRegion())}")`);
  }
  const coh = await page.evaluate(() => window.P.engine.localCoherence());
  if (coh < 0.33 && !minShotTaken) {
    await page.screenshot({ path: 'test/shot-02-deep.png' });
    minShotTaken = true;
    console.log(`· deep room captured (coherence ${coh.toFixed(2)}, drift ${(await page.evaluate(() => window.P.engine.drift())).toFixed(2)})`);
  }
  minCoh = Math.min(minCoh, coh);
}

// should now be at the exit
const ended = await page.evaluate(() => window.P.engine.isEnded());
await page.waitForSelector('.passage.authored');
await page.screenshot({ path: 'test/shot-03-exit.png' });
console.log(`· reached exit, ended=${ended}, min coherence en route=${minCoh.toFixed(2)}`);

// journal (note still present before we end the run) — verifies note drift
await page.evaluate(() => window.P.app.openJournal());
await page.waitForTimeout(30);
await page.screenshot({ path: 'test/shot-04-journal.png' });
await page.evaluate(() => window.P.app.closeJournal());

// turn around → the behaviour-keyed coda
await page.click('.exit.back');
await page.waitForTimeout(60);
const archetype = await page.evaluate(() => window.P.engine.endingArchetype());
await page.screenshot({ path: 'test/shot-07-ending.png' });
console.log(`· ending coda shown (archetype: ${archetype})`);

await browser.close();
if (errors.length) { console.error('CONSOLE/PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('playtest OK — no errors.');
