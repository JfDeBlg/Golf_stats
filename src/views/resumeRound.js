// Écran Reprendre une partie : tableau de rounds filtrable (Golf/Année/Mois, composant
// partagé avec Historique et Statistiques). Le statut listé (in_progress ou completed) est
// décidé par le menu selon le nombre de rounds en cours (cf. menu.js) et passé via
// params.statusFilter. Colonnes Date / Golf / Score brut / Stableford net, ramenées à 18
// trous par règle de trois (cf. src/scoring/roundSummary.js) — un tiret seulement si
// vraiment aucun trou n'a de score. Cliquer une ligne ouvre la carte de score du round
// (même écran que pour une partie terminée) — pas directement un trou.

import { getRounds, getCourses } from '../db/repository.js';
import { buildFilterBar, roundMatchesFilters } from '../ui/filters.js';
import { computeRoundSummary18 } from '../scoring/roundSummary.js';

export async function renderResumeRound(container, params, navigate) {
  const statusFilter = params.statusFilter ?? 'in_progress';
  const [rounds, courses] = await Promise.all([getRounds(), getCourses()]);
  const matchingStatus = rounds.filter((r) => r.status === statusFilter);

  if (matchingStatus.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = statusFilter === 'in_progress' ? 'Aucune partie en cours.' : 'Aucune partie terminée.';
    container.appendChild(empty);
    return;
  }

  const filterBar = buildFilterBar({ courses }, refresh);
  container.appendChild(filterBar.element);

  const tableScroll = document.createElement('div');
  tableScroll.className = 'table-scroll';
  container.appendChild(tableScroll);

  function refresh() {
    const filters = filterBar.getFilters();
    const filtered = matchingStatus.filter((r) => roundMatchesFilters(r, filters));
    tableScroll.innerHTML = '';

    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'Aucune partie ne correspond aux filtres.';
      tableScroll.appendChild(empty);
      return;
    }

    const table = document.createElement('table');
    table.className = 'scorecard-table';
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Date</th><th>Golf</th><th>Score brut</th><th>Stableford net</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');

    filtered.forEach((round) => {
      const course = courses.find((c) => c.id === round.courseId);
      const { gross18, points18 } = computeRoundSummary18(round);
      const row = document.createElement('tr');
      row.className = 'clickable';
      row.addEventListener('click', () => navigate('scorecard', { roundId: round.id }));
      row.innerHTML = `
        <td>${round.date}</td>
        <td>${course?.name ?? 'Golf supprimé'}</td>
        <td>${gross18 ?? '—'}</td>
        <td>${points18 ?? '—'}</td>
      `;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    tableScroll.appendChild(table);
  }

  refresh();
}
