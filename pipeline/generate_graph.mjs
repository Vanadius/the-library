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
import { TRUE_DESCENTS, FALSE_DESCENTS } from './descent_text.mjs';
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

  // ---- Topology: THE DESCENT ---------------------------------------------
  // A stack of strata. Each is a small bounded world with a sanctuary oasis, a
  // maze of corridors, a mimic or two, exactly one TRUE stair down (an authored
  // passage you recognize by reading), and a fake stair or two. You descend by
  // finding the true stair; the deepest stratum's stair is the exit itself.
  const S = cfg.strata;
  const themes = shuffle(b.rand, themeKeys);

  // A corridor of `len` rooms from aId, optionally to bId, tagged into a stratum.
  // Returns every room it created so the caller can grow a bounded region.
  const corridor = (aId, bId, theme, stratum, profileName, lenRange = [cfg.corridorMin, cfg.corridorMax]) => {
    const len = randInt(b.rand, lenRange[0], lenRange[1]);
    const profile = profileName ?? weightedProfile(b.rand);
    const orders = PROFILES[profile](b.rand, len, {});
    const ids = [];
    let prev = aId;
    for (let i = 0; i < len; i++) {
      const c = gen(theme, orders[i], 'corridor', randInt(b.rand, 42, 72), `s${stratum}-cor-${b.seq}`);
      b.nodes.get(c).profile = profile;
      b.nodes.get(c).stratum = stratum;
      b.link(prev, c); prev = c; ids.push(c);
    }
    if (bId) b.link(prev, bId);
    return { tail: prev, ids };
  };

  const strata = [];
  for (let s = 0; s < S; s++) {
    const theme = themes[s % themes.length];
    const last = s === S - 1;

    // The sanctuary you arrive in: a coherent oasis, the layer's landmark.
    const entry = gen(theme, pick(b.rand, ORDERS.oasis), 'oasis', randInt(b.rand, 80, 120), `s${s}-entry`);
    const en = b.nodes.get(entry); en.stratum = s; en.sanctuary = true; en.entry = true;
    const region = [entry];

    // Maybe a second oasis deeper in the layer.
    if (b.rand() < cfg.extraOasis) {
      const o2 = gen(theme, pick(b.rand, ORDERS.oasis), 'oasis', randInt(b.rand, 70, 110), `s${s}-o2`);
      b.nodes.get(o2).stratum = s; b.nodes.get(o2).sanctuary = true;
      corridor(entry, o2, theme, s).ids.forEach((id) => region.push(id));
      region.push(o2);
    }

    // Grow a bounded maze inside the stratum.
    let guard = 0;
    const target = cfg.roomsPerStratum;
    while (region.length < target && guard++ < target * 5) {
      const anchorId = pick(b.rand, region);
      const ak = b.nodes.get(anchorId).kind;
      if (ak !== 'corridor' && ak !== 'oasis') continue;
      const loop = b.rand() < 0.3;
      const dest = loop ? pick(b.rand, region) : null;
      corridor(anchorId, dest, theme, s, undefined, [2, cfg.corridorMax]).ids.forEach((id) => region.push(id));
    }

    // Mimics: beautiful dead ends inside the layer.
    const corridorsOf = () => region.filter((id) => b.nodes.get(id).kind === 'corridor');
    const nMimics = randInt(b.rand, cfg.mimicsPerStratum[0], cfg.mimicsPerStratum[1]);
    for (let m = 0; m < nMimics; m++) {
      const base = corridorsOf(); if (!base.length) break;
      const anchorId = pick(b.rand, base);
      const approach = corridor(anchorId, null, theme, s, b.rand() < 0.6 ? 'false_summit' : 'cliff', [2, 5]);
      const size = randInt(b.rand, 2, 4);
      const cluster = [];
      for (let k = 0; k < size; k++) { const c = gen(theme, pick(b.rand, [7, 8]), 'mimic', randInt(b.rand, 60, 100), `s${s}-mim${m}-${k}`); b.nodes.get(c).stratum = s; cluster.push(c); }
      for (let k = 0; k < cluster.length; k++) b.link(cluster[k], cluster[(k + 1) % cluster.length]);
      b.link(approach.tail, cluster[0]);
    }

    // The TRUE stair down — authored, embedded at a moderate distance from the
    // sanctuary: far enough to require reading your way to it, near enough that a
    // floor is a brisk search and not a slog.
    const distFromEntry = bfsDistances(b, entry);
    const corr = corridorsOf().filter((id) => distFromEntry.has(id)).sort((a, c) => (distFromEntry.get(a) ?? 0) - (distFromEntry.get(c) ?? 0));
    const far = corr.length ? corr[Math.floor(corr.length * 0.6)] : entry;
    const trueText = last ? EXIT_TEXT : TRUE_DESCENTS[s % TRUE_DESCENTS.length];
    const stair = authored(trueText, last ? 'exit' : 'descent', theme, 9);
    const st = b.nodes.get(stair); st.stratum = s; if (last) st.coherenceOverride = 1.0; else st.descent = 'down';
    corridor(far, stair, theme, s, 'steady_decline', [2, 4]);

    // FALSE stairs — authored fakes that offer "down" and drop you into a dead
    // end. They make the recognition a reading, not a reflex.
    if (!last) {
      const nFalse = randInt(b.rand, cfg.falseDescents[0], cfg.falseDescents[1]);
      for (let f = 0; f < nFalse; f++) {
        const base = corridorsOf(); if (!base.length) break;
        const anchorId = pick(b.rand, base);
        const approach = corridor(anchorId, null, theme, s, 'false_summit', [2, 4]);
        const fakeText = FALSE_DESCENTS[(s + f) % FALSE_DESCENTS.length];
        const fake = authored(fakeText, 'mimic', theme, 8);
        const fn = b.nodes.get(fake); fn.stratum = s; fn.descent = 'false';
        b.link(approach.tail, fake);
        // taking its "stair" drops into a small dead end you must climb back from
        const trap = gen(theme, pick(b.rand, [6, 7]), 'mimic', randInt(b.rand, 50, 80), `s${s}-trap${f}`);
        b.nodes.get(trap).stratum = s;
        b.link(fake, trap);
        fn.down = trap;
      }
    }

    // On the deepest floor, where the real exit hides, plant authored decoys —
    // beautiful fakes that read as meant but are dead ends — so the final
    // recognition stays an earned act of discrimination, not "click the one nice
    // paragraph."
    if (last) {
      const nDecoys = Math.min(2, FALSE_EXITS.length);
      for (let d = 0; d < nDecoys; d++) {
        const base = corridorsOf(); if (!base.length) break;
        const anchorId = pick(b.rand, base);
        const approach = corridor(anchorId, null, theme, s, 'false_summit', [2, 4]);
        const decoy = authored(FALSE_EXITS[d], 'mimic', theme, 8);
        b.nodes.get(decoy).stratum = s;
        b.link(approach.tail, decoy);
      }
    }

    strata.push({ entry, stair, theme, last });
  }

  // Chain the strata: each true stair descends to the next sanctuary.
  for (let s = 0; s < S - 1; s++) b.nodes.get(strata[s].stair).down = strata[s + 1].entry;

  const startNode = strata[0].entry;
  b.nodes.get(startNode).kind = 'oasis';
  const exitId = strata[S - 1].stair;

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
  let bleedPool = [...b.nodes.values()].filter((n) => {
    if (n.authored || n.descent) return false;            // never deface a real passage
    if (n.kind !== 'corridor' && n.kind !== 'mimic') return false;
    const s = n.stratum ?? 0;
    return s >= S * 0.15 && s <= S * 0.85;                // mid-depth strata
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
      strata: S,
      oasisCount: [...b.nodes.values()].filter((n) => n.kind === 'oasis').length,
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
      stratum: n.stratum ?? 0,
      sanctuary: n.sanctuary || undefined,
      entry: n.entry || undefined,
      descent: n.descent || undefined,
      down: n.down || undefined,
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

// Navigation neighbours: the hallways you can walk (bidirectional exits) PLUS
// the one-way stair down from a true descent. Solvability has to reason over the
// same graph the player actually traverses.
function navOut(node) {
  const out = node.exits.map((e) => e.to);
  if (node.descent === 'down' && node.down) out.push(node.down);
  return out;
}

function bfsNav(b, start) {
  const dist = new Map([[start, 0]]);
  const q = [start];
  while (q.length) {
    const cur = q.shift();
    for (const to of navOut(b.nodes.get(cur))) if (!dist.has(to)) { dist.set(to, dist.get(cur) + 1); q.push(to); }
  }
  return dist;
}

// Reconstruct an actual shortest path over the navigation graph so we can
// exhibit a concrete solution and re-check every edge (hallway or stair) on it.
function shortestPath(b, start, goal) {
  const prev = new Map([[start, null]]);
  const q = [start];
  while (q.length) {
    const cur = q.shift();
    if (cur === goal) break;
    for (const to of navOut(b.nodes.get(cur))) if (!prev.has(to)) { prev.set(to, cur); q.push(to); }
  }
  if (!prev.has(goal)) return null;
  const path = []; let c = goal;
  while (c != null) { path.unshift(c); c = prev.get(c); }
  return path;
}

// Rooms that can REACH the goal: reverse-BFS over the navigation graph.
function reverseReach(b, goal) {
  const rev = new Map();
  for (const n of b.nodes.values()) for (const to of navOut(n)) {
    if (!rev.has(to)) rev.set(to, []);
    rev.get(to).push(n.id);
  }
  const seen = new Set([goal]); const q = [goal];
  while (q.length) { const cur = q.shift(); for (const p of (rev.get(cur) || [])) if (!seen.has(p)) { seen.add(p); q.push(p); } }
  return seen;
}

// Prove the world is solvable — and fail the build loudly if it is not, so a
// broken world is never written. "Solvable" here is total: not just that a path
// from start to exit exists, but that the exit is reachable from EVERY room
// (edges are bidirectional, so there are no soft-locks — you can always read
// your way back out and on). The intended route also never *requires* a mimic.
export function validate(b, start, exit) {
  const N = b.nodes.size;
  if (b.nodes.get(exit)?.kind !== 'exit') throw new Error('INVARIANT VIOLATED: exit node missing/mistyped');

  // 1. a concrete start→exit solution (descending through the strata), with
  // every edge on it re-verified as a real hallway or a real stair
  const path = shortestPath(b, start, exit);
  if (!path) throw new Error('UNSOLVABLE: no path from start to exit');
  for (let i = 1; i < path.length; i++) {
    const u = b.nodes.get(path[i - 1]);
    const ok = u.exits.some((e) => e.to === path[i]) || (u.descent === 'down' && u.down === path[i]);
    if (!ok) throw new Error('UNSOLVABLE: reconstructed solution path has a broken edge');
  }

  // 2. no orphans — every room is reachable from the start
  const fromStart = bfsNav(b, start);
  const orphan = N - fromStart.size;
  if (orphan > 0) throw new Error(`INVARIANT VIOLATED: ${orphan} orphan room(s) unreachable from start`);

  // 3. solvable from ANYWHERE — every room can still reach the exit (no soft-lock).
  // Within a stratum you can always backtrack; descents carry you on. Reverse-BFS
  // over the navigation graph proves it.
  const canReach = reverseReach(b, exit);
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
    for (const to of navOut(b.nodes.get(cur))) {
      const t = b.nodes.get(to);
      if (seen.has(to) || (avoid(t) && t.id !== start)) continue;
      seen.add(to); q.push(to);
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
