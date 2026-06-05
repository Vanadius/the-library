/* Engine — world state and navigation.
 *
 * The runtime is a reader, not a generator (design: zero ML at runtime). It
 * loads the pre-baked graph and tracks where you are, where you've been, and a
 * smoothed sense of how lost you are. That smoothing matters: immediate text
 * clarity reflects the room you're in, but the HUD's *drift* lags and lingers —
 * so wading through a stretch of noise leaves a residue on your interface that
 * doesn't lift the instant you find one clear room. That residue is the
 * apophenia the design asks for.
 *
 * It also keeps the memory aids (the dissolving trail, the journal beacons), the
 * quiet metrics that choose your ending, and the seeds for the unseen presence.
 * See docs/NEXT_MOVEMENTS.md §3–5.
 */
P.engine = (function () {
  const { clamp, rng, pick } = P.core;

  const PRESENCE = [
    'this mark is fresh. it was not here when you passed before.',
    'someone has been through since you left — the dust is disturbed.',
    'a page has been turned down that you did not turn.',
    'your own hand, you think. but the letters are not quite the way you make them.',
    'something has read this room after you, and not long ago.',
    'the chair is warm. you have not been sitting.',
    'there are more tally marks than there were. you did not add them.',
  ];

  const state = {
    graph: null, run: null, node: null,
    ema: 1, streakLow: 0,
    onChange: null, ended: false,
    regionChanged: false, enteredRegion: null,
    justDescended: null, falseStair: false,
    lastMoveTime: 0,
  };

  const freshMetrics = () => ({ up: 0, down: 0, minCoh: 1, dwellSum: 0, dwellN: 0,
    followWarmth: 0, compassMoves: 0, retreats: 0, deepRooms: 0, descents: 0, falseStairs: 0 });

  function init(graph) {
    state.graph = graph;
    const run = P.persist.loadRun(graph.meta.seed);
    if (!run.pos || !graph.nodes[run.pos]) run.pos = graph.start;
    if (!run.trail) run.trail = [];
    if (!run.metrics) run.metrics = freshMetrics();
    state.run = run;
    state.node = graph.nodes[run.pos];
    state.ema = state.node.coherence;
    state.lastMoveTime = Date.now();
    P.persist.saveRun(run);
    return state.node;
  }

  function node(id) { return state.graph.nodes[id]; }
  function current() { return state.node; }
  function visitedCount(id) { return state.run.visited[id] || 0; }

  function move(toId) {
    if (state.ended) return;
    const target = node(toId);
    if (!target) return;
    const prev = state.node;
    const m = state.run.metrics;

    // --- behaviour metrics (the private mirror that picks your ending) -------
    const now = Date.now();
    const dwell = now - state.lastMoveTime;
    if (dwell > 400 && dwell < 180000) { m.dwellSum += dwell; m.dwellN++; }
    state.lastMoveTime = now;
    if (prev) {
      if (target.coherence > prev.coherence + 0.05) m.up++;
      else if (target.coherence < prev.coherence - 0.05) m.down++;
      // did you follow the warmth? (only counts once the compass exists)
      if (P.persist.compassUnlocked()) {
        m.compassMoves++;
        const warmest = Math.max(...prev.exits.map((e) => node(e.to).coherence));
        if (target.coherence >= warmest - 1e-6) m.followWarmth++;
      }
      if (toId === state.run.trail[0]) m.retreats++; // stepped back the way you came
    }
    m.minCoh = Math.min(m.minCoh, target.coherence);
    if (target.coherence < 0.2) m.deepRooms++;

    // --- descending a stratum: a clean break, a new small world -------------
    const descended = prev && (target.stratum ?? 0) > (prev.stratum ?? 0);
    state.justDescended = descended ? (target.stratum ?? 0) : null;

    // --- the dissolving trail (reset when you drop a floor) -----------------
    if (descended) state.run.trail = [];
    else if (prev) { state.run.trail.unshift(prev.id); state.run.trail = state.run.trail.slice(0, 8); }

    // crossing into a different source-voice is a sense of place worth marking
    const fromTheme = prev ? prev.theme : null;
    state.regionChanged = !descended && fromTheme !== null && fromTheme !== target.theme;
    state.enteredRegion = state.regionChanged ? target.themeLabel : null;

    state.node = target;
    state.run.pos = toId;
    state.run.visited[toId] = (state.run.visited[toId] || 0) + 1;
    state.run.steps++;
    if ((target.stratum ?? 0) > (state.run.deepest ?? 0)) state.run.deepest = target.stratum;

    const meta = P.persist.meta();
    meta.steps++;
    if (state.run.visited[toId] === 1) meta.nodesRead++;
    if ((target.stratum ?? 0) > (meta.deepestEver ?? 0)) meta.deepestEver = target.stratum;

    // A sanctuary clears the residue: arriving at an oasis heals the drift, so
    // the HUD comes back to truth and you can rest and orient.
    if (target.sanctuary) { state.ema = 1; state.streakLow = 0; }
    else { state.ema = state.ema * 0.7 + target.coherence * 0.3; state.streakLow = target.coherence < 0.42 ? state.streakLow + 1 : 0; }

    if (target.kind === 'exit') reachExit();

    P.persist.saveRun(state.run);
    P.persist.saveMeta();
    if (state.onChange) state.onChange();
  }

  // Take the stair in the current room. A true stair carries you down to the
  // next sanctuary; a false one gives way into a dead end you must climb out of.
  // You only know which by having read the passage.
  function descend() {
    const n = state.node;
    if (!n || !n.descent || !n.down || state.ended) return;
    if (n.descent === 'down') { state.run.metrics.descents++; move(n.down); }
    else { state.run.metrics.falseStairs++; state.falseStair = true; move(n.down); }
  }

  // Depth — the felt progress of the Descent.
  function stratum() { return state.node ? (state.node.stratum ?? 0) : 0; }
  function totalStrata() { return (state.graph.meta && state.graph.meta.strata) || 1; }
  function strataRemaining() { return Math.max(0, totalStrata() - 1 - stratum()); }

  function reachExit() {
    state.ended = true;
    state.run.found = true;
    const meta = P.persist.meta();
    if (!meta.everFound) meta.everFound = true;
    meta.runs++;
  }

  function newRun() {
    state.run = P.persist.resetRun(state.graph.meta.seed);
    state.run.trail = [];
    state.run.metrics = freshMetrics();
    state.node = node(state.graph.start);
    state.ema = state.node.coherence;
    state.streakLow = 0;
    state.lastMoveTime = Date.now();
    state.ended = false;
    if (state.onChange) state.onChange();
  }

  function drift() {
    return clamp((1 - state.ema) * 0.85 + Math.min(state.streakLow, 8) / 8 * 0.28, 0, 0.82);
  }
  function localCoherence() { return state.node ? state.node.coherence : 1; }

  // --- memory aids (docs/NEXT_MOVEMENTS.md §3) ------------------------------
  // How many steps of trail you can still feel — shrinks as you get lost. Pure
  // retreat memory; never points forward, never toward the exit.
  function trailReach() { return clamp(Math.round(4 * (1 - drift())), 0, 4); }
  function trailIndex(id) { const i = state.run.trail.indexOf(id); return i; }
  function isJournalled(id) { return state.run.journal.some((e) => e.at === id); }
  // Beacons (journalled rooms, one hop away) decay on the note-drift curve.
  function beaconStrength() { return clamp(1 - drift() * 1.3); }

  // --- the unseen presence (docs/NEXT_MOVEMENTS.md §4) ---------------------
  // A fresh mark, only on return, more likely the deeper you are. Never a
  // navigational tell — it appears regardless of where a room leads.
  function presenceMark(n) {
    if (visitedCount(n.id) < 2) return null;
    const d = drift();
    const rand = rng(n.id + '|presence|' + visitedCount(n.id));
    if (rand() > 0.1 + d * 0.4) return null;
    return pick(rand, PRESENCE);
  }
  // A hall that reads as recently disturbed. Seeded by step count, so it shifts
  // as you move — never fixed, never reliable, never correlated with safety.
  function disturbedAhead(targetId) {
    const rand = rng(targetId + '|disturbed|' + state.run.steps);
    return rand() < drift() * 0.13;
  }

  // --- ending selection (docs/NEXT_MOVEMENTS.md §5) ------------------------
  // A private reflection, scored from how you travelled. Never surfaced as a
  // rubric — only as the one coda that fits best.
  function endingArchetype() {
    const m = state.run.metrics;
    const moves = m.up + m.down || 1;
    const downBias = m.down / moves;
    const followRate = m.compassMoves ? m.followWarmth / m.compassMoves : 0;
    const meanDwell = m.dwellN ? m.dwellSum / m.dwellN : 0;
    const retreatRate = state.run.steps ? m.retreats / state.run.steps : 0;
    const scores = {
      trusting: (m.compassMoves >= 4 ? followRate * 1.25 : 0),
      diver: (0.3 - Math.min(m.minCoh, 0.3)) / 0.3 * 0.7 + Math.min(m.deepRooms / 10, 1) * 0.6,
      doubter: Math.min(retreatRate / 0.25, 1),
      cartographer: Math.min(m.minCoh / 0.38, 1) * 0.8 + (1 - downBias) * 0.4,
      reader: Math.min(meanDwell / 12000, 1) * 1.05,
    };
    return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  }
  function endingCoda() {
    const codas = (state.graph.meta && state.graph.meta.codas) || {};
    const key = endingArchetype();
    return { key, text: codas[key] || '' };
  }

  // Journal
  function addNote(text) {
    const n = state.node;
    state.run.journal.push({ at: n.id, loc: n.themeLabel, coh: n.coherence, text, t: Date.now() });
    P.persist.saveRun(state.run);
  }
  function journal() { return state.run.journal; }
  function noteWords() {
    const ws = [];
    for (const e of state.run.journal) for (const w of e.text.split(/\s+/)) if (w.length > 3) ws.push(w);
    return ws;
  }

  return {
    init, current, node, move, newRun, drift, localCoherence, visitedCount,
    addNote, journal, noteWords,
    regionChanged: () => state.regionChanged,
    enteredRegion: () => state.enteredRegion,
    descend, stratum, totalStrata, strataRemaining,
    justDescended: () => state.justDescended,
    clearDescended: () => { state.justDescended = null; },
    falseStairTaken: () => { const f = state.falseStair; state.falseStair = false; return f; },
    trailReach, trailIndex, isJournalled, beaconStrength,
    presenceMark, disturbedAhead, endingArchetype, endingCoda,
    state,
    set onChange(fn) { state.onChange = fn; },
    isEnded: () => state.ended,
    run: () => state.run,
  };
})();
