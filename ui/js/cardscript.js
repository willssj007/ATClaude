// Atelier : du formulaire au script de Forge. Chaque capacité du formulaire (un déclencheur ou un coût, un effet, un
// filtre de créatures, un nombre) devient une ligne T:/A:/S: et son SVar, avec son texte en français, sur le modèle des
// cartes de Forge (Flametongue Kavu, Elvish Visionary, Biomathematician...). Forge vérifie ensuite le script.

export const CARD_TYPES = [
  ['Creature', 'Créature'], ['Artifact', 'Artefact'], ['Enchantment', 'Enchantement'], ['Land', 'Terrain'],
  ['Planeswalker', 'Planeswalker'], ['Instant', 'Éphémère'], ['Sorcery', 'Rituel'],
];

export const KEYWORDS = [
  ['Flying', 'Vol'], ['First Strike', 'Initiative'], ['Double Strike', 'Double initiative'], ['Deathtouch', 'Contact mortel'],
  ['Haste', 'Célérité'], ['Hexproof', 'Défense talismanique'], ['Indestructible', 'Indestructible'], ['Lifelink', 'Lien de vie'],
  ['Menace', 'Menace'], ['Reach', 'Portée'], ['Trample', 'Piétinement'], ['Vigilance', 'Vigilance'], ['Defender', 'Défenseur'],
  ['Flash', 'Flash'], ['Shroud', 'Linceul'], ['Prowess', 'Prouesse'],
];

/** Quand la capacité agit. kind : T (déclenchée), A (activée), S (statique), SP (effet du sort). */
export const WHEN = [
  {id: 'etb', kind: 'T', label: 'Quand elle arrive sur le champ de bataille'},
  {id: 'ally', kind: 'T', label: 'Quand une de vos créatures arrive', filter: true},
  {id: 'attacks', kind: 'T', label: 'Quand elle attaque'},
  {id: 'dies', kind: 'T', label: 'Quand elle meurt'},
  {id: 'upkeep', kind: 'T', label: 'Au début de votre entretien'},
  {id: 'end', kind: 'T', label: 'Au début de votre étape de fin'},
  {id: 'activated', kind: 'A', label: 'Capacité activée (coût : effet)', cost: true},
  {id: 'loyalty', kind: 'A', label: 'Capacité de loyauté (planeswalker)', loyalty: true},
  {id: 'spell', kind: 'SP', label: 'Effet du sort (éphémère, rituel)'},
  {id: 'static', kind: 'S', label: 'Effet permanent : « les … que vous contrôlez ont / gagnent … »', filter: true},
];

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

/** Effets. filter : agit sur « chaque <créature filtrée> » ; n : demande un nombre ; only : n'existe que pour ces « quand ». */
export const EFFECTS = [
  {id: 'damageAny', label: 'Blessures à n\'importe quelle cible', n: true},
  {id: 'damageCreature', label: 'Blessures à une créature ciblée', n: true},
  {id: 'damageOpponents', label: 'Blessures à chaque adversaire', n: true},
  {id: 'draw', label: 'Piocher des cartes', n: true},
  {id: 'gainLife', label: 'Gagner des points de vie', n: true},
  {id: 'drain', label: 'Chaque adversaire perd des PV, vous les gagnez', n: true},
  {id: 'countersSelf', label: 'Marqueurs +1/+1 sur cette créature', n: true},
  {id: 'countersEach', label: 'Marqueurs +1/+1 sur chaque créature choisie (chaque Elfe, chaque autre…)', n: true, filter: true},
  {id: 'countersTarget', label: 'Marqueurs +1/+1 sur une créature ciblée', n: true},
  {id: 'pumpAll', label: 'Les créatures choisies gagnent +N/+N jusqu\'à la fin du tour', n: true, filter: true},
  {id: 'grantKeywordTurn', label: 'Les créatures choisies gagnent un mot-clé jusqu\'à la fin du tour', filter: true, keyword: true},
  {id: 'pumpTarget', label: '+N/+N à une créature ciblée jusqu\'à la fin du tour', n: true},
  {id: 'token', label: 'Créer des jetons', n: true, token: true},
  {id: 'destroy', label: 'Détruire une créature ciblée'},
  {id: 'destroyPermanent', label: 'Détruire un permanent non-terrain ciblé'},
  {id: 'exile', label: 'Exiler une créature ciblée'},
  {id: 'bounce', label: 'Renvoyer une créature ciblée dans la main'},
  {id: 'tap', label: 'Engager une créature ciblée'},
  {id: 'counterSpell', label: 'Contrecarrer un sort ciblé'},
  {id: 'scry', label: 'Regard', n: true},
  {id: 'discard', label: 'Chaque adversaire défausse des cartes', n: true},
  {id: 'grantKeyword', label: 'Les créatures choisies ont un mot-clé (« les autres Elfes que vous contrôlez ont la vigilance »)', filter: true, keyword: true, only: ['static']},
  {id: 'anthem', label: 'Les créatures choisies gagnent +N/+N (« les autres Elfes que vous contrôlez gagnent +1/+1 »)', n: true, filter: true, only: ['static']},
];

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
  ];
}

/** Effets proposés pour un « quand » donné. */
export function effectsFor(when) {
  return EFFECTS.filter(e => when === 'static' ? (e.only || []).includes('static') : !e.only);
}

