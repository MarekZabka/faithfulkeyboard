// audio.js
// Polyphonic synth engine. getAudioCtx, playKeySustained, playKey, all patchXxx functions.
// ======================================================================


// ═════════════════════════════════════════════════════════════════════════════
// ═════════════════════════════════════════════════════════════════════════════
//  AUDIO ENGINE  —  Polyphonic Synth Core
//  Phase A: shared infrastructure (context, limiter, voice pool, ADSR)
//  Phase B: six distinct patches
//  Phase C: loudness normalisation per patch per frequency
// ═════════════════════════════════════════════════════════════════════════════

// ── A1: Audio Context ────────────────────────────────────────────────────────
let audioCtx = null;
let _masterBus = null;   // master gain → limiter → destination
let _limiter   = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Master bus: compressor/limiter to prevent clipping with many voices
    _limiter = audioCtx.createDynamicsCompressor();
    _limiter.threshold.value = -6;
    _limiter.knee.value      =  3;
    _limiter.ratio.value     = 20;
    _limiter.attack.value    = 0.003;
    _limiter.release.value   = 0.15;
    _masterBus = audioCtx.createGain();
    _masterBus.gain.value = 0.9;
    _masterBus.connect(_limiter);
    _limiter.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// ── A2: Envelope helper ──────────────────────────────────────────────────────
function getEnvelope() {
  return {
    attack:  parseFloat(document.getElementById('env-attack').value)  / 1000,
    sustain: parseFloat(document.getElementById('env-sustain').value),
    release: parseFloat(document.getElementById('env-release').value) / 1000,
    volume:  parseFloat(document.getElementById('master-vol').value)
  };
}

// Read extended synth shaping parameters from the Sound tab
function getSynthParams() {
  function v(id, def) { const el = document.getElementById(id); return el ? parseFloat(el.value) : def; }
  function s(id, def) { const el = document.getElementById(id); return el ? el.value : def; }
  return {
    // Oscillator
    detuneAmount: v('synth-detune', 0),       // cents of chorus detuning
    // Filter
    filterType:   s('synth-filter-type', 'none'),
    filterFreq:   v('synth-filter-freq', 2000), // Hz (relative: multiplied by note freq if < 20)
    filterQ:      v('synth-filter-q', 1.0),
    // Amp shape
    vibRate:      v('synth-vib-rate', 5.5),    // Hz
    vibDepth:     v('synth-vib-depth', 0),     // 0–1 (fraction of freq)
  };
}

// ── A3: Equal-loudness compensation (ISO 226 simplified inverse) ─────────────
// Returns a gain multiplier so all frequencies feel equally loud at moderate volume.
// Calibrated so unity gain is around 500–2000 Hz (where hearing is most sensitive).
function freqGain(freq) {
  // Gentle equal-loudness compensation: ±4 dB max.
  // Bass and treble get a modest boost; mid-range is unity.
  // Kept small so it doesn't saturate the master limiter.
  const f = Math.max(40, Math.min(16000, freq));
  let dB = 0;
  if      (f < 120)  dB =  4 * (1 - (f - 40) / 80);   // +4→0 dB over 40–120 Hz
  else if (f < 600)  dB =  0;                           // flat
  else if (f < 2000) dB = -2 * (f - 600) / 1400;       // -2 dB at 2 kHz (presence peak)
  else if (f < 8000) dB = -2 + 4 * (f - 2000) / 6000;  // +2 dB at 8 kHz
  else               dB =  2;
  return Math.pow(10, dB / 20);  // ≈0.63 – 1.58 range
}

// ── A4: Noise buffer factory (cached) ────────────────────────────────────────
let _noiseBuffer = null;
function getNoiseBuffer(ctx) {
  if (!_noiseBuffer || _noiseBuffer.sampleRate !== ctx.sampleRate) {
    const dur = 4; // 4 seconds of noise — looped
    _noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = _noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return _noiseBuffer;
}

// ── A5: Voice helper — wires nodes and returns a release() closure ───────────
// Signature: buildVoice(ctx, masterGain, nodes)  →  used inside each patch
// The release function fades masterGain and stops all nodes.
function makeRelease(ctx, masterGain, nodes, releaseTime) {
  return function() {
    const t = ctx.currentTime;
    const cur = masterGain.gain.value;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.setValueAtTime(cur > 0.0001 ? cur : 0.0001, t);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, t + releaseTime);
    nodes.forEach(n => { try { n.stop(t + releaseTime + 0.05); } catch(e) {} });
  };
}

