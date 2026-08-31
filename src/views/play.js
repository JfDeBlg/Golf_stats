// Écran de jeu : saisie manuelle trou par trou, navigation circulaire libre
// (le trou 18 renvoie au trou 1 et inversement), avec statut par trou
// (not_played / played / abandoned). C'est le même composant qu'on atteigne un trou en
// jouant normalement (navigation précédent/suivant) ou en cliquant une ligne de la carte
// de score (partie en cours ou terminée, en mode édition) — un seul écran, plusieurs
// points d'entrée. En mode Simplifié (Player.appMode), seuls le score et les putts sont
// saisissables : ni bouton club, ni bouton distance, ni détail de coup.

import { getRound, getCourse, saveRound, getClubs, getPlayer } from '../db/repository.js';
import { computeNetStablefordPoints } from '../scoring/stableford.js';
import { haversineDistance } from '../scoring/distance.js';
import { getCurrentPositionOnce } from '../geo/geolocation.js';
import { createField, createButtonGroup } from '../ui/formHelpers.js';
import { createIcon } from '../ui/icons.js';
import { createHelpButton } from '../ui/helpOverlay.js';
import { LIE_OPTIONS, SHAPE_OPTIONS, CONTACT_OPTIONS } from '../data/shotOptions.js';

const PLAY_HELP_TEXT = [
  "L'en-tête (trou, par, distance totale du départ joué) reste visible en haut de l'écran pendant que vous faites défiler les coups.",
  "Sur chaque coup : les boutons \"Départ\" et \"Arrivée\" font chacun un ping GPS ponctuel ; dès que les deux sont renseignés, la distance parcourue est calculée et affichée automatiquement. Le premier coup d'un trou est préempli avec le départ calibré ; les coups suivants reprennent l'arrivée du coup précédent si elle est déjà renseignée — vous pouvez toujours repinguer pour corriger.",
  "\"En régulation sur green\" (GIR) se coche manuellement une fois le trou terminé, si le green a été atteint en par − 2 coups ou moins.",
];

function nextHoleNumber(n) {
  return n >= 18 ? 1 : n + 1;
}

function prevHoleNumber(n) {
  return n <= 1 ? 18 : n - 1;
}

