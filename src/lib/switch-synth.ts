// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

import type { VoiceParams } from "./switch-profiles";

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

/**
 * Synthesizes a mechanical switch keystroke with no audio files.
 *
 * A real keystroke isn't one sound — it's several stacked events with distinct
 * timbres: a sharp plastic-on-plastic "tick" transient, a resonant body tone
 * from the case/plate acting as a small resonator (never a pure sine — real
 * objects ring at several inharmonic partials at once), and a much quieter
 * top-out on release. All of it sits inside a tiny bit of room reflection so
 * it reads as a physical object instead of a beep.
 */
export class SwitchSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private noise: AudioBuffer | null = null;
  private reverb: ConvolverNode | null = null;
  private bins: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0));

  private boot(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    }
    const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!Ctor) return null;

    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0.85;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 6;
    compressor.ratio.value = 3.5;
    compressor.attack.value = 0.001;
    compressor.release.value = 0.08;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;

    // Dry path: the plastic transient and body tone, largely unaffected.
    const dry = ctx.createGain();
    dry.gain.value = 0.82;
    // Wet path: a short synthetic room impulse so strikes have a hint of the
    // desk and case around them instead of sounding like they're in a vacuum.
    const reverb = ctx.createConvolver();
    reverb.buffer = createRoomImpulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.16;

    master.connect(dry);
    master.connect(reverb);
    reverb.connect(wet);
    dry.connect(compressor);
    wet.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(ctx.destination);

    const length = Math.floor(ctx.sampleRate * 0.3);
    const noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const channel = noise.getChannelData(0);
    for (let i = 0; i < length; i++) channel[i] = Math.random() * 2 - 1;

    this.ctx = ctx;
    this.master = master;
    this.analyser = analyser;
    this.noise = noise;
    this.reverb = reverb;
    this.bins = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    return ctx;
  }

  strike(voice: VoiceParams): boolean {
    const ctx = this.boot();
    if (!ctx) return false;

    const start = ctx.currentTime + 0.004;
    // Small random drift so repeated strikes don't sound like a copy-paste.
    const drift = 0.94 + Math.random() * 0.12;
    let bottomOut = start;

    if (voice.bump) {
      this.tick(start, voice.bump.hz * drift, voice.bump.gain, 0.01, voice.lowpassHz);
      bottomOut += 0.021 + Math.random() * 0.003;
    }

    // Bottom-out: a very short broadband tick (the actual plastic collision)
    // layered under a narrower resonant click (the housing ringing briefly).
    this.tick(bottomOut, voice.clickHz * drift, voice.clickGain, voice.clickDecay * 0.55, voice.lowpassHz);
    this.click(bottomOut, voice.clickHz * drift, voice.clickQ, voice.clickGain * 0.85, voice.clickDecay, voice.lowpassHz);
    this.body(bottomOut, voice.thumpHz * drift, voice.thumpGain, voice.thumpDecay);

    // Top-out on release: quieter, higher, shorter — no low body tone.
    const release = bottomOut + voice.releaseDelay;
    this.tick(release, voice.clickHz * 1.4 * drift, voice.releaseGain * 0.6, 0.008, voice.lowpassHz);
    this.click(release, voice.clickHz * 1.3 * drift, voice.clickQ, voice.releaseGain, voice.clickDecay * 0.6, voice.lowpassHz);
    return true;
  }

  /** A very short, near-broadband transient — the actual collision of plastic parts. */
  private tick(start: number, hz: number, gain: number, decay: number, lowpassHz: number) {
    const { ctx, master, noise } = this;
    if (!ctx || !master || !noise) return;

    const source = ctx.createBufferSource();
    source.buffer = noise;
    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = Math.max(300, hz * 0.4);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = Math.min(lowpassHz * 1.6, 14000);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), start + 0.0008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + decay);

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(envelope);
    envelope.connect(master);
    source.start(start, Math.random() * 0.2);
    source.stop(start + decay + 0.02);
  }

  /** A narrower resonant ring at the switch's characteristic click frequency. */
  private click(start: number, hz: number, q: number, gain: number, decay: number, lowpassHz: number) {
    const { ctx, master, noise } = this;
    if (!ctx || !master || !noise) return;

    const source = ctx.createBufferSource();
    source.buffer = noise;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = hz;
    band.Q.value = q;
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = lowpassHz;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), start + 0.0025);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + decay);

    source.connect(band);
    band.connect(low);
    low.connect(envelope);
    envelope.connect(master);
    source.start(start, Math.random() * 0.2);
    source.stop(start + decay + 0.03);
  }

  /**
   * The low body tone. Real housings and plates don't ring at one pure pitch —
   * they carry a fundamental plus a couple of inharmonic partials that decay
   * at slightly different rates, which is most of what separates "clacky
   * plastic" from "sine wave beep."
   */
  private body(start: number, hz: number, gain: number, decay: number) {
    const { ctx, master } = this;
    if (!ctx || !master) return;

    const partials = [
      { ratio: 1, level: 1, decayScale: 1 },
      { ratio: 2.37, level: 0.34, decayScale: 0.55 },
      { ratio: 3.61, level: 0.16, decayScale: 0.35 },
    ];

    for (const partial of partials) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      const partialHz = hz * partial.ratio;
      osc.frequency.setValueAtTime(partialHz, start);
      osc.frequency.exponentialRampToValueAtTime(partialHz * 0.55, start + decay);
      const envelope = ctx.createGain();
      const partialDecay = decay * partial.decayScale;
      const partialGain = gain * partial.level;
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(Math.max(partialGain, 0.0001), start + 0.003);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + partialDecay);

      osc.connect(envelope);
      envelope.connect(master);
      osc.start(start);
      osc.stop(start + partialDecay + 0.03);
    }
  }

  /** Current frequency magnitudes (0–255 per bin), or null before the first strike. */
  readSpectrum(): Uint8Array | null {
    if (!this.analyser) return null;
    this.analyser.getByteFrequencyData(this.bins);
    return this.bins;
  }

  /** Hz covered by each spectrum bin. */
  get binHz(): number {
    return this.ctx && this.analyser ? this.ctx.sampleRate / this.analyser.fftSize : 0;
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.analyser = null;
    this.noise = null;
    this.reverb = null;
  }
}

/** A short, decaying-noise impulse response — a tiny synthetic "desk and case" space. */
function createRoomImpulse(ctx: AudioContext): AudioBuffer {
  const duration = 0.18;
  const length = Math.floor(ctx.sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const decay = Math.pow(1 - i / length, 2.6);
      data[i] = (Math.random() * 2 - 1) * decay;
    }
  }
  return impulse;
}
