/* Rendering. Rebuilds the reading view from engine state every move.
 *
 * What's honest and what drifts (the whole ethical line of the design):
 *   · The PASSAGE you stand in — always pristine. It's the data you judge.
 *   · PREVIEWS down each hall — mildly hazed by drift. You can't fully trust a
 *     glimpse; you have to commit and read. This sharpens the mimic danger.
 *   · STATUS / TAGS / your NOTES / the COMPASS — drift freely. The instruments lie.
 */
P.render = (function () {
  const { el, h, clamp } = P.core;
  let selIndex = 0;

  function setVars() {
    const root = document.documentElement.style;
    root.setProperty('--coh', P.engine.localCoherence().toFixed(3));
    root.setProperty('--drift', P.engine.drift().toFixed(3));
  }

  function render() {
    const n = P.engine.current();
    const drift = P.engine.drift();
    setVars();
    P.audio.setCoherence(P.engine.localCoherence());

    // You just stepped from one voice into another — mark it so the change of
    // place is felt, not missed.
    if (n.kind !== 'exit' && P.engine.regionChanged()) {
      showRegionBanner(P.engine.enteredRegion(), drift);
      P.audio.crossing();
    }

    renderStatus(n, drift);

    const reader = el('reader');
    reader.innerHTML = '';

    if (n.kind === 'exit') { renderExit(n, reader); return; }

    // The room.
    reader.appendChild(h('div', { class: 'passage' }, n.text));

    // A trace of someone who passed through.
    const ghost = P.ghosts.forNode(n);
    if (ghost) reader.appendChild(h('div', { class: 'ghost' }, P.degrade.label(ghost, drift * 0.5, n.id + 'g')));

    renderExits(n, drift, reader);
    reader.scrollTop = 0;
  }

  // A brief, centered announcement of the voice you've just entered. Drifts a
  // little when you're lost, like everything else — but stays legible, because
  // knowing *where* you are never tells you where the exit is. It's place, not
  // a compass.
  function showRegionBanner(label, drift) {
    let banner = el('region-banner');
    if (!banner) { banner = h('div', { id: 'region-banner' }); document.body.appendChild(banner); }
    banner.textContent = '— ' + P.degrade.label(label || '', drift * 0.35, 'region') + ' —';
    banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show');
  }

  function renderStatus(n, drift) {
    const loc = P.degrade.label(n.themeLabel, drift, n.id + 'loc');
    const meta = P.persist.meta();
    el('status').innerHTML = '';
    el('status').append(
      h('div', { class: 'loc' }, P.degrade.label('— ' + loc + ' —', drift * 0.7, n.id + 'l2')),
      h('div', { class: 'right' }, [
        h('span', null, P.degrade.label(P.engine.run().steps + ' pages turned', drift * 0.4, 'pg')),
      ]),
    );
  }

  function renderExits(n, drift, reader) {
    const exits = n.exits.slice();
    const wrap = h('div', { id: 'exits' });
    wrap.appendChild(h('div', { class: 'exits-label' }, P.degrade.label('the ways on', drift * 0.6, 'ways')));

    const compass = P.persist.compassUnlocked();
    exits.forEach((e, i) => {
      const t = P.engine.node(e.to);
      const visited = P.engine.visitedCount(e.to) > 0;
      const previewRaw = e.preview || (t.text.split(/\s+/).slice(0, 8).join(' '));
      const preview = P.degrade.label(previewRaw, clamp(drift * 0.6), e.to + 'pv');

      const tags = [];
      if (compass) {
        tags.push(h('span', { class: 'warmth', title: 'a sense of the air ahead' },
          P.degrade.warmth(t.coherence, drift, e.to)));
      }

      const btn = h('button', { class: 'exit' + (visited ? ' visited' : '') + (i === selIndex ? ' sel' : ''),
        'data-i': i, onclick: () => choose(i) }, [
        h('span', { class: 'num' }, (i + 1) + ''),
        h('span', { class: 'preview' }, '“' + preview + '…”'),
        h('span', { class: 'tags' }, tags),
      ]);
      wrap.appendChild(btn);
    });
    selIndex = Math.min(selIndex, exits.length - 1);
    reader.appendChild(wrap);
  }

  function choose(i) {
    const n = P.engine.current();
    if (i < 0 || i >= n.exits.length) return;
    P.audio.pageTurn();
    selIndex = 0;
    P.engine.move(n.exits[i].to);
  }

  function moveSel(d) {
    const n = P.engine.current();
    if (!n.exits.length) return;
    selIndex = (selIndex + d + n.exits.length) % n.exits.length;
    document.querySelectorAll('.exit').forEach((b, i) => b.classList.toggle('sel', i === selIndex));
    const sel = document.querySelector('.exit.sel');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }
  function confirmSel() { choose(selIndex); }

  function renderExit(n, reader) {
    P.audio.silence();
    document.documentElement.style.setProperty('--drift', '0');
    document.documentElement.style.setProperty('--coh', '1');
    reader.appendChild(h('div', { class: 'passage authored' }, n.text));
    const meta = P.persist.meta();
    reader.appendChild(h('div', { class: 'ghost' },
      `you have read ${meta.nodesRead} rooms across ${Math.max(1, meta.runs)} ${meta.runs === 1 ? 'descent' : 'descents'}.`));
    reader.appendChild(h('div', { id: 'exits' }, [
      h('button', { class: 'exit back', onclick: () => P.app.endScreen() }, [
        h('span', { class: 'num' }, '↩'),
        h('span', { class: 'preview' }, 'turn around'),
      ]),
    ]));
    reader.scrollTop = 0;
  }

  return { render, choose, moveSel, confirmSel };
})();
