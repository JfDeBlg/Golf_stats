// Écran Historique : liste des parties, ouverture et suppression.

import { getRounds, getCourse, deleteRound } from '../db/repository.js';
import { createIcon } from '../ui/icons.js';

export async function renderHistory(container, params, navigate) {
  const rounds = (await getRounds()).filter((r) => r.status === 'completed');

  if (rounds.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'Aucune partie terminée.';
    container.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'list-select';

  for (const round of rounds) {
    const course = await getCourse(round.courseId);
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
  }

  container.appendChild(list);
}
