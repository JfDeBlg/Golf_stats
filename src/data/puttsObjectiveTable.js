// Table de référence "objectif de putts sur 18 trous" par index de handicap, utilisée en
// Statistiques pour calculer un objectif personnalisé par interpolation linéaire
// (src/scoring/puttsObjective.js).

export const PUTTS_OBJECTIVE_TABLE = [
  { index: 0, putts: 29.1 },
  { index: 5, putts: 30.8 },
  { index: 10, putts: 32.4 },
  { index: 15, putts: 34.1 },
  { index: 20, putts: 35.7 },
  { index: 25, putts: 37.3 },
  { index: 30, putts: 38.9 },
];
