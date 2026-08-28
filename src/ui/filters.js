// Barre de filtres réutilisable (Golf / Année / Mois, + Club en option) — partagée par
// Reprendre une partie, Historique et Statistiques pour éviter toute réimplémentation.

import { createField } from './formHelpers.js';

// options: { courses: [...], clubs: [...] | null } — clubs=null n'affiche pas ce filtre
// (Historique et Reprendre une partie n'ont pas de notion de club).
export function buildFilterBar(options, onChange) {
  const { courses = [], clubs = null } = options;
  const form = document.createElement('div');
  form.className = 'form';

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
  form.appendChild(createField('Filtrer par golf', courseFilter));

  const yearFilter = document.createElement('input');
  yearFilter.type = 'text';
  yearFilter.placeholder = 'AA';
  yearFilter.maxLength = 2;
  form.appendChild(createField('Filtrer par année (AA)', yearFilter));

  const monthFilter = document.createElement('input');
  monthFilter.type = 'text';
  monthFilter.placeholder = 'MM';
  monthFilter.maxLength = 2;
  form.appendChild(createField('Filtrer par mois (MM)', monthFilter));

  let clubFilter = null;
  if (clubs) {
    clubFilter = document.createElement('select');
    const allClubsOpt = document.createElement('option');
    allClubsOpt.value = '';
    allClubsOpt.textContent = 'Tous les clubs';
    clubFilter.appendChild(allClubsOpt);
    clubs.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      clubFilter.appendChild(opt);
    });
    form.appendChild(createField('Filtrer par club', clubFilter));
  }

  function getFilters() {
    return {
      courseId: courseFilter.value || null,
      year: yearFilter.value.trim() || null,
      month: monthFilter.value.trim() || null,
      clubId: clubFilter ? (clubFilter.value || null) : null,
    };
  }

  function emit() {
    onChange(getFilters());
  }

  courseFilter.addEventListener('change', emit);
  yearFilter.addEventListener('input', emit);
  monthFilter.addEventListener('input', emit);
  if (clubFilter) clubFilter.addEventListener('change', emit);

  return { element: form, getFilters };
}

// Un round correspond aux filtres Golf/Année/Mois. Le filtre Club (s'il existe) reste à la
// charge de l'appelant : il s'applique aux coups individuels, pas aux rounds eux-mêmes.
export function roundMatchesFilters(round, { courseId, year, month }) {
  if (courseId && round.courseId !== courseId) return false;
  if (year || month) {
    const d = new Date(`${round.date}T00:00:00`);
    if (year && String(d.getFullYear()).slice(-2) !== year) return false;
    if (month && String(d.getMonth() + 1).padStart(2, '0') !== month) return false;
  }
  return true;
}
