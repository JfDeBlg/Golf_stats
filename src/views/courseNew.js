// Écran Nouveau parcours.

import { buildCourseForm, saveNewCourseFromFormData } from './courseFormShared.js';

export async function renderCourseNew(container, params, navigate) {
  const { form, getData } = await buildCourseForm();

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Créer le golf';
  form.appendChild(saveBtn);

  const errorEl = document.createElement('p');
  errorEl.className = 'error-msg';
  form.appendChild(errorEl);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.textContent = '';
    try {
      await saveNewCourseFromFormData(getData(), 'manual');
      navigate('menu');
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  container.appendChild(form);
}
