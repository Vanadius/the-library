// Graph generation — assembles the whole library at build time.
//
// Output is a single JSON the runtime loads: oases (coherent islands), a
// sprawling maze of corridors (the incoherent halls you spend most of your
// time lost in), mimics (beautiful dead ends), and exactly one authored exit.
//
// Topology principles (from the design bible):
//   · Order is terrain, and order is NOT distance-to-oasis. Profiles break that
//     heuristic so the player must read, not follow a gradient.
//   · Most of the library is corridor. Oases are rare. You earn them.
//   · Mimics read better than the path to the exit. The compass will betray you.
//   · The exit sits beyond the worst noise: you break through salad into the one
//     real page.

import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { rng, hashSeed, randInt, pick, shuffle } from './lib/rng.mjs';
import { MarkovCorpus, detokenize, tokenize } from './lib/markov.mjs';
import { ReferenceModel } from './lib/reference_model.mjs';
import { PROFILES, weightedProfile } from './lib/profiles.mjs';
import { EXIT_TEXT, FALSE_EXITS, EXIT_CODAS } from './exit_text.mjs';
import { FRAGMENTS } from './fragments.mjs';
import { SEED, CORPUS, ORDERS, SCALE, PATHS } from './config.mjs';

const DEDUP_L = 22; // reject Markov passages reproducing >= this many verbatim source tokens

class Builder {
  constructor(seed) {
    this.rand = rng(seed);
    this.nodes = new Map();
    this.seq = 0;
  }
  id() { return 'n' + (this.seq++).toString(36); }

  add(node) {
    const id = this.id();
    this.nodes.set(id, { id, exits: [], ...node });
    return id;
  }

  // Bidirectional link. The library lets you backtrack — retreat through
  // degrading text is a core action.
  link(a, b) {
    if (a === b) return;
    const na = this.nodes.get(a), nb = this.nodes.get(b);
    if (!na.exits.some((e) => e.to === b)) na.exits.push({ to: b });
    if (!nb.exits.some((e) => e.to === a)) nb.exits.push({ to: a });
  }

  // Strip an existing link in one direction (used to seal mimic dead ends so the
  // approach is one-way-ish: you can leave, but the cluster never shortcuts on).
  unlinkDir(from, to) {
    const n = this.nodes.get(from);
    n.exits = n.exits.filter((e) => e.to !== to);
  }
}

async function loadCorpora() {
  const files = (await readdir(PATHS.clean)).filter((f) => f.endsWith('.txt'));
  const ref = new ReferenceModel(4);
  const corpora = new Map();
  for (const f of files) {
    const key = f.replace('.txt', '');
    const text = await readFile(`${PATHS.clean}/${f}`, 'utf8');
    ref.train(text, 90000);
    corpora.set(key, new MarkovCorpus(key, text));
  }
  return { ref, corpora };
}

function themeLabel(key) {
  return CORPUS.find((c) => c.key === key)?.theme ?? key;
}

