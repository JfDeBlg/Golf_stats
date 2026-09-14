// Mini-graphique en ligne, tracé en SVG manuel — pas de dépendance externe.
//
// Échelle adaptative (depuis la 1.2.55) : min/max calculés à partir des données affichées
// (+ la ligne objectif, pour qu'elle reste toujours visible même hors de la plage des
// données), avec une marge d'environ 8 % de part et d'autre plutôt qu'un axe Y fixe partant
// de 0 — nécessaire dès que les valeurs affichées ne sont plus proches de 0 (ex : total de
// putts ramené à 18 trous, de l'ordre de 30-40).
//
// Graduations Y (depuis la 1.2.56) : min et max (déjà en place) + la valeur de la ligne de
// moyenne si elle ne tombe pas trop près des deux autres — au plus 3 nombres affichés sur
// l'axe, pour ne pas surcharger visuellement un graphique de cette taille. La ligne de
// moyenne elle-même est orange (--color-chart-average, distinct de l'ambre de la ligne
// objectif) plutôt que rouge, plus lisible sur fond sombre.

const SVG_NS = 'http://www.w3.org/2000/svg';
const AXIS_MARGIN_RATIO = 0.08;

export function buildLineChart(points, {
  width = 320, height = 180, target = null, targetLabel = '', average = null, averageLabel = '',
} = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'line-chart');

  if (points.length === 0) {
    return svg;
  }

  const padding = { top: 16, right: 16, bottom: 28, left: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const dataValues = points.map((p) => p.value);
  const extremes = target != null ? [...dataValues, target] : dataValues;
  let minValue = Math.min(...extremes);
  let maxValue = Math.max(...extremes);
  if (minValue === maxValue) {
    minValue -= 1;
    maxValue += 1;
  }
  const span = maxValue - minValue;
  const margin = span * AXIS_MARGIN_RATIO;
  minValue -= margin;
  maxValue += margin;
  const range = maxValue - minValue || 1;

  const xFor = (i) => (points.length === 1
    ? padding.left + plotWidth / 2
    : padding.left + (i / (points.length - 1)) * plotWidth);
  const yFor = (v) => padding.top + plotHeight - ((v - minValue) / range) * plotHeight;

  const axis = document.createElementNS(SVG_NS, 'line');
  axis.setAttribute('x1', padding.left);
  axis.setAttribute('y1', padding.top + plotHeight);
  axis.setAttribute('x2', width - padding.right);
  axis.setAttribute('y2', padding.top + plotHeight);
  axis.setAttribute('class', 'chart-axis');
  svg.appendChild(axis);

  // Ligne de référence (objectif) : statique, purement visuelle — pas de champ de
  // configuration pour l'instant.
  if (target != null) {
    const targetY = yFor(target);
    const targetLine = document.createElementNS(SVG_NS, 'line');
    targetLine.setAttribute('x1', padding.left);
    targetLine.setAttribute('y1', targetY);
    targetLine.setAttribute('x2', width - padding.right);
    targetLine.setAttribute('y2', targetY);
    targetLine.setAttribute('class', 'chart-target-line');
    svg.appendChild(targetLine);

    if (targetLabel) {
      const targetText = document.createElementNS(SVG_NS, 'text');
      targetText.setAttribute('x', width - padding.right);
      targetText.setAttribute('y', targetY - 4);
      targetText.setAttribute('text-anchor', 'end');
      targetText.setAttribute('class', 'chart-target-label');
      targetText.textContent = targetLabel;
      svg.appendChild(targetText);
    }
  }

  // Ligne de moyenne réelle des données affichées — distincte de la ligne "objectif"
  // ci-dessus (statique ou personnalisée), recalculée à chaque filtre.
  if (average != null) {
    const averageY = yFor(average);
    const averageLine = document.createElementNS(SVG_NS, 'line');
    averageLine.setAttribute('x1', padding.left);
    averageLine.setAttribute('y1', averageY);
    averageLine.setAttribute('x2', width - padding.right);
    averageLine.setAttribute('y2', averageY);
    averageLine.setAttribute('class', 'chart-average-line');
    svg.appendChild(averageLine);

    if (averageLabel) {
      const averageText = document.createElementNS(SVG_NS, 'text');
      averageText.setAttribute('x', padding.left);
      averageText.setAttribute('y', averageY - 4);
      averageText.setAttribute('text-anchor', 'start');
      averageText.setAttribute('class', 'chart-average-label');
      averageText.textContent = averageLabel;
      svg.appendChild(averageText);
    }
  }

  const polyline = document.createElementNS(SVG_NS, 'polyline');
  polyline.setAttribute('points', points.map((p, i) => `${xFor(i)},${yFor(p.value)}`).join(' '));
  polyline.setAttribute('class', 'chart-line');
  svg.appendChild(polyline);

  points.forEach((p, i) => {
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', xFor(i));
    circle.setAttribute('cy', yFor(p.value));
    circle.setAttribute('r', 3);
    circle.setAttribute('class', 'chart-dot');
    const title = document.createElementNS(SVG_NS, 'title');
    title.textContent = `${p.label} : ${p.value}`;
    circle.appendChild(title);
    svg.appendChild(circle);
  });

  const maxLabel = document.createElementNS(SVG_NS, 'text');
  maxLabel.setAttribute('x', 2);
  maxLabel.setAttribute('y', padding.top + 4);
  maxLabel.setAttribute('class', 'chart-axis-label');
  maxLabel.textContent = maxValue.toFixed(1);
  svg.appendChild(maxLabel);

  const minLabel = document.createElementNS(SVG_NS, 'text');
  minLabel.setAttribute('x', 2);
  minLabel.setAttribute('y', padding.top + plotHeight);
  minLabel.setAttribute('class', 'chart-axis-label');
  minLabel.textContent = minValue.toFixed(1);
  svg.appendChild(minLabel);

  // Graduation numérique de la ligne de moyenne sur l'axe Y (même style que min/max
  // ci-dessus), en plus de son étiquette textuelle près de la ligne elle-même — sans
  // surcharger le graphique, on l'omet si elle tomberait trop près d'un des deux labels
  // déjà posés aux bornes du graphique.
  if (average != null) {
    const averageY = yFor(average);
    const tooCloseToMax = Math.abs(averageY - (padding.top + 4)) < 10;
    const tooCloseToMin = Math.abs(averageY - (padding.top + plotHeight)) < 10;
    if (!tooCloseToMax && !tooCloseToMin) {
      const averageTick = document.createElementNS(SVG_NS, 'text');
      averageTick.setAttribute('x', 2);
      averageTick.setAttribute('y', averageY + 3);
      averageTick.setAttribute('class', 'chart-average-tick');
      averageTick.textContent = average.toFixed(1);
      svg.appendChild(averageTick);
    }
  }

  const labelIndexes = points.length <= 6
    ? points.map((_, i) => i)
    : [0, Math.floor((points.length - 1) / 2), points.length - 1];

  labelIndexes.forEach((i) => {
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', xFor(i));
    text.setAttribute('y', height - 8);
    text.setAttribute('class', 'chart-axis-label');
    text.setAttribute('text-anchor', 'middle');
    text.textContent = points[i].label;
    svg.appendChild(text);
  });

  return svg;
}
