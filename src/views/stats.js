// Écran Statistiques : moyenne de putts globale, % en régulation sur green (GIR), deux
// graphiques (putting, score stableford ramené à 18 trous), un graphique à barres de
// distribution des scores par rapport au par, un tableau de distance moyenne par club, et
// des analyses lie/style/contact de coup. Filtres Golf/Année/Mois en haut de l'écran
// (s'appliquent à tout) ; le filtre Club est positionné plus bas, juste au-dessus des
// seules sections qu'il affecte réellement (`filterBar.clubFilterElement`, retourné
// séparément par `src/ui/filters.js` pour ne pas être rendu avec le reste de la barre de
// filtres) :
//   - Moyenne de putts, % GIR, les deux graphiques et la distribution des scores :
//     Golf/Année/Mois uniquement (rien de tout ça n'est rattaché à un club unique ; les
//     lignes objectif restent affichées quel que soit le filtre).
//   - Distance par club et analyses lie/style/contact : Golf/Année/Mois + Club.
// % GIR et Contact n'apparaissent que si au moins une donnée correspondante a déjà été
// renseignée (même règle que lie/style, déjà en place).
// En mode Simplifié, seules les statistiques score/putts restent affichées (pas de filtre
// Club, les sections club/coup étant elles-mêmes masquées).

import { getRounds, getClubs, getCourses, getPlayer } from '../db/repository.js';
import { buildLineChart } from '../ui/lineChart.js';
import { buildBarChart } from '../ui/barChart.js';
import { buildFilterBar, roundMatchesFilters } from '../ui/filters.js';
import { createHelpButton } from '../ui/helpOverlay.js';
import { LIE_OPTIONS, SHAPE_OPTIONS, CONTACT_OPTIONS } from '../data/shotOptions.js';

const STATS_HELP_TEXT = [
  'Les filtres Golf/Année/Mois/Club en haut de l\'écran sont partagés par toutes les sections ci-dessous, mais chacune n\'applique que les filtres qui la concernent.',
  'La moyenne de putts, le % en régulation sur green, les deux graphiques et la distribution des scores ignorent le filtre Club (aucun de ces éléments n\'est rattaché à un club unique) ; les lignes pointillées sont vos objectifs (2 putts/trou, 36 points).',
  'Le tableau de distance et les analyses lie/style/contact tiennent compte de tous les filtres, y compris Club.',
  'Ces sections (contact, % GIR, distribution des scores) n\'apparaissent que si vous avez déjà renseigné au moins une donnée correspondante.',
];

// --- Distribution des scores par rapport au par ---

const SCORE_DISTRIBUTION_CATEGORIES = [
  { label: 'Eagle', test: (d) => d <= -2 },
  { label: 'Birdie', test: (d) => d === -1 },
  { label: 'Par', test: (d) => d === 0 },
  { label: 'Bogey', test: (d) => d === 1 },
  { label: 'Double', test: (d) => d === 2 },
  { label: 'Triple ou plus', test: (d) => d >= 3 },
];

// Un trou "abandoned" a un écart forfaitaire de +3 (cf. play.js), donc tombe déjà
// naturellement dans "Triple ou plus" via la même formule écart = brut - par.
function computeScoreDistribution(completedRounds, courseById) {
  const counts = SCORE_DISTRIBUTION_CATEGORIES.map(() => 0);
  completedRounds.forEach((round) => {
    const course = courseById.get(round.courseId);
    if (!course) return;
    round.holeScores.forEach((hs) => {
      if (hs.status !== 'played' && hs.status !== 'abandoned') return;
      const hole = course.holes.find((h) => h.number === hs.holeNumber);
      if (!hole) return;
      const diff = hs.grossScore - hole.par;
      const idx = SCORE_DISTRIBUTION_CATEGORIES.findIndex((c) => c.test(diff));
      if (idx >= 0) counts[idx] += 1;
    });
  });
  return SCORE_DISTRIBUTION_CATEGORIES.map((c, i) => ({ label: c.label, value: counts[i] }));
}

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

