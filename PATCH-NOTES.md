# Notes de version

La version la plus récente est en haut. La page de téléchargement de chaque version reprend sa section.

## 0.6.6 — Le joueur visé, des marqueurs qui servent

### Atelier : quel joueur l'effet touche
- **Un choix « Joueur »** sous chaque effet qui touche un joueur : blessures, perte ou gain de points de vie, pioche, défausse, meule, sacrifice, poison, cimetière exilé… On choisit :
  - un joueur ciblé, un adversaire ciblé, chaque adversaire ou chaque joueur ;
  - ou le joueur dont parle le déclencheur.
- **Le joueur du déclencheur** :
  - « Quand elle attaque » : **le joueur défenseur**, celui qu'elle attaque ;
  - « Quand elle inflige des blessures de combat à un joueur » : **ce joueur** ;
  - « Quand un adversaire lance un sort, se défausse ou perd des points de vie » : ce joueur ;
  - « Au début de l'entretien de chaque adversaire » : ce joueur ;
  - « Quand une créature d'un adversaire arrive ou meurt » : ce joueur ;
  - « Quand une créature meurt » : son contrôleur ;
  - une malédiction : le joueur enchanté.

- **Exemples** : « Quand elle attaque, elle inflige 1 blessure au joueur défenseur. » ; « À chaque fois qu'elle inflige des blessures de combat à un joueur, ce joueur se défausse d'une carte. »
- **Nouvel effet** : un joueur ciblé gagne des marqueurs « poison ».
- **Capacités toutes prêtes** pour un joueur précis (le joueur défenseur, ce joueur, un adversaire ciblé).
- **Sur la pile et dans le journal**, les capacités activées des cartes perso s'écrivent avec le texte de la carte, en français.

### Atelier : des marqueurs qui servent
- **44 types de marqueurs**, avec les noms des cartes françaises : « charge », « temps », « sapience », « pétrole », « quête », « fatalité », « âge », « niveau », « spore », « divinité »… On peut les poser, les retirer, les compter et réagir à leur arrivée :
  - **Coût** : retirez N marqueurs d'un type de cette carte (« {T}, retirez trois marqueurs « charge » de cette carte : piochez trois cartes »).
  - **Nombre X** : les marqueurs d'un type sur cette carte, vos marqueurs « expérience », votre énergie.
  - **Conditions** : si elle a au moins N marqueurs d'un type, si vous avez au moins N marqueurs « expérience » ou au moins N {E}.
  - **Déclencheurs** : quand des marqueurs sont mis sur elle, quand le **Nième** est mis sur elle (« Quand le troisième marqueur « charge » est mis sur… »), quand le **dernier** est retiré d'elle.
  - **Effets** : retirer des marqueurs de cette carte ou d'un permanent ciblé, mettre des marqueurs sur un permanent ciblé (un artefact, un terrain…), gagner plusieurs marqueurs « expérience ».
  - **Effet permanent** : +1/+1 pour chaque marqueur d'un type sur elle, ou pour chaque marqueur « expérience » que vous avez. Ce +X/+X peut aussi compter autre chose, au choix.
- **Capacités toutes prêtes**, à chercher par « charge », « temps », « expérience » ou « énergie » :
  - une batterie de charges ;
  - un compte à rebours de temps ;
  - l'expérience qui renforce vos créatures ;
  - l'énergie à dépenser.
- **En partie**, les marqueurs portent leur nom français : Pétrole, Sapience, Quête, Fatalité…

### Atelier : tout ce qui manquait
J'ai comparé l'Atelier à tout ce que Forge sait faire, en comptant combien de vraies cartes s'en servent. J'ai ajouté tout ce qui manquait de courant.

- **Joueurs** (avec le choix « Joueur ») :
  - révéler sa main, ou regarder la main d'un joueur ;
  - se défausser de sa main, ou de cartes au hasard ;
  - exiler les cartes du dessus de sa bibliothèque ;
  - sacrifier un permanent d'un type : artefact, enchantement, terrain, permanent non-terrain… ;
  - toutes ses créatures gagnent -N/-N, s'engagent ou sont détruites ;
  - un adversaire crée des jetons (un cadeau) ;
  - devenir le monarque ;
  - un total de points de vie qui devient N, ou échanger son total contre celui d'un adversaire ;
  - passer son prochain tour, ou perdre la partie ;
  - gagner des marqueurs « radiation » ;
  - « Vos adversaires ne peuvent pas lancer de sorts ce tour-ci ».
