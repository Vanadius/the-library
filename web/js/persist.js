/* Meta-persistence.
 *
 * The roguelike conceit (per the design): the *character* doesn't progress, the
 * *player* does. We persist two things:
 *   1. META — cumulative knowledge across all runs: how much you've read, how
 *      many runs, whether you've ever found the exit. This is what "trains your
 *      ear" and eventually unlocks the (unreliable) compass.
 *   2. RUN — your position in the current world so closing the tab doesn't strand
 *      you. Finding the exit ends a run; a new run resets position but never the
 *      META. The library is the same world (one build = one world); only you
 *      change.
 */
P.persist = (function () {
  const META_KEY = 'palimpsest.meta.v1';
  const runKey = (seed) => `palimpsest.run.${seed}.v1`;

  const defaultsMeta = () => ({
    nodesRead: 0,     // cumulative distinct-ish reads across runs
    steps: 0,         // cumulative moves
    runs: 0,
    everFound: false,
    recovered: {},    // the Restoration: pages of the older book, idx -> text.
                      // Persist across runs AND rebuilds — the buried book is the
                      // same book in every world; what you have recovered, you keep.
    firstSeen: Date.now(),
  });

  function load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v && typeof v === 'object' ? v : fallback(); }
    catch (e) { return fallback(); }
  }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  let meta = load(META_KEY, defaultsMeta);

  function newRun(seed) {
    return { seed, pos: null, visited: {}, journal: [], steps: 0, started: Date.now(), found: false };
  }

  return {
    meta() { return meta; },
    saveMeta() { save(META_KEY, meta); },

    // The Restoration: record a fully-excavated page of the older book.
    recoverPage(idx, text) {
      if (idx == null || idx < 0) return false;
      if (!meta.recovered) meta.recovered = {};
      if (meta.recovered[idx]) return false;
      meta.recovered[idx] = text;
      save(META_KEY, meta);
      return true; // newly recovered
    },
    recoveredPages() {
      const rec = meta.recovered || {};
      return Object.keys(rec).map(Number).sort((a, b) => a - b).map((i) => ({ idx: i, text: rec[i] }));
    },

    loadRun(seed) {
      const r = load(runKey(seed), () => newRun(seed));
      r.seed = seed;
      if (!r.visited) r.visited = {};
      if (!r.journal) r.journal = [];
      return r;
    },
    saveRun(run) { save(runKey(run.seed), run); },
    resetRun(seed) { const r = newRun(seed); save(runKey(seed), r); return r; },

    // Forget everything: position, journal, AND cumulative knowledge. The
    // compass re-locks; you arrive new. Clears every palimpsest.* key so it
    // works no matter which world's seed you've played.
    wipe() {
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith('palimpsest.')) localStorage.removeItem(k);
        }
      } catch (e) {}
      meta = defaultsMeta();
    },

    // "The ear": a 0..1 sense of how attuned the player is, from cumulative
    // reading. Drives the compass unlock. Deliberately slow — attunement is earned.
    ear() {
      const n = meta.nodesRead;
      return Math.max(0, Math.min(1, Math.log10(1 + n / 12) / Math.log10(1 + 220 / 12)));
    },
    compassUnlocked() { return meta.nodesRead >= 160 || meta.everFound; },
  };
})();
