/* Procedural sound — no asset files, all synthesized via Web Audio.
 *
 * Two layers shape the ambience:
 *   1. COHERENCE (how lost you are) — as rooms get incoherent the drone detunes,
 *      the noise bed opens, and a formant "almost-voice" emerges that never quite
 *      forms a word. The exit is true silence, then the text.
 *   2. ZONE (which book you're in) — each voice has its own sonic signature: a
 *      root pitch, a noise colour, a vowel-like formant timbre, an LFO cadence.
 *      The whale is vast and slow; the undying is low and dreadful; the
 *      looking-glass is skittish and bright. Crossing voices crossfades between
 *      them, so the place has a sound, not just a temperature.
 *
 * Everything is generated — no licensing, no downloads. Audio only starts after
 * a user gesture (browser policy) and is off by default. */
P.audio = (function () {
  let ctx = null, master = null, started = false, enabled = false;
  let noiseSrc, noiseFilter, noiseGain;
  let droneOsc, droneGain;
  let formantA, formantB, formantGain, fFilter, lfo, lfoGain;
  let curCoh = 1, palette = null;

  // Per-voice palettes. Tuned by mood, not realism:
  //   root      drone fundamental (Hz)         noiseHz/Q  air colour
  //   toneHz    formant oscillator base        beat       detune ratio (its "grain")
  //   formantHz vowel centre of the almost-voice          formantQ sharpness
  //   lfoHz     wobble cadence                 *Gain      relative loudness
  const DEFAULT = { root: 55, noiseHz: 420, noiseQ: 0.6, toneHz: 320, beat: 1.02,
                    formantHz: 700, formantQ: 6, lfoHz: 0.7, wave: 'sawtooth',
                    droneGain: 0.05, voiceGain: 0.06, noiseGain: 0.06 };
  const PALETTES = {
    // light, airy, gentle — a bright drawing room
    austen:   { root: 82, noiseHz: 640, noiseQ: 0.5, toneHz: 392, beat: 1.005, formantHz: 980, formantQ: 4, lfoHz: 0.5, wave: 'triangle', droneGain: 0.034, voiceGain: 0.038, noiseGain: 0.05 },
    // heavy, ominous, crowded
    dickens:  { root: 49, noiseHz: 360, noiseQ: 0.7, toneHz: 233, beat: 1.03, formantHz: 560, formantQ: 7, lfoHz: 0.8, wave: 'sawtooth', droneGain: 0.06, voiceGain: 0.062, noiseGain: 0.06 },
    // organic, slow, patient
    darwin:   { root: 58, noiseHz: 480, noiseQ: 0.6, toneHz: 300, beat: 1.015, formantHz: 700, formantQ: 5, lfoHz: 0.34, wave: 'sine', droneGain: 0.045, voiceGain: 0.045, noiseGain: 0.055 },
    // tense, dissonant, a heartbeat under the floor
    poe:      { root: 52, noiseHz: 340, noiseQ: 0.8, toneHz: 277, beat: 1.06, formantHz: 520, formantQ: 9, lfoHz: 1.1, wave: 'sawtooth', droneGain: 0.06, voiceGain: 0.072, noiseGain: 0.06 },
    // uncanny, skittish, bright — wrong in a playful way
    carroll:  { root: 65, noiseHz: 720, noiseQ: 0.5, toneHz: 415, beat: 1.04, formantHz: 1080, formantQ: 6, lfoHz: 1.7, wave: 'square', droneGain: 0.04, voiceGain: 0.05, noiseGain: 0.05 },
    // electrical, cold, a buzz in the wiring
    shelley:  { root: 50, noiseHz: 520, noiseQ: 0.7, toneHz: 350, beat: 1.08, formantHz: 820, formantQ: 8, lfoHz: 0.9, wave: 'sawtooth', droneGain: 0.052, voiceGain: 0.06, noiseGain: 0.06 },
    // vast, deep, oceanic swells
    melville: { root: 41, noiseHz: 300, noiseQ: 0.6, toneHz: 196, beat: 1.01, formantHz: 470, formantQ: 5, lfoHz: 0.22, wave: 'sine', droneGain: 0.07, voiceGain: 0.05, noiseGain: 0.072 },
    // austere, sparse, almost silent — a quiet mind
    aurelius: { root: 55, noiseHz: 440, noiseQ: 0.5, toneHz: 330, beat: 1.003, formantHz: 660, formantQ: 3, lfoHz: 0.3, wave: 'sine', droneGain: 0.03, voiceGain: 0.03, noiseGain: 0.04 },
    // dread, low, the voice nearly present even when coherent (your Silent Hill)
    stoker:   { root: 46, noiseHz: 320, noiseQ: 0.85, toneHz: 220, beat: 1.05, formantHz: 500, formantQ: 9, lfoHz: 0.6, wave: 'sawtooth', droneGain: 0.066, voiceGain: 0.085, noiseGain: 0.07 },
    // cold, distant, thin air of a far time
    wells:    { root: 62, noiseHz: 780, noiseQ: 0.45, toneHz: 466, beat: 1.02, formantHz: 1240, formantQ: 5, lfoHz: 0.45, wave: 'triangle', droneGain: 0.035, voiceGain: 0.046, noiseGain: 0.05 },
  };
  palette = DEFAULT;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.0; master.connect(ctx.destination);

    // Air: filtered noise bed (the room tone).
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    noiseSrc = ctx.createBufferSource(); noiseSrc.buffer = noiseBuf; noiseSrc.loop = true;
    noiseFilter = ctx.createBiquadFilter(); noiseFilter.type = 'lowpass'; noiseFilter.frequency.value = palette.noiseHz; noiseFilter.Q.value = palette.noiseQ;
    noiseGain = ctx.createGain(); noiseGain.gain.value = palette.noiseGain;
    noiseSrc.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(master);

    // Drone floor.
    droneOsc = ctx.createOscillator(); droneOsc.type = 'sine'; droneOsc.frequency.value = palette.root;
    droneGain = ctx.createGain(); droneGain.gain.value = palette.droneGain;
    droneOsc.connect(droneGain); droneGain.connect(master);

    // The almost-voice: two detuned oscillators through a wandering bandpass.
    formantA = ctx.createOscillator(); formantA.type = palette.wave; formantA.frequency.value = palette.toneHz;
    formantB = ctx.createOscillator(); formantB.type = palette.wave; formantB.frequency.value = palette.toneHz * palette.beat;
    formantGain = ctx.createGain(); formantGain.gain.value = 0.0;
    fFilter = ctx.createBiquadFilter(); fFilter.type = 'bandpass'; fFilter.frequency.value = palette.formantHz; fFilter.Q.value = palette.formantQ;
    formantA.connect(fFilter); formantB.connect(fFilter); fFilter.connect(formantGain); formantGain.connect(master);

    lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = palette.lfoHz;
    lfoGain = ctx.createGain(); lfoGain.gain.value = 120;
    lfo.connect(lfoGain); lfoGain.connect(fFilter.frequency);

    [noiseSrc, droneOsc, formantA, formantB, lfo].forEach((o) => o.start());
    apply(0.4);
  }

  function setEnabled(on) {
    enabled = on;
    if (on) { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
    if (master) master.gain.setTargetAtTime(on ? 0.9 : 0.0, ctx ? ctx.currentTime : 0, 0.4);
  }

  // Select the voice of the current zone. Crossfades by retargeting every node.
  function setZone(themeKey) {
    const p = PALETTES[themeKey] || DEFAULT;
    const changed = p !== palette;
    palette = p;
    if (changed && formantA) { formantA.type = p.wave; formantB.type = p.wave; }
    apply();
  }

  // Move the soundscape toward (palette, coherence). 1 = calm, 0 = the drift.
  function setCoherence(coh) { curCoh = coh; apply(); }

  function apply(glide = 1.4) {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime, p = palette, drift = 1 - curCoh;
    noiseFilter.frequency.setTargetAtTime(p.noiseHz + drift * 260, t, glide);
    noiseFilter.Q.setTargetAtTime(p.noiseQ, t, glide);
    noiseGain.gain.setTargetAtTime(p.noiseGain + drift * 0.015, t, glide);
    droneOsc.frequency.setTargetAtTime(p.root * (1 - drift * 0.12), t, glide);
    droneGain.gain.setTargetAtTime(p.droneGain + drift * 0.04, t, glide);
    formantA.frequency.setTargetAtTime(p.toneHz, t, glide);
    formantB.frequency.setTargetAtTime(p.toneHz * p.beat, t, glide);
    fFilter.frequency.setTargetAtTime(p.formantHz, t, glide);
    fFilter.Q.setTargetAtTime(p.formantQ, t, glide);
    // The voice has a per-zone floor (its inherent dread) plus coherence drift.
    formantGain.gain.setTargetAtTime(p.voiceGain * (0.12 + drift * drift * 0.9), t, glide);
    lfo.frequency.setTargetAtTime(p.lfoHz + drift * 1.0, t, glide);
  }

  function pageTurn() {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    const len = Math.floor(0.12 * ctx.sampleRate);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3) * 0.5;
    src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1800;
    const g = ctx.createGain(); g.gain.value = 0.18;
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }

  // Crossing into a different voice. A soft threshold swell, rooted on the zone
  // you're entering so the chord belongs to its new home.
  function crossing() {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0006, t + 1.0);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    g.connect(f); f.connect(master);
    const base = (palette.root || 49) * 2;
    [base, base * 1.5, base * 2].forEach((freq, i) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(freq * 0.985, t);
      o.frequency.linearRampToValueAtTime(freq, t + 0.3);
      const og = ctx.createGain(); og.gain.value = i === 0 ? 1 : i === 1 ? 0.45 : 0.22;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + 1.05);
    });
  }

  // Descending a stratum: a longer, lower swell that glides downward and settles
  // — the floor opening, the drop, the new ground.
  function descend() {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.2, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 1.8);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(1200, t); f.frequency.exponentialRampToValueAtTime(220, t + 1.6);
    g.connect(f); f.connect(master);
    const root = (palette.root || 49);
    [root * 2, root * 3, root * 4].forEach((freq, i) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 1.5); // glide down an octave
      const og = ctx.createGain(); og.gain.value = i === 0 ? 1 : i === 1 ? 0.4 : 0.2;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + 1.85);
    });
  }

  // Recovering a page of the older book: one clear, unwavering tone with a soft
  // octave above — the only pure sound in the library, because it marks the only
  // pure thing in it. Brief, quiet, certain.
  function recovered() {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 2.2);
    g.connect(master);
    [[523.25, 1], [1046.5, 0.18]].forEach(([freq, amp]) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
      const og = ctx.createGain(); og.gain.value = amp;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + 2.3);
    });
  }

  // The exit: fade everything to true silence.
  function silence() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [noiseGain, droneGain, formantGain].forEach((g) => g && g.gain.setTargetAtTime(0, t, 0.8));
  }

  return { setEnabled, setCoherence, setZone, pageTurn, crossing, descend, recovered, silence, isEnabled: () => enabled, start: () => { if (enabled) ensure(); started = true; void started; } };
})();
