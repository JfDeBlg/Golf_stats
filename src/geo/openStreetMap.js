// Amorce optionnelle de calibration via OpenStreetMap : un seul appel réseau par golf,
// déclenché à la demande (jamais automatique). Géocode un lieu (Nominatim) puis interroge
// Overpass pour les repères de golf taggés autour de ce point.
//
// Association trou <-> repère : les éléments `golf=hole` portent le numéro de trou (tag
// `ref`) et un point central approximatif (milieu du fairway), mais les tees/greens/pins
// eux-mêmes n'ont pas de numéro de trou. On associe donc à chaque trou numéroté le tee/green
// le plus proche de son centre — approximatif par construction, à corriger sur place.

import { haversineDistance } from '../scoring/distance.js';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const SEARCH_RADIUS_M = 1500;
const MATCH_TOLERANCE_M = 300;

// "48.85,2.35" -> position directe ; sinon recherche par nom de lieu via Nominatim.
export async function resolveApproximateLocation(query) {
  const trimmed = query.trim();
  const coordMatch = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(trimmed);
  if (coordMatch) {
    return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
  }

  const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(trimmed)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error('Recherche de lieu impossible (service indisponible).');
  }
  const results = await response.json();
  if (results.length === 0) {
    throw new Error('Lieu introuvable.');
  }
  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
}

async function fetchGolfElements(center) {
  const query = `[out:json][timeout:25];(`
    + `way["golf"="hole"](around:${SEARCH_RADIUS_M},${center.lat},${center.lng});`
    + `node["golf"="tee"](around:${SEARCH_RADIUS_M},${center.lat},${center.lng});`
    + `way["golf"="tee"](around:${SEARCH_RADIUS_M},${center.lat},${center.lng});`
    + `node["golf"="green"](around:${SEARCH_RADIUS_M},${center.lat},${center.lng});`
    + `way["golf"="green"](around:${SEARCH_RADIUS_M},${center.lat},${center.lng});`
    + `node["golf"="pin"](around:${SEARCH_RADIUS_M},${center.lat},${center.lng});`
    + `);out center tags;`;

  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) {
    throw new Error('Requête OpenStreetMap impossible (serveur indisponible).');
  }
  const data = await response.json();
  return data.elements ?? [];
}

function elementPosition(el) {
  if (el.type === 'node' && typeof el.lat === 'number') return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

function nearestWithin(pos, candidates, maxDistance) {
  let best = null;
  let bestDist = Infinity;
  candidates.forEach((c) => {
    const d = haversineDistance(pos, c);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  });
  return bestDist <= maxDistance ? best : null;
}

// Retourne { [holeNumber]: { tee: {lat,lng}|null, green: {lat,lng}|null } } pour les trous
// numérotés 1-18 trouvés autour du point de recherche.
function matchHolesToFeatures(elements, searchCenter) {
  const holeWays = elements.filter((el) => el.tags?.golf === 'hole' && el.tags?.ref);
  const teePositions = elements
    .filter((el) => el.tags?.golf === 'tee')
    .map(elementPosition)
    .filter(Boolean);
  const greenPositions = elements
    .filter((el) => el.tags?.golf === 'green' || el.tags?.golf === 'pin')
    .map(elementPosition)
    .filter(Boolean);

  // Un même numéro de trou peut apparaître plusieurs fois (club à plusieurs parcours) :
  // on garde le plus proche du point de recherche.
  const holeCenterByRef = new Map();
  holeWays.forEach((way) => {
    const ref = parseInt(way.tags.ref, 10);
    if (!Number.isInteger(ref) || ref < 1 || ref > 18) return;
    const pos = elementPosition(way);
    if (!pos) return;
    const dist = haversineDistance(pos, searchCenter);
    const existing = holeCenterByRef.get(ref);
    if (!existing || dist < existing.dist) {
      holeCenterByRef.set(ref, { pos, dist });
    }
  });

  const result = {};
  holeCenterByRef.forEach(({ pos }, holeNumber) => {
    result[holeNumber] = {
      tee: nearestWithin(pos, teePositions, MATCH_TOLERANCE_M),
      green: nearestWithin(pos, greenPositions, MATCH_TOLERANCE_M),
    };
  });
  return result;
}

// Repères tee/green par trou autour d'un point déjà connu (ex: golf sélectionné dans une
// liste de désambiguïsation) — pas de nouveau géocodage.
export async function prefillFromCoordinates(center) {
  const elements = await fetchGolfElements(center);
  const matches = matchHolesToFeatures(elements, center);
  return { center, matches };
}

// Point d'entrée principal : lieu -> repères approximatifs par trou. Un seul appel Overpass.
export async function prefillFromOpenStreetMap(locationQuery) {
  const center = await resolveApproximateLocation(locationQuery);
  return prefillFromCoordinates(center);
}

const GOLF_SEARCH_RADIUS_M = 3000;

// Repli quand la détection automatique (par nom de golf) ne trouve rien : géocode une
// adresse libre puis liste les golfs (leisure=golf_course) alentour, pour désambiguïsation
// si plusieurs sont trouvés à proximité.
export async function findGolfCoursesByAddress(address) {
  const center = await resolveApproximateLocation(address);
  const query = `[out:json][timeout:25];(`
    + `way["leisure"="golf_course"](around:${GOLF_SEARCH_RADIUS_M},${center.lat},${center.lng});`
    + `relation["leisure"="golf_course"](around:${GOLF_SEARCH_RADIUS_M},${center.lat},${center.lng});`
    + `);out center tags;`;

  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) {
    throw new Error('Requête OpenStreetMap impossible (serveur indisponible).');
  }
  const data = await response.json();

  const courses = (data.elements ?? [])
    .map((el) => ({ name: el.tags?.name ?? 'Golf sans nom', position: elementPosition(el) }))
    .filter((c) => c.position)
    .map((c) => ({ ...c, distance: Math.round(haversineDistance(center, c.position)) }))
    .sort((a, b) => a.distance - b.distance);

  return { center, courses };
}

// Extrait l'identifiant numérique d'une URL de way OpenStreetMap
// (ex: https://www.openstreetmap.org/way/34513467 -> "34513467").
export function extractOsmWayId(url) {
  const match = /openstreetmap\.org\/way\/(\d+)/.exec(url.trim());
  return match ? match[1] : null;
}

// Repli direct quand l'utilisateur a déjà identifié la bonne page way sur
// openstreetmap.org : récupère son centre sans passer par un géocodage Nominatim.
export async function resolveOsmWayLink(url) {
  const wayId = extractOsmWayId(url);
  if (!wayId) {
    throw new Error('Lien OpenStreetMap invalide (attendu : .../way/12345).');
  }
  const query = `[out:json][timeout:25];way(${wayId});out center tags;`;
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) {
    throw new Error('Requête OpenStreetMap impossible (serveur indisponible).');
  }
  const data = await response.json();
  const way = (data.elements ?? [])[0];
  const position = way ? elementPosition(way) : null;
  if (!position) {
    throw new Error(`Way OpenStreetMap #${wayId} introuvable.`);
  }
  return { name: way.tags?.name ?? `Way OSM #${wayId}`, position };
}