export async function renderPlay(container, params, navigate) {
  const round = await getRound(params.roundId);
  const course = await getCourse(round.courseId);
  const holeNumber = params.holeNumber ?? round.startHole ?? 1;
  const hole = course.holes.find((h) => h.number === holeNumber);
  const holeScore = round.holeScores.find((hs) => hs.holeNumber === holeNumber);
  const editMode = params.editMode ?? false;
  const player = await getPlayer();
  const isSimplified = player?.appMode === 'simplified';

  const headerRow = document.createElement('div');
  headerRow.className = 'screen-header-row';
  headerRow.appendChild(createHelpButton(PLAY_HELP_TEXT));
  container.appendChild(headerRow);

  const wrapper = document.createElement('div');
  wrapper.className = 'play-view';

  const header = document.createElement('div');
  header.className = 'play-header';
  const headerTitle = document.createElement('h2');
  const teeDistance = hole.distanceByTee?.[round.teeColor];
  headerTitle.textContent = `Trou ${holeNumber} - Par ${hole.par}` + (teeDistance != null ? ` - ${teeDistance}m` : '');
  header.appendChild(headerTitle);
  wrapper.appendChild(header);

  if (!isSimplified) {
    const distanceBtn = document.createElement('button');
    distanceBtn.type = 'button';
    distanceBtn.className = 'btn-secondary';
    distanceBtn.textContent = 'Distance au green';
    const distanceResult = document.createElement('p');
    distanceResult.className = 'hint';
    distanceBtn.addEventListener('click', async () => {
      if (!hole.greenPosition) {
        distanceResult.className = 'hint';
        distanceResult.textContent = 'Green non calibré pour ce trou.';
        return;
      }
      distanceResult.className = 'hint';
      distanceResult.textContent = 'Localisation en cours…';
      try {
        const position = await getCurrentPositionOnce();
        const distance = Math.round(haversineDistance(position, hole.greenPosition));
        distanceResult.className = 'stableford-preview';
        distanceResult.textContent = `Distance au green : ${distance} m`;
      } catch (err) {
        distanceResult.className = 'error-msg';
        distanceResult.textContent = err.message;
      }
    });
    wrapper.appendChild(distanceBtn);
    wrapper.appendChild(distanceResult);
  }

  async function persist() {
    await saveRound(round);
  }

  async function goToHole(n) {
    await persist();
    navigate('play', { roundId: round.id, holeNumber: n, editMode }, { replace: true });
  }

  if (holeScore.status === 'abandoned') {
    const abandonedInfo = document.createElement('p');
    abandonedInfo.className = 'hint';
    abandonedInfo.textContent = `Trou marqué non terminé — score forfaitaire : ${holeScore.grossScore} (par + 3)`;
    wrapper.appendChild(abandonedInfo);

    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.className = 'btn-secondary';
    undoBtn.textContent = "Annuler l'abandon";
    undoBtn.addEventListener('click', async () => {
      holeScore.status = 'not_played';
      holeScore.grossScore = null;
      holeScore.putts = null;
      holeScore.stablefordNetPoints = 0;
      await goToHole(holeNumber);
    });
    wrapper.appendChild(undoBtn);
  } else {
    const form = document.createElement('form');
    form.className = 'form';

    const grossInput = document.createElement('input');
    grossInput.type = 'number';
    grossInput.min = '1';
    grossInput.value = holeScore.grossScore ?? '';
    form.appendChild(createField('Score brut', grossInput));

    const puttsInput = document.createElement('input');
    puttsInput.type = 'number';
    puttsInput.min = '0';
    puttsInput.value = holeScore.putts ?? '';
    form.appendChild(createField('Putts', puttsInput));

    const girInput = document.createElement('input');
    girInput.type = 'checkbox';
    girInput.checked = holeScore.girHit === true;
    form.appendChild(createField('En régulation sur green', girInput));
    girInput.addEventListener('change', async () => {
      holeScore.girHit = girInput.checked;
      await persist();
    });

    const stablefordPreview = document.createElement('p');
    stablefordPreview.className = 'stableford-preview';
    form.appendChild(stablefordPreview);

    function updatePreview() {
      const gross = grossInput.value === '' ? null : parseInt(grossInput.value, 10);
      if (gross == null) {
        stablefordPreview.textContent = '';
        return;
      }
      const points = computeNetStablefordPoints(gross, hole.par, round.courseHandicap, hole.strokeIndex);
      stablefordPreview.textContent = `Points stableford net : ${points}`;
    }

    async function persistScore() {
      const gross = grossInput.value === '' ? null : parseInt(grossInput.value, 10);
      const putts = puttsInput.value === '' ? null : parseInt(puttsInput.value, 10);
      if (gross != null) {
        holeScore.status = 'played';
        holeScore.grossScore = gross;
        holeScore.putts = putts;
        holeScore.stablefordNetPoints = computeNetStablefordPoints(gross, hole.par, round.courseHandicap, hole.strokeIndex);
      } else {
        holeScore.status = 'not_played';
        holeScore.grossScore = null;
        holeScore.putts = null;
        holeScore.stablefordNetPoints = 0;
      }
      await persist();
    }

    grossInput.addEventListener('input', updatePreview);
    grossInput.addEventListener('change', persistScore);
    puttsInput.addEventListener('change', persistScore);
    updatePreview();

    wrapper.appendChild(form);

    if (!isSimplified) {
      const shotsSection = document.createElement('div');
      shotsSection.className = 'shots-section';
      const shotsTitle = document.createElement('h3');
      shotsTitle.textContent = 'Coups';
      shotsSection.appendChild(shotsTitle);

      const shotsList = document.createElement('div');
      shotsList.className = 'shots-list';
      shotsSection.appendChild(shotsList);

      const addShotBtn = document.createElement('button');
      addShotBtn.type = 'button';
      addShotBtn.className = 'btn-secondary';
      addShotBtn.appendChild(createIcon('add', { size: 16 }));
      addShotBtn.appendChild(document.createTextNode('Ajouter un coup'));
      shotsSection.appendChild(addShotBtn);

      const clubs = await getClubs();
      const driverClub = clubs.find((c) => c.name.trim().toLowerCase() === 'driver');
      if (clubs.length === 0) {
        addShotBtn.disabled = true;
        const noClubsHint = document.createElement('p');
        noClubsHint.className = 'hint';
        noClubsHint.textContent = 'Configurez vos clubs dans Réglages pour enregistrer des coups.';
        shotsSection.appendChild(noClubsHint);
      }

      function renderShots() {
        shotsList.innerHTML = '';
        holeScore.shots.forEach((shot, idx) => {
          const card = document.createElement('div');
          card.className = 'shot-card';

          const row = document.createElement('div');
          row.className = 'shot-row';

          const clubSelect = document.createElement('select');
          clubs.forEach((c) => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            if (shot.clubId === c.id) opt.selected = true;
            clubSelect.appendChild(opt);
          });
          clubSelect.addEventListener('change', async () => {
            shot.clubId = clubSelect.value;
            await persist();
          });

          const fullShotLabel = document.createElement('label');
          fullShotLabel.className = 'shot-fullshot-label';
          const fullShotCheckbox = document.createElement('input');
          fullShotCheckbox.type = 'checkbox';
          fullShotCheckbox.checked = shot.isFullShot !== false;
          fullShotCheckbox.addEventListener('change', async () => {
            shot.isFullShot = fullShotCheckbox.checked;
            await persist();
          });
          fullShotLabel.appendChild(fullShotCheckbox);
          fullShotLabel.appendChild(document.createTextNode('Coup plein'));

          const distanceInput = document.createElement('input');
          distanceInput.type = 'number';
          distanceInput.min = '0';
          distanceInput.placeholder = 'Distance (m)';
          distanceInput.value = shot.distance ?? '';
          distanceInput.addEventListener('change', async () => {
            shot.distance = distanceInput.value === '' ? null : parseFloat(distanceInput.value);
            await persist();
          });

          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'btn-icon';
          removeBtn.setAttribute('aria-label', 'Retirer ce coup');
          removeBtn.appendChild(createIcon('delete', { size: 16 }));
          removeBtn.addEventListener('click', async () => {
            holeScore.shots.splice(idx, 1);
            await persist();
            renderShots();
          });

          row.appendChild(clubSelect);
          row.appendChild(fullShotLabel);
          row.appendChild(distanceInput);
          row.appendChild(removeBtn);
          card.appendChild(row);

          // Boutons GPS explicites Départ/Arrivée (remplacent le chaînage implicite de la
          // v1.2.0) : chacun fait un ping ponctuel haute précision indépendant. Dès que les
          // deux positions sont connues, la distance (haversine) est calculée et affichée
          // automatiquement dans le champ ci-dessus, sans action supplémentaire. Un échec de
          // géolocalisation ne bloque jamais la saisie du reste du coup.
          const gpsRow = document.createElement('div');
          gpsRow.className = 'shot-gps-row';

          const gpsStatus = document.createElement('p');
          gpsStatus.className = 'hint';

          async function capturePosition(field, btn) {
            gpsStatus.className = 'hint';
            gpsStatus.textContent = 'Localisation en cours…';
            btn.disabled = true;
            try {
              const position = await getCurrentPositionOnce({ enableHighAccuracy: true });
              shot[field] = position;
              if (shot.startPosition && shot.endPosition) {
                shot.distance = Math.round(haversineDistance(shot.startPosition, shot.endPosition));
              }
              await persist();
              renderShots();
            } catch (err) {
              gpsStatus.className = 'error-msg';
              gpsStatus.textContent = err.message;
              btn.disabled = false;
            }
          }

          const startBtn = document.createElement('button');
          startBtn.type = 'button';
          startBtn.className = 'btn-secondary';
          if (shot.startPosition) startBtn.appendChild(createIcon('check', { size: 16 }));
          startBtn.appendChild(document.createTextNode('Départ'));
          startBtn.addEventListener('click', () => capturePosition('startPosition', startBtn));

          const endBtn = document.createElement('button');
          endBtn.type = 'button';
          endBtn.className = 'btn-secondary';
          if (shot.endPosition) endBtn.appendChild(createIcon('check', { size: 16 }));
          endBtn.appendChild(document.createTextNode('Arrivée'));
          endBtn.addEventListener('click', () => capturePosition('endPosition', endBtn));

          gpsRow.appendChild(startBtn);
          gpsRow.appendChild(endBtn);
          card.appendChild(gpsRow);
          card.appendChild(gpsStatus);

          const lieField = document.createElement('div');
          lieField.className = 'shot-subfield';
          const lieLabel = document.createElement('span');
          lieLabel.className = 'hint';
          lieLabel.textContent = 'Lie arrivée';
          lieField.appendChild(lieLabel);
          lieField.appendChild(createButtonGroup(LIE_OPTIONS, shot.lie ?? null, async (value) => {
            shot.lie = value;
            await persist();
          }));
          card.appendChild(lieField);

          const shapeField = document.createElement('div');
          shapeField.className = 'shot-subfield';
          const shapeLabel = document.createElement('span');
          shapeLabel.className = 'hint';
          shapeLabel.textContent = 'Style de coup';
          shapeField.appendChild(shapeLabel);
          shapeField.appendChild(createButtonGroup(SHAPE_OPTIONS, shot.shape ?? null, async (value) => {
            shot.shape = value;
            await persist();
          }));
          card.appendChild(shapeField);

          const contactField = document.createElement('div');
          contactField.className = 'shot-subfield';
          const contactLabel = document.createElement('span');
          contactLabel.className = 'hint';
          contactLabel.textContent = 'Contact';
          contactField.appendChild(contactLabel);
          contactField.appendChild(createButtonGroup(CONTACT_OPTIONS, shot.contact ?? null, async (value) => {
            shot.contact = value;
            await persist();
          }));
          card.appendChild(contactField);

          shotsList.appendChild(card);
        });
      }

      // Premier coup d'un trou : startPosition préemplie avec le départ calibré du round
      // (Hole.teePositions[teeColor]) — l'utilisateur peut toujours appuyer sur "Départ"
      // pour forcer un ping live. Coups suivants : startPosition préemplie avec
      // l'endPosition du coup précédent si elle est déjà renseignée, sinon laissée vide
      // (aucun ping GPS n'est déclenché ici — seuls les boutons Départ/Arrivée de chaque
      // coup en déclenchent un).
      addShotBtn.addEventListener('click', async () => {
        const isFirstShot = holeScore.shots.length === 0;
        let startPosition = null;
        if (isFirstShot) {
          startPosition = hole.teePositions?.[round.teeColor] ?? null;
        } else {
          const previousShot = holeScore.shots[holeScore.shots.length - 1];
          startPosition = previousShot.endPosition ? { ...previousShot.endPosition } : null;
        }

        holeScore.shots.push({
          clubId: (isFirstShot ? driverClub?.id : null) ?? clubs[0]?.id ?? null,
          isFullShot: true,
          startPosition,
          endPosition: null,
          distance: null,
          lie: null,
          shape: null,
          contact: null,
        });
        await persist();
        renderShots();
      });

      renderShots();
      wrapper.appendChild(shotsSection);
    }

    const abandonBtn = document.createElement('button');
    abandonBtn.type = 'button';
    abandonBtn.className = 'btn-secondary';
    abandonBtn.textContent = 'Marquer comme non terminé';
    abandonBtn.addEventListener('click', async () => {
      holeScore.status = 'abandoned';
      holeScore.grossScore = hole.par + 3;
      holeScore.putts = null;
      holeScore.stablefordNetPoints = 0;
      await goToHole(nextHoleNumber(holeNumber));
    });
    wrapper.appendChild(abandonBtn);
  }

  const navRow = document.createElement('div');
  navRow.className = 'hole-nav';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'btn-secondary';
  prevBtn.appendChild(createIcon('arrowLeft', { size: 16 }));
  prevBtn.appendChild(document.createTextNode('Précédent'));
  prevBtn.addEventListener('click', () => goToHole(prevHoleNumber(holeNumber)));

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'btn-secondary';
  nextBtn.appendChild(document.createTextNode('Suivant'));
  nextBtn.appendChild(createIcon('arrowRight', { size: 16 }));
  nextBtn.addEventListener('click', () => goToHole(nextHoleNumber(holeNumber)));

  navRow.appendChild(prevBtn);
  navRow.appendChild(nextBtn);
  wrapper.appendChild(navRow);

  const scorecardBtn = document.createElement('button');
  scorecardBtn.type = 'button';
  scorecardBtn.className = 'btn-primary';
  scorecardBtn.textContent = 'Voir la carte de score';
  scorecardBtn.addEventListener('click', async () => {
    await persist();
    navigate('scorecard', { roundId: round.id, editMode });
  });
  wrapper.appendChild(scorecardBtn);

  if (round.status !== 'completed') {
    const finishBtn = document.createElement('button');
    finishBtn.type = 'button';
    finishBtn.className = 'btn-secondary';
    finishBtn.appendChild(createIcon('check', { size: 18 }));
    finishBtn.appendChild(document.createTextNode('Terminer la partie'));
    finishBtn.addEventListener('click', async () => {
      round.status = 'completed';
      await persist();
      navigate('scorecard', { roundId: round.id, editMode });
    });
    wrapper.appendChild(finishBtn);
  }

  container.appendChild(wrapper);
}
