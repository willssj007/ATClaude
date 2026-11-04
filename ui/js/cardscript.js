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
  {id: 'static', kind: 'S', label: 'Effet permanent (tant qu\'elle est en jeu)', filter: true},
];

export const TOKENS = [
  ['w_1_1_soldier', 'Soldat 1/1 blanc', 'de créature 1/1 blanche Soldat'],
  ['w_1_1_human', 'Humain 1/1 blanc', 'de créature 1/1 blanche Humain'],
  ['w_1_1_spirit_flying', 'Esprit 1/1 blanc, vol', 'de créature 1/1 blanche Esprit avec le vol'],
  ['w_2_2_cat', 'Chat 2/2 blanc', 'de créature 2/2 blanche Chat'],
  ['w_4_4_angel_flying', 'Ange 4/4 blanc, vol', 'de créature 4/4 blanche Ange avec le vol'],
  ['u_1_1_bird_flying', 'Oiseau 1/1 bleu, vol', 'de créature 1/1 bleue Oiseau avec le vol'],
  ['u_2_2_drake_flying', 'Drakôn 2/2 bleu, vol', 'de créature 2/2 bleue Drakôn avec le vol'],
  ['b_1_1_rat', 'Rat 1/1 noir', 'de créature 1/1 noire Rat'],
  ['b_2_2_zombie', 'Zombie 2/2 noir', 'de créature 2/2 noire Zombie'],
  ['r_1_1_goblin', 'Gobelin 1/1 rouge', 'de créature 1/1 rouge Gobelin'],
  ['r_1_1_elemental_haste', 'Élémental 1/1 rouge, célérité', 'de créature 1/1 rouge Élémental avec la célérité'],
  ['r_5_5_dragon_flying', 'Dragon 5/5 rouge, vol', 'de créature 5/5 rouge Dragon avec le vol'],
  ['g_1_1_saproling', 'Saprobionte 1/1 vert', 'de créature 1/1 verte Saprobionte'],
  ['g_1_1_elf_warrior', 'Elfe guerrier 1/1 vert', 'de créature 1/1 verte Elfe et Guerrier'],
  ['g_2_2_wolf', 'Loup 2/2 vert', 'de créature 2/2 verte Loup'],
  ['g_3_3_beast', 'Bête 3/3 verte', 'de créature 3/3 verte Bête'],
  ['c_1_1_a_thopter_flying', 'Mécanoptère 1/1, vol', 'de créature-artefact 1/1 incolore Mécanoptère avec le vol'],
  ['c_1_1_a_servo', 'Servo 1/1', 'de créature-artefact 1/1 incolore Servo'],
  ['c_a_treasure_sac', 'Trésor', 'Trésor'],
  ['c_a_clue_draw', 'Indice', 'Indice'],
  ['c_a_food_sac', 'Nourriture', 'Nourriture'],
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
  {id: 'countersEach', label: 'Marqueurs +1/+1 sur chaque créature filtrée', n: true, filter: true},
  {id: 'countersTarget', label: 'Marqueurs +1/+1 sur une créature ciblée', n: true},
  {id: 'pumpAll', label: '+N/+N aux créatures filtrées jusqu\'à la fin du tour', n: true, filter: true},
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
  {id: 'anthem', label: '+N/+N aux créatures filtrées (en permanence)', n: true, filter: true, only: ['static']},
  {id: 'grantKeyword', label: 'Un mot-clé aux créatures filtrées (en permanence)', filter: true, keyword: true, only: ['static']},
];

/** Effets proposés pour un « quand » donné. */
export function effectsFor(when) {
  return EFFECTS.filter(e => when === 'static' ? (e.only || []).includes('static') : !e.only);
}

const KW_FR = Object.fromEntries(KEYWORDS);
/** « Les X-Men que vous contrôlez ont le vol » : le mot-clé avec son article. */
const KW_GRANT = {
  'Flying': 'ont le vol', 'First Strike': 'ont l\'initiative', 'Double Strike': 'ont la double initiative',
  'Deathtouch': 'ont le contact mortel', 'Haste': 'ont la célérité', 'Hexproof': 'ont la défense talismanique',
  'Indestructible': 'sont indestructibles', 'Lifelink': 'ont le lien de vie', 'Menace': 'ont la menace', 'Reach': 'ont la portée',
  'Trample': 'ont le piétinement', 'Vigilance': 'ont la vigilance', 'Defender': 'ont le défenseur', 'Flash': 'ont le flash',
  'Shroud': 'ont le linceul', 'Prowess': 'ont la prouesse',
};

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

/** « Creature.X-Men+YouCtrl+Other » pour Forge. */
function valid(f) {
  const props = ['YouCtrl'];
  if (f && f.other) {
    props.push('Other');
  }
  return f && f.type ? `Creature.${f.type}+${props.join('+')}` : `Creature.${props.join('+')}`;
}

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

