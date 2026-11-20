# Notes de version

La version la plus récente est en haut. La page de téléchargement de chaque version reprend sa section.

## 0.9.8 — Optimisation générale : Atelier, démarrage, recherche

Mesures faites avec le processeur ralenti quatre fois (comme un téléphone moyen), avant → après.

- **Atelier beaucoup plus rapide**, surtout avec beaucoup de cartes perso :
  - ouverture de l'écran : 2,1 s → 0,4 s ; plus grand blocage : 1 s → 0,09 s ;
  - les cartes de la liste ne sont créées qu'à l'approche de l'écran (1 900 éléments au lieu de 15 000 pour 325 cartes) ;
  - le texte des cartes n'est ajusté (nom, type, capacités réduits pour tenir) que pour celles qu'on voit, et chaque carte ne fait recalculer qu'elle-même au lieu de toute la page (148 recalculs → 6) ;
  - ces ajustements sont gardés d'un lancement à l'autre : une liste déjà vue s'affiche sans rien remesurer ;
  - taper dans l'éditeur ne saccade plus (à-coups de 0,7 s → 0,1 s), et revenir de l'éditeur à la liste non plus.
- **Nom de carte perso coupé** (« Cyclops, Mutant Lea… ») : un nom qui dépassait d'une fraction de pixel n'était pas vu par la mesure ; il est maintenant réduit pour tenir en entier.
- **Démarrage** :
  - l'analyse des préconstruits (bracket et puissance de chacun, plus d'une minute sur iPhone) est gardée sur l'appareil : 1,5 s → 0,04 s sur ordinateur ; elle n'est refaite qu'à la mise à jour de l'appli. Même chose pour la popularité des cartes (le tri « les plus jouées ») ;
  - un seul deck aléatoire est préparé tout de suite pour la première partie rapide, les trois autres une minute plus tard : moins de calcul pendant les premières secondes.
