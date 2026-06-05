// The coherence oracle — our stand-in for GPT-2 perplexity scoring.
//
// The design calls for scoring every passage with "a small language model
// (GPT-2 class)". This environment ships no PyTorch/transformers and a multi-
// hundred-MB model download would make builds fragile, so we use a principled,
// dependency-free substitute: an *independent* backoff n-gram language model
// trained on the whole corpus at once (a general "English" observer, distinct
// from the per-theme generators). We score each passage's average surprisal
// under it. Low surprisal == reads like real English == coherent.
//
// This is a true measure, not a tautology: the generators are per-theme and
// order-specific; the reference is global and fixed-order. A salad-order-1
// passage and a coherent-order-8 passage from the same theme get very different
// scores because the reference model knows what fluent multi-word English looks
// like. See DECISIONS.md for why this faithfully serves the "coherence compass"
// role, and how a real GPT-2 could be swapped in without touching the runtime.

import { tokenize } from './markov.mjs';

const SEP = '\x00';
const BACKOFF = 0.4; // stupid-backoff weight

export class ReferenceModel {
  constructor(maxOrder = 4) {
    this.R = maxOrder;
    this.counts = Array.from({ length: maxOrder + 1 }, () => new Map()); // ngram counts by length
    this.ctxTotals = Array.from({ length: maxOrder + 1 }, () => new Map());
    this.vocab = new Set();
    this.total = 0;
  }

  train(text, cap = 45000) {
    const toks = tokenize(text).slice(0, cap).map((t) => t.toLowerCase());
    for (const t of toks) this.vocab.add(t);
    this.total += toks.length;
    for (let n = 1; n <= this.R; n++) {
      const cMap = this.counts[n];
      const ctxMap = this.ctxTotals[n];
      for (let i = n - 1; i < toks.length; i++) {
        const gram = toks.slice(i - n + 1, i + 1).join(SEP);
        cMap.set(gram, (cMap.get(gram) ?? 0) + 1);
        if (n > 1) {
          const ctx = toks.slice(i - n + 1, i).join(SEP);
          ctxMap.set(ctx, (ctxMap.get(ctx) ?? 0) + 1);
        }
      }
    }
  }

  // Stupid-backoff score of P(word | context). Not normalized to a true
  // probability (backoff never is) but strictly monotonic in fluency, which is
  // all the coherence metric needs.
  _score(word, contextToks) {
    const w = word.toLowerCase();
    for (let n = Math.min(this.R, contextToks.length + 1); n >= 1; n--) {
      if (n === 1) {
        const c = this.counts[1].get(w) ?? 0;
        return (c + 0.5) / (this.total + 0.5 * this.vocab.size); // add-k unigram
      }
      const ctx = contextToks.slice(contextToks.length - (n - 1)).map((t) => t.toLowerCase()).join(SEP);
      const gram = ctx + SEP + w;
      const gc = this.counts[n].get(gram);
      if (gc) {
        const cc = this.ctxTotals[n].get(ctx) ?? gc;
        return (gc / cc) * Math.pow(BACKOFF, this.R - n);
      }
    }
    return 1e-9;
  }

  // Perplexity-like coherence score for a passage of tokens. Lower = more
  // coherent. Returns { perplexity, surprisal } where surprisal is mean bits.
  score(tokens) {
    const words = tokens.filter((t) => /[A-Za-z0-9]/.test(t)); // ignore bare punctuation
    if (words.length === 0) return { perplexity: 1e6, surprisal: 20 };
    let bits = 0;
    const ctx = [];
    let counted = 0;
    for (const tok of tokens) {
      if (!/[A-Za-z0-9]/.test(tok)) { ctx.push(tok); if (ctx.length > this.R) ctx.shift(); continue; }
      const p = this._score(tok, ctx);
      bits += -Math.log2(Math.max(p, 1e-12));
      counted++;
      ctx.push(tok);
      if (ctx.length > this.R) ctx.shift();
    }
    const surprisal = bits / Math.max(1, counted);
    return { perplexity: Math.pow(2, surprisal), surprisal };
  }
}
