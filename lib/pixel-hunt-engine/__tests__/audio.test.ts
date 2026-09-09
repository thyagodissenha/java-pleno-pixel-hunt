import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAudioEngine } from "@/lib/pixel-hunt-engine/audio";

// jsdom não implementa Web Audio API — simulamos o suficiente de
// AudioContext/GainNode/OscillatorNode para exercitar playSound/startMusic
// sem tocar áudio de verdade.
class FakeGain {
  gain = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
}

class FakeOscillator {
  type = "square";
  frequency = { setValueAtTime: vi.fn() };
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

function installFakeAudioContext() {
  const createGainSpy = vi.fn(() => new FakeGain());
  const createOscillatorSpy = vi.fn(() => new FakeOscillator());

  class FakeAudioContext {
    currentTime = 0;
    state = "running";
    destination = {};
    createGain() {
      return createGainSpy();
    }
    createOscillator() {
      return createOscillatorSpy();
    }
    resume() {
      return Promise.resolve();
    }
  }
  (window as unknown as { AudioContext: typeof FakeAudioContext }).AudioContext = FakeAudioContext;
  return { FakeAudioContext, createGainSpy, createOscillatorSpy };
}

describe("createAudioEngine", () => {
  const originalAudioContext = window.AudioContext;
  const originalWebkitAudioContext = (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    (window as unknown as { AudioContext: unknown }).AudioContext = originalAudioContext;
    (window as unknown as { webkitAudioContext: unknown }).webkitAudioContext = originalWebkitAudioContext;
  });

  it("plays no sound (creates no gain node) when muted", () => {
    const { createGainSpy } = installFakeAudioContext();
    const engine = createAudioEngine();
    engine.setPrefs({ muted: true, volume: 0.5 });
    engine.playSound("shoot");
    expect(createGainSpy).not.toHaveBeenCalled();
  });

  it("plays no sound (creates no gain node) when volume is 0", () => {
    const { createGainSpy } = installFakeAudioContext();
    const engine = createAudioEngine();
    engine.setPrefs({ muted: false, volume: 0 });
    engine.playSound("hit");
    expect(createGainSpy).not.toHaveBeenCalled();
  });

  it("debounces a repeated sound played within its minimum gap, and plays again after it", () => {
    const { createOscillatorSpy } = installFakeAudioContext();
    const engine = createAudioEngine();
    engine.setPrefs({ muted: false, volume: 0.5 });
    const nowSpy = vi.spyOn(performance, "now");

    nowSpy.mockReturnValue(1000);
    engine.playSound("hit"); // "hit" has a single note -> 1 oscillator
    expect(createOscillatorSpy).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(1010); // within the 45ms minGap for "hit" -> debounced
    engine.playSound("hit");
    expect(createOscillatorSpy).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(1100); // past the minGap -> plays again
    engine.playSound("hit");
    expect(createOscillatorSpy).toHaveBeenCalledTimes(2);

    nowSpy.mockRestore();
  });

  it("falls back silently when AudioContext is unavailable on window", () => {
    (window as unknown as { AudioContext: unknown }).AudioContext = undefined;
    (window as unknown as { webkitAudioContext: unknown }).webkitAudioContext = undefined;
    const engine = createAudioEngine();
    engine.setPrefs({ muted: false, volume: 0.5 });
    expect(() => engine.playSound("shoot")).not.toThrow();
    expect(() => engine.startMusic()).not.toThrow();
    expect(() => engine.stopMusic()).not.toThrow();
  });

  it("startMusic schedules ticks and stopMusic clears them", () => {
    installFakeAudioContext();
    const engine = createAudioEngine();
    engine.setPrefs({ muted: false, volume: 0.5 });
    engine.startMusic();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    engine.stopMusic();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("startMusic does nothing while muted", () => {
    installFakeAudioContext();
    const engine = createAudioEngine();
    engine.setPrefs({ muted: true, volume: 0.5 });
    engine.startMusic();
    expect(vi.getTimerCount()).toBe(0);
  });
});
