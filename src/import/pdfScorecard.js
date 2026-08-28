// Parseur dédié au format de carte de score imprimée depuis des-balles-et-des-birdies.com
// (ex: "GOLF DE CHANTILLY / Vineuil"). Reconstruit le tableau à partir des positions (x, y)
// des fragments de texte extraits par pdf.js : l'ordre brut des fragments dans le flux PDF
// est colonne par colonne (trou par trou), pas ligne par ligne, donc on ne peut pas se fier
// à l'ordre de lecture séquentiel — seule la position spatiale est fiable.
//
// Non prioritaire pour cette version : généraliser à d'autres mises en page de carte de
// score. On reconnaît d'abord ce format précis ; on élargira si d'autres formats se
// présentent en usage réel.

import * as pdfjsLib from '../lib/pdf.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../lib/pdf.worker.js', import.meta.url).href;

const ROW_TOLERANCE = 4;
const LABEL_ZONE_MAX_X = 70;
const COLUMN_TOLERANCE = 15;

async function extractPageItems(page) {
  const content = await page.getTextContent();
  // Ne filtrer que les fragments réellement vides (artefacts) : les fragments d'un seul
  // espace sont significatifs, ce sont eux qui séparent les mots des lignes d'en-tête
  // (ex: "Départ : jaune Slope : 133") une fois recollés par position.
  return content.items
    .filter((item) => item.str !== '')
    .map((item) => ({ str: item.str, x: item.transform[4], y: item.transform[5] }));
}

function groupIntoRows(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const rows = [];
  sorted.forEach((item) => {
    let row = rows.find((r) => Math.abs(r.y - item.y) <= ROW_TOLERANCE);
    if (!row) {
      row = { y: item.y, items: [] };
      rows.push(row);
    }
    row.items.push(item);
  });
  rows.forEach((row) => row.items.sort((a, b) => a.x - b.x));
  return rows;
}

function rowLabel(row) {
  return row.items.filter((i) => i.x < LABEL_ZONE_MAX_X).map((i) => i.str).join('').trim();
}

function rowText(row) {
  return row.items.map((i) => i.str).join('').replace(/\s+/g, ' ').trim();
}

function rowValues(row) {
  return row.items.filter((i) => i.x >= LABEL_ZONE_MAX_X);
}

// Aligne les valeurs d'une ligne (Hdp, Dis., Par) sur les colonnes du trou (définies par la
// ligne N°), par proximité en x — robuste à une valeur manquante sur un trou donné, sans
// décaler les valeurs des trous suivants.
function alignToColumns(valueItems, columnAnchors) {
  const result = new Array(columnAnchors.length).fill(null);
  valueItems.forEach((item) => {
    let bestIdx = -1;
    let bestDist = Infinity;
    columnAnchors.forEach((anchorX, idx) => {
      const dist = Math.abs(item.x - anchorX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });
    if (bestIdx >= 0 && bestDist <= COLUMN_TOLERANCE) {
      result[bestIdx] = item.str;
    }
  });
  return result;
}

export async function parseScorecardPdf(fileData) {
  const doc = await pdfjsLib.getDocument({ data: fileData }).promise;
  const page = await doc.getPage(1);
  const items = await extractPageItems(page);
  const rows = groupIntoRows(items);

  const warnings = [];

  const titleRow = rows.find((r) => /trous/i.test(rowText(r)));
  const teeRow = rows.find((r) => /Départ/i.test(rowText(r)));
  const numberRow = rows.find((r) => rowLabel(r) === 'N°');
  const hdpRow = rows.find((r) => rowLabel(r) === 'Hdp');
  const disRow = rows.find((r) => rowLabel(r) === 'Dis.');
  const parRow = rows.find((r) => rowLabel(r) === 'Par');

  if (!numberRow) {
    throw new Error('Format non reconnu : ligne des numéros de trou introuvable dans le PDF.');
  }

  let name = '';
  if (titleRow) {
    const text = rowText(titleRow);
    const match = /^(.+?)\s*\/\s*(.+?)\s*\/\s*\d+\s*trous\.?\s*$/i.exec(text);
    name = match ? `${match[1].trim()} / ${match[2].trim()}` : text;
  } else {
    warnings.push('Nom du golf non détecté.');
  }

  let tee = { color: '', slope: null, sss: null };
  let maxHandicap = null;
  if (teeRow) {
    const text = rowText(teeRow);
    const match = /Départ\s*:\s*(.+?)\s+Slope\s*:\s*([\d.,]+)\s+SSS\s*:\s*([\d.,]+)(?:\s+Handicap\s*:\s*([\d.,]+))?/i.exec(text);
    if (match) {
      tee = {
        color: match[1].trim(),
        slope: parseFloat(match[2].replace(',', '.')),
        sss: parseFloat(match[3].replace(',', '.')),
      };
      if (match[4]) maxHandicap = parseFloat(match[4].replace(',', '.'));
    } else {
      warnings.push('Départ / Slope / SSS non détectés.');
    }
  } else {
    warnings.push('Départ / Slope / SSS non détectés.');
  }

  const numberItems = rowValues(numberRow);
  const columnAnchors = numberItems.map((i) => i.x);
  const holeNumbers = numberItems.map((i) => parseInt(i.str, 10));

  function extractRow(row, label, parser) {
    if (!row) {
      warnings.push(`Colonne "${label}" introuvable.`);
      return new Array(columnAnchors.length).fill(null);
    }
    const aligned = alignToColumns(rowValues(row), columnAnchors);
    return aligned.map((v, idx) => {
      if (v == null) {
        warnings.push(`${label} manquant pour le trou ${holeNumbers[idx] ?? idx + 1}.`);
        return null;
      }
      const parsed = parser(v);
      return Number.isNaN(parsed) ? null : parsed;
    });
  }

  const hdpValues = extractRow(hdpRow, 'Index (Hdp)', (v) => parseInt(v, 10));
  const disValues = extractRow(disRow, 'Distance', (v) => parseFloat(v.replace(',', '.')));
  const parValues = extractRow(parRow, 'Par', (v) => parseInt(v, 10));

  const holes = holeNumbers.map((number, idx) => ({
    number,
    par: parValues[idx],
    strokeIndex: hdpValues[idx],
    distance: disValues[idx],
  }));

  return { name, tee, maxHandicap, holes, warnings };
}
