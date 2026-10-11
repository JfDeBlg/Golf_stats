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

// Dérive un trigramme candidat à partir d'un ancien prénom/nom (purgés juste après) — pure
// heuristique de départ, toujours affichée pour validation/correction par l'utilisateur
// dans Réglages, jamais utilisée telle quelle sans qu'il la voie.
function deriveTrigram(firstName, lastName) {
  const raw = `${(firstName ?? '').trim().slice(0, 2)}${(lastName ?? '').trim().slice(0, 1)}`
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  return (raw + 'XXX').slice(0, 3);
}

// Migration à la lecture (depuis la 1.2.58) : Player.firstName/lastName sont remplacés par
// un trigramme unique (pseudonymisation — les exports peuvent être hébergés publiquement,
// cf. README.md). Si un trigramme existe déjà, les anciens champs sont simplement retirés
// s'ils traînent encore (ex: import d'un vieil export) ; sinon un trigramme est dérivé une
// fois, à charge pour l'utilisateur de le valider/corriger dans Réglages. Persisté
// immédiatement (contrairement à la migration de golf, non bloquante) pour que
// firstName/lastName ne subsistent nulle part après le premier getPlayer().
export function migratePlayerRecord(player) {
  if (!player) return player;
  if (!('firstName' in player) && !('lastName' in player)) return player;
  const { firstName, lastName, ...rest } = player;
  if (rest.trigram) return rest;
  return { ...rest, trigram: deriveTrigram(firstName, lastName) };
}

export async function getPlayer() {
  const record = await getRecord(STORES.PLAYER, PLAYER_ID);
  if (!record) return null;
  const migrated = migratePlayerRecord(record);
  if (migrated !== record) await putRecord(STORES.PLAYER, migrated);
  return migrated;
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

// Migration à la lecture : les golfs calibrés avant la 1.2.55 stockent un point de green
// unique (Hole.greenPosition) ; on le retraite en Hole.greenPositions.middle sans jamais
// perdre de calibration existante. N'écrit rien en base — la nouvelle forme n'est persistée
// que si le golf est ensuite réenregistré (calibration, édition...).
function migrateHole(hole) {
  if (hole.greenPositions) return hole;
  if (hole.greenPosition) {
    return { ...hole, greenPositions: { middle: hole.greenPosition } };
  }
  return { ...hole, greenPositions: {} };
}

function migrateCourse(course) {
  if (!course) return course;
  return { ...course, holes: (course.holes ?? []).map(migrateHole) };
}

export async function getCourses() {
  const courses = await getAllRecords(STORES.COURSE);
  return courses.map(migrateCourse);
}

export async function getCourse(id) {
  return migrateCourse(await getRecord(STORES.COURSE, id));
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