- **Cartes conseillées d'un commandant perso** : premier calcul 2,8 s → 1,1 s sur ordinateur (lecture des scripts sans expressions régulières lentes), les suivants en 0,1 s.
- **Recherche avec une faute de frappe** (« lightnig bolte », « sol rign ») : deux à trois fois plus rapide (les noms sont lus sur place au lieu d'être découpés à chaque frappe).
- **Deck builder** : quand les cartes conseillées sont déjà prêtes, la grille n'est dessinée qu'une fois (dans le bon ordre) au lieu de deux.
- Écrans Decks, Accueil, Cartes et Trophées : 20 à 50 % plus rapides à s'afficher.

## 0.9.7 — « Vous inflige X blessures » dans l'Atelier

- **Atelier : nouvel effet « Blessures à vous »** : « CARDNAME vous inflige X blessures », dans le groupe des points de vie, pour une capacité activée, un déclencheur, un sort ou un effet enchaîné (« Et puis »). Le nombre peut être fixe ou calculé (X).
  - Comme les terrains douloureux : « {T} : Ajoutez un mana de la couleur de votre choix. Forge douloureuse vous inflige 1 blessure. » (deux phrases, comme sur les vraies cartes, au lieu de « …, puis … »).
  - Deux capacités toutes prêtes : le terrain douloureux, et « {T} : elle vous inflige 1 blessure et inflige 1 blessure à chaque adversaire ».
  - Ce sont des blessures, pas une perte de points de vie : le lien de vie, la prévention des blessures et les effets « quand une source vous inflige des blessures » en tiennent compte. Pour une simple perte de points de vie, il y a toujours « Vous perdez des points de vie ».
- **iPhone** : l'IPA se construit de nouveau sur les deux sortes de Mac de GitHub (Intel et Apple). Pour la 0.9.6, les Mac Intel sont restés indisponibles et l'IPA n'a pas pu être construit : celui de la 0.9.7 le remplace.

## 0.9.6 — Cartes conseillées dans le deck builder, synergies des commandants perso

- **Cartes conseillées directement dans la recherche du deck builder**. Dès que le deck a son commandant, la recherche se trie sur « Conseillées (EDHREC) d'abord » : les cartes que les decks EDHREC de ce commandant jouent le plus passent en tête, avec un badge bleu ◆ qui donne la part des decks qui les jouent (« ◆ 86 % »). Les staples (★) restent signalées, et viennent juste après.
  - Les cartes déjà dans le deck passent après les autres ; les filtres (type, valeur de mana…) gardent cet ordre. Un mot tapé (« gobelin ») met en tête les cartes conseillées qui ont ce mot dans leur nom (Matrone gobeline, Chef de clan gobelin…) ; un nom exact reste en premier.
  - En mode Planeswalker, le même ordre s'applique aux cartes de ta collection (sans la fenêtre EDHREC, où l'on pourrait ajouter des cartes qu'on n'a pas).
  - « Tout voir », au-dessus des cartes, ouvre la fenêtre EDHREC complète (synergies, catégories, combos).
  - Le tri se change comme avant (« Les plus jouées d'abord », « Par nom ») ; un bouton permet de revenir aux cartes conseillées.
- **Commandants perso : les cartes qui vont bien avec eux, façon EDHREC**. EDHREC ne connaît pas les cartes de l'Atelier : l'application lit le script de ton commandant et cherche elle-même.
  - Les thèmes : ce qu'il fait et ce dont il profite (jetons, marqueurs +1/+1, sacrifice et morts, cimetière, gain de vie, éphémères et rituels, artefacts, enchantements, équipements et auras, terrains, arrivées et clignotements, poison, énergie…), et les types de créature dont il parle ou qu'il crée (tribal).
  - Chaque carte de ses couleurs est lue de la même façon, avec les indices de construction de Forge : elle gagne des points pour chaque thème partagé, d'autant plus que le thème est rare. Le badge ◆ dit pourquoi (« ◆ Gobelin », « ◆ Jetons »).
  - Les commandants officiels les plus semblables (mêmes couleurs, mêmes thèmes) sont lus sur EDHREC : les cartes de leurs decks s'ajoutent au classement, et leurs combos dont toutes les cartes vont dans tes couleurs sont proposés.
  - Le bouton **◆ Synergies** (à la place d'EDHREC) ouvre la même fenêtre : meilleures synergies, par catégorie, combos, thèmes repérés et commandants semblables. Tes cartes perso y sont aussi, si elles vont bien avec lui.
- **Commandant officiel trop récent pour EDHREC, ou pas de connexion** : le même calcul prend le relais, au lieu d'un message d'erreur.

## 0.9.5 — iPhone stable, terrains réimprimés, une fois par tour

- **iPhone : plantage corrigé**. Depuis la 0.9.3, quand une partie restait bloquée, l'application relevait l'état des fils du moteur pour le relevé de performance ; sur iPhone, cette lecture pouvait faire planter l'application au lieu d'afficher le bandeau « La partie ne répond plus ». Elle n'est plus faite sur iPhone (le relevé garde le tour, la phase, la pile et le joueur qui avait la priorité).
- **Terrains de base réimprimés** :
  - ils n'affichent plus une lettre (« R ») à la place du rappel de mana ou du grand symbole. La mise à jour des textes français des cartes récentes prenait le texte imprimé de Scryfall, qui pour les terrains de base n'est que la lettre du mana ; elle ne touche plus aux terrains de base, et ce qu'elle avait déjà enregistré est oublié ;
  - le cadre d'un terrain prend la couleur du mana qu'il produit (une Montagne en rouge, un terrain rouge-blanc en deux couleurs), au lieu de rester incolore. Un terrain incolore ou de plus de deux couleurs garde le cadre des terrains.
- **Cartes récentes restées en anglais** (« Massif scintillant » : « This land enters tapped. ») : quand Forge a le nom français mais un texte resté en anglais, le texte et le type de l'impression française de Scryfall le remplacent. Il arrive à la vérification quotidienne, ou tout de suite avec Réglages → « Mettre à jour maintenant ».
- **Atelier : « une seule fois par tour » pour les déclencheurs** (case à côté de « ou aussi ») : « À chaque fois que vous lancez un sort historique, créez un jeton Trésor. Cette capacité ne se déclenche qu'une fois par tour. », comme sur les vraies cartes. Elle existait déjà pour les capacités activées.

## 0.9.4 — Réimpressions sous un autre nom, emblèmes plus faciles à donner

- **Réimpressions : un autre nom**, comme les cartes Universes Beyond (« Hérauts de Shredder », avec « Ardeur » en petit dessous).
  - Dans l'éditeur d'une réimpression, le champ **Autre nom** : il s'affiche en grand sur la carte, et le nom officiel passe dans un petit bandeau sous le titre.
  - Le texte de la carte cite l'autre nom à la place du nom officiel (« … autre que Hérauts de Shredder… ») ; une case permet de garder le nom officiel dans le texte.
  - **Texte affiché** (facultatif) : pour recopier exactement le texte d'une carte imprimée (« Quand les Hérauts de Shredder sont mis dans un cimetière… »). « Partir du texte actuel » le préremplit. Ce n'est que ce que la carte montre : les règles restent celles de la carte officielle.
  - La carte reste la même pour les règles, les decks et la partie. La recherche la trouve aussi par son autre nom, et la montre alors sous ce nom-là.
- **Onglet Emblèmes : bouton « Carte qui le donne »**. Il ouvre une nouvelle carte avec, déjà en place, « Quand vous avez au moins trois permanents d'un même type, vous gagnez un emblème » : il reste à choisir le nombre, la sorte de permanents (créatures, artefacts…), le type (Elfe, Équipement, un type perso…) et l'emblème (le premier de tes emblèmes perso est déjà choisi).
- **Le déclencheur s'appelle maintenant « Quand vous avez (contrôlez) au moins X permanents d'un type »** dans la liste « Quand », au lieu de « La première fois que vous contrôlez… ». Il marche toujours de la même façon : la première fois que le compte y est, une fois par carte, et un emblème perso ne se gagne qu'une fois par joueur.
- **Capacités toutes prêtes** :
  - nouvelle phrase « Quand vous avez au moins trois permanents d'un même type…, vous gagnez un emblème », qui reprend le type de la carte s'il en a un ;
  - la recherche se fait par mots, dans n'importe quel ordre et au singulier comme au pluriel : « si vous avez 3 permanents emblème » ou « x permanent d'un même type » la trouvent. Les nombres tapés sont ignorés (ils se règlent ensuite).

## 0.9.3 — Partie bloquée : la reprendre au lieu de la perdre

- **Partie qui ne répond plus** : quand le moteur ne bouge plus depuis 20 secondes alors qu'il n'attend rien de toi (l'IA ou la résolution d'un effet est coincée, « En attente de … » sans fin), un bandeau le signale en haut du plateau.
  - **Reprendre** relance la partie au dernier moment calme enregistré (le début de la phase, à peu près) : tu retrouves ton plateau, ta main et tes points de vie de ce moment-là. Ça marche aussi en mode Planeswalker.
  - **Patienter** ferme le bandeau ; il disparaît aussi de lui-même si la partie repart.
  - Archenemy, Planechase et les énigmes ne s'enregistrent pas : là, il faut abandonner la partie (menu).
- **Relevé de performance** : il contient maintenant le dernier blocage (tour, phase, pile, joueur qui avait la priorité, et où en étaient les fils du moteur). Après un blocage, copie le relevé (Réglages → Performance) et envoie-le : c'est ce qu'il faut pour corriger la cause.
- Une question du jeu restée sans réponse depuis 20 secondes est renvoyée à l'écran, au cas où elle s'y serait perdue.

## 0.9.2 — Zoom à deux doigts, mode économie, partie plus légère

- **Zoom à deux doigts sur le plateau** (téléphone) : pince ta moitié du plateau ou celle d'un adversaire pour l'agrandir jusqu'à ×3, autour de tes doigts, et lire les cartes sans les ouvrir une à une.
  - Une fois zoomée, un doigt fait glisser la vue ; deux touchers sur une zone vide zooment (×2) ou remettent à plat ; refermer les doigts jusqu'au bout aussi.
  - Le bouton « 100 % ⟲ » en haut de la moitié zoomée la remet à sa taille.
  - Chaque moitié se zoome à part : la ligne du milieu (phase, outils), la main et les boutons ne bougent pas. Les cartes zoomées se touchent normalement (jouer, cibler, appui long pour les agrandir), et les flèches d'attaque suivent.
  - Sur ordinateur : Ctrl + molette (ou pincer le pavé tactile), et la molette fait glisser la vue zoomée.
- **Mode économie** (Réglages → Performance) : Automatique, Toujours ou Jamais.
  - Il coupe ce qui coûte sans rien apprendre au joueur : décors animés des fonds mythiques, flou derrière les fenêtres et la barre du haut, halos et contours qui clignotent, glissement des cartes d'une place à l'autre. Les cartes posées prennent de petites images.
  - En automatique, il s'active sur un appareil lent : un petit calcul chronométré au lancement, ou une partie qui manque de fluidité (beaucoup d'images trop longues à dessiner). Un message le signale.
- **Petites images pour les cartes posées** (Android, et partout en mode économie) : une image deux fois plus petite dans chaque sens, fabriquée une fois puis gardée sur l'appareil. Quatre fois moins de pixels à décoder et à garder en mémoire par carte : un plateau chargé reste fluide sur les téléphones modestes. La main et l'agrandissement d'une carte gardent l'image entière.
- **Partie plus légère** : à chaque mise à jour, le moteur n'envoie plus que les cartes qui ont changé ; les autres partent par leur seul numéro et l'écran reprend celles qu'il a déjà. Sur un combat avec 24 créatures, une mise à jour pèse en moyenne 3 Ko au lieu de 8 à 11 Ko, à transmettre et à lire. Si une mise à jour se perd, l'écran redemande tout de lui-même.
- **L'IA réfléchit…** : quand l'IA prend plus d'une demi-seconde pour décider, une bulle « ••• » s'affiche au-dessus de son portrait jusqu'à ce qu'elle joue.
- **Temps de réflexion de l'IA** (Réglages → Performance) : Rapide (2 s), Normale (4 s) ou Longue (8 s) au plus par décision. Plus court, la partie avance plus vite ; plus long, elle joue un peu mieux sur les plateaux compliqués.
- **Relevé de performance** (Réglages → Performance) : le démarrage étape par étape, la fluidité de la partie, le temps de dessin du plateau, le poids des mises à jour, la réflexion de l'IA et le chargement des images. Un bouton le copie pour le coller dans un message si quelque chose rame. Rien de personnel dedans : l'appareil, la version et les mesures.
- **Préchargement** :
  - en partie, les images des decks adverses se téléchargent en fond après celles de ton deck : une carte adverse jouée s'affiche tout de suite ;
  - dans la recherche de cartes, la page suivante et ses images se préparent pendant que tu regardes la première : en faisant défiler, elles arrivent sans attente.
- **Démarrage** : l'analyse des decks préconstruits se fait à part, en fond, sur Android aussi (comme sur iPhone) ; le profil, les decks et les statistiques de l'accueil ne l'attendent plus.

## 0.9.1 — Cartes perso en anglais vraiment en anglais

- **Cartes perso en anglais, en partie** : une ligne pouvait passer en français avec le texte de rappel d'une carte officielle (« Défenseur (Cette créature ne peut pas attaquer.) » au-dessus d'une capacité en anglais). Forge garde en mémoire les lignes déjà traduites pendant la partie : dès qu'une carte officielle avec le même mot-clé (un Mur avec Défenseur, par exemple) était passée, il réutilisait sa traduction pour les cartes qui n'en ont pas, dont les cartes perso. Une carte perso, un jeton perso ou un emblème perso en anglais reste maintenant entièrement en anglais.

