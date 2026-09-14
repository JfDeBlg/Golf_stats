// Objectif de putts (sur 18 trous) pour un index de handicap donné, par interpolation
// linéaire entre les deux points de PUTTS_OBJECTIVE_TABLE qui l'encadrent — extrapolation
// linéaire (pente du segment le plus proche) si l'index est hors de la plage 0-30.
// Pur, sans accès au DOM.

import { PUTTS_OBJECTIVE_TABLE } from '../data/puttsObjectiveTable.js';

function interpolate(a, b, index) {
  const t = (index - a.index) / (b.index - a.index);
  return a.putts + t * (b.putts - a.putts);
}

export function computePuttsObjective(handicapIndex) {
  const table = PUTTS_OBJECTIVE_TABLE;
  const index = handicapIndex ?? 0;

  if (index <= table[0].index) {
    return interpolate(table[0], table[1], index);
  }
  if (index >= table[table.length - 1].index) {
    return interpolate(table[table.length - 2], table[table.length - 1], index);
  }
  for (let i = 0; i < table.length - 1; i += 1) {
    if (index >= table[i].index && index <= table[i + 1].index) {
      return interpolate(table[i], table[i + 1], index);
    }
  }
  return table[table.length - 1].putts;
}
