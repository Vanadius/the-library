# DECISIONS.md

The design bible (`docs/LIBRARYGAMEDESIGN.md`) left a set of things explicitly
undecided and invited me to resolve them, justify the calls, and change decided
elements where it served the work. This is the record of what I chose and why.
The guiding test throughout was the design's One Rule: *does this make the player
read more carefully, or less?* Anything that let the player navigate without
reading was cut or defanged.

---

## The big reframing: "PALIMPSEST"

**Decision:** Title the game **PALIMPSEST**, and let that word reframe the whole
premise.

A palimpsest is a manuscript that has been scraped clean and written over, the
older text still ghosting up through the new. That is *literally what this game
is*: one authored passage, buried and overwritten by endless statistically
plausible noise, waiting to be read back out. It reframes "an infinite library
of generated text" into something with a wound at its center — **the eroded and
overwritten remains of one true book** — which is a stronger, sadder, more
original thesis than "infinite library," and it sidesteps the Borges adjacency
entirely. Nothing in the game references Borges, *House of Leaves*, or the
Backrooms by name (per §8).

The other candidates (*The Library*, *Perplexity*, *Coherence*, *The Stacks*)
were either generic, brand-conflicted (Perplexity), or on-the-nose. PALIMPSEST
earns its title by describing the mechanic and the grief at once.

---

## Technology platform — **Web, terminal aesthetic, zero dependencies**

The design recommended web, terminal-aesthetic, and I took it — with one sharpening:
**no build step and no dependencies for the runtime at all.** The game is plain
HTML/CSS and classic `<script>` files. Consequences:

- **It runs by opening `web/index.html`.** No server, no npm install, no bundler.
  (Browsers block `fetch` and ES modules over `file://`, so the world ships as a
  `window.GRAPH` script rather than a fetched JSON. A tiny optional static server
  is included for those who want http.)
- **It's inspectable.** Derek is self-taught and Linux-first and will want to read
  the code. There's no transpilation between what's written and what runs.
- **Zero ML at runtime** (a hard design requirement) falls out for free: the
  runtime is a reader over baked data.

The build pipeline is Node, also dependency-free (uses built-in `fetch`).

---

## Perplexity scoring without GPT-2 — **an independent backoff n-gram oracle**

The design wants every node scored by "a small language model (GPT-2 class)."
This environment has no PyTorch/transformers, and a multi-hundred-MB model
download makes builds fragile. So the coherence oracle is a **dependency-free
backoff n-gram language model** trained on the *whole* corpus at once (a general
"English observer," distinct from the per-theme Markov *generators*). Each
passage is scored by its mean surprisal under it. See `pipeline/lib/reference_model.mjs`.

**An honest limitation, and why it doesn't matter — in fact why it helps.** An
n-gram model of order *R* physically cannot perceive coherence beyond *R* tokens
of context. So it cleanly separates obvious salad (order 1–2) from locally fluent
text, but it *saturates* above order 4: it cannot tell an order-5 passage from an
order-8 one. Only a real long-range model (GPT-2) would notice that high-order
Markov text is locally fluent yet *globally* incoherent.

Rather than fight this, I leaned into it and made the design cleaner:

