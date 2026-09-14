// Export PDF (une page) résumant une partie, depuis l'écran Carte de score. jsPDF est
// vendoré localement (src/lib/jspdf.umd.min.js, build UMD, jamais chargé depuis un CDN) —
// même principe que pdf.js/JSZip — et chargé paresseusement via un <script> classique injecté
// à la demande, jamais au démarrage de l'app : une bibliothèque tierce importée statiquement
// dans le graphe de modules ferait planter l'app entière si elle échoue à s'évaluer sur un
// moteur JS donné (observé avec pdf.js sur iPhone, cf. README.md, 1.2.5).
//
// Une fois généré, le PDF est partagé/téléchargé via shareOrDownloadZip (src/db/exportImport.js)
// — cette fonction est en réalité agnostique au type de fichier malgré son nom (elle ne fait
// que shareOrDownload sur le File reçu) : on la réutilise telle quelle plutôt que de dupliquer
// le même mécanisme de partage natif + repli téléchargement.

import { formatGolfName } from '../ui/formHelpers.js';
import { formatToPar } from '../scoring/roundSummary.js';
import { loadJsPDF } from './pdfLib.js';

const COLUMNS = [
  { label: 'Trou', width: 18 },
  { label: 'Par', width: 18 },
  { label: 'Score', width: 22 },
  { label: 'Écart', width: 22 },
  { label: 'Pts', width: 18 },
  { label: 'Putts', width: 18 },
];

export async function buildRoundSummaryPdfFile(round, course) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const marginX = 15;
  let y = 20;

  doc.setFontSize(16);
  doc.text(formatGolfName(course.name), marginX, y);
  y += 8;

  doc.setFontSize(11);
  const statusLabel = round.status === 'completed' ? 'Terminée' : 'En cours';
  doc.text(`Date : ${round.date}`, marginX, y);
  y += 6;
  doc.text(`Départ joué : ${round.teeColor} — Course Handicap ${round.courseHandicap} — ${statusLabel}`, marginX, y);
  y += 10;

  doc.setFontSize(10);
  let x = marginX;
  COLUMNS.forEach((col) => {
    doc.text(col.label, x, y);
    x += col.width;
  });
  y += 2;
  doc.line(marginX, y, x, y);
  y += 5;

  let totalPar = 0;
  let parPlayed = 0;
  let totalGross = 0;
  let totalPoints = 0;
  let playedCount = 0;
  let puttsTotal = 0;
  let puttsPlayedCount = 0;

  course.holes.forEach((hole) => {
    const hs = round.holeScores.find((h) => h.holeNumber === hole.number);
    let scoreCell = '—';
    let diffCell = '—';
    const ptsCell = hs.status === 'not_played' ? '—' : String(hs.stablefordNetPoints);
    const puttsCell = hs.status === 'played' ? String(hs.putts ?? '—') : '—';

    if (hs.status === 'played' || hs.status === 'abandoned') {
      const diff = hs.grossScore - hole.par;
      scoreCell = hs.status === 'abandoned' ? 'X' : String(hs.grossScore);
      diffCell = formatToPar(diff);
    }

    x = marginX;
    [String(hole.number), String(hole.par), scoreCell, diffCell, ptsCell, puttsCell].forEach((cell, i) => {
      doc.text(cell, x, y);
      x += COLUMNS[i].width;
    });
    y += 6;

    totalPar += hole.par;
    if (hs.status === 'played' || hs.status === 'abandoned') {
      totalGross += hs.grossScore;
      parPlayed += hole.par;
      totalPoints += hs.stablefordNetPoints;
      playedCount += 1;
    }
    if (hs.status === 'played') {
      puttsTotal += hs.putts ?? 0;
      puttsPlayedCount += 1;
    }
  });

  const diffTotal = playedCount > 0 ? totalGross - parPlayed : null;
  const puttsAverage = puttsPlayedCount > 0 ? (puttsTotal / puttsPlayedCount).toFixed(2) : '—';

  y += 2;
  doc.line(marginX, y, x, y);
  y += 5;
  doc.setFontSize(10);
  x = marginX;
  [
    'Total',
    String(totalPar),
    playedCount > 0 ? String(totalGross) : '—',
    formatToPar(diffTotal),
    String(totalPoints),
    puttsPlayedCount > 0 ? String(puttsTotal) : '—',
  ].forEach((cell, i) => {
    doc.text(cell, x, y);
    x += COLUMNS[i].width;
  });

  y += 8;
  doc.text(`Moyenne putts : ${puttsAverage}`, marginX, y);

  const blob = doc.output('blob');
  const dateStamp = round.date.replace(/-/g, '');
  return new File([blob], `carte-de-score-${dateStamp}.pdf`, { type: 'application/pdf' });
}
