# GolfStats

PWA installable (iPhone Safari/Chrome) pour un joueur unique : carte de score de golf avec
calcul automatique brut/stableford net, et assistance GPS ponctuelle (calibration de
parcours, distance au drapeau, distance réelle des coups pleins).

Version actuelle : **1.2.53** (voir `src/version.js`).

## Principes non négociables

- **Aucun `watchPosition`** : chaque prise de position GPS est un `getCurrentPosition`
  ponctuel déclenché par une action explicite de l'utilisateur, jamais un suivi continu.
- **Hors-ligne dès qu'un golf est configuré** : Service Worker (cache-first) + IndexedDB.
  Aucune fonctionnalité de saisie manuelle ne dépend du réseau.
- **Le GPS complète, ne remplace jamais** : toute fonctionnalité GPS (calibration,
  distance, géolocalisation auto) a un repli manuel toujours disponible et fonctionnel,
  y compris permission refusée ou signal absent.
- **HTML/CSS/JS vanilla** : pas de framework, pas de bundler, pas de dépendance npm sauf
  strictement nécessaire — deux exceptions à ce jour, toutes deux vendorées localement et
  jamais chargées depuis un CDN : pdf.js (import de cartes de score) et JSZip (export/partage
  en ZIP). Même principe pour les icônes : uniquement des tracés SVG inline dans
  `src/icons/icons.js` (parfois inspirés d'un set existant comme Tabler Icons, mais jamais
  chargés via une police d'icônes ou un CDN).
- **Couleurs toujours via les variables de thème** (`:root` dans `style.css`), jamais une
  couleur figée (`#fff`, `#eee`, etc.) à côté d'une couleur qui suit déjà le thème — sinon
  texte et fond peuvent diverger et devenir illisibles en thème sombre (bug rencontré et
  corrigé en 1.2.52 sur `.btn-secondary` et les états `:active` de plusieurs listes).

## Lancer en local

Aucune installation, aucun build. Servir le dossier en HTTP (ouvrir `index.html`
directement via `file://` ne fonctionne pas : le Service Worker et les modules ES ont
besoin d'une origine HTTP/HTTPS) :

```bash
python -m http.server 8765
# puis ouvrir http://localhost:8765/index.html
```

## Structure du projet

```
index.html            Coquille de l'app (en-tête avec menu sandwich toujours visible +
                        point de montage des vues)
manifest.json          Manifeste PWA (icônes, nom, couleurs, mode standalone)
service-worker.js      Cache-first des assets statiques ; CACHE_NAME versionné
style.css               Feuille de style unique, thème clair/sombre automatique

icons/                  Icônes d'application (manifest, écran d'accueil)

src/
  main.js               Routeur (pile de vues, pas de framework) + menu sandwich du
                          bandeau (accès direct aux options du menu principal depuis
                          n'importe quel écran) + enregistrement du SW
  version.js             Numéro de version affiché dans le menu — à garder sync avec
                          service-worker.js (CACHE_NAME)

  db/
    schema.js            Ouverture IndexedDB (stores : players, clubs, courses, rounds)
    repository.js        CRUD unique vers IndexedDB — seul point d'accès aux données
    exportImport.js       Sérialisation/désérialisation complète : export JSON zippé
                          (JSZip vendoré) partagé via la feuille de partage native
                          (Web Share API, repli sur téléchargement direct si indisponible),
                          ou téléchargé directement (downloadZipFile, sans jamais passer par
                          la feuille de partage) ; import acceptant .json ou .zip, avec
                          remplacement total des données après confirmation

  scoring/                Fonctions de calcul pures (aucun accès DOM), testables isolément
    handicap.js            Course Handicap, coups rendus par trou
    stableford.js           Points stableford net par trou
    distance.js              Distance haversine entre deux points GPS
    calibration.js           Complétude de calibration d'un parcours, dérivation de
                              Course.source, point de référence GPS d'un parcours
    roundSummary.js           Écart au par (signé) et points stableford net d'un round
                              ramenés à 18 trous par règle de trois, + formatToPar (mise en
                              forme "+20"/"-2"/"0", partagée avec la Carte de score) —
                              utilisé par Reprendre une partie et Historique

  geo/
    geolocation.js          Enveloppe autour de navigator.geolocation (ping ponctuel)
    openStreetMap.js         Amorce de calibration via Nominatim (géocodage) + Overpass
                              (repères golf=tee/green/hole, recherche par adresse ou par
                              lien OpenStreetMap direct de type .../way/<id>)

  import/
    pdfScorecard.js          Parseur de carte de score PDF (format
                              des-balles-et-des-birdies.com), reconstruction par position
                              (x, y) des fragments de texte extraits par pdf.js — chargé
                              paresseusement (import() dynamique) au moment de l'usage, pas
                              au démarrage de l'app

  lib/
    pdf.js, pdf.worker.js     pdf.js (build legacy, vendoré) — extraction de texte PDF
    jszip.min.js               JSZip 3.10.1 (build UMD, vendoré) — génération du ZIP
                              d'export/partage ; chargé paresseusement via un <script>
                              classique injecté à la demande, jamais au démarrage

  data/
    standardClubs.js          Liste standard de clubs suggérée dans Réglages
    shotOptions.js             Options de lie et de style de coup

  ui/
    formHelpers.js             createField (champ label+input), createButtonGroup
                                (sélection unique, ex: lie/style), formatGolfName (casse
                                d'affichage uniforme d'un nom de golf, jamais appliquée aux
                                noms d'origine externe déjà correctement casés comme les
                                résultats OpenStreetMap)
    filters.js                   Barre de filtres partagée (Golf/Année/Mois + Club en
                                  option) — Reprendre une partie, Historique, Statistiques ;
                                  le champ Club, quand demandé, est renvoyé séparément
                                  (`clubFilterElement`) pour que l'appelant puisse le
                                  positionner ailleurs dans l'écran (cf. Statistiques)
    icons.js                    Construit un <svg> DOM à partir du set d'icônes inline
    lineChart.js                Mini-graphique en ligne SVG (sans dépendance externe)
    helpOverlay.js               createHelpButton(texte) : bouton "?" réutilisable ouvrant
                                  une bulle d'aide plein écran (fermeture par croix, clic
                                  extérieur ou Échap) ; superposée en dehors du routeur, donc
                                  sa fermeture ne modifie jamais l'historique de navigation

  icons/
    icons.js                    Set d'icônes SVG inline (pas de police/CDN externe) ;
                                  l'icône satellite reprend le tracé officiel de Tabler
                                  Icons (ti-satellite, MIT), inline plutôt que via sa police

  views/                       Un module par écran ; chaque render(container, params,
                                navigate) est appelé par le routeur dans src/main.js
    menu.js                     Menu principal (Nouvelle partie / Reprendre une partie /
                                  Historique / Statistiques / Gestion parcours / Réglages,
                                  chacun avec son icône) ; exporte aussi
                                  MENU_ITEMS/activateMenuItem, réutilisés par le menu
                                  sandwich de src/main.js pour garder un seul ordre partout
    settings.js                  Réglages : profil (dont mode Expert/Simplifié), clubs,
                                  section "Sauvegarde / Partage" avec un encadré distinct
                                  par action (Exporter et partager / Télécharger en ZIP /
                                  Importer .json ou .zip), chacun avec sa propre phrase
                                  d'explication (buildActionBox) — pas de liste de golfs ici
                                  (voir Gestion parcours)
    courseManage.js               Sous-menu Gestion parcours (icônes, dont une icône
                                   satellite classique agrandie pour Calibrer avec le GPS,
                                   inspirée de Tabler ti-satellite) + liste des golfs
                                   enregistrés, triée alphabétiquement (insensible à la
                                   casse), noms affichés en casse phrase (formatGolfName),
                                   bouton d'aide expliquant les icônes de statut de
                                   calibration
    courseNew.js                   Création manuelle d'un parcours
    courseImportPdf.js             Import PDF -> pré-remplissage du formulaire de création ;
                                    bouton d'aide + lien vers le générateur de carte de score
                                    en ligne ; pdf.js chargé paresseusement à l'usage
    courseEdit.js                   Édition d'un parcours existant
    courseDelete.js                 Suppression d'un parcours
    courseCalibrate.js              Calibration GPS trou par trou ; bouton d'aide ; amorce
                                    OpenStreetMap par lieu approximatif OU par lien
                                    OpenStreetMap direct (.../way/<id>), chacun avec sa
                                    propre gestion d'erreur indépendante
    courseFormShared.js             Formulaire de golf partagé (création/import/édition) :
                                    pas de champ Lieu (localisation issue uniquement de la
                                    calibration GPS/OSM), couleur de départ en liste
                                    déroulante (7 couleurs standard), colonne "Handicap" par
                                    trou (ex-"Index (SI)"), bouton d'aide (Slope/SSS/Handicap)
    resumeRound.js                   Tableau de rounds filtrable (Golf/Année/Mois) : Date /
                                       Golf / Écart / Stableford net (écart au par signé,
                                       ex: "+20"/"-2"/"0" ; en-tête Stableford net sur 2
                                       lignes pour laisser plus de place à la colonne Golf),
                                       les deux derniers ramenés à 18 trous par règle de
                                       trois (un tiret uniquement si aucun trou n'a de score)
    roundNew.js                      Démarrage d'une partie (golf, départ, météo, GPS) ;
                                       bouton d'aide
    play.js                           Écran de jeu : un trou à la fois, navigation
                                       circulaire, score/putts/coups, statut de trou
    scorecard.js                      Carte de score (lecture seule / mode édition)
    history.js                        Historique des parties terminées, même tableau (Écart
                                       au par signé) et même normalisation à 18 trous que
                                       Reprendre une partie, filtrable (Golf/Année/Mois)
    stats.js                          Statistiques (putts, stableford, distance par club,
                                       analyse lie/style) ; filtres Golf/Année/Mois en haut
                                       (s'appliquent à tout), filtre Club positionné sous les
                                       deux graphiques, juste au-dessus des sections qu'il
                                       affecte réellement ; bouton d'aide
```

## Modèle de données (IndexedDB)

- **Player** *(singleton)* : `gender`, `firstName`, `lastName`, `handicapIndex`, `appMode`
  (`"expert" | "simplified"`)
- **Club** : `id`, `name`, `order`, `targetDistance`
- **Course** : `id`, `name`, `location`, `source`
  (`"manual" | "pdf_import" | "osm_prefilled" | "calibrated"`), `recommendedTees[]`
  (`{color, slope, sss}`), `holes[]` (`{number, par, strokeIndex, distanceByTee,
  teePositions, greenPosition}`)
- **Round** : `id`, `date`, `courseId`, `teeColor`, `handicapIndexAtPlay`, `courseHandicap`,
  `startHole`, `status` (`"in_progress" | "completed"`), `weather`, `holeScores[]`
- **HoleScore** : `holeNumber`, `status` (`"not_played" | "played" | "abandoned"`),
  `grossScore`, `putts`, `stablefordNetPoints`, `shots[]`
- **Shot** : `clubId`, `isFullShot`, `startPosition`, `endPosition`, `distance`, `lie`,
  `shape`

`Course.source` ne bascule vers `"calibrated"` que via une calibration manuelle sur place
qui complète les 18 trous ; un préremplissage OpenStreetMap marque `"osm_prefilled"` et ne
devient jamais `"calibrated"` de lui-même.

`Course.location` n'a plus de champ de saisie manuelle dans le formulaire de golf depuis la
1.2.51 (la localisation vient désormais uniquement de la calibration GPS/OpenStreetMap) ;
le champ reste dans le modèle de données pour compatibilité et sert encore de préremplissage
optionnel du champ de recherche OSM en calibration quand il est déjà renseigné.

## Historique des versions

| Version | Contenu |
|---|---|
| 1.0.0 (Lot 1) | Socle : profil, sac de clubs, création de parcours, saisie manuelle d'une partie, carte de score, historique, statistiques simples — sans GPS |
| 1.1.0 | Versioning affiché, suggestions de clubs standard, distance par trou/départ, refonte Round/HoleScore (statuts, trous abandonnés, navigation circulaire), graphiques stats, météo, réorganisation du menu |
| 1.1.1 | Fix "Reprendre une partie", carte de score → détail de trou (même composant), coups avec club/distance, liste des golfs dans Gestion parcours, jeu d'icônes SVG inline |
| 1.1.2 | Export/import JSON complet, import de parcours depuis un PDF (pdf.js vendoré), correction de la logique "Reprendre une partie" (round unique/aucun/plusieurs), statistique distance moyenne par club |
| 1.2.0 (Lot 2) | Calibration GPS trou par trou, amorce OpenStreetMap, géolocalisation du golf au lancement d'une partie, distance au drapeau, chaînage GPS des coups pleins |
| 1.2.1 | Carte de score : mode lecture seule / édition, colonne putts, largeur de colonnes ; mode Expert/Simplifié ; distinction `osm_prefilled`/`calibrated` ; recherche OSM par adresse ; lie/style de coup + statistiques associées |
| 1.2.2 | Lignes de référence (objectif) statiques sur les graphiques Putting (2 putts/trou) et Score stableford (36 pts) |
| 1.2.3 | Menu sandwich dans le bandeau (toujours visible, accès direct aux options du menu principal depuis n'importe quel écran) ; correctif d'un bug d'affichage `hidden` (le bouton retour et le menu déroulant restaient visibles malgré l'attribut `hidden`, une classe CSS avec `display` non conditionné écrasant la règle par défaut du navigateur) |
| 1.2.4 | Filtre Club en Statistiques (barre de filtres partagée Golf/Année/Mois/Club, chaque section n'appliquant que les filtres qui la concernent) ; filtres Golf/Année/Mois ajoutés à l'Historique ; composant de filtre partagé (`src/ui/filters.js`) réutilisé aussi par Reprendre une partie |
| 1.2.5 | Renommage de l'app en **GolfStats** ; aide contextuelle (bouton "?" + bulle, `src/ui/helpOverlay.js`) sur Import PDF, Calibration GPS, Gestion parcours, Nouvelle partie, Statistiques ; calibration GPS enrichie d'un second mode de préremplissage par lien OpenStreetMap direct (`.../way/<id>`) en plus de la recherche par lieu approximatif ; menu principal et menu sandwich réordonnés avec icônes (source unique `MENU_ITEMS`) ; suppression de la liste "Golfs calibrés" dans Réglages (doublon de Gestion parcours) ; remplacement de l'ébauche de sauvegarde cloud par un export ZIP (JSZip vendoré) + partage natif (Web Share API), import acceptant .json ou .zip ; tableaux Date/Golf/Score brut/Stableford net (ramenés à 18 trous par règle de trois) sur Reprendre une partie et Historique ; Gestion parcours : tri alphabétique insensible à la casse, affichage en casse phrase, police réduite ; **correctif critique** : import statique de pdf.js dans le graphe de modules de `main.js` pouvant faire échouer le chargement de toute l'app sur certains moteurs iOS (écran blanc, seul le bandeau visible) — converti en `import()` paresseux déclenché à l'usage, plus un filet de sécurité (message d'erreur si `#app` reste vide après 4s) ; règle CSS globale `[hidden] { display: none !important; }` pour garantir définitivement la priorité de l'attribut `hidden` sur toute classe fixant `display` |
| 1.2.51 | Reprendre une partie et Historique : en-têtes "Score brut"/"Stableford net" sur 2 lignes pour élargir la colonne Golf ; Statistiques : filtre Club déplacé sous les deux graphiques, juste au-dessus des sections qu'il affecte (`filterBar.clubFilterElement` retourné séparément par `src/ui/filters.js`) ; casse d'affichage des noms de golf harmonisée partout via une fonction unique (`formatGolfName`, `src/ui/formHelpers.js`) au lieu d'être limitée à Gestion parcours ; formulaire de golf (Nouveau parcours/Modifier parcours/Import PDF) : suppression du champ Lieu (localisation désormais uniquement via calibration GPS/OSM), "Couleur de départ jouée" en liste déroulante (Noir/Blanc/Jaune/Bleu/Rouge/Orange/Violet), colonne par-trou renommée "Index (SI)" -> "Handicap", bouton d'aide expliquant Slope/SSS/Handicap ; icône satellite agrandie pour "Calibrer avec le GPS" dans Gestion parcours ; Réglages : bouton "Télécharger (ZIP)" ajouté à côté de "Exporter et partager" pour un téléchargement direct sans passer par la feuille de partage (utile sur ordinateur) |
| 1.2.52 | Reprendre une partie et Historique : colonne "Score brut" remplacée par "Écart" (écart signé au par, ramené à 18 trous par règle de trois, ex: "+20"/"-2"/"0") — même formatage (`formatToPar`) que celui déjà utilisé par la Carte de score, désormais factorisé dans `src/scoring/roundSummary.js` ; icône satellite remplacée par le tracé officiel Tabler `ti-satellite` (silhouette de satellite classique) dans `src/icons/icons.js` ; **correctif de contraste** : `.btn-secondary` utilisait un fond gris clair figé (`#e9e9e3`) alors que son texte suit le thème — illisible (texte clair sur fond clair) une fois le thème sombre actif ; même bug corrigé sur les états `:active` de `.menu-item`/`.menu-dropdown-item`/lignes de tableau cliquables (`#eee` figé) ; tous remplacés par une variable de thème dédiée (`--color-secondary-bg`, adaptée par thème) — convention documentée directement dans `style.css` ; Réglages : la fonction d'import est désormais entourée d'un encadré distinct (`.import-box`) avec un texte d'orientation selon l'appareil (app Fichiers/Google Drive/dossier Téléchargements) |
| 1.2.53 | Réglages, section "Sauvegarde / Partage" : le bloc unique à 3 boutons devient 3 encadrés séparés (`.action-box`, ex-`.import-box` généralisée), chacun avec sa propre phrase d'explication sous le bouton (Exporter et partager / Télécharger en ZIP / Importer) — ajustement de présentation uniquement, le mécanisme d'export/import est inchangé |

## Tenir ce README à jour

**Ce fichier doit être mis à jour à chaque lot ou correctif** : nouvelle fonctionnalité,
fichier ajouté/supprimé, changement du modèle de données, ou changement de version.
Au minimum, ajouter une ligne à l'historique des versions et refléter toute nouvelle
structure de fichier dans l'arborescence ci-dessus.