## 0.9.0 — Emblèmes perso, coût zéro, « si vous contrôlez X permanents »

- **Atelier : emblèmes perso**. Un nouvel onglet **Emblèmes** (à côté de Jetons) crée tes propres emblèmes : un nom, des capacités, une illustration et un cadre comme pour un jeton. Un emblème reste dans la zone de commandement jusqu'à la fin de la partie, et rien ne peut le retirer.
  - Il prend des effets permanents (« Les créatures que vous contrôlez gagnent +1/+1 », « Vos sorts coûtent {1} de moins »…) et des déclencheurs qui ne parlent pas d'une carte (« Au début de votre entretien », « À chaque fois qu'une créature que vous contrôlez meurt », « À chaque fois que vous jouez un terrain »…). Ce qui n'a pas de sens sur un emblème (« quand elle arrive », « elle arrive engagée », une capacité activée) n'est pas proposé. Sur l'emblème, « cette carte » s'écrit « cet emblème » (« … cet emblème inflige 2 blessures à chaque adversaire »).
  - Tes cartes le donnent avec l'effet **Obtenir un emblème** : tes emblèmes sont proposés après ceux tout prêts (une capacité de loyauté de planeswalker, « quand elle arrive », un sort…). La carte cite le texte de l'emblème, comme les vraies : « vous gagnez un emblème avec « … » ».
  - En partie, l'emblème s'affiche dans la zone de commandement avec son nom, son illustration et son cadre, et le type « Emblème ».
  - Modifier ou renommer un emblème met à jour les cartes qui le donnent. Le partager, le synchroniser et le sauvegarder marchent comme pour les cartes.
