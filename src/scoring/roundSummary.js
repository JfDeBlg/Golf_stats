// Résumé d'un round ramené à 18 trous par règle de trois (score brut ET stableford net),
// pour comparer des parties de longueurs différentes — même principe que la normalisation
// déjà en place pour le graphique stableford des Statistiques, étendu ici au score brut.
// Pur, sans accès au DOM. playedCount compte les trous "played" et "abandoned" (chacun a un
// score, même pénalisant pour l'abandon) ; "not_played" reste hors calcul.

export function computeRoundSummary18(round) {
  let grossTotal = 0;
  let pointsTotal = 0;
  let playedCount = 0;

  round.holeScores.forEach((hs) => {
    if (hs.status !== 'played' && hs.status !== 'abandoned') return;
    grossTotal += hs.grossScore;
    pointsTotal += hs.stablefordNetPoints;
    playedCount += 1;
  });

  if (playedCount === 0) {
    return { gross18: null, points18: null, playedCount: 0 };
  }

  return {
    gross18: Math.round(grossTotal * (18 / playedCount)),
    points18: Math.round(pointsTotal * (18 / playedCount)),
    playedCount,
  };
}
