// Motor de áudio (Web Audio API) — tons, sons, música — sem depender de
// estado de jogo nem de React. Porta 1:1 a lógica de `getAudioContext`,
// `playTone`, `playSound`, `startMusic`, `stopMusic` (`app/page.tsx:314-392`).
//
// `createAudioEngine()` é uma factory (em vez de estado a nível de módulo)
// para permitir instâncias isoladas em teste.

import type { SoundName, Tone } from "@/lib/pixel-hunt-engine/types";

export type AudioPrefs = { muted: boolean; volume: number };

export type AudioEngine = {
  playSound(sound: SoundName): void;
  startMusic(): void;
  stopMusic(): void;
  setPrefs(prefs: AudioPrefs): void;
};

type AudioContextLike = {
  currentTime: number;
  state: string;
  destination: AudioNode;
  createGain(): GainNode;
  createOscillator(): OscillatorNode;
  resume(): Promise<void>;
};

const NOTES: Record<SoundName, Tone[]> = {
  shoot: [[720, 0.055, "square"], [480, 0.05, "square"]],
  hit: [[210, 0.08, "sawtooth"]],
  hurt: [[140, 0.18, "sawtooth"], [90, 0.16, "square"]],
  boss: [[196, 0.16, "square"], [147, 0.18, "square"], [110, 0.22, "square"]],
  over: [[110, 0.18, "sawtooth"], [82, 0.28, "sawtooth"]],
  save: [[523, 0.08, "square"], [659, 0.08, "square"], [784, 0.12, "square"]],
  start: [[330, 0.07, "square"], [494, 0.09, "square"], [660, 0.12, "square"]],
  won: [[523, 0.1, "square"], [659, 0.1, "square"], [784, 0.1, "square"], [1047, 0.16, "square"]],
};

const MUSIC_BASS = [110, 110, 147, 110, 165, 147, 196, 147];
const MUSIC_LEAD = [440, 494, 523, 494, 659, 587, 523, 494, 392, 440, 494, 523, 587, 659, 784, 659];
const MUSIC_STEP_MS = 170;

export function createAudioEngine(): AudioEngine {
  let audio: AudioContextLike | null = null;
  let muted = false;
  let volume = 0.35;
  let musicTimer: ReturnType<typeof setInterval> | null = null;
  let musicStep = 0;
  const lastSound: Record<SoundName, number> = {
    shoot: 0,
    hit: 0,
    hurt: 0,
    boss: 0,
    over: 0,
    save: 0,
    start: 0,
    won: 0,
  };

  function getAudioContext(): AudioContextLike | null {
    if (typeof window === "undefined") return null;
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    audio = audio ?? (new AudioContextClass() as unknown as AudioContextLike);
    if (audio.state === "suspended") void audio.resume();
    return audio;
  }

  function playTone([frequency, duration, type]: Tone, volumeScale = 0.16, delay = 0) {
    if (muted || volume <= 0) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    const start = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume * volumeScale, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    const oscillator = ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.connect(gain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }

  function playSound(sound: SoundName) {
    if (muted || volume <= 0) return;
    const now = performance.now();
    const minGap = sound === "shoot" ? 70 : sound === "hit" ? 45 : 120;
    if (now - lastSound[sound] < minGap) return;
    lastSound[sound] = now;

    let offset = 0;
    for (const note of NOTES[sound]) {
      playTone(note, 0.16, offset);
      const [, duration] = note;
      offset += duration * 0.72;
    }
  }

  function stopMusic() {
    if (musicTimer !== null) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function startMusic() {
    if (musicTimer !== null || muted || volume <= 0) return;
    musicTimer = setInterval(() => {
      if (muted || volume <= 0) {
        stopMusic();
        return;
      }
      const step = musicStep;
      playTone([MUSIC_BASS[step % MUSIC_BASS.length], 0.105, "square"], 0.032);
      if (step % 2 === 0) playTone([MUSIC_LEAD[step % MUSIC_LEAD.length], 0.08, "triangle"], 0.026, 0.035);
      musicStep += 1;
    }, MUSIC_STEP_MS);
  }

  function setPrefs(prefs: AudioPrefs) {
    muted = prefs.muted;
    volume = prefs.volume;
  }

  return { playSound, startMusic, stopMusic, setPrefs };
}