// ── Voice pool: tracks all active sustained voices for polyphony enforcement ──
// Each entry: { masterGain, nodes, releaseFunc }
let _voicePool = [];
let activeNodes = []; // kept for backward compat (playKey one-shots)

function _enforcePolyphony() {
  const maxV = parseInt(document.getElementById('polyphony').value) || 8;
  while (_voicePool.length >= maxV) {
    const oldest = _voicePool.shift();
    // Steal the oldest voice with a quick fade
    try {
      const ctx = getAudioCtx();
      const t = ctx.currentTime;
      oldest.masterGain.gain.cancelScheduledValues(t);
      oldest.masterGain.gain.setValueAtTime(oldest.masterGain.gain.value, t);
      oldest.masterGain.gain.linearRampToValueAtTime(0, t + 0.04);
      oldest.nodes.forEach(n => { try { n.stop(t + 0.05); } catch(e) {} });
    } catch(e) {}
  }
}

// ── handleKeyClick (one-shot, mouse click without hold) ─────────────────────
function handleKeyClick(key) {
  playKey(key);
  const id = key.label + '_' + key.harmonyId;
  activeKeyIds.add(id);
  renderSVG();
  setTimeout(() => { activeKeyIds.delete(id); renderSVG(); }, 400);
}

// ═════════════════════════════════════════════════════════════════════════════
//  PHASE B: PATCHES
//  Each patch is a function:  patch(ctx, freq, vol, attack, release, masterGain)
//  It adds oscillators/buffers to masterGain and returns an array of stoppable nodes.
//  masterGain is pre-created by playKeySustained; patches just fill it.
// ═════════════════════════════════════════════════════════════════════════════

// ── B1: SINE / BASIC WAVEFORMS ───────────────────────────────────────────────
function patchBasic(ctx, freq, vol, attack, now, masterGain, waveType) {
  const osc = ctx.createOscillator();
  osc.type = waveType;
  osc.frequency.value = freq;
  osc.connect(masterGain);
  osc.start(now);
  return [osc];
}

// ── B2: ORGAN (Hammond-style additive) ───────────────────────────────────────
// 8 drawbars: sub-octave through 5th harmonic, each independently gainable
function patchOrgan(ctx, freq, vol, attack, now, masterGain) {
  // Drawbar footages: 16', 8', 5⅓', 4', 2⅔', 2', 1⅗', 1⅓', 1'
  const ratios = [0.5, 1,  1.5, 2, 3,   4,  5,    6,   8];
  const draws  = [0.1, 0.8, 0,  0.5, 0.3, 0, 0.2, 0, 0.1]; // classic "full" registration
  const nodes = [];
  ratios.forEach((r, i) => {
    if (draws[i] === 0) return;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * r;
    g.gain.value = draws[i] * 0.18; // sum normalised
    osc.connect(g); g.connect(masterGain);
    osc.start(now);
    nodes.push(osc);
  });
  // Subtle rotary chorus: two detuned copies of drawbar mix
  // (cheap approximation — a real Leslie uses a spinning speaker simulation)
  const chorus = [1.003, 0.997];
  chorus.forEach(dt => {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = freq * dt;
    g.gain.value = 0.06;
    osc.connect(g); g.connect(masterGain); osc.start(now); nodes.push(osc);
  });
  return nodes;
}

