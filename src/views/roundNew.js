// Écran Nouvelle partie : sélection du golf/départ, trou de départ, météo optionnelle,
// et démarrage de la saisie trou par trou.

import { getCourses, getPlayer, saveRound, generateId } from '../db/repository.js';
import { computeCourseHandicap } from '../scoring/handicap.js';
import { haversineDistance } from '../scoring/distance.js';
import { computeCourseReferencePoint } from '../scoring/calibration.js';
import { getCurrentPositionOnce } from '../geo/geolocation.js';
import { createField } from '../ui/formHelpers.js';
import { createHelpButton } from '../ui/helpOverlay.js';

const WIND_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
const LOCATE_RADIUS_M = 2000;

const ROUND_NEW_HELP_TEXT = [
  "\"Localiser mon golf\" fait un ping GPS ponctuel et propose le golf calibré le plus proche : la sélection manuelle du golf et du départ reste toujours disponible juste en dessous.",
  'Le trou de départ (1 ou 10) se choisit toujours à la main — jamais déduit automatiquement de la position, pour éviter toute erreur silencieuse en début de partie.',
  "La météo est entièrement optionnelle et n'empêche pas de démarrer la partie.",
];

export async function renderRoundNew(container, params, navigate) {
  const headerRow = document.createElement('div');
  headerRow.className = 'screen-header-row';
  headerRow.appendChild(createHelpButton(ROUND_NEW_HELP_TEXT));
  container.appendChild(headerRow);

  const courses = await getCourses();
  if (courses.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'Créez un golf avant de démarrer une partie.';
    container.appendChild(empty);
    return;
  }

  const player = await getPlayer();

  const form = document.createElement('form');
  form.className = 'form';

  const locateBtn = document.createElement('button');
  locateBtn.type = 'button';
  locateBtn.className = 'btn-secondary';
  locateBtn.textContent = 'Localiser mon golf';
  form.appendChild(locateBtn);

  const locateStatus = document.createElement('p');
  locateStatus.className = 'hint';
  form.appendChild(locateStatus);

  const courseSelect = document.createElement('select');
  courses.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    courseSelect.appendChild(opt);
  });
  form.appendChild(createField('Golf (sélection manuelle toujours disponible)', courseSelect));

  const teeSelect = document.createElement('select');
  form.appendChild(createField('Départ', teeSelect));

  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.value = new Date().toISOString().slice(0, 10);
  form.appendChild(createField('Date', dateInput));

  const startHoleInput = document.createElement('input');
  startHoleInput.type = 'number';
  startHoleInput.min = '1';
  startHoleInput.max = '18';
  startHoleInput.value = '1';
  form.appendChild(createField('Trou de départ', startHoleInput));

  const indexInput = document.createElement('input');
  indexInput.type = 'number';
  indexInput.step = '0.1';
  indexInput.value = player?.handicapIndex ?? 0;
  form.appendChild(createField('Index de handicap', indexInput));

  const preview = document.createElement('p');
  preview.className = 'course-handicap-preview';
  form.appendChild(preview);

  const weatherTitle = document.createElement('h3');
  weatherTitle.textContent = 'Météo (optionnel)';
  form.appendChild(weatherTitle);

  const rainInput = document.createElement('input');
  rainInput.type = 'checkbox';
  form.appendChild(createField('Pluie', rainInput));

  const windDirectionSelect = document.createElement('select');
  const noWindOpt = document.createElement('option');
  noWindOpt.value = '';
  noWindOpt.textContent = '—';
  windDirectionSelect.appendChild(noWindOpt);
  WIND_DIRECTIONS.forEach((dir) => {
    const opt = document.createElement('option');
    opt.value = dir;
    opt.textContent = dir;
    windDirectionSelect.appendChild(opt);
  });
  form.appendChild(createField('Direction du vent', windDirectionSelect));

  const windForceInput = document.createElement('input');
  windForceInput.type = 'number';
  windForceInput.min = '1';
  windForceInput.max = '12';
  form.appendChild(createField('Force du vent (Beaufort, 1-12)', windForceInput));

  function currentCourse() {
    return courses.find((c) => c.id === courseSelect.value);
  }

  function refreshTees() {
    const course = currentCourse();
    teeSelect.innerHTML = '';
    (course.recommendedTees ?? []).forEach((tee, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `${tee.color} (slope ${tee.slope}, SSS ${tee.sss})`;
      teeSelect.appendChild(opt);
    });
    updatePreview();
  }

  function updatePreview() {
    const course = currentCourse();
    const tee = course.recommendedTees?.[parseInt(teeSelect.value, 10) || 0];
    if (!tee) {
      preview.textContent = '';
      return;
    }
    const totalPar = course.holes.reduce((sum, h) => sum + h.par, 0);
    const index = parseFloat(indexInput.value) || 0;
    const ch = computeCourseHandicap(index, tee.slope, tee.sss, totalPar);
    preview.textContent = `Course Handicap : ${ch}`;
  }

  courseSelect.addEventListener('change', refreshTees);
  teeSelect.addEventListener('change', updatePreview);
  indexInput.addEventListener('input', updatePreview);
  refreshTees();

  locateBtn.addEventListener('click', async () => {
    locateStatus.className = 'hint';
    locateStatus.textContent = 'Localisation en cours…';
    try {
      const position = await getCurrentPositionOnce();
      let nearest = null;
      let nearestDist = Infinity;
      courses.forEach((c) => {
        const ref = computeCourseReferencePoint(c);
        if (!ref) return;
        const dist = haversineDistance(position, ref);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = c;
        }
      });
      if (nearest && nearestDist <= LOCATE_RADIUS_M) {
        courseSelect.value = nearest.id;
        refreshTees();
        locateStatus.className = 'status-msg';
        locateStatus.textContent = `Golf trouvé : ${nearest.name} (à ${Math.round(nearestDist)} m).`;
      } else {
        locateStatus.textContent = 'Aucun golf calibré à proximité — sélectionnez-le manuellement.';
      }
    } catch (err) {
      locateStatus.className = 'error-msg';
      locateStatus.textContent = err.message;
    }
  });

  const errorEl = document.createElement('p');
  errorEl.className = 'error-msg';

  const startBtn = document.createElement('button');
  startBtn.type = 'submit';
  startBtn.className = 'btn-primary';
  startBtn.textContent = 'Démarrer la partie';
  form.appendChild(startBtn);
  form.appendChild(errorEl);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const course = currentCourse();
    const tee = course.recommendedTees?.[parseInt(teeSelect.value, 10) || 0];
    if (!tee) {
      errorEl.textContent = 'Ce golf ne possède aucun départ configuré.';
      return;
    }
    const totalPar = course.holes.reduce((sum, h) => sum + h.par, 0);
    const handicapIndexAtPlay = parseFloat(indexInput.value) || 0;
    const courseHandicap = computeCourseHandicap(handicapIndexAtPlay, tee.slope, tee.sss, totalPar);
    const startHole = parseInt(startHoleInput.value, 10) || 1;

    const round = {
      id: generateId('round'),
      date: dateInput.value,
      courseId: course.id,
      teeColor: tee.color,
      handicapIndexAtPlay,
      courseHandicap,
      startHole,
      status: 'in_progress',
      weather: {
        rain: rainInput.checked,
        windDirection: windDirectionSelect.value || null,
        windForce: windForceInput.value === '' ? null : parseInt(windForceInput.value, 10),
      },
      holeScores: course.holes.map((h) => ({
        holeNumber: h.number,
        status: 'not_played',
        grossScore: null,
        putts: null,
        stablefordNetPoints: 0,
        shots: [],
      })),
    };
    await saveRound(round);
    navigate('play', { roundId: round.id, holeNumber: startHole }, { replace: true });
  });

  container.appendChild(form);
}
