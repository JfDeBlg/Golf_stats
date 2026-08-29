// Écran Réglages : profil joueur, sac de clubs, sauvegarde/partage.
// La liste des golfs (avec indicateurs de calibration) vit uniquement dans Gestion
// parcours — pas de doublon ici.

import { getPlayer, savePlayer, getClubs, saveClub, deleteClub } from '../db/repository.js';
import {
  buildExportData, buildExportZipFile, shareOrDownloadZip, downloadZipFile, readExportFile, importExportData,
} from '../db/exportImport.js';
import { createField } from '../ui/formHelpers.js';
import { createIcon } from '../ui/icons.js';
import { STANDARD_CLUBS } from '../data/standardClubs.js';

const MAX_CLUBS = 14;
const STANDARD_CLUBS_DATALIST_ID = 'standard-club-names';

export async function renderSettings(container) {
  container.appendChild(await buildProfileSection());
  container.appendChild(await buildClubsSection());
  container.appendChild(buildBackupSection());
}

async function buildProfileSection() {
  const section = document.createElement('section');
  section.className = 'card';

  const title = document.createElement('h2');
  title.textContent = 'Profil';
  section.appendChild(title);

  const player = (await getPlayer()) ?? { gender: 'H', firstName: '', lastName: '', handicapIndex: 0, appMode: 'expert' };

  const form = document.createElement('form');
  form.className = 'form';

  const genderSelect = document.createElement('select');
  [
    { value: 'H', label: 'Homme' },
    { value: 'F', label: 'Femme' },
  ].forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (player.gender === value) opt.selected = true;
    genderSelect.appendChild(opt);
  });
  form.appendChild(createField('Genre', genderSelect));

  const firstNameInput = document.createElement('input');
  firstNameInput.type = 'text';
  firstNameInput.value = player.firstName ?? '';
  form.appendChild(createField('Prénom', firstNameInput));

  const lastNameInput = document.createElement('input');
  lastNameInput.type = 'text';
  lastNameInput.value = player.lastName ?? '';
  form.appendChild(createField('Nom', lastNameInput));

  const handicapInput = document.createElement('input');
  handicapInput.type = 'number';
  handicapInput.step = '0.1';
  handicapInput.value = player.handicapIndex ?? 0;
  form.appendChild(createField('Index de handicap', handicapInput));

  const appModeSelect = document.createElement('select');
  [
    { value: 'expert', label: 'Expert (toutes les fonctionnalités)' },
    { value: 'simplified', label: 'Simplifié (score et putts uniquement)' },
  ].forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if ((player.appMode ?? 'expert') === value) opt.selected = true;
    appModeSelect.appendChild(opt);
  });
  form.appendChild(createField('Mode', appModeSelect));

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = 'Enregistrer le profil';
  form.appendChild(saveBtn);

  const statusEl = document.createElement('p');
  statusEl.className = 'status-msg';
  form.appendChild(statusEl);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await savePlayer({
      gender: genderSelect.value,
      firstName: firstNameInput.value.trim(),
      lastName: lastNameInput.value.trim(),
      handicapIndex: parseFloat(handicapInput.value) || 0,
      appMode: appModeSelect.value,
    });
    statusEl.textContent = 'Profil enregistré.';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  });

  section.appendChild(form);
  return section;
}