// ── B3: BELL (FM with inharmonic ratio + decay envelope) ─────────────────────
// Carrier + modulator. Modulator decays quickly to give the strike transient,
// leaving a pure sinusoidal sustain. Works at all octaves.
function patchBell(ctx, freq, vol, attack, now, masterGain) {
  const carrier = ctx.createOscillator();
  const mod     = ctx.createOscillator();
  const modGain = ctx.createGain();
  carrier.type = 'sine'; carrier.frequency.value = freq;
  mod.type     = 'sine'; mod.frequency.value     = freq * 3.5; // inharmonic ratio
  // FM index decays from ~4 to ~0.05 over 2 s → bright attack, pure sustain
  const idx = Math.min(6, Math.max(1.5, 3000 / freq)); // higher idx at low freq
  modGain.gain.setValueAtTime(freq * idx * 0.5, now);
  modGain.gain.exponentialRampToValueAtTime(freq * 0.05, now + 2.5);
  mod.connect(modGain); modGain.connect(carrier.frequency);
  carrier.connect(masterGain);
  carrier.start(now); mod.start(now);
  // Bell sustains then decays naturally — override masterGain envelope
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(vol, now);
  masterGain.gain.exponentialRampToValueAtTime(vol * 0.3, now + 1.5);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 6.0);
  return [carrier, mod];
}

// ── B4: PLUCK (Karplus-Strong via short noise + comb feedback) ───────────────
// Noise excitation through a resonant comb filter simulates string pluck.
// Unlike a looped buffer, this uses a BiquadFilter with high Q for the comb effect.
function patchPluck(ctx, freq, vol, attack, now, masterGain) {
  // Excitation: very short white noise burst
  const excLen = Math.max(128, Math.round(ctx.sampleRate * 0.015));
  const excBuf = ctx.createBuffer(1, excLen, ctx.sampleRate);
  const excData = excBuf.getChannelData(0);
  for (let i = 0; i < excLen; i++) excData[i] = (Math.random() * 2 - 1) * (1 - i / excLen);
  const exc = ctx.createBufferSource();
  exc.buffer = excBuf;
  // Comb/resonator chain: two matched peaking filters
  const comb1 = ctx.createBiquadFilter(); comb1.type = 'peaking';
  comb1.frequency.value = freq; comb1.Q.value = 80; comb1.gain.value = 20;
  const comb2 = ctx.createBiquadFilter(); comb2.type = 'peaking';
  comb2.frequency.value = freq * 2; comb2.Q.value = 40; comb2.gain.value = 10;
  // Low-pass to round off the pluck body
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.value = Math.min(freq * 12, ctx.sampleRate * 0.4);
  exc.connect(comb1); comb1.connect(comb2); comb2.connect(lp); lp.connect(masterGain);
  // Override gain: attack transient then quick decay
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(vol * 2.0, now);
  masterGain.gain.exponentialRampToValueAtTime(vol * 0.4, now + 0.04);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.3, 2.5 - freq / 800));
  exc.start(now);
  return [exc];
}

// ── B5: MARIMBA (mallet strike — inharmonic sines, fast-decay partials) ──────
// Three partials with the marimba's characteristic ratios (1 : 3.93 : 9.85).
// Each partial decays independently; higher partials vanish fastest.
function patchMarimba(ctx, freq, vol, attack, now, masterGain) {
  const partials = [1, 3.93, 9.85];
  const amps     = [0.75, 0.22, 0.07];
  const decays   = [1.8, 0.35, 0.12]; // seconds to -60 dB
  const nodes = [];
  // Override master: start at vol, decay naturally
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(vol * 1.2, now);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + decays[0] + 0.2);
  partials.forEach((p, i) => {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = freq * p;
    g.gain.setValueAtTime(amps[i], now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + decays[i]);
    osc.connect(g); g.connect(masterGain); osc.start(now); nodes.push(osc);
  });
  return nodes;
}

