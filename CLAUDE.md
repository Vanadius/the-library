# CLAUDE.md

Context for any Claude (or human) working in this repo.

## What this is

**PALIMPSEST** — a semantic-horror roguelike. The player is lost in a library of
Markov-generated text and navigates by *reading*, judging coherence, hunting for
the one authored passage that is the exit. It's the hard problem of consciousness
made playable. Full concept: `docs/LIBRARYGAMEDESIGN.md`. Every design decision
and its justification: `DECISIONS.md`. The stretch-goals/feature design lives in
`docs/NEXT_MOVEMENTS.md`. Read them before changing anything load-bearing.

**The world is a Descent** (adopted after playtesting — see DECISIONS.md "The
Descent"). Instead of one flat maze, the library is a stack of **strata** you go
*down* through. Each stratum is a small bounded world with a **sanctuary** oasis
(clears the drift, the floor's landmark), corridors, mimics, exactly one **true
stair down** (an authored passage you recognize by reading), and a **false stair**
or two (authored fakes that drop you into a dead end). The deepest stratum's stair
is the exit. Progress is depth. The whole game is the exit-recognition skill,
rehearsed all the way down.

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

Enforced by `npm test` (`test/graph.test.mjs`, `test/solvability.test.mjs`):

- The exit is reachable from the start, but **never through a mimic** (mimics are
  true dead ends — that's the false-coherence trap).
- **The world is solvable from every room** (no soft-locks). Reachability is
  computed over the *navigation* graph: bidirectional hallway exits PLUS the
  one-way `down` edge from each true stair. The build *refuses to write* an
  unsolvable world (`validate()` throws); `solvability.test.mjs` proves the guard
  fires on deliberately broken graphs.
- One **true stair** (`descent: 'down'`, with a `down` target) between each pair
  of strata; the deepest stratum's stair is the `exit`. At least one sanctuary
  per stratum.
- Coherence spans the full gradient (genuine order-1 salad → order-7/8 clarity);
  the exit is coherence 1.0 and authored. Authored bleed-through fragments are
  spliced into ~4% of mid-depth rooms.

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