async function buildClubsSection() {
  const section = document.createElement('section');
  section.className = 'card';

  const title = document.createElement('h2');
  title.textContent = 'Sac de clubs';
  section.appendChild(title);

  const clubNameDatalist = document.createElement('datalist');
  clubNameDatalist.id = STANDARD_CLUBS_DATALIST_ID;
  STANDARD_CLUBS.forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    clubNameDatalist.appendChild(opt);
  });
  section.appendChild(clubNameDatalist);

  const clubsList = document.createElement('div');
  clubsList.className = 'clubs-list';
  section.appendChild(clubsList);

  const clubCountEl = document.createElement('p');
  clubCountEl.className = 'hint';
  section.appendChild(clubCountEl);

  const loadStandardBtn = document.createElement('button');
  loadStandardBtn.type = 'button';
  loadStandardBtn.className = 'btn-secondary';
  loadStandardBtn.textContent = 'Charger la liste standard';
  section.appendChild(loadStandardBtn);

  const addClubBtn = document.createElement('button');
  addClubBtn.type = 'button';
  addClubBtn.className = 'btn-secondary';
  addClubBtn.appendChild(createIcon('add', { size: 16 }));
  addClubBtn.appendChild(document.createTextNode('Ajouter un club'));
  section.appendChild(addClubBtn);

  async function refreshClubs() {
    const clubs = await getClubs();
    clubsList.innerHTML = '';
    clubCountEl.textContent = `${clubs.length} / ${MAX_CLUBS} clubs`;
    addClubBtn.disabled = clubs.length >= MAX_CLUBS;
    loadStandardBtn.disabled = clubs.length >= MAX_CLUBS;

    clubs.forEach((club, index) => {
      clubsList.appendChild(buildClubRow(club, index, clubs, refreshClubs));
    });
  }

  loadStandardBtn.addEventListener('click', async () => {
    const clubs = await getClubs();
    const existingNames = new Set(clubs.map((c) => c.name.trim().toLowerCase()));
    let nextOrder = clubs.length > 0 ? Math.max(...clubs.map((c) => c.order)) + 1 : 0;
    let count = clubs.length;
    for (const name of STANDARD_CLUBS) {
      if (count >= MAX_CLUBS) break;
      if (existingNames.has(name.trim().toLowerCase())) continue;
      await saveClub({ name, order: nextOrder, targetDistance: null });
      existingNames.add(name.trim().toLowerCase());
      nextOrder += 1;
      count += 1;
    }
    await refreshClubs();
  });

  addClubBtn.addEventListener('click', async () => {
    const clubs = await getClubs();
    if (clubs.length >= MAX_CLUBS) return;
    const maxOrder = clubs.reduce((max, c) => Math.max(max, c.order), -1);
    await saveClub({ name: 'Nouveau club', order: maxOrder + 1, targetDistance: null });
    await refreshClubs();
  });

  await refreshClubs();
  return section;
}

