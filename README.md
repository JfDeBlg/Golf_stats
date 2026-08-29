# GolfStats

PWA installable (iPhone Safari/Chrome) pour un joueur unique : carte de score de golf avec
calcul automatique brut/stableford net, et assistance GPS ponctuelle (calibration de
parcours, distance au drapeau, distance réelle des coups pleins).

Version actuelle : **1.2.5** (voir `src/version.js`).

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
  en ZIP).

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
                          (Web Share API, repli sur téléchargement direct si indisponible) ;
                          import acceptant .json ou .zip, avec remplacement total des
                          données après confirmation

  scoring/                Fonctions de calcul pures (aucun accès DOM), testables isolément
    handicap.js            Course Handicap, coups rendus par trou
    stableford.js           Points stableford net par trou
    distance.js              Distance haversine entre deux points GPS
    calibration.js           Complétude de calibration d'un parcours, dérivation de
                              Course.source, point de référence GPS d'un parcours
    roundSummary.js           Score brut et points stableford net d'un round ramenés à 18
                              trous par règle de trois (utilisé par Reprendre une partie et
                              Historique)

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
                                (sélection unique, ex: lie/style)
    filters.js                   Barre de filtres partagée (Golf/Année/Mois + Club en
                                  option) — Reprendre une partie, Historique, Statistiques
    icons.js                    Construit un <svg> DOM à partir du set d'icônes inline
    lineChart.js                Mini-graphique en ligne SVG (sans dépendance externe)
    helpOverlay.js               createHelpButton(texte) : bouton "?" réutilisable ouvrant
                                  une bulle d'aide plein écran (fermeture par croix, clic
                                  extérieur ou Échap) ; superposée en dehors du routeur, donc
                                  sa fermeture ne modifie jamais l'historique de navigation

  icons/
    icons.js                    Set d'icônes SVG inline (pas de police/CDN externe)

  views/                       Un module par écran ; chaque render(container, params,
                                navigate) est appelé par le routeur dans src/main.js
    menu.js                     Menu principal (Nouvelle partie / Reprendre une partie /
                                  Historique / Statistiques / Gestion parcours / Réglages,
                                  chacun avec son icône) ; exporte aussi
                                  MENU_ITEMS/activateMenuItem, réutilisés par le menu
                                  sandwich de src/main.js pour garder un seul ordre partout
    settings.js                  Réglages : profil (dont mode Expert/Simplifié), clubs,
                                  section unique "Sauvegarde / Partage" (export ZIP + partage
                                  natif, import .json ou .zip) — pas de liste de golfs ici
                                  (voir Gestion parcours)
    courseManage.js               Sous-menu Gestion parcours + liste des golfs enregistrés,
                                   triée alphabétiquement (insensible à la casse), noms
                                   affichés en casse phrase (affichage seulement), bouton
                                   d'aide expliquant les icônes de statut de calibration
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
    courseFormShared.js             Formulaire de golf partagé (création/import/édition)
    resumeRound.js                   Tableau de rounds filtrable (Golf/Année/Mois) : Date /
                                       Golf / Score brut / Stableford net, les deux derniers
                                       ramenés à 18 trous par règle de trois (un tiret
                                       uniquement si aucun trou n'a de score)
    roundNew.js                      Démarrage d'une partie (golf, départ, météo, GPS) ;
                                       bouton d'aide
    play.js                           Écran de jeu : un trou à la fois, navigation
                                       circulaire, score/putts/coups, statut de trou
    scorecard.js                      Carte de score (lecture seule / mode édition)
    history.js                        Historique des parties terminées, même tableau et même
                                       normalisation à 18 trous que Reprendre une partie,
                                       filtrable (Golf/Année/Mois)
    stats.js                          Statistiques (putts, stableford, distance par club,
                                       analyse lie/style), filtrables par Golf/Année/Mois,
                                       + Club pour les sections club/coup ; bouton d'aide
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

## Tenir ce README à jour

**Ce fichier doit être mis à jour à chaque lot ou correctif** : nouvelle fonctionnalité,
fichier ajouté/supprimé, changement du modèle de données, ou changement de version.
Au minimum, ajouter une ligne à l'historique des versions et refléter toute nouvelle
structure de fichier dans l'arborescence ci-dessus.
