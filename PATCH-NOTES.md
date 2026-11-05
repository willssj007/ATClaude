# Notes de version

La version la plus récente est en haut. La page de téléchargement de chaque version reprend sa section.

## 0.6.0 — L'Atelier sans script

### Atelier : des effets perso sans écrire de script
- **Effet perso** : chaque capacité a un encadré « Effet perso », et le bouton « ＋ Effet perso » en ajoute une où il est déjà ouvert. Tout se fait avec des menus :
  - un **nombre X** calculé pendant la partie : créatures que vous contrôlez (toutes ou d'un type), terrains, artefacts, cartes en main, créatures dans votre cimetière, vos points de vie, nombre d'adversaires, force de la carte, ses marqueurs +1/+1 ;
  - une **condition** : « seulement si vous contrôlez au moins N créatures », « si vous avez au moins / au plus N points de vie », « au moins N cartes en main », « au moins N créatures dans votre cimetière » ;
  - jusqu'à deux **effets enchaînés** (« …, puis … »), chacun avec sa propre condition.
- **Engager X** : une capacité activée peut coûter « engagez X jetons (ou créatures, artefacts, créatures d'un type) dégagés que vous contrôlez », X choisi en jouant. L'effet peut valoir X, et les effets enchaînés se déclencher par paliers (« puis, si au moins trois ont été engagés, … »).
- **Choix de modes** : « Choisissez l'un — », « Choisissez deux — » (avec trois modes) et « Choisissez un ou plusieurs — ». Chaque mode est pris dans la liste des effets.
- **Cibler un joueur** : nouveau groupe d'effets. Blessures à un joueur ou à un adversaire ciblé ; un joueur ciblé perd ou gagne des points de vie, pioche, se défausse, meule, ou sacrifie une créature. Cela marche aussi pour les capacités déclenchées.
- **Mana de plusieurs couleurs d'un coup** : « Ajouter du mana » peut donner « ces symboles », choisis en les touchant ({G}{U}, {W}{U}{B}{R}{G}, {C}{C}…).
- **Nouveaux mots-clés** : Affinité (pour les artefacts, les équipements, les créatures, les enchantements ou un type de terrain), Partenariat avec (le nom de l'autre carte), Choisissez un passé, et l'effet Découvrir N.
- **Éminence** : pour un commandant légendaire, une case fait aussi marcher la capacité depuis la zone de commandement (déclencheurs et effets permanents).
- **Tous les jetons de Forge** : « Créer des jetons » propose « Autre jeton de Forge… » : plus de 850 jetons (lapin, trésor, nourriture, indice, mécanoptère…), à chercher par nom, force ou couleur.
- **Loyauté au doigt** : les capacités de planeswalker se règlent avec − et +, car le clavier des téléphones n'a pas toujours le signe moins.
- **Nouveau cadre de planeswalker**, dans tous les styles de cadre. L'illustration est plus courte, et chaque capacité de loyauté a sa ligne avec sa valeur dans un insigne : pointe en haut pour +, en bas pour −, plat pour 0. La loyauté est dans un écusson en bas à droite.
- **Types de créature en français** partout : Dieu, Elfe, Dragon… sont reconnus en français comme en anglais, dans l'Atelier, sur la ligne de type des cartes perso et dans le filtre de la recherche.
- Les cartes perso se **synchronisent** quelques secondes après chaque changement dans l'Atelier.

### En partie
- **Main trop pleine** : en fin de tour, avec 15 cartes ou plus en main, une fenêtre fait choisir les 7 cartes à garder au lieu de toucher une à une toutes celles à défausser. « Défausser une à une » revient au choix habituel.
- Les **choix de modes** de Forge (« Choisissez l'un — ») s'affichent en français.
- Les **mots-clés des cartes perso** sont en français pendant la partie, sans leur rappel en anglais.
- Un **commandant perso** dans la zone de commandement n'affiche plus les lignes techniques de Forge (« …'s Commander », « May be played by… »).

### Recherche et decks
- Nouveau filtre **« Cartes perso »** : seulement les cartes de l'Atelier, dans l'écran Cartes et dans le deck builder.

### Version de test « AT TEST »
- Une appli à part, « AT TEST », reçoit les nouveautés avant leur publication. Elle s'installe à côté d'Arcane Table, avec ses propres données. Sa synchronisation GitHub a son propre Gist : à la première synchronisation, elle part d'une copie du compte d'Arcane Table, sans jamais le modifier.
