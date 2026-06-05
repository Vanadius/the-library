/* PALIMPSEST runtime — shared core.
 *
 * Classic script (no ES modules) so the game runs straight off the filesystem.
 * Everything hangs off the single global `P`. The graph arrives as window.GRAPH.
 */
window.P = window.P || {};

P.core = (function () {
  // mulberry32 — same generator the build pipeline uses, so "deterministic"
  // means the same thing on both sides.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const rng = (seed) => mulberry32(typeof seed === 'string' ? hash(seed) : seed >>> 0);
  const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
  const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
  const el = (id) => document.getElementById(id);

  function h(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
    }
    if (children != null) (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  return { mulberry32, hash, rng, clamp, pick, el, h };
})();
