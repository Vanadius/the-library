/* Boot, intro, input, journal, endings. The thin glue that runs the show. */
P.app = (function () {
  const { el, h } = P.core;

  const INTRO =
`You do not remember coming in.

Shelves in every direction. Books on every shelf, words in every book — and you have read enough of them by now to know that almost none of the words mean anything. They arrive from nowhere. They hold together for a line, sometimes a page, and then they forget what they were about.

Somewhere in here, one passage was written by a person, on purpose, for you. You are not told what it looks like. You will know it when you read it.

You move by reading. That is the only way to move.`;

  function boot() {
    const graph = window.GRAPH;
    if (!graph) { document.body.innerHTML = '<p style="color:#ffb000;padding:40px">graph not found — run the build (npm run build).</p>'; return; }

    P.engine.init(graph);
    P.engine.onChange = () => P.render.render();

    buildTitle(graph);
    wireInput();
    wireFooter();

    // Resume hint: if the player is mid-run, the title still shows; entering
    // drops them where they left off.
  }

  function buildTitle(graph) {
    const meta = P.persist.meta();
    const resuming = P.engine.run().steps > 0 && !P.engine.run().found;
    const screen = el('screen');
    screen.className = '';
    screen.innerHTML = '';
    screen.append(
      h('h1', null, 'PALIMPSEST'),
      h('div', { class: 'sub' }, 'a library of almost-meaning'),
      h('div', { class: 'intro' }, resuming ? 'You are still inside.\n\nThe shelves are where you left them. So are you.' : INTRO),
      h('button', { class: 'enter', onclick: enter }, resuming ? 'go back in' : 'go in'),
      meta.runs > 0 || meta.nodesRead > 50
        ? h('div', { class: 'meta-line' }, `${meta.nodesRead} rooms read · ${meta.runs} ${meta.runs === 1 ? 'descent' : 'descents'}${meta.everFound ? ' · you have found it before' : ''}`)
        : h('div', { class: 'meta-line' }, 'press · then read'),
    );
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
  }

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
    screen.append(
      h('h1', null, 'you turned around'),
      h('div', { class: 'sub' }, 'the door was the reading'),
      h('div', { class: 'intro' },
        `You found the one page that was meant.\n\nWhether your certainty that it was real proves anything about you — whether recognition is understanding, or only what understanding feels like from the inside — the library does not say. It never did.\n\n${meta.nodesRead} rooms. ${meta.runs} ${meta.runs === 1 ? 'descent' : 'descents'}. One sentence that was waiting.`),
      h('button', { class: 'enter', onclick: () => { P.engine.newRun(); buildTitle(window.GRAPH); el('screen').classList.remove('hidden'); } }, 'go in again'),
      h('div', { class: 'meta-line' }, 'the world reshuffles only when it is rebuilt. these shelves remain. you, perhaps, do not.'),
    );
    screen.classList.remove('hidden');
  }

  function wireInput() {
    document.addEventListener('keydown', (ev) => {
      if (el('journal').classList.contains('open')) {
        if (ev.key === 'Escape') closeJournal();
        return;
      }
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

  return { boot, endScreen, openJournal, closeJournal, saveNote };
})();

document.addEventListener('DOMContentLoaded', P.app.boot);