// ── B6: FLUTE (sine + vibrato + shaped breathiness) ──────────────────────────
// Fundamental sine with delayed vibrato (starts after 0.2 s like a real flute),
// plus bandpass-filtered noise for the "air" component.
function patchFlute(ctx, freq, vol, attack, now, masterGain) {
  const nodes = [];
  // Fundamental
  const osc = ctx.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);
  // Vibrato LFO: delayed onset
  const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 5.5;
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(0, now);
  lfoGain.gain.linearRampToValueAtTime(freq * 0.007, now + 0.22); // vibrato depth ~0.7%
  lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
  // Breath noise: bandpass around fundamental + octave
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = getNoiseBuffer(ctx); noiseSrc.loop = true;
  const bp1 = ctx.createBiquadFilter(); bp1.type = 'bandpass';
  bp1.frequency.value = freq * 1.1; bp1.Q.value = 1.5;
  const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass';
  bp2.frequency.value = freq * 3.3; bp2.Q.value = 2.0;
  const noiseG = ctx.createGain(); noiseG.gain.value = 0.09;
  noiseSrc.connect(bp1); bp1.connect(noiseG);
  noiseSrc.connect(bp2); bp2.connect(noiseG);
  // Mix
  const oscG = ctx.createGain(); oscG.gain.value = 0.82;
  osc.connect(oscG); oscG.connect(masterGain);
  noiseG.connect(masterGain);
  osc.start(now); lfo.start(now); noiseSrc.start(now);
  nodes.push(osc, lfo, noiseSrc);
  return nodes;
}

// ── B7: GLASS HARMONICA ───────────────────────────────────────────────────────
// Pure sine chorus (three oscillators at unison with very slight detuning)
// Extremely slow attack (bowl takes time to resonate), long decay.
function patchGlass(ctx, freq, vol, attack, now, masterGain) {
  const nodes = [];
  const detunes = [0, +2.1, -1.7]; // cents
  detunes.forEach(d => {
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.value = freq * Math.pow(2, d / 1200);
    const g = ctx.createGain(); g.gain.value = 1 / detunes.length;
    osc.connect(g); g.connect(masterGain); osc.start(now); nodes.push(osc);
  });
  // Very slow attack — override the default
  const slowA = Math.max(attack, 0.45);
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(vol, now + slowA);
  return nodes;
}

// ── B8: PAD / STRINGS (supersaw chorus through lowpass) ──────────────────────
// 7 detuned sawtooths + gentle lowpass → lush pad sound.
// Slow attack to distinguish it from Organ.
function patchPad(ctx, freq, vol, attack, now, masterGain) {
  const detunes = [-12, -6, -2, 0, 2, 6, 12]; // cents
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.value = Math.min(freq * 5, 8000); lp.Q.value = 0.6;
  lp.connect(masterGain);
  const slowA = Math.max(attack, 0.35);
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(vol, now + slowA);
  const nodes = [];
  detunes.forEach(d => {
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.value = freq * Math.pow(2, d / 1200);
    const g = ctx.createGain(); g.gain.value = 0.12;
    osc.connect(g); g.connect(lp); osc.start(now); nodes.push(osc);
  });
  return nodes;
}

// ── B9: CHOIR / VOWEL (formant synthesis — vowel "ah") ───────────────────────
// Sawtooth through a bank of bandpass formant filters + slow vibrato.
// Formant frequencies stay fixed (vocal tract model), so the vowel character
// is preserved across the full pitch range.
function patchChoir(ctx, freq, vol, attack, now, masterGain) {
  // Source: sawtooth + vibrato
  const src = ctx.createOscillator(); src.type = 'sawtooth'; src.frequency.value = freq;
  const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 5.0;
  const lfoG = ctx.createGain(); lfoG.gain.setValueAtTime(0, now);
  lfoG.gain.linearRampToValueAtTime(freq * 0.004, now + 0.25); // delayed vibrato
  lfo.connect(lfoG); lfoG.connect(src.frequency);
  // Formants for vowel "ah" (fixed frequencies, not scaled with pitch)
  const formants = [700,  1200, 2600, 3400, 4200];
  const gains    = [1.0,  0.65, 0.35, 0.18, 0.08];
  const Qs       = [10,   12,   15,   18,   20];
  formants.forEach((f, i) => {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = f; bp.Q.value = Qs[i];
    const g = ctx.createGain(); g.gain.value = gains[i] * 0.4;
    src.connect(bp); bp.connect(g); g.connect(masterGain);
  });
  // Soft attack for choir
  const slowA = Math.max(attack, 0.28);
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(vol, now + slowA);
  src.start(now); lfo.start(now);
  return [src, lfo];
}

