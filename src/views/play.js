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
import { LIE_OPTIONS, SHAPE_OPTIONS } from '../data/shotOptions.js';

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

  const wrapper = document.createElement('div');
  wrapper.className = 'play-view';

  const header = document.createElement('div');
  header.className = 'play-header';
  const headerTitle = document.createElement('h2');
  headerTitle.textContent = `Trou ${holeNumber}`;
  const headerInfo = document.createElement('p');
  headerInfo.className = 'hint';
  headerInfo.textContent = `Par ${hole.par} — Index ${hole.strokeIndex}`;
  header.appendChild(headerTitle);
  header.appendChild(headerInfo);
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

          const lieField = document.createElement('div');
          lieField.className = 'shot-subfield';
          const lieLabel = document.createElement('span');
          lieLabel.className = 'hint';
          lieLabel.textContent = 'Lie';
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

          shotsList.appendChild(card);
        });
      }

      // Chaînage des positions : le premier coup part de la position calibrée du départ
      // joué (plus fiable qu'un ping live, l'utilisateur étant exactement sur le repère).
      // Pour les coups suivants, un ping ponctuel sert à la fois de endPosition du coup
      // précédent (et donc de calcul de sa distance, uniquement si ce coup précédent était
      // un coup plein) et de startPosition du nouveau coup. Une géolocalisation refusée ou en
      // échec ne bloque jamais la saisie — le coup est ajouté sans position, sans distance.
      addShotBtn.addEventListener('click', async () => {
        let startPosition = null;
        const isFirstShot = holeScore.shots.length === 0;

        if (isFirstShot) {
          startPosition = hole.teePositions?.[round.teeColor] ?? null;
        } else {
          try {
            const position = await getCurrentPositionOnce();
            const previousShot = holeScore.shots[holeScore.shots.length - 1];
            previousShot.endPosition = position;
            if (previousShot.isFullShot && previousShot.startPosition) {
              previousShot.distance = Math.round(haversineDistance(previousShot.startPosition, position));
            }
            startPosition = position;
          } catch {
            startPosition = null;
          }
        }

        holeScore.shots.push({
          clubId: (isFirstShot ? driverClub?.id : null) ?? clubs[0]?.id ?? null,
          isFullShot: true,
          startPosition,
          endPosition: null,
          distance: null,
          lie: null,
          shape: null,
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
