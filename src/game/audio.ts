import { settings } from './core';

/**
 * Sound without audio files: layered WebAudio voices through a shared room reverb, plus a slow generative
 * soundtrack (dark minor pads, a low drone, distant bells and wind). Starts after the first touch.
 */
class Sound {
  private ctx?: AudioContext;
  private master?: GainNode;
  private sfx?: GainNode;
  private musicGain?: GainNode;
  private reverb?: ConvolverNode;
  private noiseBuf?: AudioBuffer;
  private musicTimer?: number;
  private bellTimer?: number;

  unlock() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.connect(comp);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.musicGain = ctx.createGain(); this.musicGain.connect(this.master);
    // Room: a decaying stereo noise impulse, 2.6 s.
    const len = Math.floor(ctx.sampleRate * 2.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.reverb = ctx.createConvolver(); this.reverb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.5; this.reverb.connect(wet).connect(this.master);
    const nl = ctx.sampleRate * 2, nb = ctx.createBuffer(1, nl, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    this.apply();
    this.startMusic();
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend(); else void this.ctx.resume();
    });
  }
  apply() {
    if (!this.ctx || !this.master || !this.musicGain) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.volume / 100 * 0.9, t, 0.05);
    this.musicGain.gain.setTargetAtTime(settings.music ? 0.32 : 0, t, 0.4);
  }

  // ---------------------------------------------------------------- voices
  private out(wet = 0.2): AudioNode {
    const g = this.ctx!.createGain();
    g.connect(this.sfx!);
    if (wet > 0) { const s = this.ctx!.createGain(); s.gain.value = wet; g.connect(s).connect(this.reverb!); }
    return g;
  }
  private osc(type: OscillatorType, f0: number, f1: number | null, dur: number, vol: number, opts: { delay?: number; wet?: number; attack?: number; detune?: number } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (opts.delay ?? 0), o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (opts.detune) o.detune.value = opts.detune;
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const a = opts.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out(opts.wet ?? 0.15)); o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(dur: number, type: BiquadFilterType, f0: number, f1: number | null, vol: number, opts: { delay?: number; q?: number; wet?: number; attack?: number } = {}) {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime + (opts.delay ?? 0), s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noiseBuf; f.type = type; f.Q.value = opts.q ?? 0.8; f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const a = opts.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.out(opts.wet ?? 0.15)); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  /** Bell / metal: a few inharmonic partials with long tails. */
  private bell(f: number, vol: number, delay = 0, dur = 1.6, wet = 0.45) {
    for (const [k, v] of [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]] as const) this.osc('sine', f * k, null, dur / (k * 0.6 + 0.4), vol * v, { delay, wet, attack: 0.002 });
  }
  private jit(v: number, amt = 0.06) { return v * (1 + (Math.random() * 2 - 1) * amt); }

  // ---------------------------------------------------------------- effects
  tick() { this.noise(0.025, 'bandpass', 3400, null, 0.06, { q: 6, wet: 0 }); }
  click() { this.noise(0.03, 'bandpass', 2400, null, 0.09, { q: 4, wet: 0.05 }); this.osc('triangle', 900, 700, 0.05, 0.03, { wet: 0 }); }
  card() { this.noise(0.11, 'bandpass', this.jit(1600), 4200, 0.09, { q: 1.2, wet: 0.08 }); }
  play() {
    this.noise(0.12, 'bandpass', 1400, 3800, 0.08, { q: 1, wet: 0.1 });
    this.osc('sine', this.jit(130), 48, 0.22, 0.32, { delay: 0.06, wet: 0.2 });
    this.noise(0.18, 'lowpass', 600, 120, 0.12, { delay: 0.06, wet: 0.3 });
  }
  whoosh() { this.noise(0.24, 'bandpass', 380, 2600, 0.12, { q: 1.6, wet: 0.15, attack: 0.08 }); }
  hit() {
    this.osc('sine', this.jit(170), 52, 0.16, 0.42, { wet: 0.12 });
    this.noise(0.09, 'lowpass', 3200, 500, 0.28, { wet: 0.1 });
    this.noise(0.02, 'highpass', 4000, null, 0.12, { wet: 0 });
  }
  hero() {
    this.osc('sine', 92, 34, 0.55, 0.5, { wet: 0.35 });
    this.noise(0.45, 'lowpass', 900, 90, 0.3, { wet: 0.4 });
    this.osc('sawtooth', 62, 40, 0.4, 0.05, { wet: 0.3 });
  }
  death() {
    this.noise(0.55, 'bandpass', 2600, 300, 0.16, { q: 0.7, wet: 0.35 });
    for (let i = 0; i < 7; i++) this.noise(0.03, 'bandpass', this.jit(1800, 0.4), null, 0.07, { delay: 0.05 + i * 0.05 + Math.random() * 0.03, q: 5, wet: 0.2 });
    this.osc('sine', 110, 40, 0.4, 0.3, { delay: 0.02, wet: 0.3 });
    this.bell(this.jit(330), 0.05, 0.08, 1.4);
  }
  deathstrike() {
    this.noise(0.3, 'bandpass', 3200, 400, 0.14, { q: 2, wet: 0.3, attack: 0.03 });
    this.osc('triangle', 660, 640, 0.6, 0.06, { delay: 0.18, wet: 0.5 }); this.osc('triangle', 993, 970, 0.5, 0.04, { delay: 0.18, wet: 0.5 });
  }
  coin() {
    const f = this.jit(1567, 0.03);
    this.osc('triangle', f, null, 0.18, 0.08, { wet: 0.25 }); this.osc('sine', f * 2.01, null, 0.12, 0.04, { wet: 0.25 });
    this.osc('triangle', f * 1.335, null, 0.32, 0.08, { delay: 0.07, wet: 0.35 }); this.osc('sine', f * 2.67, null, 0.2, 0.03, { delay: 0.07, wet: 0.35 });
  }
  heal() { [659, 880, 1175, 1568].forEach((f, i) => this.osc('sine', f, null, 0.6, 0.06, { delay: i * 0.07, wet: 0.6, attack: 0.02 })); }
  upgrade() {
    this.bell(this.jit(980, 0.02), 0.08, 0, 0.9, 0.35);
    this.noise(0.04, 'highpass', 5000, null, 0.12, { wet: 0.1 });
    this.osc('sine', 220, 120, 0.12, 0.12, { wet: 0.1 });
  }
  fire() {
    this.noise(0.6, 'lowpass', 300, 4200, 0.26, { wet: 0.25, attack: 0.1 });
    for (let i = 0; i < 9; i++) this.noise(0.02, 'highpass', 2500, null, 0.08, { delay: 0.1 + Math.random() * 0.5, wet: 0.1 });
    this.osc('sine', 80, 40, 0.5, 0.25, { delay: 0.45, wet: 0.3 });
  }
  magic() { [784, 1175, 1568, 2093].forEach((f, i) => this.bell(f, 0.03, i * 0.06, 1.2, 0.6)); this.noise(0.5, 'highpass', 6000, 3000, 0.04, { wet: 0.6, attack: 0.1 }); }
  devour() {
    this.osc('sawtooth', 72, 38, 0.9, 0.12, { wet: 0.3, attack: 0.05 });
    this.noise(0.8, 'lowpass', 500, 80, 0.3, { wet: 0.4, attack: 0.08 });
    for (let i = 0; i < 6; i++) this.osc('sine', this.jit(300 + i * 60, 0.2), 900, 0.07, 0.05, { delay: 0.25 + i * 0.09, wet: 0.3 });
  }
  transform() {
    this.osc('sine', 300, 1200, 0.35, 0.07, { wet: 0.4 }); this.osc('sine', 1200, 200, 0.4, 0.05, { delay: 0.2, wet: 0.4 });
    this.noise(0.5, 'bandpass', 800, 3000, 0.08, { q: 3, wet: 0.5 });
  }
  burn() { this.noise(0.45, 'lowpass', 2500, 400, 0.18, { wet: 0.2 }); for (let i = 0; i < 6; i++) this.noise(0.02, 'highpass', 3000, null, 0.07, { delay: Math.random() * 0.4 }); }
  deny() { this.osc('triangle', 196, null, 0.12, 0.08, { wet: 0.05 }); this.osc('triangle', 165, null, 0.16, 0.08, { delay: 0.09, wet: 0.05 }); }
  turn() { this.bell(587, 0.06, 0, 1.6, 0.6); this.bell(880, 0.05, 0.12, 1.8, 0.6); }
  splash() { this.noise(0.5, 'lowpass', 1500, 200, 0.2, { wet: 0.3 }); for (let i = 0; i < 4; i++) this.osc('sine', this.jit(900), 500, 0.06, 0.04, { delay: 0.15 + i * 0.06, wet: 0.3 }); }
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.bell(f, 0.08, i * 0.14, 2.2, 0.6)); this.osc('sawtooth', 131, null, 2.2, 0.04, { delay: 0.5, wet: 0.6, attack: 0.4 }); }
  lose() { [440, 392, 349, 294].forEach((f, i) => this.bell(f, 0.06, i * 0.3, 2, 0.6)); this.osc('sine', 73, 55, 3, 0.18, { wet: 0.5, attack: 0.5 }); }

  // ---------------------------------------------------------------- music
  /** D-minor world: slow pads that change every ~9 s, a low drone, distant bells, wind. */
  private startMusic() {
    if (!this.ctx || !this.musicGain || !this.noiseBuf) return;
    const ctx = this.ctx, bus = this.musicGain;
    const padBus = ctx.createGain(); padBus.gain.value = 0.9;
    const padFilter = ctx.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 700; padFilter.Q.value = 0.6;
    const lfo = ctx.createOscillator(), lfoGain = ctx.createGain(); lfo.frequency.value = 0.05; lfoGain.gain.value = 280;
    lfo.connect(lfoGain).connect(padFilter.frequency); lfo.start();
    padBus.connect(padFilter);
    padFilter.connect(bus);
    const sendR = ctx.createGain(); sendR.gain.value = 0.7; padFilter.connect(sendR).connect(this.reverb!);
    // wind
    const wind = ctx.createBufferSource(); wind.buffer = this.noiseBuf; wind.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 420; wf.Q.value = 0.7;
    const wg = ctx.createGain(); wg.gain.value = 0.05;
    const wl = ctx.createOscillator(), wlg = ctx.createGain(); wl.frequency.value = 0.08; wlg.gain.value = 260; wl.connect(wlg).connect(wf.frequency); wl.start();
    wind.connect(wf).connect(wg).connect(bus); wind.start();
    // drone
    const drone = ctx.createOscillator(), dg = ctx.createGain(); drone.type = 'sine'; drone.frequency.value = 36.7; dg.gain.value = 0.12;
    drone.connect(dg).connect(bus); drone.start();
    const chords = [[146.8, 174.6, 220.0], [116.5, 146.8, 174.6], [130.8, 164.8, 196.0], [110.0, 138.6, 164.8]]; // Dm, Bb, C, A
    let i = 0;
    const playChord = () => {
      if (!this.ctx) return;
      const dur = 9.5;
      // Hidden tab, suspended context or music off: just keep the clock, schedule nothing.
      if (document.hidden || ctx.state !== 'running' || !settings.music) { this.musicTimer = window.setTimeout(playChord, 2000); return; }
      const t = ctx.currentTime;
      for (const f of chords[i % chords.length]) for (const det of [-8, 7]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.022, t + 2.6); g.gain.setValueAtTime(0.022, t + dur - 2.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.5);
        o.connect(g).connect(padBus); o.start(t); o.stop(t + dur + 1.6);
      }
      i++;
      this.musicTimer = window.setTimeout(playChord, (dur - 1) * 1000);
    };
    const scale = [293.7, 349.2, 392.0, 440.0, 523.3, 587.3, 698.5];
    const bell = () => {
      if (this.ctx && settings.music && !document.hidden && ctx.state === 'running') {
        const f = scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.3 ? 2 : 1);
        const g = ctx.createGain(); g.gain.value = 1; g.connect(bus);
        const send = ctx.createGain(); send.gain.value = 1.2; g.connect(send).connect(this.reverb!);
        for (const [k, v] of [[1, 1], [2.76, 0.35], [5.4, 0.12]] as const) {
          const o = ctx.createOscillator(), og = ctx.createGain(), t = ctx.currentTime;
          o.frequency.value = f * k; og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.018 * v, t + 0.01); og.gain.exponentialRampToValueAtTime(0.0001, t + 3 / k);
          o.connect(og).connect(g); o.start(t); o.stop(t + 3.2);
        }
      }
      this.bellTimer = window.setTimeout(bell, 2200 + Math.random() * 5000);
    };
    if (!this.musicTimer) playChord();
    if (!this.bellTimer) this.bellTimer = window.setTimeout(bell, 3000);
  }
}
export const sound = new Sound();