export async function build({ scale = 'minimal', seed = SEED } = {}) {
  const cfg = SCALE[scale] ?? SCALE.minimal;
  const b = new Builder(seed);
  const { ref, corpora } = await loadCorpora();
  const themeKeys = [...corpora.keys()];

  // Generate one Markov node and score it. Retries on long verbatim runs.
  const gen = (theme, order, kind, words, salt) => {
    const corpus = corpora.get(theme);
    let toks;
    for (let attempt = 0; attempt < 4; attempt++) {
      toks = corpus.generate(order, words, `${seed}:${theme}:${order}:${salt}:${attempt}`);
      if (!corpus.hasVerbatimRun(toks, DEDUP_L)) break;
    }
    const { perplexity, surprisal } = ref.score(toks);
    return b.add({ kind, theme, themeLabel: themeLabel(theme), order, perplexity, surprisal, text: detokenize(toks) });
  };

  // Authored / fixed-text node (exit, false exits). order:9 flags "max apparent
  // coherence" for the compass without going through Markov.
  const authored = (text, kind, theme, order = 9) => {
    const toks = tokenize(text);
    const { perplexity, surprisal } = ref.score(toks);
    return b.add({ kind, theme, themeLabel: themeLabel(theme), order, perplexity, surprisal, text, authored: true });
  };

  // ---- 1. Oases ----------------------------------------------------------
  const oasisThemes = shuffle(b.rand, themeKeys);
  const oases = [];
  for (let i = 0; i < cfg.oases; i++) {
    const theme = oasisThemes[i % oasisThemes.length];
    // small islands are the norm; the occasional larger archipelago
    const size = b.rand() < 0.6 ? randInt(b.rand, 1, 2) : randInt(b.rand, 3, 6);
    const ids = [];
    for (let k = 0; k < size; k++) {
      const order = pick(b.rand, ORDERS.oasis); // 7 or 8 — coherent but not verbatim
      ids.push(gen(theme, order, 'oasis', randInt(b.rand, 70, 110), `oasis${i}-${k}`));
    }
    // interconnect island nodes in a ring so the player can wander an oasis
    for (let k = 0; k < ids.length; k++) b.link(ids[k], ids[(k + 1) % ids.length]);
    oases.push({ theme, ids, entry: ids[0] });
  }

  const startNode = oases[0].entry;
  b.nodes.get(startNode).kind = 'oasis';

  // ---- 2. Spine: connect every oasis (random spanning tree + a few loops) --
  const corridorBetween = (aId, bId, theme, profileName, lenRange = [cfg.corridorMin, cfg.corridorMax]) => {
    const len = randInt(b.rand, lenRange[0], lenRange[1]);
    const profile = profileName ?? weightedProfile(b.rand);
    const orders = PROFILES[profile](b.rand, len, {});
    let prev = aId;
    let firstMid = null;
    for (let i = 0; i < len; i++) {
      const c = gen(theme, orders[i], 'corridor', randInt(b.rand, 42, 72), `cor-${aId}-${bId}-${i}-${b.seq}`);
      b.nodes.get(c).profile = profile;
      b.link(prev, c);
      prev = c;
      if (i === 0) firstMid = c;
    }
    if (bId) b.link(prev, bId);
    return { head: firstMid, tail: prev, len };
  };

  for (let i = 1; i < oases.length; i++) {
    const j = randInt(b.rand, 0, i - 1); // connect to an earlier oasis
    corridorBetween(oases[i].entry, oases[j].entry, oases[i].theme);
  }
  // extra loops for genuine choice (multiple ways between regions)
  const extraLoops = Math.ceil(oases.length * 0.5);
  for (let i = 0; i < extraLoops; i++) {
    const a = pick(b.rand, oases), c = pick(b.rand, oases);
    if (a !== c) corridorBetween(a.entry, c.entry, a.theme);
  }

  // ---- 3. Maze growth: sprawl until we hit the node target ----------------
  // Most of the library is hall. We sprout corridors off existing nodes; some
  // loop back (more routes), most are spurs (lost halls that go nowhere).
  const allIds = () => [...b.nodes.keys()];
  let guard = 0;
  while (b.nodes.size < cfg.nodesTarget && guard++ < cfg.nodesTarget * 3) {
    const anchorId = pick(b.rand, allIds());
    const anchor = b.nodes.get(anchorId);
    if (anchor.kind === 'exit' || anchor.kind === 'mimic') continue;
    const theme = anchor.theme;
    const loop = b.rand() < 0.35;
    const dest = loop ? pick(b.rand, oases).entry : null;
    corridorBetween(anchorId, dest, theme, undefined, [2, cfg.corridorMax]);
  }

  // ---- 4. Mimics: beautiful dead ends ------------------------------------
  // Approach via false_summit/cliff (reads like you're nearing an oasis), then a
  // cluster of high-order nodes that connects to NOTHING onward. A few summits
  // carry an authored-feeling decoy to bait recognition of the real exit.
  const cleanIds = () => allIds().filter((id) => {
    const k = b.nodes.get(id).kind; return k === 'corridor' || k === 'oasis';
  });
  for (let m = 0; m < cfg.mimics; m++) {
    const anchorId = pick(b.rand, cleanIds());
    const theme = b.nodes.get(anchorId).theme;
    const approach = corridorBetween(anchorId, null, theme, b.rand() < 0.6 ? 'false_summit' : 'cliff', [3, 6]);
    // terminal cluster
    const size = randInt(b.rand, 2, 5);
    const cluster = [];
    for (let k = 0; k < size; k++) cluster.push(gen(theme, pick(b.rand, [7, 8]), 'mimic', randInt(b.rand, 60, 100), `mimic${m}-${k}`));
    for (let k = 0; k < cluster.length; k++) b.link(cluster[k], cluster[(k + 1) % cluster.length]);
    b.link(approach.tail, cluster[0]);
    // bait: a subset of mimics get an authored decoy at their summit
    if (m < FALSE_EXITS.length) {
      const decoy = authored(FALSE_EXITS[m], 'mimic', theme, 8);
      b.link(cluster[cluster.length - 1], decoy);
    }
  }

  // ---- 5. The exit: beyond the farthest oasis, through the worst noise -----
  const dist = bfsDistances(b, startNode);
  let far = oases[0], best = -1;
  for (const o of oases) { const d = dist.get(o.entry) ?? -1; if (d > best) { best = d; far = o; } }
  // a plunge into salad, then breakthrough
  const plunge = corridorBetween(far.entry, null, far.theme, 'cliff', [4, 6]);
  const exitId = authored(EXIT_TEXT, 'exit', far.theme, 9);
  b.nodes.get(exitId).coherenceOverride = 1.0;
  b.link(plunge.tail, exitId);

  // ---- 6. Coherence normalization ----------------------------------------
  // Primary signal: assigned Markov order (the design's ground truth). Secondary:
  // reference-model perplexity, for organic within-order variation. (See
  // DECISIONS.md: an n-gram reference saturates above its order, so order leads.)
  const perps = [...b.nodes.values()].map((n) => Math.log(n.perplexity + 1));
  const pMin = Math.min(...perps), pMax = Math.max(...perps);
  for (const n of b.nodes.values()) {
    const orderTerm = (Math.min(8, Math.max(1, n.order)) - 1) / 7;
    const lp = Math.log(n.perplexity + 1);
    const perpTerm = pMax > pMin ? 1 - (lp - pMin) / (pMax - pMin) : 0.5;
    n.coherence = n.coherenceOverride ?? Math.max(0, Math.min(1, 0.7 * orderTerm + 0.3 * perpTerm));
    delete n.coherenceOverride;
    delete n.surprisal;
  }

  // ---- 6b. Authored bleed-through ----------------------------------------
  // Splice one true, authored sentence into a small fraction of corridor/mimic
  // rooms — the older hand showing through the noise. We splice AFTER the first
  // sentence so the room's opening (and thus its hallway preview) stays Markov:
  // the bleed is found by reading, never advertised by a glimpse. Placement is
  // weighted to mid-depth and ignores whether a room leads anywhere — following
  // the meaning must remain a trap, not a strategy. (docs/NEXT_MOVEMENTS.md §1)
  const bleedRand = rng(`${seed}:bleed`);
  const maxDist = Math.max(...[...dist.values()]);
  let bleedPool = [...b.nodes.values()].filter((n) => {
    if (n.kind !== 'corridor' && n.kind !== 'mimic') return false;
    const d = dist.get(n.id) ?? 0;
    return d >= maxDist * 0.18 && d <= maxDist * 0.85; // mid-depth band
  });
  bleedPool = shuffle(bleedRand, bleedPool);
  const bleedCount = Math.max(8, Math.round(b.nodes.size * 0.04));
  const frags = shuffle(bleedRand, FRAGMENTS);
  for (let i = 0; i < Math.min(bleedCount, bleedPool.length); i++) {
    const node = bleedPool[i];
    const fragment = frags[i % frags.length];
    const parts = node.text.split(/(?<=[.!?”"])\s+/);
    if (parts.length <= 1) node.text = node.text + ' ' + fragment;
    else {
      const at = 1 + Math.floor(bleedRand() * (parts.length - 1));
      parts.splice(at, 0, fragment);
      node.text = parts.join(' ');
    }
    node.bleed = true;
  }

  // ---- 7. Previews (peer down each hall) ----------------------------------
  for (const n of b.nodes.values()) {
    for (const e of n.exits) {
      const t = b.nodes.get(e.to);
      e.preview = tokenize(t.text).slice(0, 9).join(' ').replace(/\s+([.,;:!?])/g, '$1');
    }
  }

  // ---- 8. Validate --------------------------------------------------------
  const report = validate(b, startNode, exitId);

  const graph = {
    meta: {
      title: 'PALIMPSEST',
      seed, scale,
      generatedAt: new Date().toISOString(),
      nodeCount: b.nodes.size,
      oasisCount: oases.length,
      themes: [...new Set([...b.nodes.values()].map((n) => n.themeLabel))],
      bleedCount: [...b.nodes.values()].filter((n) => n.bleed).length,
      stats: report.stats,
      codas: EXIT_CODAS, // behavior-keyed endings, read by the runtime
    },
    start: startNode,
    exit: exitId,
    nodes: Object.fromEntries([...b.nodes.values()].map((n) => [n.id, {
      id: n.id, kind: n.kind, theme: n.theme, themeLabel: n.themeLabel,
      order: n.order, coherence: Math.round(n.coherence * 1000) / 1000,
      perplexity: Math.round(n.perplexity * 10) / 10,
      profile: n.profile, authored: n.authored || undefined,
      bleed: n.bleed || undefined,
      text: n.text,
      exits: n.exits.map((e) => ({ to: e.to, preview: e.preview })),
    }])),
  };
  return { graph, report };
}

function bfsDistances(b, start) {
  const dist = new Map([[start, 0]]);
  const q = [start];
  while (q.length) {
    const cur = q.shift();
    for (const e of b.nodes.get(cur).exits) {
      if (!dist.has(e.to)) { dist.set(e.to, dist.get(cur) + 1); q.push(e.to); }
    }
  }
  return dist;
}

// Reconstruct an actual shortest path (not just a reachability bit) so we can
// exhibit a concrete solution and re-check every edge along it.
function shortestPath(b, start, goal) {
  const prev = new Map([[start, null]]);
  const q = [start];
  while (q.length) {
    const cur = q.shift();
    if (cur === goal) break;
    for (const e of b.nodes.get(cur).exits) if (!prev.has(e.to)) { prev.set(e.to, cur); q.push(e.to); }
  }
  if (!prev.has(goal)) return null;
  const path = []; let c = goal;
  while (c != null) { path.unshift(c); c = prev.get(c); }
  return path;
}

// Prove the world is solvable — and fail the build loudly if it is not, so a
// broken world is never written. "Solvable" here is total: not just that a path
// from start to exit exists, but that the exit is reachable from EVERY room
// (edges are bidirectional, so there are no soft-locks — you can always read
// your way back out and on). The intended route also never *requires* a mimic.
export function validate(b, start, exit) {
  const N = b.nodes.size;
  if (b.nodes.get(exit)?.kind !== 'exit') throw new Error('INVARIANT VIOLATED: exit node missing/mistyped');

  // 1. a concrete start→exit solution, with every edge on it re-verified
  const path = shortestPath(b, start, exit);
  if (!path) throw new Error('UNSOLVABLE: no path from start to exit');
  for (let i = 1; i < path.length; i++) {
    if (!b.nodes.get(path[i - 1]).exits.some((e) => e.to === path[i])) {
      throw new Error('UNSOLVABLE: reconstructed solution path has a broken edge');
    }
  }

  // 2. no orphans — the whole library is a single connected world
  const fromStart = bfsDistances(b, start);
  const orphan = N - fromStart.size;
  if (orphan > 0) throw new Error(`INVARIANT VIOLATED: ${orphan} orphan room(s) unreachable from start`);

  // 3. solvable from ANYWHERE — every room can still reach the exit (no soft-lock).
  // Edges are bidirectional, so rooms-that-can-reach-the-exit == BFS from exit.
  const canReach = bfsDistances(b, exit);
  if (canReach.size !== N) throw new Error(`INVARIANT VIOLATED: ${N - canReach.size} room(s) cannot reach the exit (soft-lock)`);

  // 4. the false-coherence trap holds: the exit is reachable without ever
  // passing through a mimic (mimics are true dead ends)
  if (!reachableAvoiding(b, start, (n) => n.kind === 'mimic').has(exit)) {
    throw new Error('INVARIANT VIOLATED: exit only reachable through a mimic');
  }

  const orders = {}, kinds = {};
  for (const n of b.nodes.values()) { orders[n.order] = (orders[n.order] || 0) + 1; kinds[n.kind] = (kinds[n.kind] || 0) + 1; }
  return {
    stats: {
      solvable: true,
      solutionLength: path.length - 1,
      canReachExit: canReach.size, reachableFromStart: fromStart.size, orphan,
      exitDistance: fromStart.get(exit),
      kinds, orderHistogram: orders,
      meanCoherence: round([...b.nodes.values()].reduce((s, n) => s + (n.coherence ?? 0), 0) / b.nodes.size),
    },
  };
}

function reachableAvoiding(b, start, avoid) {
  const seen = new Set([start]);
  const q = [start];
  while (q.length) {
    const cur = q.shift();
    for (const e of b.nodes.get(cur).exits) {
      const t = b.nodes.get(e.to);
      if (seen.has(e.to) || (avoid(t) && t.id !== start)) continue;
      seen.add(e.to); q.push(e.to);
    }
  }
  return seen;
}

const round = (x) => Math.round(x * 1000) / 1000;

if (import.meta.url === `file://${process.argv[1]}`) {
  const scale = process.env.GRAPH_SCALE || 'minimal';
  console.log(`building PALIMPSEST graph (scale=${scale}, seed=${SEED})...`);
  const { graph, report } = await build({ scale });
  await mkdir('web/data', { recursive: true });
  const json = JSON.stringify(graph);
  await writeFile(PATHS.graph, json);
  // Also emit a classic-script wrapper so the game runs from file:// with no
  // server (browsers block fetch + ES modules over file://).
  await writeFile('web/data/graph.js', `window.GRAPH=${json};\n`);
  const kb = (json.length / 1024).toFixed(0);
  console.log(`wrote ${PATHS.graph} + graph.js (${kb} KB)`);
  console.log(`SOLVABLE ✓  start→exit in ${report.stats.solutionLength} steps · all ${graph.meta.nodeCount} rooms can reach the exit`);
  console.log(JSON.stringify(report.stats, null, 2));
}
