// Mini-graphique en ligne, tracé en SVG manuel — pas de dépendance externe.

const SVG_NS = 'http://www.w3.org/2000/svg';

export function buildLineChart(points, { width = 320, height = 180, target = null, targetLabel = '' } = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'line-chart');

  if (points.length === 0) {
    return svg;
  }

  const padding = { top: 16, right: 16, bottom: 28, left: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const values = target != null ? [...points.map((p) => p.value), target] : points.map((p) => p.value);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 1);
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