- **Effets** :
  - **Animer** : devenir une créature N/N jusqu'à la fin du tour (terrain, artefact), une force et une endurance de base N/N, des terrains qui deviennent des créatures.
  - **Exiler** :
    - exiler jusqu'à ce que cette carte quitte le champ de bataille (une prison) ;
    - exiler puis renvoyer, tout de suite ou au début de la prochaine étape de fin ;
    - sacrifier ou exiler cette carte au début de la prochaine étape de fin.
  - **Cimetière et bibliothèque** :
    - lancer un éphémère ou un rituel de votre cimetière sans payer son coût ;
    - renvoyer une carte d'un type de votre cimetière sur le champ de bataille ;
    - révéler des cartes jusqu'à une carte d'un type ;
    - mettre un permanent au-dessus de la bibliothèque.
  - **Marqueurs** : doubler, déplacer ou retirer tous les marqueurs.
  - **Créatures** :
    - protection contre la couleur de votre choix, pour une créature ou toutes ;
    - perdre un mot-clé (« perd le vol ») ;
    - passer hors phase ;
    - détenir ;
    - engager ou dégager ;
    - régénérer une créature ciblée ;
    - bloquer si possible ;
    - retirer du combat ;
    - endurer N.
  - **Le reste** :
    - attacher un équipement ou une aura ;
    - échanger le contrôle ;
    - prévenir les N prochaines blessures ;
    - un terrain supplémentaire ce tour-ci ;
    - terminer le tour ;
    - **pile ou face** (le premier « Et puis » si vous gagnez, le second si vous perdez) ;
    - **Cachette N**, et jouer la carte cachée.
- **Déclencheurs** :
  - quand elle attaque et n'est pas bloquée ;
  - quand elle devient bloquée par une créature ;
  - quand elle devient la cible (d'un adversaire ou de n'importe qui) ;
  - quand elle se dégage ;
  - quand une ou plusieurs de vos créatures infligent des blessures de combat à un joueur ;
  - quand une créature vous attaque ;
  - quand une autre créature arrive, ou quand un jeton arrive sous votre contrôle ;
  - quand une créature non-jeton meurt, ou quand un artefact va au cimetière ;
  - quand un terrain arrive chez un adversaire ;
  - quand un joueur lance un sort, ou quand vous lancez votre premier sort du tour ;
  - quand vous activez une capacité ;
  - quand vous jouez un terrain, ou quand un joueur engage un terrain pour du mana ;
  - quand un adversaire pioche ;
  - quand vous vous défaussez, regardez ou surveillez ;
  - quand vous perdez des points de vie, ou quand vous sacrifiez une créature ;
  - au début de chaque combat, de votre phase principale postcombat, de l'étape de pioche de chaque joueur, ou de l'étape de fin de chaque adversaire.

  Avec « ce joueur » quand le déclencheur parle d'un joueur.
- **Effets permanents** :
  - la taille maximale de main des adversaires est réduite ;
  - les adversaires ne peuvent pas lancer de sorts pendant votre tour ;
  - un seul sort par tour, et une seule pioche par tour pour les adversaires ;
  - personne ne peut gagner de points de vie ;
  - les blessures ne peuvent pas être prévenues ;
  - jouer des terrains depuis le cimetière ;
  - ne peut pas être bloquée par plus d'une créature, ou seulement par N créatures ou plus ;
  - attaquer malgré le défenseur ;
  - des blessures égales à l'endurance ;
  - ce sort coûte {X} de moins ;
  - arriver comme une copie ;
  - doit être bloquée si possible ;
  - toutes les créatures doivent la bloquer ;
  - ne peut pas attaquer (ou bloquer) seule ;
  - prévenir les blessures qui lui sont infligées ;
  - choisir de ne pas la dégager ;
  - peut être votre commandant ;
  - autant d'exemplaires qu'on veut dans un deck.
