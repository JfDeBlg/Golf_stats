// Couche d'accès aux données IndexedDB. Encapsule toutes les opérations CRUD
// pour que le reste de l'application ne manipule jamais l'API IndexedDB directement.

import { openDatabase, STORES } from './schema.js';

let dbPromise = null;

function getDb() {
  if (!dbPromise) dbPromise = openDatabase();
  return dbPromise;
}

async function getStore(storeName, mode) {
  const db = await getDb();
  return db.transaction(storeName, mode).objectStore(storeName);
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putRecord(storeName, record) {
  const store = await getStore(storeName, 'readwrite');
  await requestToPromise(store.put(record));
  return record;
}

async function getRecord(storeName, id) {
  const store = await getStore(storeName, 'readonly');
  return requestToPromise(store.get(id));
}

async function getAllRecords(storeName) {
  const store = await getStore(storeName, 'readonly');
  return requestToPromise(store.getAll());
}

async function deleteRecord(storeName, id) {
  const store = await getStore(storeName, 'readwrite');
  await requestToPromise(store.delete(id));
}

export function generateId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// --- Player (profil unique du joueur) ---

const PLAYER_ID = 'player-1';

export async function getPlayer() {
  return (await getRecord(STORES.PLAYER, PLAYER_ID)) ?? null;
}

export async function savePlayer(data) {
  return putRecord(STORES.PLAYER, { ...data, id: PLAYER_ID });
}

// --- Clubs ---

export async function getClubs() {
  const clubs = await getAllRecords(STORES.CLUB);
  return clubs.sort((a, b) => a.order - b.order);
}

export async function saveClub(club) {
  const record = club.id ? club : { ...club, id: generateId('club') };
  return putRecord(STORES.CLUB, record);
}

export async function deleteClub(id) {
  return deleteRecord(STORES.CLUB, id);
}

// --- Courses (golfs) ---

export async function getCourses() {
  return getAllRecords(STORES.COURSE);
}

export async function getCourse(id) {
  return getRecord(STORES.COURSE, id);
}

export async function saveCourse(course) {
  const record = course.id ? course : { ...course, id: generateId('course') };
  return putRecord(STORES.COURSE, record);
}

export async function deleteCourse(id) {
  return deleteRecord(STORES.COURSE, id);
}

// --- Rounds (parties) ---

export async function getRounds() {
  const rounds = await getAllRecords(STORES.ROUND);
  return rounds.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getRound(id) {
  return getRecord(STORES.ROUND, id);
}

export async function saveRound(round) {
  const record = round.id ? round : { ...round, id: generateId('round') };
  return putRecord(STORES.ROUND, record);
}

export async function deleteRound(id) {
  return deleteRecord(STORES.ROUND, id);
}

// --- Remplacement complet de la base (utilisé par l'import de sauvegarde) ---

export async function clearAllData() {
  const db = await getDb();
  const storeNames = [STORES.PLAYER, STORES.CLUB, STORES.COURSE, STORES.ROUND];
  const tx = db.transaction(storeNames, 'readwrite');
  await Promise.all(storeNames.map((name) => requestToPromise(tx.objectStore(name).clear())));
}
