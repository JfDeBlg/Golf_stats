// Écran Historique : liste des parties terminées, filtrable (Golf/Année/Mois), ouverture
// et suppression.

import { getRounds, getCourses, deleteRound } from '../db/repository.js';
import { createIcon } from '../ui/icons.js';
import { buildFilterBar, roundMatchesFilters } from '../ui/filters.js';

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

  const list = document.createElement('div');
  list.className = 'list-select';
  container.appendChild(list);

  function refresh() {
    const filters = filterBar.getFilters();
    const filtered = rounds.filter((r) => roundMatchesFilters(r, filters));
    list.innerHTML = '';

    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'Aucune partie ne correspond aux filtres.';
      list.appendChild(empty);
      return;
    }

    filtered.forEach((round) => {
      const course = courseById.get(round.courseId);
      const totalGross = round.holeScores.reduce((s, h) => s + (h.grossScore ?? 0), 0);
      const totalPoints = round.holeScores.reduce((s, h) => s + (h.stablefordNetPoints ?? 0), 0);

      const row = document.createElement('div');
      row.className = 'list-item-row';

      const info = document.createElement('button');
      info.type = 'button';
      info.className = 'list-item';
      info.textContent = `${round.date} — ${course?.name ?? 'Golf supprimé'} — ${totalGross} coups — ${totalPoints} pts`;
      info.addEventListener('click', () => navigate('scorecard', { roundId: round.id }));
      row.appendChild(info);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-icon';
      deleteBtn.setAttribute('aria-label', 'Supprimer cette partie');
      deleteBtn.appendChild(createIcon('delete', { size: 18 }));
      deleteBtn.addEventListener('click', () => {
        if (confirm('Supprimer définitivement cette partie ?')) {
          deleteRound(round.id).then(() => navigate('history', {}, { replace: true }));
        }
      });
      row.appendChild(deleteBtn);

      list.appendChild(row);
    });
  }

  refresh();
}
