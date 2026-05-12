import type { FinishMode } from './types';

interface DartThrow {
  score: number;
  label: string;
}

// All scoreable darts ordered high→low (greedy preference for big scores)
const ALL_DART_THROWS: DartThrow[] = (() => {
  const darts: DartThrow[] = [];
  for (let i = 20; i >= 1; i--) {
    darts.push({ score: i * 3, label: `T${i}` });
    darts.push({ score: i * 2, label: `D${i}` });
    darts.push({ score: i,     label: String(i) });
  }
  darts.push({ score: 50, label: 'BULL' });
  darts.push({ score: 25, label: 'Bull' });
  return darts;
})();

// Map from dart score → preferred label (triple > double > single, high → low)
const DART_SCORE_TO_LABEL: Map<number, string> = (() => {
  const map = new Map<number, string>();
  for (const d of ALL_DART_THROWS) {
    if (!map.has(d.score)) map.set(d.score, d.label);
  }
  return map;
})();

// Double-out: last dart must be a double (D1–D20 or double bull)
function getCheckout(score: number, maxDarts: number): string[] | null {
  if (score < 2 || score > 170 || maxDarts < 1) return null;

  const doubleLabel: Record<number, string> = {};
  for (let i = 1; i <= 20; i++) doubleLabel[i * 2] = `D${i}`;
  doubleLabel[50] = 'BULL';

  // 1-dart checkout
  if (doubleLabel[score]) return [doubleLabel[score]];
  if (maxDarts === 1) return null;

  // 2-dart checkout
  for (const d1 of ALL_DART_THROWS) {
    const need = score - d1.score;
    if (need >= 2 && doubleLabel[need]) return [d1.label, doubleLabel[need]];
  }
  if (maxDarts === 2) return null;

  // 3-dart checkout
  for (const d1 of ALL_DART_THROWS) {
    const rem1 = score - d1.score;
    if (rem1 < 2) continue;
    for (const d2 of ALL_DART_THROWS) {
      const need = rem1 - d2.score;
      if (need >= 2 && doubleLabel[need]) return [d1.label, d2.label, doubleLabel[need]];
    }
  }
  return null;
}

// Single-out: last dart can be any valid dart value
function getCheckoutSingle(score: number, maxDarts: number): string[] | null {
  if (score < 1 || maxDarts < 1) return null;
  if (maxDarts === 1 && score > 60)  return null; // max single dart: T20 = 60
  if (maxDarts === 2 && score > 120) return null; // max two darts:   T20+T20 = 120
  if (score > 180) return null;                   // max three darts: T20+T20+T20 = 180

  // 1-dart checkout
  if (DART_SCORE_TO_LABEL.has(score)) return [DART_SCORE_TO_LABEL.get(score)!];
  if (maxDarts === 1) return null;

  // 2-dart checkout
  for (const d1 of ALL_DART_THROWS) {
    const need = score - d1.score;
    if (need >= 1 && DART_SCORE_TO_LABEL.has(need)) return [d1.label, DART_SCORE_TO_LABEL.get(need)!];
  }
  if (maxDarts === 2) return null;

  // 3-dart checkout
  for (const d1 of ALL_DART_THROWS) {
    const rem1 = score - d1.score;
    if (rem1 < 1) continue;
    for (const d2 of ALL_DART_THROWS) {
      const need = rem1 - d2.score;
      if (need >= 1 && DART_SCORE_TO_LABEL.has(need)) return [d1.label, d2.label, DART_SCORE_TO_LABEL.get(need)!];
    }
  }
  return null;
}

export function calculateCheckout(remaining: number, dartsLeft: number, finishMode: FinishMode): string[] | null {
  if (finishMode === 'double') return getCheckout(remaining, dartsLeft);
  if (finishMode === 'single') return getCheckoutSingle(remaining, dartsLeft);
  return null;
}
