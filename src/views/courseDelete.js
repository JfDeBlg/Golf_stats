// Écran Supprimer parcours.

import { getCourses, deleteCourse } from '../db/repository.js';
import { createIcon } from '../ui/icons.js';

export async function renderCourseDelete(container, params, navigate) {
  const courses = await getCourses();

  if (courses.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'Aucun golf enregistré.';
    container.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'list-select';

  courses.forEach((course) => {
    const row = document.createElement('div');
    row.className = 'list-item-row';

    const label = document.createElement('span');
    label.className = 'list-item';
    label.textContent = course.name;
    row.appendChild(label);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-icon';
    deleteBtn.setAttribute('aria-label', `Supprimer ${course.name}`);
    deleteBtn.appendChild(createIcon('delete', { size: 18 }));
    deleteBtn.addEventListener('click', () => {
      if (confirm(`Supprimer définitivement le golf "${course.name}" ?`)) {
        deleteCourse(course.id).then(() => navigate('courseDelete', {}, { replace: true }));
      }
    });
    row.appendChild(deleteBtn);

    list.appendChild(row);
  });

  container.appendChild(list);
}
