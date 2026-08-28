// Écran Menu principal. MENU_ITEMS et activateMenuItem sont exportés pour être réutilisés
// par le menu sandwich du bandeau (src/main.js), qui donne accès aux mêmes options depuis
// n'importe quel écran.

import { getRounds } from '../db/repository.js';

export const MENU_ITEMS = [
  { label: 'Réglages', route: 'settings' },
  { label: 'Reprendre une partie', route: 'resumeRound' },
  { label: 'Nouvelle partie', route: 'roundNew' },
  { label: 'Gestion parcours', route: 'courseManage' },
  { label: 'Historique', route: 'history' },
  { label: 'Statistiques', route: 'stats' },
];

// "Reprendre une partie" saute directement au round en cours s'il n'y en a qu'un ; sinon
// il ouvre soit la liste des rounds en cours (s'il y en a plusieurs), soit la liste des
// rounds terminés à rouvrir (s'il n'y en a aucun).
async function handleResumeRound(navigate) {
  const rounds = await getRounds();
  const inProgress = rounds.filter((r) => r.status === 'in_progress');
  if (inProgress.length === 1) {
    navigate('scorecard', { roundId: inProgress[0].id });
  } else if (inProgress.length === 0) {
    navigate('resumeRound', { statusFilter: 'completed' });
  } else {
    navigate('resumeRound', { statusFilter: 'in_progress' });
  }
}

export async function activateMenuItem(item, navigate) {
  if (item.route === 'resumeRound') {
    await handleResumeRound(navigate);
  } else {
    navigate(item.route);
  }
}

export function renderMenu(container, params, navigate) {
  const nav = document.createElement('nav');
  nav.className = 'menu-list';

  MENU_ITEMS.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-item';
    btn.textContent = item.label;
    btn.addEventListener('click', () => activateMenuItem(item, navigate));
    nav.appendChild(btn);
  });

  container.appendChild(nav);
}
