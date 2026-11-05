// Atelier : du formulaire au script de Forge. Chaque capacité du formulaire (un déclencheur ou un coût, un effet, un
// filtre de créatures, un nombre) devient une ligne T:/A:/S: et son SVar, avec son texte en français, sur le modèle des
// cartes de Forge (Flametongue Kavu, Elvish Visionary, Biomathematician...). Forge vérifie ensuite le script.

export const CARD_TYPES = [
  ['Creature', 'Créature'], ['Artifact', 'Artefact'], ['Enchantment', 'Enchantement'], ['Land', 'Terrain'],
  ['Planeswalker', 'Planeswalker'], ['Instant', 'Éphémère'], ['Sorcery', 'Rituel'],
];

/**
 * Mots-clés : [clé de Forge, nom français, nom anglais, groupe, valeur, « ont … » pour les donner à d'autres créatures].
 * valeur : 'n' (un nombre : Annihilateur 2), 'gen' (un coût générique : Parade {2}), 'cost' (un coût de mana :
 * Recyclage {1}{U}) ; la valeur par défaut suit. Sans phrase « ont … », le mot-clé ne se donne pas à d'autres créatures.
 */
export const KW_ALL = [
  ['Flying', 'Vol', 'Flying', 'combat', null, 'ont le vol'],
  ['First Strike', 'Initiative', 'First strike', 'combat', null, 'ont l\'initiative'],
  ['Double Strike', 'Double initiative', 'Double strike', 'combat', null, 'ont la double initiative'],
  ['Deathtouch', 'Contact mortel', 'Deathtouch', 'combat', null, 'ont le contact mortel'],
  ['Haste', 'Célérité', 'Haste', 'combat', null, 'ont la célérité'],
  ['Lifelink', 'Lien de vie', 'Lifelink', 'combat', null, 'ont le lien de vie'],
  ['Menace', 'Menace', 'Menace', 'combat', null, 'ont la menace'],
  ['Reach', 'Portée', 'Reach', 'combat', null, 'ont la portée'],
  ['Trample', 'Piétinement', 'Trample', 'combat', null, 'ont le piétinement'],
  ['Vigilance', 'Vigilance', 'Vigilance', 'combat', null, 'ont la vigilance'],
  ['Defender', 'Défenseur', 'Defender', 'combat', null, 'ont le défenseur'],
  ['Infect', 'Infection', 'Infect', 'combat', null, 'ont l\'infection'],
  ['Wither', 'Flétrissure', 'Wither', 'combat', null, 'ont la flétrissure'],
  ['Shadow', 'Distorsion', 'Shadow', 'combat', null, 'ont la distorsion'],
  ['Fear', 'Peur', 'Fear', 'combat', null, 'ont la peur'],
  ['Intimidate', 'Intimidation', 'Intimidate', 'combat', null, 'ont l\'intimidation'],
  ['Skulk', 'Furtivité', 'Skulk', 'combat', null, 'ont la furtivité'],
  ['Horsemanship', 'Équitation', 'Horsemanship', 'combat', null, 'ont l\'équitation'],
  ['Flanking', 'Débordement', 'Flanking', 'combat', null, 'ont le débordement'],
  ['Landwalk:Plains', 'Traversée des plaines', 'Plainswalk', 'combat', null, 'ont la traversée des plaines'],
  ['Landwalk:Island', 'Traversée des îles', 'Islandwalk', 'combat', null, 'ont la traversée des îles'],
  ['Landwalk:Swamp', 'Traversée des marais', 'Swampwalk', 'combat', null, 'ont la traversée des marais'],
  ['Landwalk:Mountain', 'Traversée des montagnes', 'Mountainwalk', 'combat', null, 'ont la traversée des montagnes'],
  ['Landwalk:Forest', 'Traversée des forêts', 'Forestwalk', 'combat', null, 'ont la traversée des forêts'],
  ['Hexproof', 'Défense talismanique', 'Hexproof', 'protect', null, 'ont la défense talismanique'],
  ['Shroud', 'Linceul', 'Shroud', 'protect', null, 'ont le linceul'],
  ['Indestructible', 'Indestructible', 'Indestructible', 'protect', null, 'sont indestructibles'],
  ['Protection from white', 'Protection contre le blanc', 'Protection from white', 'protect', null, 'ont la protection contre le blanc'],
  ['Protection from blue', 'Protection contre le bleu', 'Protection from blue', 'protect', null, 'ont la protection contre le bleu'],
  ['Protection from black', 'Protection contre le noir', 'Protection from black', 'protect', null, 'ont la protection contre le noir'],
  ['Protection from red', 'Protection contre le rouge', 'Protection from red', 'protect', null, 'ont la protection contre le rouge'],
  ['Protection from green', 'Protection contre le vert', 'Protection from green', 'protect', null, 'ont la protection contre le vert'],
  ['Ward', 'Parade', 'Ward', 'protect', 'gen', null, 2],
  ['Flash', 'Flash', 'Flash', 'ability', null],
  ['Prowess', 'Prouesse', 'Prowess', 'ability', null, 'ont la prouesse'],
  ['Cascade', 'Cascade', 'Cascade', 'ability', null],
  ['Exalted', 'Exaltation', 'Exalted', 'ability', null, 'ont l\'exaltation'],
  ['Persist', 'Persistance', 'Persist', 'ability', null, 'ont la persistance'],
  ['Undying', 'Survivance', 'Undying', 'ability', null, 'ont la survivance'],
  ['Changeling', 'Changelin', 'Changeling', 'ability', null],
  ['Riot', 'Émeute', 'Riot', 'ability', null],
  ['Training', 'Entraînement', 'Training', 'ability', null, 'ont l\'entraînement'],
  ['Mentor', 'Mentor', 'Mentor', 'ability', null, 'ont le mentor'],
  ['Dethrone', 'Détrônement', 'Dethrone', 'ability', null, 'ont le détrônement'],
  ['Melee', 'Mêlée', 'Melee', 'ability', null, 'ont la mêlée'],
  ['Battle cry', 'Cri de guerre', 'Battle cry', 'ability', null],
  ['Myriad', 'Myriade', 'Myriad', 'ability', null],
  ['Evolve', 'Évolution', 'Evolve', 'ability', null],
  ['Extort', 'Extorsion', 'Extort', 'ability', null],
  ['Provoke', 'Provocation', 'Provoke', 'ability', null],
  ['Unleash', 'Emportement', 'Unleash', 'ability', null],
  ['Decayed', 'Décomposition', 'Decayed', 'ability', null],
  ['Partner', 'Partenariat', 'Partner', 'ability', null],
  ['Annihilator', 'Annihilateur', 'Annihilator', 'number', 'n', null, 2],
  ['Bushido', 'Bushido', 'Bushido', 'number', 'n', null, 1],
  ['Toxic', 'Toxique', 'Toxic', 'number', 'n', null, 1],
  ['Afflict', 'Affliction', 'Afflict', 'number', 'n', null, 2],
  ['Afterlife', 'Au-delà', 'Afterlife', 'number', 'n', null, 1],
  ['Fabricate', 'Fabrication', 'Fabricate', 'number', 'n', null, 1],
  ['Rampage', 'Sauvagerie', 'Rampage', 'number', 'n', null, 1],
  ['Modular', 'Modularité', 'Modular', 'number', 'n', null, 1],
  ['Renown', 'Réputation', 'Renown', 'number', 'n', null, 1],
  ['Bloodthirst', 'Soif de sang', 'Bloodthirst', 'number', 'n', null, 1],
  ['Dredge', 'Dragage', 'Dredge', 'number', 'n', null, 2],
  ['Fading', 'Évanescence', 'Fading', 'number', 'n', null, 3],
  ['Vanishing', 'Disparition', 'Vanishing', 'number', 'n', null, 3],
  ['Cycling', 'Recyclage', 'Cycling', 'cost', 'cost', null, '{2}'],
  ['Flashback', 'Flashback', 'Flashback', 'cost', 'cost', null, '{3}'],
  ['Unearth', 'Exhumation', 'Unearth', 'cost', 'cost', null, '{2}'],
  ['Ninjutsu', 'Ninjutsu', 'Ninjutsu', 'cost', 'cost', null, '{2}'],
  ['Dash', 'Précipitation', 'Dash', 'cost', 'cost', null, '{2}'],
  ['Blitz', 'Blitz', 'Blitz', 'cost', 'cost', null, '{2}'],
  ['Evoke', 'Évocation', 'Evoke', 'cost', 'cost', null, '{1}'],
  ['Madness', 'Folie', 'Madness', 'cost', 'cost', null, '{1}'],
  ['Embalm', 'Embaumement', 'Embalm', 'cost', 'cost', null, '{3}'],
  ['Eternalize', 'Éternalisation', 'Eternalize', 'cost', 'cost', null, '{4}'],
  ['Encore', 'Encore', 'Encore', 'cost', 'cost', null, '{5}'],
  ['Morph', 'Mue', 'Morph', 'cost', 'cost', null, '{3}'],
  ['Disguise', 'Déguisement', 'Disguise', 'cost', 'cost', null, '{3}'],
  ['Scavenge', 'Récupération', 'Scavenge', 'cost', 'cost', null, '{3}'],
  ['Outlast', 'Résilience', 'Outlast', 'cost', 'cost', null, '{1}'],
  ['Equip', 'Équipement', 'Equip', 'cost', 'cost', null, '{2}'],
  ['Convoke', 'Convocation', 'Convoke', 'spell', null],
  ['Delve', 'Fouille', 'Delve', 'spell', null],
  ['Improvise', 'Improvisation', 'Improvise', 'spell', null],
  ['Storm', 'Déluge', 'Storm', 'spell', null],
  ['Split second', 'Fraction de seconde', 'Split second', 'spell', null],
  ['Rebound', 'Rebond', 'Rebound', 'spell', null],
];