// ── B10: CLAVINET / ELECTRIC PIANO ───────────────────────────────────────────
// Two slightly detuned sawtooths through a bandpass filter, sharp percussive
// attack then quick exponential decay. The bandpass frequency is a fixed
// function of pitch to give the honky "clavinet" character.
function patchClavinet(ctx, freq, vol, attack, now, masterGain) {
  const osc1 = ctx.createOscillator(); osc1.type = 'sawtooth'; osc1.frequency.value = freq;
  const osc2 = ctx.createOscillator(); osc2.type = 'square';   osc2.frequency.value = freq * 1.006;
  // Two bandpass peaks: fundamental body + harmonic bite
  const bp1 = ctx.createBiquadFilter(); bp1.type = 'bandpass';
  bp1.frequency.value = freq * 1.8; bp1.Q.value = 3.5;
  const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass';
  bp2.frequency.value = freq * 4.2; bp2.Q.value = 2.0;
  const g1 = ctx.createGain(); g1.gain.value = 0.6;
  const g2 = ctx.createGain(); g2.gain.value = 0.35;
  osc1.connect(bp1); osc2.connect(bp1); bp1.connect(g1); g1.connect(masterGain);
  osc1.connect(bp2); osc2.connect(bp2); bp2.connect(g2); g2.connect(masterGain);
  // Very sharp attack, then exponential decay (no sustain — clavinet always decays)
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(vol * 1.6, now + 0.008);
  masterGain.gain.exponentialRampToValueAtTime(vol * 0.55, now + 0.06);
  masterGain.gain.exponentialRampToValueAtTime(vol * 0.12, now + 0.8);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);
  osc1.start(now); osc2.start(now);
  return [osc1, osc2];
}

// ── B11: GAMELAN (inharmonic bronze bar) ─────────────────────────────────────
// Five inharmonic partials with ratios from acoustic measurements of Javanese
// gamelan metallophone bars. Each partial has its own independent decay envelope.
// Release function is a no-op because the instrument always decays naturally.
function patchGamelan(ctx, freq, vol, attack, now, masterGain) {
  const ratios = [1, 2.756, 5.404, 8.933, 13.34];
  const amps   = [1.0, 0.55, 0.28, 0.14, 0.06];
  const decays = [3.2, 2.0, 1.3, 0.8, 0.45];
  const nodes = [];
  // Bypass masterGain — each partial goes direct with its own envelope
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(vol, now);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + decays[0] + 0.5);
  ratios.forEach((r, i) => {
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.value = freq * r;
    const g = ctx.createGain();
    g.gain.setValueAtTime(amps[i], now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + decays[i]);
    osc.connect(g); g.connect(masterGain); osc.start(now); nodes.push(osc);
  });
  return nodes;
}

// ═════════════════════════════════════════════════════════════════════════════
//  PHASE C: LOUDNESS NORMALISATION TABLE
//  Each patch has a target loudness (dBFS) and a frequency-dependent correction.
//  These offsets compensate for the spectral energy differences between patches
//  so all instruments feel equally loud at the same master volume setting.
// ═════════════════════════════════════════════════════════════════════════════

const PATCH_GAIN = {
  //              base    freqScale  (vol = base * freqScale(freq))
  sine:       () => 0.55,
  triangle:   () => 0.65,
  square:     () => 0.35,  // square is ~+3 dB due to odd harmonics
  sawtooth:   () => 0.38,  // sawtooth dense spectrum
  organ:      () => 0.52,
  bell:       f => 0.70 * Math.pow(440 / Math.max(f, 80), 0.18), // high bells louder
  pluck:      f => 0.72 * Math.pow(440 / Math.max(f, 80), 0.12),
  marimba:    () => 0.68,
  flute:      () => 0.62,
  glass:      () => 0.72,
  pad:        () => 0.42,  // 7 oscillators — keep quiet
  choir:      () => 0.55,
  clavinet:   () => 0.60,
  gamelan:    () => 0.62,
};

