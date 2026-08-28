// Définition du schéma IndexedDB : nom, version, object stores et index.

export const DB_NAME = 'golf-score-db';
export const DB_VERSION = 1;

export const STORES = {
  PLAYER: 'players',
  CLUB: 'clubs',
  COURSE: 'courses',
  ROUND: 'rounds',
};

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORES.PLAYER)) {
        db.createObjectStore(STORES.PLAYER, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.CLUB)) {
        const clubStore = db.createObjectStore(STORES.CLUB, { keyPath: 'id' });
        clubStore.createIndex('order', 'order', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.COURSE)) {
        db.createObjectStore(STORES.COURSE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.ROUND)) {
        const roundStore = db.createObjectStore(STORES.ROUND, { keyPath: 'id' });
        roundStore.createIndex('date', 'date', { unique: false });
        roundStore.createIndex('courseId', 'courseId', { unique: false });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}
