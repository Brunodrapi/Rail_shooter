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

La Sinden repère un cadre blanc filmé par sa caméra, puis se présente comme une
souris en position absolue. Le jeu dessine ce cadre lui-même.

1. Lancer en plein écran, ou en mode kiosque : `chromium --kiosk http://localhost:8080`.
2. Régler l'épaisseur du cadre depuis le menu. Elle est mémorisée dans le navigateur.
3. Vérifier avec l'écran **Calibrage cadre** que le blanc touche bien les bords
   physiques de la dalle.
4. Dans le logiciel Sinden, mapper le tir hors écran sur le **clic droit** et le
   bouton de cachette sur **Espace** ou le bouton milieu.
5. Désactiver l'accélération de la souris côté système.

Le Pointer Lock n'est jamais utilisé : il casserait le pointage absolu.

## Architecture

```
index.html            cadre blanc Sinden + calques de menu
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
- Le cadre blanc n'est correct qu'en plein écran réel ; en fenêtre, l'habillage du
  navigateur le rogne.
- Sur configuration multi-écrans, la fenêtre doit être sur la dalle calibrée.
