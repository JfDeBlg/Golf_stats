// Écran Statistiques : moyenne de putts globale, deux graphiques (putting, score
// stableford ramené à 18 trous) sur les parties terminées, un tableau de distance
// moyenne mesurée par club, et une analyse lie/style de coup — ces deux derniers tous
// rounds confondus (y compris en cours). En mode Simplifié, seules les statistiques
// score/putts (résumé + deux graphiques) restent affichées.

import { getRounds, getClubs, getCourses, getPlayer } from '../db/repository.js';
import { buildLineChart } from '../ui/lineChart.js';
import { createField } from '../ui/formHelpers.js';
import { LIE_OPTIONS, SHAPE_OPTIONS } from '../data/shotOptions.js';

function formatShortDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function wrapScroll(table) {
  const wrap = document.createElement('div');
  wrap.className = 'table-scroll';
  wrap.appendChild(table);
  return wrap;
}

function computeClubDistanceStats(allRounds, clubs) {
  const stats = new Map();
  allRounds.forEach((round) => {
    round.holeScores.forEach((hs) => {
      (hs.shots ?? []).forEach((shot) => {
        if (!shot.isFullShot || shot.distance == null || !shot.clubId) return;
        const entry = stats.get(shot.clubId) ?? { sum: 0, count: 0 };
        entry.sum += shot.distance;
        entry.count += 1;
        stats.set(shot.clubId, entry);
      });
    });
  });

  return clubs
    .filter((c) => stats.has(c.id))
    .map((c) => {
      const { sum, count } = stats.get(c.id);
      return { club: c, avgDistance: sum / count, count };
    });
}