1. **The assigned Markov order is the ground-truth coherence.** The design itself
   says so — "each edge has an assigned Markov order that determines the
   coherence along that route." So `coherence = 0.7·(order term) + 0.3·(perplexity
   term)`. Order leads; perplexity adds organic within-order variation (some
   order-5 rooms genuinely read better than others).
2. **The reference perplexity is exactly the right thing to power the *compass*,
   precisely because it's fallible.** A compass built on a saturating local model
   is *fooled by high-order mimics* — it reads them as "coherent" because locally
   they are. That is the false-coherence mechanic, for free and for real.

Swapping in true GPT-2 perplexity later means changing one file
(`reference_model.mjs`) and rebuilding. The runtime never knows the difference.

---

## UI degradation — **YES (the signature effect)**

Implemented, and held to the design's hard constraint: **presentation layer only,
never game state.** The drift corrupts the *frame* — status line, exit tags, the
compass, and your own journal notes — based on a *lagging* measure of how lost
you are. It never touches the passage you're reading (that's the honest data the
whole game is about) and never alters state. Close the tab and reopen: your notes
are pristine again; only the screen was lying. See `web/js/degrade.js`.

Two refinements I'm proud of:

- **The drift lags and lingers** (an exponential moving average plus a
  low-coherence streak term). Wade through a stretch of noise and the residue
  stays on your interface even after you reach a clear room — and it lifts only
  slowly. That residue *is* the apophenia the design asks for.
- **Legibility is sacred.** An early version blurred the passage itself at low
  coherence; it made the text unreadable and broke the One Rule. Fixed: the room
  you read is always crisp. Incoherence lives in the *words* (Markov) and in the
  *chrome*, never in the rendering of the passage.

---

## The compass — **YES, but gated and deliberately unreliable**

The design flagged the compass as a risk to the "you must read" mechanic. I kept
it but neutralized the risk three ways:

1. **It's earned.** It unlocks only after you've read ~160 rooms (cumulative,
   across runs) or once you've found the exit. Early players never see it and
   learn to read first.
2. **It's non-numeric.** A warmth glyph, not a score.
3. **It lies exactly when you'd lean on it.** It reads the (saturating) reference
   perplexity, so high-order mimics read "warm." And in incoherent zones the
   reading is scrambled by drift. The compass is warmest pointing at the most
   beautiful dead end. It cannot replace reading because it is most confident
   when it is most wrong.

---

## Journal / breadcrumbs — **YES, as a trust mechanic**

You can mark any room with a note. But notes are subject to the same drift as the
rest of the HUD: the deeper you currently are, the more your *past* notes have
quietly rewritten themselves (words decaying toward other words you wrote, plus a
little ambient seepage). Your record of where you've been stops being true. The
underlying entries are never corrupted — only their rendering — so this is a
question the game poses, not a punishment it inflicts: *do you trust your own
notes?*

---

## Other travelers (ghosts) — **YES, as honest fabrications**

Margin scrawls, underlined words, tallies from those who came before. They're
deterministic per room (seeded by node id), so a hall always bears the same mark
— it feels like real, persistent history. They thin out in oases and crowd the
incoherent deep, where people got desperate. Whether they were ever real, whether
they got out, whether they were even people — the game never says. Async-real
traces (persisting actual players' marks across runs) are a clean future
extension; the seam is in `web/js/ghosts.js`. Fabricating them is cheaper and,
honestly, more on-theme.

---

## Sound — **YES, fully procedural (no asset files)**

Synthesized via Web Audio, so there are no downloads and no licensing concerns:
a filtered-noise room tone, a low drone that detunes as coherence falls, and —
only in the deep — two formant oscillators beating against each other into an
**almost-voice that never quite says a word.** Page turns on every move. The exit
fades everything to **true silence**, then the text, exactly as the design's
sonic arc asks. Off by default (respects autoplay policy and quiet players);
one toggle in the footer.

---

## Permadeath vs. persistence — **meta-persistence** (as recommended)

There is no death — getting lost is the only failure, and retreat is always
possible (every edge is bidirectional). What persists across runs is *you*: a
cumulative count of rooms read that trains your "ear" and unlocks the compass,
and whether you've ever found the exit. Position persists *within* a run (close
the tab, resume where you stood) but resets when you find the exit and choose to
descend again. The world itself is fixed per build — "the library doesn't care
about you; only you change." The skill is reading, and only the reader improves.

---

## Graph scale — **minimum viable, tuned to ~880 nodes**

Per "start with minimum viable; get the loop right before scaling." The committed
world is ~880 rooms, 8 thematically distinct oases, ~34 mimic rooms, 1 exit,
shortest path 23 rooms (you won't find it; you'll wander). Most of the library is
corridor — oases are rare islands you earn — which is both the intended pacing and
the intended dread. Larger worlds are one env var away (`GRAPH_SCALE=target` or
`ambitious` in `pipeline/config.mjs`).

---

## Exit text — **original, authored, and swappable**

Written from scratch (no public-domain passage a player might recognize; §8's
preferred option). It's a short second-person address from the one person who
made the page for the one reader who'd reach it, and it does not explain the
game — it trusts that you already understand. It lives alone in
`pipeline/exit_text.mjs` so Derek can replace it; that he might *want* to is the
most on-theme thing about it.

I also added **authored-feeling decoys** ("false exits") planted at a few mimic
summits. They borrow the cadence of intent and then curdle — they flatter, loop,
or dissolve. Their job is to make recognizing the *real* exit an earned act of
discrimination, not a lucky click on the only nice paragraph in the building.

---

## Tutorial / onboarding — **diegetic, no rules**

The hardest open question: how do you teach reading-for-coherence without
explaining the mechanic? Answer: you don't explain it. A short framing card
establishes only that you're lost, that one page was written for you, and that
"you move by reading." Then you start *inside an oasis* — a coherent room — so
your very first contrast (oasis vs. the muddier halls leading out) teaches the
gradient by experience, not instruction. The first ghost notes nudge ("don't
trust the warm ones") in-world. Nothing ever says "higher coherence is good."

---

## Things I changed from the "decided" list

- **Edges store no per-edge order.** Order lives on the corridor *rooms* (each
  room of a corridor is a place you stand and read), which is simpler and means
  the same thing. The profiles (`steady_decline`, `cliff`, `oscillator`,
  `false_summit`, `shortcut`) shape the order *sequence along the chain*.
- **Order 9 is essentially unused** in generation. At order 9 a word-level chain
  just reproduces the source (§2 / §8), and the climax is *authored*, not
  near-verbatim Markov — so oases cap at order 7–8. Dedup rejects any Markov
  passage reproducing ≥22 verbatim source tokens, though since the corpus is
  strictly public-domain this is belt-and-suspenders, not a legal necessity.

---

## What I'd do next (not done)

- True GPT-2 perplexity in the build (drop-in; runtime unaffected).
- Async-real ghosts (persist anonymized player marks).
- Tighter corpus front-matter stripping (a little title-page debris survives and,
  honestly, reads as fitting noise in the deep — but it could be cleaner).
- A larger world (`GRAPH_SCALE=target`) once the loop has been lived in.

---

## The Descent (post-playtest re-architecture)

The first build was one flat ~880-room maze with a single exit. Playtesting found
the fault line: at that size the One Rule *inverted*. Reading the whole world to
brute-force the exit was impossible, so the rational player stopped reading and
navigated by the decay cues and icons instead — exactly what the design forbids.
And there was nothing to push against: no landmarks, no progress, no sense of
distance. Reading was simultaneously mandatory and futile, so signals won.

The fix was structural, not a patch. The world is now a **Descent**: a stack of
**strata** you go down through. Each stratum is a small bounded world (a sanctuary
oasis, corridors, mimics) with exactly **one true stair down** — an authored
passage you recognize by reading — and one or two **false stairs** (authored fakes
that drop you into a dead end). You descend by finding the true stair. The deepest
stratum's stair is the exit.

Why this resolves every symptom at once:

- **Reading becomes the act of progress, in concentrated bursts.** You skim the
  noise (a real skill) and *read* the thresholds. The exit-recognition skill — the
  whole point of the game — is now rehearsed on every floor, not just once at the
  bottom. The bleed-through fragments are its training montage.
- **You are never lost in an ocean, only in a room.** Each floor is a small,
  searchable space.
- **Oases are unmistakable sanctuaries** (they clear the drift, carry a masthead,
  and are the floor's landmark) — and the layer's checkpoint.
- **Depth is felt progress.** "Stratum IV / VIII" up top; "the true page lies N
  floors below" on the title. Orientation without a compass: it never says which
  *door*, only how *deep*.
- **The crutches demote to what they should be** — short-range orientation inside
  a floor — because depth and sanctuaries now carry progress instead.

Implementation notes:
- Descent is **one-way** (the stair collapses behind you). Within a stratum,
  hallways stay bidirectional, so there are no soft-locks — solvability is proven
  over the navigation graph (hallways + one-way `down` edges).
- True and false stairs **render identically**. Only the passage tells you which,
  and only if you read it. This is the final exit/decoy mechanic, fractalised per
  floor — the per-stratum recognition is a real act of discrimination.
- Authored stair passages live in `pipeline/descent_text.mjs` (`TRUE_DESCENTS`,
  `FALSE_DESCENTS`), swappable like the exit. Scale is per-stratum in
  `pipeline/config.mjs` (`strata`, `roomsPerStratum`, …).

Cut along the way (playtester's call, and right): a "which passage is more meant?"
calibration mini-game — a correctness buzzer would betray the game's stance that
you cannot verify your sense of meaning from the inside.

---

## Wear & the under-text (Derek's idea — the title, made into a mechanic)

A palimpsest is a page scraped and overwritten, the older hand showing through.
So: walk a room enough times and its generated surface *wears thin*, and an
older, authored book shows through from beneath — excavated word by word across
visits (`pipeline/undertext.mjs`, ~1/3 of the noise rooms, deterministic).

Why it belongs:
- It is the title enacted. The premise was always "one true book overwritten";
  now you can physically rub the noise away and read scraps of it.
- It is **non-navigational** — the buried text never says where the stair is — so
  it can't be farmed for advantage. It only rewards tenderness toward a place you
  keep returning to, and gives more authored texture to sharpen recognition.
- It turns the thing the playtester disliked — backtracking, loops — into
  *excavation*. The rooms you wear most are the junctions you keep passing while
  lost, so the buried truth surfaces exactly where you struggled.
- The under-text is the one thing the drift cannot corrupt: the surface and the
  HUD decay, but the older writing beneath reads true and clear. The room you read
  stays legible throughout (the One Rule holds) — the surface only fades; the
  under-text is crisp.

Reveal is gradual (first show at 3 visits, fully excavated by 6). The fragments
read like scraps of one lost narrative, so an attentive player half-assembles a
story that is never given in order.

---

## The coherence ridge (correcting the gradient — from a Cowork review)

A reviewer (a second Claude, playing it cold) caught the deepest flaw, and they
were right: **the solution path was not coherence-monotonic.** 21% of the true
path scored below 0.40 coherence — rooms of literal word-salad (min 0.03) — that a
player was *forced* to walk through. So reading honestly got you correctly
punished: the degradation said "wrong way" on the only way forward. The compass
and the maze disagreed.

The cause was a genuine conflict between two design intents. The **bible** (§2)
says order is *not* a function of distance and "you cannot walk toward coherence"
— coherence is a liar. But Derek's **original** intent was the opposite: *a true,
sensical line lies between you and the exit; degradation means you are wrong.* I
had built the bible's version and lost his.

The fix reconciles both rather than picking one. Each floor is now a **ridge** —
a thread of genuine coherence (order 6–8) from the sanctuary to the true stair.
**Following the sense leads you home.** Everything that degrades hangs *off* the
ridge as dead-end spurs, so straying is where the text comes apart — honest
feedback at last. But the **false-coherence traps survive, relocated to the forks
that matter**: mimics and false stairs branch off the ridge via *coherent*
approaches, so at the fork they read as true as the way on, and only *reading the
destination* exposes the flatterer. Degradation warns you off the boring wrong
turns; reading is what beats the seductive ones. That is the whole thesis, and now
the map agrees with it.

Measured, before → after (same seed):
- mean coherence on the true path: 0.665 → **0.863**
- true-path rooms below 0.40 (forced salad): **21% → 0%**
- minimum coherence on the path: 0.032 → **0.715**

A second win falls out for free: the drift now stays *low while you are on the
true path*, so the HUD is legible exactly at the decisions that matter, and only
corrupts when you wander off — fixing the "instruments fail when you need them"
doom loop the reviewer also flagged.

And scale was cut hard (the review: "467 nodes to carry one mechanic"): the
minimal world is now 6 strata / ~215 rooms / a 33-step descent, so the mechanic
has room to teach itself.

This reverses the earlier deference to the bible's "coherence is purely a liar"
line. The honest synthesis: coherence is mostly trustworthy *and* it lies at the
forks — which is a truer picture of fluency-without-meaning than either extreme.

---

## The Restoration (universal wear, selective survival)

Two changes that close the wear mechanic's open seam and give the game a second
axis of progress.

**Universal wear.** Previously only the ~⅓ of rooms with a buried fragment showed
any wear, so the mechanic read as arbitrary — identical pages, one wears, one
doesn't. Now *every* noise page wears with revisits. Most wear through to a
**scraped blank** ("whatever was written beneath did not survive the
overwriting") — because most of a palimpsest's underwriting is simply gone, which
is the truest thing the mechanic can say. Wearing a page becomes a gamble; the
surviving pages become precious.

**The Restoration.** A page worn fully through is **recovered**: it enters a
"recovered pages" panel in the journal and *persists across runs and even across
rebuilds* (the buried book is the same book in every world). The panel is the
deliberate inverse of the notes above it: your own journal rots with the drift;
what you dug up never does. Page numbers ("page 10 · of 24") expose the gaps —
most of the book is still down there, or gone for good. The title screen counts
your restoration; the ending acknowledges what you carried out.

Why it's safe under the One Rule: recovery rewards *returning and re-reading* —
tenderness toward a place — and the under-text remains strictly non-navigational.
A speedrunner gets the door; only a careful reader gets the book. It also gives
meta-persistence a visible arc beyond the compass unlock: across many descents
you are not just escaping the library, you are *restoring the book it erased*.

**Fork ambiguity (the reviewer's knob).** With the ridge in place the worry
inverted from "forced through salad" to "too findable." Now ~half the wrong turns
directly off the ridge open with a coherent first room (decay arrives one room
in), so a fork cannot be solved from the hallway preview — measured: 93% of ridge
forks present a coherent third way. Decay still warns honestly; it just warns one
step late, so a wrong turn costs a step instead of nothing, and the fork itself
demands reading the room.
