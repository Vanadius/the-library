// Stamp web/index.html's ?v= cache-busting tags with a fresh version on every
// build, so a new GitHub Pages deploy always invalidates previously-cached
// JS/CSS. Without this, Pages' ~10-minute asset cache makes updates appear not
// to land until the cache expires. (The standalone bundle needs none of this —
// it's a single self-contained file.)

import { readFile, writeFile } from 'node:fs/promises';

const stamp = process.argv[2] || new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const path = new URL('../web/index.html', import.meta.url);
const html = await readFile(path, 'utf8');
const out = html.replace(/\?v=[0-9A-Za-z._-]+/g, `?v=${stamp}`);
await writeFile(path, out);
const n = (out.match(/\?v=/g) || []).length;
console.log(`stamped ${n} asset url(s) in web/index.html with v=${stamp}`);
