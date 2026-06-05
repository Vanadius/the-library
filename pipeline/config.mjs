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

// Graph scale. Minimum-viable target from the design doc — get the loop right
// before scaling. Override with env GRAPH_SCALE=target|ambitious.
export const SCALE = {
  minimal:   { oases: 8,  nodesTarget: 800,  mimics: 9,  corridorMin: 4, corridorMax: 9 },
  target:    { oases: 24, nodesTarget: 5000, mimics: 30, corridorMin: 5, corridorMax: 14 },
  ambitious: { oases: 48, nodesTarget: 12000, mimics: 70, corridorMin: 6, corridorMax: 18 },
};

export const PATHS = {
  raw:   'corpus/raw',
  clean: 'corpus/clean',
  models: 'corpus/models',
  graph: 'web/data/graph.json',
};
