/** Mulberry32: small deterministic PRNG so the demo dataset is reproducible. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(rng: () => number, items: readonly T[]): T => items[Math.floor(rng() * items.length)] as T;

export const between = (rng: () => number, min: number, max: number): number => min + rng() * (max - min);
