/* Engine — world state and navigation.
 *
 * The runtime is a reader, not a generator (design: zero ML at runtime). It
 * loads the pre-baked graph and tracks where you are, where you've been, and a
 * smoothed sense of how lost you are. That smoothing matters: immediate text
 * clarity reflects the room you're in, but the HUD's *drift* lags and lingers —
 * so wading through a stretch of noise leaves a residue on your interface that
 * doesn't lift the instant you find one clear room. That residue is the
 * apophenia the design asks for: the longer you're in the deep, the less you can
 * trust your own instruments, and the slower that trust returns.
 */
P.engine = (function () {
  const { clamp } = P.core;

  const state = {
    graph: null,
    run: null,
    node: null,
    ema: 1,         // exponential moving average of recent coherence
    streakLow: 0,   // consecutive low-coherence rooms (fatigue)
    onChange: null,
    ended: false,
  };

  function init(graph) {
    state.graph = graph;
    const run = P.persist.loadRun(graph.meta.seed);
    if (!run.pos || !graph.nodes[run.pos]) run.pos = graph.start;
    state.run = run;
    state.node = graph.nodes[run.pos];
    // seed the moving average from the current node so a resumed run feels right
    state.ema = state.node.coherence;
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
    state.node = target;
    state.run.pos = toId;
    state.run.visited[toId] = (state.run.visited[toId] || 0) + 1;
    state.run.steps++;

    // cumulative knowledge — first read of a room teaches you the most
    const meta = P.persist.meta();
    meta.steps++;
    if (state.run.visited[toId] === 1) meta.nodesRead++;

    // update the lagging drift signal
    const coh = target.coherence;
    state.ema = state.ema * 0.7 + coh * 0.3;
    state.streakLow = coh < 0.42 ? state.streakLow + 1 : 0;

    if (target.kind === 'exit') reachExit();

    P.persist.saveRun(state.run);
    P.persist.saveMeta();
    if (state.onChange) state.onChange();
  }

  function reachExit() {
    state.ended = true;
    state.run.found = true;
    const meta = P.persist.meta();
    if (!meta.everFound) meta.everFound = true;
    meta.runs++;
  }

  function newRun() {
    state.run = P.persist.resetRun(state.graph.meta.seed);
    state.node = node(state.graph.start);
    state.ema = state.node.coherence;
    state.streakLow = 0;
    state.ended = false;
    if (state.onChange) state.onChange();
  }

  // 0..1 corruption applied to the HUD. Lags behind the rooms (ema) and worsens
  // with a low-coherence streak (fatigue). Capped so the UI stays usable.
  function drift() {
    return clamp((1 - state.ema) * 0.85 + Math.min(state.streakLow, 8) / 8 * 0.28, 0, 0.82);
  }
  function localCoherence() { return state.node ? state.node.coherence : 1; }

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
    state,
    set onChange(fn) { state.onChange = fn; },
    isEnded: () => state.ended,
    run: () => state.run,
  };
})();
