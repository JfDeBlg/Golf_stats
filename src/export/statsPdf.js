// Export PDF (une ou plusieurs pages) des statistiques affichées à l'écran pour les filtres
// actifs (Golf/Année/Mois/Club) — valeurs chiffrées uniquement, les graphiques ne sont pas
// reproduits en image (pas nécessaire : les mêmes nombres sont déjà dans les tableaux
// ci-dessous). `summary` est un objet de données pur, construit par
// buildStatsExportSummary (src/views/stats.js) à partir des mêmes fonctions de calcul que
// l'affichage à l'écran, pour qu'export et écran ne puissent jamais diverger.
//
// jsPDF vendoré, chargé paresseusement via loadJsPDF (pdfLib.js) — même précaution que
// pdf.js/JSZip, jamais au démarrage de l'app. Partagé/téléchargé via shareOrDownloadZip
// (src/db/exportImport.js), comme l'export PDF de partie (roundPdf.js).

import { loadJsPDF } from './pdfLib.js';

const MARGIN_X = 15;
const PAGE_BOTTOM = 280;

function ensureSpace(doc, y, needed = 10) {
  if (y + needed <= PAGE_BOTTOM) return y;
  doc.addPage();
  return 20;
}

function formatFrenchDecimal(value, decimals = 1) {
  return value.toFixed(decimals).replace('.', ',');
}

// Objectif et réel sont tous deux affichés sur les deux échelles (total/18 trous et
// moyenne/trou) pour rester comparables d'un coup d'oeil — total18 est déjà sur l'échelle
// 18 trous (comme sur les graphiques de l'écran), la moyenne par trou s'en déduit (/18).
function formatPuttsDual(label, total18) {
  if (total18 == null) return `${label} : —`;
  const perHole = total18 / 18;
  return `${label} : ${formatFrenchDecimal(total18)} putts/18 trous (${formatFrenchDecimal(perHole, 2)}/trou)`;
}

function drawTable(doc, y, headers, rows, colWidths) {
  doc.setFontSize(10);
  let x = MARGIN_X;
  headers.forEach((h, i) => {
    doc.text(h, x, y);
    x += colWidths[i];
  });
  y += 2;
  doc.line(MARGIN_X, y, x, y);
  y += 5;
  rows.forEach((row) => {
    y = ensureSpace(doc, y, 6);
    x = MARGIN_X;
    row.forEach((cell, i) => {
      doc.text(String(cell), x, y);
      x += colWidths[i];
    });
    y += 6;
  });
  return y + 2;
}

export async function buildStatsSummaryPdfFile(summary) {
  const jsPDF = await loadJsPDF();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 20;

  doc.setFontSize(16);
  doc.text('Statistiques', MARGIN_X, y);
  y += 8;

  doc.setFontSize(10);
  doc.text(summary.filtersLabel, MARGIN_X, y);
  y += 10;

  doc.setFontSize(11);

  if (!summary.hasCompletedRounds) {
    doc.text('Aucune partie terminée pour ces filtres.', MARGIN_X, y);
    const blob = doc.output('blob');
    return new File([blob], 'statistiques.pdf', { type: 'application/pdf' });
  }

  doc.text(formatPuttsDual('Objectif', summary.puttsObjective), MARGIN_X, y);
  y += 7;
  doc.text(formatPuttsDual('Réel', summary.realPutts18), MARGIN_X, y);
  y += 7;

  if (summary.hasAnyGirEver) {
    doc.text(`En régulation sur green : ${summary.girPct != null ? `${summary.girPct}%` : '—'}`, MARGIN_X, y);
    y += 7;
  }

  y += 3;
  doc.setFontSize(13);
  doc.text('Distribution des scores par rapport au par', MARGIN_X, y);
  y += 8;
  y = drawTable(
    doc, y, ['Résultat', 'Nombre'],
    summary.scoreDistribution.map((row) => [row.label, row.value]),
    [60, 30]
  );

  if (!summary.isSimplified) {
    y = ensureSpace(doc, y, 14);
    y += 3;
    doc.setFontSize(13);
    doc.text('Distance moyenne mesurée par club', MARGIN_X, y);
    y += 8;
    if (summary.clubDistanceStats.length === 0) {
      doc.setFontSize(10);
      doc.text('Aucune distance mesurée pour ces filtres.', MARGIN_X, y);
      y += 8;
    } else {
      y = drawTable(
        doc, y, ['Club', 'Distance moyenne', 'Coups pleins'],
        summary.clubDistanceStats.map((c) => [c.clubName, `${Math.round(c.avgDistance)} m`, c.count]),
        [70, 45, 35]
      );
    }

    if (summary.hasAnyLieOrShapeEver) {
      if (summary.lieDistribution) {
        y = ensureSpace(doc, y, 14);
        y += 3;
        doc.setFontSize(13);
        doc.text('Lie — répartition', MARGIN_X, y);
        y += 8;
        y = drawTable(
          doc, y, ['Lie', 'Nombre', '%'],
          summary.lieDistribution.map((r) => [r.label, r.count, `${r.pct}%`]),
          [70, 30, 20]
        );
      }
      if (summary.shapeDistribution) {
        y = ensureSpace(doc, y, 14);
        y += 3;
        doc.setFontSize(13);
        doc.text('Style de coup — répartition', MARGIN_X, y);
        y += 8;
        y = drawTable(
          doc, y, ['Style', 'Nombre', '%'],
          summary.shapeDistribution.map((r) => [r.label, r.count, `${r.pct}%`]),
          [70, 30, 20]
        );
      }
    }

    if (summary.hasAnyContactEver && summary.contactDistribution) {
      y = ensureSpace(doc, y, 14);
      y += 3;
      doc.setFontSize(13);
      doc.text('Contact', MARGIN_X, y);
      y += 8;
      y = drawTable(
        doc, y, ['Contact', 'Nombre', '%'],
        summary.contactDistribution.map((r) => [r.label, r.count, `${r.pct}%`]),
        [70, 30, 20]
      );
    }
  }

  const blob = doc.output('blob');
  return new File([blob], 'statistiques.pdf', { type: 'application/pdf' });
}
