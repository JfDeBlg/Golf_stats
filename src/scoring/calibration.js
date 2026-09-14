// Détermine si un parcours est entièrement calibré GPS (départ(s) + green sur les 18 trous)
// et la valeur de Course.source qui en découle. Pur, sans accès au DOM.
//
// Un trou est calibré "green" dès que son point milieu (Hole.greenPositions.middle) est
// connu — entrée et sortie de green (front/back) sont des repères optionnels en plus, jamais
// requis pour la complétude. getMiddleGreen() retombe sur l'ancien champ unique
// Hole.greenPosition (v1.2.54 et antérieur) si greenPositions n'a pas encore été migré.

export function getMiddleGreen(hole) {
  return hole.greenPositions?.middle ?? hole.greenPosition ?? null;
}

function allGreenPositions(hole) {
  if (hole.greenPositions) return Object.values(hole.greenPositions).filter(Boolean);
  return hole.greenPosition ? [hole.greenPosition] : [];
}

export function isCourseFullyCalibrated(course) {
  const tees = course.recommendedTees ?? [];
  if (tees.length === 0) return false;
  const holes = course.holes ?? [];
  if (holes.length === 0) return false;

  return holes.every((hole) => {
    const hasAllTees = tees.every((tee) => Boolean(hole.teePositions?.[tee.color]));
    return hasAllTees && Boolean(getMiddleGreen(hole));
  });
}

// La source ne bascule que vers "calibrated" ; elle conserve sa valeur d'origine
// ("manual" ou "pdf_import") tant que la calibration est partielle ou absente.
export function deriveCourseSource(course, previousSource) {
  if (isCourseFullyCalibrated(course)) return 'calibrated';
  return previousSource ?? 'manual';
}

// Point de référence approximatif d'un parcours (moyenne de tous les repères GPS déjà
// enregistrés), utilisé pour rapprocher un golf de la position courante du joueur. Renvoie
// null pour un parcours non calibré (rien à comparer).
export function computeCourseReferencePoint(course) {
  const points = [];
  (course.holes ?? []).forEach((hole) => {
    Object.values(hole.teePositions ?? {}).forEach((p) => points.push(p));
    allGreenPositions(hole).forEach((p) => points.push(p));
  });
  if (points.length === 0) return null;
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}
