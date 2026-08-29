// Résumé d'un round ramené à 18 trous par règle de trois (écart au par signé ET stableford
// net), pour comparer des parties de longueurs différentes — même principe que la
// normalisation déjà en place pour le graphique stableford des Statistiques.
// Pur, sans accès au DOM. playedCount compte les trous "played" et "abandoned" (chacun a un
// score, même pénalisant pour l'abandon) ; "not_played" reste hors calcul.
//
// `course` est nécessaire pour connaître le par de chaque trou joué ; si le golf a été
// supprimé (course absent), toPar18 reste `null` (affiché "—") plutôt que de calculer un
// écart faux à partir d'un par inconnu.

export function computeRoundSummary18(round, course) {
  let grossTotal = 0;
  let parTotal = 0;
  let pointsTotal = 0;
  let playedCount = 0;

  round.holeScores.forEach((hs) => {
    if (hs.status !== 'played' && hs.status !== 'abandoned') return;
    grossTotal += hs.grossScore;
    pointsTotal += hs.stablefordNetPoints;
    playedCount += 1;
    if (course) {
      const hole = course.holes.find((h) => h.number === hs.holeNumber);
      if (hole) parTotal += hole.par;
    }
  });

  if (playedCount === 0) {
    return { toPar18: null, points18: null, playedCount: 0 };
  }

  return {
    toPar18: course ? Math.round((grossTotal - parTotal) * (18 / playedCount)) : null,
    points18: Math.round(pointsTotal * (18 / playedCount)),
    playedCount,
  };
}

// Formate un écart signé au par (ex: +20, -2, 0) — "—" si non calculable (aucun trou joué,
// ou par inconnu). Convention alignée sur l'affichage déjà en place dans la Carte de score
// (src/views/scorecard.js), pour ne jamais diverger entre les deux écrans.
export function formatToPar(diff) {
  if (diff == null) return '—';
  if (diff === 0) return '0';
  return diff > 0 ? `+${diff}` : `${diff}`;
}
