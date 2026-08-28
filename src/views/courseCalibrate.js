// Écran Calibrer avec le GPS : golf par golf, trou par trou, enregistre les positions
// réelles de chaque départ et du green via un ping GPS ponctuel. Réutilise la navigation
// circulaire de l'écran de jeu. Indépendant des données saisies à la main (par, SI,
// distance, slope/SSS), qui restent éditables séparément via "Modifier parcours".
//
// Provenance de Course.source : "calibrated" ne se déclenche que via une capture manuelle
// sur place (captureTee/captureGreen) qui complète les 18 trous ; un préremplissage OSM
// (recherche directe ou par adresse) marque "osm_prefilled" — jamais "calibrated" — tant
// qu'une calibration manuelle sur le terrain ne l'a pas confirmé.

import { getCourses, getCourse, saveCourse } from '../db/repository.js';
import { getCurrentPositionOnce } from '../geo/geolocation.js';
import { prefillFromOpenStreetMap, prefillFromCoordinates, findGolfCoursesByAddress } from '../geo/openStreetMap.js';
import { deriveCourseSource, isCourseFullyCalibrated } from '../scoring/calibration.js';
import { createIcon } from '../ui/icons.js';
import { createField } from '../ui/formHelpers.js';

function nextHoleNumber(n) {
  return n >= 18 ? 1 : n + 1;
}

function prevHoleNumber(n) {
  return n <= 1 ? 18 : n - 1;
}

function isHoleComplete(hole, tees) {
  if (tees.length === 0) return false;
  return tees.every((t) => Boolean(hole.teePositions?.[t.color])) && Boolean(hole.greenPosition);
}

