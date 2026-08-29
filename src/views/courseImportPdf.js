// Écran Importer depuis un PDF : extrait une carte de score, puis pré-remplit le même
// formulaire que la saisie manuelle. Rien n'est enregistré tant que l'utilisateur n'a pas
// relu/corrigé et validé — la mise en page des cartes de score varie d'un club à l'autre et
// l'extraction n'est pas garantie fiable à 100 %.
//
// pdfScorecard.js (et via lui, tout pdf.js) est importé dynamiquement, seulement quand
// l'utilisateur sélectionne effectivement un fichier — pas à l'ouverture de l'écran, et
// surtout pas au chargement de l'app. main.js importe tous les écrans en haut de fichier ;
// une bibliothèque tierce volumineuse importée statiquement là ferait planter l'app entière
// au démarrage si elle échoue à s'évaluer sur un moteur JS donné (observé sur iPhone : écran
// blanc, seul le bandeau statique s'affichait).

import { buildCourseForm, saveNewCourseFromFormData } from './courseFormShared.js';
import { createHelpButton } from '../ui/helpOverlay.js';

const SCORECARD_GENERATOR_URL = 'https://www.des-balles-et-des-birdies.com/calculScoreE1';

export async function renderCourseImportPdf(container, params, navigate) {
  const headerRow = document.createElement('div');
  headerRow.className = 'screen-header-row';
  headerRow.appendChild(createHelpButton([
    "Cet écran extrait automatiquement les données d'une carte de score au format PDF pour pré-remplir la création d'un golf.",
    "Si vous n'avez pas encore de PDF, utilisez le lien fourni pour en générer un depuis des-balles-et-des-birdies.com.",
    "L'extraction n'est pas garantie fiable à 100 % (la mise en page varie d'un club à l'autre) : relisez toujours les données avant d'enregistrer.",
  ]));
  container.appendChild(headerRow);

  const generatorPara = document.createElement('p');
  generatorPara.className = 'hint';
  generatorPara.append('Pour générer la carte de score de votre golf : cliquez sur le lien ci-dessous, renseignez le golf recherché, votre niveau et le départ souhaité, puis imprimez la carte au format PDF et enregistrez le fichier sur cet appareil.');
  container.appendChild(generatorPara);

  const linkPara = document.createElement('p');
  const generatorLink = document.createElement('a');
  generatorLink.href = SCORECARD_GENERATOR_URL;
  generatorLink.target = '_blank';
  generatorLink.rel = 'noopener';
  generatorLink.textContent = SCORECARD_GENERATOR_URL;
  linkPara.appendChild(generatorLink);
  container.appendChild(linkPara);

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
      const { parseScorecardPdf } = await import('../import/pdfScorecard.js');
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
