// Enveloppe autour de l'API de géolocalisation du navigateur. Un seul point ponctuel par
// appel via getCurrentPosition — jamais watchPosition (sobriété batterie/data non négociable).

export function getCurrentPositionOnce({ enableHighAccuracy = true, timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Géolocalisation non disponible sur cet appareil.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => reject(new Error(describeGeoError(error))),
      { enableHighAccuracy, timeout }
    );
  });
}

function describeGeoError(error) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Localisation refusée.';
    case error.POSITION_UNAVAILABLE:
      return 'Position indisponible.';
    case error.TIMEOUT:
      return 'Délai de localisation dépassé.';
    default:
      return 'Erreur de localisation.';
  }
}
