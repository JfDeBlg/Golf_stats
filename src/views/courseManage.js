// Écran Gestion parcours : sous-menu regroupant les 3 actions sur les golfs, plus un
// raccourci direct vers chaque golf déjà enregistré (édition ou suppression en un clic).
// La liste est triée par ordre alphabétique insensible à la casse ; le nom est affiché en
// casse phrase via formatGolfName (src/ui/formHelpers.js), partagée avec tous les autres
// écrans qui affichent ou proposent un nom de golf — transformation d'affichage uniquement,
// la donnée stockée n'est jamais modifiée.

import { getCourses, deleteCourse } from '../db/repository.js';
import { createIcon } from '../ui/icons.js';
import { createHelpButton } from '../ui/helpOverlay.js';
import { formatGolfName } from '../ui/formHelpers.js';

const ITEM_ICON_SIZE = 20;

const ITEMS = [
  { label: 'Nouveau parcours', route: 'courseNew', icon: 'add' },
  { label: 'Importer depuis un PDF', route: 'courseImportPdf', icon: 'document' },
  { label: 'Calibrer avec le GPS', route: 'courseCalibrate', icon: 'satellite', iconSize: ITEM_ICON_SIZE + 4 },
  { label: 'Modifier parcours', route: 'courseEdit', icon: 'edit' },
  { label: 'Supprimer parcours', route: 'courseDelete', icon: 'delete' },
];

const MANAGE_HELP_TEXT = [
  "Chaque golf de la liste peut porter une icône : une coche verte signifie que le parcours a été calibré sur place, trou par trou, via le GPS.",
  "Une icône satellite signifie que des repères ont été préremplis automatiquement via OpenStreetMap, mais pas encore validés sur le terrain.",
  "Aucune icône : le parcours n'a pas encore été calibré (saisie manuelle ou import PDF uniquement).",
];

export async function renderCourseManage(container, params, navigate) {
  const headerRow = document.createElement('div');
  headerRow.className = 'screen-header-row';
  headerRow.appendChild(createHelpButton(MANAGE_HELP_TEXT));
  container.appendChild(headerRow);

  const nav = document.createElement('nav');
  nav.className = 'menu-list';

  ITEMS.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-item';
    btn.appendChild(createIcon(item.icon, { size: item.iconSize ?? ITEM_ICON_SIZE }));
    btn.appendChild(document.createTextNode(item.label));
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
    const courses = (await getCourses())
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
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
      nameBtn.className = 'list-item course-name-item';
      nameBtn.appendChild(createIcon('edit', { size: 16 }));
      nameBtn.appendChild(document.createTextNode(formatGolfName(course.name)));
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
      deleteBtn.setAttribute('aria-label', `Supprimer ${formatGolfName(course.name)}`);
      deleteBtn.appendChild(createIcon('delete', { size: 18 }));
      deleteBtn.addEventListener('click', async () => {
        if (confirm(`Supprimer définitivement le golf "${formatGolfName(course.name)}" ?`)) {
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