function buildClubDistanceSection(clubStats) {
  const section = document.createElement('div');

  const title = document.createElement('h2');
  title.textContent = 'Distance moyenne mesurée par club';
  section.appendChild(title);

  if (clubStats.length === 0) {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = "Aucune distance mesurée pour le moment (les coups pleins avec distance alimentent ce tableau).";
    section.appendChild(hint);
    return section;
  }

  const table = document.createElement('table');
  table.className = 'scorecard-table';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Club</th><th>Distance moyenne</th><th>Coups pleins</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  clubStats.forEach(({ club, avgDistance, count }) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${club.name}</td><td>${Math.round(avgDistance)} m</td><td>${count}</td>`;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  section.appendChild(wrapScroll(table));

  return section;
}

// --- Analyse lie / style de coup ---

function collectShotsWithRound(allRounds) {
  const items = [];
  allRounds.forEach((round) => {
    round.holeScores.forEach((hs) => {
      (hs.shots ?? []).forEach((shot) => items.push({ shot, round }));
    });
  });
  return items;
}

function matchesFilters(item, { courseId, year, month }) {
  if (courseId && item.round.courseId !== courseId) return false;
  if (year || month) {
    const d = new Date(`${item.round.date}T00:00:00`);
    if (year && String(d.getFullYear()).slice(-2) !== year) return false;
    if (month && String(d.getMonth() + 1).padStart(2, '0') !== month) return false;
  }
  return true;
}

function distributionTable(shots, field, options, label) {
  const counts = new Map();
  let total = 0;
  shots.forEach((shot) => {
    const value = shot[field];
    if (!value) return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
    total += 1;
  });
  if (total === 0) return null;

  const table = document.createElement('table');
  table.className = 'scorecard-table';
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr><th>${label}</th><th>Nombre</th><th>%</th></tr>`;
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  options.forEach((option) => {
    const count = counts.get(option) ?? 0;
    if (count === 0) return;
    const row = document.createElement('tr');
    const pct = Math.round((count / total) * 100);
    row.innerHTML = `<td>${option}</td><td>${count}</td><td>${pct}%</td>`;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  return table;
}

function buildLieShapeContent(shots, clubs) {
  const content = document.createElement('div');

  const globalLieTable = distributionTable(shots, 'lie', LIE_OPTIONS, 'Lie');
  const globalShapeTable = distributionTable(shots, 'shape', SHAPE_OPTIONS, 'Style');

  if (!globalLieTable && !globalShapeTable) {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Aucun coup avec lie ou style renseigné pour ces filtres.';
    content.appendChild(hint);
    return content;
  }

  if (globalLieTable) {
    const h = document.createElement('h3');
    h.textContent = 'Lie — répartition globale';
    content.appendChild(h);
    content.appendChild(wrapScroll(globalLieTable));
  }
  if (globalShapeTable) {
    const h = document.createElement('h3');
    h.textContent = 'Style de coup — répartition globale';
    content.appendChild(h);
    content.appendChild(wrapScroll(globalShapeTable));
  }

  clubs.forEach((club) => {
    const clubShots = shots.filter((s) => s.clubId === club.id);
    const lieTable = distributionTable(clubShots, 'lie', LIE_OPTIONS, 'Lie');
    const shapeTable = distributionTable(clubShots, 'shape', SHAPE_OPTIONS, 'Style');
    if (!lieTable && !shapeTable) return;
    const clubTitle = document.createElement('h3');
    clubTitle.textContent = club.name;
    content.appendChild(clubTitle);
    if (lieTable) content.appendChild(wrapScroll(lieTable));
    if (shapeTable) content.appendChild(wrapScroll(shapeTable));
  });

  return content;
}

function buildLieShapeSection(allRounds, clubs, courses) {
  const shotItems = collectShotsWithRound(allRounds);
  const hasAnyLieOrShape = shotItems.some((item) => item.shot.lie || item.shot.shape);
  if (!hasAnyLieOrShape) return null;

  const section = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = 'Analyse lie et style de coup';
  section.appendChild(title);

  const filterForm = document.createElement('div');
  filterForm.className = 'form';

  const courseFilter = document.createElement('select');
  const allCoursesOpt = document.createElement('option');
  allCoursesOpt.value = '';
  allCoursesOpt.textContent = 'Tous les golfs';
  courseFilter.appendChild(allCoursesOpt);
  courses.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    courseFilter.appendChild(opt);
  });
  filterForm.appendChild(createField('Filtrer par golf', courseFilter));

  const yearFilter = document.createElement('input');
  yearFilter.type = 'text';
  yearFilter.placeholder = 'AA';
  yearFilter.maxLength = 2;
  filterForm.appendChild(createField('Filtrer par année (AA)', yearFilter));

  const monthFilter = document.createElement('input');
  monthFilter.type = 'text';
  monthFilter.placeholder = 'MM';
  monthFilter.maxLength = 2;
  filterForm.appendChild(createField('Filtrer par mois (MM)', monthFilter));

  section.appendChild(filterForm);

  const content = document.createElement('div');
  section.appendChild(content);

  function refresh() {
    const filters = {
      courseId: courseFilter.value || null,
      year: yearFilter.value.trim() || null,
      month: monthFilter.value.trim() || null,
    };
    const filteredShots = shotItems.filter((item) => matchesFilters(item, filters)).map((item) => item.shot);
    content.innerHTML = '';
    content.appendChild(buildLieShapeContent(filteredShots, clubs));
  }

  courseFilter.addEventListener('change', refresh);
  yearFilter.addEventListener('input', refresh);
  monthFilter.addEventListener('input', refresh);
  refresh();

  return section;
}

export async function renderStats(container) {
  const [allRounds, clubs, courses, player] = await Promise.all([
    getRounds(), getClubs(), getCourses(), getPlayer(),
  ]);
  const isSimplified = player?.appMode === 'simplified';

  const completedRounds = allRounds
    .filter((r) => r.status === 'completed')
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (completedRounds.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'Aucune partie terminée pour le moment.';
    container.appendChild(empty);
  } else {
    let totalPuttsAll = 0;
    let totalPlayedHolesAll = 0;
    const puttsPoints = [];
    const stableford18Points = [];

    completedRounds.forEach((round) => {
      const playedHoles = round.holeScores.filter((h) => h.status === 'played');
      const playedOrAbandoned = round.holeScores.filter((h) => h.status === 'played' || h.status === 'abandoned');
      const label = formatShortDate(round.date);

      const roundPutts = playedHoles.reduce((s, h) => s + (h.putts ?? 0), 0);
      totalPuttsAll += roundPutts;
      totalPlayedHolesAll += playedHoles.length;
      if (playedHoles.length > 0) {
        puttsPoints.push({ label, value: Number((roundPutts / playedHoles.length).toFixed(2)) });
      }

      const roundPoints = round.holeScores.reduce((s, h) => s + (h.stablefordNetPoints ?? 0), 0);
      if (playedOrAbandoned.length > 0) {
        const points18 = roundPoints * (18 / playedOrAbandoned.length);
        stableford18Points.push({ label, value: Number(points18.toFixed(1)) });
      }
    });

    const globalAvgPutts = totalPlayedHolesAll > 0 ? (totalPuttsAll / totalPlayedHolesAll).toFixed(2) : '—';

    const summary = document.createElement('p');
    summary.className = 'hint';
    summary.textContent = `Moyenne de putts (toutes parties) : ${globalAvgPutts}`;
    container.appendChild(summary);

    const puttsTitle = document.createElement('h2');
    puttsTitle.textContent = 'Putting — moyenne par partie';
    container.appendChild(puttsTitle);
    container.appendChild(buildLineChart(puttsPoints));

    const stablefordTitle = document.createElement('h2');
    stablefordTitle.textContent = 'Score stableford — ramené à 18 trous';
    container.appendChild(stablefordTitle);
    container.appendChild(buildLineChart(stableford18Points));
  }

  if (!isSimplified) {
    container.appendChild(buildClubDistanceSection(computeClubDistanceStats(allRounds, clubs)));

    const lieShapeSection = buildLieShapeSection(allRounds, clubs, courses);
    if (lieShapeSection) container.appendChild(lieShapeSection);
  }
}
