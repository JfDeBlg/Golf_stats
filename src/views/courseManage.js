// Écran Gestion parcours : sous-menu regroupant les 3 actions sur les golfs, plus un
// raccourci direct vers chaque golf déjà enregistré (édition ou suppression en un clic).

import { getCourses, deleteCourse } from '../db/repository.js';
import { createIcon } from '../ui/icons.js';

const ITEMS = [
  { label: 'Nouveau parcours', route: 'courseNew' },
  { label: 'Importer depuis un PDF', route: 'courseImportPdf' },
  { label: 'Calibrer avec le GPS', route: 'courseCalibrate' },
  { label: 'Modifier parcours', route: 'courseEdit' },
  { label: 'Supprimer parcours', route: 'courseDelete' },
];

export async function renderCourseManage(container, params, navigate) {
  const nav = document.createElement('nav');
  nav.className = 'menu-list';

  ITEMS.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-item';
    btn.textContent = item.label;
    btn.addEventListener('click', () => navigate(item.route));
    nav.appendChild(btn);
  });
  container.appendChild(nav);

  const listTitle = document.createElement('h2');
  listTitle.textContent = 'Golfs enregistrés';
  container.appendChild(listTitle);

  const list = document.createElement('div');
  list.className = 'list-select';
  container.appendChild(list);

  async function refresh() {
    const courses = (await getCourses()).sort((a, b) => a.name.localeCompare(b.name));
    list.innerHTML = '';

    if (courses.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'Aucun golf enregistré.';
      list.appendChild(empty);
      return;
    }

    courses.forEach((course) => {
      const row = document.createElement('div');
      row.className = 'list-item-row';

      const nameBtn = document.createElement('button');
      nameBtn.type = 'button';
      nameBtn.className = 'list-item';
      nameBtn.appendChild(createIcon('edit', { size: 16 }));
      nameBtn.appendChild(document.createTextNode(course.name));
      if (course.source === 'calibrated') {
        nameBtn.appendChild(createIcon('check', { size: 16 }));
      } else if (course.source === 'osm_prefilled') {
        nameBtn.appendChild(createIcon('satellite', { size: 16 }));
      }
      nameBtn.addEventListener('click', () => navigate('courseEdit', { courseId: course.id }));
      row.appendChild(nameBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-icon';
      deleteBtn.setAttribute('aria-label', `Supprimer ${course.name}`);
      deleteBtn.appendChild(createIcon('delete', { size: 18 }));
      deleteBtn.addEventListener('click', async () => {
        if (confirm(`Supprimer définitivement le golf "${course.name}" ?`)) {
          await deleteCourse(course.id);
          await refresh();
        }
      });
      row.appendChild(deleteBtn);

      list.appendChild(row);
    });
  }

  await refresh();
}