- **Remplacements** :
  - les cartes qui iraient au cimetière d'un adversaire sont exilées ;
  - les créatures qui meurent sont exilées ;
  - le mana est doublé ;
  - piocher avec une bibliothèque vide fait gagner la partie.
- **17 capacités toutes prêtes en plus**, dont la prison, le clignotement, le terrain qui s'anime et pile ou face.
- **Vérifié** :
  - Forge accepte les 4 452 combinaisons (chaque effet, chaque déclencheur, chaque effet permanent et chaque choix « Joueur », en français et en anglais) ;
  - 46 essais réussis en vraie partie.

### Atelier : les cartes rangées par extension
- **Plus de groupes** : les extensions les remplacent. Le champ « Groupe », ses onglets et « Renommer » disparaissent.
- **Un bloc par extension** dans l'Atelier, avec son logo, son nom et son code, puis les cartes « Sans extension ».
- **Les onglets d'extension** filtrent toujours les cartes et les jetons.
- **« Organiser »** range plusieurs cartes d'un coup avec « Mettre dans une extension… » (ou « Aucune extension »).
- Une carte rangée dans un ancien groupe perd ce groupe la prochaine fois qu'elle est enregistrée.

### Corrections
- **Logo d'extension en « Couleur de la rareté »** : il ne s'affichait pas sur téléphone (sur la carte comme dans l'aperçu de l'extension), ni sur PC. Il s'affiche maintenant partout, coloré selon la rareté.
- **« Partenariat avec »** :
  - le jeu ne demande plus de choisir un joueur : c'est vous, ou le joueur dont la bibliothèque contient le partenaire ;
  - si le partenaire n'est pas dans votre bibliothèque (déjà en jeu, en main…), le jeu ne propose plus de la fouiller ;
  - la question s'écrit « Fouiller votre bibliothèque ? », et la pile comme le journal sont en français.
- « Chaque adversaire se défausse d'une carte », au lieu de « défausse une carte ».
- « Qu'Essai… » devant un nom qui commence par une voyelle, au lieu de « q'Essai… ».
- Un point à la fin des phrases qui finissent par un marqueur (« … deux marqueurs « poison ». »).

## 0.6.5 — Extensions perso, recherche par plusieurs types

### Atelier : extensions perso
- **Mes extensions** : crée tes propres extensions. Chacune a :
  - un nom ;
  - un code de 2 à 6 lettres ou chiffres, comme « MH3 ». Il est proposé d'après le nom. Un code officiel ou déjà pris est refusé ;
  - un **logo**, importé depuis la galerie.
- **Le logo** s'affiche tel quel, ou en silhouette **de la couleur de la rareté**, comme les vrais symboles : noir, argent, or ou orange. L'aperçu le montre dans chaque rareté.
- **Ranger une carte** : dans son onglet Apparence, choisis son extension, sa **rareté** (commune, peu commune, rare, mythique ou spéciale) et son **artiste**. Pour plusieurs cartes d'un coup, passe par « Organiser », puis « Mettre dans une extension… ». L'artiste écrit est repris sur les nouvelles cartes.
- **Sur la carte** :
  - le logo va à droite du type ;
  - en bas, il y a le numéro de la carte dans l'extension (« 002/120 ») et sa rareté ;
  - puis le code de l'extension, la langue et l'artiste, avec un pinceau.

  Les numéros suivent l'ordre des vraies extensions : blanc, bleu, noir, rouge, vert, multicolore, incolore, puis terrains.
- **Filtre par extension** dans l'Atelier : « Toutes les extensions », chacune avec son nombre de cartes, ou « Sans extension ».
- **Recherche** : le bouton « Extension » du menu des cartes et du deck builder propose tes extensions en premier, avec leur logo. Leurs cartes s'affichent dans l'ordre de leur numéro.
- **Les extensions et leurs logos suivent ton compte** sur tes autres appareils. Supprimer une extension garde ses cartes, sans extension.

### Recherche de cartes
- **Plusieurs types à la fois** : un choix à côté des types, comme pour les couleurs :
  - « Au moins tous ces types » (par défaut) : Créature + Enchantement donne les créatures-enchantements ;
  - « Au moins un de ces types » : l'ancien comportement ;
  - « Exactement ces types » : Créature seule exclut les créatures-artefacts. Légendaire, s'il est choisi, est exigé.

