// Écran Carte de score : tableau des 18 trous et totaux.
// Les totaux (score brut, écart, stableford) portent sur les trous "played" et
// "abandoned" (qui ont chacun un score, même pénalisant pour l'abandon) ; les trous
// "not_played" restent hors calcul. La moyenne de putts ne porte que sur les trous "played".
//
// Lecture seule par défaut (y compris pour une partie en cours reprise, ou une partie
// terminée consultée depuis l'Historique) : le bouton "Modifier" active le mode édition et
// ouvre le trou 1 ; les lignes ne redeviennent cliquables qu'une fois ce mode actif, et ce
// mode se propage tant qu'on va-et-vient entre carte de score et détail de trou.

import { getRound, getCourse, getPlayer, saveRound } from '../db/repository.js';
import { createIcon } from '../ui/icons.js';
import { formatGolfName } from '../ui/formHelpers.js';
import { formatToPar } from '../scoring/roundSummary.js';

export async function renderScorecard(container, params, navigate) {
  const round = await getRound(params.roundId);
  const course = await getCourse(round.courseId);
  const player = await getPlayer();
  const isSimplified = player?.appMode === 'simplified';
  const editMode = params.editMode ?? false;

  const info = document.createElement('p');
  info.className = 'hint';
  const statusLabel = round.status === 'completed' ? 'Terminée' : 'En cours';
  info.textContent = `${formatGolfName(course.name)} — ${round.date} — Départ ${round.teeColor} — Course Handicap ${round.courseHandicap} — ${statusLabel}`;
  container.appendChild(info);

  if (!editMode) {
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-secondary';
    editBtn.appendChild(createIcon('edit', { size: 16 }));
    editBtn.appendChild(document.createTextNode('Modifier'));
    editBtn.addEventListener('click', () => {
      navigate('play', { roundId: round.id, holeNumber: 1, editMode: true });
    });
    container.appendChild(editBtn);
  }

  const table = document.createElement('table');
  table.className = 'scorecard-table';
  const thead = document.createElement('thead');
  thead.innerHTML = isSimplified
    ? '<tr><th>Trou</th><th>Score</th><th>Putts</th></tr>'
    : '<tr><th>Trou</th><th>Par</th><th>Score</th><th>Écart</th><th>Pts</th><th>Putts</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');

  let totalPar = 0;
  let parPlayed = 0;
  let totalGross = 0;
  let totalPoints = 0;
  let playedCount = 0;
  let puttsTotal = 0;
  let puttsPlayedCount = 0;

  course.holes.forEach((hole) => {
    const hs = round.holeScores.find((h) => h.holeNumber === hole.number);
    const row = document.createElement('tr');
    if (editMode) {
      row.className = 'clickable';
      row.addEventListener('click', () => navigate('play', { roundId: round.id, holeNumber: hole.number, editMode: true }));
    }

    let scoreCell = '—';
    let diffCell = '—';
    const ptsCell = hs.status === 'not_played' ? '—' : hs.stablefordNetPoints;
    const puttsCell = hs.status === 'played' ? (hs.putts ?? '—') : '—';

    if (hs.status === 'played' || hs.status === 'abandoned') {
      const diff = hs.grossScore - hole.par;
      scoreCell = hs.status === 'abandoned' ? 'X' : hs.grossScore;
      diffCell = formatToPar(diff);
    }

    row.innerHTML = isSimplified
      ? `<td>${hole.number}</td><td>${scoreCell}</td><td>${puttsCell}</td>`
      : `<td>${hole.number}</td><td>${hole.par}</td><td>${scoreCell}</td><td>${diffCell}</td><td>${ptsCell}</td><td>${puttsCell}</td>`;
    tbody.appendChild(row);

    totalPar += hole.par;
    if (hs.status === 'played' || hs.status === 'abandoned') {
      totalGross += hs.grossScore;
      parPlayed += hole.par;
      totalPoints += hs.stablefordNetPoints;
      playedCount += 1;
    }
    if (hs.status === 'played') {
      puttsTotal += hs.putts ?? 0;
      puttsPlayedCount += 1;
    }
  });
  table.appendChild(tbody);

  const diffTotal = playedCount > 0 ? totalGross - parPlayed : null;
  const puttsAverage = puttsPlayedCount > 0 ? (puttsTotal / puttsPlayedCount).toFixed(2) : '—';

  const tfoot = document.createElement('tfoot');
  tfoot.innerHTML = isSimplified
    ? `<tr><td>Total</td><td>${playedCount > 0 ? totalGross : '—'}</td><td>${puttsAverage}</td></tr>`
    : `<tr>
        <td>Total</td>
        <td>${totalPar}</td>
        <td>${playedCount > 0 ? totalGross : '—'}</td>
        <td>${formatToPar(diffTotal)}</td>
        <td>${totalPoints}</td>
        <td>${puttsAverage}</td>
      </tr>`;
  table.appendChild(tfoot);

  const tableScroll = document.createElement('div');
  tableScroll.className = 'table-scroll';
  tableScroll.appendChild(table);
  container.appendChild(tableScroll);

  if (!isSimplified) {
    const summary = document.createElement('p');
    summary.className = 'hint';
    const holeWord = playedCount > 1 ? 'trous joués' : 'trou joué';
    summary.textContent = `Stableford : ${totalPoints} pts sur ${playedCount} ${holeWord}`;
    container.appendChild(summary);
  }

  if (round.status !== 'completed') {
    const finishBtn = document.createElement('button');
    finishBtn.type = 'button';
    finishBtn.className = 'btn-primary';
    finishBtn.appendChild(createIcon('check', { size: 18 }));
    finishBtn.appendChild(document.createTextNode('Terminer la partie'));
    finishBtn.addEventListener('click', async () => {
      round.status = 'completed';
      await saveRound(round);
      navigate('scorecard', { roundId: round.id, editMode }, { replace: true });
    });
    container.appendChild(finishBtn);
  }
}
