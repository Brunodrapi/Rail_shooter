# Rail Shooter — Prise d'otage en vol

Rail shooter 2.5D façon Time Crisis / Virtua Cop, pensé pour la **Sinden Light Gun**
et jouable au clavier-souris pour les tests. Tout est en HTML5 + Canvas2D, sans
dépendance ni asset : les décors et les personnages sont dessinés par le code.

**Scénario.** Un gros porteur est aux mains de preneurs d'otages. Le héros
progresse de la queue vers le poste de pilotage, se met à couvert derrière les
chariots de service et les comptoirs d'office, et doit épargner les passagers qui
lèvent les mains.

## Lancer le jeu

```bash
npm start          # puis ouvrir http://localhost:8080
```

Les modules ES ne se chargent pas en `file://`, il faut passer par le serveur
fourni (`serve.mjs`, zéro dépendance, Node 18+).

## Commandes

| Action | Sinden | Clavier-souris |
|---|---|---|
| Viser | pistolet | souris |
| Tirer | gâchette | clic gauche |
| Sortir de la cachette | pédale ou bouton arrière | maintenir Espace |
| Recharger | tir hors écran | clic droit ou R |
| Pause | — | Échap |

Comme sur borne, on ne tire pas à couvert, et se cacher recharge automatiquement.
La case « Pédale en bascule » du menu remplace le maintien par un appui / relâché,
pratique pour tester longtemps au clavier.

## Configurer la Sinden

La Sinden repère le cadre blanc que **son propre logiciel superpose à l'écran**,
puis se présente comme une souris en position absolue. Le jeu ne dessine donc
aucune bordure : il occupe toute la surface.

1. Lancer en plein écran, ou en mode kiosque : `chromium --kiosk http://localhost:8080`.
2. Activer la superposition de bordure dans le logiciel Sinden et la calibrer là-bas.
3. Mapper le tir hors écran sur le **clic droit** et le bouton de cachette sur
   **Espace** ou le bouton milieu.
4. Désactiver l'accélération de la souris côté système.

Le Pointer Lock n'est jamais utilisé : il casserait le pointage absolu.

## Architecture

```
index.html            page plein écran + calques de menu
css/style.css
src/core/renderer.js  projection perspective, découpe au plan proche,
                      algorithme du peintre, tri grossier hors champ
src/core/geometry.js  boîtes, dalles, panneaux
src/core/input.js     souris absolue, gâchette, hors écran, pédale, manette
src/core/audio.js     synthèse Web Audio (aucun fichier son)
src/game/sprites.js   silhouettes procédurales et réticule Virtua Cop
src/game/enemy.js     ennemis, otages, boucliers humains, projectiles
src/game/player.js    vies, chargeur, état de couverture
src/game/director.js  déroulé des sections, beats, embranchements
src/game/game.js      détection de tir, scoring, caméra
src/data/cabin.js     fuselage, sièges, chariots
src/data/campaign.js  le scénario
```

Il n'y a pas de moteur 3D : chaque quadrilatère est projeté à la main puis trié
par profondeur, et les personnages sont des sprites face caméra. C'est ce qui
permet de tenir 60 images par seconde en Canvas2D avec plusieurs milliers de
faces.

### Horloge de mission

Le modèle est celui du premier Time Crisis : **une seule horloge** descend en
permanence, plafonnée à 60 secondes, et tomber à zéro déclenche un game over
immédiat, pas une simple perte de vie. Nettoyer une vague en rend une partie.
Les suites de la série remettent le chrono à plein et ne coûtent qu'une vie ;
c'est le modèle du premier épisode qui est repris ici.

| Réglage | Valeur | Où |
|---|---|---|
| Plafond | 60 s | `CLOCK_MAX` dans `director.js` |
| Départ | 45 s | `CLOCK_START` |
| Bonus par vague | 9 à 20 s selon le nombre de tireurs | `waveBonus()` |
| Durée de référence | 3 s + 2,4 s par tireur | `wavePar()` |
| Prime de rapidité | 150 points par seconde épargnée | `onWaveCleared()` |

Un beat peut forcer ses propres valeurs avec les champs `bonus` et `par`, ce que
fait le combat final du cockpit. L'horloge tourne pendant la progression et le
combat, mais pas pendant les cartons de titre ni le choix d'itinéraire.

### Rythme des vagues

Une vague ne se termine que lorsque **tous les tireurs sont abattus**. Un ennemi
qui a vidé son chargeur replonge derrière les sièges de 0,8 à 1,9 seconde, puis
ressort avec un chargeur plein. Rien ne le fait partir vivant : c'est l'horloge
seule qui sanctionne le joueur trop lent.

### Réticule de menace

Un cercle entoure chaque cible, façon Virtua Cop. Il se resserre et passe du vert
au rouge à mesure que l'ennemi arme son tir. Les otages portent un cercle bleu
barré d'une croix : leur tirer dessus coûte une vie et 500 points.

### Ajouter une section

Une section est une suite de *beats*. Chaque beat est un point d'arrêt de la
caméra, une cachette et une vague. Trois règles suffisent :

- le premier arrêt d'une section reprend la fin de la précédente plus 3,2 m ;
- les ennemis se placent entre 4 et 9 m devant l'arrêt ;
- les tireurs prennent les allées (`x = ±1.4`), les otages les sièges, où ils
  n'émergent que du buste.

Un tableau `exits` à deux entrées crée un embranchement : deux panneaux
apparaissent, le joueur tire sur celui qu'il choisit, et le premier de la liste
s'applique si le temps s'écoule. Les chemins se rejoignent naturellement puisque
plusieurs sections peuvent pointer vers la même suite.

Le parcours actuel :

```
Queue de l'appareil
   ├── Allée bâbord ──┐
   └── Allée tribord ─┴── Office central
                              ├── Pont supérieur ──┐
                              └── Première classe ─┴── Poste de pilotage
```

## Limites connues

- **Un seul joueur.** Le navigateur n'expose qu'un curseur système, donc deux
  Sinden simultanées ne sont pas séparables en HTML pur. Le coop à deux imposerait
  un habillage Electron avec un module natif de raw input.
- Sur configuration multi-écrans, la fenêtre doit être sur la dalle calibrée.
