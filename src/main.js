// Point d'entrée : routage par vues (pas de framework) et enregistrement du service worker.

import { APP_VERSION } from './version.js';
import { createIcon } from './ui/icons.js';
import { renderMenu, MENU_ITEMS, activateMenuItem } from './views/menu.js';
import { renderSettings } from './views/settings.js';
import { renderCourseManage } from './views/courseManage.js';
import { renderCourseNew } from './views/courseNew.js';
import { renderCourseImportPdf } from './views/courseImportPdf.js';
import { renderCourseEdit } from './views/courseEdit.js';
import { renderCourseDelete } from './views/courseDelete.js';
import { renderCourseCalibrate } from './views/courseCalibrate.js';
import { renderResumeRound } from './views/resumeRound.js';
import { renderRoundNew } from './views/roundNew.js';
import { renderPlay } from './views/play.js';
import { renderScorecard } from './views/scorecard.js';
import { renderHistory } from './views/history.js';
import { renderStats } from './views/stats.js';

const routes = {
  menu: { render: renderMenu, title: `GolfStats — v${APP_VERSION}`, showBack: false },
  settings: { render: renderSettings, title: 'Réglages', showBack: true },
  courseManage: { render: renderCourseManage, title: 'Gestion parcours', showBack: true },
  courseNew: { render: renderCourseNew, title: 'Nouveau parcours', showBack: true },
  courseImportPdf: { render: renderCourseImportPdf, title: 'Importer depuis un PDF', showBack: true },
  courseEdit: { render: renderCourseEdit, title: 'Modifier parcours', showBack: true },
  courseDelete: { render: renderCourseDelete, title: 'Supprimer parcours', showBack: true },
  courseCalibrate: { render: renderCourseCalibrate, title: 'Calibrer avec le GPS', showBack: true },
  resumeRound: { render: renderResumeRound, title: 'Reprendre une partie', showBack: true },
  roundNew: { render: renderRoundNew, title: 'Nouvelle partie', showBack: true },
  play: { render: renderPlay, title: 'Partie en cours', showBack: true },
  scorecard: { render: renderScorecard, title: 'Carte de score', showBack: true },
  history: { render: renderHistory, title: 'Historique', showBack: true },
  stats: { render: renderStats, title: 'Statistiques', showBack: true },
};

const appEl = document.getElementById('app');
const titleEl = document.getElementById('app-title');
const backBtn = document.getElementById('btn-back');
backBtn.appendChild(createIcon('arrowLeft', { size: 20 }));

// Menu sandwich du bandeau : toujours visible, donne accès aux mêmes options que l'écran
// Menu principal depuis n'importe quel autre écran.
const menuBtn = document.getElementById('btn-menu');
const menuDropdown = document.getElementById('menu-dropdown');
menuBtn.appendChild(createIcon('menu', { size: 22 }));

MENU_ITEMS.forEach((item) => {
  const itemBtn = document.createElement('button');
  itemBtn.type = 'button';
  itemBtn.className = 'menu-dropdown-item';
  itemBtn.appendChild(createIcon(item.icon, { size: 18 }));
  itemBtn.appendChild(document.createTextNode(item.label));
  itemBtn.addEventListener('click', () => {
    closeMenuDropdown();
    activateMenuItem(item, navigate);
  });
  menuDropdown.appendChild(itemBtn);
});

function openMenuDropdown() {
  menuDropdown.hidden = false;
  menuBtn.setAttribute('aria-expanded', 'true');
}

function closeMenuDropdown() {
  menuDropdown.hidden = true;
  menuBtn.setAttribute('aria-expanded', 'false');
}

menuBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  if (menuDropdown.hidden) {
    openMenuDropdown();
  } else {
    closeMenuDropdown();
  }
});

document.addEventListener('click', (event) => {
  if (!menuDropdown.hidden && !menuDropdown.contains(event.target) && event.target !== menuBtn) {
    closeMenuDropdown();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !menuDropdown.hidden) {
    closeMenuDropdown();
  }
});

const stack = [{ routeName: 'menu', params: {} }];

export function navigate(routeName, params = {}, { replace = false } = {}) {
  if (replace) {
    stack[stack.length - 1] = { routeName, params };
  } else {
    stack.push({ routeName, params });
  }
  renderCurrent();
}

export function goBack() {
  if (stack.length > 1) {
    stack.pop();
    renderCurrent();
  }
}

function renderCurrent() {
  closeMenuDropdown();
  const { routeName, params } = stack[stack.length - 1];
  const route = routes[routeName];
  titleEl.textContent = route.title;
  backBtn.hidden = !route.showBack;
  appEl.innerHTML = '';
  route.render(appEl, params, navigate);
}

backBtn.addEventListener('click', goBack);

renderCurrent();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch((err) => {
      console.error("Échec de l'enregistrement du service worker", err);
    });
  });
}
