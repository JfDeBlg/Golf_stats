// Construction du formulaire de golf (18 trous + départ), partagée entre
// les écrans Nouveau parcours et Modifier parcours.
//
// getData() renvoie un seul départ (`tee`) et, par trou, une distance brute (`distance`) :
// la fusion avec les autres départs déjà calibrés (recommendedTees / distanceByTee) est
// à la charge de l'appelant (courseNew.js / courseEdit.js), qui seul connaît l'état existant.

import { computeCourseHandicap } from '../scoring/handicap.js';
import { getPlayer, getCourses, saveCourse } from '../db/repository.js';
import { createField } from '../ui/formHelpers.js';

export async function buildCourseForm(initialCourse = null) {
  const [player, existingCourses] = await Promise.all([getPlayer(), getCourses()]);
  const defaultIndex = player?.handicapIndex ?? 0;

  const form = document.createElement('form');
  form.className = 'form course-form';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.setAttribute('list', 'course-name-list');
  nameInput.value = initialCourse?.name ?? '';
  nameInput.required = true;
  form.appendChild(createField('Nom du golf', nameInput));

  const datalist = document.createElement('datalist');
  datalist.id = 'course-name-list';
  existingCourses.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.name;
    datalist.appendChild(opt);
  });
  form.appendChild(datalist);

  const locationInput = document.createElement('input');
  locationInput.type = 'text';
  locationInput.value = initialCourse?.location ?? '';
  form.appendChild(createField('Lieu (optionnel)', locationInput));

  const existingTee = initialCourse?.recommendedTees?.[0];

  const teeColorInput = document.createElement('input');
  teeColorInput.type = 'text';
  teeColorInput.value = existingTee?.color ?? '';
  teeColorInput.required = true;
  form.appendChild(createField('Couleur de départ jouée', teeColorInput));

  const slopeInput = document.createElement('input');
  slopeInput.type = 'number';
  slopeInput.min = '55';
  slopeInput.max = '155';
  slopeInput.value = existingTee?.slope ?? 113;
  slopeInput.required = true;
  form.appendChild(createField('Slope', slopeInput));

  const sssInput = document.createElement('input');
  sssInput.type = 'number';
  sssInput.step = '0.1';
  sssInput.value = existingTee?.sss ?? '';
  sssInput.required = true;
  form.appendChild(createField('SSS', sssInput));

  const indexInput = document.createElement('input');
  indexInput.type = 'number';
  indexInput.step = '0.1';
  indexInput.value = defaultIndex;
  form.appendChild(createField('Index de handicap (pour aperçu)', indexInput));

  const table = document.createElement('table');
  table.className = 'holes-table';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Trou</th><th>Par</th><th>Index (SI)</th><th>Distance (m)</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);

  const holeInputs = [];
  for (let i = 1; i <= 18; i += 1) {
    const existingHole = initialCourse?.holes?.find((h) => h.number === i);
    const row = document.createElement('tr');

    const numCell = document.createElement('td');
    numCell.textContent = String(i);
    row.appendChild(numCell);

    const parCell = document.createElement('td');
    const parInput = document.createElement('input');
    parInput.type = 'number';
    parInput.min = '3';
    parInput.max = '6';
    parInput.value = existingHole?.par ?? 4;
    parInput.required = true;
    parCell.appendChild(parInput);
    row.appendChild(parCell);

    const siCell = document.createElement('td');
    const siInput = document.createElement('input');
    siInput.type = 'number';
    siInput.min = '1';
    siInput.max = '18';
    siInput.value = existingHole?.strokeIndex ?? i;
    siInput.required = true;
    siCell.appendChild(siInput);
    row.appendChild(siCell);

    const distCell = document.createElement('td');
    const distInput = document.createElement('input');
    distInput.type = 'number';
    distInput.min = '0';
    const existingDistance = existingHole?.distanceByTee?.[existingTee?.color];
    distInput.value = existingDistance ?? '';
    distCell.appendChild(distInput);
    row.appendChild(distCell);

    tbody.appendChild(row);
    holeInputs.push({ number: i, parInput, siInput, distInput });
  }
  form.appendChild(table);

  const preview = document.createElement('p');
  preview.className = 'course-handicap-preview';
  form.appendChild(preview);

  function totalPar() {
    return holeInputs.reduce((sum, h) => sum + (parseInt(h.parInput.value, 10) || 0), 0);
  }

  function updatePreview() {
    const slope = parseFloat(slopeInput.value) || 0;
    const sss = parseFloat(sssInput.value) || 0;
    const index = parseFloat(indexInput.value) || 0;
    const ch = computeCourseHandicap(index, slope, sss, totalPar());
    preview.textContent = `Course Handicap : ${ch} (Par total : ${totalPar()})`;
  }

  [slopeInput, sssInput, indexInput, ...holeInputs.map((h) => h.parInput)].forEach((el) => {
    el.addEventListener('input', updatePreview);
  });
  updatePreview();

  function getData() {
    const strokeIndexes = holeInputs.map((h) => parseInt(h.siInput.value, 10));
    if (new Set(strokeIndexes).size !== 18) {
      throw new Error('Les index de trou (SI) doivent être uniques, de 1 à 18.');
    }

    return {
      name: nameInput.value.trim(),
      location: locationInput.value.trim(),
      tee: {
        color: teeColorInput.value.trim(),
        slope: parseFloat(slopeInput.value),
        sss: parseFloat(sssInput.value),
      },
      holes: holeInputs.map((h) => ({
        number: h.number,
        par: parseInt(h.parInput.value, 10),
        strokeIndex: parseInt(h.siInput.value, 10),
        distance: h.distInput.value === '' ? null : parseFloat(h.distInput.value),
      })),
    };
  }

  return { form, getData };
}

// Construit le Course complet (un seul départ) et l'enregistre — utilisé par les deux
// points d'entrée de création (saisie manuelle et import PDF), qui partagent le même
// formulaire de relecture et ne diffèrent que par la façon dont il est pré-rempli et la
// provenance déclarée (`source`, propre à chaque appelant).
export async function saveNewCourseFromFormData(data, source) {
  const holes = data.holes.map((h) => ({
    number: h.number,
    par: h.par,
    strokeIndex: h.strokeIndex,
    distanceByTee: h.distance != null ? { [data.tee.color]: h.distance } : {},
    teePositions: {},
    greenPosition: null,
  }));
  return saveCourse({
    name: data.name,
    location: data.location,
    source,
    recommendedTees: [data.tee],
    holes,
  });
}
