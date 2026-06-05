# CLAUDE.md

Context for any Claude (or human) working in this repo.

## What this is

**PALIMPSEST** — a semantic-horror roguelike. The player is lost in an infinite
library of Markov-generated text and navigates by *reading*, judging coherence,
hunting for the one authored passage that is the exit. It's the hard problem of
consciousness made playable. Full concept: `docs/LIBRARYGAMEDESIGN.md`. Every
design decision and its justification: `DECISIONS.md`. Read both before changing
anything load-bearing.

## The architecture in one breath

Two halves with a hard wall between them:

- **Build time** (`pipeline/`, Node, no deps): download public-domain corpus →
  train variable-order Markov chains → generate a graph of rooms (oases,
  corridors, mimics, one authored exit) → score coherence → validate invariants
  → serialize to `web/data/graph.{json,js}`.
- **Run time** (`web/`, plain HTML/CSS/JS, no deps, runs from `file://`): a
  *reader* over the baked graph. **Zero ML at runtime** — this is a firm design
  constraint, don't break it.

The committed `web/data/graph.*` is the playable world. The game runs by opening
`web/index.html`; no build needed unless you want a different world.

## The one rule

Every mechanic is tested against: **does this make the player read more carefully,
or less?** If a change lets the player navigate without engaging the text, it's
wrong, no matter how cool. This is why the compass is gated and unreliable, why
UI degradation never touches the passage you read, and why nothing ever tells the
player "higher coherence = good."

## Invariants you must not break

Enforced by `npm test` (`test/graph.test.mjs`):

- The exit is reachable from the start, but **never through a mimic** (mimics are
  true dead ends — that's the false-coherence trap).
- No orphan rooms; every edge is bidirectional (retreat is always possible).
- Coherence spans the full gradient (genuine order-1 salad → order-7/8 clarity);
  the exit is coherence 1.0 and authored.

Other sacred lines (design constraints, not all test-enforced):

- The **passage you read stays legible at all times.** Incoherence lives in the
  Markov words and in the drifting *chrome*, never in the rendering of the passage.
- UI degradation is **presentation only** — it never mutates game state. Reopen
  the tab and notes are pristine.
- The **exit text is authored**, lives alone in `pipeline/exit_text.mjs`, and is
  meant to be replaceable.

## Common tasks

```bash
npm run build        # rebuild the world (fetch corpus if needed + generate)
npm test             # graph invariants
npm run playtest     # headless Chromium: walk start→exit, screenshot key beats
npm run serve        # optional http server at :8080
```

- New world: change `SEED` or `CORPUS` in `pipeline/config.mjs`, rebuild.
- Bigger world: `GRAPH_SCALE=target npm run build`.
- New ending: edit `pipeline/exit_text.mjs`, rebuild.
- Real GPT-2 perplexity: replace `pipeline/lib/reference_model.mjs` (the runtime
  is unaffected — it only consumes baked `coherence`/`perplexity` numbers).

## Style

Self-taught, Linux-first audience. Plain, inspectable code; no abstraction for its
own sake; no build step for the runtime. Comments explain *why*, and tie back to
the design where a choice is non-obvious. Determinism matters — both sides use the
same `mulberry32` PRNG so a seed means one fixed world.