function getPatchGain(waveform, freq) {
  const fn = PATCH_GAIN[waveform];
  const base = fn ? fn(freq) : 0.55;
  return base * freqGain(freq);
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN ENTRY POINTS
// ═════════════════════════════════════════════════════════════════════════════

// ── playKeySustained: called on key press (touch/mouse), returns release() ───
function playKeySustained(key) {
  const ctx = getAudioCtx();
  const env = getEnvelope();
  const waveform = document.getElementById('waveform').value;
  const now  = ctx.currentTime;
  const freq = key.freq;
  const vol  = env.volume * env.sustain * getPatchGain(waveform, freq);

  // Enforce polyphony before creating a new voice
  _enforcePolyphony();

  const sp = getSynthParams();

  // The patch writes into patchGain; a post-patch filter and the masterGain follow
  const patchGain = ctx.createGain(); patchGain.gain.value = 1;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(vol, now + Math.max(0.004, env.attack));

  // Optional post-filter (applied between patch output and masterGain)
  let filterNode = null;
  if (sp.filterType !== 'none') {
    filterNode = ctx.createBiquadFilter();
    filterNode.type = sp.filterType;
    // filterFreq > 20 = absolute Hz; <= 20 = multiplier of note freq
    filterNode.frequency.value = sp.filterFreq > 20 ? sp.filterFreq : freq * sp.filterFreq;
    filterNode.Q.value = sp.filterQ;
    patchGain.connect(filterNode); filterNode.connect(masterGain);
  } else {
    patchGain.connect(masterGain);
  }
  masterGain.connect(_masterBus);

  // Optional global vibrato LFO (in addition to any patch-internal vibrato)
  let vibNodes = [];
  if (sp.vibDepth > 0.001) {
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = sp.vibRate;
    const lfoG = ctx.createGain(); lfoG.gain.value = freq * sp.vibDepth * 0.01;
    lfo.connect(lfoG);
    // We need to connect lfoG to each oscillator's frequency — done after patch creates oscs
    // For now, store for patch use
    lfo.start(now); vibNodes.push(lfo);
  }

  let nodes;
  switch (waveform) {
    case 'sine':      nodes = patchBasic(ctx,  freq, vol, env.attack, now, patchGain, 'sine');      break;
    case 'triangle':  nodes = patchBasic(ctx,  freq, vol, env.attack, now, patchGain, 'triangle');  break;
    case 'square':    nodes = patchBasic(ctx,  freq, vol, env.attack, now, patchGain, 'square');    break;
    case 'sawtooth':  nodes = patchBasic(ctx,  freq, vol, env.attack, now, patchGain, 'sawtooth'); break;
    case 'organ':     nodes = patchOrgan(ctx,   freq, vol, env.attack, now, patchGain); break;
    case 'bell':      nodes = patchBell(ctx,    freq, vol, env.attack, now, patchGain); break;
    case 'pluck':     nodes = patchPluck(ctx,   freq, vol, env.attack, now, patchGain); break;
    case 'marimba':   nodes = patchMarimba(ctx, freq, vol, env.attack, now, patchGain); break;
    case 'flute':     nodes = patchFlute(ctx,   freq, vol, env.attack, now, patchGain); break;
    case 'glass':     nodes = patchGlass(ctx,   freq, vol, env.attack, now, patchGain); break;
    case 'pad':       nodes = patchPad(ctx,     freq, vol, env.attack, now, patchGain); break;
    case 'choir':     nodes = patchChoir(ctx,   freq, vol, env.attack, now, patchGain); break;
    case 'clavinet':  nodes = patchClavinet(ctx,freq, vol, env.attack, now, patchGain); break;
    case 'gamelan':   nodes = patchGamelan(ctx, freq, vol, env.attack, now, patchGain); break;
    default:          nodes = patchBasic(ctx,   freq, vol, env.attack, now, patchGain, 'sine'); break;
  }

  // Apply global vibrato to all oscillators in this voice
  if (vibNodes.length > 0) {
    const lfoG = ctx.createGain(); lfoG.gain.value = freq * sp.vibDepth * 0.01;
    vibNodes[0].connect(lfoG);
    nodes.forEach(n => { if (n.frequency) lfoG.connect(n.frequency); });
    nodes.push(...vibNodes);
  }

  // Apply chorus detune to patch oscillators
  if (sp.detuneAmount > 0) {
    nodes.forEach(n => { if (n.detune) n.detune.value = (Math.random() - 0.5) * sp.detuneAmount * 2; });
  }

  const releaseTime = Math.max(0.02, env.release);
  const voiceEntry = { masterGain, nodes };
  _voicePool.push(voiceEntry);

  return function() {
    // Remove from pool so the slot is freed immediately
    const idx = _voicePool.indexOf(voiceEntry);
    if (idx !== -1) _voicePool.splice(idx, 1);
    // Fade out and stop
    const t = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.setValueAtTime(masterGain.gain.value > 0.0001 ? masterGain.gain.value : 0.0001, t);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, t + releaseTime);
    nodes.forEach(n => { try { n.stop(t + releaseTime + 0.05); } catch(e) {} });
  };
}

