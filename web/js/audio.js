/* Procedural sound — no asset files, all synthesized via Web Audio.
 *
 * Design's sonic arc:
 *   · high-coherence: quiet library-ambient, the odd page turn
 *   · low-coherence: the ambience "drifts" — a voice-like formant that almost
 *     resolves into words and never does
 *   · the exit: silence. real, complete silence. then the text.
 *
 * Everything is generated, so there are no licensing concerns and no downloads.
 * Audio only starts after a user gesture (browser policy); until then it's a
 * silent no-op. Fully optional — toggled off by default-respecting the mute pref.
 */
P.audio = (function () {
  let ctx = null, master = null, started = false, enabled = false;
  let bedGain, droneOsc, droneGain, formantA, formantB, formantGain, lfo, lfoGain;
  let noiseSrc, noiseGain, noiseFilter;
  let curCoh = 1;

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
    noiseFilter = ctx.createBiquadFilter(); noiseFilter.type = 'lowpass'; noiseFilter.frequency.value = 420; noiseFilter.Q.value = 0.6;
    noiseGain = ctx.createGain(); noiseGain.gain.value = 0.06;
    noiseSrc.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(master);

    // A low drone that detunes as coherence falls (the floor of the place).
    droneOsc = ctx.createOscillator(); droneOsc.type = 'sine'; droneOsc.frequency.value = 55;
    droneGain = ctx.createGain(); droneGain.gain.value = 0.05;
    droneOsc.connect(droneGain); droneGain.connect(master);

    // Two formant oscillators that, in the deep, beat against each other into an
    // almost-voice that never quite says a word.
    formantA = ctx.createOscillator(); formantA.type = 'sawtooth'; formantA.frequency.value = 320;
    formantB = ctx.createOscillator(); formantB.type = 'sawtooth'; formantB.frequency.value = 327;
    formantGain = ctx.createGain(); formantGain.gain.value = 0.0;
    const fFilter = ctx.createBiquadFilter(); fFilter.type = 'bandpass'; fFilter.frequency.value = 700; fFilter.Q.value = 6;
    formantA.connect(fFilter); formantB.connect(fFilter); fFilter.connect(formantGain); formantGain.connect(master);

    // Slow LFO wobbles the formant filter — the "almost words" cadence.
    lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.7;
    lfoGain = ctx.createGain(); lfoGain.gain.value = 120;
    lfo.connect(lfoGain); lfoGain.connect(fFilter.frequency);

    [noiseSrc, droneOsc, formantA, formantB, lfo].forEach((o) => o.start());
  }

  function setEnabled(on) {
    enabled = on;
    if (on) { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); }
    if (master) master.gain.setTargetAtTime(on ? 0.9 : 0.0, ctx ? ctx.currentTime : 0, 0.4);
  }

  // Move the soundscape toward a target coherence (0..1). 1 = calm library,
  // 0 = the drift. Exit calls silence() instead.
  function setCoherence(coh) {
    curCoh = coh;
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    const drift = 1 - coh;
    noiseFilter.frequency.setTargetAtTime(420 + drift * 280, t, 1.5);
    droneOsc.frequency.setTargetAtTime(55 - drift * 9, t, 1.5);
    droneGain.gain.setTargetAtTime(0.04 + drift * 0.05, t, 1.5);
    formantGain.gain.setTargetAtTime(drift * drift * 0.05, t, 1.5); // voice only emerges deep
    formantB.frequency.setTargetAtTime(327 + drift * 6, t, 1.5);
    lfo.frequency.setTargetAtTime(0.7 + drift * 1.4, t, 1.5);
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

  // The exit: fade everything to true silence.
  function silence() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [noiseGain, droneGain, formantGain].forEach((g) => g && g.gain.setTargetAtTime(0, t, 0.8));
  }

  return { setEnabled, setCoherence, pageTurn, silence, isEnabled: () => enabled, start: () => { if (enabled) ensure(); started = true; void started; } };
})();