/** Groupes des mots-clés dans le formulaire. */
export const KW_GROUPS = [
  ['combat', 'Combat et évasion'], ['protect', 'Protection'], ['ability', 'Capacités'],
  ['number', 'Avec un nombre (Annihilateur 2…)'], ['cost', 'Avec un coût (Recyclage {2}…)'], ['spell', 'Sorts'],
];

const KW_BY = Object.fromEntries(KW_ALL.map(k => [k[0], k]));

/** Mots-clés qu'on peut donner aux autres créatures (« les autres Elfes que vous contrôlez ont … »). */
export const KEYWORDS = KW_ALL.filter(k => k[5]).map(k => [k[0], k[1]]);

/** Valeur d'un mot-clé à nombre ou à coût dans le formulaire (sinon sa valeur par défaut). */
export function keywordValue(f, k) {
  const def = KW_BY[k];
  const v = ((f && f.kwValues) || {})[k];
  if (!def || !def[4]) {
    return null;
  }
  if (def[4] === 'cost') {
    return v === undefined || v === null ? def[6] : String(v);
  }
  const n = Math.round(Number(v));
  return Number.isFinite(n) && v !== '' && v !== undefined && v !== null ? Math.max(def[4] === 'gen' ? 0 : 1, Math.min(20, n)) : def[6];
}

/** Quand la capacité agit. kind : T (déclenchée), A (activée), S (statique), SP (effet du sort). */
export const WHEN = [
  {id: 'etb', kind: 'T', label: 'Quand elle arrive sur le champ de bataille'},
  {id: 'ally', kind: 'T', label: 'Quand une de vos créatures arrive', filter: true},
  {id: 'attacks', kind: 'T', label: 'Quand elle attaque'},
  {id: 'blocks', kind: 'T', label: 'Quand elle bloque'},
  {id: 'combatDamage', kind: 'T', label: 'Quand elle inflige des blessures de combat à un joueur'},
  {id: 'dies', kind: 'T', label: 'Quand elle meurt'},
  {id: 'allyDies', kind: 'T', label: 'Quand une de vos créatures meurt', filter: true},
  {id: 'landfall', kind: 'T', label: 'Quand un terrain arrive sous votre contrôle'},
  {id: 'castNonCreature', kind: 'T', label: 'Quand vous lancez un sort non-créature'},
  {id: 'castCreature', kind: 'T', label: 'Quand vous lancez un sort de créature'},
  {id: 'lifeGain', kind: 'T', label: 'Quand vous gagnez des points de vie'},
  {id: 'upkeep', kind: 'T', label: 'Au début de votre entretien'},
  {id: 'beginCombat', kind: 'T', label: 'Au début du combat de votre tour'},
  {id: 'end', kind: 'T', label: 'Au début de votre étape de fin'},
  {id: 'activated', kind: 'A', label: 'Capacité activée (coût : effet)', cost: true},
  {id: 'loyalty', kind: 'A', label: 'Capacité de loyauté (planeswalker)', loyalty: true},
  {id: 'spell', kind: 'SP', label: 'Effet du sort (éphémère, rituel)'},
  {id: 'static', kind: 'S', label: 'Effet permanent : « les … que vous contrôlez ont / gagnent … »', filter: true},
];

/** Groupes du choix « quand » dans le formulaire. */
export const WHEN_GROUPS = [['T', 'Déclenchée (quand…)'], ['A', 'Activée'], ['SP', 'Sort'], ['S', 'Permanente']];

export const TOKENS = [
  ['w_1_1_soldier', 'Soldat 1/1 blanc', 'de créature 1/1 blanche Soldat', '1/1 white Soldier creature', ''],
  ['w_1_1_human', 'Humain 1/1 blanc', 'de créature 1/1 blanche Humain', '1/1 white Human creature', ''],
  ['w_1_1_spirit_flying', 'Esprit 1/1 blanc, vol', 'de créature 1/1 blanche Esprit avec le vol', '1/1 white Spirit creature', 'flying'],
  ['w_2_2_cat', 'Chat 2/2 blanc', 'de créature 2/2 blanche Chat', '2/2 white Cat creature', ''],
  ['w_4_4_angel_flying', 'Ange 4/4 blanc, vol', 'de créature 4/4 blanche Ange avec le vol', '4/4 white Angel creature', 'flying'],
  ['u_1_1_bird_flying', 'Oiseau 1/1 bleu, vol', 'de créature 1/1 bleue Oiseau avec le vol', '1/1 blue Bird creature', 'flying'],
  ['u_2_2_drake_flying', 'Drakôn 2/2 bleu, vol', 'de créature 2/2 bleue Drakôn avec le vol', '2/2 blue Drake creature', 'flying'],
  ['b_1_1_rat', 'Rat 1/1 noir', 'de créature 1/1 noire Rat', '1/1 black Rat creature', ''],
  ['b_2_2_zombie', 'Zombie 2/2 noir', 'de créature 2/2 noire Zombie', '2/2 black Zombie creature', ''],
  ['r_1_1_goblin', 'Gobelin 1/1 rouge', 'de créature 1/1 rouge Gobelin', '1/1 red Goblin creature', ''],
  ['r_1_1_elemental_haste', 'Élémental 1/1 rouge, célérité', 'de créature 1/1 rouge Élémental avec la célérité', '1/1 red Elemental creature', 'haste'],
  ['r_5_5_dragon_flying', 'Dragon 5/5 rouge, vol', 'de créature 5/5 rouge Dragon avec le vol', '5/5 red Dragon creature', 'flying'],
  ['g_1_1_saproling', 'Saprobionte 1/1 vert', 'de créature 1/1 verte Saprobionte', '1/1 green Saproling creature', ''],
  ['g_1_1_elf_warrior', 'Elfe guerrier 1/1 vert', 'de créature 1/1 verte Elfe et Guerrier', '1/1 green Elf Warrior creature', ''],
  ['g_2_2_wolf', 'Loup 2/2 vert', 'de créature 2/2 verte Loup', '2/2 green Wolf creature', ''],
  ['g_3_3_beast', 'Bête 3/3 verte', 'de créature 3/3 verte Bête', '3/3 green Beast creature', ''],
  ['c_1_1_a_thopter_flying', 'Mécanoptère 1/1, vol', 'de créature-artefact 1/1 incolore Mécanoptère avec le vol', '1/1 colorless Thopter artifact creature', 'flying'],
  ['c_1_1_a_servo', 'Servo 1/1', 'de créature-artefact 1/1 incolore Servo', '1/1 colorless Servo artifact creature', ''],
  ['c_a_treasure_sac', 'Trésor', 'Trésor', 'Treasure', ''],
  ['c_a_clue_draw', 'Indice', 'Indice', 'Clue', ''],
  ['c_a_food_sac', 'Nourriture', 'Nourriture', 'Food', ''],
];

