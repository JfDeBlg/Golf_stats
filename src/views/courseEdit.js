// Écran Modifier parcours : sélection d'un golf existant, puis édition de ses données.
//
// Le formulaire ne montre/modifie qu'un seul départ à la fois (le premier connu du golf).
// L'enregistrement fusionne ce départ dans recommendedTees (par couleur) et sa distance
// dans distanceByTee de chaque trou, sans écraser les données des autres départs déjà
// calibrés (utile dès qu'un golf a plusieurs couleurs de départ).

import { getCourses, saveCourse } from '../db/repository.js';
import { buildCourseForm } from './courseFormShared.js';
import { deriveCourseSource } from '../scoring/calibration.js';

function mergeTees(existingTees, newTee) {
  const tees = [...(existingTees ?? [])];
  const idx = tees.findIndex((t) => t.color === newTee.color);
  if (idx >= 0) {
    tees[idx] = newTee;
  } else {
    tees.push(newTee);
  }
  return tees;
}

export async function renderCourseEdit(container, params, navigate) {
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
      btn.addEventListener('click', () => navigate('courseEdit', { courseId: course.id }, { replace: true }));
      list.appendChild(btn);
    });
    container.appendChild(list);
    return;
  }

  const course = courses.find((c) => c.id === params.courseId);
  const { form, getData } = await buildCourseForm(course);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Enregistrer les modifications';
  form.appendChild(saveBtn);

  const errorEl = document.createElement('p');
  errorEl.className = 'error-msg';
  form.appendChild(errorEl);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.textContent = '';
    try {
      const data = getData();
      const holes = data.holes.map((h, i) => {
        const existingHole = course.holes?.[i];
        const distanceByTee = { ...(existingHole?.distanceByTee ?? {}) };
        if (h.distance != null) {
          distanceByTee[data.tee.color] = h.distance;
        } else {
          delete distanceByTee[data.tee.color];
        }
        return {
          number: h.number,
          par: h.par,
          strokeIndex: h.strokeIndex,
          distanceByTee,
          teePositions: existingHole?.teePositions ?? {},
          greenPosition: existingHole?.greenPosition ?? null,
        };
      });
      const updatedCourse = {
        ...course,
        name: data.name,
        location: data.location,
        recommendedTees: mergeTees(course.recommendedTees, data.tee),
        holes,
      };
      updatedCourse.source = deriveCourseSource(updatedCourse, course.source);
      await saveCourse(updatedCourse);
      navigate('menu');
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  container.appendChild(form);
}