const KW_FR = Object.fromEntries(KEYWORDS);
/** « Les Elfes que vous contrôlez ont le vol » : le mot-clé avec son article. */
const KW_GRANT = {
  'Flying': 'ont le vol', 'First Strike': 'ont l\'initiative', 'Double Strike': 'ont la double initiative',
  'Deathtouch': 'ont le contact mortel', 'Haste': 'ont la célérité', 'Hexproof': 'ont la défense talismanique',
  'Indestructible': 'sont indestructibles', 'Lifelink': 'ont le lien de vie', 'Menace': 'ont la menace', 'Reach': 'ont la portée',
  'Trample': 'ont le piétinement', 'Vigilance': 'ont la vigilance', 'Defender': 'ont le défenseur', 'Flash': 'ont le flash',
  'Shroud': 'ont le linceul', 'Prowess': 'ont la prouesse',
};

/** Langues du texte d'une carte perso. */
export const LANGS = [['fr', 'Français'], ['en', 'English']];

/** Nom d'un mot-clé dans la langue de la carte (l'anglais est le nom de Forge, en minuscules après le premier). */
export function keywordName(k, lang) {
  return lang === 'en' ? k.charAt(0) + k.slice(1).toLowerCase() : (KW_FR[k] || k);
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
  const parts = t.includes('{') ? [...t.matchAll(/\{([^}]+)\}/g)].map(m => m[1]) : t.match(/\d+|[WUBRGCXSP]\/[WUBRGP]|[WUBRGCXS]/g) || [];
  const out = [];
  let generic = 0;
  for (const p of parts) {
    if (/^\d+$/.test(p)) {
      generic += Number(p);
    } else {
      out.push(p.replace('/', ''));
    }
  }
  return [generic ? String(generic) : '', ...out].filter(Boolean).join(' ');
}

/** Couleurs d'un coût de Forge (« 2 W U » → « WU »). */
export function costColors(cost) {
  return [...'WUBRG'].filter(c => String(cost || '').includes(c)).join('');
}

/** Coût au format des symboles affichés (« 2 W U » → « {2}{W}{U} »). */
export function costSymbols(cost) {
  return String(cost || '').split(/\s+/).filter(Boolean).map(p => `{${p.length === 2 && p !== 'XX' ? p[0] + '/' + p[1] : p}}`).join('');
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
        en: `${allEn(a.filter)} you control gain ${kw.toLowerCase()} until end of turn`};
    }
    case 'pumpTarget':
      return {p: `Pump | ${target(creature)} | NumAtt$ +${n} | NumDef$ +${n}`, fr: `une créature ciblée gagne +${n}/+${n} jusqu'à la fin du tour`,
        en: `target creature gets +${n}/+${n} until end of turn`};
    case 'token': {
      const t = TOKENS.find(x => x[0] === a.token) || TOKENS[0];
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
      const text = en ? `${capitalize(allEn(a.filter))} you control have ${kw.toLowerCase()}.`
        : `${capitalize(allFr(a.filter))} que vous contrôlez ${KW_GRANT[kw] || 'ont ' + (KW_FR[kw] || kw).toLowerCase()}.`;
      return {lines: [`S:Mode$ Continuous | Affected$ ${valid(a.filter)} | AddKeyword$ ${kw} | Description$ ${text}`], text};
    }
    const text = en ? `${capitalize(allEn(a.filter))} you control get +${n}/+${n}.` : `${capitalize(allFr(a.filter))} que vous contrôlez gagnent +${n}/+${n}.`;
    return {lines: [`S:Mode$ Continuous | Affected$ ${valid(a.filter)} | AddPower$ ${n} | AddToughness$ ${n} | Description$ ${text}`], text};
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
  const head = {
    etb: ['Mode$ ChangesZone | Origin$ Any | Destination$ Battlefield | ValidCard$ Card.Self', 'Quand CARDNAME arrive sur le champ de bataille', 'When CARDNAME enters'],
    ally: [`Mode$ ChangesZone | Origin$ Any | Destination$ Battlefield | ValidCard$ ${valid(a.filter)} | TriggerZones$ Battlefield`,
      `Quand ${oneFr(a.filter)} arrive sur le champ de bataille sous votre contrôle`, `Whenever ${oneEn(a.filter)} you control enters`],
    attacks: ['Mode$ Attacks | ValidCard$ Card.Self', 'Quand CARDNAME attaque', 'Whenever CARDNAME attacks'],
    dies: ['Mode$ ChangesZone | Origin$ Battlefield | Destination$ Graveyard | ValidCard$ Card.Self', 'Quand CARDNAME meurt', 'When CARDNAME dies'],
    upkeep: ['Mode$ Phase | Phase$ Upkeep | ValidPlayer$ You | TriggerZones$ Battlefield', 'Au début de votre entretien', 'At the beginning of your upkeep'],
    end: ['Mode$ Phase | Phase$ End of Turn | ValidPlayer$ You | TriggerZones$ Battlefield', 'Au début de votre étape de fin', 'At the beginning of your end step'],
  }[a.when];
  const text = `${head[en ? 2 : 1]}, ${body}.`;
  return {lines: [`T:${head[0]} | Execute$ ${id} | TriggerDescription$ ${text}`, `SVar:${id}:DB$ ${e.p}`, ...extra], text};
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
  const cost = forgeCost(f.cost);
  lines.push(`ManaCost:${cost || 'no cost'}`);
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
    lines.push(`K:${k}`);
  }
  if (kws.length) {
    text.push(kws.map((k, i) => i ? keywordName(k, lang).toLowerCase() : keywordName(k, lang)).join(', '));
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
  lines.push(...displayLines(f));
  return lines.join('\n');
}
