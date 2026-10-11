// Restauration depuis une sauvegarde hébergée côté serveur (dossier data/, servi tel quel
// par GitHub Pages). Proposée automatiquement si la base locale est entièrement vide au
// démarrage (cf. src/main.js), et disponible à tout moment via Réglages > Sauvegarde/Partage
// > "Restaurer depuis le serveur".
//
// data/index.json est la SEULE source des sauvegardes proposées (GitHub Pages ne liste pas
// un dossier) ; régénéré par tools/update-data-index.ps1. Absent, vide, ou réseau
// indisponible : aucun blocage, aucun message — c'est le cas normal d'une première
// installation ou du mode hors-ligne. Le choix dans la liste est toujours manuel, même s'il
// n'y a qu'une seule sauvegarde (jamais d'import automatique).
//
// Réutilise exactement le chemin d'import local (readExportFile + importExportData,
// src/db/exportImport.js) : mêmes validations, même compatibilité avec les anciens formats
// d'export (y compris la migration du trigramme, cf. repository.js).

import { readExportFile, importExportData } from '../db/exportImport.js';
import { getPlayer, getClubs, getCourses, getRounds } from '../db/repository.js';

const CONTENT_LABELS = { courses: 'Parcours seuls', full: 'Complet' };

export async function isDatabaseEmpty() {
  const [player, clubs, courses, rounds] = await Promise.all([
    getPlayer(), getClubs(), getCourses(), getRounds(),
  ]);
  return !player && clubs.length === 0 && courses.length === 0 && rounds.length === 0;
}

export async function fetchServerBackupIndex() {
  try {
    const response = await fetch('data/index.json', { cache: 'no-store' });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.backups) ? data.backups : [];
  } catch {
    return [];
  }
}

// Résout avec la sauvegarde choisie, ou null si l'utilisateur ferme/ignore.
function showBackupChoiceOverlay(backups) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'help-overlay';

    const box = document.createElement('div');
    box.className = 'help-box';

    const title = document.createElement('p');
    title.innerHTML = '<strong>Aucune donnée trouvée sur cet appareil.</strong><br>Voulez-vous restaurer une sauvegarde hébergée sur le serveur ?';
    box.appendChild(title);

    const list = document.createElement('div');
    list.className = 'list-select';
    backups.forEach((backup) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'list-item';
      const typeLabel = CONTENT_LABELS[backup.content] ?? backup.content ?? '';
      btn.textContent = `${backup.label ?? backup.file}${backup.date ? ` — ${backup.date}` : ''}${typeLabel ? ` (${typeLabel})` : ''}`;
      btn.addEventListener('click', () => { cleanup(); resolve(backup); });
      list.appendChild(btn);
    });
    box.appendChild(list);

    const ignoreBtn = document.createElement('button');
    ignoreBtn.type = 'button';
    ignoreBtn.className = 'btn-secondary';
    ignoreBtn.textContent = 'Ignorer';
    ignoreBtn.addEventListener('click', () => { cleanup(); resolve(null); });
    box.appendChild(ignoreBtn);

    overlay.appendChild(box);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) { cleanup(); resolve(null); }
    });
    document.body.appendChild(overlay);

    function cleanup() { overlay.remove(); }
  });
}

// requireConfirmBeforeImport : true pour la restauration manuelle depuis Réglages (des
// données locales existent déjà et seraient écrasées) ; false pour l'invite automatique au
// démarrage (la base est déjà vide, rien à perdre).
// Retourne : 'none-available' | 'ignored' | 'cancelled' | 'imported' | 'failed'.
export async function promptServerRestore({ requireConfirmBeforeImport = false } = {}) {
  const backups = await fetchServerBackupIndex();
  if (backups.length === 0) return 'none-available';

  const chosen = await showBackupChoiceOverlay(backups);
  if (!chosen) return 'ignored';

  if (requireConfirmBeforeImport) {
    const confirmed = confirm(
      'Cette opération remplace toutes vos données actuelles par celles de la sauvegarde choisie. Continuer ?'
    );
    if (!confirmed) return 'cancelled';
  }

  try {
    const response = await fetch(`data/${chosen.file}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`fichier introuvable (${response.status})`);
    const blob = await response.blob();
    const file = new File([blob], chosen.file, { type: 'application/zip' });
    const parsed = await readExportFile(file);
    await importExportData(parsed);
    return 'imported';
  } catch (err) {
    alert(`Restauration impossible : ${err.message}`);
    return 'failed';
  }
}
