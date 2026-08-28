// Calculs purs liés au handicap (formule officielle FFGolf/WHS).
// Aucun accès au DOM ici : ces fonctions doivent rester testables isolément.

/**
 * Course Handicap = round(Index × Slope/113 + (SSS − Par total))
 */
export function computeCourseHandicap(handicapIndex, slope, sss, totalPar) {
  const raw = handicapIndex * (slope / 113) + (sss - totalPar);
  return Math.round(raw);
}

/**
 * Coups rendus sur un trou donné, pour un Course Handicap donné.
 * L'écriture en base/reste gère aussi naturellement les Course Handicap négatifs (plus-handicap) :
 * les trous à l'index le plus faible rendent alors un coup de moins.
 */
export function strokesReceivedOnHole(courseHandicap, strokeIndex) {
  const base = Math.floor(courseHandicap / 18);
  const remainder = courseHandicap - base * 18; // toujours dans [0, 17]
  return base + (strokeIndex <= remainder ? 1 : 0);
}
