// Mini-graphique à barres, tracé en SVG manuel — pas de dépendance externe. Réutilise le
// même principe visuel que lineChart.js (axe, étiquettes) pour une distribution par
// catégorie (ex : écart au par par trou).

const SVG_NS = 'http://www.w3.org/2000/svg';

export function buildBarChart(bars, { width = 320, height = 180 } = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'line-chart');

  if (bars.length === 0) {
    return svg;
  }

  const padding = { top: 20, right: 8, bottom: 28, left: 8 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...bars.map((b) => b.value), 1);

  const axis = document.createElementNS(SVG_NS, 'line');
  axis.setAttribute('x1', padding.left);
  axis.setAttribute('y1', padding.top + plotHeight);
  axis.setAttribute('x2', width - padding.right);
  axis.setAttribute('y2', padding.top + plotHeight);
  axis.setAttribute('class', 'chart-axis');
  svg.appendChild(axis);

  const gap = 6;
  const barWidth = (plotWidth - gap * (bars.length - 1)) / bars.length;

  bars.forEach((bar, i) => {
    const barHeight = bar.value > 0 ? (bar.value / maxValue) * plotHeight : 0;
    const x = padding.left + i * (barWidth + gap);
    const y = padding.top + plotHeight - barHeight;

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', barWidth);
    rect.setAttribute('height', barHeight);
    rect.setAttribute('class', 'chart-bar');
    svg.appendChild(rect);

    const valueText = document.createElementNS(SVG_NS, 'text');
    valueText.setAttribute('x', x + barWidth / 2);
    valueText.setAttribute('y', y - 4);
    valueText.setAttribute('text-anchor', 'middle');
    valueText.setAttribute('class', 'chart-axis-label');
    valueText.textContent = String(bar.value);
    svg.appendChild(valueText);

    const labelText = document.createElementNS(SVG_NS, 'text');
    labelText.setAttribute('x', x + barWidth / 2);
    labelText.setAttribute('y', height - 8);
    labelText.setAttribute('text-anchor', 'middle');
    labelText.setAttribute('class', 'chart-axis-label');
    labelText.textContent = bar.label;
    svg.appendChild(labelText);
  });

  return svg;
}
