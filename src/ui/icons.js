// Construit un élément <svg> DOM à partir du set d'icônes inline (pas de fetch, pas d'<img>,
// donc stylable via currentColor et disponible instantanément hors-ligne).

import { ICONS } from '../icons/icons.js';

const template = document.createElement('template');

export function createIcon(name, { size = 18 } = {}) {
  template.innerHTML = ICONS[name].trim();
  const svg = template.content.firstElementChild.cloneNode(true);
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('icon');
  return svg;
}
