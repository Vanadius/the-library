// Path order-profiles — the terrain grammar of the library.
//
// A corridor is a chain of N rooms between two oases (or into a dead end). The
// profile decides the Markov order of each room along the chain. Order is the
// designed coherence: the player feels the text get clearer or muddier as they
// walk. Critically (per the design) order is NOT a function of distance to an
// oasis — these profiles deliberately break that heuristic so the player can't
// just "walk toward coherence". They have to read.

import { randInt } from './rng.mjs';

const clamp = (x, lo = 1, hi = 8) => Math.max(lo, Math.min(hi, Math.round(x)));

export const PROFILES = {
  // Order drops steadily. The honest path: you can feel coherence fading and
  // make an informed decision to retreat.
  steady_decline(rand, len, { hi = 7, lo = 2 } = {}) {
    return Array.from({ length: len }, (_, i) => {
      const t = len === 1 ? 0 : i / (len - 1);
      return clamp(hi - (hi - lo) * t + (rand() - 0.5));
    });
  },

  // High and reassuring, then the floor drops out — all the way to salad. The
  // classic trap.
  cliff(rand, len, { hi = 7, lo = 1 } = {}) {
    const edge = Math.max(1, Math.floor(len * (0.55 + rand() * 0.25)));
    return Array.from({ length: len }, (_, i) => clamp((i < edge ? hi : lo) + (rand() - 0.5)));
  },

  // Bounces between muddy and almost-clear every step. Prevents any clean read —
  // the design's "most dangerous" profile because it keeps giving just enough
  // signal to stop you retreating.
  oscillator(rand, len, { mid = 6, low = 3 } = {}) {
    return Array.from({ length: len }, (_, i) => clamp((i % 2 === 0 ? low : mid) + (rand() - 0.5) * 1.5));
  },

  // Rises toward what looks like an oasis, peaks just short of true clarity
  // (6-7), then collapses. Devastating when it fronts a mimic.
  false_summit(rand, len, { base = 4, peak = 7, floor = 2 } = {}) {
    const crest = Math.max(1, Math.floor(len * (0.6 + rand() * 0.2)));
    return Array.from({ length: len }, (_, i) => {
      if (i <= crest) {
        const t = crest === 0 ? 1 : i / crest;
        return clamp(base + (peak - base) * t + (rand() - 0.5));
      }
      const t = (i - crest) / Math.max(1, len - 1 - crest);
      return clamp(peak - (peak - floor) * t + (rand() - 0.5));
    });
  },

  // Uniformly muddy but short, and it actually leads somewhere. Rewards the
  // player willing to wade into noise on a hunch.
  shortcut(rand, len, { lo = 1, hi = 3 } = {}) {
    return Array.from({ length: len }, () => clamp(randInt(rand, lo, hi)));
  },
};

export const PROFILE_NAMES = Object.keys(PROFILES);

// Profiles weighted for inter-oasis corridors. Mimic approaches always use
// false_summit/cliff (assigned explicitly at graph build time).
export const CORRIDOR_WEIGHTS = [
  ['steady_decline', 0.34],
  ['oscillator', 0.24],
  ['cliff', 0.18],
  ['false_summit', 0.12],
  ['shortcut', 0.12],
];

export function weightedProfile(rand) {
  let r = rand();
  for (const [name, w] of CORRIDOR_WEIGHTS) { if ((r -= w) <= 0) return name; }
  return 'steady_decline';
}
