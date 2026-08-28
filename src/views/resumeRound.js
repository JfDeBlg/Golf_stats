// Écran Reprendre une partie : liste de rounds filtrables par golf et par mois/année.
// Le statut listé (in_progress ou completed) est décidé par le menu selon le nombre de
// rounds en cours (cf. menu.js) et passé via params.statusFilter. Chaque ligne ouvre la
// carte de score du round (même écran que pour une partie terminée) — pas directement un trou.

import { getRounds, getCourses } from '../db/repository.js';
import { createField } from '../ui/formHelpers.js';

function matchesDateFilter(dateStr, filterValue) {
  const trimmed = filterValue.trim();
  if (!trimmed) return true;
  const match = /^(\d{2})\/(\d{2})$/.exec(trimmed);
  if (!match) return true;
  const [, mm, yy] = match;
  const d = new Date(`${dateStr}T00:00:00`);
  const roundMM = String(d.getMonth() + 1).padStart(2, '0');
  const roundYY = String(d.getFullYear()).slice(-2);
  return roundMM === mm && roundYY === yy;
}

function computeRoundSummary(round, course) {
  let grossTotal = 0;
  let parPlayed = 0;
  let pointsTotal = 0;
  let playedCount = 0;

  round.holeScores.forEach((hs) => {
    if (hs.status !== 'played' && hs.status !== 'abandoned') return;
    const hole = course?.holes.find((h) => h.number === hs.holeNumber);
    if (!hole) return;
    grossTotal += hs.grossScore;
    parPlayed += hole.par;
    pointsTotal += hs.stablefordNetPoints;
    playedCount += 1;
  });

  return {
    diff: playedCount > 0 ? grossTotal - parPlayed : null,
    pointsTotal,
    playedCount,
  };
}

function formatRoundLabel(round, course) {
  const courseName = course?.name ?? 'Golf supprimé';
  const { diff, pointsTotal, playedCount } = computeRoundSummary(round, course);
  if (diff == null) {
    return `${round.date} — ${courseName} — Aucun trou saisi`;
  }
  const diffLabel = diff > 0 ? `+${diff}` : diff === 0 ? '±0' : String(diff);
  const holeWord = playedCount > 1 ? 'trous' : 'trou';
  return `${round.date} — ${courseName} — ${diffLabel} — ${pointsTotal} pts (${playedCount} ${holeWord})`;
}

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

  const filterForm = document.createElement('div');
  filterForm.className = 'form';

  const courseFilter = document.createElement('select');
  const allOpt = document.createElement('option');
  allOpt.value = '';
  allOpt.textContent = 'Tous les golfs';
  courseFilter.appendChild(allOpt);
  courses.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    courseFilter.appendChild(opt);
  });
  filterForm.appendChild(createField('Filtrer par golf', courseFilter));

  const dateFilter = document.createElement('input');
  dateFilter.type = 'text';
  dateFilter.placeholder = 'MM/AA';
  filterForm.appendChild(createField('Filtrer par date (MM/AA)', dateFilter));

  container.appendChild(filterForm);

  const list = document.createElement('div');
  list.className = 'list-select';
  container.appendChild(list);

  function refresh() {
    list.innerHTML = '';
    const filtered = matchingStatus.filter((r) => {
      const courseOk = !courseFilter.value || r.courseId === courseFilter.value;
      return courseOk && matchesDateFilter(r.date, dateFilter.value);
    });

    if (filtered.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'Aucune partie ne correspond aux filtres.';
      list.appendChild(empty);
      return;
    }

    filtered.forEach((round) => {
      const course = courses.find((c) => c.id === round.courseId);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'list-item';
      btn.textContent = formatRoundLabel(round, course);
      btn.addEventListener('click', () => navigate('scorecard', { roundId: round.id }));
      list.appendChild(btn);
    });
  }

  courseFilter.addEventListener('change', refresh);
  dateFilter.addEventListener('input', refresh);
  refresh();
}
