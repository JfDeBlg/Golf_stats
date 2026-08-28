// Calcul pur du score stableford net, sans accès au DOM.

import { strokesReceivedOnHole } from './handicap.js';

/**
 * Points stableford net pour un trou = max(0, 2 − (score brut − par − coups rendus))
 */
export function computeNetStablefordPoints(grossScore, par, courseHandicap, strokeIndex) {
  if (grossScore == null) return null;
  const strokesReceived = strokesReceivedOnHole(courseHandicap, strokeIndex);
  return Math.max(0, 2 - (grossScore - par - strokesReceived));
}