/** Jetons perso de l'Atelier (posés par l'Atelier après chaque chargement), au même format que TOKENS. */
let customTokens = [];

/** Les jetons perso : [{script: 'atelier_…', name}]. */
export function setCustomTokens(list) {
  customTokens = (list || []).map(t => [t.script, `${t.name} (jeton perso)`, t.name, t.name, '']);
}

/** Jetons proposés par « Créer des jetons » : ceux de Forge, puis les jetons perso. */
export function allTokens() {
  return [...TOKENS, ...customTokens];
}

/** Couleurs d'un jeton (il n'a pas de coût) : « W », « U »… → la ligne « Colors: » de Forge. */
const COLOR_WORDS = {W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green'};

/**
 * Effets. filter : agit sur « chaque <créature filtrée> » ; n : demande un nombre ; only : n'existe que pour ces
 * « quand » ; self : agit sur la carte elle-même (pas pour un sort) ; mana : demande une couleur de mana.
 */
export const EFFECTS = [
  {id: 'damageAny', group: 'life', label: 'Blessures à n\'importe quelle cible', n: true},
  {id: 'damageCreature', group: 'life', label: 'Blessures à une créature ciblée', n: true},
  {id: 'damageOpponents', group: 'life', label: 'Blessures à chaque adversaire', n: true},
  {id: 'gainLife', group: 'life', label: 'Gagner des points de vie', n: true},
  {id: 'drain', group: 'life', label: 'Chaque adversaire perd des PV, vous les gagnez', n: true},
  {id: 'draw', group: 'cards', label: 'Piocher des cartes', n: true},
  {id: 'loot', group: 'cards', label: 'Piocher puis se défausser (autant)', n: true},
  {id: 'scry', group: 'cards', label: 'Regard', n: true},
  {id: 'surveil', group: 'cards', label: 'Surveiller', n: true},
  {id: 'mill', group: 'cards', label: 'Meuler (vous)', n: true},
  {id: 'millOpponents', group: 'cards', label: 'Chaque adversaire meule', n: true},
  {id: 'discard', group: 'cards', label: 'Chaque adversaire défausse des cartes', n: true},
  {id: 'tutor', group: 'cards', label: 'Chercher une carte dans la bibliothèque (main)'},
  {id: 'regrowth', group: 'cards', label: 'Renvoyer une créature du cimetière en main'},
  {id: 'reanimate', group: 'cards', label: 'Renvoyer une créature du cimetière sur le champ de bataille'},
  {id: 'countersSelf', group: 'creatures', label: 'Marqueurs +1/+1 sur cette créature', n: true},
  {id: 'countersEach', group: 'creatures', label: 'Marqueurs +1/+1 sur chaque créature choisie (chaque Elfe, chaque autre…)', n: true, filter: true},
  {id: 'countersTarget', group: 'creatures', label: 'Marqueurs +1/+1 sur une créature ciblée', n: true},
  {id: 'proliferate', group: 'creatures', label: 'Proliférer'},
  {id: 'pumpSelf', group: 'creatures', label: 'Elle gagne +N/+N jusqu\'à la fin du tour', n: true, self: true},
  {id: 'pumpTarget', group: 'creatures', label: '+N/+N à une créature ciblée jusqu\'à la fin du tour', n: true},
  {id: 'pumpAll', group: 'creatures', label: 'Les créatures choisies gagnent +N/+N jusqu\'à la fin du tour', n: true, filter: true},
  {id: 'grantKeywordTurn', group: 'creatures', label: 'Les créatures choisies gagnent un mot-clé jusqu\'à la fin du tour', filter: true, keyword: true},
  {id: 'regenerate', group: 'creatures', label: 'Régénération (la régénérer)', self: true},
  {id: 'token', group: 'creatures', label: 'Créer des jetons', n: true, token: true},
  {id: 'cloneToken', group: 'creatures', label: 'Créer un jeton copie d\'une créature ciblée'},
  {id: 'destroy', group: 'removal', label: 'Détruire une créature ciblée'},
  {id: 'destroyPermanent', group: 'removal', label: 'Détruire un permanent non-terrain ciblé'},
  {id: 'destroyArtEnch', group: 'removal', label: 'Détruire un artefact ou un enchantement ciblé'},
  {id: 'wrath', group: 'removal', label: 'Détruire toutes les créatures'},
  {id: 'edict', group: 'removal', label: 'Chaque adversaire sacrifie une créature'},
  {id: 'exile', group: 'removal', label: 'Exiler une créature ciblée'},
  {id: 'bounce', group: 'removal', label: 'Renvoyer une créature ciblée dans la main'},
  {id: 'fight', group: 'removal', label: 'Se battre contre une créature adverse ciblée', self: true},
  {id: 'counterSpell', group: 'removal', label: 'Contrecarrer un sort ciblé'},
  {id: 'tap', group: 'control', label: 'Engager une créature ciblée'},
  {id: 'untap', group: 'control', label: 'Dégager un permanent ciblé'},
  {id: 'threaten', group: 'control', label: 'Prendre le contrôle d\'une créature jusqu\'à la fin du tour'},
  {id: 'goad', group: 'control', label: 'Inciter une créature ciblée'},
  {id: 'addMana', group: 'mana', label: 'Ajouter du mana', n: true, mana: true, only: ['activated', 'loyalty', 'spell']},
  {id: 'rampLand', group: 'mana', label: 'Chercher un terrain de base, sur le champ de bataille engagé'},
  {id: 'explore', group: 'mech', label: 'Explorer', self: true},
  {id: 'connive', group: 'mech', label: 'Comploter', self: true},
  {id: 'investigate', group: 'mech', label: 'Enquêter (jetons Indice)', n: true},
  {id: 'amass', group: 'mech', label: 'Amasser des Orques', n: true},
  {id: 'ringTempts', group: 'mech', label: 'L\'Anneau vous tente'},
  {id: 'monarch', group: 'mech', label: 'Devenir le monarque'},
  {id: 'initiative', group: 'mech', label: 'Prendre l\'initiative (donjon)'},
  {id: 'venture', group: 'mech', label: 'S\'aventurer dans le donjon'},
  {id: 'modal', group: 'modal', label: 'Choisissez l\'un — (2 ou 3 modes au choix)', modal: true},
  {id: 'grantKeyword', group: 'static', label: 'Les créatures choisies ont un mot-clé (« les autres Elfes que vous contrôlez ont la vigilance »)', filter: true, keyword: true, only: ['static']},
  {id: 'anthem', group: 'static', label: 'Les créatures choisies gagnent +N/+N (« les autres Elfes que vous contrôlez gagnent +1/+1 »)', n: true, filter: true, only: ['static']},
];

/** Groupes des effets dans le formulaire. */
export const EFFECT_GROUPS = [
  ['life', 'Blessures et points de vie'], ['cards', 'Cartes (pioche, bibliothèque, cimetière)'], ['creatures', 'Créatures et marqueurs'],
  ['removal', 'Détruire, exiler, contrer'], ['control', 'Engager, contrôler'], ['mana', 'Mana et terrains'],
  ['mech', 'Mécaniques (explorer, l\'Anneau, monarque…)'], ['modal', 'Au choix'], ['static', 'Effets permanents'],
];

/** Effets possibles pour un mode de « Choisissez l'un — » (pas un autre choix de modes). */
export function modeEffectsFor(when) {
  return effectsFor(when).filter(e => !e.modal);
}

/** Un mode tout neuf (son effet et ses réglages, comme une capacité). */
export function newMode(effect = 'draw') {
  return {effect, n: 1, filter: {type: '', other: false}, token: TOKENS[0][0], keyword: 'Flying', mana: 'Any'};
}

/** Couleurs de mana d'« Ajouter du mana ». */
export const MANA_CHOICES = [['Any', 'Une couleur au choix'], ['W', 'Blanc'], ['U', 'Bleu'], ['B', 'Noir'], ['R', 'Rouge'], ['G', 'Vert'], ['C', 'Incolore']];

/**
 * Capacités toutes prêtes : une phrase complète, puis la capacité du formulaire qu'elle donne (le type et le mot-clé
 * restent à changer). type : le type de la carte proposé par défaut (« Elfe »...), ou "" pour toutes les créatures.
 */
export function templates(type) {
  const t = type || '';
  const others = t ? `les autres ${t}` : 'les autres créatures';
  const base = {n: 1, filter: {type: t, other: true}, token: 'w_1_1_spirit_flying', keyword: 'Vigilance', cost: '{2}', tap: true, sac: false, loyalty: 1};
  return [
    {label: `${capitalize(others)} que vous contrôlez ont la vigilance`, a: {...base, when: 'static', effect: 'grantKeyword'}},
    {label: `${capitalize(others)} que vous contrôlez gagnent +1/+1`, a: {...base, when: 'static', effect: 'anthem'}},
    {label: `Quand ${t ? 'un autre ' + t : 'une autre créature'} arrive sous votre contrôle, un marqueur +1/+1 sur chaque ${t ? 'autre ' + t : 'autre créature'} que vous contrôlez`,
      a: {...base, when: 'ally', effect: 'countersEach'}},
    {label: `Quand elle attaque, ${others} que vous contrôlez gagnent la vigilance jusqu'à la fin du tour`, a: {...base, when: 'attacks', effect: 'grantKeywordTurn'}},
    {label: `Quand elle attaque, ${others} que vous contrôlez gagnent +1/+1 jusqu'à la fin du tour`, a: {...base, when: 'attacks', effect: 'pumpAll'}},
    {label: 'Quand elle arrive sur le champ de bataille, piochez une carte', a: {...base, when: 'etb', effect: 'draw', filter: {type: '', other: false}}},
    {label: 'Quand elle arrive, elle inflige 2 blessures à n\'importe quelle cible', a: {...base, n: 2, when: 'etb', effect: 'damageAny', filter: {type: '', other: false}}},
    {label: 'Quand elle arrive, détruisez une créature ciblée', a: {...base, when: 'etb', effect: 'destroy', filter: {type: '', other: false}}},
    {label: 'Quand elle meurt, créez un jeton Esprit 1/1 volant', a: {...base, when: 'dies', effect: 'token', filter: {type: '', other: false}}},
    {label: 'Au début de votre entretien, vous gagnez 1 point de vie', a: {...base, when: 'upkeep', effect: 'gainLife', filter: {type: '', other: false}}},
    {label: '{2}, {T} : piochez une carte', a: {...base, when: 'activated', effect: 'draw', filter: {type: '', other: false}}},
    {label: '{G} : régénérez-la', a: {...base, when: 'activated', effect: 'regenerate', cost: '{G}', tap: false, filter: {type: '', other: false}}},
    {label: '{T} : ajoutez un mana de la couleur de votre choix', a: {...base, when: 'activated', effect: 'addMana', mana: 'Any', cost: '', filter: {type: '', other: false}}},
    {label: 'Quand elle arrive, elle explore', a: {...base, when: 'etb', effect: 'explore', filter: {type: '', other: false}}},
    {label: 'Chaque fois qu\'elle inflige des blessures de combat à un joueur, piochez une carte', a: {...base, when: 'combatDamage', effect: 'draw', filter: {type: '', other: false}}},
    {label: `Chaque fois ${t ? 'qu\'un autre ' + t : 'qu\'une autre créature'} que vous contrôlez meurt, chaque adversaire perd 1 point de vie et vous gagnez 1 point de vie`,
      a: {...base, when: 'allyDies', effect: 'drain'}},
    {label: 'Chaque fois que vous lancez un sort non-créature, elle gagne +1/+1 jusqu\'à la fin du tour', a: {...base, when: 'castNonCreature', effect: 'pumpSelf', filter: {type: '', other: false}}},
    {label: 'Chaque fois qu\'un terrain arrive sous votre contrôle, vous gagnez 1 point de vie', a: {...base, when: 'landfall', effect: 'gainLife', filter: {type: '', other: false}}},
    {label: 'Quand elle arrive, l\'Anneau vous tente', a: {...base, when: 'etb', effect: 'ringTempts', filter: {type: '', other: false}}},
    {label: 'Quand elle arrive, amassez des Orques 2', a: {...base, n: 2, when: 'etb', effect: 'amass', filter: {type: '', other: false}}},
    {label: 'Quand elle arrive, vous devenez le monarque', a: {...base, when: 'etb', effect: 'monarch', filter: {type: '', other: false}}},
    {label: 'Au début du combat de votre tour, un marqueur +1/+1 sur une créature ciblée', a: {...base, when: 'beginCombat', effect: 'countersTarget', filter: {type: '', other: false}}},
  ];
}

/** Effets proposés pour un « quand » donné. */
export function effectsFor(when) {
  return EFFECTS.filter(e => (e.only ? e.only.includes(when) : when !== 'static') && !(e.self && when === 'spell'));
}

const KW_FR = Object.fromEntries(KW_ALL.map(k => [k[0], k[1]]));
/** « Les Elfes que vous contrôlez ont le vol » : le mot-clé avec son article. */
const KW_GRANT = {...Object.fromEntries(KW_ALL.filter(k => k[5]).map(k => [k[0], k[5]])), 'Flash': 'ont le flash'};

/** Langues du texte d'une carte perso. */
export const LANGS = [['fr', 'Français'], ['en', 'English']];

/** Nom d'un mot-clé dans la langue de la carte (l'anglais est le nom de Forge, en minuscules après le premier). */
export function keywordName(k, lang) {
  const def = KW_BY[k];
  if (lang === 'en') {
    return def ? def[2] : k.charAt(0) + k.slice(1).toLowerCase();
  }
  return KW_FR[k] || k;
}

/** Le mot-clé dans le texte de la carte, avec sa valeur (« Annihilateur 2 », « Recyclage {1}{U} », « Parade {2} »). */
function keywordText(f, k, lang) {
  const def = KW_BY[k];
  const v = keywordValue(f, k);
  const name = keywordName(k, lang);
  if (!def || !def[4]) {
    return name;
  }
  if (def[4] === 'cost') {
    return `${name} ${costSymbols(forgeCost(v)) || '{0}'}`;
  }
  return def[4] === 'gen' ? `${name} {${v}}` : `${name} ${v}`;
}

/** La ligne « K: » de Forge d'un mot-clé (« K:Annihilator:2 », « K:Cycling:1 U »). */
function keywordLine(f, k) {
  const def = KW_BY[k];
  if (!def || !def[4]) {
    return `K:${k}`;
  }
  const v = keywordValue(f, k);
  return `K:${k}:${def[4] === 'cost' ? forgeCost(v) || '0' : v}`;
}

/** Le mot-clé en minuscules pour « gagnent … » en anglais (first strike, forestwalk). */
function keywordLower(k) {
  return keywordName(k, 'en').toLowerCase();
}

const EN_NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const FR_NUM = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'];
/** « two cards », « deux cartes » : les petits nombres en toutes lettres, comme sur les cartes. */
function word(n, lang) {
  return (lang === 'en' ? EN_NUM : FR_NUM)[n] || String(n);
}

/** Coût de mana du formulaire (« 2WU », « {2}{W/U} », « 2 W U ») au format de Forge (« 2 W U », « 1 GW », « 3 GP »). */
export function forgeCost(text) {
  const t = String(text || '').trim().toUpperCase();
  if (!t) {
    return '';
  }
  // « {2}{W} », « 2W », ou un mélange des deux (« 3{G/U} »).
  const parts = [...t.matchAll(/\{([^}]+)\}|\d+|[WUBRGCXSP]\/[WUBRGP]|[WUBRGCXS]/g)].map(m => m[1] || m[0]);
  const out = [];
  let generic = 0;
  for (const p of parts) {
    if (/^\d+$/.test(p)) {
      generic += Number(p);
    } else {
      out.push(p.replace('/', ''));
    }
  }
  // Dans l'ordre des cartes : X, puis le générique, puis les symboles de couleur.
  return [...out.filter(p => p === 'X'), generic ? String(generic) : '', ...out.filter(p => p !== 'X')].filter(Boolean).join(' ');
}

