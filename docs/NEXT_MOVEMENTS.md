# PALIMPSEST — Next Movements

*A stretch-goals design document. Written after the core game shipped, with
Derek's feedback folded in. Same governing law as everything else here: the One
Rule — every feature must make the player **read more carefully, not less.** Any
mechanic that lets you navigate without engaging the text is wrong, however
beautiful. Each proposal below is tested against that gate and against a second
one: does it deepen the thesis (meaning, recognition, the hard problem), or does
it merely shine?*

Status legend: **▶ build next** · **◐ planned** · **◇ when we accept a seam** ·
**✕ cut (recorded so we don't relitigate it)**.

---

## 1. Authored bleed-through ▶

*The palimpsest made literal — and the highest art-per-hour move on the board.*

Today you meet authored text exactly once, at the exit. That makes the finale a
*surprise* rather than a *recognition*. The fix: scatter a small pool of real,
authored sentences — short, intention-saturated, original — **inside otherwise
Markov rooms.** Not whole authored rooms; a single true sentence surfacing in the
salad, then the salad closing back over it. The older writing ghosting up through
the new. That is what a palimpsest *is*.

**Why it serves the thesis.** You learn the *texture* of intention before the
ending, so the exit becomes something you've been trained to recognize rather
than stumble onto. It also sets up the cruelest, truest discrimination in the
game: by the endgame the library contains four kinds of text —

1. generated noise (most of it),
2. **true authored fragments** that bleed through (this feature),
3. flattering **false-authored decoys** at mimic summits (already shipped), and
4. the **one authored passage that is the exit.**

Recognizing #4 out of {#1, #2, #3} is a real skill, not a lucky click on the only
nice paragraph in the building.

**Design specifics.**
- A pool of ~16–28 authored fragments in a swappable file, sibling to
  `pipeline/exit_text.mjs` (call it `pipeline/fragments.mjs`). Thematically about
  being read, being meant, memory, attention — never about the exit or direction.
- Seeded at **build time** into a small fraction of non-oasis, non-exit rooms
  (~3–5%), weighted toward mid-depth. One fragment per chosen room, spliced into
  the Markov passage at a sentence boundary.
- **Rendered identically to everything else.** No glow, no flag. Recognition must
  be earned by reading. (We already keep the passage pristine; this rides that.)
- **Navigationally inert and honest.** True fragments do *not* indicate the exit
  and appear as readily on dead ends as on through-routes — so "follow the
  meaning" remains a trap, not a strategy. They teach *what authored feels like*,
  not *which way to go.*

**One-Rule check:** passes hard. It rewards careful reading and punishes the
heuristic of "navigate toward the nice sentence."

**Cost:** small. Build-time only; runtime renders normally. Pure win.

---

## 2. Real GPT-2 perplexity at build time ◐

*The honest version of the compass; the original design's intent.*

Our coherence oracle is a backoff n-gram model. It cleanly separates salad from
fluent text but **saturates above order 4** — it can't grade an order-5 passage
against an order-8 one, because an n-gram model physically can't see that far.
A real small transformer (distilGPT-2 / GPT-2-small via `transformers.js` or
`onnxruntime-node`) *can*: it notices that high-order Markov text is locally
fluent yet globally incoherent — which is exactly the failure a mimic embodies.

**Effect.** Coherence grades across the whole 5–8 band, so oases, false summits,
and mimics get *distinct, meaningful* scores. The compass's lie becomes subtler
and truer: it's fooled the way a mind is fooled, not the way a toy is.

**How, without breaking anything.**
- Build-time only, behind a flag: `REFERENCE_MODEL=gpt2 npm run build`. Default
  stays the n-gram oracle so a clean checkout still builds offline in seconds.
- Swap is one file (`pipeline/lib/reference_model.mjs` already isolates this).
  The **runtime is untouched** — it only ever consumes baked `coherence` /
  `perplexity` numbers. Zero-ML-at-runtime holds.

**Risks / guardrails.** Model download (~hundreds of MB) makes the build heavier
and network-dependent; cache it, and keep n-gram as the no-dependency default.
This is opt-in polish, not a load-bearing change.

**One-Rule check:** neutral-to-positive. It doesn't change what the player does;
it makes the world's hidden grading more honest.

---

## 3. The trail, and the journal as beacons ▶

*Derek's idea, and a better one than a map. A map lets you navigate by geometry
instead of by reading; a trail that **dissolves** does not.*

Two linked memory aids, both deliberately **short-range and decaying**, so they
ease the friction of "which way did I come in?" without ever becoming a GPS to
the exit.

**The trail.** The last few rooms you left are remembered, and in each room the
exit that leads *back along your path* is faintly marked — a draft from where you
came. The trail's reach **shrinks with drift**: oriented (high coherence) you can
feel ~4 steps back; lost in the deep, only one, then none. Retreat is legible
when you're clear-headed and erased when you're not. Pure House of Leaves.
- `maxTrail = round(4 · (1 − drift))`, clamped 0–4; most-recent step brightest,
  older steps dimmer; nothing once you're deep enough.
- It only ever points the way you **already went** (retreat is already legal via
  bidirectional edges). It never points forward, never toward the exit.

**The journal as beacons — finally giving notes a job.** A room you've marked
stays *lit*: when a marked room is **adjacent** to you, that exit shows a beacon —
*you left a note here.* So you can deliberately landmark a junction and find your
way back to it. But beacons **decay on the same curve as note-drift** (already
shipped): a fresh note is a clear beacon; a note seen from deep in the noise
dims, flickers, and goes dark. Early landmarks are trustworthy; deep ones aren't —
consistent with the trust mechanic the journal already embodies.

**Why this is safe and worth it.** Beacons reach **one hop only** and **fade**, so
they can't chain into a global map — you still have to *read* your way between
landmarks. What they do is make the journal load-bearing (right now it's a mood
piece) and turn deliberate marking into a genuine, fallible strategy. Getting lost
stays the failure state; this just stops it from being *tedious* lostness.

**One-Rule check:** passes, with the short-range + decay guardrails. If beacons
ever felt like reliable navigation, shorten the range or steepen the decay.

**Cost:** small, runtime-only. Engine already half-tracks the needed state (add an
ordered `trail` stack; derive beacons from existing journal entries).

---

## 4. Something else is in here ◐

*Roguelike dread without a monster. The horror is implication.*

Not an enemy — **evidence** that you are not the only thing reading. It never
resolves into a creature; it only leaves signs, and it gets bolder the deeper and
longer you go (riding the same apophenia curve as the drift).

- **Fresh marks.** A room you've seen before gains a ghost-scrawl on a later visit
  that *wasn't there the first time* — "this wasn't here before" is a feeling the
  game can manufacture by snapshotting each room's first-seen state in run-state.
- **Erased trail.** Occasionally a breadcrumb or beacon (feature 3) is *removed*,
  as if something un-read it. Ties the presence directly to your new navigation
  aids — it eats the very thing you'd started to rely on.
- **Disturbed ahead.** A preview now and then reads as recently touched — dust
  moved, a page still settling — implying someone just left the room you're about
  to enter.

**One-Rule check:** atmosphere, not signal. Guardrail: the presence must never
become a *reliable* tell (e.g., "disturbed rooms are safe/dangerous"). If players
start reading it as a compass, it has to lie often enough to be useless as one —
same discipline as the ghosts and the warmth.

**Cost:** moderate, runtime-only (needs first-seen snapshots + deterministic
seeding). Pairs naturally with feature 3.

---

## 5. Endings that reflect how you read ◐

*The run given a moral shape — a mirror, not a score.*

The exit text never changes; it's the recognition. But after *turn around*, the
**coda** can reflect **how you got there** — your relationship to meaning, read
back to you. Quietly track, per run:

- drift of your choices toward higher vs. lower coherence (did you flee the noise
  or wade in?),
- the deepest incoherence you sat in,
- dwell time per room (did you actually read, or click through?),
- reliance on the compass once it unlocked,
- backtracking and journal use.

Resolve to one of a handful of authored codas — e.g. *the Cartographer* (hugged
the coherent halls), *the Diver* (trusted the dark), *the Trusting* (followed the
warmth that lies), *the Reader* (slow, balanced, attentive). Same door; different
mirror.

**Guardrail:** never reveal the rubric. The moment players can see the scoring,
they optimize for an ending instead of reading. It stays a private reflection
surfaced once, at the end.

**One-Rule check:** passes (purely reflective; touches nothing about navigation).
**Cost:** small — engine already tracks most of these; codas live in a file.

---

## 6. Async-real ghosts ◇

*The design's deepest ambiguity, made literally true — but it needs a seam.*

If some "other travelers" are **genuinely other people** and some are fabricated,
and you can **never tell which**, the game's central question stops being a
metaphor. The obstacle Derek correctly flagged: GitHub Pages is static; a browser
can't write to a store without a backend.

**The GitHub-native path (no external server):**
1. A player chooses to *leave a mark*. The game opens a **pre-filled GitHub Issue**
   (`/issues/new?labels=trace&title=…&body=<room-id + a word or short note>`).
2. A scheduled **GitHub Action** harvests issues labelled `trace`, sanitizes them
   (strip PII, cap length, profanity gate), and writes `web/data/traces.json`,
   committed. The next Pages deploy ships them.
3. The runtime loads `traces.json` if present and **shuffles real traces in with
   the fabricated ghosts** — indistinguishable by construction.

**Honest costs.** Contributing requires a GitHub account (most players won't have
one or won't bother) and a curation cadence; *reading* the accumulated traces is
free for everyone. So it's "few authors, all readers" — which still delivers the
thesis: the marks you pass really might be real.

**The low-friction alternative (one external piece):** a single free serverless
endpoint (Cloudflare Worker + KV, Val Town, etc.) for anonymous append/read. Drops
the account requirement entirely, at the cost of "not purely GitHub." Derek's
call; the GitHub-native path is the default recommendation precisely because it
keeps the no-backend purity.

**One-Rule check:** neutral. It's flavor and theme, not navigation.

---

## 7. Accessibility & distribution ◐

*The unglamorous work that turns a demo into a thing people actually play. Some of
it is also an ethical obligation: the degradation effects can genuinely hurt some
readers.*

- **Reduced-motion / dampen-drift toggle.** Honor `prefers-reduced-motion` and
  expose a manual control that lessens flicker, scanlines, and HUD drift. Crucial:
  the passage is *already* always legible; this protects users for whom the chrome
  motion is harmful, without touching the core.
- **Type & contrast.** Font-size control, a higher-contrast palette, and a
  dyslexia-friendly typeface option.
- **Touch.** Swipe / large tap targets for phones (the exits are already buttons;
  make them thumb-sized and add gesture nav).
- **PWA + offline install.** A manifest and a *versioned* service worker so it
  installs and runs offline. **Note the trap we already hit:** SW caching must be
  build-stamped or it will serve stale code exactly like the Pages CDN did. Reuse
  the `?v=` stamping discipline.
- **Packaging.** An itch.io release (the single-file `palimpsest.html` is already
  a complete, uploadable build).

**One-Rule check:** passes; pure access and reach.

---

## ✕ Cut: the "which is more meant?" calibration

Considered and **dropped** (Derek's call, and the right one). Presenting two
passages and asking the player to pick the more authored one would turn reading
into a quiz scored to your face. Reading here should stay *ambient and
unjudged* — the game's whole stance is that you can't verify your sense of meaning
from the inside, and a correctness buzzer betrays that. The discrimination still
happens; it just stays private, the way it is in life.

---

## Cross-cutting principles (the gates every feature passes)

1. **The One Rule.** Read more, not less. Memory aids stay short-range and
   decaying; signals that could become compasses must lie often enough to be
   useless as compasses.
2. **The passage is sacred.** Incoherence lives in the Markov words and the
   drifting chrome — never in the legibility of the room you're reading.
3. **Presentation, never state.** Degradation and these new effects corrupt the
   *screen*, never the saved truth. Reopen the tab and your notes are pristine.
4. **Determinism.** One seed, one world, both halves on the same `mulberry32`.
5. **Build/runtime wall.** Anything heavy (GPT-2, fragment placement) happens at
   build time and bakes into data; the runtime stays a dependency-free reader.

## Suggested order

**Now:** 1 (bleed-through) → 3 (trail + beacons). These two reshape the moment-to-
moment feel the most and are both cheap and safe.
**Next:** 4 (the presence) and 5 (endings) as an atmosphere-and-payoff pass.
**When the mood strikes:** 2 (GPT-2) for the under-the-hood flex; 7 (accessibility
& distribution) before any public release.
**When we accept a seam:** 6 (async-real ghosts).
