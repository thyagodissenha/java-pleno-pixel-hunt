import { describe, expect, it } from "vitest";
import { appendCheatBuffer, matchCheatCode } from "@/lib/cheat-codes";

describe("appendCheatBuffer", () => {
  it("accumulates single-character keys in order", () => {
    let buffer = "";
    for (const key of ["i", "d", "d"]) buffer = appendCheatBuffer(buffer, key);

    expect(buffer).toBe("idd");
  });

  it("lowercases accumulated keys so Caps Lock does not break matching", () => {
    let buffer = "";
    for (const key of ["I", "D", "D", "Q", "D"]) buffer = appendCheatBuffer(buffer, key);

    expect(buffer).toBe("iddqd");
  });

  it("ignores multi-character key names like arrow keys and function keys", () => {
    const buffer = appendCheatBuffer("idd", "ArrowUp");

    expect(buffer).toBe("idd");
  });

  it("ignores the F1 debug-menu key without altering the buffer", () => {
    const buffer = appendCheatBuffer("idd", "F1");

    expect(buffer).toBe("idd");
  });

  it("truncates the buffer to the longest known cheat code length", () => {
    let buffer = "";
    for (const key of ["x", "x", "x", "i", "d", "d", "q", "d"]) buffer = appendCheatBuffer(buffer, key);

    expect(buffer).toBe("iddqd");
    expect(buffer).toHaveLength(5);
  });
});

describe("matchCheatCode", () => {
  it("matches when the buffer ends with iddqd", () => {
    expect(matchCheatCode("iddqd")).toBe("iddqd");
  });

  it("matches when the buffer ends with idkfa", () => {
    expect(matchCheatCode("idkfa")).toBe("idkfa");
  });

  it("matches when the code is preceded by unrelated characters", () => {
    expect(matchCheatCode("xxiddqd")).toBe("iddqd");
  });

  it("returns null for a buffer that matches neither cheat code", () => {
    expect(matchCheatCode("hello")).toBeNull();
  });

  it("returns null for an empty buffer", () => {
    expect(matchCheatCode("")).toBeNull();
  });

  it("returns null for a partial cheat code", () => {
    expect(matchCheatCode("iddq")).toBeNull();
  });
});