## 0.6.4 — Mises à jour automatiques, sous-types, ordre et noms des capacités

### Mises à jour automatiques
- **Au lancement**, l'appli regarde s'il y a une nouvelle version, au plus une fois toutes les six heures. AT TEST regarde les versions d'AT TEST. Une fenêtre montre ses nouveautés, avec trois choix : « Mettre à jour », « Plus tard » ou « Ignorer cette version ».
- **Android** : la nouvelle version se télécharge dans l'appli, avec une barre de progression, puis l'installateur d'Android s'ouvre. Il suffit de confirmer. La première fois, Android demande d'autoriser l'installation depuis Arcane Table ; l'installation reprend au retour.
- **Windows** : la nouvelle version se télécharge, puis Arcane Table se ferme, se remplace et se relance tout seul.
- **iPhone et iPad** : l'appli prévient et ouvre la page de téléchargement. L'IPA se réinstalle avec l'outil qui l'a installé (AltStore, SideStore, Sideloadly…).
- **Tes decks, ton compte et tes cartes perso sont gardés.**
- **Réglages** : « Chercher les mises à jour au lancement » (activé par défaut) et « Vérifier maintenant ».

### Atelier
- **Les sous-types en pastilles** : on en retire un en touchant ✕. Retirer « Équipement » retire aussi le mot-clé qui le donnait.
- **Un sélecteur pour les ajouter**, avec une recherche sans accents en français comme en anglais (« elfe », « elf », « equipement »). Les choix sont rangés par groupe :
  - ceux qui vont avec la carte ;
  - les types perso ;
  - tous les types de créature, dans l'ordre alphabétique ;
  - les autres sous-types.

  On en choisit plusieurs d'un coup. Un type inconnu peut s'écrire tel quel.
- **Noms en français ou en anglais**, au choix : « Elfe Druide » ou « Elf Druid ». Les deux noms s'affichent côte à côte. La saisie au clavier reste possible.
- **Les champs « un type : Elfe »** (filtres « chaque Elfe… », Appui, conditions, nombre X…) ouvrent le même sélecteur, avec « Toutes » quand on veut toutes les créatures. Ils remplacent la liste de suggestions du téléphone, qui sautait et devenait transparente.

- **Ordre des capacités** : chaque capacité se déplace avec ▲ ▼, ou en glissant sa poignée ⠿ vers le haut ou le bas. Les autres s'écartent et l'écran défile près des bords. L'ordre est celui du texte de la carte. Les modes de « Choisissez l'un » se déplacent aussi avec ▲ ▼.
- **Nom des capacités** : chaque capacité peut avoir un nom (« Rugissement terrifiant — Quand cette créature arrive, piochez une carte. »). Ça marche pour les déclencheurs, les capacités activées, les effets permanents, les sorts et les chapitres de saga (« I — L'aube — … »), et après la loyauté pour un planeswalker. Le nom apparaît aussi en partie.
- **Nom des modes** : chaque mode de « Choisissez l'un — », « Choisissez deux — » et « Choisissez un ou plusieurs — » peut avoir un nom, comme sur les cartes récentes (« • Souffle des marées — Piochez une carte. »). Le nom apparaît aussi dans le choix des modes en partie.
- **Texte d'ambiance** : une phrase en italique, sous un trait, en bas du texte de la carte. Elle s'affiche dans l'Atelier, la recherche, les decks et en partie, et suit la carte sur les autres appareils.

### Menus déroulants
- **Avec une recherche, le panneau reste en haut de l'écran** : il ne bouge plus quand le clavier s'ouvre. Il ne se replace qu'une fois par image, et son fond est opaque.

## 0.6.3 — Menus et groupes de l'Atelier

### Menus déroulants
- **Sur téléphone, un panneau** au-dessus de l'écran, en portrait comme en paysage. On y trouve le nom du champ (« Quand elle agit », « Ce qu'elle fait », « Qui », « Mot-clé »…), une croix pour fermer, des lignes plus grandes au doigt et les libellés complets, sur plusieurs lignes si besoin.
- **La recherche ne ferme plus la liste** : avant, toucher le champ de recherche ouvrait le clavier et fermait le menu. Le panneau suit maintenant la partie visible de l'écran au-dessus du clavier, même en paysage.
- **Recherche sans accents**, aussi dans les titres de groupes (« equipee » trouve « équipée »), avec le mot trouvé en gras. Entrée choisit la première ligne.

