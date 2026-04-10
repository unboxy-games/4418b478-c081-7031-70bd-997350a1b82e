/**
 * AudioManager — all sounds synthesised via Web Audio API.
 * No audio files needed: oscillators + noise for SFX, chiptune sequencer for BGM.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;

  // One reusable noise buffer (avoids re-allocating on rapid-fire sounds)
  private noiseBuffer: AudioBuffer | null = null;

  // Music scheduler state
  private musicPlaying = false;
  private schedulerHandle: ReturnType<typeof setTimeout> | null = null;
  private nextNoteTime = 0;
  private currentStep = 0;

  // ── Tempo ─────────────────────────────────────────────────────
  private readonly BPM = 138;
  // 8th-note duration in seconds
  private readonly STEP_DUR = 60 / 138 / 2;
  private readonly LOOK_AHEAD = 0.12;  // seconds to look ahead when scheduling
  private readonly SCHEDULE_MS = 40;   // how often the scheduler fires (ms)

  // ── Upbeat chiptune melody, 32 steps (4 bars of 8 8th-notes) ──
  // All in C major. 0 = rest.
  private readonly MELODY: number[] = [
    // Bar 1 – G-E-C-E / G-A-G-E
    392.00, 329.63, 261.63, 329.63, 392.00, 440.00, 392.00, 329.63,
    // Bar 2 – C5-B4-A4-G4 / F4-E4-D4-E4
    523.25, 493.88, 440.00, 392.00, 349.23, 329.63, 293.66, 329.63,
    // Bar 3 – ascending: F-G-A-C5 / descend: B4-A4-G4-F4
    349.23, 392.00, 440.00, 523.25, 493.88, 440.00, 392.00, 349.23,
    // Bar 4 – resolve: E4-G4-E4-C4 / D4-E4-C4-rest
    329.63, 392.00, 329.63, 261.63, 293.66, 329.63, 261.63, 0,
  ];

  // Harmony — a third above the melody on even steps
  private readonly HARMONY: number[] = [
    493.88, 0, 329.63, 0, 523.25, 0, 493.88, 0,
    659.25, 0, 523.25, 0, 440.00, 0, 392.00, 0,
    440.00, 0, 523.25, 0, 659.25, 0, 493.88, 0,
    440.00, 0, 392.00, 0, 349.23, 0, 329.63, 0,
  ];

  // Bass — hits on beats 1&3 of each bar
  private readonly BASS: number[] = [
    65.41, 0, 98.00, 0, 65.41, 0, 98.00, 0,   // C2 G2
    110.00, 0, 98.00, 0, 110.00, 0, 98.00, 0,  // A2 G2
    87.31, 0, 65.41, 0, 87.31, 0, 65.41, 0,   // F2 C2
    98.00, 0, 65.41, 0, 98.00, 0, 65.41, 0,   // G2 C2
  ];

  // ── Core context ──────────────────────────────────────────────

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.75;
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.38;
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.65;
      this.sfxGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const size = ctx.sampleRate; // 1 second of white noise
      this.noiseBuffer = ctx.createBuffer(1, size, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuffer;
  }

  // ── Music ─────────────────────────────────────────────────────

  startMusic(): void {
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    this.currentStep = 0;
    const ctx = this.getCtx();
    this.nextNoteTime = ctx.currentTime + 0.05;
    this.scheduleNotes();
  }

  stopMusic(): void {
    this.musicPlaying = false;
    if (this.schedulerHandle !== null) {
      clearTimeout(this.schedulerHandle);
      this.schedulerHandle = null;
    }
  }

  pauseMusic(): void {
    if (this.ctx) this.ctx.suspend();
  }

  resumeMusic(): void {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  private scheduleNotes(): void {
    if (!this.musicPlaying) return;
    const ctx = this.getCtx();

    while (this.nextNoteTime < ctx.currentTime + this.LOOK_AHEAD) {
      const step = this.currentStep;
      const t = this.nextNoteTime;

      const melFreq = this.MELODY[step % this.MELODY.length];
      if (melFreq > 0) {
        this.schedMelNote(ctx, melFreq, t, this.STEP_DUR * 0.72, 0.22, 'square');
      }

      const harmFreq = this.HARMONY[step % this.HARMONY.length];
      if (harmFreq > 0) {
        this.schedMelNote(ctx, harmFreq, t, this.STEP_DUR * 0.55, 0.10, 'triangle');
      }

      const bassFreq = this.BASS[step % this.BASS.length];
      if (bassFreq > 0) {
        this.schedBassNote(ctx, bassFreq, t);
      }

      this.currentStep = (this.currentStep + 1) % this.MELODY.length;
      this.nextNoteTime += this.STEP_DUR;
    }

    this.schedulerHandle = setTimeout(() => this.scheduleNotes(), this.SCHEDULE_MS);
  }

  private schedMelNote(ctx: AudioContext, freq: number, when: number, dur: number, vol: number, type: OscillatorType): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(when);
    osc.stop(when + dur + 0.01);
  }

  private schedBassNote(ctx: AudioContext, freq: number, when: number): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    const dur = this.STEP_DUR * 1.6;
    gain.gain.setValueAtTime(0.28, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(when);
    osc.stop(when + dur + 0.01);
  }

  // ── Sound effects ─────────────────────────────────────────────

  playShoot(towerType: string): void {
    const ctx = this.getCtx();
    const t = ctx.currentTime;
    switch (towerType) {
      case 'basic':
        this.tone(ctx, t, 820, 'sine', 0.09, 0.004, 0.07);
        break;
      case 'sniper':
        this.sweep(ctx, t, 1600, 260, 'sawtooth', 0.16, 0.008, 0.14);
        break;
      case 'rapid':
        this.tone(ctx, t, 1300, 'square', 0.055, 0.002, 0.022);
        break;
      case 'bomb':
        this.tone(ctx, t, 190, 'sawtooth', 0.13, 0.025, 0.1);
        break;
      case 'taser':
        this.noise(ctx, t, 0.13, 0.004, 0.07, 'highpass', 1800);
        this.tone(ctx, t, 480, 'square', 0.07, 0.004, 0.06);
        break;
      case 'freeze':
        this.sweep(ctx, t, 850, 1650, 'sine', 0.1, 0.008, 0.09);
        break;
      case 'flame':
        this.noise(ctx, t, 0.09, 0.004, 0.05, 'lowpass', 950);
        break;
      case 'trap':
        this.tone(ctx, t, 310, 'square', 0.09, 0.008, 0.09);
        break;
    }
  }

  playExplosion(): void {
    const ctx = this.getCtx();
    const t = ctx.currentTime;
    this.noise(ctx, t, 0.55, 0.004, 0.55, 'lowpass', 480);
    this.sweep(ctx, t, 110, 38, 'sawtooth', 0.4, 0.01, 0.42);
  }

  playEnemyDeath(enemyType: string): void {
    const ctx = this.getCtx();
    const t = ctx.currentTime;
    if (enemyType === 'boss') {
      this.sweep(ctx, t, 260, 55, 'sawtooth', 0.22, 0.015, 0.38);
      this.noise(ctx, t, 0.16, 0.015, 0.28, 'lowpass', 650);
    } else if (enemyType === 'swarm') {
      this.sweep(ctx, t, 820, 1500, 'sine', 0.045, 0.002, 0.065);
    } else {
      // Generic mouse squeak: quick pitch-up
      this.sweep(ctx, t, 620, 980, 'sine', 0.075, 0.004, 0.085);
    }
  }

  playLifeLost(): void {
    const ctx = this.getCtx();
    const t = ctx.currentTime;
    this.sweep(ctx, t, 440, 175, 'sawtooth', 0.3, 0.025, 0.45);
    this.noise(ctx, t + 0.1, 0.12, 0.015, 0.22, 'lowpass', 360);
  }

  playWaveStart(wave: number): void {
    const ctx = this.getCtx();
    let t = ctx.currentTime;
    const notes = wave >= 5
      ? [523.25, 659.25, 783.99, 1046.5]
      : [392.00, 523.25, 659.25];
    for (const freq of notes) {
      this.tone(ctx, t, freq, 'square', 0.21, 0.008, 0.13);
      t += 0.13;
    }
  }

  playWaveComplete(): void {
    const ctx = this.getCtx();
    let t = ctx.currentTime;
    for (const freq of [523.25, 659.25, 783.99, 1046.5]) {
      this.tone(ctx, t, freq, 'square', 0.18, 0.006, 0.1);
      t += 0.11;
    }
  }

  playGameOver(): void {
    const ctx = this.getCtx();
    let t = ctx.currentTime;
    for (const freq of [392.00, 349.23, 293.66, 196.00]) {
      this.tone(ctx, t, freq, 'sawtooth', 0.22, 0.018, 0.24);
      t += 0.27;
    }
  }

  playCoin(): void {
    const ctx = this.getCtx();
    const t = ctx.currentTime;
    this.tone(ctx, t, 1046.5, 'sine', 0.085, 0.003, 0.085);
    this.tone(ctx, t + 0.065, 1318.51, 'sine', 0.065, 0.003, 0.085);
  }

  playTowerPlaced(): void {
    const ctx = this.getCtx();
    const t = ctx.currentTime;
    this.tone(ctx, t, 440, 'sine', 0.13, 0.007, 0.11);
    this.tone(ctx, t + 0.08, 523.25, 'sine', 0.1, 0.007, 0.1);
  }

  playSell(): void {
    const ctx = this.getCtx();
    const t = ctx.currentTime;
    this.tone(ctx, t, 523.25, 'sine', 0.1, 0.007, 0.09);
    this.tone(ctx, t + 0.075, 659.25, 'sine', 0.1, 0.007, 0.09);
    this.tone(ctx, t + 0.15, 783.99, 'sine', 0.1, 0.007, 0.12);
  }

  playUpgrade(): void {
    const ctx = this.getCtx();
    const t = ctx.currentTime;
    this.tone(ctx, t, 880, 'sine', 0.13, 0.007, 0.09);
    this.tone(ctx, t + 0.09, 1046.5, 'sine', 0.13, 0.007, 0.13);
  }

  // ── Synthesis primitives ──────────────────────────────────────

  /** Single oscillator with ADSR-like envelope */
  private tone(
    ctx: AudioContext, when: number,
    freq: number, type: OscillatorType,
    vol: number, attack: number, decay: number,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(vol, when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(when);
    osc.stop(when + attack + decay + 0.01);
  }

  /** Oscillator with frequency sweep */
  private sweep(
    ctx: AudioContext, when: number,
    freqStart: number, freqEnd: number, type: OscillatorType,
    vol: number, attack: number, decay: number,
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, when);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, when + attack + decay);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(vol, when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(when);
    osc.stop(when + attack + decay + 0.01);
  }

  /** Filtered white noise (reuses a shared 1-second buffer) */
  private noise(
    ctx: AudioContext, when: number,
    vol: number, attack: number, decay: number,
    filterType: BiquadFilterType, filterFreq: number,
  ): void {
    const source = ctx.createBufferSource();
    source.buffer = this.getNoiseBuffer(ctx);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(vol, when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start(when);
    source.stop(when + attack + decay + 0.02);
  }
}

/** Singleton instance shared by all game objects */
export const audioManager = new AudioManager();
