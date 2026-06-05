// One-command build: fetch + clean the corpus, then generate the world.
// Re-running is cheap — raw downloads are cached under corpus/raw.
//
// Usage:
//   npm run build               # minimal scale (~800 nodes, the MVP world)
//   GRAPH_SCALE=target npm run build
//   GRAPH_SCALE=ambitious npm run build

import { fetchCorpus } from './fetch_corpus.mjs';
await fetchCorpus(); // ensure corpus is present (cheap if cached)

const { build } = await import('./generate_graph.mjs');
const { writeFile, mkdir } = await import('node:fs/promises');
const { PATHS } = await import('./config.mjs');

const scale = process.env.GRAPH_SCALE || 'minimal';
console.log(`\nbuilding world (scale=${scale})...`);
const { graph, report } = await build({ scale });
await mkdir('web/data', { recursive: true });
const json = JSON.stringify(graph);
await writeFile(PATHS.graph, json);
await writeFile('web/data/graph.js', `window.GRAPH=${json};\n`);
console.log(`wrote ${PATHS.graph} + graph.js (${(json.length / 1024).toFixed(0)} KB)`);
console.log(JSON.stringify(report.stats, null, 2));
console.log('\ndone. open web/index.html (or `npm run serve`).');
