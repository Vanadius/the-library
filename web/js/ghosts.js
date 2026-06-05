/* Other travelers.
 *
 * Traces of those who came before — a margin scrawl, an underlined word, a
 * scratched plea. Deterministic per node (seeded by node id), so the same hall
 * always bears the same mark: it feels persistent, like real history. Whether
 * they were ever real, whether they got out, whether they were ever even people
 * — the game never says. (Async-real traces could be layered on later; the
 * design leaves it open. These are honest fabrications, which is itself the
 * point.)
 *
 * Ghosts thin out near coherence (the found places need no annotation) and
 * crowd the incoherent deep (where people got desperate).
 */
P.ghosts = (function () {
  const { rng, pick } = P.core;

  const MARGIN = [
    'someone underlined this, hard enough to tear the page',
    'a hand wrote in the margin: i have been here before',
    'a hand wrote in the margin: don’t trust the warm ones',
    'scratched into the shelf: 412 days. or pages. i can’t tell anymore',
    'a margin note, half rubbed away: it reads beautifully and it means nothing',
    'someone circled a single word and wrote below it: this one. this one is real',
    'pressed into the dust: a handprint, smaller than yours',
    'a note folded into the spine: if you are reading this you are not the first',
    'written and then crossed out: i think i am close — i think i am close — i',
    'a child’s letters: THE DOOR IS THE READING. then nothing',
    'someone has torn out the next page. only the stub remains',
    'in the gutter of the page: keep going. the warmth lies but the cold lies too',
    'a different ink, older: i stopped being sure which of us was writing',
    'underlined twice: meaning is a feeling you get when the pattern is dense enough',
    'a single tally mark, fresh, beside a thousand faded ones',
  ];

  // Returns a ghost annotation string for this node, or null.
  function forNode(node) {
    const rand = rng(node.id + '|ghost');
    // More likely in the incoherent deep, rare in oases.
    const p = 0.10 + (1 - node.coherence) * 0.32 + (node.kind === 'mimic' ? 0.18 : 0);
    if (rand() > p) return null;
    return pick(rand, MARGIN);
  }

  return { forNode };
})();
