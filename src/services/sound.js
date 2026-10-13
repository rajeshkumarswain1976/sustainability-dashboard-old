/**
 * Yggdrasil Ambient Soundscape & Interaction Audio Engine
 * Pure Web Audio API synthesis - no external MP3/WAV dependencies.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = true;
    this.ambientNodes = null;
    this.masterGain = null;
    this.hasInteracted = false;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return true;
  }

  toggleMute() {
    const nextMuted = !this.isMuted;
    this.setMuted(nextMuted);
    return !nextMuted;
  }

  setMuted(muted) {
    this.isMuted = muted;
    try {
      localStorage.setItem('yggdrasil-sound-muted', String(muted));
    } catch {
      // ignore localStorage quota/privacy errors
    }

    if (muted) {
      this.stopAmbient();
    } else {
      this.ensureContext();
      this.startAmbient();
      this.playChime(440, 0.25, 0.6);
    }
  }

  initFromStorage() {
    try {
      const saved = localStorage.getItem('yggdrasil-sound-muted');
      if (saved === 'false') {
        // Autoplay policies require user interaction before resuming audio
        const resumeOnFirstClick = () => {
          if (!this.isMuted) {
            this.ensureContext();
            this.startAmbient();
          }
          window.removeEventListener('pointerdown', resumeOnFirstClick);
        };
        this.isMuted = false;
        window.addEventListener('pointerdown', resumeOnFirstClick, { once: true });
      } else {
        this.isMuted = true;
      }
    } catch {
      this.isMuted = true;
    }
  }

  startAmbient() {
    if (this.isMuted || !this.ensureContext()) return;
    if (this.ambientNodes) return; // already playing

    const now = this.ctx.currentTime;
    const ambientGain = this.ctx.createGain();
    ambientGain.gain.setValueAtTime(0.001, now);
    ambientGain.gain.linearRampToValueAtTime(0.18, now + 3);
    ambientGain.connect(this.masterGain);

    // Warm resonant filters
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, now);
    filter.Q.setValueAtTime(3.2, now);
    filter.connect(ambientGain);

    // Filter LFO to simulate gentle breathing breeze
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.14, now); // ~7s breath cycle
    lfoGain.gain.setValueAtTime(140, now);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    // Pentatonic chord tones: D2, A2, D3, F#3 (warm tree resonance)
    const freqs = [73.42, 110.0, 146.83, 185.0];
    const oscillators = freqs.map((freq, index) => {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = index % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      // subtle detune
      osc.detune.setValueAtTime((index - 1.5) * 4, now);

      oscGain.gain.setValueAtTime(0.25 / (index + 1), now);
      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start();
      return osc;
    });

    // Soft pink-noise wind layer
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      output[i] = (b0 + b1 + b2) * 0.08;
    }
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(420, now);
    noiseFilter.Q.setValueAtTime(1.8, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.045, now);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ambientGain);
    noiseSource.start();

    this.ambientNodes = {
      oscillators,
      lfo,
      noiseSource,
      ambientGain,
    };
  }

  stopAmbient() {
    if (!this.ambientNodes || !this.ctx) return;
    const now = this.ctx.currentTime;
    const { ambientGain, oscillators, lfo, noiseSource } = this.ambientNodes;

    ambientGain.gain.setValueAtTime(ambientGain.gain.value, now);
    ambientGain.gain.linearRampToValueAtTime(0.0001, now + 1.2);

    setTimeout(() => {
      try {
        oscillators.forEach(osc => osc.stop());
        lfo.stop();
        noiseSource.stop();
      } catch {
        // already stopped
      }
      this.ambientNodes = null;
    }, 1300);
  }

  playChime(freq = 523.25, duration = 0.8, volume = 0.3) {
    if (this.isMuted || !this.ensureContext()) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume * 0.35, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.1);
  }

  playBranchSelect(index = 0) {
    const chordNotes = [
      [523.25, 659.25, 783.99], // Campus: C5 - E5 - G5
      [587.33, 739.99, 880.00], // Enterprise: D5 - F#5 - A5
      [440.00, 554.37, 659.25], // Hospital: A4 - C#5 - E5
    ];
    const notes = chordNotes[index % chordNotes.length];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.playChime(freq, 0.7 + i * 0.2, 0.22);
      }, i * 65);
    });
  }

  playStageAdvance() {
    this.playChime(392.0, 0.4, 0.2); // G4
    setTimeout(() => {
      this.playChime(587.33, 0.6, 0.25); // D5
    }, 90);
  }

  playFormSuccess() {
    const successNotes = [440, 554.37, 659.25, 880];
    successNotes.forEach((freq, i) => {
      setTimeout(() => {
        this.playChime(freq, 0.9, 0.28);
      }, i * 85);
    });
  }
}

export const sound = new SoundEngine();
sound.initFromStorage();