### Atelier
- **« ＋ Pour la créature équipée… »** (ou enchantée, le terrain fortifié, le joueur enchanté) : les phrases toutes prêtes pour ce que la carte équipe ou enchante :
  - « La créature équipée a le contact mortel », pour chacun des mots-clés ;
  - « gagne +1/+1 », « ne peut pas bloquer », ses déclencheurs et ses marqueurs ;
  - pour une malédiction : « ce joueur perd 1 point de vie »…
- **Recherche dans les capacités toutes prêtes** : taper « contact mortel », « +1/+1 » ou « pioche ».
- **Déclencheurs de l'équipement en tête de liste** (« Quand la créature équipée attaque »…). Un effet permanent ajouté sur un équipement touche d'abord la créature équipée.
- **Marqueurs sur la créature équipée ou enchantée** :
  - « À chaque fois que la créature équipée attaque, mettez un marqueur +1/+1 sur elle. » ;
  - « {1}, {T} : Mettez un marqueur « bouclier » sur la créature équipée. ».
- **Nouveau déclencheur** : « À chaque fois que cet équipement devient attaché à une créature ».
- **Groupes de cartes perso**, pour ranger ses cartes :
  - un champ « Groupe » dans chaque carte (et chaque jeton) ;
  - des onglets en haut de l'Atelier (Toutes, chaque groupe, Sans groupe), et un bloc par groupe ;
  - « Organiser » : choisir plusieurs cartes, puis « Mettre dans un groupe… » ou « Retirer du groupe » ;
  - « Renommer » un groupe.

  Le groupe est écrit dans la carte : il suit le compte sur les autres appareils.

