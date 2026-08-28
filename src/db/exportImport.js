// Sérialisation/désérialisation complète de la base locale en un unique fichier JSON.
// Point d'entrée unique pour l'export : le bouton "Exporter mes données" (Réglages) et,
// au Lot 4, la sauvegarde Google Drive (src/cloud/googleDrive.js) appelleront tous deux
// buildExportData() plutôt que de réimplémenter une sérialisation.

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
