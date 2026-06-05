/* UI degradation — the unreliable HUD.
 *
 * Per the design's hard constraint: this is a PRESENTATION effect only. It
 * drifts the chrome — status line, exit tags, your own journal notes, the
 * compass — based on local coherence. It NEVER touches the passage you read
 * (that's the honest data the whole game is about) and it NEVER alters game
 * state. Close the tab and reopen: your notes are pristine again. Only the
 * screen was lying.
 *
 * It is tuned to stay readable. The design: "subtle and escalating, never so
 * aggressive that it breaks usability." Amount caps well below garbage.
 */
P.degrade = (function () {
  const { rng, clamp } = P.core;

  const ACCENT = { a:'àáâä', e:'èéêë', i:'ìíîï', o:'òóôö', u:'ùúûü', n:'ñ', c:'ç', s:' š', y:'ý',
                   A:'ÀÁÂÄ', E:'ÈÉÊË', I:'ÌÍÎÏ', O:'ÒÓÔÖ', U:'ÙÚÛÜ', N:'Ñ' };
  const COMBINING = ['̀','́','̂','̃','̈','̣','̱'];

  // Subtle character-level drift for short HUD labels.
  function label(str, amount, seed) {
    if (amount <= 0.02) return str;
    const rand = rng((seed || str) + '|' + Math.round(amount * 20));
    const a = clamp(amount);
    let out = '';
    for (const ch of str) {
      const r = rand();
      if (/[a-zA-Z]/.test(ch) && ACCENT[ch] && r < a * 0.22) {
        const opts = ACCENT[ch].trim();
        out += opts[Math.floor(rand() * opts.length)] || ch;
      } else out += ch;
      if (a > 0.55 && rand() < (a - 0.55) * 0.5) out += COMBINING[Math.floor(rand() * COMBINING.length)];
    }
    return out;
  }

  // Word-level drift for the player's own journal notes — the trust mechanic.
  // Words decay toward other words you wrote (and a little ambient seepage), so
  // your record of where you've been quietly stops being true.
  const AMBIENT = ['elsewhere','again','the same','not here','further','nothing','a door','turn back',
                   'i think','perhaps','it lied','deeper','the light','no exit','warmer','colder'];
  function note(str, amount, seed, corpus) {
    if (amount <= 0.05) return str;
    const a = clamp(amount);
    const rand = rng((seed || '') + '|note|' + Math.round(a * 12));
    const pool = (corpus && corpus.length ? corpus : []).concat(AMBIENT);
    const words = str.split(/(\s+)/);
    return words.map((w) => {
      if (/^\s+$/.test(w) || w.length < 3) return w;
      const r = rand();
      if (r < a * 0.30) {
        const sub = pool[Math.floor(rand() * pool.length)];
        return preserveCase(w, sub);
      }
      if (r < a * 0.30 + a * 0.06) return ''; // a word goes missing
      return w;
    }).join('').replace(/\s{2,}/g, ' ');
  }

  function preserveCase(orig, repl) {
    if (/^[A-Z]/.test(orig)) return repl.charAt(0).toUpperCase() + repl.slice(1);
    return repl;
  }

  // Compass warmth as a glyph bar. value is destination coherence (0..1). drift
  // injects lies: in incoherent zones the reading is scrambled, so the compass
  // betrays you exactly where you'd most want to trust it.
  const GLYPHS = '·∴∷▒▓█';
  function warmth(value, drift, seed) {
    const rand = rng((seed || '') + '|warmth');
    const noise = (rand() - 0.5) * 2 * clamp(drift) * 0.9;
    const v = clamp(value + noise);
    const n = Math.round(v * 5);
    return GLYPHS[n] + GLYPHS[n]; // doubled for visual weight
  }

  return { label, note, warmth };
})();
