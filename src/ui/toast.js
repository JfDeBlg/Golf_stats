// Bandeau de rappel de sauvegarde ("toast"), non bloquant, affiché après une action
// importante (création/modification de parcours, clôture de partie) : pas de sauvegarde
// silencieuse possible sur iPhone (aucun accès disque persistant hors de l'app), donc un
// simple rappel avec un raccourci direct vers l'export déjà existant, plutôt qu'une tentative
// de sauvegarde automatique. Se referme tout seul après quelques secondes, au clic ailleurs,
// ou une fois l'export lancé — jamais bloquant pour la suite de l'utilisation.

import { buildExportData, buildExportZipFile, shareOrDownloadZip } from '../db/exportImport.js';

const AUTO_DISMISS_MS = 6000;

export function showSaveReminderToast() {
  document.querySelector('.save-toast')?.remove();

  const toast = document.createElement('div');
  toast.className = 'save-toast';
  toast.addEventListener('click', (event) => event.stopPropagation());

  const text = document.createElement('span');
  text.textContent = 'Pensez à sauvegarder vos données';
  toast.appendChild(text);

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'btn-primary';
  exportBtn.textContent = 'Exporter maintenant';
  toast.appendChild(exportBtn);

  const dismissTimer = setTimeout(dismiss, AUTO_DISMISS_MS);

  function dismiss() {
    clearTimeout(dismissTimer);
    document.removeEventListener('click', onOutsideClick);
    toast.remove();
  }

  function onOutsideClick(event) {
    if (!toast.contains(event.target)) dismiss();
  }

  exportBtn.addEventListener('click', async () => {
    exportBtn.disabled = true;
    exportBtn.textContent = 'Export en cours…';
    try {
      const exportData = await buildExportData();
      const zipFile = await buildExportZipFile(exportData);
      await shareOrDownloadZip(zipFile);
      dismiss();
    } catch (err) {
      exportBtn.disabled = false;
      exportBtn.textContent = `Échec (${err.message}) — réessayer`;
    }
  });

  document.body.appendChild(toast);
  // Le clic qui déclenche l'affichage (ex: "Terminer la partie") ne doit pas refermer le
  // toast immédiatement — l'écoute des clics extérieurs ne démarre qu'au tour suivant.
  setTimeout(() => document.addEventListener('click', onOutsideClick), 0);
}
