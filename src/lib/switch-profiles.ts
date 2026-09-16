// © 2026 HVNF Studios. All rights reserved. Portfolio sample — do not redistribute.

/** Numbers the Web Audio synth uses to "voice" a switch. */
export type VoiceParams = {
  thumpHz: number;
  thumpGain: number;
  thumpDecay: number;
  clickHz: number;
  clickQ: number;
  clickGain: number;
  clickDecay: number;
  lowpassHz: number;
  releaseDelay: number;
  releaseGain: number;
  bump?: { hz: number; gain: number };
};

export type SwitchId = "linear-mineral" | "tactile-topaz" | "silent-cream";

export type SwitchProfile = {
  id: SwitchId;
  name: string;
  weight: string;
  type: string;
  travel: string;
  stem: string;
  spring: string;
  housing: string;
  band: string;
  summary: string;
  voice: VoiceParams;
};

export const SWITCH_PROFILES: readonly SwitchProfile[] = [
  {
    id: "linear-mineral",
    name: "Linear Mineral",
    weight: "45g",
    type: "Linear",
    travel: "4.0 mm",
    stem: "POM, factory lubed (205g0)",
    spring: "45 g actuation, 22 mm dual-stage",
    housing: "PC top / nylon bottom",
    band: "350–600 Hz",
    summary:
      "Smooth POM stem in a polycarbonate top housing. Deep, rounded bottom-out with a short, clean return.",
    voice: {
      thumpHz: 160,
      thumpGain: 0.55,
      thumpDecay: 0.07,
      clickHz: 1500,
      clickQ: 1.1,
      clickGain: 0.5,
      clickDecay: 0.05,
      lowpassHz: 5200,
      releaseDelay: 0.09,
      releaseGain: 0.18,
    },
  },
  {
    id: "tactile-topaz",
    name: "Tactile Topaz",
    weight: "62g",
    type: "Tactile",
    travel: "3.8 mm",
    stem: "POM, bump-tuned leg",
    spring: "62 g actuation, 18 mm gold-plated",
    housing: "PC top / nylon bottom",
    band: "600–1,200 Hz",
    summary:
      "A rounded bump at 0.6 mm of travel, then a sharper, higher-pitched bottom-out off the nylon floor.",
    voice: {
      thumpHz: 200,
      thumpGain: 0.45,
      thumpDecay: 0.05,
      clickHz: 2400,
      clickQ: 1.5,
      clickGain: 0.65,
      clickDecay: 0.038,
      lowpassHz: 8000,
      releaseDelay: 0.08,
      releaseGain: 0.26,
      bump: { hz: 3200, gain: 0.3 },
    },
  },
  {
    id: "silent-cream",
    name: "Silent Cream",
    weight: "55g",
    type: "Silent linear",
    travel: "3.5 mm",
    stem: "POM with dual silicone dampers",
    spring: "55 g actuation, 20 mm",
    housing: "Nylon top / nylon bottom",
    band: "180–350 Hz",
    summary:
      "Silicone dampers on the stem cut bottom-out and top-out noise. Built for shared offices and late-night work.",
    voice: {
      thumpHz: 120,
      thumpGain: 0.5,
      thumpDecay: 0.045,
      clickHz: 900,
      clickQ: 0.8,
      clickGain: 0.22,
      clickDecay: 0.03,
      lowpassHz: 1300,
      releaseDelay: 0.1,
      releaseGain: 0.04,
    },
  },
];
