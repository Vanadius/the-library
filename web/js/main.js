/* Boot, intro, input, journal, endings. The thin glue that runs the show. */
P.app = (function () {
  const { el, h } = P.core;

  const INTRO =
`You do not remember coming in.

Shelves in every direction. Books on every shelf, words in every book — and you have read enough of them by now to know that almost none of the words mean anything. They arrive from nowhere. They hold together for a line, then forget what they were about.

The library only goes down. On each floor, hidden among the rooms that mean nothing, is one passage that someone *meant* — and it is a stair. Find it by reading, and descend. The fakes will flatter you; the real one will not need to.

At the very bottom is the one page written for you. You will know it when you read it.`;

  function boot() {
    const graph = window.GRAPH;
    if (!graph) { document.body.innerHTML = '<p style="color:#ffb000;padding:40px">graph not found — run the build (npm run build).</p>'; return; }

    // ?reset (or ?forget) wipes the save before anything loads — a bookmarkable
    // clean slate that needs no console.
    if (/[?&](reset|forget)\b/.test(location.search)) {
      P.persist.wipe();
      history.replaceState(null, '', location.pathname);
    }

    P.engine.init(graph);
    P.engine.onChange = () => P.render.render();

    buildTitle(graph);
    wireInput();
    wireFooter();

    // Resume hint: if the player is mid-run, the title still shows; entering
    // drops them where they left off.
  }

  function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function buildTitle(graph) {
    const meta = P.persist.meta();
    const resuming = P.engine.run().steps > 0 && !P.engine.run().found;
    const total = (graph.meta && graph.meta.strata) || 1;
    const depthNow = (P.engine.run().deepest || 0) + 1;
    const screen = el('screen');
    screen.className = '';
    screen.innerHTML = '';
    screen.append(
      h('h1', null, 'PALIMPSEST'),
      h('div', { class: 'sub' }, 'a library of almost-meaning'),
      h('div', { class: 'intro' }, resuming
        ? `You are still inside, ${ordinal(depthNow)} of ${total} floors down.\n\nThe shelves are where you left them. So are you.`
        : INTRO),
      h('div', { class: 'depth-read' }, resuming
        ? `the true page lies ${Math.max(0, total - depthNow)} ${total - depthNow === 1 ? 'floor' : 'floors'} below you still`
        : `the true page lies ${total - 1} floors down`),
      h('button', { class: 'enter', onclick: enter }, resuming ? 'go back in' : 'go in'),
      meta.runs > 0 || meta.nodesRead > 50
        ? h('div', { class: 'meta-line' }, `${meta.nodesRead} rooms read · ${meta.runs} ${meta.runs === 1 ? 'descent' : 'descents'}${meta.everFound ? ' · you have found it before' : ''}`)
        : h('div', { class: 'meta-line' }, 'press · then read'),
    );
    // Reset, only offered once there's something to forget.
    if (meta.nodesRead > 0 || P.engine.run().steps > 0) {
      screen.append(h('button', { class: 'forget', onclick: forgetEverything }, 'forget everything'));
    }
  }

  function forgetEverything() {
    if (!confirm('Forget everything? This erases your position, your notes, and the reading you have done — the compass re-locks and you arrive new. This cannot be undone.')) return;
    P.persist.wipe();
    P.engine.newRun();
    buildTitle(window.GRAPH);
  }

  function enter() {
    el('screen').classList.add('hidden');
    if (P.audio.isEnabled()) P.audio.start();
    P.render.render();
  }

  function wireFooter() {
    el('btn-journal').onclick = openJournal;
    const sound = el('btn-sound');
    sound.textContent = P.audio.isEnabled() ? 'sound: on' : 'sound: off';
    sound.onclick = () => {
      P.audio.setEnabled(!P.audio.isEnabled());
      sound.textContent = P.audio.isEnabled() ? 'sound: on' : 'sound: off';
      if (P.audio.isEnabled()) { P.audio.start(); P.audio.setCoherence(P.engine.localCoherence()); }
    };
    // A "key" control, injected so it lives in both the multi-file and the
    // single-file builds without duplicating markup.
    if (!el('btn-key')) {
      const key = h('button', { id: 'btn-key', title: 'what the marks mean (?)', onclick: openKey }, 'key');
      sound.insertAdjacentElement('afterend', key);
    }
  }

  // ---- the key (what the HUD marks mean) ----
  // Opt-in on purpose: players who want to stay in the dark never open it; the
  // confused get a clear explanation. It explains the *chrome* (marks, drift),
  // never where the door is — reading is still the only compass.
  function buildLegend() {
    const { h } = P.core;
    const rows = [
      ['↓', '', 'a stair down', 'offered by any room that might be a way to the next floor — true or false. only the passage tells you which, and only if you read it. a true stair carries you deeper; a false one drops you into a dead end to climb back out of.'],
      ['↩', 'trailmark', 'the way you came', 'a fading trail of the rooms behind you. its reach shrinks the more lost you are — a few steps when your head is clear, nothing in the deep. it only ever points backward.'],
      ['✦', 'beacon', 'a room you marked', 'a beacon over a journalled room one step away. it dims as your notes drift, and goes dark once you can no longer trust them.'],
      ['≀', 'disturbed', 'recently disturbed', 'this hall reads as though something passed through it lately. maybe someone did. it promises nothing — good or bad.'],
      ['·', '', 'you have been here', 'a hall you have already walked at least once.'],
      ['▓', 'warmth', 'the air ahead', 'if it has come to you yet: a wordless sense of how coherent the next room feels. warmer is more ordered — and it is fooled by the most beautiful dead ends. trust your reading over it.'],
    ];
    const list = rows.map(([g, cls, name, desc]) => h('div', { class: 'legend-row' }, [
      h('span', { class: 'legend-glyph ' + cls }, g),
      h('div', null, [h('div', { class: 'legend-name' }, name), h('div', { class: 'legend-desc' }, desc)]),
    ]));
    const overlay = h('div', { id: 'legend' }, [
      h('h2', null, 'reading the marks'),
      h('p', { class: 'legend-note' },
        'The library only goes down. Each floor begins in a sanctuary — an oasis that clears the drift and lets you rest and orient. Somewhere on each floor is a true stair, hidden among rooms that mean nothing; find it by reading, and descend. The depth at the top (Stratum N / M) is your progress; the one true page is kept at the very bottom.'),
      h('div', { class: 'legend-rows' }, list),
      h('p', { class: 'legend-note' },
        'How the drift works: the longer you spend in rooms that mean nothing, the more lost you become — and your instruments stop telling the truth. Labels take strange accents, words go missing, your own notes rewrite themselves, and these marks fade. It lingers, and lifts only slowly when you find clearer rooms.'),
      h('p', { class: 'legend-note' },
        'One thing never drifts: the passage you are reading. The incoherence there is real — in the words themselves, never in the ink.'),
      h('p', { class: 'legend-note dim' },
        'None of these marks know where the door is. Only reading does.'),
      h('div', { class: 'jbtns' }, h('button', { onclick: closeKey }, 'close')),
    ]);
    document.body.appendChild(overlay);
    return overlay;
  }
  function openKey() { (el('legend') || buildLegend()).classList.add('open'); }
  function closeKey() { const l = el('legend'); if (l) l.classList.remove('open'); }

  // ---- journal ----
  function openJournal() {
    const j = el('journal');
    const drift = P.engine.drift();
    const entries = el('journal-entries');
    entries.innerHTML = '';
    const corpus = P.engine.noteWords();
    const list = P.engine.journal();
    if (!list.length) entries.appendChild(h('div', { class: 'entry' }, h('span', { class: 'meta' }, 'nothing written yet. mark a room while you can still trust the ink.')));
    list.forEach((e) => {
      // your own words drift — the deeper you are now, the less your past notes hold
      const text = P.degrade.note(e.text, drift, e.at, corpus);
      entries.appendChild(h('div', { class: 'entry' }, [
        h('div', { class: 'meta' }, P.degrade.label(e.loc, drift * 0.6, e.at) + ' · ' + new Date(e.t).toLocaleTimeString()),
        h('div', null, text),
      ]));
    });
    j.classList.add('open');
    el('journal-text').focus();
  }
  function closeJournal() { el('journal').classList.remove('open'); }
  function saveNote() {
    const ta = el('journal-text');
    const v = ta.value.trim();
    if (v) { P.engine.addNote(v); ta.value = ''; }
    openJournal();
  }

  // ---- endings ----
  function endScreen() {
    const meta = P.persist.meta();
    const screen = el('screen');
    screen.className = 'ending';
    screen.innerHTML = '';
    // The coda is chosen by how you read your way here — a mirror, not a score.
    const coda = P.engine.endingCoda();
    const intro = coda.text
      || `You found the one page that was meant.\n\nWhether your certainty that it was real proves anything about you — whether recognition is understanding, or only what understanding feels like from the inside — the library does not say.`;
    screen.append(
      h('h1', null, 'you turned around'),
      h('div', { class: 'sub' }, 'the door was the reading'),
      h('div', { class: 'intro' }, intro),
      h('div', { class: 'meta-line' }, `${meta.nodesRead} rooms · ${meta.runs} ${meta.runs === 1 ? 'descent' : 'descents'} · one sentence that was waiting`),
      h('button', { class: 'enter', onclick: () => { P.engine.newRun(); buildTitle(window.GRAPH); el('screen').classList.remove('hidden'); } }, 'go in again'),
      h('div', { class: 'meta-line' }, 'the world reshuffles only when it is rebuilt. these shelves remain. you, perhaps, do not.'),
    );
    screen.classList.remove('hidden');
  }

  function wireInput() {
    document.addEventListener('keydown', (ev) => {
      const legend = el('legend');
      if (legend && legend.classList.contains('open')) {
        if (ev.key === 'Escape' || ev.key === '?') closeKey();
        return;
      }
      if (el('journal').classList.contains('open')) {
        if (ev.key === 'Escape') closeJournal();
        return;
      }
      if (ev.key === '?') { ev.preventDefault(); openKey(); return; }
      if (!el('screen').classList.contains('hidden')) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); const b = document.querySelector('#screen .enter'); if (b) b.click(); }
        return;
      }
      if (P.engine.isEnded()) return;
      if (/^[1-9]$/.test(ev.key)) { P.render.choose(parseInt(ev.key, 10) - 1); }
      else if (ev.key === 'ArrowDown' || ev.key === 'j') { ev.preventDefault(); P.render.moveSel(1); }
      else if (ev.key === 'ArrowUp' || ev.key === 'k') { ev.preventDefault(); P.render.moveSel(-1); }
      else if (ev.key === 'Enter') { ev.preventDefault(); P.render.confirmSel(); }
      else if (ev.key === 'J' || (ev.key === 'n' && ev.shiftKey)) openJournal();
    });
  }

  return { boot, endScreen, openJournal, closeJournal, saveNote, openKey, closeKey };
})();

document.addEventListener('DOMContentLoaded', P.app.boot);