function buildClubRow(club, index, clubs, refreshClubs) {
  const row = document.createElement('div');
  row.className = 'club-row';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = club.name;
  nameInput.placeholder = 'Nom du club';
  nameInput.setAttribute('list', STANDARD_CLUBS_DATALIST_ID);

  const distanceInput = document.createElement('input');
  distanceInput.type = 'number';
  distanceInput.placeholder = 'Distance (m)';
  const isPutter = club.name.trim().toLowerCase() === 'putter';
  distanceInput.value = club.targetDistance ?? '';
  distanceInput.disabled = isPutter;

  nameInput.addEventListener('input', () => {
    const putter = nameInput.value.trim().toLowerCase() === 'putter';
    distanceInput.disabled = putter;
    if (putter) distanceInput.value = '';
  });

  const upBtn = document.createElement('button');
  upBtn.type = 'button';
  upBtn.className = 'btn-icon';
  upBtn.textContent = '↑';
  upBtn.disabled = index === 0;
  upBtn.addEventListener('click', async () => {
    const prev = clubs[index - 1];
    await saveClub({ ...club, order: prev.order });
    await saveClub({ ...prev, order: club.order });
    await refreshClubs();
  });

  const downBtn = document.createElement('button');
  downBtn.type = 'button';
  downBtn.className = 'btn-icon';
  downBtn.textContent = '↓';
  downBtn.disabled = index === clubs.length - 1;
  downBtn.addEventListener('click', async () => {
    const next = clubs[index + 1];
    await saveClub({ ...club, order: next.order });
    await saveClub({ ...next, order: club.order });
    await refreshClubs();
  });

  const saveClubBtn = document.createElement('button');
  saveClubBtn.type = 'button';
  saveClubBtn.className = 'btn-icon';
  saveClubBtn.setAttribute('aria-label', 'Enregistrer ce club');
  saveClubBtn.appendChild(createIcon('check', { size: 18 }));
  saveClubBtn.addEventListener('click', async () => {
    const putter = nameInput.value.trim().toLowerCase() === 'putter';
    await saveClub({
      ...club,
      name: nameInput.value.trim(),
      targetDistance: putter ? null : (parseFloat(distanceInput.value) || null),
    });
    await refreshClubs();
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn-icon';
  deleteBtn.setAttribute('aria-label', `Supprimer ${club.name}`);
  deleteBtn.appendChild(createIcon('delete', { size: 18 }));
  deleteBtn.addEventListener('click', async () => {
    await deleteClub(club.id);
    await refreshClubs();
  });

  row.appendChild(nameInput);
  row.appendChild(distanceInput);
  row.appendChild(upBtn);
  row.appendChild(downBtn);
  row.appendChild(saveClubBtn);
  row.appendChild(deleteBtn);
  return row;
}

function buildActionBox(button, explanationText) {
  const box = document.createElement('div');
  box.className = 'action-box';
  box.appendChild(button);
  const explanation = document.createElement('p');
  explanation.className = 'hint';
  explanation.textContent = explanationText;
  box.appendChild(explanation);
  return box;
}

function buildBackupSection() {
  const section = document.createElement('section');
  section.className = 'card';

  const title = document.createElement('h2');
  title.textContent = 'Sauvegarde / Partage';
  section.appendChild(title);

  const shareBtn = document.createElement('button');
  shareBtn.type = 'button';
  shareBtn.className = 'btn-primary';
  shareBtn.textContent = 'Exporter et partager';
  section.appendChild(buildActionBox(
    shareBtn,
    'Envoie une copie de vos données par mail, message, AirDrop ou toute autre app installée sur votre téléphone.'
  ));

  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn-secondary';
  downloadBtn.textContent = 'Télécharger (ZIP)';
  section.appendChild(buildActionBox(
    downloadBtn,
    'Enregistre directement le fichier de sauvegarde sur cet appareil, sans passer par le partage (utile notamment sur ordinateur).'
  ));

  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.className = 'btn-secondary';
  importBtn.textContent = 'Importer';
  const importBox = buildActionBox(
    importBtn,
    "Restaure vos données à partir d'un fichier de sauvegarde (.zip ou .json) précédemment exporté. Remplace toutes les données actuelles après confirmation."
  );

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json,.zip,application/zip';
  fileInput.hidden = true;
  importBox.appendChild(fileInput);
  section.appendChild(importBox);

  const statusEl = document.createElement('p');
  statusEl.className = 'hint';
  section.appendChild(statusEl);

  shareBtn.addEventListener('click', async () => {
    statusEl.className = 'hint';
    statusEl.textContent = "Préparation de l'export…";
    shareBtn.disabled = true;
    try {
      const exportData = await buildExportData();
      const zipFile = await buildExportZipFile(exportData);
      const result = await shareOrDownloadZip(zipFile);
      statusEl.className = 'status-msg';
      statusEl.textContent = result === 'shared' ? 'Partage lancé.' : 'Fichier ZIP téléchargé.';
    } catch (err) {
      statusEl.className = 'error-msg';
      statusEl.textContent = `Export impossible : ${err.message}`;
    } finally {
      shareBtn.disabled = false;
    }
  });

  downloadBtn.addEventListener('click', async () => {
    statusEl.className = 'hint';
    statusEl.textContent = "Préparation de l'export…";
    downloadBtn.disabled = true;
    try {
      const exportData = await buildExportData();
      const zipFile = await buildExportZipFile(exportData);
      downloadZipFile(zipFile);
      statusEl.className = 'status-msg';
      statusEl.textContent = 'Fichier ZIP téléchargé.';
    } catch (err) {
      statusEl.className = 'error-msg';
      statusEl.textContent = `Export impossible : ${err.message}`;
    } finally {
      downloadBtn.disabled = false;
    }
  });

  importBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;

    statusEl.className = 'hint';
    statusEl.textContent = '';

    let parsed;
    try {
      parsed = await readExportFile(file);
    } catch (err) {
      statusEl.className = 'error-msg';
      statusEl.textContent = `Fichier invalide : ${err.message}`;
      return;
    }

    const confirmed = confirm(
      'Cette opération remplace toutes vos données actuelles par celles du fichier importé. Continuer ?'
    );
    if (!confirmed) return;

    await importExportData(parsed);
    statusEl.className = 'status-msg';
    statusEl.textContent = 'Import réussi. Rechargement...';
    setTimeout(() => window.location.reload(), 800);
  });

  return section;
}