// --- Distance moyenne par club ---

function computeClubDistanceStats(rounds, clubs, clubFilterId) {
  const stats = new Map();
  rounds.forEach((round) => {
    round.holeScores.forEach((hs) => {
      (hs.shots ?? []).forEach((shot) => {
        if (!shot.isFullShot || shot.distance == null || !shot.clubId) return;
        if (clubFilterId && shot.clubId !== clubFilterId) return;
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
    hint.textContent = "Aucune distance mesurée pour ces filtres (les coups pleins avec distance alimentent ce tableau).";
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

function collectShotsWithRound(rounds) {
  const items = [];
  rounds.forEach((round) => {
    round.holeScores.forEach((hs) => {
      (hs.shots ?? []).forEach((shot) => items.push({ shot, round }));
    });
  });
  return items;
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
    h.textContent = 'Lie — répartition';
    content.appendChild(h);
    content.appendChild(wrapScroll(globalLieTable));
  }
  if (globalShapeTable) {
    const h = document.createElement('h3');
    h.textContent = 'Style de coup — répartition';
    content.appendChild(h);
    content.appendChild(wrapScroll(globalShapeTable));
  }

  // Le détail par club est redondant si un club précis est déjà sélectionné dans le
  // filtre (les tables ci-dessus ne représentent alors déjà que ce club) : `clubs` est
  // vide dans ce cas.
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

// hasAnyLieOrShapeEver : calculé sur l'ensemble des rounds (non filtré) — la section ne
// s'affiche pas du tout tant que la fonctionnalité n'a jamais été utilisée, cohérent avec
// la règle déjà en place "si un club n'a pas été renseigné, ne rien figurer". Une fois
// affichée, elle reste visible même si les filtres courants ne matchent aucun coup (un
// message l'indique alors, plutôt que de faire disparaître la section).
function buildLieShapeSection(filteredRounds, clubs, clubFilterId, hasAnyLieOrShapeEver) {
  if (!hasAnyLieOrShapeEver) return null;

  let shots = collectShotsWithRound(filteredRounds).map((item) => item.shot);
  if (clubFilterId) shots = shots.filter((s) => s.clubId === clubFilterId);

  const section = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = 'Analyse lie et style de coup';
  section.appendChild(title);
  section.appendChild(buildLieShapeContent(shots, clubFilterId ? [] : clubs));
  return section;
}

// --- Contact ---

// hasAnyContactEver : même règle que hasAnyLieOrShapeEver — section absente tant que le
// champ n'a jamais été renseigné, même filtres (Golf/Année/Mois/Club) que lie/style.
function buildContactSection(filteredRounds, clubFilterId, hasAnyContactEver) {
  if (!hasAnyContactEver) return null;

  let shots = collectShotsWithRound(filteredRounds).map((item) => item.shot);
  if (clubFilterId) shots = shots.filter((s) => s.clubId === clubFilterId);

  const section = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = 'Contact';
  section.appendChild(title);

  const table = distributionTable(shots, 'contact', CONTACT_OPTIONS, 'Contact');
  if (!table) {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Aucun coup avec contact renseigné pour ces filtres.';
    section.appendChild(hint);
    return section;
  }
  section.appendChild(wrapScroll(table));
  return section;
}

// --- Rendu ---

function renderFilteredContent(container, allRounds, clubs, courseById, isSimplified, filters, hasAnyLieOrShapeEver, hasAnyContactEver, hasAnyGirEver, clubFilterElement) {
  const roundsMatchingFilters = allRounds.filter((r) => roundMatchesFilters(r, filters));

  const completedRounds = roundsMatchingFilters
    .filter((r) => r.status === 'completed')
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (completedRounds.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'Aucune partie terminée pour ces filtres.';
    container.appendChild(empty);
  } else {
    let totalPuttsAll = 0;
    let totalPlayedHolesAll = 0;
    let totalGirHits = 0;
    const puttsPoints = [];
    const stableford18Points = [];

    completedRounds.forEach((round) => {
      const playedHoles = round.holeScores.filter((h) => h.status === 'played');
      const playedOrAbandoned = round.holeScores.filter((h) => h.status === 'played' || h.status === 'abandoned');
      const label = formatShortDate(round.date);

      const roundPutts = playedHoles.reduce((s, h) => s + (h.putts ?? 0), 0);
      totalPuttsAll += roundPutts;
      totalPlayedHolesAll += playedHoles.length;
      totalGirHits += playedHoles.filter((h) => h.girHit === true).length;
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
    summary.textContent = `Moyenne de putts (parties filtrées) : ${globalAvgPutts}`;
    container.appendChild(summary);

    if (hasAnyGirEver) {
      const girPct = totalPlayedHolesAll > 0 ? Math.round((totalGirHits / totalPlayedHolesAll) * 100) : null;
      const girSummary = document.createElement('p');
      girSummary.className = 'hint';
      girSummary.textContent = `En régulation sur green (parties filtrées) : ${girPct != null ? `${girPct}%` : '—'}`;
      container.appendChild(girSummary);
    }

    const puttsTitle = document.createElement('h2');
    puttsTitle.textContent = 'Putting — moyenne par partie';
    container.appendChild(puttsTitle);
    container.appendChild(buildLineChart(puttsPoints, { target: 2, targetLabel: 'Objectif : 2 putts/trou' }));

    const stablefordTitle = document.createElement('h2');
    stablefordTitle.textContent = 'Score stableford — ramené à 18 trous';
    container.appendChild(stablefordTitle);
    container.appendChild(buildLineChart(stableford18Points, { target: 36, targetLabel: 'Objectif : 36 pts' }));

    const distributionTitle = document.createElement('h2');
    distributionTitle.textContent = 'Distribution des scores par rapport au par';
    container.appendChild(distributionTitle);
    container.appendChild(buildBarChart(computeScoreDistribution(completedRounds, courseById)));
  }

  if (!isSimplified) {
    if (clubFilterElement) container.appendChild(clubFilterElement);
    container.appendChild(buildClubDistanceSection(computeClubDistanceStats(roundsMatchingFilters, clubs, filters.clubId)));
    const lieShapeSection = buildLieShapeSection(roundsMatchingFilters, clubs, filters.clubId, hasAnyLieOrShapeEver);
    if (lieShapeSection) container.appendChild(lieShapeSection);
    const contactSection = buildContactSection(roundsMatchingFilters, filters.clubId, hasAnyContactEver);
    if (contactSection) container.appendChild(contactSection);
  }
}

export async function renderStats(container) {
  const headerRow = document.createElement('div');
  headerRow.className = 'screen-header-row';
  headerRow.appendChild(createHelpButton(STATS_HELP_TEXT));
  container.appendChild(headerRow);

  const [allRounds, clubs, courses, player] = await Promise.all([
    getRounds(), getClubs(), getCourses(), getPlayer(),
  ]);
  const isSimplified = player?.appMode === 'simplified';
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const hasAnyLieOrShapeEver = collectShotsWithRound(allRounds).some((item) => item.shot.lie || item.shot.shape);
  const hasAnyContactEver = collectShotsWithRound(allRounds).some((item) => item.shot.contact);
  const hasAnyGirEver = allRounds.some((r) => r.holeScores.some((hs) => hs.girHit === true));

  const filterBar = buildFilterBar({ courses, clubs: isSimplified ? null : clubs }, refresh);
  container.appendChild(filterBar.element);

  const content = document.createElement('div');
  container.appendChild(content);

  function refresh() {
    const filters = filterBar.getFilters();
    content.innerHTML = '';
    renderFilteredContent(
      content, allRounds, clubs, courseById, isSimplified, filters,
      hasAnyLieOrShapeEver, hasAnyContactEver, hasAnyGirEver, filterBar.clubFilterElement
    );
  }

  refresh();
}