export async function renderCourseCalibrate(container, params, navigate) {
  const courses = await getCourses();

  if (courses.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'Aucun golf enregistré.';
    container.appendChild(empty);
    return;
  }

  if (!params.courseId) {
    const list = document.createElement('div');
    list.className = 'list-select';
    courses.forEach((course) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'list-item';
      btn.textContent = course.name;
      btn.addEventListener('click', () => navigate('courseCalibrate', { courseId: course.id, holeNumber: 1 }, { replace: true }));
      list.appendChild(btn);
    });
    container.appendChild(list);
    return;
  }

  const course = await getCourse(params.courseId);
  const holeNumber = params.holeNumber ?? 1;
  const hole = course.holes.find((h) => h.number === holeNumber);
  const tees = course.recommendedTees ?? [];

  // Utilisée par les captures manuelles (captureTee/captureGreen) : source ne bascule vers
  // "calibrated" que via ce chemin, une fois les 18 trous complets.
  async function persist() {
    course.source = deriveCourseSource(course, course.source);
    await saveCourse(course);
  }

  async function refresh() {
    await persist();
    navigate('courseCalibrate', { courseId: course.id, holeNumber }, { replace: true });
  }

  async function goToHole(n) {
    await persist();
    navigate('courseCalibrate', { courseId: course.id, holeNumber: n }, { replace: true });
  }

  // Applique les repères trouvés (OSM, recherche directe ou par adresse) aux trous sans
  // écraser les positions déjà connues. Ne marque jamais "calibrated" — seulement
  // "osm_prefilled" si le golf n'est pas déjà validé sur le terrain.
  function applyMatches(matches) {
    let filled = 0;
    course.holes.forEach((h) => {
      const match = matches[h.number];
      if (!match) return;
      if (match.tee) {
        h.teePositions = h.teePositions ?? {};
        tees.forEach((t) => {
          if (!h.teePositions[t.color]) {
            h.teePositions[t.color] = match.tee;
            filled += 1;
          }
        });
      }
      if (match.green && !h.greenPosition) {
        h.greenPosition = match.green;
        filled += 1;
      }
    });
    if (filled > 0 && course.source !== 'calibrated') {
      course.source = 'osm_prefilled';
    }
    return filled;
  }

  // --- Amorce optionnelle via OpenStreetMap ---
  const osmSection = document.createElement('section');
  osmSection.className = 'card';

  const osmTitle = document.createElement('h2');
  osmTitle.textContent = 'Préremplir via OpenStreetMap';
  osmSection.appendChild(osmTitle);

  const osmForm = document.createElement('div');
  osmForm.className = 'form';

  const osmInput = document.createElement('input');
  osmInput.type = 'text';
  osmInput.placeholder = 'Ville, nom du golf, ou "lat,lng"';
  osmInput.value = course.location || course.name || '';
  osmForm.appendChild(createField('Lieu approximatif', osmInput));

  const osmBtn = document.createElement('button');
  osmBtn.type = 'button';
  osmBtn.className = 'btn-secondary';
  osmBtn.textContent = 'Rechercher sur OpenStreetMap';
  osmForm.appendChild(osmBtn);

  const osmStatus = document.createElement('p');
  if (params.osmMessage) {
    osmStatus.className = 'status-msg';
    osmStatus.textContent = params.osmMessage;
  } else {
    osmStatus.className = 'hint';
  }
  osmForm.appendChild(osmStatus);

  // --- Repli : recherche par adresse (visible seulement après un échec de la recherche
  // directe ci-dessus) ---
  const addressSection = document.createElement('div');
  addressSection.className = 'form';
  addressSection.hidden = true;

  const addressIntro = document.createElement('p');
  addressIntro.className = 'hint';
  addressIntro.textContent = "Rien trouvé directement — essayez avec l'adresse du golf.";
  addressSection.appendChild(addressIntro);

  const addressInput = document.createElement('input');
  addressInput.type = 'text';
  addressInput.placeholder = 'Adresse du golf';
  addressSection.appendChild(createField('Adresse du golf', addressInput));

  const addressBtn = document.createElement('button');
  addressBtn.type = 'button';
  addressBtn.className = 'btn-secondary';
  addressBtn.textContent = 'Rechercher par adresse';
  addressSection.appendChild(addressBtn);

  const addressStatus = document.createElement('p');
  addressStatus.className = 'hint';
  addressSection.appendChild(addressStatus);

  const courseChoiceList = document.createElement('div');
  courseChoiceList.className = 'list-select';
  addressSection.appendChild(courseChoiceList);

  osmForm.appendChild(addressSection);
  osmSection.appendChild(osmForm);
  container.appendChild(osmSection);

  function showOsmSuccess(filled, sourceLabel) {
    const holeWord = filled > 1 ? 'repères préremplis' : 'repère prérempli';
    navigate('courseCalibrate', {
      courseId: course.id,
      holeNumber,
      osmMessage: `${filled} ${holeWord} à partir d'OpenStreetMap${sourceLabel ? ` (${sourceLabel})` : ''} — à vérifier/corriger sur place.`,
    }, { replace: true });
  }

  osmBtn.addEventListener('click', async () => {
    osmStatus.className = 'hint';
    osmStatus.textContent = 'Recherche en cours…';
    addressSection.hidden = true;
    osmBtn.disabled = true;
    try {
      const { matches } = await prefillFromOpenStreetMap(osmInput.value);
      const filled = applyMatches(matches);
      if (filled === 0) {
        osmStatus.textContent = 'Aucune donnée OpenStreetMap disponible directement — essayez une adresse ci-dessous, ou calibrez manuellement.';
        addressSection.hidden = false;
        osmBtn.disabled = false;
      } else {
        await saveCourse(course);
        showOsmSuccess(filled, null);
      }
    } catch (err) {
      osmStatus.className = 'error-msg';
      osmStatus.textContent = `Aucune donnée OpenStreetMap disponible (${err.message}) — essayez une adresse ci-dessous, ou calibrez manuellement.`;
      addressSection.hidden = false;
      osmBtn.disabled = false;
    }
  });

  async function applyGolfCourseSelection(selected) {
    addressStatus.className = 'hint';
    addressStatus.textContent = `Recherche des repères pour ${selected.name}…`;
    courseChoiceList.innerHTML = '';
    try {
      const { matches } = await prefillFromCoordinates(selected.position);
      const filled = applyMatches(matches);
      if (filled === 0) {
        addressStatus.className = 'error-msg';
        addressStatus.textContent = 'Pas de repères détaillés disponibles, calibration manuelle nécessaire.';
        return;
      }
      await saveCourse(course);
      showOsmSuccess(filled, selected.name);
    } catch (err) {
      addressStatus.className = 'error-msg';
      addressStatus.textContent = err.message;
    }
  }

  addressBtn.addEventListener('click', async () => {
    addressStatus.className = 'hint';
    addressStatus.textContent = 'Recherche en cours…';
    courseChoiceList.innerHTML = '';
    addressBtn.disabled = true;
    try {
      const { courses: foundCourses } = await findGolfCoursesByAddress(addressInput.value);
      addressBtn.disabled = false;
      if (foundCourses.length === 0) {
        addressStatus.className = 'error-msg';
        addressStatus.textContent = 'Aucun parcours OpenStreetMap trouvé à proximité de cette adresse.';
        return;
      }
      if (foundCourses.length === 1) {
        await applyGolfCourseSelection(foundCourses[0]);
        return;
      }
      addressStatus.className = 'hint';
      addressStatus.textContent = 'Plusieurs parcours trouvés à proximité — sélectionnez le bon :';
      foundCourses.forEach((c) => {
        const choiceBtn = document.createElement('button');
        choiceBtn.type = 'button';
        choiceBtn.className = 'list-item';
        choiceBtn.textContent = `${c.name} (à ${c.distance} m)`;
        choiceBtn.addEventListener('click', () => applyGolfCourseSelection(c));
        courseChoiceList.appendChild(choiceBtn);
      });
    } catch (err) {
      addressBtn.disabled = false;
      addressStatus.className = 'error-msg';
      addressStatus.textContent = err.message;
    }
  });

  // --- Calibration trou par trou ---
  const wrapper = document.createElement('div');
  wrapper.className = 'play-view';

  const header = document.createElement('div');
  header.className = 'play-header';
  const headerTitle = document.createElement('h2');
  headerTitle.textContent = `Trou ${holeNumber}`;
  header.appendChild(headerTitle);

  const statusLine = document.createElement('p');
  statusLine.className = 'hint';
  header.appendChild(statusLine);
  wrapper.appendChild(header);

  if (isHoleComplete(hole, tees)) {
    statusLine.appendChild(createIcon('check', { size: 16 }));
    statusLine.appendChild(document.createTextNode(' Trou calibré'));
  } else {
    statusLine.textContent = 'Calibration incomplète pour ce trou.';
  }

  if (tees.length === 0) {
    const noTeeHint = document.createElement('p');
    noTeeHint.className = 'error-msg';
    noTeeHint.textContent = "Aucun départ déclaré pour ce golf — ajoutez-en un via \"Modifier parcours\" avant de calibrer.";
    wrapper.appendChild(noTeeHint);
  }

  const actionStatus = document.createElement('p');
  actionStatus.className = 'hint';

  async function captureTee(color) {
    actionStatus.className = 'hint';
    actionStatus.textContent = `Localisation du départ ${color} en cours…`;
    try {
      const position = await getCurrentPositionOnce();
      hole.teePositions = hole.teePositions ?? {};
      hole.teePositions[color] = position;
      await refresh();
    } catch (err) {
      actionStatus.className = 'error-msg';
      actionStatus.textContent = err.message;
    }
  }

  async function captureGreen() {
    actionStatus.className = 'hint';
    actionStatus.textContent = 'Localisation du green en cours…';
    try {
      const position = await getCurrentPositionOnce();
      hole.greenPosition = position;
      await refresh();
    } catch (err) {
      actionStatus.className = 'error-msg';
      actionStatus.textContent = err.message;
    }
  }

  tees.forEach((tee) => {
    const teeBtn = document.createElement('button');
    teeBtn.type = 'button';
    teeBtn.className = 'btn-secondary';
    const done = Boolean(hole.teePositions?.[tee.color]);
    if (done) teeBtn.appendChild(createIcon('check', { size: 16 }));
    teeBtn.appendChild(document.createTextNode(`Enregistrer le départ ${tee.color}`));
    teeBtn.addEventListener('click', () => captureTee(tee.color));
    wrapper.appendChild(teeBtn);
  });

  const greenBtn = document.createElement('button');
  greenBtn.type = 'button';
  greenBtn.className = 'btn-secondary';
  if (hole.greenPosition) greenBtn.appendChild(createIcon('check', { size: 16 }));
  greenBtn.appendChild(document.createTextNode('Enregistrer le green'));
  greenBtn.addEventListener('click', captureGreen);
  wrapper.appendChild(greenBtn);

  wrapper.appendChild(actionStatus);

  const navRow = document.createElement('div');
  navRow.className = 'hole-nav';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'btn-secondary';
  prevBtn.appendChild(createIcon('arrowLeft', { size: 16 }));
  prevBtn.appendChild(document.createTextNode('Précédent'));
  prevBtn.addEventListener('click', () => goToHole(prevHoleNumber(holeNumber)));

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'btn-secondary';
  nextBtn.appendChild(document.createTextNode('Suivant'));
  nextBtn.appendChild(createIcon('arrowRight', { size: 16 }));
  nextBtn.addEventListener('click', () => goToHole(nextHoleNumber(holeNumber)));

  navRow.appendChild(prevBtn);
  navRow.appendChild(nextBtn);
  wrapper.appendChild(navRow);

  if (isCourseFullyCalibrated(course)) {
    const doneHint = document.createElement('p');
    doneHint.className = 'status-msg';
    doneHint.textContent = 'Les 18 trous sont calibrés (départs + green).';
    wrapper.appendChild(doneHint);
  }

  container.appendChild(wrapper);
}
