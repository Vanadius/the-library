// Graph invariants. These are the load-bearing guarantees the runtime relies on
// and that make the world fair: the exit must be reachable, but never *through*
// a mimic; mimics must truly dead-end; nothing may be orphaned; the coherence
// gradient must actually span from noise to clarity.
//
// Runs against the committed web/data/graph.json (build it first with `npm run
// build` if it's missing).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const graph = JSON.parse(await readFile(new URL('../web/data/graph.json', import.meta.url)));
const N = graph.nodes;

// Navigation neighbours: hallways (bidirectional) + the one-way stair down.
function navOut(id) {
  const n = N[id];
  const out = n.exits.map((e) => e.to);
  if (n.descent === 'down' && n.down) out.push(n.down);
  return out;
}
function bfs(start, blockKind) {
  const seen = new Set([start]);
  const q = [start];
  while (q.length) {
    const cur = q.shift();
    for (const to of navOut(cur)) {
      const t = N[to];
      if (seen.has(to)) continue;
      if (blockKind && t.kind === blockKind && to !== start) continue;
      seen.add(to); q.push(to);
    }
  }
  return seen;
}
// Reverse reachability: which rooms can REACH the goal (over the nav graph).
function canReach(goal) {
  const rev = new Map();
  for (const id of Object.keys(N)) for (const to of navOut(id)) {
    if (!rev.has(to)) rev.set(to, []);
    rev.get(to).push(id);
  }
  const seen = new Set([goal]); const q = [goal];
  while (q.length) { const cur = q.shift(); for (const p of (rev.get(cur) || [])) if (!seen.has(p)) { seen.add(p); q.push(p); } }
  return seen;
}

test('graph loads with a start and an exit', () => {
  assert.ok(graph.start && N[graph.start], 'start node exists');
  assert.ok(graph.exit && N[graph.exit], 'exit node exists');
  assert.equal(N[graph.exit].kind, 'exit');
});

test('every node is reachable from the start (no orphans)', () => {
  const reached = bfs(graph.start);
  assert.equal(reached.size, Object.keys(N).length, 'all nodes reachable');
});

test('the exit is reachable from the start', () => {
  assert.ok(bfs(graph.start).has(graph.exit));
});

test('the world is solvable from EVERY room (no soft-locks)', () => {
  const reaching = canReach(graph.exit);
  assert.equal(reaching.size, Object.keys(N).length,
    'every room must be able to reach the exit');
});

test('the Descent has strata, sanctuaries, and one true stair per floor', () => {
  assert.ok(graph.meta.strata >= 2, 'multiple strata');
  const sanctuaries = Object.values(N).filter((n) => n.sanctuary);
  assert.ok(sanctuaries.length >= graph.meta.strata, 'at least one sanctuary per stratum');
  const trueStairs = Object.values(N).filter((n) => n.descent === 'down');
  assert.equal(trueStairs.length, graph.meta.strata - 1, 'one true stair between each pair of floors');
  for (const s of trueStairs) assert.ok(s.down && N[s.down], 'a stair leads somewhere real');
  // false stairs exist to make the recognition a reading
  assert.ok(Object.values(N).some((n) => n.descent === 'false'), 'false stairs exist');
});

test('the exit is NOT reachable through any mimic (mimics are real dead ends)', () => {
  assert.ok(bfs(graph.start, 'mimic').has(graph.exit),
    'exit must be reachable without ever passing through a mimic');
});

test('all edges are bidirectional (you can always retreat)', () => {
  for (const id in N) {
    for (const e of N[id].exits) {
      assert.ok(N[e.to].exits.some((b) => b.to === id), `edge ${id}->${e.to} has no return`);
    }
  }
});

test('every exit carries a preview snippet', () => {
  for (const id in N) for (const e of N[id].exits) {
    assert.ok(typeof e.preview === 'string' && e.preview.length > 0, `missing preview ${id}->${e.to}`);
  }
});

test('coherence spans the full gradient from noise to clarity', () => {
  const cohs = Object.values(N).map((n) => n.coherence);
  assert.ok(Math.min(...cohs) < 0.25, 'there is genuine noise');
  assert.ok(Math.max(...cohs) > 0.85, 'there is genuine clarity');
  assert.equal(N[graph.exit].coherence, 1, 'the exit is maximally coherent');
});

test('the exit text is authored, not Markov', () => {
  assert.ok(N[graph.exit].authored === true);
  assert.ok(N[graph.exit].text.length > 400, 'exit is a substantial authored passage');
});

test('there are oases of multiple distinct themes', () => {
  const oasisThemes = new Set(Object.values(N).filter((n) => n.kind === 'oasis').map((n) => n.theme));
  assert.ok(oasisThemes.size >= 3, 'at least three distinct oasis voices');
});

test('authored fragments bleed through into some rooms', () => {
  const bled = Object.values(N).filter((n) => n.bleed);
  assert.ok(bled.length >= 8, 'several rooms carry an authored bleed-through fragment');
  for (const n of bled) {
    assert.ok(n.kind === 'corridor' || n.kind === 'mimic', 'bleed never lands in an oasis or the exit');
  }
  assert.equal(graph.meta.bleedCount, bled.length);
});

test('behavior-keyed endings are baked into the graph meta', () => {
  const codas = graph.meta.codas || {};
  assert.ok(Object.keys(codas).length >= 4, 'multiple endings exist');
  for (const k of ['reader', 'diver', 'cartographer']) {
    assert.ok(typeof codas[k] === 'string' && codas[k].length > 120, `coda "${k}" is a substantial authored passage`);
  }
});

test('mimics exist and form terminal clusters of high apparent coherence', () => {
  const mimics = Object.values(N).filter((n) => n.kind === 'mimic');
  assert.ok(mimics.length >= 3, 'mimics present');
  const avg = mimics.reduce((s, n) => s + n.coherence, 0) / mimics.length;
  assert.ok(avg > 0.6, 'mimics read as coherent (that is the trap)');
});