/** Couleurs d'un coût de Forge (« 2 W U » → « WU »). */
export function costColors(cost) {
  return [...'WUBRG'].filter(c => String(cost || '').includes(c)).join('');
}

/** Coût au format des symboles affichés (« 2 W U » → « {2}{W}{U} »). */
export function costSymbols(cost) {
  return String(cost || '').split(/\s+/).filter(Boolean).map(p => `{${/^[WUBRG2][WUBRGP]$/.test(p) ? p[0] + '/' + p[1] : p}}`).join('');
}

/** Symboles d'un coût saisi, un par élément (« 2WU » ou « {2}{W}{U} » → [« 2 », « W », « U »], « {W/U} » → [« W/U »]). */
export function costParts(text) {
  return [...costSymbols(forgeCost(text)).matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
}

function plural(n, one, many) {
  return n === 1 ? one : many;
}

/** « Creature.Elf+YouCtrl+Other » pour Forge. */
function valid(f) {
  const props = ['YouCtrl'];
  if (f && f.other) {
    props.push('Other');
  }
  return f && f.type ? `Creature.${f.type}+${props.join('+')}` : `Creature.${props.join('+')}`;
}

// Créatures filtrées, dans les deux langues : « un autre Elfe » / « another Elf ».
function oneFr(f) {
  if (f && f.type) {
    return f.other ? `un autre ${f.type}` : `un ${f.type}`;
  }
  return f && f.other ? 'une autre créature' : 'une créature';
}

function eachFr(f) {
  if (f && f.type) {
    return f.other ? `autre ${f.type}` : f.type;
  }
  return f && f.other ? 'autre créature' : 'créature';
}

function allFr(f) {
  if (f && f.type) {
    return f.other ? `les autres ${f.type}` : `les ${f.type}`;
  }
  return f && f.other ? 'les autres créatures' : 'les créatures';
}

/** « que une » → « qu'une » : « Chaque fois qu'une autre créature… ». */
function que(words) {
  return /^[aeiouhéè]/i.test(words) ? `qu'${words}` : `que ${words}`;
}

function article(word) {
  return /^[aeiouAEIOU]/.test(word) ? 'an' : 'a';
}

function oneEn(f) {
  const t = f && f.type ? f.type : 'creature';
  return f && f.other ? `another ${t}` : `${article(t)} ${t}`;
}

function eachEn(f) {
  const t = f && f.type ? f.type : 'creature';
  return f && f.other ? `other ${t}` : t;
}

function allEn(f) {
  const t = f && f.type ? `${f.type} creatures` : 'creatures';
  return f && f.other ? `other ${t}` : t;
}

/** Paramètres de Forge et texte (français et anglais) d'un effet. id : préfixe des SVar de cette capacité. */
function effect(a, id) {
  const n = Math.max(0, Math.round(Number(a.n) || 0));
  const n1 = Math.max(1, n);
  const target = (what) => `ValidTgts$ ${what.v} | TgtPrompt$ ${what.prompt}`;
  const creature = {v: 'Creature', prompt: 'Choisissez une créature ciblée'};
  const countersFr = (k) => k === 1 ? 'un marqueur +1/+1' : `${word(k, 'fr')} marqueurs +1/+1`;
  const countersEn = (k) => k === 1 ? 'a +1/+1 counter' : `${word(k, 'en')} +1/+1 counters`;
  switch (a.effect) {
    case 'damageAny':
      return {p: `DealDamage | ValidTgts$ Any | NumDmg$ ${n}`, fr: `CARDNAME inflige ${n} ${plural(n, 'blessure', 'blessures')} à n'importe quelle cible`,
        en: `CARDNAME deals ${n} damage to any target`};
    case 'damageCreature':
      return {p: `DealDamage | ${target(creature)} | NumDmg$ ${n}`, fr: `CARDNAME inflige ${n} ${plural(n, 'blessure', 'blessures')} à une créature ciblée`,
        en: `CARDNAME deals ${n} damage to target creature`};
    case 'damageOpponents':
      return {p: `DealDamage | Defined$ Player.Opponent | NumDmg$ ${n}`, fr: `CARDNAME inflige ${n} ${plural(n, 'blessure', 'blessures')} à chaque adversaire`,
        en: `CARDNAME deals ${n} damage to each opponent`};
    case 'draw':
      return {p: `Draw | Defined$ You | NumCards$ ${n}`, fr: n === 1 ? 'piochez une carte' : `piochez ${word(n, 'fr')} cartes`,
        en: n === 1 ? 'draw a card' : `draw ${word(n, 'en')} cards`};
    case 'gainLife':
      return {p: `GainLife | Defined$ You | LifeAmount$ ${n}`, fr: `vous gagnez ${n} ${plural(n, 'point', 'points')} de vie`, en: `you gain ${n} life`};
    case 'drain':
      return {
        p: `LoseLife | Defined$ Player.Opponent | LifeAmount$ ${n} | SubAbility$ ${id}Gain`,
        extra: [`SVar:${id}Gain:DB$ GainLife | Defined$ You | LifeAmount$ ${n}`],
        fr: `chaque adversaire perd ${n} ${plural(n, 'point', 'points')} de vie et vous gagnez ${n} ${plural(n, 'point', 'points')} de vie`,
        en: `each opponent loses ${n} life and you gain ${n} life`,
      };
    case 'countersSelf':
      return {p: `PutCounter | Defined$ Self | CounterType$ P1P1 | CounterNum$ ${n}`, fr: `mettez ${countersFr(n)} sur CARDNAME`, en: `put ${countersEn(n)} on CARDNAME`};
    case 'countersEach':
      return {p: `PutCounterAll | ValidCards$ ${valid(a.filter)} | CounterType$ P1P1 | CounterNum$ ${n}`,
        fr: `mettez ${countersFr(n)} sur chaque ${eachFr(a.filter)} que vous contrôlez`, en: `put ${countersEn(n)} on each ${eachEn(a.filter)} you control`};
    case 'countersTarget':
      return {p: `PutCounter | ${target(creature)} | CounterType$ P1P1 | CounterNum$ ${n}`, fr: `mettez ${countersFr(n)} sur une créature ciblée`,
        en: `put ${countersEn(n)} on target creature`};
    case 'pumpAll':
      return {p: `PumpAll | ValidCards$ ${valid(a.filter)} | NumAtt$ +${n} | NumDef$ +${n}`, fr: `${allFr(a.filter)} que vous contrôlez gagnent +${n}/+${n} jusqu'à la fin du tour`,
        en: `${allEn(a.filter)} you control get +${n}/+${n} until end of turn`};
    case 'grantKeywordTurn': {
      const kw = a.keyword || 'Flying';
      const has = KW_GRANT[kw] || 'ont ' + (KW_FR[kw] || kw).toLowerCase();
      const gain = has.startsWith('sont ') ? 'deviennent ' + has.slice(5) : 'gagnent ' + has.slice(4);
      return {p: `PumpAll | ValidCards$ ${valid(a.filter)} | KW$ ${kw}`, fr: `${allFr(a.filter)} que vous contrôlez ${gain} jusqu'à la fin du tour`,
        en: `${allEn(a.filter)} you control gain ${keywordLower(kw)} until end of turn`};
    }
    case 'pumpTarget':
      return {p: `Pump | ${target(creature)} | NumAtt$ +${n} | NumDef$ +${n}`, fr: `une créature ciblée gagne +${n}/+${n} jusqu'à la fin du tour`,
        en: `target creature gets +${n}/+${n} until end of turn`};
    case 'token': {
      const t = allTokens().find(x => x[0] === a.token) || TOKENS[0];
      const en = `${n1 === 1 ? article(t[3]) : word(n1, 'en')} ${t[3]} ${plural(n1, 'token', 'tokens')}${t[4] ? ' with ' + t[4] : ''}`;
      return {p: `Token | TokenAmount$ ${n1} | TokenScript$ ${t[0]} | TokenOwner$ You`,
        fr: `créez ${n1 === 1 ? 'un jeton' : word(n1, 'fr') + ' jetons'} ${t[2]}`, en: `create ${en}`};
    }
    case 'destroy':
      return {p: `Destroy | ${target(creature)}`, fr: 'détruisez une créature ciblée', en: 'destroy target creature'};
    case 'destroyPermanent':
      return {p: `Destroy | ${target({v: 'Permanent.nonLand', prompt: 'Choisissez un permanent non-terrain ciblé'})}`, fr: 'détruisez un permanent non-terrain ciblé',
        en: 'destroy target nonland permanent'};
    case 'exile':
      return {p: `ChangeZone | ${target(creature)} | Origin$ Battlefield | Destination$ Exile`, fr: 'exilez une créature ciblée', en: 'exile target creature'};
    case 'bounce':
      return {p: `ChangeZone | ${target(creature)} | Origin$ Battlefield | Destination$ Hand`, fr: 'renvoyez une créature ciblée dans la main de son propriétaire',
        en: 'return target creature to its owner\'s hand'};
    case 'tap':
      return {p: `Tap | ${target(creature)}`, fr: 'engagez une créature ciblée', en: 'tap target creature'};
    case 'counterSpell':
      return {p: 'Counter | TargetType$ Spell | ValidTgts$ Card | TgtPrompt$ Choisissez un sort ciblé', fr: 'contrecarrez un sort ciblé', en: 'counter target spell'};
    case 'scry':
      return {p: `Scry | ScryNum$ ${n1}`, fr: `regard ${n1}`, en: `scry ${n1}`};
    case 'discard':
      return {p: `Discard | Defined$ Player.Opponent | NumCards$ ${n1} | Mode$ TgtChoose`,
        fr: `chaque adversaire défausse ${n1 === 1 ? 'une carte' : word(n1, 'fr') + ' cartes'}`,
        en: `each opponent discards ${n1 === 1 ? 'a card' : word(n1, 'en') + ' cards'}`};
    case 'loot':
      return {p: `Draw | Defined$ You | NumCards$ ${n1} | SubAbility$ ${id}Loot`,
        extra: [`SVar:${id}Loot:DB$ Discard | Defined$ You | NumCards$ ${n1} | Mode$ TgtChoose`],
        fr: n1 === 1 ? 'piochez une carte, puis défaussez-vous d\'une carte' : `piochez ${word(n1, 'fr')} cartes, puis défaussez-vous de ${word(n1, 'fr')} cartes`,
        en: n1 === 1 ? 'draw a card, then discard a card' : `draw ${word(n1, 'en')} cards, then discard ${word(n1, 'en')} cards`};
    case 'surveil':
      return {p: `Surveil | Amount$ ${n1}`, fr: `surveillez ${n1}`, en: `surveil ${n1}`};
    case 'mill':
      return {p: `Mill | Defined$ You | NumCards$ ${n1}`, fr: `meulez ${n1 === 1 ? 'une carte' : word(n1, 'fr') + ' cartes'}`,
        en: `mill ${n1 === 1 ? 'a card' : word(n1, 'en') + ' cards'}`};
    case 'millOpponents':
      return {p: `Mill | Defined$ Player.Opponent | NumCards$ ${n1}`, fr: `chaque adversaire meule ${n1 === 1 ? 'une carte' : word(n1, 'fr') + ' cartes'}`,
        en: `each opponent mills ${n1 === 1 ? 'a card' : word(n1, 'en') + ' cards'}`};
    case 'tutor':
      return {p: 'ChangeZone | Origin$ Library | Destination$ Hand | ChangeType$ Card | ChangeNum$ 1',
        fr: 'cherchez une carte dans votre bibliothèque, mettez-la dans votre main, puis mélangez',
        en: 'search your library for a card, put it into your hand, then shuffle'};
    case 'regrowth':
      return {p: `ChangeZone | Origin$ Graveyard | Destination$ Hand | ${target({v: 'Creature.YouOwn', prompt: 'Choisissez une carte de créature dans votre cimetière'})}`,
        fr: 'renvoyez une carte de créature ciblée depuis votre cimetière dans votre main', en: 'return target creature card from your graveyard to your hand'};
    case 'reanimate':
      return {p: `ChangeZone | Origin$ Graveyard | Destination$ Battlefield | ${target({v: 'Creature.YouOwn', prompt: 'Choisissez une carte de créature dans votre cimetière'})}`,
        fr: 'renvoyez une carte de créature ciblée depuis votre cimetière sur le champ de bataille',
        en: 'return target creature card from your graveyard to the battlefield'};
    case 'proliferate':
      return {p: 'Proliferate', fr: 'proliférez', en: 'proliferate'};
    case 'pumpSelf':
      return {p: `Pump | Defined$ Self | NumAtt$ +${n} | NumDef$ +${n}`, fr: `CARDNAME gagne +${n}/+${n} jusqu'à la fin du tour`,
        en: `CARDNAME gets +${n}/+${n} until end of turn`};
    case 'regenerate':
      return {p: 'Regenerate | Defined$ Self', fr: 'régénérez CARDNAME', en: 'regenerate CARDNAME'};
    case 'cloneToken':
      return {p: `CopyPermanent | ${target(creature)}`, fr: 'créez un jeton qui est une copie d\'une créature ciblée',
        en: 'create a token that\'s a copy of target creature'};
    case 'destroyArtEnch':
      return {p: `Destroy | ${target({v: 'Artifact,Enchantment', prompt: 'Choisissez un artefact ou un enchantement ciblé'})}`,
        fr: 'détruisez un artefact ou un enchantement ciblé', en: 'destroy target artifact or enchantment'};
    case 'wrath':
      return {p: 'DestroyAll | ValidCards$ Creature', fr: 'détruisez toutes les créatures', en: 'destroy all creatures'};
    case 'edict':
      return {p: 'Sacrifice | Defined$ Player.Opponent | SacValid$ Creature', fr: 'chaque adversaire sacrifie une créature',
        en: 'each opponent sacrifices a creature'};
    case 'fight':
      return {p: `Fight | Defined$ Self | ${target({v: 'Creature.OppCtrl', prompt: 'Choisissez une créature ciblée qu\'un adversaire contrôle'})}`,
        fr: 'CARDNAME se bat contre une créature ciblée qu\'un adversaire contrôle', en: 'CARDNAME fights target creature an opponent controls'};
    case 'untap':
      return {p: `Untap | ${target({v: 'Permanent', prompt: 'Choisissez un permanent ciblé'})}`, fr: 'dégagez un permanent ciblé', en: 'untap target permanent'};
    case 'threaten':
      return {p: `GainControl | ${target(creature)} | LoseControl$ EOT | Untap$ True | AddKWs$ Haste`,
        fr: 'acquérez le contrôle d\'une créature ciblée jusqu\'à la fin du tour. Dégagez cette créature. Elle acquiert la célérité jusqu\'à la fin du tour',
        en: 'gain control of target creature until end of turn. Untap that creature. It gains haste until end of turn'};
    case 'goad':
      return {p: `Goad | ${target(creature)}`, fr: 'incitez une créature ciblée', en: 'goad target creature'};
    case 'addMana': {
      const c = MANA_CHOICES.some(m => m[0] === a.mana) ? a.mana : 'Any';
      if (c === 'Any') {
        return {p: `Mana | Produced$ Any | Amount$ ${n1}`,
          fr: n1 === 1 ? 'ajoutez un mana de la couleur de votre choix' : `ajoutez ${word(n1, 'fr')} manas d'une même couleur de votre choix`,
          en: n1 === 1 ? 'add one mana of any color' : `add ${word(n1, 'en')} mana of any one color`};
      }
      const sym = `{${c}}`.repeat(Math.min(n1, 10));
      return {p: `Mana | Produced$ ${c} | Amount$ ${n1}`, fr: `ajoutez ${sym}`, en: `add ${sym}`};
    }
    case 'rampLand':
      return {p: 'ChangeZone | Origin$ Library | Destination$ Battlefield | ChangeType$ Land.Basic | ChangeNum$ 1 | Tapped$ True',
        fr: 'cherchez dans votre bibliothèque une carte de terrain de base, mettez-la sur le champ de bataille engagée, puis mélangez',
        en: 'search your library for a basic land card, put it onto the battlefield tapped, then shuffle'};
    case 'explore':
      return {p: 'Explore', fr: 'CARDNAME explore', en: 'CARDNAME explores'};
    case 'connive':
      return {p: 'Connive | Defined$ Self', fr: 'CARDNAME complote', en: 'CARDNAME connives'};
    case 'investigate':
      return {p: `Investigate | Num$ ${n1}`, fr: n1 === 1 ? 'enquêtez' : `enquêtez ${n1 === 2 ? 'deux fois' : word(n1, 'fr') + ' fois'}`,
        en: n1 === 1 ? 'investigate' : `investigate ${n1 === 2 ? 'twice' : word(n1, 'en') + ' times'}`};
    case 'amass':
      return {p: `Amass | Type$ Orc | Num$ ${n1}`, fr: `amassez des Orques ${n1}`, en: `amass Orcs ${n1}`};
    case 'ringTempts':
      return {p: 'RingTemptsYou', fr: 'l\'Anneau vous tente', en: 'the Ring tempts you'};
    case 'monarch':
      return {p: 'BecomeMonarch | Defined$ You', fr: 'vous devenez le monarque', en: 'you become the monarch'};
    case 'initiative':
      return {p: 'TakeInitiative | Defined$ You', fr: 'vous prenez l\'initiative', en: 'you take the initiative'};
    case 'venture':
      return {p: 'Venture', fr: 'aventurez-vous dans le donjon', en: 'venture into the dungeon'};
    default:
      return null;
  }
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Coût d'une capacité activée : mana, {T}, sacrifier. Renvoie le coût pour Forge et son texte. */
function activationCost(a, lang) {
  const forge = [];
  const text = [];
  const mana = forgeCost(a.cost);
  if (mana) {
    forge.push(mana);
    text.push(costSymbols(mana));
  }
  if (a.tap) {
    forge.push('T');
    text.push('{T}');
  }
  if (a.sac) {
    forge.push('Sac<1/CARDNAME>');
    text.push(lang === 'en' ? (text.length ? 'sacrifice CARDNAME' : 'Sacrifice CARDNAME') : 'sacrifiez CARDNAME');
  }
  return {forge: forge.join(' ') || '0', text: text.join(', ') || '{0}'};
}

/** Lignes du script et texte (dans la langue de la carte) d'une capacité. i : son numéro (noms des SVar). */
export function abilityLines(a, i, lang = 'fr') {
  const en = lang === 'en';
  const id = `Atelier${i + 1}`;
  const w = WHEN.find(x => x.id === a.when);
  if (!w) {
    return null;
  }
  if (a.when === 'static') {
    const n = Math.max(0, Math.round(Number(a.n) || 0));
    if (a.effect === 'grantKeyword') {
      const kw = a.keyword || 'Flying';
      const text = en ? `${capitalize(allEn(a.filter))} you control have ${keywordLower(kw)}.`
        : `${capitalize(allFr(a.filter))} que vous contrôlez ${KW_GRANT[kw] || 'ont ' + (KW_FR[kw] || kw).toLowerCase()}.`;
      return {lines: [`S:Mode$ Continuous | Affected$ ${valid(a.filter)} | AddKeyword$ ${kw} | Description$ ${text}`], text};
    }
    const text = en ? `${capitalize(allEn(a.filter))} you control get +${n}/+${n}.` : `${capitalize(allFr(a.filter))} que vous contrôlez gagnent +${n}/+${n}.`;
    return {lines: [`S:Mode$ Continuous | Affected$ ${valid(a.filter)} | AddPower$ ${n} | AddToughness$ ${n} | Description$ ${text}`], text};
  }
  if (a.effect === 'modal') {
    return modalLines(a, id, w, lang);
  }
  const e = effect(a, id);
  if (!e) {
    return null;
  }
  const body = en ? e.en : e.fr;
  const extra = e.extra || [];
  if (w.kind === 'SP') {
    const text = capitalize(body) + '.';
    return {lines: [`A:SP$ ${e.p} | SpellDescription$ ${text}`, ...extra], text};
  }
  if (w.kind === 'A') {
    if (a.when === 'loyalty') {
      const k = Math.round(Number(a.loyalty) || 0);
      const cost = k >= 0 ? `AddCounter<${k}/LOYALTY>` : `SubCounter<${-k}/LOYALTY>`;
      const text = en ? `${k > 0 ? '+' : k < 0 ? '−' : ''}${Math.abs(k)}: ${capitalize(body)}.` : `[${k > 0 ? '+' : ''}${k}] : ${capitalize(body)}.`;
      return {lines: [`A:AB$ ${e.p} | Cost$ ${cost} | Planeswalker$ True | SpellDescription$ ${text}`, ...extra], text};
    }
    const c = activationCost(a, lang);
    const text = en ? `${c.text}: ${capitalize(body)}.` : `${c.text} : ${capitalize(body)}.`;
    return {lines: [`A:AB$ ${e.p} | Cost$ ${c.forge} | SpellDescription$ ${text}`, ...extra], text};
  }
  const head = triggerHead(a);
  const text = `${head[en ? 2 : 1]}, ${body}.`;
  return {lines: [`T:${head[0]} | Execute$ ${id} | TriggerDescription$ ${text}`, `SVar:${id}:DB$ ${e.p}`, ...extra], text};
}

/** Déclencheur d'une capacité : [condition pour Forge, début de phrase en français, en anglais]. */
function triggerHead(a) {
  return {
    etb: ['Mode$ ChangesZone | Origin$ Any | Destination$ Battlefield | ValidCard$ Card.Self', 'Quand CARDNAME arrive sur le champ de bataille', 'When CARDNAME enters'],
    ally: [`Mode$ ChangesZone | Origin$ Any | Destination$ Battlefield | ValidCard$ ${valid(a.filter)} | TriggerZones$ Battlefield`,
      `Quand ${oneFr(a.filter)} arrive sur le champ de bataille sous votre contrôle`, `Whenever ${oneEn(a.filter)} you control enters`],
    attacks: ['Mode$ Attacks | ValidCard$ Card.Self', 'Quand CARDNAME attaque', 'Whenever CARDNAME attacks'],
    blocks: ['Mode$ Blocks | ValidCard$ Card.Self', 'Chaque fois que CARDNAME bloque', 'Whenever CARDNAME blocks'],
    combatDamage: ['Mode$ DamageDone | ValidSource$ Card.Self | ValidTarget$ Player | CombatDamage$ True',
      'Chaque fois que CARDNAME inflige des blessures de combat à un joueur', 'Whenever CARDNAME deals combat damage to a player'],
    dies: ['Mode$ ChangesZone | Origin$ Battlefield | Destination$ Graveyard | ValidCard$ Card.Self', 'Quand CARDNAME meurt', 'When CARDNAME dies'],
    allyDies: [`Mode$ ChangesZone | Origin$ Battlefield | Destination$ Graveyard | ValidCard$ ${valid(a.filter)} | TriggerZones$ Battlefield`,
      `Chaque fois ${que(oneFr(a.filter))} que vous contrôlez meurt`, `Whenever ${oneEn(a.filter)} you control dies`],
    landfall: ['Mode$ ChangesZone | Origin$ Any | Destination$ Battlefield | ValidCard$ Land.YouCtrl | TriggerZones$ Battlefield',
      'Chaque fois qu\'un terrain arrive sur le champ de bataille sous votre contrôle', 'Whenever a land you control enters'],
    castNonCreature: ['Mode$ SpellCast | ValidCard$ Card.nonCreature | ValidActivatingPlayer$ You | TriggerZones$ Battlefield',
      'Chaque fois que vous lancez un sort non-créature', 'Whenever you cast a noncreature spell'],
    castCreature: ['Mode$ SpellCast | ValidCard$ Creature | ValidActivatingPlayer$ You | TriggerZones$ Battlefield',
      'Chaque fois que vous lancez un sort de créature', 'Whenever you cast a creature spell'],
    lifeGain: ['Mode$ LifeGained | ValidPlayer$ You | TriggerZones$ Battlefield', 'Chaque fois que vous gagnez des points de vie', 'Whenever you gain life'],
    beginCombat: ['Mode$ Phase | Phase$ BeginCombat | ValidPlayer$ You | TriggerZones$ Battlefield', 'Au début du combat de votre tour',
      'At the beginning of combat on your turn'],
    upkeep: ['Mode$ Phase | Phase$ Upkeep | ValidPlayer$ You | TriggerZones$ Battlefield', 'Au début de votre entretien', 'At the beginning of your upkeep'],
    end: ['Mode$ Phase | Phase$ End of Turn | ValidPlayer$ You | TriggerZones$ Battlefield', 'Au début de votre étape de fin', 'At the beginning of your end step'],
  }[a.when];
}

/**
 * « Choisissez l'un — » : chaque mode est une capacité (une SVar) avec sa description dans la langue de la carte ; Forge
 * propose les modes au moment de jouer. Le texte suit la carte : « …, choisissez l'un —\n• A.\n• B. ».
 */
function modalLines(a, id, w, lang) {
  const en = lang === 'en';
  const parts = [];
  (a.modes || []).slice(0, 3).forEach((m, k) => {
    const mid = `${id}M${k + 1}`;
    const e = effect({...newMode(), ...m}, mid);
    if (e) {
      parts.push({mid, e, text: capitalize(en ? e.en : e.fr) + '.'});
    }
  });
  if (parts.length < 2) {
    return null;
  }
  const modes = parts.flatMap(p => [`SVar:${p.mid}:DB$ ${p.e.p} | SpellDescription$ ${p.text}`, ...(p.e.extra || [])]);
  const charm = `Charm | Choices$ ${parts.map(p => p.mid).join(',')}`;
  const choose = en ? 'choose one —' : 'choisissez l\'un —';
  const bullets = parts.map(p => `\\n• ${p.text}`).join('');
  if (w.kind === 'SP') {
    return {lines: [`A:SP$ ${charm}`, ...modes], text: capitalize(choose) + bullets};
  }
  if (w.kind === 'A') {
    if (a.when === 'loyalty') {
      const k = Math.round(Number(a.loyalty) || 0);
      const cost = k >= 0 ? `AddCounter<${k}/LOYALTY>` : `SubCounter<${-k}/LOYALTY>`;
      const head = en ? `${k > 0 ? '+' : k < 0 ? '−' : ''}${Math.abs(k)}:` : `[${k > 0 ? '+' : ''}${k}] :`;
      return {lines: [`A:AB$ ${charm} | Cost$ ${cost} | Planeswalker$ True`, ...modes], text: `${head} ${capitalize(choose)}${bullets}`};
    }
    const c = activationCost(a, lang);
    return {lines: [`A:AB$ ${charm} | Cost$ ${c.forge}`, ...modes], text: `${c.text}${en ? ':' : ' :'} ${capitalize(choose)}${bullets}`};
  }
  const head = triggerHead(a);
  return {lines: [`T:${head[0]} | Execute$ ${id} | TriggerDescription$ ${head[en ? 2 : 1]}, ABILITY`, `SVar:${id}:DB$ ${charm}`, ...modes],
    text: `${head[en ? 2 : 1]}, ${choose}${bullets}`};
}

/** Lignes d'affichage du script (cadre, sa couleur, langue du texte) : Forge les garde sans s'en servir. */
export function displayLines(d) {
  const out = [];
  if (d.frame && d.frame !== 'modern') {
    out.push(`SVar:AtelierFrame:${d.frame}`);
  }
  if (d.frameColor && d.frameColor !== 'auto') {
    out.push(`SVar:AtelierFrameColor:${d.frameColor}`);
  }
  if (d.lang === 'en') {
    out.push('SVar:AtelierLang:en');
  }
  if (d.frameText === 'light') {
    out.push('SVar:AtelierFrameText:light');
  }
  if (d.fx && d.fx !== 'none') {
    out.push(`SVar:AtelierFx:${d.fx}`);
  }
  return out;
}

/** Réglages d'affichage écrits dans un script (lignes « SVar:Atelier… »). */
export function readDisplay(script) {
  const get = (k) => (String(script || '').match(new RegExp(`^SVar:${k}:(\\S+)`, 'm')) || [])[1];
  return {frame: get('AtelierFrame') || 'modern', frameColor: get('AtelierFrameColor') || 'auto', lang: get('AtelierLang') === 'en' ? 'en' : 'fr',
    frameText: get('AtelierFrameText') === 'light' ? 'light' : 'dark', fx: get('AtelierFx') || 'none'};
}

/** Le script avec d'autres réglages d'affichage (pour le mode script). */
export function withDisplay(script, d) {
  const kept = String(script || '').split('\n').filter(l => !/^SVar:Atelier(Frame|FrameColor|FrameText|Lang|Fx):/.test(l));
  while (kept.length && !kept[kept.length - 1].trim()) {
    kept.pop();
  }
  return [...kept, ...displayLines(d)].join('\n');
}

/** Le script complet d'une carte du formulaire. */
export function buildScript(f) {
  const lang = f.lang === 'en' ? 'en' : 'fr';
  const lines = [];
  const name = String(f.name || '').trim();
  lines.push(`Name:${name}`);
  // Un jeton n'a pas de coût : ses couleurs sont dites à part.
  const cost = f.token ? '' : forgeCost(f.cost);
  lines.push(`ManaCost:${cost || 'no cost'}`);
  if (f.token) {
    const colors = [...'WUBRG'].filter(c => (f.colors || []).includes(c)).map(c => COLOR_WORDS[c]);
    lines.push(`Colors:${colors.join(',') || 'colorless'}`);
  }
  const types = (f.types || []).filter(t => CARD_TYPES.some(c => c[0] === t));
  const sub = String(f.subtypes || '').trim().split(/\s+/).filter(Boolean);
  lines.push(`Types:${[f.legendary ? 'Legendary' : '', ...types, ...sub].filter(Boolean).join(' ')}`);
  if (types.includes('Creature')) {
    lines.push(`PT:${Number(f.power) || 0}/${Number(f.toughness) || 0}`);
  }
  if (types.includes('Planeswalker')) {
    lines.push(`Loyalty:${Math.max(1, Number(f.loyaltyStart) || 3)}`);
  }
  const text = [];
  const kws = (f.keywords || []).filter(k => KW_FR[k]);
  for (const k of kws) {
    lines.push(keywordLine(f, k));
  }
  // Les mots-clés simples sur une ligne (« Vol, piétinement »), ceux à nombre ou à coût chacun sur la sienne.
  const simple = kws.filter(k => !KW_BY[k][4]);
  if (simple.length) {
    text.push(simple.map((k, i) => i ? keywordName(k, lang).toLowerCase() : keywordName(k, lang)).join(', '));
  }
  for (const k of kws.filter(k => KW_BY[k][4])) {
    text.push(keywordText(f, k, lang));
  }
  (f.abilities || []).forEach((a, i) => {
    const r = abilityLines(a, i, lang);
    if (r) {
      lines.push(...r.lines);
      text.push(r.text.replace(/CARDNAME/g, name));
    }
  });
  if (text.length) {
    lines.push(`Oracle:${text.join('\\n')}`);
  }
  if (f.token) {
    lines.push('SVar:AtelierToken:True');
  }
  lines.push(...displayLines(f));
  return lines.join('\n');
}