### Corrections
- « Affinité pour les artefacts » en français en partie (au lieu de l'anglais).
- Un mot-clé que Forge écrit déjà en français n'a plus son long rappel (« Équipement {1} » seul).
- Surcharge : refusée sur une carte qui n'est pas un éphémère ou un rituel avec une cible (Forge plantait en partie). Elle marche sur un sort qui cible.

## 0.6.2 — Les sous-types

### Sous-types : chacun marche comme dans le jeu
- **Reconnus en français et en anglais**, et proposés selon les types de la carte : Équipement, Aura, Véhicule, Nourriture, Forêt…
- **Ce qu'ils demandent est ajouté tout seul** :
  - le type de carte : un équipement est un artefact, une forêt un terrain ;
  - le mot-clé : Équipement {2}, Fortification, Pilotage, Station, Seller ;
  - « Enchanter : joueur » pour une malédiction ;
  - légendaire pour un passé.

  Un encart sous les sous-types dit ce que chacun fait et ce qui a été ajouté.
- **Capacités des jetons du même nom** : une nourriture a « {2}, {T}, sacrifiez … : Vous gagnez 3 points de vie. ». Pareil pour l'indice, le trésor, le sang, l'or, la carte, la lithoforce, le bric-à-brac, l'atterrisseur, le mutagène et l'éclat. Une case permet de la retirer.
- **Terrains** : une forêt, une île… donne son mana, écrit sur la carte (« ({T} : Ajoutez {G} ou {U}.) »).
- **Classe** : chaque capacité a son niveau (1, 2 ou 3), et les niveaux 2 et 3 ont leur coût (« {1}{G} : Niveau 2 »).
- **Affaire** : une condition « À résoudre — », vérifiée à votre étape de fin, et des capacités « Résolue — ».
- **Vaisseau spatial** : le mot-clé Station ; à partir de N marqueurs charge, c'est une créature-artefact.
- **Équipement, aura, fortification** :
  - nouveaux déclencheurs : quand la créature équipée attaque, inflige des blessures de combat à un joueur ou meurt, ou quand le terrain enchanté devient engagé ;
  - les textes suivent ce que la carte enchante : « le terrain enchanté », « l'artefact enchanté »…
- **Malédiction** :
  - déclencheurs « du joueur enchanté » : à son entretien, à son étape de fin, quand il est attaqué, lance un sort, pioche, ou quand une créature arrive sous son contrôle ;
  - ses effets touchent ce joueur ;
  - « Les créatures que contrôle le joueur enchanté… ».
- **Passé** : « Les créatures Commandant que vous possédez gagnent… ».
- **De clan** (autrefois « tribal ») : un nouveau type pour mettre un type de créature sur un éphémère ou un artefact.
- **Avertissements** : l'Atelier signale une leçon sur une créature, une saga sans chapitre, ou un type de créature sur une carte qui n'en est pas une. Les sous-types des cartes doubles (pièce, aventure, présage, incubateur) restent sans leur mécanique.

### Textes
- **Ligne de type comme sur les cartes françaises** : « Artefact : équipement » (au lieu de « Equipment »), « Créature-artefact : nourriture et golem », « Terrain de base : forêt », « Éphémère de clan : elfe ».
- **Une seule phrase pour les équipements et les auras** : « La créature équipée gagne +2/+0 et a l'initiative. » au lieu de deux lignes. Pareil pour les effets sur vos créatures.
- **« Équipement {1}, Pilotage 2… » en dernier**, sous les capacités, comme sur les cartes imprimées.
- **En partie** : « Niveau 2 », « Résolue » et le rappel des classes en français, « Station » avant « STATION N+ ».
- « Un joueur ciblé se défausse **d'**une carte » (au lieu de « de une »).

## 0.6.1 — L'Atelier complet

### Mots-clés : presque tous ceux de Magic
- **195 mots-clés** (contre 91), avec leurs noms des cartes françaises. Ils sont rangés en dix groupes : combat, protection, capacités, nombre, équipements et auras, coûts alternatifs, cimetière, recyclages, sorts, Commander.
- **Recherche** : on tape « kick », « suspension » ou « enchanter » au lieu de parcourir les groupes.
- **Nouveautés**, entre autres :
  - Kick, Multikick, Rappel, Écho, Entretien cumulatif, Surcharge, Mutation, Miracle, Prédiction, Complot, Progéniture ;
  - Suspension, Éveil, Renfort et Imminence (un nombre et un coût) ;
  - Échappée, Pistage, Relancez ;
  - les recyclages de terrain ;
  - Enchanter, Grâce, Pilotage, Seller, Arme vivante, Pour Mirrodin !, Reconfiguration ;
  - Appui et Offrande (un type de créature) ;
  - Défense talismanique contre une couleur, Protection contre les créatures ou contre tout, Parade (payer des points de vie, se défausser) ;
  - Carence, Ascension, Exploitation, Victime, Négociation…
- **Type de carte automatique** : « Enchanter » fait de la carte une aura, « Équipement » un équipement, « Pilotage » un véhicule (avec sa force et son endurance), « Seller » une monture.
- **En partie**, les mots-clés s'affichent en français, y compris « Suspension 3 — {1}{U} » ou « Échappée — … ».

### Effets permanents (« textes spéciaux »)
- **Qui est touché** : vos créatures, celles des adversaires, toutes, la carte elle-même, la créature enchantée (aura), la créature équipée, vos jetons ou vos créatures attaquantes.
- **Sur des créatures** : +N/+N, +N/+0, -N/-N, un mot-clé. Ou bien : elles ne peuvent pas bloquer, pas attaquer, ni l'un ni l'autre ; elles ne peuvent pas être bloquées, ou pas par les petites créatures ; elles attaquent à chaque combat ; elles bloquent une créature de plus ; elles ne se dégagent pas ; leurs capacités ne s'activent plus. Une aura peut aussi prendre le contrôle de la créature enchantée.
- **Sur vous** :
  - pas de taille maximale de main, ou une taille augmentée ;
  - des terrains supplémentaires ;
  - des sorts (d'un type) moins chers, ou plus chers pour les adversaires ou pour tout le monde ;
  - le flash pour vos sorts ;
  - la défense talismanique ;
  - ne pas pouvoir perdre ;
  - des adversaires privés de points de vie ;
  - la carte du dessus de votre bibliothèque, à regarder ou à jouer ;
  - vos permanents qui se dégagent pendant les tours des autres ;
  - la règle des légendes ignorée ;
  - la taxe pour vous attaquer ;
  - les déclencheurs d'arrivée doublés ;
  - les créatures adverses qui arrivent engagées.
- **Remplacements** : jetons doublés, marqueurs +1/+1 doublés ou +1 de plus, blessures doublées ou augmentées, points de vie gagnés doublés.
- **Sur la carte elle-même** : force et endurance égales à X, arrivée engagée, arrivée avec des marqueurs, sort qui ne peut pas être contrecarré.
- **« Tant que »** : un effet permanent peut dépendre d'une condition (« Tant que c'est votre tour », « Seuil — Tant qu'il y a au moins sept cartes dans votre cimetière »…).

### Déclencheurs, conditions et X
- **34 nouveaux déclencheurs**, entre autres :
  - quand elle quitte le champ de bataille, devient bloquée, inflige ou subit des blessures (Rage), s'engage, est retournée face visible ;
  - quand vous lancez ce sort, un sort, votre deuxième sort ou un éphémère ou un rituel (Sorcellerie), ou quand vous lancez un sort qui la cible (Héroïque) ;
  - quand un adversaire lance un sort ;
  - quand vous piochez, recyclez, sacrifiez, attaquez ou commettez un crime ;
  - quand une créature meurt ou arrive chez un adversaire, quand un enchantement (Constellation) ou un artefact arrive, quand des marqueurs +1/+1 sont posés ;
  - à l'entretien de chaque joueur ou de chaque adversaire, à la pioche, à la phase principale, à la fin du combat, à chaque étape de fin.
- **Conditions** : votre tour ou non, Seuil, Délire, Morbidité, Saccage, Révolte, Art des métaux, Férocité, Acharnement, Congrégation, agrément de la cité, monarque, kick payé, points de vie gagnés, deux sorts lancés. Le mot d'aptitude (« Saccage — ») s'écrit sur la carte.
- **Nouveaux X** : la valeur de X payée, le Domaine, vos enchantements, permanents et jetons, les créatures adverses, les cimetières, les sorts lancés ce tour-ci, les points de vie gagnés ou perdus, l'endurance.

### Effets
- **Près de 60 nouveaux effets** (et 38 effets permanents), entre autres :
  - tour supplémentaire, combat supplémentaire, copie d'un sort, emblème (pour un planeswalker ou un sort), gagner la partie ;
  - brouillard, poison, énergie ;
  - chaque joueur pioche, roue, regarder N cartes et en garder une, exiler et jouer jusqu'au prochain tour, Thoughtseize ;
  - chercher une carte d'un type, la mettre en jeu ou la reprendre au cimetière, mélanger ou exiler un cimetière ;
  - détruire, exiler, renvoyer, mettre sous la bibliothèque ou voler un permanent au choix (artefact, terrain, planeswalker…), un par un ou tous ;
  - contrer un sort de créature, un sort non-créature, à moins de payer, ou une capacité ;
  - -N/-N, mot-clé ou imblocable pour une créature ciblée ;
  - Monstruosité, Adapter, Renforcement, Soutenir, Peupler, Incuber, Manifester ;
  - morsure, marqueurs « bouclier », « vol » ou -1/-1, dégager vos créatures, engager celles des adversaires, terrains supplémentaires.

### Coûts et sagas
- **Capacités activées** : payer des points de vie ou de l'énergie, se défausser, sacrifier (une autre créature, un artefact, un terrain, un jeton…), exiler des cartes du cimetière, retirer des marqueurs, {Q}.
- **Restrictions** : seulement comme un rituel, une fois par tour, pendant votre tour.
- **D'où elles s'activent** : depuis le cimetière (en s'exilant) ou depuis la main (en se défaussant).
- **Sorts** : un coût supplémentaire (sacrifier une créature, se défausser, payer des points de vie, exiler une carte du cimetière…).
- **Sagas** : chapitres I à VI, chacun avec son effet. La carte devient une saga.
- **23 nouvelles capacités toutes prêtes** : aura, équipement, Seuil, emblème, saga, cimetière…

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
