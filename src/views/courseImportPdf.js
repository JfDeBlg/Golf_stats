// Écran Importer depuis un PDF : extrait une carte de score, puis pré-remplit le même
// formulaire que la saisie manuelle. Rien n'est enregistré tant que l'utilisateur n'a pas
// relu/corrigé et validé — la mise en page des cartes de score varie d'un club à l'autre et
// l'extraction n'est pas garantie fiable à 100 %.

import { buildCourseForm, saveNewCourseFromFormData } from './courseFormShared.js';
import { parseScorecardPdf } from '../import/pdfScorecard.js';

export async function renderCourseImportPdf(container, params, navigate) {
  const intro = document.createElement('p');
  intro.className = 'hint';
  intro.textContent = "Sélectionnez le PDF de la carte de score. Les données extraites pré-remplissent le formulaire ci-dessous : relisez-les et corrigez-les avant d'enregistrer.";
  container.appendChild(intro);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/pdf,.pdf';
  container.appendChild(fileInput);

  const statusEl = document.createElement('p');
  statusEl.className = 'hint';
  container.appendChild(statusEl);

  const formContainer = document.createElement('div');
  container.appendChild(formContainer);

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    formContainer.innerHTML = '';
    statusEl.className = 'hint';
    statusEl.textContent = 'Extraction en cours…';

    let parsed;
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      parsed = await parseScorecardPdf(data);
    } catch (err) {
      statusEl.className = 'error-msg';
      statusEl.textContent = `Extraction impossible : ${err.message}`;
      return;
    }

    if (parsed.warnings.length > 0) {
      statusEl.className = 'error-msg';
      statusEl.textContent = `Extraction partielle — champs manquants laissés vides, à compléter : ${parsed.warnings.join(' ')}`;
    } else {
      statusEl.className = 'status-msg';
      statusEl.textContent = 'Extraction réussie — relisez les données avant d\'enregistrer.';
    }

    if (parsed.maxHandicap != null) {
      const maxHandicapHint = document.createElement('p');
      maxHandicapHint.className = 'hint';
      maxHandicapHint.textContent = `Handicap max autorisé sur ce départ (indicatif, non utilisé dans les calculs) : ${parsed.maxHandicap}`;
      formContainer.appendChild(maxHandicapHint);
    }

    const pseudoInitialCourse = {
      name: parsed.name,
      location: '',
      recommendedTees: [parsed.tee],
      holes: parsed.holes.map((h) => ({
        number: h.number,
        par: h.par,
        strokeIndex: h.strokeIndex,
        distanceByTee: h.distance != null ? { [parsed.tee.color]: h.distance } : {},
      })),
    };

    const { form, getData } = await buildCourseForm(pseudoInitialCourse);

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
        await saveNewCourseFromFormData(getData(), 'pdf_import');
        navigate('menu');
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });

    formContainer.appendChild(form);
  });
}
