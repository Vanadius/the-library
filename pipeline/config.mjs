// PALIMPSEST — build configuration
//
// Everything the build pipeline needs to be reproducible lives here. The
// runtime never reads this file; it only consumes the serialized graph.json.
//
// The corpus is the heart of the thing. Each entry is a *voice* — a distinct
// public-domain author/work that becomes the character of an oasis. When the
// player reaches a coherent island, it should feel like a particular kind of
// mind was speaking. Variety of register is the point: a Regency drawing room
// reads nothing like a treatise on natural selection reads nothing like a
// gothic confession. The Markov chains preserve that texture even as meaning
// dissolves.

export const SEED = 0x9e3779b9; // deterministic builds; change for a new world

// Public-domain works from Project Gutenberg. ids map to the canonical
// plain-text cache URL: https://www.gutenberg.org/cache/epub/{id}/pg{id}.txt
// `theme` is the label the game shows; `key` is the internal corpus id.
export const CORPUS = [
  { key: 'austen',   id: 1342, theme: 'the drawing room',   author: 'a novel of manners' },
  { key: 'dickens',  id: 98,   theme: 'the revolution',      author: 'a tale of two cities' },
  { key: 'darwin',   id: 1228, theme: 'the origin',          author: 'a treatise on descent' },
  { key: 'poe',      id: 2147, theme: 'the tell-tale dark',   author: 'collected gothic tales' },
  { key: 'carroll',  id: 11,   theme: 'the looking-glass',    author: 'a dream of logic' },
  { key: 'shelley',  id: 84,   theme: 'the made thing',       author: 'a modern prometheus' },
  { key: 'melville', id: 2701, theme: 'the whale',            author: 'a maritime obsession' },
  { key: 'aurelius', id: 2680, theme: 'the meditations',      author: 'private philosophy' },
  { key: 'stoker',   id: 345,  theme: 'the undying',          author: 'an epistolary horror' },
  { key: 'wells',    id: 35,   theme: 'the far future',       author: 'a traveller in time' },
];

// Mirrors tried in order if the primary fetch fails.
export const MIRRORS = [
  (id) => `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
  (id) => `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
  (id) => `https://www.gutenberg.org/ebooks/${id}.txt.utf-8`,
  (id) => `https://gutenberg.pglaf.org/${String(id).split('').join('/')}/${id}/${id}-0.txt`,
];

// Markov orders the world is built from. The design's terrain vocabulary:
//   1-2 word salad · 3-4 uncanny grammar · 5-6 eerily plausible ·
//   7-8 coherent paragraphs · 9 begins quoting the source (used sparingly).
export const ORDERS = { min: 1, max: 9, oasis: [7, 8], oasisPeak: 9 };

// Graph scale — now a Descent: a stack of strata you read your way down through.
// Progress is depth. Each stratum is a small, bounded world (a sanctuary oasis,
// corridors, mimics) with one true "stair down" you find by recognizing its
// authored passage, and a fake stair or two that punish a careless step.
// Keep strata small: the whole point of the rebuild is that you are never lost
// in an ocean, only in a room. Override with env GRAPH_SCALE=target|ambitious.
// Each stratum is a coherent RIDGE (the true line to the stair) with degrading
// dead-end spurs and a couple of coherent lures hung off it. `ridge` is the
// length of that true line; `roomsPerStratum` is the whole floor including the
// wrong turns. Kept small so the mechanic can teach itself.
export const SCALE = {
  minimal:   { strata: 6,  ridge: [3, 5],  roomsPerStratum: 22, mimicsPerStratum: [1, 2], falseDescents: [1, 2], corridorMin: 2, corridorMax: 5 },
  target:    { strata: 12, ridge: [4, 7],  roomsPerStratum: 44, mimicsPerStratum: [2, 3], falseDescents: [1, 3], corridorMin: 3, corridorMax: 8 },
  ambitious: { strata: 20, ridge: [5, 9],  roomsPerStratum: 70, mimicsPerStratum: [2, 4], falseDescents: [2, 3], corridorMin: 4, corridorMax: 12 },
};

export const PATHS = {
  raw:   'corpus/raw',
  clean: 'corpus/clean',
  models: 'corpus/models',
  graph: 'web/data/graph.json',
};
