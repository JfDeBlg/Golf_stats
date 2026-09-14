// Petits utilitaires DOM partagés entre les vues de formulaire.

// Casse d'affichage uniforme pour un nom de golf saisi par l'utilisateur (première lettre
// en majuscule, reste en minuscules) — jamais appliquée aux données elles-mêmes (affichage
// seulement), ni aux noms provenant d'une source externe déjà correctement casée (résultats
// OpenStreetMap).
export function formatGolfName(name) {
  if (!name) return name;
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

let fieldCounter = 0;

export function createField(labelText, inputEl) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';

  const label = document.createElement('label');
  label.textContent = labelText;

  fieldCounter += 1;
  const id = `field-${fieldCounter}`;
  label.htmlFor = id;
  inputEl.id = id;

  wrapper.appendChild(label);
  wrapper.appendChild(inputEl);
  return wrapper;
}

// Variante compacte de createField : le libellé est affiché en préfixe à l'intérieur du même
// cadre que le champ, plutôt qu'au-dessus sur sa propre ligne — utile pour gagner de la place
// verticale (écran de jeu : Score brut / Putts).
export function createInlineField(labelText, inputEl) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field-inline';

  const label = document.createElement('span');
  label.className = 'field-inline-label';
  label.textContent = labelText;

  // Pas de <label for>/id ici : `label` est un <span> (association avec l'input impossible
  // via `for`), à la différence de createField ci-dessus qui utilise un vrai <label>.
  wrapper.appendChild(label);
  wrapper.appendChild(inputEl);
  return wrapper;
}

// Groupe de boutons à sélection unique (ex: lie, style de coup) — cliquer l'option déjà
// sélectionnée la désélectionne (retour à null), pour un champ qui reste optionnel.
export function createButtonGroup(options, selected, onSelect) {
  const container = document.createElement('div');
  container.className = 'button-group';

  function render(current) {
    container.innerHTML = '';
    options.forEach((option) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = current === option ? 'button-group-option active' : 'button-group-option';
      btn.textContent = option;
      btn.addEventListener('click', () => {
        const next = current === option ? null : option;
        onSelect(next);
        render(next);
      });
      container.appendChild(btn);
    });
  }

  render(selected);
  return container;
}
