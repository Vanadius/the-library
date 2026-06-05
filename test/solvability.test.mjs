// Solvability proof — these guard the *generator*, not just a baked graph. They
// feed validate() deliberately broken worlds and assert it refuses them, so the
// build can never silently emit a library you cannot escape. (The companion
// graph.test.mjs proves the *shipped* world is in fact solvable.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../pipeline/generate_graph.mjs';

const G = (nodes) => ({ nodes: new Map(nodes.map((n) => [n.id, n])) });

test('accepts a solvable world and reports a real solution path', () => {
  const ok = G([
    { id: 'start', kind: 'oasis', exits: [{ to: 'a' }] },
    { id: 'a', kind: 'corridor', exits: [{ to: 'start' }, { to: 'exit' }] },
    { id: 'exit', kind: 'exit', exits: [{ to: 'a' }] },
  ]);
  const r = validate(ok, 'start', 'exit');
  assert.equal(r.stats.solvable, true);
  assert.equal(r.stats.solutionLength, 2);
  assert.equal(r.stats.orphan, 0);
});

test('refuses a world whose exit is unreachable', () => {
  const bad = G([
    { id: 'start', kind: 'oasis', exits: [{ to: 'a' }] },
    { id: 'a', kind: 'corridor', exits: [{ to: 'start' }] },
    { id: 'exit', kind: 'exit', exits: [] },
  ]);
  assert.throws(() => validate(bad, 'start', 'exit'), /UNSOLVABLE|not reachable/i);
});

test('refuses a world with an orphan / soft-locked room', () => {
  const bad = G([
    { id: 'start', kind: 'oasis', exits: [{ to: 'a' }] },
    { id: 'a', kind: 'corridor', exits: [{ to: 'start' }, { to: 'exit' }] },
    { id: 'exit', kind: 'exit', exits: [{ to: 'a' }] },
    { id: 'lost', kind: 'corridor', exits: [] }, // cannot reach the exit
  ]);
  assert.throws(() => validate(bad, 'start', 'exit'), /orphan|cannot reach/i);
});

test('refuses a world where the exit is only reachable through a mimic', () => {
  const bad = G([
    { id: 'start', kind: 'oasis', exits: [{ to: 'm' }] },
    { id: 'm', kind: 'mimic', exits: [{ to: 'start' }, { to: 'exit' }] },
    { id: 'exit', kind: 'exit', exits: [{ to: 'm' }] },
  ]);
  assert.throws(() => validate(bad, 'start', 'exit'), /through a mimic/i);
});
