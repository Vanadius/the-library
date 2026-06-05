// Download the public-domain corpus and strip it to clean prose.
//
// Project Gutenberg wraps every text in a license header/footer marked by
// "*** START OF ..." / "*** END OF ...". We cut between those markers, then
// normalize whitespace and drop the boilerplate. Raw downloads are cached so
// re-running the build is cheap and offline-friendly.

import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { CORPUS, MIRRORS, PATHS } from './config.mjs';

const exists = (p) => access(p).then(() => true).catch(() => false);

async function fetchWithMirrors(id) {
  let lastErr;
  for (const mk of MIRRORS) {
    const url = mk(id);
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'palimpsest-build/1.0' } });
      if (!res.ok) { lastErr = new Error(`HTTP ${res.status} for ${url}`); continue; }
      const text = await res.text();
      if (text.length > 5000) return text;
      lastErr = new Error(`suspiciously short body from ${url}`);
    } catch (e) { lastErr = e; }
  }
  throw lastErr ?? new Error(`all mirrors failed for ${id}`);
}

// Cut Gutenberg license boilerplate and normalize.
export function cleanGutenberg(raw) {
  let t = raw.replace(/\r\n/g, '\n');
  const start = t.match(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG.*?\*\*\*/i);
  const end = t.match(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG.*?\*\*\*/i);
  if (start) t = t.slice(start.index + start[0].length);
  if (end) {
    const endIdx = t.indexOf(end[0]);
    if (endIdx > 0) t = t.slice(0, endIdx);
  }
  // Drop "Produced by" lines, transcriber notes, chapter rules, and runs of
  // underscores/asterisks used as ornament.
  t = t
    .replace(/^\s*Produced by.*$/gim, '')
    .replace(/\[Illustration[\s\S]*?\]/gi, '')   // multi-line illustration blocks
    .replace(/_/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  return t;
}

export async function fetchCorpus() {
  await mkdir(PATHS.raw, { recursive: true });
  await mkdir(PATHS.clean, { recursive: true });

  for (const work of CORPUS) {
    const rawPath = `${PATHS.raw}/${work.key}.txt`;
    const cleanPath = `${PATHS.clean}/${work.key}.txt`;
    let raw;
    if (await exists(rawPath)) {
      raw = await readFile(rawPath, 'utf8');
      process.stdout.write(`· ${work.key} (cached) `);
    } else {
      process.stdout.write(`↓ ${work.key} #${work.id} ... `);
      raw = await fetchWithMirrors(work.id);
      await writeFile(rawPath, raw);
    }
    const clean = cleanGutenberg(raw);
    await writeFile(cleanPath, clean);
    console.log(`${(clean.length / 1000).toFixed(0)}k chars`);
  }
  console.log('corpus ready.');
}

if (import.meta.url === `file://${process.argv[1]}`) fetchCorpus().catch((e) => { console.error(e); process.exit(1); });
