export const CHEAT_CODES = ["iddqd", "idkfa", "idclip"] as const;

export type CheatCode = (typeof CHEAT_CODES)[number];

const MAX_BUFFER_LENGTH = Math.max(...CHEAT_CODES.map((code) => code.length));

export function appendCheatBuffer(buffer: string, key: string): string {
  if (key.length !== 1) return buffer;
  return (buffer + key.toLowerCase()).slice(-MAX_BUFFER_LENGTH);
}

export function matchCheatCode(buffer: string): CheatCode | null {
  return CHEAT_CODES.find((code) => buffer.endsWith(code)) ?? null;
}
