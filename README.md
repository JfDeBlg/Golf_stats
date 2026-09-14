# GolfStats

PWA installable (iPhone Safari/Chrome) pour un joueur unique : carte de score de golf avec
calcul automatique brut/stableford net, et assistance GPS ponctuelle (calibration de
parcours, distance au drapeau, distance réelle des coups pleins).

Version actuelle : **1.2.57** (voir `src/version.js`).

## Principes non négociables

- **Aucun `watchPosition`** : chaque prise de position GPS est un `getCurrentPosition`
  ponctuel déclenché par une action explicite de l'utilisateur, jamais un suivi continu.
- **Hors-ligne dès qu'un golf est configuré** : Service Worker (cache-first) + IndexedDB.
  Aucune fonctionnalité de saisie manuelle ne dépend du réseau.
- **Le GPS complète, ne remplace jamais** : toute fonctionnalité GPS (calibration,
  distance, géolocalisation auto) a un repli manuel toujours disponible et fonctionnel,
  y compris permission refusée ou signal absent.
- **HTML/CSS/JS vanilla** : pas de framework, pas de bundler, pas de dépendance npm sauf
  strictement nécessaire — trois exceptions à ce jour, toutes vendorées localement et jamais
  chargées depuis un CDN : pdf.js (import de cartes de score), JSZip (export/partage en ZIP)
  et jsPDF (export PDF d'une partie depuis la Carte de score). Même principe pour les icônes :
  uniquement des tracés SVG inline dans
  `src/icons/icons.js` (parfois inspirés d'un set existant comme Tabler Icons, mais jamais
  chargés via une police d'icônes ou un CDN).
- **Pas de sauvegarde silencieuse possible sur iPhone** (aucun accès disque persistant hors
  de l'app) : après une action importante (création/modification de parcours, clôture de
  partie), un bandeau non bloquant (`src/ui/toast.js`) rappelle d'exporter, avec un raccourci
  direct vers l'export déjà existant — jamais de tentative de sauvegarde automatique.
- **Couleurs toujours via les variables de thème** (`:root` dans `style.css`), jamais une
  couleur figée (`#fff`, `#eee`, etc.) à côté d'une couleur qui suit déjà le thème — sinon
  texte et fond peuvent diverger et devenir illisibles en thème sombre (bug rencontré et
  corrigé en 1.2.52 sur `.btn-secondary` et les états `:active` de plusieurs listes, puis en
  1.2.54 sur `--color-primary` utilisée comme couleur de *texte* — courbes/points des
  graphiques, aperçus, messages de succès — jamais redéfinie en thème sombre et donc quasi
  invisible sur fond presque noir ; remplacée par `--color-accent-text`, adaptée par thème).

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
    puttsObjective.js         Objectif de putts (18 trous) pour un index de handicap donné,
                              par interpolation linéaire dans PUTTS_OBJECTIVE_TABLE
                              (extrapolation si l'index est hors de la plage 0-30)

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

  export/
    pdfLib.js                Chargement paresseux partagé de jsPDF (loadJsPDF), utilisé par
                              roundPdf.js et statsPdf.js — un seul point de chargement,
                              jamais au démarrage de l'app
    roundPdf.js              Génère le PDF (une page) d'export d'une partie depuis la Carte
                              de score : total réel des putts + ligne "Moyenne putts"
                              séparée (corrigé en 1.2.57, la colonne Putts du total
                              affichait la moyenne par erreur)
    statsPdf.js              Génère le PDF (une ou plusieurs pages) d'export des
                              Statistiques pour les filtres actifs (Golf/Année/Mois/Club) :
                              valeurs chiffrées uniquement (pas de graphiques reproduits en
                              image), construites par buildStatsExportSummary
                              (src/views/stats.js) à partir des mêmes fonctions de calcul
                              que l'écran, pour qu'export et affichage ne divergent jamais ;
                              putts objectif et réel affichés sur les deux échelles (total/18
                              trous ET moyenne/trou), ex: "Réel : 35,2 putts/18 trous
                              (1,96/trou)"

  lib/
    pdf.js, pdf.worker.js     pdf.js (build legacy, vendoré) — extraction de texte PDF
    jszip.min.js               JSZip 3.10.1 (build UMD, vendoré) — génération du ZIP
                              d'export/partage ; chargé paresseusement via un <script>
                              classique injecté à la demande, jamais au démarrage
    jspdf.umd.min.js            jsPDF 2.5.1 (build UMD, vendoré) — génération du PDF d'export
                              de partie ; même chargement paresseux via <script> injecté

  data/
    standardClubs.js          Liste standard de clubs suggérée dans Réglages
    shotOptions.js             Options de lie arrivée (7, dont Green/Avant-green/
                                Out-Perdue), de style de coup (10, dont Topée/Air shot/
                                Socket) et de contact (Bon/Moyen/Mauvais)
    puttsObjectiveTable.js      Table de référence "objectif de putts sur 18 trous" par index
                                de handicap (0 à 30, pas de 5), utilisée en Statistiques via
                                scoring/puttsObjective.js

  ui/
    formHelpers.js             createField (champ label+input), createInlineField (libellé en
                                préfixe dans le même cadre), createCheckboxField (case à cocher
                                + libellé sur une seule ligne), createButtonGroup (sélection
                                unique, ex: lie/style), formatGolfName (casse d'affichage
                                uniforme d'un nom de golf, jamais appliquée aux noms d'origine
                                externe déjà correctement casés comme les résultats
                                OpenStreetMap), sortCoursesByName (tri alphabétique insensible
                                à la casse, seul point de vérité pour toutes les listes de
                                golfs de l'app)
    filters.js                   Barre de filtres partagée (Golf/Année/Mois + Club en
                                  option), liste de golfs triée via sortCoursesByName —
                                  Reprendre une partie, Historique, Statistiques ;
                                  le champ Club, quand demandé, est renvoyé séparément
                                  (`clubFilterElement`) pour que l'appelant puisse le
                                  positionner ailleurs dans l'écran (cf. Statistiques)
    icons.js                    Construit un <svg> DOM à partir du set d'icônes inline
    lineChart.js                Mini-graphique en ligne SVG (sans dépendance externe) ;
                                  échelle adaptative (min/max des données + marge ~8 %),
                                  ligne objectif (ambre) et ligne de moyenne réelle (orange,
                                  --color-chart-average) ; graduations numériques sur l'axe Y
                                  (min, max, + la valeur de la moyenne si elle ne chevauche
                                  pas les deux autres — au plus 3 nombres affichés)
    barChart.js                  Mini-graphique à barres SVG (distribution des scores par
                                  rapport au par, Statistiques)
    helpOverlay.js               createHelpButton(texte) : bouton "?" réutilisable ouvrant
                                  une bulle d'aide plein écran (fermeture par croix, clic
                                  extérieur ou Échap) ; superposée en dehors du routeur, donc
                                  sa fermeture ne modifie jamais l'historique de navigation
    toast.js                     showSaveReminderToast() : bandeau non bloquant de rappel de
                                  sauvegarde, avec raccourci direct vers l'export existant ;
                                  affiché après création/modification de parcours et clôture
                                  de partie (pas de sauvegarde silencieuse possible sur iPhone)

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
                                   casse) via sortCoursesByName, noms affichés en casse
                                   phrase (formatGolfName), bouton d'aide expliquant les
                                   icônes de statut de calibration
    courseNew.js                   Création manuelle d'un parcours
    courseImportPdf.js             Import PDF -> pré-remplissage du formulaire de création ;
                                    bouton d'aide + lien vers le générateur de carte de score
                                    en ligne ; pdf.js chargé paresseusement à l'usage
    courseEdit.js                   Édition d'un parcours existant ; liste de sélection
                                    triée via sortCoursesByName (depuis la 1.2.56 — absent
                                    par erreur jusque-là malgré la règle déjà posée en 1.2.51)
    courseDelete.js                 Suppression d'un parcours ; même tri sortCoursesByName
    courseCalibrate.js              Calibration GPS trou par trou ; bouton d'aide ; amorce
                                    OpenStreetMap par lieu approximatif OU par lien
                                    OpenStreetMap direct (.../way/<id>), chacun avec sa
                                    propre gestion d'erreur indépendante ; green calibrable
                                    jusqu'à 3 points (entrée/milieu/sortie,
                                    Hole.greenPositions), seul le milieu est requis pour
                                    marquer le trou comme calibré ; liste de golfs triée via
                                    sortCoursesByName
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
                                       liste de golfs triée via sortCoursesByName ; bouton
                                       d'aide
    play.js                           Écran de jeu : un trou à la fois, navigation
                                       circulaire, score/putts/coups, statut de trou. Bouton
                                       de bascule rapide Expert/Novice en haut à gauche (même
                                       ligne que le bouton d'aide), même réglage
                                       Player.appMode que Réglages — change immédiatement
                                       l'affichage de l'écran en cours, sans y passer.
                                       En-tête ("Trou n - Par n - Hcp n - distance en m")
                                       toujours visible pendant le défilement (sticky) ; libellés
                                       "Score brut"/"Putts" en préfixe dans le cadre du champ
                                       (createInlineField) ; case "En régulation sur green"
                                       (GIR) sous Putts, case et libellé sur la même ligne
                                       (createCheckboxField) ; barre Suivant/Précédent épinglée en
                                       bas d'écran (.hole-nav-fixed), bouton "remonter en
                                       haut" juste au-dessus ; "Distance au green" affiche les
                                       3 distances Entrée/Milieu/Sortie si calibrées, sinon
                                       seulement Milieu ; par coup, boutons GPS explicites
                                       Départ/Arrivée (ping ponctuel haute précision chacun),
                                       distance calculée et affichée dès que les deux sont
                                       connues — Départ préempli depuis le départ calibré (1er
                                       coup) ou l'Arrivée du coup précédent (coups suivants),
                                       toujours ré-pingable ; coordonnées brutes (+ précision
                                       GPS) de chaque position figée affichées sous les
                                       boutons ; bouton d'aide ; toast de rappel de sauvegarde
                                       après "Terminer la partie"
    scorecard.js                      Carte de score (lecture seule / mode édition), tableau
                                       identique en mode Expert et Simplifié depuis la 1.2.55 ;
                                       bouton "Export partie" (PDF via jsPDF, partagé/téléchargé
                                       comme l'export ZIP) ; toast de rappel de sauvegarde
                                       après "Terminer la partie"
    history.js                        Historique des parties terminées, même tableau (Écart
                                       au par signé) et même normalisation à 18 trous que
                                       Reprendre une partie, filtrable (Golf/Année/Mois)
    stats.js                          Statistiques : table de référence + objectif de putts
                                       personnalisé par index (interpolation linéaire,
                                       puttsObjective.js), putts (total ramené à 18 trous),
                                       % GIR, stableford (ramené à 18 trous), évolution de la
                                       régulation sur green, distribution des scores par
                                       rapport au par, distance par club, analyses
                                       lie/style/contact ; les trois graphiques en ligne ont
                                       une échelle adaptative (marge ~8 % autour des données +
                                       ligne objectif), une ligne orange de moyenne réelle en
                                       plus de la ligne ambre d'objectif (sauf régulation sur
                                       green, sans objectif), et jusqu'à 3 graduations
                                       numériques sur l'axe Y (min/max + valeur de la moyenne)
                                       ; filtres Golf/Année/Mois en haut
                                       (s'appliquent à tout), filtre Club positionné sous les
                                       graphiques, juste au-dessus des sections qu'il affecte
                                       réellement ; bouton "Export" (PDF récapitulatif des
                                       valeurs chiffrées pour les filtres actifs, sans les
                                       graphiques, via jsPDF — buildStatsExportSummary
                                       garantit que le PDF ne peut pas diverger de l'écran) ;
                                       bouton d'aide
```

## Modèle de données (IndexedDB)

- **Player** *(singleton)* : `gender`, `firstName`, `lastName`, `handicapIndex`, `appMode`
  (`"expert" | "simplified"`)
- **Club** : `id`, `name`, `order`, `targetDistance`
- **Course** : `id`, `name`, `location`, `source`
  (`"manual" | "pdf_import" | "osm_prefilled" | "calibrated"`), `recommendedTees[]`
  (`{color, slope, sss}`), `holes[]` (`{number, par, strokeIndex, distanceByTee,
  teePositions, greenPositions}`) — `greenPositions` : `{front?, middle?, back?}` (chacun un
  point GPS optionnel ; seul `middle` est requis pour qu'un trou compte comme calibré)
- **Round** : `id`, `date`, `courseId`, `teeColor`, `handicapIndexAtPlay`, `courseHandicap`,
  `startHole`, `status` (`"in_progress" | "completed"`), `weather`, `holeScores[]`
- **HoleScore** : `holeNumber`, `status` (`"not_played" | "played" | "abandoned"`),
  `grossScore`, `putts`, `girHit` (booléen, régulation sur green — saisie manuelle, défaut
  `false`, sans calcul automatique), `stablefordNetPoints`, `shots[]`
- **Shot** : `clubId`, `isFullShot`, `startPosition`, `endPosition`, `distance`, `lie`
  (7 valeurs, dont Green/Avant-green/Out-Perdue), `shape` (10 valeurs, dont Topée/Air
  shot/Socket), `contact` (Bon/Moyen/Mauvais ou `null`)
- **Position** (`teePositions[color]`, `greenPositions.{front,middle,back}`,
  `Shot.startPosition`/`endPosition`) : `{lat, lng, accuracy}` — `accuracy` (mètres, issu de
  `coords.accuracy`) est optionnelle et sert uniquement à l'affichage (transparence sur la
  précision réelle du GPS), jamais dans les calculs de distance

`Course.source` ne bascule vers `"calibrated"` que via une calibration manuelle sur place
qui complète les 18 trous ; un préremplissage OpenStreetMap marque `"osm_prefilled"` et ne
devient jamais `"calibrated"` de lui-même.

`Course.location` n'a plus de champ de saisie manuelle dans le formulaire de golf depuis la
1.2.51 (la localisation vient désormais uniquement de la calibration GPS/OpenStreetMap) ;
le champ reste dans le modèle de données pour compatibilité et sert encore de préremplissage
optionnel du champ de recherche OSM en calibration quand il est déjà renseigné.

Depuis la 1.2.54, `Shot.startPosition`/`endPosition` ne sont plus chaînés implicitement par
"Ajouter un coup" (comportement du Lot 2) : chaque coup a ses propres boutons Départ/Arrivée
dans `play.js`, chacun déclenchant son propre ping GPS ponctuel. "Ajouter un coup" se
contente de préremplir `startPosition` (départ calibré pour le 1er coup du trou, sinon
`endPosition` du coup précédent si déjà renseignée) — sans jamais géolocaliser lui-même.

Depuis la 1.2.55, `Hole.greenPosition` (point unique) est remplacé par `Hole.greenPositions`
(`{front, middle, back}`). Migration à la lecture, sans perte : `src/db/repository.js`
(`getCourse`/`getCourses`) retraite à la volée un `Hole.greenPosition` hérité en
`greenPositions.middle` ; `src/scoring/calibration.js` (`getMiddleGreen`) retombe aussi sur
l'ancien champ par sécurité. Rien n'est réécrit en base tant que le golf n'est pas
réenregistré (calibration, édition...) — un export JSON/ZIP réalisé en 1.2.54 ou antérieur
s'importe donc sans erreur en 1.2.55.

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
| 1.2.54 | **Contraste thème sombre** : graphiques Statistiques (courbe, points, chiffres d'axe) et aperçus (dont la distance au green) utilisaient `--color-primary` (vert très sombre, jamais redéfini en thème sombre) comme couleur de texte, quasi invisibles sur fond presque noir — remplacés par `--color-accent-text` (clair en thème sombre), lignes de référence "objectif" éclaircies (`--color-chart-target`) ; **écran de jeu** : en-tête ("Trou n - Par n - distance en m") rendu `sticky`, toujours visible pendant le défilement des coups ; **coups** : chaînage GPS implicite du Lot 2 remplacé par des boutons explicites Départ/Arrivée par coup (ping ponctuel haute précision chacun), distance calculée et affichée automatiquement dès que les deux sont connues, Départ préempli (départ calibré pour le 1er coup, Arrivée du coup précédent sinon) mais toujours ré-pingable ; champ Lie renommé "Lie arrivée" et étendu (+ Green, Avant-green, Out/Perdue) ; Style de coup étendu (+ Topée, Air shot, Socket) ; nouveau champ Contact (Bon/Moyen/Mauvais) ; nouvelle case "En régulation sur green" (GIR) au niveau du trou ; **Statistiques** : nouvelle section Contact, nouveau "% en régulation sur green", nouveau graphique en barres de distribution des scores par rapport au par (Eagle/Birdie/Par/Bogey/Double/Triple ou plus, `src/ui/barChart.js`) |
| 1.2.55 | **Rappel de sauvegarde** : bandeau non bloquant (`src/ui/toast.js`) après création/modification de parcours et clôture de partie, avec raccourci direct vers l'export existant (pas de sauvegarde silencieuse possible sur iPhone) ; **mode Simplifié** : Carte de score identique au mode Expert (Trou/Par/Score/Écart/Pts/Putts, plus de tableau réduit) — la différence entre modes reste uniquement dans l'écran de jeu ; **graphiques Statistiques** : échelle adaptative (min/max des données + marge ~8 %) sur Putting/Stableford/nouveau graphique Régulation sur green, ligne rouge de moyenne réelle en plus de la ligne orange d'objectif ; métrique Putting remplacée par le total de putts ramené à 18 trous ; nouvel **objectif de putts personnalisé** par index de handicap (interpolation linéaire dans une table de référence, `src/data/puttsObjectiveTable.js` + `src/scoring/puttsObjective.js`), affiché en Statistiques avant le graphique Putting et utilisé comme ligne objectif ; **écran de jeu** : en-tête enrichi (`Trou n - Par n - Hcp n - distance`), barre Suivant/Précédent épinglée en bas d'écran + bouton "remonter en haut", libellés "Score brut"/"Putts" en préfixe du champ (`createInlineField`), coordonnées GPS brutes (+ précision) affichées sous les boutons Départ/Arrivée de chaque coup ; **green multi-points** : jusqu'à 3 repères par trou (Entrée/Milieu/Sortie, `Hole.greenPositions`, migration transparente depuis l'ancien `Hole.greenPosition`), "Distance au green" affiche les 3 distances si calibrées ; **Carte de score** : bouton "Export partie" (PDF via jsPDF vendoré, partagé/téléchargé comme l'export ZIP) |

| 1.2.56 | **Audit tri/casse des listes de golfs** : la règle posée en 1.2.51 (tri alphabétique insensible à la casse + casse phrase, partout) n'était en réalité appliquée qu'à Gestion parcours — `sortCoursesByName` (`src/ui/formHelpers.js`) créé comme seul point de vérité et appliqué aussi à Modifier parcours, Supprimer parcours, Calibration GPS, Nouvelle partie et au filtre Golf partagé (`src/ui/filters.js`, Reprendre une partie/Historique/Statistiques) ; **graphiques Statistiques** : jusqu'à 3 graduations numériques sur l'axe Y (min, max, + valeur de la moyenne si elle ne chevauche pas les deux autres), ligne de moyenne recolorée en orange (`--color-chart-average`) au lieu de rouge, volontairement distincte de l'ambre déjà utilisé par la ligne objectif ; **écran de jeu** : case "En régulation sur green" et son libellé alignés sur une seule ligne (`createCheckboxField`, `src/ui/formHelpers.js`) au lieu d'être empilés |

| 1.2.57 | **Écran de jeu** : bouton de bascule rapide Expert/Novice en haut à gauche (même ligne que le bouton d'aide) — même réglage `Player.appMode` que Réglages, change immédiatement l'affichage de l'écran en cours sans y passer ; **export PDF Carte de score** : correctif — la colonne Putts de la ligne "Total" affichait par erreur la moyenne au lieu de la somme réelle, désormais corrigée, avec une ligne "Moyenne putts" séparée en dessous ; nouveau **bouton "Export" en Statistiques** : PDF récapitulatif (valeurs chiffrées uniquement, pas de graphiques) pour les filtres Golf/Année/Mois/Club actuellement sélectionnés, via `src/export/statsPdf.js` et `buildStatsExportSummary` (`src/views/stats.js`, réutilise les mêmes fonctions de calcul que l'écran) — putts objectif et réel affichés sur les deux échelles (total/18 trous et moyenne/trou) pour rester comparables ; chargement de jsPDF factorisé dans `src/export/pdfLib.js`, partagé entre `roundPdf.js` et `statsPdf.js` |

## Tenir ce README à jour

**Ce fichier doit être mis à jour à chaque lot ou correctif** : nouvelle fonctionnalité,
fichier ajouté/supprimé, changement du modèle de données, ou changement de version.
Au minimum, ajouter une ligne à l'historique des versions et refléter toute nouvelle
structure de fichier dans l'arborescence ci-dessus.
