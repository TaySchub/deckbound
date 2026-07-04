/*
  Deckbound — src/audio.js
  100% procedural Web Audio (no files, no deps): the `audio` object.
  Touch only on a dedicated audio branch. The engine never calls this
  directly — src/main.js wires engine FX hooks to these methods.
*/

/* =========================================================================
   4) AUDIO
   ========================================================================= */

const audio = {
  ctx: null, ready: false, muted: false,
  unlock() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      if (this.ctx.state === "suspended") this.ctx.resume();
      this.ready = true;
    } catch (e) { console.warn("Deckbound: audio unavailable —", e); }
  },

  // ---- low-level helpers -------------------------------------------------
  // A soft-attack / smooth-release gain envelope. The whole "robotic" problem
  // is mostly hard digital clicks — a gain that jumps to full volume or snaps
  // to zero at frame boundaries. Ramping up over a few ms and decaying with
  // setTargetAtTime (an exponential glide, never a hard stop) removes that.
  env(g, peak, t0, attack = 0.008, release = 0.16, sustain = null) {
    const hold = sustain != null ? sustain : peak;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    if (sustain != null) g.gain.linearRampToValueAtTime(hold, t0 + attack + 0.02);
    g.gain.setTargetAtTime(0.0001, t0 + attack, release);
  },
  // One "voice": 1–3 gently-detuned oscillators through a shared lowpass
  // filter and an enveloped gain, optionally with vibrato and a filter sweep.
  // Detuning a couple of layers a few cents/Hz apart is what makes a tone
  // sound like a played instrument instead of a bare test-tone beep.
  voice(freq, opts = {}) {
    if (!this.ready || this.muted || !this.ctx) return;
    const {
      type = "sine", dur = 0.18, gain = 0.18, freqTo = null,
      detunes = [0], attack = 0.008, release = 0.15,
      filterFreq = null, filterFreqTo = null, filterQ = 0.7,
      vibratoHz = 0, vibratoCents = 0, pan = null,
    } = opts;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const g = ctx.createGain();
    let node = g;
    if (filterFreq != null) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass"; f.Q.value = filterQ;
      f.frequency.setValueAtTime(filterFreq, t0);
      if (filterFreqTo != null) f.frequency.exponentialRampToValueAtTime(Math.max(40, filterFreqTo), t0 + dur);
      g.connect(f);
      node = f;
    }
    let out = node;
    if (pan != null && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node.connect(p);
      out = p;
    }
    out.connect(ctx.destination);

    let lfo = null, lfoGain = null;
    if (vibratoHz > 0 && vibratoCents > 0) {
      lfo = ctx.createOscillator();
      lfo.frequency.value = vibratoHz;
      lfoGain = ctx.createGain();
      lfoGain.gain.value = freq * (Math.pow(2, vibratoCents / 1200) - 1); // cents -> Hz swing
      lfo.connect(lfoGain);
      lfo.start(t0);
      lfo.stop(t0 + dur + release);
    }

    const oscs = detunes.map((cents) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      const f = freq * Math.pow(2, cents / 1200);
      osc.frequency.setValueAtTime(f, t0);
      if (freqTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo * Math.pow(2, cents / 1200)), t0 + dur);
      if (lfoGain) lfoGain.connect(osc.frequency);
      osc.connect(g);
      osc.start(t0);
      osc.stop(t0 + dur + release);
      return osc;
    });

    this.env(g, gain, t0, attack, release);
    if (lfo) lfo.onended = () => { lfoGain.disconnect(); };
    oscs[oscs.length - 1].onended = () => { g.disconnect(); };
    return { osc: oscs[0], gain: g };
  },
  // Back-compat-ish simple tone, now routed through voice() so every caller
  // gets the soft envelope + click-free release for free.
  tone(freq, dur, type = "sine", gain = 0.2, freqTo = null, extra = {}) {
    return this.voice(freq, { type, dur, gain, freqTo, ...extra });
  },
  // Filtered noise: white noise through a resonant bandpass/lowpass instead
  // of raw broadband hiss. That's what turns a "static burst" into an organic
  // chomp/crunch/clatter transient — the filter picks out a body/formant the
  // way a real bite or clatter would have, rather than sounding like a radio.
  noiseBurst(dur, gain = 0.25, opts = {}) {
    if (!this.ready || this.muted || !this.ctx) return;
    const { filterType = "bandpass", freq = 1400, freqTo = null, q = 1.0, attack = 0.004, release = null } = opts;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Slightly biased noise generation (average of two randoms) is softer/
    // less "hissy" than pure uniform white noise — a cheap warmth trick.
    for (let i = 0; i < frames; i++) {
      const n = (Math.random() + Math.random() - 1);
      data[i] = n * (1 - i / frames);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filt = ctx.createBiquadFilter();
    filt.type = filterType; filt.Q.value = q;
    filt.frequency.setValueAtTime(freq, t0);
    if (freqTo != null) filt.frequency.exponentialRampToValueAtTime(Math.max(40, freqTo), t0 + dur);
    const g = ctx.createGain();
    this.env(g, gain, t0, attack, release != null ? release : Math.max(0.03, dur * 0.5));
    src.connect(filt).connect(g).connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.2);
  },

  // ---- effects ------------------------------------------------------------
  // Attack = a bite/chomp, one flavor per customer (kept distinct + randomized so
  // a stream never feels repetitive). Warm, filtered, layered voices stand in for
  // the old bare oscillators; filtered noise stands in for raw white noise.
  shoot(typeId) {
    if (!this.ready || this.muted || !this.ctx) return;
    const r = 1 + (Math.random() * 0.14 - 0.07); // ±7% pitch wobble
    switch (typeId) {
      case "cannon": // Big Appetite — deep, round inhaling gulp
        this.voice(190 * r, { type: "sine", detunes: [-6, 0, 7], dur: 0.2, gain: 0.16, freqTo: 65, attack: 0.01, release: 0.16, filterFreq: 900, filterFreqTo: 220 });
        this.noiseBurst(0.12, 0.09, { filterType: "lowpass", freq: 700, freqTo: 220, q: 0.6 });
        break;
      case "frost": // The Photographer — soft shutter click + cold nibble
        this.noiseBurst(0.035, 0.07, { filterType: "bandpass", freq: 2600, q: 2.2, attack: 0.002, release: 0.03 });
        this.voice(880 * r, { type: "triangle", detunes: [0, 9], dur: 0.07, gain: 0.05, freqTo: 1200, filterFreq: 3200, release: 0.06 });
        break;
      case "sniper": // The Milkshake Slurper — crisp pluck/snap (a slurp/sip sound is a TODO for the audio pass)
        this.voice(520 * r, { type: "triangle", detunes: [-4, 4], dur: 0.1, gain: 0.08, freqTo: 220, attack: 0.004, release: 0.08, filterFreq: 2200, filterFreqTo: 900 });
        this.noiseBurst(0.02, 0.04, { filterType: "bandpass", freq: 3000, q: 1.5, attack: 0.001, release: 0.02 });
        break;
      case "zap": // The Kids' Table — tiny, quick, friendly nibble
        this.voice(680 * r, { type: "triangle", detunes: [0, 10], dur: 0.05, gain: 0.045, freqTo: 380, attack: 0.003, release: 0.05, filterFreq: 2600 });
        break;
      default: // The Regular — steady fork-stab bite
        this.voice(340 * r, { type: "triangle", detunes: [-5, 0, 5], dur: 0.1, gain: 0.07, freqTo: 150, attack: 0.005, release: 0.09, filterFreq: 1800, filterFreqTo: 700 });
        this.noiseBurst(0.05, 0.05, { filterType: "bandpass", freq: 1600, q: 1.2, release: 0.04 });
    }
  },
  hit() { // light fork *tink* on a non-lethal bite — soft triangle, gently filtered
    this.voice(520 + Math.random() * 140, { type: "triangle", detunes: [0, 6], dur: 0.05, gain: 0.03, attack: 0.003, release: 0.05, filterFreq: 2800 });
  },
  kill() { // a satisfying crunch + gulp as a dish is eaten
    const start = 320 + Math.random() * 150;
    this.voice(start, { type: "sawtooth", detunes: [-7, 0, 7], dur: 0.2, gain: 0.11, freqTo: 75, attack: 0.006, release: 0.14, filterFreq: 1600, filterFreqTo: 350 }); // swallow-down gulp, de-buzzed by the filter
    this.noiseBurst(0.16, 0.16, { filterType: "lowpass", freq: 1800, freqTo: 500, q: 0.7, attack: 0.003, release: 0.12 }); // crunch
    setTimeout(() => this.voice(108, { type: "sine", detunes: [0, 5], dur: 0.14, gain: 0.1, freqTo: 58, attack: 0.01, release: 0.14 }), 55); // low "gulp" tail
  },
  // A dish clatters into the trash + a sad little descending trombone — a wasted meal.
  leak() {
    this.noiseBurst(0.13, 0.13, { filterType: "bandpass", freq: 1200, freqTo: 600, q: 1.1, attack: 0.003, release: 0.1 }); // clatter
    [330, 262, 208, 165].forEach((f, i) => setTimeout(() => this.voice(f, {
      type: "sawtooth", detunes: [-6, 0, 6], dur: 0.2, gain: 0.1, freqTo: f * 0.94,
      attack: 0.015, release: 0.16, filterFreq: 1100, filterFreqTo: 500, vibratoHz: 5, vibratoCents: 12,
    }), i * 95));
  },
  upgrade() { // "Order up!" — a bright but rounded diner service-bell ding-ding
    const ding = () => {
      this.voice(1320, { type: "sine", detunes: [0, 3], dur: 0.55, gain: 0.12, attack: 0.004, release: 0.42, filterFreq: 5200 });
      this.voice(1980, { type: "sine", dur: 0.4, gain: 0.045, attack: 0.004, release: 0.3, filterFreq: 6000 });
    };
    ding(); setTimeout(ding, 140);
  },
  build() { this.voice(300, { type: "triangle", detunes: [0, 6], dur: 0.1, gain: 0.13, freqTo: 460, attack: 0.006, release: 0.09, filterFreq: 2200 }); },
  deny() { this.voice(180, { type: "sawtooth", detunes: [0, 5], dur: 0.13, gain: 0.09, freqTo: 120, attack: 0.005, release: 0.1, filterFreq: 900 }); },
  waveStart() { this.voice(330, { type: "triangle", detunes: [-4, 0, 4], dur: 0.18, gain: 0.13, freqTo: 500, attack: 0.008, release: 0.14, filterFreq: 2600 }); },
  buy() {
    this.voice(520, { type: "sine", detunes: [0, 4], dur: 0.11, gain: 0.13, freqTo: 780, attack: 0.006, release: 0.1, filterFreq: 3400 });
    setTimeout(() => this.voice(780, { type: "sine", detunes: [0, 4], dur: 0.13, gain: 0.13, attack: 0.006, release: 0.12, filterFreq: 3800 }), 90);
  },
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.voice(f, { type: "triangle", detunes: [-4, 0, 4], dur: 0.28, gain: 0.15, attack: 0.008, release: 0.22, filterFreq: 3600, vibratoHz: 5.5, vibratoCents: 6 }), i * 130)); },
  lose() { [400, 300, 220, 150].forEach((f, i) => setTimeout(() => this.voice(f, { type: "sawtooth", detunes: [-6, 0, 6], dur: 0.32, gain: 0.13, attack: 0.01, release: 0.24, filterFreq: 1400, filterFreqTo: 500 }), i * 150)); },
};

