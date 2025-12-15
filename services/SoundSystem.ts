
// Simple Synthesized Sound System using Web Audio API
// No external assets required.

class SoundSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled: boolean = true;

  constructor() {
    // Initialize on first user interaction to comply with browser autoplay policies
    if (typeof window !== 'undefined') {
      window.addEventListener('click', () => this.init(), { once: true });
      window.addEventListener('keydown', () => this.init(), { once: true });
    }
  }

  private init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3; // Default volume
      this.masterGain.connect(this.ctx.destination);
    }
  }

  public toggle(mute: boolean) {
    this.enabled = !mute;
    if (this.masterGain) {
        this.masterGain.gain.value = this.enabled ? 0.3 : 0;
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, vol: number = 1, slideTo: number | null = null) {
    if (!this.ctx || !this.masterGain || !this.enabled) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
    }

    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  private playNoise(duration: number, vol: number = 1) {
      if (!this.ctx || !this.masterGain || !this.enabled) return;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
      
      noise.connect(gain);
      gain.connect(this.masterGain);
      noise.start();
  }

  // --- SFX PRESETS ---

  public playUiClick() {
      this.playTone(800, 'sine', 0.05, 0.5);
  }

  public playUiHover() {
      this.playTone(400, 'triangle', 0.02, 0.1);
  }

  public playStep() {
      this.playNoise(0.05, 0.2);
      this.playTone(100, 'square', 0.05, 0.1, 50);
  }

  public playAttack() {
      this.playNoise(0.1, 0.5);
      this.playTone(300, 'sawtooth', 0.1, 0.3, 100);
  }

  public playHit() {
      this.playNoise(0.2, 0.6);
      this.playTone(150, 'sawtooth', 0.2, 0.5, 50);
  }

  public playMagic() {
      this.playTone(600, 'sine', 0.4, 0.3, 1200);
      setTimeout(() => this.playTone(800, 'sine', 0.4, 0.2, 1500), 100);
      setTimeout(() => this.playTone(1200, 'sine', 0.4, 0.1, 2000), 200);
  }

  public playCrit() {
      this.playTone(800, 'square', 0.1, 0.5, 1200);
      setTimeout(() => this.playTone(1200, 'square', 0.3, 0.5, 1800), 50);
  }

  public playVictory() {
      const now = this.ctx?.currentTime || 0;
      [0, 0.2, 0.4, 0.8].forEach((t, i) => {
          setTimeout(() => this.playTone(440 * (i+1), 'triangle', 0.3, 0.4), t * 1000);
      });
  }
}

export const sfx = new SoundSystem();