- **Atelier : déclencheur « La première fois que vous contrôlez au moins X permanents »**, d'une sorte (créatures, artefacts, jetons…) et d'un type au choix (Équipement, Elfe, un type perso…). Il se déclenche une fois par carte, dès que le compte y est. Avec l'effet **Obtenir un emblème** et un emblème perso, la même capacité peut aller sur plusieurs cartes : l'emblème ne se gagne qu'une fois par joueur (« … vous gagnez l'emblème Sceau des Trois (un seul par joueur) : « … » »), même si plusieurs cartes atteignent le compte ensemble ou arrivent après. Une capacité toute prête le propose (chercher « première fois »).
- **Atelier : coût zéro**. Le pavé de mana a une pastille **Coût zéro** ({0}, comme les Mox) : la carte se lance gratuitement. Ce n'est pas la même chose que « pas de coût », qui ne se lance pas. La pastille existe aussi pour le coût des capacités.
- **Atelier : condition « Si vous contrôlez au moins X permanents »**. On choisit la sorte (permanents, créatures, artefacts, enchantements, terrains, planeswalkers, jetons, permanents non-jetons) et, au choix, un type : Équipement, Elfe, Forêt, ou un type perso. Exemple : « Tant que vous contrôlez au moins trois Équipements, les créatures que vous contrôlez gagnent +1/+1. » La condition marche sur les effets permanents, les déclencheurs, les capacités activées et chaque effet « Et puis ».
- **Recherche de cartes plus intuitive** :
  - une faute de frappe trouve quand même la carte : « lightnig bolt » donne Foudre, « serra angle » Ange de Serra, « counterspel » Contresort (« Aucune carte ne s'appelle « … » : voici les noms les plus proches ») ;
  - les mots d'un nom se cherchent dans n'importe quel ordre (« ring sol »), et un mot tapé trouve aussi ses autres formes (« piocher » trouve « piochez », « créatures » trouve « créature ») ;
  - les cartes dont le nom correspond passent avant celles dont seul le texte correspond ;
  - les filtres actifs s'affichent en pastilles sous la barre de recherche (« Rouge ✕ », « Créature ✕ », « VM 2–4 ✕ »), même quand le panneau des filtres est replié : un toucher retire un filtre, « Tout effacer » les retire tous ;
  - sur téléphone, le nombre de cartes trouvées s'affiche sous la barre ; sans résultat, l'écran dit quoi essayer et propose de retirer les filtres.
- **Partie plus fluide en combat** : à chaque mise à jour du plateau, la main remesurait ses cartes juste après le changement du plateau, ce qui forçait le navigateur à recalculer toute la page (jusqu'à 100 ms par mise à jour sur un plateau chargé, d'où des à-coups pendant les combats). Les tailles sont maintenant gardées et remesurées seulement quand l'écran change de taille. Sur un combat de 24 créatures avec un processeur ralenti comme celui d'un téléphone, les à-coups ont disparu.
- **Images des cartes plus rapides** :
  - une image encore à télécharger ne fait plus attendre celles qui sont déjà prêtes : l'écran ne l'attend plus que 4 secondes (au lieu de 15), garde le cadre dessiné et l'affiche dès qu'elle arrive ;
  - les images se décodent hors du fil principal : une carte qui arrive en jeu ne fige plus l'écran.
- **Partager** des cartes envoie aussi les jetons perso qu'elles créent et les emblèmes perso qu'elles donnent : la personne qui les reçoit peut les jouer et les modifier.
- **Atelier** : la liste de tes cartes ne remonte plus toute seule en haut quand on fait défiler (sur téléphone surtout).
- **Textes en partie** :
  - des messages de Forge mal traduits sont corrigés (« Défaussez-vous de 2 carte(s) » au lieu de « Supprimer 2 carte(s) », « engager » au lieu d'« appuyer », « Dégagé(e) » au lieu d'« Inexploité ») ;
  - les notes du moteur en fin de phrase dans le journal (« [Changeur de zone: …] ») disparaissent, ou deviennent une simple parenthèse quand elles disent quelque chose de plus.
- **Téléphone en portrait** : la barre des écrans est plus serrée (Trophées et Réglages restent visibles), et ses bords s'estompent quand d'autres icônes sont cachées.
- **Accueil** : tant que ton compte n'est pas relié, un conseil propose de le relier pour sauvegarder ta progression.
- **Fiabilité** : chaque effet ponctuel de l'Atelier a été joué en partie par un test automatique, qui vérifie qu'il fait ce que dit la carte (points de vie, main, cimetière, jetons, marqueurs…).

## 0.8.4 — Atelier : grille alignée, langue des anciennes réimpressions

- **Atelier en portrait** : les cartes ne se décalent plus d'une ligne à l'autre. Une carte au nom long (« Wolverine, Clawed Mutant ») élargissait sa colonne ; chaque vignette a maintenant la largeur de sa carte, le nom trop long est coupé (…) et le ↻ des réimpressions reste visible.
- **Réimpressions enregistrées avant la 0.8.3** : le choix **Français / English** apparaît aussi sur elles (il n'apparaissait que sur les nouvelles).

## 0.8.3 — Réimpressions en anglais, langue des nouvelles cartes, jetons copies

- **Réimpressions en anglais**. Une réimpression d'une carte officielle a maintenant le choix **Français / English** (en haut de son éditeur) : en anglais, elle prend le nom, le type et le texte anglais de la carte, comme sur son impression anglaise (« Llanowar Elves — Creature — Elf Druid — {T}: Add {G}. »). Partout : aperçu de l'Atelier, recherche, deck builder et en partie, verso des cartes recto verso et sort d'aventure compris. Les terrains de base en anglais ont leur rappel « ({T}: Add {G}.) ». Une réimpression d'une carte perso garde la langue de la carte.
- **Réglages → Atelier → Langue des nouvelles cartes** (Français par défaut) : la langue d'une carte perso, d'un jeton ou d'une réimpression qu'on crée dans l'Atelier. Chaque carte peut ensuite changer la sienne.
- **Atelier : jetons copies**. Deux nouveaux effets dans « Créatures » :
  - « Créer un jeton qui est une copie d'elle » : la carte qui a la capacité (« À chaque fois qu'une autre créature meurt, créez un jeton qui est une copie d'Essai Copieur »). Sur « Quand elle meurt », la copie reprend la carte telle qu'elle était.
  - « Créer un jeton copie de cette créature » : celle dont parle le déclencheur (celle qui arrive, qui meurt, qui attaque ou qui inflige des blessures), proposé seulement avec ces déclencheurs.
- **Correction** : « Quand une créature non-jeton que vous contrôlez meurt » et le choix « une créature non-jeton » comptaient aussi les jetons (le filtre écrit pour Forge n'existait pas). Une copie qui meurt pouvait relancer la capacité sans fin. Les cartes perso déjà enregistrées sont corrigées au lancement.
- En partie, « de » devant le nom d'une carte qui commence par une voyelle devient « d' » (« une copie d'Essai… »).
- Le type de 85 versos de cartes officielles s'écrivait « Créature : - humain et insecte » (un tiret en trop dans les traductions de Forge) : c'est corrigé.

## 0.8.2 — L'Atelier ne propose que ce qui va avec la carte

- **Atelier : seulement ce qui va avec le type de la carte**. Les déclencheurs, effets, nombres X, conditions, portées « Qui », mots-clés et capacités toutes prêtes qui ne s'appliquent pas à la carte ne sont plus proposés. Quelques exemples :
  - un équipement n'a plus « X est la force de cette carte », ni « elle gagne +X/+X », ni « quand elle attaque » ou « quand elle meurt » (il garde « quand la créature équipée attaque ») ;
  - un éphémère ou un rituel n'a que « Effet du sort », « Quand vous lancez ce sort » et ses effets permanents de sort (« ne peut pas être contrecarré », « coûte {X} de moins ») ; plus de « la sacrifier » ni de marqueurs sur elle ;
  - un terrain n'a plus « quand vous lancez ce sort », ni les mots-clés de combat, ni Kick, Flash ou Convocation ;
  - les mots-clés de combat (vol, piétinement, célérité…) vont avec une créature ou un véhicule ; Flashback, Déluge, Rebond, Surcharge avec un éphémère ou un rituel ; Mue, Exhumation, Précipitation avec une créature ; « Capacité de loyauté » avec un planeswalker ; « Chapitre » avec une saga ; « Quand vous déverrouillez cette porte » avec une pièce ; « La transformer » avec une carte recto verso qui se transforme ;
  - la condition « si le kick a été payé » n'apparaît qu'avec le mot-clé Kick, « jouer la carte exilée par Cachette » qu'avec Cachette.
- Ce qui était déjà choisi reste : une capacité faite avant de changer le type de la carte est gardée, avec un avertissement (« ⚠ « Elle gagne +X/+X » ne va qu'avec une créature ou un véhicule »). Dans la recherche de mots-clés, ceux qui ne vont pas avec la carte sont grisés, avec ce qu'il leur faut.
- Nouveau réglage **Atelier : Seulement ce qui va avec la carte** (coché par défaut) : décoche-le pour tout voir.
- **Nouveaux effets** : « Vos adversaires ne peuvent pas gagner de points de vie ce tour-ci » et « Les joueurs ne peuvent pas gagner de points de vie ce tour-ci » (comme Skullcrack), sur un sort, un déclencheur ou une capacité activée. L'effet permanent « Vos adversaires ne peuvent pas gagner de points de vie » existait déjà dans les effets permanents.

## 0.8.1 — « Ou » dans les déclencheurs de l'Atelier, texte des cartes perso plus lisible

- **Atelier : déclencheur « ou »**. Sous « Quand elle agit », le menu **ou aussi** ajoute un deuxième moment pour la même capacité : « À chaque fois que cette créature arrive sur le champ de bataille ou attaque, piochez une carte. » La phrase se forme toute seule, en français comme en anglais (« Whenever … enters or attacks »), avec un effet simple ou un choix de modes. Forge reçoit deux déclencheurs qui lancent le même effet, et la carte n'écrit la phrase qu'une fois.
- En partie, « que » devant le nom d'une carte qui commence par une voyelle devient « qu' » (« À chaque fois qu'Essai… »).
- **Texte des cartes perso** : il pouvait rester tout petit dans son cadre (sur PC surtout, dans l'aperçu au survol), quand la première mesure de sa taille avait été faite trop tôt. Le texte reprend maintenant la plus grande taille qui tient dans le cadre.
- **Gros texte** : l'aperçu d'une carte au survol (PC) est plus grand, son texte aussi.
- **Atelier en paysage** : la page ne défile plus sur le côté (les listes cachées sous les menus « Extension » et « Type » prenaient toute la largeur de l'écran et décalaient l'affichage).
- **Carte perso en anglais** : ses mots-clés restent en anglais en partie (« First strike, haste, menace » au lieu de « Initiative, célérité, menace » au milieu de phrases anglaises).

## 0.8.0 — Niveaux de l'IA, 2 contre 2, cube, Gauntlet, test de main, vérification de tout le jeu

### Salon
- **Niveau de chaque IA**, à côté de son style de jeu : **Facile** (25 % de points de vie en moins), **Normal** (l'IA de Forge telle quelle), **Difficile** (sa bibliothèque est mélangée en sa faveur : terrains bien répartis, ni noyée ni à court) et **Expert** (pareil, avec 25 % de points de vie en plus).
- **2 contre 2** dans « Variante » : ton allié (choisi parmi les IA) et toi contre deux IA. Chacun garde ses points de vie et son deck, on n'attaque que l'équipe adverse, les tours alternent entre les équipes. L'équipe gagne même si un de ses joueurs a été éliminé avant la fin.

### Limité et défis
- **Cubes** : les 94 cubes de Forge (Vintage, Legacy, Pauper, Arena, Old School…) donnent des boosters pour le scellé et le draft. Chaque booster prend 15 cartes du cube, sans remise : pas de doublons entre les boosters.
- **Gauntlet** : ton deck contre cinq adversaires d'affilée, de plus en plus forts (Facile, Normal, Normal, Difficile, Expert). Commander : des préconstruits tirés au hasard ; construit : des decks générés par Forge. Une défaite arrête la série, une égalité se rejoue ; « Manche suivante » sur l'écran de fin, et ton record est gardé.
- La tuile de l'accueil s'appelle maintenant « Limité et défis ».

### Decks
- **Tester la main** dans l'éditeur de deck : 7 cartes au hasard, mulligan (règle de Londres : on repioche 7 cartes et on en remet une par mulligan sous la bibliothèque), « Piocher » pour les tours suivants, et les chances d'avoir 0 à 7 terrains en main de départ.

### Cartes en français
- **Texte français des cartes récentes** : les cartes trop récentes pour les traductions de Forge prennent le nom, le type et le texte de leur impression française (Scryfall), dans la recherche, le deck builder et en partie (pile comprise). Vérifié en tâche de fond une fois par jour et gardé sur l'appareil ; réglage « Texte français des cartes récentes » et bouton « Mettre à jour maintenant ».
- Une fenêtre de Forge disait « … de la plate-forme de … » : elle dit maintenant « (deck de …) », et les titres des fenêtres commencent par une majuscule.

### Lisibilité
- **Gros texte** (Réglages, « Lisibilité ») : les textes à lire passent un cran au-dessus (carte agrandie, journal, pile, consignes de la partie, fenêtres, menus, notes).

### Atelier
- **Accueil en onglets** : Cartes, Jetons, Extensions et Types, chacun avec son bouton de création. Les filtres (extension, type de carte) sont deux menus au lieu de deux murs de pastilles, et les explications se déplient avec « Comment ça marche ? ».
- **Éditeur plus clair** : les onglets Formulaire, Script Forge et Apparence sont à plat (sur téléphone, ils s'affichaient dans une boîte verticale en pointillés) ; les mots-clés choisis sont en tête (touche pour retirer), et les groupes de mots-clés restent repliés tant qu'on n'y a rien choisi.
- **Barre d'actions toujours visible** sur téléphone (en bas) : Annuler, Rétablir, Essayer, Enregistrer. Plus besoin de remonter tout le formulaire pour enregistrer.

### Corrections (vérification de tout le jeu)
- **Énigmes** : elles plantaient au démarrage (la partie restait figée au premier tour). Elles se lancent et leur objectif s'applique ; la carte « Objectif de l'énigme » est en français.
- **Partie figée par l'IA** : certaines logiques d'IA de Forge plantaient sur un cas imprévu (Sin Prodder sans carte révélée…), et la partie ne bougeait plus. L'IA prend maintenant le premier choix possible et la partie continue.
- **Archenemy en français** : les 69 machinations que Forge laissait en anglais ont leur nom et leur type (« Machination », « Machination continue »), et les 10 qui n'avaient aucun texte français l'ont aussi.
- **Reprise d'une partie sauvegardée** : la fenêtre « L'IA ne peut pas bien jouer ces cartes », déjà vue au début de la partie, ne revient plus bloquer la reprise.
- **Attaque refusée** : le message « Attack declaration invalid » est remplacé par une explication en français (créature obligée d'attaquer, attaquants limités, joueur qu'on ne peut pas attaquer).
- **Texte des cartes en partie** : plus de lignes de Forge en anglais à la fin du texte (« +1/+1 counters: 2 », blessures, carte attachée : le plateau les montre déjà) ; les autres notes sont traduites (type choisi, joueur choisi, niveau de classe, hors phase, boucliers de régénération…). L'effet d'une aventure s'appelle « Aventure : … » au lieu de « … (156)'s Adventure ».
- **Jetons** : « Jeton Gobelin » au lieu de « Gobelin Jeton », sans numéro, même pour un jeton mort avant d'avoir été affiché ; les textes des jetons de Forge sont en français.
- **Fenêtres de choix** : leurs titres et consignes (234 titres des scripts de Forge, et la plupart des consignes de ciblage) sont en français, avec une majuscule.
- **Pile et journal** : la ligne « résolu » d'un sort qui se résout tout de suite (sans que la pile ait eu le temps de s'afficher) était en anglais (« Électrolyse deals 2 damage divided to … ») : son texte français est préparé dès que le sort arrive sur la pile. Un déclencheur modal ne mélange plus les deux langues (« When … enters, • Piochez deux cartes ») ; les phrases des capacités sont prises dans le texte français de la carte, phrase par phrase ou ligne par ligne. Une capacité en plusieurs morceaux est traduite en entier (Électrolyse garde « Piochez une carte »). Le journal traduit aussi la confrontation, le sort contrecarré, le mode choisi par l'IA (« Défaussez-vous d'une carte ») et d'autres lignes de Forge. Une ligne qu'on ne sait pas traduire en entier reste en anglais plutôt que de mélanger les deux langues.
- **Texte français des cartes récentes** : seul ce qui manque vient de Scryfall (le nom ou le texte déjà traduits par Forge sont gardés).
- **Triche « points de vie »** : un joueur mis à 0 perd tout de suite, même si une invite est ouverte (la cible d'un déclencheur, par exemple).
- Mots-clés traduits en plus : Dévorement de nourriture, d'artefacts, de terrains ; Protection contre chaque couleur.

## 0.7.3 — Planechase, scellé et draft, énigmes, partage de cartes perso

### Mises à jour
- **Les mises à jour se proposent toutes seules sur téléphone** : la vérification se fait à l'ouverture de l'appli et à chaque retour dedans (un téléphone garde l'appli en arrière-plan sans la relancer), au plus toutes les vingt minutes. Si GitHub refuse de répondre (limite d'appels, fréquente sur un réseau mobile), l'appli lit la page de la version à la place.
- « Plus tard » remet la proposition à six heures plus tard.
- **Quoi de neuf** : au premier lancement après une mise à jour, une fenêtre montre les nouveautés de la version installée.

### Sandbox
- **Planechase**, à côté d'Archenemy dans « Variante » (2 à 4 joueurs) : chaque joueur a un paquet planaire de 10 plans différents, dont 2 phénomènes au plus, tirés de tous les plans ou d'un produit (Planechase 2009, 2012, Anthology, L'invasion des machines). Le plan en cours est affiché sur la ligne du milieu (touche pour le lire en grand) ; un nouveau plan s'annonce. Le bouton du **dé planaire** est à côté des outils : gratuit au premier lancer du tour, puis {1} de plus à chaque fois. Les résultats sont en français (changement de plan, chaos, rien). L'IA lance le dé aussi.
- **Limité et énigmes** (nouvelle tuile de l'accueil) :
  - **Scellé** : six boosters d'une extension de Magic, ou d'une de tes extensions perso, et un deck de 40 cartes contre l'IA, qui joue un deck construit par Forge avec ses propres boosters.
  - **Draft** : huit joueurs dont sept IA, trois boosters chacun, on prend une carte et on passe le reste (à gauche, à droite, à gauche). Puis ton deck contre un des drafteurs IA.
  - Construction du deck : touche une carte pour l'ajouter ou la retirer, terrains de base à volonté (ou « 17 auto »), et « Deck automatique » (le deck que Forge construirait avec tes cartes).
  - **Énigmes** : les 376 énigmes de Forge (la plupart des « Possibility Storm »), avec leur objectif en français, leur difficulté et celles déjà résolues.
- **Revenir en arrière** (menu de la partie) : la partie reprend au moment calme précédent (le début de la phase d'avant, à peu près). On peut revenir plusieurs fois de suite.
- Une carte ajoutée par la triche sur le champ de bataille applique tout de suite les règles d'état (légende, monde, endurance 0).

### Atelier
- **Enchantements Monde** : une pastille « Monde » à côté de « Légendaire » (avec Enchantement). La règle du monde est appliquée par Forge : s'il y a plusieurs permanents « Monde », seul le plus récent reste, les autres vont au cimetière. Le type s'écrit « Enchantement mondial ».
- **Pièces** (deux portes, chacune avec son coût, déverrouillées en la lançant ou en payant leur coût) et **Présages** (un sort qui retourne dans la bibliothèque) dans « Faces ». Nouveau déclencheur « Quand vous déverrouillez cette porte ».
- **Essayer en partie** : enregistre la carte et lance une partie contre l'IA avec ton dernier deck ; la carte arrive dans ta main au début du premier tour.
- **Partager** : tes cartes perso, jetons, extensions (avec leur logo) et types perso dans un fichier .atcards, à envoyer avec le menu « Partager » du téléphone (ou téléchargé sur PC). Tout l'Atelier, une extension, ou les cartes choisies avec « Organiser ». **Importer…** ajoute les cartes d'un fichier reçu.
- **Image PNG** : la carte telle qu'elle s'affiche, en grande image, à partager.
- **Annuler / Rétablir** (↶ ↷, ou Ctrl+Z / Ctrl+Y) dans l'éditeur.
- **Reprendre un script dans le formulaire** : dans « Script Forge », le nom, le coût, les types, la force et les mots-clés d'un script passent dans le formulaire (les capacités écrites en script sont à refaire).
- **Statistiques de chaque carte perso** dans l'éditeur : parties jouées avec elle dans le deck, victoires, fois où elle a été jouée.

### Technique
- **Chargement plus rapide** : l'Atelier et la boutique (près de la moitié du code de l'interface) ne sont plus lus au démarrage, mais préparés en tâche de fond.
- **Tests de l'Atelier par Forge** à chaque build de test : chaque effet, déclencheur, mot-clé et sorte de carte (plus de 4 700 scripts) doit être accepté par le moteur.
- **Build iPhone** : construit sur les Mac Intel de GitHub, il ne finit plus « en échec » à cause des Mac Apple Silicon saturés.

## 0.7.2 — X partout dans l'Atelier

### Atelier
- **Plus de « N » dans l'Atelier, seulement des X** : tous les effets (« Elle gagne +X/+X », « Détruire X permanents ciblés », « Regarder les X cartes du dessus », « Monstruosité X »…), les déclencheurs (« de force X ou plus »), les conditions (« Si vous contrôlez au moins X créatures »), les emblèmes et les coûts (« payez X points de vie ») écrivent X. Le chiffre se tape dans la case à côté, ou X se calcule avec « Nombre » (X payé, créatures, jetons créés juste avant…).

## 0.7.1 — Retirer ce qu'un adversaire contrôle, sorts à plusieurs effets

### Atelier
- **Détruire, exiler ou renvoyer dans la main « … qu'un adversaire contrôle »** : trois effets directs dans « Détruire, exiler, contrer », avec dans « Quoi » seulement ce que contrôlent les adversaires : une créature (par défaut), un permanent, un permanent non-terrain, un artefact, un enchantement, un artefact ou un enchantement, un terrain, un planeswalker ou un jeton.
- **Sorts à plusieurs capacités « Effet du sort »** : la carte les fait toutes, l'une après l'autre, au lieu de demander laquelle jouer (« Choisir la capacité à jouer »). Chaque capacité garde sa condition : « Si vous êtes le monarque, … » ne se fait que si vous êtes le monarque.
- Ces types de l'adversaire marchent aussi avec « Détruire / exiler N (ou X) permanents ciblés », « Détruire / exiler tous les permanents d'un type » et « … de valeur de mana N ou moins » (« Détruisez tous les artefacts que vos adversaires contrôlent »).

## 0.7.0 — Cartes à deux faces, effets enchaînés avec X, sagas et classes

### Cartes à deux faces (Atelier)
- **Nouveau choix « Faces »** en haut du formulaire, avec une bascule **Recto / Verso** : le formulaire, l'aperçu et l'illustration montrent la face choisie. Chaque face a son nom, ses types, sa force, ses mots-clés et ses capacités.
- **Recto verso qui se transforme** : créature ↔ créature, enchantement ↔ créature, artefact ↔ terrain… Le nouvel effet « La transformer » retourne la carte (depuis le recto ou le verso). Le verso n'a pas de coût : on choisit ses couleurs.
- **Jour et nuit** : Diurne au recto, Nocturne au verso, la carte se retourne avec le jour et la nuit.
- **Recto verso modale (MDFC)** : chaque face a son coût, on joue celle qu'on veut (un sort d'un côté, un terrain de l'autre…).
- **Aventure** : le verso est un éphémère ou un rituel d'aventure, écrit sous le texte de la carte.
- **Préparée** : le verso est le sort de la carte ; le nouvel effet « La préparer » permet d'en lancer une copie.
- **Bataille (siège)** : le recto a sa défense (dans un écusson en bas à droite) ; vaincue, elle se retourne sur son verso.
- En partie, en recherche et dans le deck builder, le verso garde le cadre de l'Atelier, avec sa propre illustration (sinon celle du recto). Le verso et son illustration suivent le compte sur les autres appareils.

### Effets et règles
- **« …, puis … » avec X** : un effet enchaîné a maintenant son propre nombre :
  - le même X que l'effet principal (« Détruisez X créatures ciblées, puis créez X jetons ») ;
  - le nombre de permanents créés, détruits, exilés ou sacrifiés juste avant (« créez trois jetons Trésor, puis X blessures à chaque créature adverse, X étant le nombre de jetons créés ainsi » ; « détruisez une créature ciblée, puis créez autant de jetons ») ;
  - ou n'importe quel X calculé (créatures, terrains, points de vie, jetons artefact que vous contrôlez…).
- **Le nombre d'un effet se choisit à côté de l'effet** (N, ou X payé, ou un X calculé) au lieu d'être caché dans « Effet perso » ; un X s'affiche à la place du chiffre.
- **Combat** : « Une créature ciblée que vous contrôlez se bat contre une créature ciblée que vous ne contrôlez pas ».
- **Blessures au bloqueur** : « elle inflige N blessures à la créature qui la bloque » (ou à chaque créature qui la bloque, ou à la créature qu'elle bloque), et un nouveau déclencheur « Quand une de vos créatures devient bloquée ».
- **Mettre en jeu sans payer** : mettre une carte d'un type (créature, artefact, permanent…) de votre main sur le champ de bataille, et lancer un sort de votre main de valeur de mana N (ou X) ou moins sans payer son coût.
- **Engager ses permanents comme coût** : en plus des jetons, créatures et artefacts, « Engagez X (ou N) permanents / terrains / enchantements dégagés que vous contrôlez ».
- **Perte de points de vie** : conditions « si un adversaire a perdu des points de vie ce tour-ci », « si vos adversaires ont perdu au moins N points de vie ce tour-ci », « si vous avez perdu des points de vie ce tour-ci », et X = les points de vie que vous avez perdus ce tour-ci.

### Mécaniques
- **Sagas** : plusieurs capacités sur un même chapitre se suivent (avant, seule la première comptait), et une capacité peut couvrir plusieurs chapitres (« I, II — »). Sur la carte, les numéros de chapitre sont dans des insignes.
- **Classes** : chaque niveau (son coût et « Niveau 2 ») est dans un bandeau, comme sur les vraies classes.
- **Suspecter** (une créature ciblée, ou elle-même) et **Voiler** la carte du dessus de votre bibliothèque.
- **Dévorement de nourriture**, **d'artefacts** et **de terrains**, à côté de Dévorement.
- **Mana phyrexian** : un bouton « Phyrexian ϕ » dans le choix du coût, puis une couleur ({R/P}, payable avec 2 points de vie).
- **Terrains planètes** : un terrain avec le sous-type Planète reçoit Station (sans devenir un vaisseau spatial ni une créature). Chaque capacité peut être cochée « Seulement à STATION N+ » : elle ne marche qu'à partir de N marqueurs charge, comme sur les planètes d'Edge of Eternities. La même option marche sur un vaisseau spatial (ses capacités de créature à STATION N+).
- Vérifiés dans Forge : Fouille, Progéniture, Mue, Mégamue, Déguisement, Lecture rapide, Manifester l'effroi, affaires (« À résoudre — »).

### Atelier, affichage
- **Seulement le texte d'ambiance** (onglet Apparence) : la carte cache le texte de ses capacités et ne garde que le texte d'ambiance ; les capacités marchent toujours en partie.
- **Symbole du mana rouge** : une vraie flamme, qui ne se confond plus avec la goutte du bleu.
- **Vaisseaux spatiaux** : le seuil « STATION N+ » dans un bandeau, ses capacités en dessous ; la force et l'endurance d'un vaisseau (ou d'un véhicule) sont affichées sur la carte, comme sur les vraies, même avant qu'il soit une créature.
- **Classes réimprimées** : plus de repères « //Level_2// » dans le texte, et le rappel des niveaux en français.

- **Catégories dans la liste de l'Atelier** : en plus des extensions, des pastilles Créatures, Artefacts, Enchantements, Terrains, Planeswalkers, Éphémères et rituels, Batailles (avec le nombre de cartes) ; le choix est retenu.

### Recherche
- **Chercher dans le texte des cartes**, par mots : chaque mot tapé peut être dans le nom ou dans le texte (« détruisez artefact » trouve les cartes qui détruisent un artefact). Activé par défaut (interrupteur « Dans le texte ») ; les cartes trouvées par leur nom restent en tête, les autres filtres ne changent pas.

### Corrections
- **En partie, l'aperçu au survol** (PC) marche aussi pour les cartes des fenêtres de cimetière, d'exil et de main, pas seulement pour celles du champ de bataille.
- **Effets enchaînés qui utilisaient X** : le X était ignoré après « puis » ; il compte maintenant.

## 0.6.9 — Proportions des cartes perso

### Corrections
- **Cartes perso à long texte** : la boîte de texte ne monte plus sur l'illustration, la carte garde les proportions d'une vraie carte Magic. Le texte reste lisible grâce à un interligne et des marges plus serrés.

## 0.6.8 — Autres illustrations des cartes perso, terrains full art, sorts en X

### Atelier
- **Une autre illustration pour une carte perso**, sans doublon renommé (« NomDeCarte 2 ») :
  - bouton « ↻ Autre illustration… » dans l'éditeur de la carte, ou « ＋ Réimpression », qui propose maintenant aussi les cartes perso ;
  - même nom, mêmes règles : la carte ne change pas, sa réimpression a son illustration, son extension, sa rareté, son artiste et son cadre ;
  - elle se choisit dans le deck builder (pinceau d'une ligne du deck), à côté de la carte d'origine ;
  - si la carte est modifiée ou renommée, ses réimpressions suivent.
- **Détruire ou exiler N (ou X) permanents ciblés** d'un type : « Détruisez X créatures ciblées », « Exilez deux artefacts ciblés ».
- **Détruire ou exiler chaque permanent d'un type de valeur de mana N (ou X) ou moins** : « Détruisez chaque créature dont la valeur de mana est inférieure ou égale à X ».
- **Explorer, comploter, endurer** : la carte elle-même, une créature ciblée que vous contrôlez, jusqu'à deux, ou chaque créature que vous contrôlez. Aussi dans un éphémère ou un rituel.
- **« Vos terrains (ou créatures, artefacts…) ont « {T} : Ajoutez un mana de la couleur de votre choix. » »**, en effet permanent.
- **Terrains de base réimprimés** (Plaine, Île, Marais, Montagne, Forêt, Lande et leurs versions enneigées), section « Texte du terrain » de l'onglet Apparence :
  - « Rappel » : « ({T} : Ajoutez {W}.) », en français (avant : « ({T}: Add {W}.) » en anglais) ;
  - « Grand symbole de mana » : un seul grand symbole au milieu de la boîte de texte ;
  - « Pas de texte » : avec le cadre « Illustration pleine » ou « Sans bord », plus de boîte de texte et le type descend en bas de la carte : l'illustration occupe toute la carte (full art).
- **Texte d'ambiance sur une réimpression** (champ dans l'onglet Apparence), par exemple sous le grand symbole d'un terrain.
- **Cartes perso avec beaucoup de texte** : la boîte de texte s'agrandit vers le haut, par-dessus le bas de l'illustration, au lieu de réduire le texte jusqu'à le rendre illisible. Le texte reste à une taille lisible (environ 12 px sur une carte de 300 px de large au lieu de 8).

### Corrections
- **Sorts avec {X} dans le coût** (« Piochez X cartes », « Détruisez X créatures ciblées ») : le X annoncé était payé comme 0. Il est maintenant payé et compte vraiment.
- **Triche « Ajouter une carte »** : une carte dont l'arrivée cible une de vos créatures attendait une dizaine de secondes avant de prendre en compte la cible. Elle la prend tout de suite.
- **Sur la pile et dans le journal**, un sort perso s'écrit avec son texte français (« Une créature ciblée que vous contrôlez explore. »), plus en anglais.
- **Deck builder** : la carte perso d'origine s'appelle « Carte perso (Atelier) » parmi ses impressions.
- **PC : listes déroulantes qui sortaient de l'écran.** Une liste ouverte vers le bas prenait la hauteur de la place disponible au-dessus du bouton et passait sous la barre des tâches. Elle s'arrête maintenant au bas de la partie visible de la fenêtre, ou s'ouvre vers le haut.

## 0.6.7 — Réimpressions, maîtrise des éléments

### Atelier : réimpressions
- **« ＋ Réimpression »** : une carte officielle (Anneau solaire, Foudre…) avec ton illustration, comme si elle sortait dans une de tes extensions.
  - Tu choisis la carte (recherche en français ou en anglais), puis son illustration, son extension, sa rareté, son artiste, son cadre et son effet visuel.
  - Elle garde ses règles : Forge la joue comme la carte officielle, avec son texte français.
- **Dans l'Atelier**, elle se range dans le bloc de son extension, marquée ↻, avec un numéro (« 003/120 ») comme les cartes perso.
- **Dans le deck builder**, elle apparaît en tête des impressions de la carte (pinceau d'une ligne du deck) ; une fois choisie, elle se joue en partie avec ton illustration.
- **La recherche par extension** montre aussi ses réimpressions.
- L'impression habituelle de la carte ne change pas : ta réimpression ne sert que là où tu la choisis.
- Les réimpressions et leurs illustrations suivent le compte sur les autres appareils.

### Atelier : nouveaux effets et déclencheurs
- **Maîtrise des éléments** (avec les termes des cartes françaises) :
  - **Maîtrise du Feu N**, mot-clé : en attaquant, ajoutez N {R}, qui dure jusqu'à la fin du combat ;
  - **maîtrisez la Terre N** : un terrain que vous contrôlez devient une créature 0/0 avec la célérité et N marqueurs +1/+1 ;
  - **maîtrisez l'Air** sur une créature ou un permanent non-terrain ciblé (jusqu'à N) : il est exilé, et son propriétaire peut le relancer pour {2} ;
  - **Maîtrisez l'Eau {N}**, en coût d'une capacité ou en coût supplémentaire d'un sort : on peut engager ses artefacts et ses créatures pour payer ;
  - déclencheur « **Quand vous maîtrisez** l'Eau, la Terre, le Feu ou l'Air » (ou un seul élément).
- **Vos terrains, artefacts, enchantements… deviennent des créatures N/N**, d'un type au choix (« les artefacts non-créatures que vous contrôlez deviennent des créatures 4/4 Élémental ») :
  - jusqu'à la fin du tour ou pour toujours ;
  - ou en effet permanent (« … sont des créatures 4/4 en plus de leurs autres types »).
- **Doubler les marqueurs sur chaque créature** (de chaque type ou d'un type), les vôtres ou toutes.
- **Nouveaux déclencheurs** :
  - quand vous lancez un **sort historique** ;
  - quand vous lancez un sort d'un type (artefact, enchantement, légendaire, multicolore, incolore, éphémère ou rituel, planeswalker, de clan) ;
  - quand vous lancez un sort de **valeur de mana N ou plus** ;
  - quand une **créature de force N ou plus** arrive sous votre contrôle ;
  - quand une créature, un artefact, un enchantement, un planeswalker ou un permanent non-terrain de **valeur de mana N ou plus** arrive sous votre contrôle.
- **Engager des permanents en coût** : « Engagez deux créatures… » avec un nombre fixe (une à dix), ou X au choix en jouant, qui vaut maintenant **au moins 1**. Avec X = 0, une capacité de mana ou de pioche devenait gratuite, donc infinie.
- **« Organiser » → « Rareté… »** : la rareté de plusieurs cartes d'un coup.

### Corrections
- PC : une liste déroulante ouverte (par exemple « Quand elle agit ») ne cache plus son premier choix sous le titre de son groupe.
- En partie, la cible d'un déclencheur s'écrit « (cible : Grizzlis) », sans crochets en trop.
- « Maîtrise du Feu » en français sur la pile et dans le journal.

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
