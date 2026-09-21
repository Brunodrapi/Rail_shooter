/**
 * Synthese Web Audio : aucun asset a charger et latence minimale.
 * Les elements <audio> classiques sont trop lents pour des coups de feu.
 */
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.noiseBuf = null;
    this.master = null;
    this.muted = false;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _noise(dur, type, f0, f1, gain, q) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const flt = this.ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.setValueAtTime(f0, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    if (q) flt.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  _tone(dur, f0, f1, gain, type = 'square') {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  shot() {
    this._noise(0.16, 'lowpass', 5200, 320, 0.7);
    this._tone(0.1, 180, 60, 0.35, 'sawtooth');
  }
  enemyShot() {
    this._noise(0.14, 'bandpass', 1500, 500, 0.3, 2);
  }
  hit() {
    this._noise(0.09, 'highpass', 2600, 900, 0.34);
    this._tone(0.07, 900, 400, 0.14, 'square');
  }
  headshot() {
    this._noise(0.12, 'highpass', 3400, 700, 0.4);
    this._tone(0.16, 1400, 520, 0.2, 'square');
  }
  empty() {
    this._tone(0.045, 1500, 900, 0.12, 'square');
  }
  reload() {
    this._tone(0.05, 420, 260, 0.2, 'square');
    setTimeout(() => this._tone(0.06, 300, 700, 0.22, 'square'), 170);
  }
  hurt() {
    this._noise(0.35, 'lowpass', 900, 90, 0.55);
    this._tone(0.3, 160, 50, 0.3, 'sawtooth');
  }
  branch() {
    this._tone(0.1, 700, 1200, 0.22, 'triangle');
    setTimeout(() => this._tone(0.16, 1200, 1800, 0.22, 'triangle'), 110);
  }
  bonus() {
    this._tone(0.09, 880, 1320, 0.2, 'triangle');
    setTimeout(() => this._tone(0.09, 1320, 1760, 0.2, 'triangle'), 90);
    setTimeout(() => this._tone(0.22, 1760, 2100, 0.18, 'triangle'), 180);
  }
  alarm() {
    this._tone(0.22, 520, 380, 0.16, 'triangle');
  }
}
