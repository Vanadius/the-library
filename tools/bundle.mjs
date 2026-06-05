// Bundle the whole game into ONE self-contained HTML file: inline the CSS, the
// world data, and every script in load order. The result (web/palimpsest.html)
// needs nothing else — open it, or host it anywhere, and it just runs.

import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../web/', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

const css = await read('css/style.css');
const scripts = ['data/graph.js', 'js/core.js', 'js/persist.js', 'js/degrade.js',
  'js/ghosts.js', 'js/audio.js', 'js/engine.js', 'js/render.js', 'js/main.js'];
let js = '';
for (const s of scripts) js += `\n/* ==== ${s} ==== */\n` + (await read(s)) + '\n';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>PALIMPSEST</title>
<meta name="description" content="A library of almost-meaning. Read your way out." />
<style>
${css}
</style>
</head>
<body>
  <div id="app">
    <div id="status"></div>
    <div id="reader"></div>
    <div id="footer">
      <button id="btn-journal" title="mark this room (J)">journal</button>
      <button id="btn-sound" title="toggle sound">sound: off</button>
      <span class="spacer"></span>
      <span class="hint">1–9 / ↑↓ + enter to walk</span>
    </div>
  </div>
  <div id="journal">
    <h2>what you wrote down</h2>
    <div id="journal-entries" class="entries"></div>
    <textarea id="journal-text" placeholder="mark where you are, while the ink still holds…"></textarea>
    <div class="jbtns">
      <button onclick="P.app.saveNote()">mark</button>
      <button onclick="P.app.closeJournal()">close</button>
    </div>
  </div>
  <div id="screen"></div>
<script>
${js}
</script>
</body>
</html>
`;

await writeFile(new URL('palimpsest.html', root), html);
console.log(`wrote web/palimpsest.html (${(html.length / 1024).toFixed(0)} KB, self-contained)`);
