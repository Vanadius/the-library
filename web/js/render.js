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
  const WEAR_REVEAL = 3; // visits before the surface first wears through
  const WEAR_FULL = 6;   // visits to fully excavate the under-text

  // Render the buried older book, excavated in proportion to how worn the page is.
  function renderUnderText(n, wear, reader) {
    const words = n.under.split(' ');
    const frac = clamp((wear - (WEAR_REVEAL - 1)) / (WEAR_FULL - (WEAR_REVEAL - 1)));
    const shown = Math.max(1, Math.floor(frac * words.length));
    const block = h('div', { class: 'underpage' });
    block.appendChild(h('div', { class: 'underpage-label' },
      frac >= 1 ? 'the page is worn through; older writing beneath:' : 'the page is wearing thin; older writing shows beneath:'));
    const text = h('div', { class: 'undertext' });
    words.forEach((w, i) => text.appendChild(h('span', { class: i < shown ? 'u-shown' : 'u-hidden' }, w + ' ')));
    block.appendChild(text);
    reader.appendChild(block);
  }

  function setVars() {
    const root = document.documentElement.style;
    root.setProperty('--coh', P.engine.localCoherence().toFixed(3));
    root.setProperty('--drift', P.engine.drift().toFixed(3));
  }

  function render() {
    const n = P.engine.current();
    const drift = P.engine.drift();
    setVars();
    document.body.classList.toggle('in-sanctuary', !!n.sanctuary && n.kind !== 'exit');
    P.audio.setZone(n.theme);
    P.audio.setCoherence(P.engine.localCoherence());

    // A descent outranks a voice-crossing as the thing to announce.
    const descended = P.engine.justDescended();
    if (descended != null) {
      showDescentBanner(descended);
      if (P.audio.descend) P.audio.descend();
      P.engine.clearDescended();
    } else if (n.kind !== 'exit' && P.engine.regionChanged()) {
      showRegionBanner(P.engine.enteredRegion(), drift);
      P.audio.crossing();
    }

    renderStatus(n, drift);

    const reader = el('reader');
    reader.innerHTML = '';

    if (n.kind === 'exit') { renderExit(n, reader); return; }

    // A stair that just gave way under you.
    if (P.engine.falseStairTaken()) {
      reader.appendChild(h('div', { class: 'ghost falsestair' }, 'the stair gives way beneath the words. it was never a way down. climb back, and keep reading.'));
    }

    // The room. Sanctuaries get a quiet masthead — an unmistakable landmark.
    if (n.sanctuary) {
      reader.appendChild(h('div', { class: 'sanctuary-head' }, '✦  ' + n.themeLabel + '  ·  a sanctuary  ✦'));
    }
    const wear = P.engine.visitedCount(n.id);
    const worn = n.under && wear >= WEAR_REVEAL;
    reader.appendChild(h('div', { class: 'passage' + (n.sanctuary ? ' sanctuary' : '') + (worn ? ' worn' : '') }, n.text));

    // PALIMPSEST, literal: walk a room enough and its surface wears thin, and an
    // older authored book shows through from beneath — excavated word by word,
    // and immune to the drift, because it is the one true thing in the room.
    if (worn) renderUnderText(n, wear, reader);

    // A trace of someone who passed through.
    const ghost = P.ghosts.forNode(n);
    if (ghost) reader.appendChild(h('div', { class: 'ghost' }, P.degrade.label(ghost, drift * 0.5, n.id + 'g')));

    const presence = P.engine.presenceMark(n);
    if (presence) reader.appendChild(h('div', { class: 'ghost presence' }, P.degrade.label(presence, drift * 0.4, n.id + 'pr')));

    // The stair down, if this room offers one. It looks the same whether true or
    // false: only the passage tells you which, and only if you read it.
    if (n.descent) {
      reader.appendChild(h('div', { class: 'descend-control' }, [
        h('button', { class: 'descend', onclick: () => P.engine.descend() }, '↓  take the stair down'),
      ]));
    }

    renderExits(n, drift, reader);
    reader.scrollTop = 0;
  }

  // The descent event: a held, weighty announcement of the floor you've reached.
  function showDescentBanner(stratumIdx) {
    let banner = el('region-banner');
    if (!banner) { banner = h('div', { id: 'region-banner' }); document.body.appendChild(banner); }
    const depth = stratumIdx + 1, total = P.engine.totalStrata();
    banner.innerHTML = '';
    banner.appendChild(h('span', { class: 'rb-inner descend-banner' }, '↓  you descend  ·  stratum ' + roman(depth) + ' of ' + roman(total)));
    banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show');
  }
  function roman(n) {
    const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = ''; for (const [v, s] of map) while (n >= v) { out += s; n -= v; } return out || 'I';
  }

  // A brief, centered announcement of the voice you've just entered. Drifts a
  // little when you're lost, like everything else — but stays legible, because
  // knowing *where* you are never tells you where the exit is. It's place, not
  // a compass.
  function showRegionBanner(label, drift) {
    let banner = el('region-banner');
    if (!banner) { banner = h('div', { id: 'region-banner' }); document.body.appendChild(banner); }
    banner.innerHTML = '';
    banner.appendChild(h('span', { class: 'rb-inner' }, '— ' + P.degrade.label(label || '', drift * 0.35, 'region') + ' —'));
    banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show');
  }

  function renderStatus(n, drift) {
    const loc = P.degrade.label(n.themeLabel, drift, n.id + 'loc');
    const depth = P.engine.stratum() + 1, total = P.engine.totalStrata();
    el('status').innerHTML = '';
    el('status').append(
      h('div', { class: 'loc' }, [
        h('span', { class: 'depth' }, 'stratum ' + roman(depth) + ' / ' + roman(total)),
        h('span', { class: 'locname' }, P.degrade.label(' · ' + loc, drift * 0.7, n.id + 'l2')),
      ]),
      h('div', { class: 'right' },
        P.degrade.label(P.engine.run().steps + ' pages turned', drift * 0.4, 'pg')),
    );
  }

  function renderExits(n, drift, reader) {
    const exits = n.exits.slice();
    const wrap = h('div', { id: 'exits' });
    wrap.appendChild(h('div', { class: 'exits-label' }, P.degrade.label('the ways on', drift * 0.6, 'ways')));

    const compass = P.persist.compassUnlocked();
    const reach = P.engine.trailReach();
    const beacon = P.engine.beaconStrength();
    exits.forEach((e, i) => {
      const t = P.engine.node(e.to);
      const visited = P.engine.visitedCount(e.to) > 0;
      const previewRaw = e.preview || (t.text.split(/\s+/).slice(0, 8).join(' '));
      const preview = P.degrade.label(previewRaw, clamp(drift * 0.6), e.to + 'pv');

      const tags = [];

      // Journal beacon: a room you marked, lit while the note still holds.
      if (P.engine.isJournalled(e.to) && beacon > 0.12) {
        tags.push(h('span', { class: 'beacon', title: 'you left a note here', style: 'opacity:' + beacon.toFixed(2) }, '✦'));
      }
      // The dissolving trail: the way back, fading with how lost you are.
      const ti = P.engine.trailIndex(e.to);
      if (ti >= 0 && ti < reach) {
        const op = (1 - ti / Math.max(1, reach)) * 0.75 + 0.25;
        tags.push(h('span', { class: 'trailmark', title: 'the way back', style: 'opacity:' + op.toFixed(2) }, '↩'));
      }
      // A hall that reads as recently disturbed (presence; unreliable by design).
      if (P.engine.disturbedAhead(e.to)) {
        tags.push(h('span', { class: 'disturbed', title: 'recently disturbed' }, '≀'));
      }
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
