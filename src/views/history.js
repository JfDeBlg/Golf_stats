// Écran Historique : tableau des parties terminées, filtrable (Golf/Année/Mois). Mêmes
// colonnes et même normalisation à 18 trous que Reprendre une partie (cf.
// src/scoring/roundSummary.js) : Date / Golf / Écart / Stableford net.

import { getRounds, getCourses, deleteRound } from '../db/repository.js';
import { createIcon } from '../ui/icons.js';
import { buildFilterBar, roundMatchesFilters } from '../ui/filters.js';
import { computeRoundSummary18, formatToPar } from '../scoring/roundSummary.js';
import { formatGolfName } from '../ui/formHelpers.js';

export async function renderHistory(container, params, navigate) {
  const [allRounds, courses] = await Promise.all([getRounds(), getCourses()]);
  const rounds = allRounds.filter((r) => r.status === 'completed');
  const courseById = new Map(courses.map((c) => [c.id, c]));

  if (rounds.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'Aucune partie terminée.';
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
    const filtered = rounds.filter((r) => roundMatchesFilters(r, filters));
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
    thead.innerHTML = '<tr><th>Date</th><th class="col-golf">Golf</th><th>Écart</th><th>Stableford<br>net</th><th></th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');

    filtered.forEach((round) => {
      const course = courseById.get(round.courseId);
      const { toPar18, points18 } = computeRoundSummary18(round, course);
      const row = document.createElement('tr');
      row.className = 'clickable';
      row.addEventListener('click', () => navigate('scorecard', { roundId: round.id }));
      row.innerHTML = `
        <td>${round.date}</td>
        <td class="col-golf">${course ? formatGolfName(course.name) : 'Golf supprimé'}</td>
        <td>${formatToPar(toPar18)}</td>
        <td>${points18 ?? '—'}</td>
      `;

      const deleteCell = document.createElement('td');
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-icon';
      deleteBtn.setAttribute('aria-label', 'Supprimer cette partie');
      deleteBtn.appendChild(createIcon('delete', { size: 16 }));
      deleteBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (confirm('Supprimer définitivement cette partie ?')) {
          deleteRound(round.id).then(() => navigate('history', {}, { replace: true }));
        }
      });
      deleteCell.appendChild(deleteBtn);
      row.appendChild(deleteCell);

      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    tableScroll.appendChild(table);
  }

  refresh();
}
