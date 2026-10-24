// Procedural Web Audio Synthesizer & Real Human Voice Speech Engine
// Zero external MP3/WAV dependencies

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenPhase: number = 0;
  private lastAmbientSpeechAt: number = 0;
  private lastScreechAt: number = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (mute) {
      this.stopContinuousSounds();
      this.stopVoice();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public stopVoice() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore browser speech cancellation edge cases
      }
    }
  }

  /**
   * Speaks realistic human NPC dialogue out loud using Web Speech synthesis.
   * Assigns distinct human voice timbre, pitch, and cadence per NPC seed.
   */
  public speakVoice(
    text: string,
    voiceSeed: number = 1,
    mood: 'NEUTRAL' | 'FRIENDLY' | 'ALARMED' = 'NEUTRAL',
    priority: boolean = false
  ) {
    if (this.muted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    const now = performance.now();
    if (!priority) {
      if (window.speechSynthesis.speaking || now - this.lastAmbientSpeechAt < 5200) {
        return;
      }
      this.lastAmbientSpeechAt = now;
    } else {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
      this.lastAmbientSpeechAt = now;
    }

    try {
      const cleanText = text.replace(/[“”"]/g, '').trim();
      if (!cleanText) return;

      const utter = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices();
      const englishVoices = voices.filter((v) => /^en(-|_)/i.test(v.lang));
      const pool = englishVoices.length > 0 ? englishVoices : voices;
      if (pool.length > 0) {
        utter.voice = pool[Math.abs(voiceSeed) % pool.length];
      }

      const pitchBase = 0.85 + ((Math.abs(voiceSeed * 7) % 10) / 10) * 0.34;
      utter.pitch = mood === 'ALARMED' ? Math.min(1.32, pitchBase + 0.12) : pitchBase;
      utter.rate =
        mood === 'ALARMED'
          ? 1.14
          : mood === 'FRIENDLY'
          ? 1.03
          : 0.97 + ((Math.abs(voiceSeed * 3) % 5) * 0.02);
      utter.volume = priority ? 0.92 : 0.65;

      window.speechSynthesis.speak(utter);
    } catch {
      // Fallback gracefully if speechSynthesis is restricted on device
    }
  }

  public stopContinuousSounds() {
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
    if (this.sirenGain && this.ctx) {
      this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  public updateEngine(inVehicle: boolean, speedRatio: number, throttle: boolean) {
    if (this.muted || !inVehicle) {
      if (this.engineGain && this.ctx) {
        this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      }
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    if (!this.engineOsc || !this.engineGain) {
      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 260;

      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;

      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(ctx.destination);
      this.engineOsc.start();
    }

    const gearMod = ((Math.abs(speedRatio) * 3.2) % 1) * 0.55 + Math.abs(speedRatio) * 0.45;
    const baseFreq = 48 + gearMod * 125 + (throttle ? 20 : 0);
    const targetGain = 0.045 + Math.min(0.055, Math.abs(speedRatio) * 0.042);
    this.engineOsc.frequency.setTargetAtTime(baseFreq, ctx.currentTime, 0.06);
    this.engineGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.08);
  }

  public updateSiren(wantedLevel: number, nearestPoliceDist: number, dt: number) {
    if (this.muted || wantedLevel <= 0 || nearestPoliceDist > 85) {
      if (this.sirenGain && this.ctx) {
        this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      }
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    if (!this.sirenOsc || !this.sirenGain) {
      this.sirenOsc = ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(ctx.destination);
      this.sirenOsc.start();
    }

    this.sirenPhase += dt * 3.8;
    const freq = 680 + Math.sin(this.sirenPhase) * 240;
    const atten = Math.max(0, 1 - nearestPoliceDist / 85);
    this.sirenOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.03);
    this.sirenGain.gain.setTargetAtTime(atten * 0.05, ctx.currentTime, 0.06);
  }

  public playTireScreech(intensity: number = 0.5) {
    const nowMs = performance.now();
    if (nowMs - this.lastScreechAt < 260) return;
    this.lastScreechAt = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(920 + Math.random() * 180, now);
    osc.frequency.linearRampToValueAtTime(760, now + 0.16);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1050, now);
    filter.Q.setValueAtTime(6, now);

    gain.gain.setValueAtTime(Math.min(0.06, 0.035 * intensity), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playImpact(intensity: number = 0.7) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.18);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.045));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420 * intensity + 150, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.min(0.28, 0.16 * intensity), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  public playActionPulse() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.11);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playHorn(pitchShift: number = 1.0) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(340 * pitchShift, now);
    osc2.frequency.setValueAtTime(425 * pitchShift, now);

    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.28);
    osc2.stop(now + 0.28);
  }

  public playDoorChime() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.setValueAtTime(560, now + 0.06);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  private radioStepTimer: number = 0;
  private radioBeatIndex: number = 0;

  public updateRadio(inVehicle: boolean, stationIndex: number, dt: number) {
    if (this.muted || !inVehicle || stationIndex <= 0) {
      return;
    }
    this.radioStepTimer += dt;
    const tempo = stationIndex === 1 ? 0.24 : stationIndex === 2 ? 0.3 : 0.38;
    if (this.radioStepTimer < tempo) return;
    this.radioStepTimer = 0;
    this.radioBeatIndex = (this.radioBeatIndex + 1) % 8;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const scales: Record<number, number[]> = {
      1: [110, 130.81, 146.83, 164.81, 196.0, 164.81, 146.83, 220], // West Coast Synth FM
      2: [65.41, 65.41, 98.0, 77.78, 65.41, 87.31, 98.0, 116.54], // Vinewood Bassline
      3: [261.63, 329.63, 392.0, 493.88, 392.0, 329.63, 293.66, 246.94], // Solis Chill FM
    };
    const notes = scales[stationIndex] || scales[1];
    const freq = notes[this.radioBeatIndex];

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = stationIndex === 2 ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(stationIndex === 3 ? 680 : 520, now);

    gain.gain.setValueAtTime(0.032, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + tempo * 0.88);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + tempo * 0.9);
  }

  public playStunShot() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.14);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playMissionComplete() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
    });
  }
}

export const soundEngine = new SoundEngine();
