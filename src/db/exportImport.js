// Sérialisation/désérialisation complète de la base locale en un unique fichier JSON.
// buildExportData() est le point d'entrée unique de la sérialisation, réutilisé aussi bien
// par l'export/partage ZIP (Réglages) que par tout futur canal d'export additionnel.
//
// Le partage se fait via la feuille de partage native (Web Share API, sans compte ni
// connexion à un service tiers) plutôt qu'une intégration cloud dédiée (Google Drive
// envisagée puis abandonnée : trop de complexité — projet Google Cloud, écran "application
// non vérifiée", gestion de jeton — pour le bénéfice apporté).

import {
  getPlayer, getClubs, getCourses, getRounds,
  savePlayer, saveClub, saveCourse, saveRound, clearAllData,
} from './repository.js';
import { APP_VERSION } from '../version.js';

export const EXPORT_FORMAT_VERSION = 1;

export async function buildExportData() {
  const [player, clubs, courses, rounds] = await Promise.all([
    getPlayer(), getClubs(), getCourses(), getRounds(),
  ]);
  return {
    exportFormatVersion: EXPORT_FORMAT_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { player, clubs, courses, rounds },
  };
}

export function downloadExport(exportData) {
  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateStamp = exportData.exportedAt.slice(0, 10).replace(/-/g, '');

  const link = document.createElement('a');
  link.href = url;
  link.download = `golf-app-export-${dateStamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Valide la structure d'un fichier d'export avant toute écriture en base — un fichier
// invalide ou d'une version incompatible ne doit modifier aucune donnée existante.
export function validateExportData(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('format JSON inattendu.');
  }
  if (raw.exportFormatVersion !== EXPORT_FORMAT_VERSION) {
    throw new Error(`version de sauvegarde incompatible (attendu ${EXPORT_FORMAT_VERSION}, trouvé ${raw.exportFormatVersion ?? 'inconnu'}).`);
  }
  if (!raw.data || typeof raw.data !== 'object') {
    throw new Error('données manquantes.');
  }
  const { clubs, courses, rounds } = raw.data;
  if (!Array.isArray(clubs) || !Array.isArray(courses) || !Array.isArray(rounds)) {
    throw new Error('structure de données inattendue.');
  }
  return raw;
}

export async function importExportData(raw) {
  const validated = validateExportData(raw);
  const { player, clubs, courses, rounds } = validated.data;

  await clearAllData();
  if (player) await savePlayer(player);
  await Promise.all(clubs.map((c) => saveClub(c)));
  await Promise.all(courses.map((c) => saveCourse(c)));
  await Promise.all(rounds.map((r) => saveRound(r)));
}

// --- Export ZIP + partage natif ---
//
// JSZip est vendoré localement (src/lib/jszip.min.js, build UMD, jamais chargé depuis un
// CDN) mais chargé paresseusement via un <script> classique injecté à la demande — jamais
// au démarrage de l'app. C'est la même précaution que pour pdf.js : une bibliothèque tierce
// importée statiquement dans le graphe de modules ferait planter l'app entière si elle
// échoue à s'évaluer sur un moteur JS donné.

let jsZipLoadPromise = null;

function loadJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (!jsZipLoadPromise) {
    jsZipLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('../lib/jszip.min.js', import.meta.url).href;
      script.onload = () => resolve(window.JSZip);
      script.onerror = () => reject(new Error('Impossible de charger JSZip.'));
      document.head.appendChild(script);
    });
  }
  return jsZipLoadPromise;
}

export async function buildExportZipFile(exportData) {
  const JSZip = await loadJSZip();
  const zip = new JSZip();
  const dateStamp = exportData.exportedAt.slice(0, 10).replace(/-/g, '');
  zip.file(`golf-app-export-${dateStamp}.json`, JSON.stringify(exportData, null, 2));
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], `golf-app-export-${dateStamp}.zip`, { type: 'application/zip' });
}

// Partage natif (feuille de partage iOS : Mail, Messages, Fichiers/iCloud Drive, AirDrop…)
// quand disponible ; repli sur le téléchargement direct sinon. Aucune connexion réseau
// nécessaire à aucune étape — seule l'application de destination choisie par l'utilisateur
// peut en avoir besoin ensuite, ce qui ne concerne plus cette app.
export async function shareOrDownloadZip(zipFile) {
  if (navigator.canShare && navigator.share && navigator.canShare({ files: [zipFile] })) {
    await navigator.share({ files: [zipFile], title: zipFile.name });
    return 'shared';
  }
  const url = URL.createObjectURL(zipFile);
  const link = document.createElement('a');
  link.href = url;
  link.download = zipFile.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return 'downloaded';
}

// Import : accepte un .json (chemin existant) ou un .zip (décompressé via JSZip), puis
// applique la même validation dans les deux cas.
export async function readExportFile(file) {
  const isZip = file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip';
  let text;
  if (isZip) {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(file);
    const jsonEntry = Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith('.json'));
    if (!jsonEntry) {
      throw new Error('Aucun fichier JSON trouvé dans le ZIP.');
    }
    text = await jsonEntry.async('string');
  } else {
    text = await file.text();
  }
  return validateExportData(JSON.parse(text));
}