/** Paramètres de Forge et texte français d'un effet. id : préfixe des SVar de cette capacité. */
function effect(a, id) {
  const n = Math.max(0, Math.round(Number(a.n) || 0));
  const target = (what) => `ValidTgts$ ${what.v} | TgtPrompt$ ${what.prompt}`;
  const creature = {v: 'Creature', prompt: 'Choisissez une créature ciblée'};
  switch (a.effect) {
    case 'damageAny':
      return {p: `DealDamage | ValidTgts$ Any | NumDmg$ ${n}`, fr: `CARDNAME inflige ${n} ${plural(n, 'blessure', 'blessures')} à n'importe quelle cible`};
    case 'damageCreature':
      return {p: `DealDamage | ${target(creature)} | NumDmg$ ${n}`, fr: `CARDNAME inflige ${n} ${plural(n, 'blessure', 'blessures')} à une créature ciblée`};
    case 'damageOpponents':
      return {p: `DealDamage | Defined$ Player.Opponent | NumDmg$ ${n}`, fr: `CARDNAME inflige ${n} ${plural(n, 'blessure', 'blessures')} à chaque adversaire`};
    case 'draw':
      return {p: `Draw | Defined$ You | NumCards$ ${n}`, fr: n === 1 ? 'piochez une carte' : `piochez ${n} cartes`};
    case 'gainLife':
      return {p: `GainLife | Defined$ You | LifeAmount$ ${n}`, fr: `vous gagnez ${n} ${plural(n, 'point', 'points')} de vie`};
    case 'drain':
      return {
        p: `LoseLife | Defined$ Player.Opponent | LifeAmount$ ${n} | SubAbility$ ${id}Gain`,
        extra: [`SVar:${id}Gain:DB$ GainLife | Defined$ You | LifeAmount$ ${n}`],
        fr: `chaque adversaire perd ${n} ${plural(n, 'point', 'points')} de vie et vous gagnez ${n} ${plural(n, 'point', 'points')} de vie`,
      };
    case 'countersSelf':
      return {p: `PutCounter | Defined$ Self | CounterType$ P1P1 | CounterNum$ ${n}`, fr: `mettez ${n === 1 ? 'un marqueur' : n + ' marqueurs'} +1/+1 sur CARDNAME`};
    case 'countersEach':
      return {p: `PutCounterAll | ValidCards$ ${valid(a.filter)} | CounterType$ P1P1 | CounterNum$ ${n}`,
        fr: `mettez ${n === 1 ? 'un marqueur' : n + ' marqueurs'} +1/+1 sur chaque ${eachFr(a.filter)} que vous contrôlez`};
    case 'countersTarget':
      return {p: `PutCounter | ${target(creature)} | CounterType$ P1P1 | CounterNum$ ${n}`, fr: `mettez ${n === 1 ? 'un marqueur' : n + ' marqueurs'} +1/+1 sur une créature ciblée`};
    case 'pumpAll':
      return {p: `PumpAll | ValidCards$ ${valid(a.filter)} | NumAtt$ +${n} | NumDef$ +${n}`, fr: `${allFr(a.filter)} que vous contrôlez gagnent +${n}/+${n} jusqu'à la fin du tour`};
    case 'pumpTarget':
      return {p: `Pump | ${target(creature)} | NumAtt$ +${n} | NumDef$ +${n}`, fr: `une créature ciblée gagne +${n}/+${n} jusqu'à la fin du tour`};
    case 'token': {
      const t = TOKENS.find(x => x[0] === a.token) || TOKENS[0];
      return {p: `Token | TokenAmount$ ${Math.max(1, n)} | TokenScript$ ${t[0]} | TokenOwner$ You`,
        fr: `créez ${Math.max(1, n) === 1 ? 'un jeton' : Math.max(1, n) + ' jetons'} ${t[2]}`};
    }
    case 'destroy':
      return {p: `Destroy | ${target(creature)}`, fr: 'détruisez une créature ciblée'};
    case 'destroyPermanent':
      return {p: `Destroy | ${target({v: 'Permanent.nonLand', prompt: 'Choisissez un permanent non-terrain ciblé'})}`, fr: 'détruisez un permanent non-terrain ciblé'};
    case 'exile':
      return {p: `ChangeZone | ${target(creature)} | Origin$ Battlefield | Destination$ Exile`, fr: 'exilez une créature ciblée'};
    case 'bounce':
      return {p: `ChangeZone | ${target(creature)} | Origin$ Battlefield | Destination$ Hand`, fr: 'renvoyez une créature ciblée dans la main de son propriétaire'};
    case 'tap':
      return {p: `Tap | ${target(creature)}`, fr: 'engagez une créature ciblée'};
    case 'counterSpell':
      return {p: 'Counter | TargetType$ Spell | ValidTgts$ Card | TgtPrompt$ Choisissez un sort ciblé', fr: 'contrecarrez un sort ciblé'};
    case 'scry':
      return {p: `Scry | ScryNum$ ${Math.max(1, n)}`, fr: `regard ${Math.max(1, n)}`};
    case 'discard':
      return {p: `Discard | Defined$ Player.Opponent | NumCards$ ${Math.max(1, n)} | Mode$ TgtChoose`,
        fr: `chaque adversaire défausse ${Math.max(1, n) === 1 ? 'une carte' : Math.max(1, n) + ' cartes'}`};
    default:
      return null;
  }
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Coût d'une capacité activée : mana, {T}, sacrifier. Renvoie le coût pour Forge et en français. */
function activationCost(a) {
  const forge = [];
  const fr = [];
  const mana = forgeCost(a.cost);
  if (mana) {
    forge.push(mana);
    fr.push(costSymbols(mana));
  }
  if (a.tap) {
    forge.push('T');
    fr.push('{T}');
  }
  if (a.sac) {
    forge.push('Sac<1/CARDNAME>');
    fr.push('sacrifiez CARDNAME');
  }
  return {forge: forge.join(' ') || '0', fr: fr.join(', ') || '{0}'};
}

/** Lignes du script et texte français d'une capacité. i : son numéro (noms des SVar). */
export function abilityLines(a, i) {
  const id = `Atelier${i + 1}`;
  const w = WHEN.find(x => x.id === a.when);
  if (!w) {
    return null;
  }
  if (a.when === 'static') {
    const n = Math.max(0, Math.round(Number(a.n) || 0));
    if (a.effect === 'grantKeyword') {
      const kw = a.keyword || 'Flying';
      const fr = `${capitalize(allFr(a.filter))} que vous contrôlez ${KW_GRANT[kw] || 'ont ' + (KW_FR[kw] || kw).toLowerCase()}.`;
      return {lines: [`S:Mode$ Continuous | Affected$ ${valid(a.filter)} | AddKeyword$ ${kw} | Description$ ${fr}`], fr};
    }
    const fr = `${capitalize(allFr(a.filter))} que vous contrôlez gagnent +${n}/+${n}.`;
    return {lines: [`S:Mode$ Continuous | Affected$ ${valid(a.filter)} | AddPower$ ${n} | AddToughness$ ${n} | Description$ ${fr}`], fr};
  }
  const e = effect(a, id);
  if (!e) {
    return null;
  }
  const extra = e.extra || [];
  if (w.kind === 'SP') {
    const fr = capitalize(e.fr) + '.';
    return {lines: [`A:SP$ ${e.p} | SpellDescription$ ${fr}`, ...extra], fr};
  }
  if (w.kind === 'A') {
    if (a.when === 'loyalty') {
      const k = Math.round(Number(a.loyalty) || 0);
      const cost = k >= 0 ? `AddCounter<${k}/LOYALTY>` : `SubCounter<${-k}/LOYALTY>`;
      const fr = `[${k > 0 ? '+' : ''}${k}] : ${capitalize(e.fr)}.`;
      return {lines: [`A:AB$ ${e.p} | Cost$ ${cost} | Planeswalker$ True | SpellDescription$ ${fr}`, ...extra], fr};
    }
    const c = activationCost(a);
    const fr = `${c.fr} : ${capitalize(e.fr)}.`;
    return {lines: [`A:AB$ ${e.p} | Cost$ ${c.forge} | SpellDescription$ ${fr}`, ...extra], fr};
  }
  const head = {
    etb: ['Mode$ ChangesZone | Origin$ Any | Destination$ Battlefield | ValidCard$ Card.Self', 'Quand CARDNAME arrive sur le champ de bataille'],
    ally: [`Mode$ ChangesZone | Origin$ Any | Destination$ Battlefield | ValidCard$ ${valid(a.filter)} | TriggerZones$ Battlefield`,
      `Quand ${oneFr(a.filter)} arrive sur le champ de bataille sous votre contrôle`],
    attacks: ['Mode$ Attacks | ValidCard$ Card.Self', 'Quand CARDNAME attaque'],
    dies: ['Mode$ ChangesZone | Origin$ Battlefield | Destination$ Graveyard | ValidCard$ Card.Self', 'Quand CARDNAME meurt'],
    upkeep: ['Mode$ Phase | Phase$ Upkeep | ValidPlayer$ You | TriggerZones$ Battlefield', 'Au début de votre entretien'],
    end: ['Mode$ Phase | Phase$ End of Turn | ValidPlayer$ You | TriggerZones$ Battlefield', 'Au début de votre étape de fin'],
  }[a.when];
  const fr = `${head[1]}, ${e.fr}.`;
  return {lines: [`T:${head[0]} | Execute$ ${id} | TriggerDescription$ ${fr}`, `SVar:${id}:DB$ ${e.p}`, ...extra], fr};
}

/** Le script complet d'une carte du formulaire. */
export function buildScript(f) {
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
  const fr = [];
  const kws = (f.keywords || []).filter(k => KW_FR[k]);
  for (const k of kws) {
    lines.push(`K:${k}`);
  }
  if (kws.length) {
    fr.push(kws.map((k, i) => i ? KW_FR[k].toLowerCase() : KW_FR[k]).join(', '));
  }
  (f.abilities || []).forEach((a, i) => {
    const r = abilityLines(a, i);
    if (r) {
      lines.push(...r.lines);
      fr.push(r.fr.replace(/CARDNAME/g, name));
    }
  });
  if (fr.length) {
    lines.push(`Oracle:${fr.join('\\n')}`);
  }
  return lines.join('\n');
}
