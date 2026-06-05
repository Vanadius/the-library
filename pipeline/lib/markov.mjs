// Variable-order word-level Markov chains.
//
// One MarkovCorpus wraps a single cleaned text (one "voice"). It tokenizes the
// text once, then builds an order-k transition table lazily the first time a
// given order is requested, caching it. This keeps memory bounded to the
// orders actually used by the graph rather than precomputing all of 1..9.
//
// Why word-level and not character-level: the design's whole terrain vocabulary
// ("eerily plausible", "coherent paragraphs") is about *semantic* drift across
// words and sentences. Word-level chains degrade in exactly the way the design
// describes — grammar survives a while, meaning doesn't.

import { mulberry32, hashSeed } from './rng.mjs';

const SEP = '\x00'; // context-key separator; never appears in real tokens

// Token = a word, a number, or a single punctuation mark. Keeping punctuation
// as its own token lets generated text carry sentence rhythm.
const TOKEN_RE = /[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*|[.,;:!?“”"'()—–-]/g;

export function tokenize(text) {
  return text.match(TOKEN_RE) ?? [];
}

// Re-join tokens into readable prose: no space before closing punctuation,
// no space after opening quotes/parens, capitalize after sentence breaks.
export function detokenize(tokens) {
  let out = '';
  let capNext = true;
  let openQuote = false;
  for (let tok of tokens) {
    const noSpaceBefore = /^[.,;:!?”’)\-—–]$/.test(tok) || (tok === '"' && openQuote) || (tok === '”');
    const prev = out.slice(-1);
    const afterOpen = /[“"('—–]$/.test(prev) || (prev === '"' && !openQuote);
    if (out && !noSpaceBefore && !afterOpen) out += ' ';
    if (capNext && /[A-Za-z]/.test(tok)) { tok = tok[0].toUpperCase() + tok.slice(1); capNext = false; }
    out += tok;
    if (tok === '"' || tok === '“' || tok === '”') openQuote = !openQuote;
    if (/[.!?]/.test(tok)) capNext = true;
  }
  return out.trim();
}

export class MarkovCorpus {
  constructor(key, text, { maxTokens = 90000 } = {}) {
    this.key = key;
    this.tokens = tokenize(text).slice(0, maxTokens);
    this._tables = new Map(); // order -> Map<contextKey, nextTokens[]>
  }

  // Build (and cache) the order-k table: context (k tokens) -> array of possible
  // next tokens. Duplicates in the array encode transition frequency naturally.
  table(order) {
    if (this._tables.has(order)) return this._tables.get(order);
    const t = new Map();
    const toks = this.tokens;
    for (let i = order; i < toks.length; i++) {
      const ctx = toks.slice(i - order, i).join(SEP);
      let arr = t.get(ctx);
      if (!arr) { arr = []; t.set(ctx, arr); }
      arr.push(toks[i]);
    }
    this._tables.set(order, t);
    return t;
  }

  // Generate ~targetWords tokens at the given Markov order, deterministically
  // from `seed`. Starts from a sentence-like k-gram when possible, and
  // re-anchors to a random known context on any dead end (itself a texture of
  // incoherence). Order 0 is pure unigram noise.
  generate(order, targetWords, seed) {
    const rand = mulberry32(typeof seed === 'string' ? hashSeed(seed) : seed >>> 0);
    const ord = Math.max(0, order);
    const table = this.table(Math.max(1, ord));
    const contexts = [...table.keys()];
    if (contexts.length === 0) return this.tokens.slice(0, targetWords);

    let ctx = (ord === 0 ? '' : this._startContext(contexts, rand)).split(SEP).filter(Boolean);
    const out = ctx.slice();

    let guard = 0;
    const cap = targetWords * 8 + 80;
    while (out.length < targetWords + ord && guard++ < cap) {
      const key = ord === 0 ? '' : ctx.join(SEP);
      let choices = ord === 0
        ? table.get(contexts[Math.floor(rand() * contexts.length)])
        : table.get(key);
      if (!choices || choices.length === 0) {
        ctx = contexts[Math.floor(rand() * contexts.length)].split(SEP).filter(Boolean);
        continue;
      }
      const next = choices[Math.floor(rand() * choices.length)];
      out.push(next);
      ctx = ord === 0 ? [] : [...ctx.slice(1), next].slice(-ord);
      if (out.length >= targetWords && /[.!?]/.test(next)) break; // end on a sentence
    }
    return out;
  }

  _startContext(contexts, rand) {
    let best = null;
    for (let i = 0; i < 32; i++) {
      const c = contexts[Math.floor(rand() * contexts.length)];
      const first = c.split(SEP)[0];
      if (/^[A-Z]/.test(first)) return c;
      if (!best) best = c;
    }
    return best ?? contexts[0];
  }

  // Dedup support. Reject any generated passage that reproduces a verbatim run
  // of >= L tokens from the source (the copyright concern at high orders). A set
  // of source L-grams (NUL-joined to preserve token boundaries) makes this O(n).
  _lgrams(L) {
    if (this._lgramCache?.L === L) return this._lgramCache.set;
    const set = new Set();
    const src = this.tokens;
    for (let i = 0; i + L <= src.length; i++) set.add(src.slice(i, i + L).join(SEP));
    this._lgramCache = { L, set };
    return set;
  }

  hasVerbatimRun(tokens, L) {
    if (tokens.length < L) return false;
    const set = this._lgrams(L);
    for (let i = 0; i + L <= tokens.length; i++) {
      if (set.has(tokens.slice(i, i + L).join(SEP))) return true;
    }
    return false;
  }
}
