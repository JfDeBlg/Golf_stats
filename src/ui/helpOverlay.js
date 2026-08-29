// Bouton d'aide contextuelle ("?") réutilisable : au clic, affiche un overlay superposé à
// l'écran courant (texte spécifique passé en paramètre), fermé par une croix ou par un clic
// en dehors. C'est un simple élément DOM ajouté à document.body, jamais une entrée du
// routeur : le fermer restitue exactement l'état précédent de l'écran, sans navigation.

import { createIcon } from './icons.js';

function showHelpOverlay(paragraphs) {
  const overlay = document.createElement('div');
  overlay.className = 'help-overlay';

  const box = document.createElement('div');
  box.className = 'help-box';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-icon help-close';
  closeBtn.setAttribute('aria-label', "Fermer l'aide");
  closeBtn.appendChild(createIcon('close', { size: 18 }));
  closeBtn.addEventListener('click', () => overlay.remove());
  box.appendChild(closeBtn);

  paragraphs.forEach((text) => {
    const p = document.createElement('p');
    p.textContent = text;
    box.appendChild(p);
  });

  overlay.appendChild(box);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.remove();
  });
  document.addEventListener('keydown', function onKeydown(event) {
    if (event.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', onKeydown);
    }
  });

  document.body.appendChild(overlay);
}

// text : une chaîne (un seul paragraphe) ou un tableau de chaînes (un <p> par entrée).
export function createHelpButton(text) {
  const paragraphs = Array.isArray(text) ? text : [text];
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-icon help-btn';
  btn.setAttribute('aria-label', 'Aide sur cet écran');
  btn.appendChild(createIcon('help', { size: 18 }));
  btn.addEventListener('click', () => showHelpOverlay(paragraphs));
  return btn;
}
