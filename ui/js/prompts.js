// Consignes de Forge restées en anglais (ciblage des scripts de cartes : « Select target creature with flying »,
// « Choose another target creature you control »…) : traduites en français, phrase par phrase. Module sans DOM (testé
// sur toutes les consignes des scripts de Forge).

// Groupes de mots, du plus long au plus court : l'ordre français (« créature attaquante ») vient des groupes entiers.
const PHRASES = [
  [/\bto distribute (?:the )?damage to\b/gi, 'entre lesquelles répartir les blessures'], [/\bto distribute (?:the )?counters to\b/gi, 'entre lesquelles répartir les marqueurs'],
  [/\bto redirect the damage to\b/gi, 'vers laquelle rediriger les blessures'], [/\bto redirect the damage from\b/gi, 'dont rediriger les blessures'],
  [/\bto prevent damage to\b/gi, 'à qui éviter les blessures'], [/\bthat was dealt damage this turn\b/gi, 'qui a subi des blessures ce tour-ci'],
  [/\bthat dealt damage to you this turn\b/gi, 'qui vous a infligé des blessures ce tour-ci'], [/\bthat dealt combat damage to you this turn\b/gi, 'qui vous a infligé des blessures de combat ce tour-ci'],
  [/\bthat can't block this creature this turn\b/gi, 'qui ne peut pas bloquer cette créature ce tour-ci'],
  [/\b(?:that's |that is )?attacking you\b/gi, 'qui vous attaque'], [/\bthat crewed it this turn\b/gi, 'qui l\'a pilotée ce tour-ci'],
  [/\bthat share a creature type\b/gi, 'qui ont un type de créature en commun'], [/\bthat share a permanent type\b/gi, 'qui ont un type de permanent en commun'],
  [/\bthat share a color\b/gi, 'qui ont une couleur en commun'],
  [/\bwith a single target\b/gi, 'avec une seule cible'], [/\bexiled with this creature\b/gi, 'exilée avec cette créature'],
  [/\bexiled with this artifact\b/gi, 'exilée avec cet artefact'], [/\bexiled with this enchantment\b/gi, 'exilée avec cet enchantement'],
  [/\bdamaged player controls\b/gi, 'que le joueur blessé contrôle'], [/\beach opponent controls\b/gi, 'que chaque adversaire contrôle'],
  [/\battached to a creature\b/gi, 'attachée à une créature'], [/\battached to (?:it|this creature)\b/gi, 'attachée à cette créature'],
  [/\bto put a \+1\/\+1 counter(?: on)?\b/gi, 'sur laquelle mettre un marqueur +1/+1'], [/\bto move \+1\/\+1 counters(?: from)?\b/gi, 'dont déplacer les marqueurs +1/+1'],
  [/\bwith a time counter on it or suspended card\b/gi, 'avec un marqueur « temps », ou carte en suspension'],
  [/\bfrom a single graveyard\b/gi, 'd\'un même cimetière'], [/\bfrom an opponent's graveyard\b/gi, 'du cimetière d\'un adversaire'],
  [/\bfrom a graveyard\b/gi, 'd\'un cimetière'], [/\bfrom your hand\b/gi, 'de votre main'], [/\bto mill\b/gi, 'qui meule'],
  [/\bto return to (?:its )?owner's hand\b/gi, 'à renvoyer dans la main de son propriétaire'], [/\bthat must block this creature this turn\b/gi, 'qui doit bloquer cette créature ce tour-ci'],
  [/\bto deal (\d+|X) damage to\b/gi, 'à qui infliger $1 blessures'], [/\bto deal damage to\b/gi, 'à qui infliger des blessures'],
  [/\bto get ([+-][\dX]+\/[+-][\dX]+)/gi, 'qui gagne $1'], [/\bto gain life\b/gi, 'qui gagne des points de vie'], [/\bto draw a card\b/gi, 'qui pioche une carte'],
  [/\bcontrolled by the same player\b/gi, 'contrôlées par le même joueur'], [/\bthe active player controls\b/gi, 'que le joueur actif contrôle'],
  [/\byour opponent controls\b/gi, 'que votre adversaire contrôle'], [/\b(?<!an )opponent controls\b/gi, 'qu\'un adversaire contrôle'],
  [/\bin targeted player's graveyard\b/gi, 'dans le cimetière du joueur ciblé'], [/\bin graveyards\b/gi, 'dans des cimetières'], [/\bfrom graveyards\b/gi, 'de cimetières'],
  [/\bof the chosen type\b/gi, 'du type choisi'], [/\bof the chosen color\b/gi, 'de la couleur choisie'],
  [/\bthis creature\b/gi, 'cette créature'], [/\bthis artifact\b/gi, 'cet artefact'], [/\bthis card\b/gi, 'cette carte'],
  [/\bthe active player\b/gi, 'le joueur actif'], [/\bcreature type\b/gi, 'type de créature'],
  [/\bactivated or triggered abilit(y|ies)\b/gi, 'capacité activée ou déclenchée'],
  [/\bactivated abilit(y|ies)\b/gi, 'capacité activée'], [/\btriggered abilit(y|ies)\b/gi, 'capacité déclenchée'],
  [/\bspell or abilit(y|ies)\b/gi, 'sort ou capacité'],
  [/\binstant or sorcery spells?\b/gi, 'sort d\'éphémère ou de rituel'], [/\binstant or sorcery cards?\b/gi, 'carte d\'éphémère ou de rituel'],
  [/\binstant or sorcery\b/gi, 'éphémère ou rituel'],
  [/\bnoncreature spells?\b/gi, 'sort non-créature'], [/\bcreature spells?\b/gi, 'sort de créature'],
  [/\bartifact or creature spells?\b/gi, 'sort d\'artefact ou de créature'],
  [/\battacking or blocking creatures?\b/gi, 'créature attaquante ou bloqueuse'],
  [/\battacking creatures?\b/gi, 'créature attaquante'], [/\bblocking creatures?\b/gi, 'créature bloqueuse'],
  [/\bunblocked attacking creatures?\b/gi, 'créature attaquante non bloquée'],
  [/\buntapped creatures?\b/gi, 'créature dégagée'], [/\btapped creatures?\b/gi, 'créature engagée'],
  [/\buntapped lands?\b/gi, 'terrain dégagé'], [/\btapped lands?\b/gi, 'terrain engagé'],
  [/\bnonbasic lands?\b/gi, 'terrain non-base'], [/\bbasic lands?\b/gi, 'terrain de base'],
  [/\bnonland permanents?\b/gi, 'permanent non-terrain'], [/\bnoncreature permanents?\b/gi, 'permanent non-créature'],
  [/\bnoncreature artifacts?\b/gi, 'artefact non-créature'], [/\bnonartifact creatures?\b/gi, 'créature non-artefact'],
  [/\bnontoken creatures?\b/gi, 'créature non-jeton'], [/\bnonlegendary creatures?\b/gi, 'créature non-légendaire'],
  [/\blegendary creatures?\b/gi, 'créature légendaire'], [/\bnonwhite creatures?\b/gi, 'créature non-blanche'],
  [/\bnonblue creatures?\b/gi, 'créature non-bleue'], [/\bnonblack creatures?\b/gi, 'créature non-noire'],
  [/\bnonred creatures?\b/gi, 'créature non-rouge'], [/\bnongreen creatures?\b/gi, 'créature non-verte'],
  [/\bwhite creatures?\b/gi, 'créature blanche'], [/\bblue creatures?\b/gi, 'créature bleue'], [/\bblack creatures?\b/gi, 'créature noire'],
  [/\bred creatures?\b/gi, 'créature rouge'], [/\bgreen creatures?\b/gi, 'créature verte'], [/\bcolorless creatures?\b/gi, 'créature incolore'],
  [/\bmulticolored creatures?\b/gi, 'créature multicolore'], [/\bmonocolored creatures?\b/gi, 'créature monocolore'],
  [/\bcreature or planeswalker cards?\b/gi, 'carte de créature ou de planeswalker'],
  [/\bartifact or creature cards?\b/gi, 'carte d\'artefact ou de créature'], [/\bartifact or enchantment cards?\b/gi, 'carte d\'artefact ou d\'enchantement'],
  [/\bcreature cards?\b/gi, 'carte de créature'], [/\bland cards?\b/gi, 'carte de terrain'], [/\bartifact cards?\b/gi, 'carte d\'artefact'],
  [/\benchantment cards?\b/gi, 'carte d\'enchantement'], [/\bplaneswalker cards?\b/gi, 'carte de planeswalker'], [/\bpermanent cards?\b/gi, 'carte de permanent'],
  [/\binstant cards?\b/gi, 'carte d\'éphémère'], [/\bsorcery cards?\b/gi, 'carte de rituel'], [/\bnonland cards?\b/gi, 'carte non-terrain'],
  [/\bcreature or planeswalker\b/gi, 'créature ou planeswalker'], [/\bplayer or planeswalker\b/gi, 'joueur ou planeswalker'],
  [/\bcreature or player\b/gi, 'créature ou joueur'], [/\bartifact or enchantment\b/gi, 'artefact ou enchantement'],
  [/\bartifact or creature\b/gi, 'artefact ou créature'], [/\bartifact, creature, or enchantment\b/gi, 'artefact, créature ou enchantement'],
  [/\bartifact, enchantment, or land\b/gi, 'artefact, enchantement ou terrain'],
  [/\bcreature or Vehicle\b/gi, 'créature ou Véhicule'], [/\bcreature token\b/gi, 'jeton de créature'],
  [/\bwith (\w+) power or greater\b/gi, 'de force $1 ou plus'],
  [/\bwith power (\d+|X) or (?:greater|more)\b/gi, 'de force $1 ou plus'], [/\bwith power (\d+|X) or less\b/gi, 'de force $1 ou moins'],
  [/\bwith toughness (\d+|X) or (?:greater|more)\b/gi, 'd\'endurance $1 ou plus'], [/\bwith toughness (\d+|X) or less\b/gi, 'd\'endurance $1 ou moins'],
  [/\bwith (?:converted )?mana (?:value|cost) (\d+|X) or (?:greater|more)\b/gi, 'de valeur de mana $1 ou plus'],
  [/\bwith (?:converted )?mana (?:value|cost) (\d+|X) or less\b/gi, 'de valeur de mana $1 ou moins'],
  [/\bwith (?:converted )?mana (?:value|cost) (\d+|X)\b/gi, 'de valeur de mana $1'],
  [/\bwith (?:a|one or more) \+1\/\+1 counters? on it\b/gi, 'avec un marqueur +1/+1'], [/\bwith a counter on it\b/gi, 'avec un marqueur'],
  [/\bwith counters on (?:it|them)\b/gi, 'avec des marqueurs'],
  [/\bwith flying\b/gi, 'avec le vol'], [/\bwithout flying\b/gi, 'sans le vol'], [/\bwith defender\b/gi, 'avec le défenseur'],
  [/\bwith the greatest power\b/gi, 'de plus grande force'], [/\bwith the highest mana value\b/gi, 'de plus grande valeur de mana'],
  [/\bdefending player controls\b/gi, 'que le joueur défenseur contrôle'], [/\btarget player controls\b/gi, 'que le joueur ciblé contrôle'],
  [/\bthat player controls\b/gi, 'que ce joueur contrôle'], [/\btarget opponent controls\b/gi, 'que l\'adversaire ciblé contrôle'],
  [/\ban opponent controls\b/gi, 'qu\'un adversaire contrôle'], [/\byour opponents control\b/gi, 'que vos adversaires contrôlent'],
  [/\byou don't control\b/gi, 'que vous ne contrôlez pas'], [/\byou control\b/gi, 'que vous contrôlez'],
  [/\ban opponent owns\b/gi, 'qu\'un adversaire possède'], [/\byou own\b/gi, 'que vous possédez'], [/\byou don't own\b/gi, 'que vous ne possédez pas'],
  [/\bin your graveyard\b/gi, 'dans votre cimetière'], [/\bfrom your graveyard\b/gi, 'de votre cimetière'],
  [/\bin an opponent's graveyard\b/gi, 'dans le cimetière d\'un adversaire'], [/\bin a graveyard\b/gi, 'dans un cimetière'],
  [/\bin target player's graveyard\b/gi, 'dans le cimetière du joueur ciblé'], [/\bin that player's graveyard\b/gi, 'dans le cimetière de ce joueur'],
  [/\bin your hand\b/gi, 'dans votre main'], [/\bin exile\b/gi, 'en exil'], [/\bon the battlefield\b/gi, 'sur le champ de bataille'],
  [/\bon the stack\b/gi, 'sur la pile'], [/\bthis turn\b/gi, 'ce tour-ci'], [/\bthat entered this turn\b/gi, 'arrivé ce tour-ci'],
  [/\bto copy\b/gi, 'à copier'], [/\bto sacrifice\b/gi, 'à sacrifier'], [/\bto exile\b/gi, 'à exiler'], [/\bto destroy\b/gi, 'à détruire'],
  [/\bto return\b/gi, 'à renvoyer'], [/\bto tap\b/gi, 'à engager'], [/\bto untap\b/gi, 'à dégager'], [/\bto attach\b/gi, 'à attacher'],
  [/\bto counter\b/gi, 'à contrer'], [/\bto fight\b/gi, 'qui se bat'], [/\bto block\b/gi, 'à bloquer'], [/\bto gain control of\b/gi, 'dont prendre le contrôle'],
  [/\bopponents?\b/gi, 'adversaire'], [/\bplayers?\b/gi, 'joueur'], [/\bcreatures?\b/gi, 'créature'], [/\bplaneswalkers?\b/gi, 'planeswalker'],
  [/\bartifacts?\b/gi, 'artefact'], [/\benchantments?\b/gi, 'enchantement'], [/\blands?\b/gi, 'terrain'], [/\bspells?\b/gi, 'sort'],
  [/\bpermanents?\b/gi, 'permanent'], [/\bcards?\b/gi, 'carte'], [/\btokens?\b/gi, 'jeton'], [/\bbattles?\b/gi, 'bataille'],
  [/\bequipment\b/gi, 'équipement'], [/\bauras?\b/gi, 'aura'], [/\bvehicles?\b/gi, 'Véhicule'], [/\bsagas?\b/gi, 'saga'],
  [/\babilit(y|ies)\b/gi, 'capacité'], [/\binstants?\b/gi, 'éphémère'], [/\bsorcer(y|ies)\b/gi, 'rituel'],
  [/\bnonland\b/gi, 'non-terrain'], [/\bnontoken\b/gi, 'non-jeton'], [/\bnoncreature\b/gi, 'non-créature'], [/\blegendary\b/gi, 'légendaire'],
  [/\battacking\b/gi, 'attaquante'], [/\bblocking\b/gi, 'bloqueuse'], [/\buntapped\b/gi, 'dégagée'], [/\btapped\b/gi, 'engagée'],
  [/\bother\b/gi, 'autre'], [/\beach\b/gi, 'chaque'], [/\band\/or\b/gi, 'et/ou'], [/\bor\b/g, 'ou'], [/\band\b/g, 'et'],
  [/\bwith\b/gi, 'avec'], [/\bwithout\b/gi, 'sans'], [/\bdamage\b/gi, 'blessures'], [/\bcolor\b/gi, 'couleur'],
  [/\bwhite\b/gi, 'blanc'], [/\bblue\b/gi, 'bleu'], [/\bblack\b/gi, 'noir'], [/\bred\b/gi, 'rouge'], [/\bgreen\b/gi, 'vert'],
  [/\bcolorless\b/gi, 'incolore'], [/\bmulticolored\b/gi, 'multicolore'],
];

const NUMBERS = {one: 'un', two: 'deux', three: 'trois', four: 'quatre', five: 'cinq', six: 'six', seven: 'sept', X: 'X', x: 'X'};

/** Le groupe nominal d'une consigne (« creature you control with flying ») en français. */
export function translateWhat(what) {
  let s = String(what || '').trim().replace(/[.!]$/, '');
  for (const [re, to] of PHRASES) {
    s = s.replace(re, to);
  }
  return s.replace(/\s+/g, ' ').trim();
}

const PROMPTS = [
  [/^(?:Select|Choose) any target\.?$/i, 'Choisissez n\'importe quelle cible'],
  [/^(?:Select|Choose) any (?:other )?targets? to distribute (?:the )?damage to\.?$/i, 'Choisissez les cibles entre lesquelles répartir les blessures'],
  [/^(?:Select|Choose) any number of targets to distribute (?:the )?damage to\.?$/i, 'Choisissez les cibles entre lesquelles répartir les blessures'],
  [/^(?:Select|Choose) any target to prevent damage to\.?$/i, 'Choisissez la cible à qui éviter les blessures'],
  [/^(?:Select|Choose) any target to redirect the damage to\.?$/i, 'Choisissez la cible vers laquelle rediriger les blessures'],
  [/^(?:Select|Choose) any other target\.?$/i, 'Choisissez une autre cible'],
  [/^(?:Select|Choose) (?:a )?player or planeswalker\.?$/i, 'Choisissez un joueur ou un planeswalker'],
  [/^Counter target spell\.?$/i, 'Choisissez le sort ciblé à contrecarrer'],
  [/^(?:Select|Choose) one or two targets? (.+)$/i, (m, what) => 'Choisissez une ou deux cibles : ' + translateWhat(what)],
  [/^(?:Select|Choose) one, two, or three targets? (.+)$/i, (m, what) => 'Choisissez une, deux ou trois cibles : ' + translateWhat(what)],
  [/^(?:Select|Choose) any (?:number of )?targets?\.?$/i, 'Choisissez des cibles'],
  [/^(?:Select|Choose) targets? for (.+)$/i, 'Choisissez les cibles de $1'],
  [/^(?:Select|Choose) (?:a |an )?player\.?$/i, 'Choisissez un joueur'],
  [/^(?:Select|Choose) (?:an )?opponent\.?$/i, 'Choisissez un adversaire'],
  [/^(?:Select|Choose) another target (.+)$/i, (m, what) => 'Choisissez une autre cible : ' + translateWhat(what)],
  [/^(?:Select|Choose) up to (\w+) (?:other )?targets? (.+)$/i, (m, n, what) => `Choisissez jusqu'à ${/^(one|1)$/i.test(n) ? 'une cible' : `${NUMBERS[n] || n} cibles`} : ` + translateWhat(what)],
  [/^(?:Select|Choose) any number of (?:other )?targets? (.+)$/i, (m, what) => 'Choisissez des cibles : ' + translateWhat(what)],
  [/^(?:Select|Choose) (\w+) (?:other )?targets? (.+)$/i, (m, n, what) => (NUMBERS[n] || /^\d+$/.test(n)) ? `Choisissez ${NUMBERS[n] || n} cibles : ` + translateWhat(what) : m],
  [/^(?:Select|Choose) (?:a |an |the )?(?:other )?target (.+)$/i, (m, what) => 'Choisissez la cible : ' + translateWhat(what)],
  [/^(?:Select|Choose) up to (\w+) (.+)$/i, (m, n, what) => `Choisissez jusqu'à ${NUMBERS[n] || n} : ` + translateWhat(what)],
  [/^Target (.+)$/, (m, what) => 'Cible : ' + translateWhat(what)],
  [/^Waiting for (.*?)\.*$/i, 'En attente de $1…'],
  [/^Pay Mana Cost:?/i, 'Payez le coût de mana :'],
  [/^Choose a card to discard/i, 'Choisissez une carte à défausser'],
  [/^Declare attackers/i, 'Déclarez les attaquants'],
  [/^Declare blockers/i, 'Déclarez les bloqueurs'],
];

export function translatePrompt(text) {
  return String(text || '').split('\n').map(line => {
    for (const [re, to] of PROMPTS) {
      if (re.test(line)) {
        return line.replace(re, to);
      }
    }
    return line;
  }).join('\n');
}