// ── playKey: one-shot note (mouse click without hold) ────────────────────────
function playKey(key) {
  const ctx = getAudioCtx();
  const env = getEnvelope();
  const waveform = document.getElementById('waveform').value;
  const maxV = parseInt(document.getElementById('polyphony').value) || 8;
  const now  = ctx.currentTime;
  const freq = key.freq;
  const vol  = env.volume * env.sustain * getPatchGain(waveform, freq);

  // Enforce polyphony limit
  if (activeNodes.length >= maxV) {
    const oldest = activeNodes.shift();
    try {
      oldest.gain.gain.setTargetAtTime(0, now, 0.02);
      if (oldest.stop) oldest.stop(now + 0.1);
    } catch(e) {}
  }

  const masterGain = ctx.createGain();
  masterGain.connect(_masterBus);

  let nodes;
  switch (waveform) {
    case 'organ':    nodes = patchOrgan(ctx,    freq, vol, env.attack, now, masterGain); break;
    case 'bell':     nodes = patchBell(ctx,     freq, vol, env.attack, now, masterGain); break;
    case 'pluck':    nodes = patchPluck(ctx,    freq, vol, env.attack, now, masterGain); break;
    case 'marimba':  nodes = patchMarimba(ctx,  freq, vol, env.attack, now, masterGain); break;
    case 'flute':    nodes = patchFlute(ctx,    freq, vol, env.attack, now, masterGain); break;
    case 'glass':    nodes = patchGlass(ctx,    freq, vol, env.attack, now, masterGain); break;
    case 'pad':      nodes = patchPad(ctx,      freq, vol, env.attack, now, masterGain); break;
    case 'choir':    nodes = patchChoir(ctx,    freq, vol, env.attack, now, masterGain); break;
    case 'clavinet': nodes = patchClavinet(ctx, freq, vol, env.attack, now, masterGain); break;
    case 'gamelan':  nodes = patchGamelan(ctx,  freq, vol, env.attack, now, masterGain); break;
    default:
      masterGain.gain.setValueAtTime(0, now);
      masterGain.gain.linearRampToValueAtTime(vol, now + Math.max(0.004, env.attack));
      nodes = patchBasic(ctx, freq, vol, env.attack, now, masterGain, waveform === 'sine' || waveform === 'triangle' || waveform === 'square' || waveform === 'sawtooth' ? waveform : 'sine');
      break;
  }

  // Auto-stop after decay + release time
  const stopTime = now + env.attack + env.release * 3 + 1.5;
  masterGain.gain.cancelScheduledValues(now + env.attack + 0.01);
  // Don't reschedule for self-decaying patches (bell, marimba, pluck, gamelan, clavinet)
  const selfDecay = ['bell','pluck','marimba','gamelan','clavinet'].includes(waveform);
  if (!selfDecay) {
    masterGain.gain.setTargetAtTime(0, now + env.attack + 0.05, env.release / 2.5);
  }
  nodes.forEach(n => { try { n.stop(stopTime); } catch(e) {} });
  activeNodes.push({ gain: masterGain, stop: (t) => nodes.forEach(n => { try { n.stop(t); } catch(e) {} }) });
}
