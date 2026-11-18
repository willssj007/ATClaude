// Essai en partie des effets de l'Atelier : pour chaque effet ponctuel, une carte perso « Quand elle arrive, … » est mise
// en jeu sous le contrôle de l'IA (qui fait les choix de cibles), sur un plateau préparé ; on compare l'état avant et
// après la résolution et on vérifie ce que l'effet doit faire (points de vie, main, cimetière, jetons, marqueurs…).
// atelier-forge.mjs vérifie que Forge accepte les scripts ; celui-ci vérifie qu'ils font ce qu'ils disent.
//   node tests/atelier-play.mjs [http://127.0.0.1:8765] [filtre d'effets (expression régulière)]
// Sortie en erreur (code 1) si un effet ne fait pas ce qu'il dit. « à revoir » : résultat dépendant des choix de l'IA
// ou du tirage, signalé sans faire échouer.
import {buildScript, EFFECTS, effectsFor} from '../ui/js/cardscript.js';
import {rehydrate} from '../ui/js/statediff.js';

const BASE = process.argv[2] || 'http://127.0.0.1:8765';
const FILTER = process.argv[3] ? new RegExp(process.argv[3]) : null;

// ------------------------------------------------------------------ pont

const res = await fetch(BASE + '/api/events');
const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = '';
const responses = {};
const dialogs = new Map();
let state = null;
let stateAt = 0;
(async () => {
  for (;;) {
    const {value, done} = await reader.read();
    if (done) return;
    buf += dec.decode(value, {stream: true});
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const f = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const d = f.split('\n').filter(l => l.startsWith('data: ')).map(l => l.slice(6)).join('\n');
      try {
        const m = JSON.parse(d);
        if (m.type === 'response') responses[m.rid] = m;
        if (m.type === 'state') {
          // Photos différentielles : les cartes inchangées arrivent par leur numéro (voir statediff.js).
          const full = rehydrate(m);
          if (full) {
            state = full;
            stateAt = Date.now();
          } else {
            fetch(BASE + '/api/send', {method: 'POST', body: JSON.stringify({type: 'state', full: true})});
          }
        }
        if (m.type === 'dialog') dialogs.set(m.id, m);
        if (m.type === 'dialogClosed') dialogs.delete(m.id);
      } catch (e) {}
    }
  }
})();
let rid = 81000 + Math.floor(Math.random() * 900) * 10;
async function req(type, body = {}) {
  const r = ++rid;
  await fetch(BASE + '/api/send', {method: 'POST', body: JSON.stringify({type, rid: r, ...body})});
  for (let k = 0; k < 900 && !responses[r]; k++) await wait(50);
  const m = responses[r];
  if (!m) throw new Error('pas de réponse ' + type);
  if (m.error) throw new Error(m.error);
  return m.data;
}
const send = (b) => fetch(BASE + '/api/send', {method: 'POST', body: JSON.stringify(b)});
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const meOf = () => state.players.find(p => p.me);
const aiOf = () => state.players.find(p => !p.me);

/** Une question de Forge pour moi (l'adversaire de la carte essayée) : la première réponse possible. */
function answer(d) {
  const items = d.items || d.options || [];
  let value = null;
  switch (d.kind) {
    case 'choose': {
      const min = Math.max(0, d.min || 0);
      const max = d.max < 0 ? items.length : d.max;
      const k = Math.min(items.length, Math.max(min, Math.min(1, max)));
      value = [...Array(k).keys()];
      break;
    }
    case 'option': value = 0; break;
    case 'input': value = (d.options && d.options[0]) || ''; break;
    case 'integer': value = Math.max(d.min ?? 0, Math.min(d.max ?? 1, 1)); break;
    case 'order': value = [...items.keys()]; break;
    case 'arrange': value = {top: [...items.keys()], moved: []}; break;
    default: value = null;
  }
  dialogs.delete(d.id);
  return send({type: 'answer', id: d.id, value});
}

/** Faire avancer la partie (répondre, passer la priorité) jusqu'à avoir la main, pile vide, pendant mon tour. */
async function settle(maxMs = 20000, {myTurn = true} = {}) {
  const end = Date.now() + maxMs;
  let quietSince = 0;
  // Cartes déjà touchées pour l'invite en cours (« défaussez-vous de deux cartes » : deux cartes différentes).
  let promptKey = '';
  const touched = new Set();
  while (Date.now() < end) {
    await wait(250);
    if (dialogs.size) {
      await answer(dialogs.values().next().value);
      quietSince = 0;
      continue;
    }
    if (!state || !state.players || Date.now() - stateAt < 350) continue;
    const p = state.prompt || {};
    if (process.env.DEBUG) console.log('   invite', JSON.stringify({input: p.input, msg: (p.message || '').slice(0, 80), ok: p.okEnabled, cancel: p.cancelEnabled, min: p.selectMin, max: p.selectMax,
      stack: (state.stack || []).length, phase: state.game && state.game.phase, sel: state.players.flatMap(pl => Object.values(pl.zones).flat()).filter(c => c && c.selectable).length}));
    const mine = state.game && state.game.activePlayer === meOf().id;
    if (p.input === 'InputPassPriority' && !(state.stack || []).length && (!myTurn || (mine && /MAIN/.test(state.game.phase || '')))) {
      if (!quietSince) quietSince = Date.now();
      if (Date.now() - quietSince > 700) return true;
      continue;
    }
    quietSince = 0;
    if (p.input && p.input !== 'InputPassPriority') {
      // Une sélection : les premières cartes (ou le premier joueur) qu'on peut choisir, chacune une fois, puis OK.
      // (le message compte les cartes qui restent à choisir : il change à chaque carte touchée)
      const key = `${p.input}|${p.selectMin}|${p.selectMax}|${(p.message || '').split('\n')[0]}|${(state.stack || []).length}`;
      if (key !== promptKey) {
        promptKey = key;
        touched.clear();
      }
      const cards = state.players.flatMap(pl => Object.values(pl.zones).flat()).filter(c => c && c.selectable && !touched.has(c.id));
      const players = state.players.filter(pl => pl.selectable && !touched.has(`p${pl.id}`));
      if (cards.length && !p.okEnabled) { touched.add(cards[0].id); await send({type: 'card', id: cards[0].id}); await wait(300); continue; }
      if (players.length && !p.okEnabled) { touched.add(`p${players[0].id}`); await send({type: 'player', id: players[0].id}); await wait(300); continue; }
    }
    if (p.okEnabled) await send({type: 'ok'});
    else if (p.cancelEnabled) await send({type: 'cancel'});
    else await send({type: 'state'});
    await wait(350);
  }
  return false;
}

// ------------------------------------------------------------------ plateau

async function newMatch() {
  await send({type: 'leaveMatch'});
  await wait(600);
  state = null;
  await req('startMatch', {setup: {format: 'constructed', mulligans: 0, players: [{name: 'Moi', ai: false, deckKey: 'randomConstructed'},
    {name: 'IA 1', ai: true, deckKey: 'randomConstructed', level: 'facile'}]}});
  for (let i = 0; i < 60 && !(state && state.players); i++) await wait(300);
  await settle(60000);
  const me = meOf().id;
  const ai = aiOf().id;
  const add = async (player, name, zone = 'battlefield') => {
    await send({type: 'cheat', op: 'addCard', player, name, zone});
    await wait(350);
  };
  for (const n of ['Grizzly Bears', 'Grizzly Bears', 'Mind Stone', 'Forest', 'Forest', 'Forest']) await add(me, n);
  await add(me, 'Llanowar Elves', 'graveyard');
  for (const n of ['Grizzly Bears', 'Forest', 'Forest', 'Forest']) await add(ai, n);
  await add(ai, 'Grizzly Bears', 'graveyard');
  await add(ai, 'Lightning Bolt', 'graveyard');
  await send({type: 'state'});
  await settle(15000);
  return {me, ai};
}

/** Ce qu'on compare : par joueur, points de vie, zones, permanents (jetons, créatures, engagés, marqueurs, force). */
function snapshot() {
  const pl = (p) => {
    const bf = p.zones.battlefield;
    const sum = (f) => bf.reduce((t, c) => t + f(c), 0);
    return {
      life: p.life, poison: p.poison || 0, energy: p.energy || 0, pcounters: JSON.stringify(p.counters || {}),
      hand: p.handSize ?? p.zones.hand.length, library: p.library, gy: p.zones.graveyard.length, exile: p.zones.exile.length,
      perms: bf.length, tokens: sum(c => (c.token ? 1 : 0)), creatures: sum(c => (c.creature ? 1 : 0)), tapped: sum(c => (c.tapped ? 1 : 0)),
      counters: sum(c => Object.values(c.counters || {}).reduce((a, b) => a + (Number(b) || 0), 0)),
      power: sum(c => (c.creature ? Number(c.power) || 0 : 0)), damage: sum(c => Number(c.damage) || 0),
      lost: !!p.lost, kw: bf.map(c => `${c.oracleName || c.name}:${(c.status || []).join('+')}:${c.power}/${c.toughness}`).sort().join('|'),
    };
  };
  return {me: pl(meOf()), ai: pl(aiOf())};
}

// ------------------------------------------------------------------ ce que chaque effet doit faire

const up = (k, who) => (b, a) => a[who][k] > b[who][k];
const down = (k, who) => (b, a) => a[who][k] < b[who][k];
const all = (...fs) => (b, a) => fs.every(f => f(b, a));
const any = (...fs) => (b, a) => fs.some(f => f(b, a));
const changed = (b, a) => JSON.stringify(b) !== JSON.stringify(a);
const hurtMe = any(down('life', 'me'), down('creatures', 'me'), up('damage', 'me'));
const lessMine = any(down('perms', 'me'), down('creatures', 'me'));
const lessAny = any(down('perms', 'me'), down('perms', 'ai'));
const ctrUp = any(up('counters', 'ai'), up('counters', 'me'));
const powUp = any(up('power', 'ai'), up('power', 'me'));
const lost = (b, a) => a.me.lost || a.ai.lost;
const NONE = null;
// [vérification, sûre ?] : sûre = l'effet doit le faire quels que soient les choix de l'IA et les cartes tirées.
const EXPECT = {
  damageAny: [hurtMe, false], damageCreature: [any(down('creatures', 'me'), up('damage', 'me'), down('creatures', 'ai'), up('damage', 'ai')), true],
  damageOpponents: [down('life', 'me'), true], damageYou: [down('life', 'ai'), true], damageEachCreature: [down('creatures', 'me'), true], damageEachOppCreature: [down('creatures', 'me'), true],
  earthquake: [all(down('life', 'me'), down('life', 'ai')), true], gainLife: [up('life', 'ai'), true], loseLifeYou: [down('life', 'ai'), true],
  drain: [all(down('life', 'me'), up('life', 'ai')), true], oppNoLifeTurn: [NONE], playersNoLifeTurn: [NONE], fog: [NONE], preventDamage: [NONE],
  poison: [up('poison', 'me'), true], energy: [up('energy', 'ai'), true], experience: [(b, a) => a.ai.pcounters !== b.ai.pcounters, true],
  draw: [up('hand', 'ai'), true], drawEach: [all(up('hand', 'ai'), up('hand', 'me')), true], loot: [up('gy', 'ai'), true], rummage: [up('gy', 'ai'), true],
  wheel: [up('gy', 'me'), true], dig: [all(up('hand', 'ai'), down('library', 'ai')), true], digTyped: [down('library', 'ai'), true],
  impulse: [up('exile', 'ai'), true], scry: [NONE], surveil: [NONE], mill: [up('gy', 'ai'), true], millOpponents: [up('gy', 'me'), true],
  discard: [down('hand', 'me'), true], thoughtseize: [down('hand', 'me'), false], tutor: [up('hand', 'ai'), true], tutorTyped: [up('hand', 'ai'), false],
  tutorBattlefield: [up('perms', 'ai'), false], regrowth: [all(up('hand', 'ai'), down('gy', 'ai')), true], regrowthTyped: [up('hand', 'ai'), false],
  putFromHand: [up('perms', 'ai'), false], castFree: [changed, false], reanimateTyped: [up('perms', 'ai'), false], playHideaway: [NONE],
  castFromGraveyard: [changed, false], digUntil: [up('hand', 'ai'), true], reanimate: [any(up('creatures', 'ai'), up('creatures', 'me')), true],
  shuffleGraveyard: [down('gy', 'ai'), true], exileGraveyard: [any(up('exile', 'me'), up('exile', 'ai')), true],
  countersSelf: [up('counters', 'ai'), true], countersEach: [up('counters', 'ai'), true], countersTarget: [ctrUp, true], countersPermTarget: [ctrUp, true],
  removeCountersSelf: [NONE], removeCountersTarget: [NONE], proliferate: [NONE], doubleCountersTarget: [NONE], moveCounters: [NONE], removeAllCounters: [NONE],
  animateSelf: [NONE], animateTarget: [changed, false], animateLands: [up('creatures', 'ai'), true], animateAll: [up('creatures', 'ai'), true],
  doubleCountersAll: [NONE], protectionTarget: [NONE], protectionAll: [NONE], debuffTarget: [NONE], regenerateTarget: [NONE], mustBlock: [NONE],
  removeFromCombat: [NONE], endure: [any(up('counters', 'ai'), up('tokens', 'ai')), true], sacrificeEndStep: [NONE], exileEndStep: [NONE],
  flicker: [NONE], flickerEnd: [changed, false], pumpSelf: [up('power', 'ai'), true], pumpTarget: [powUp, true],
  shrinkTarget: [any(down('creatures', 'me'), down('power', 'me'), down('creatures', 'ai'), down('power', 'ai')), true], pumpAll: [up('power', 'ai'), true],
  shrinkOpp: [down('creatures', 'me'), true], grantKeywordTurn: [changed, true], keywordTarget: [changed, true], unblockableTarget: [NONE], regenerate: [NONE],
  token: [up('tokens', 'ai'), true], cloneToken: [any(up('tokens', 'ai'), up('tokens', 'me')), true], cloneSelf: [up('tokens', 'ai'), true],
  cloneThat: [up('tokens', 'ai'), true], populate: [NONE], monstrosity: [up('counters', 'ai'), true], adapt: [up('counters', 'ai'), true],
  bolster: [up('counters', 'ai'), true], support: [up('counters', 'ai'), true], bite: [any(hurtMe, down('creatures', 'ai'), up('damage', 'ai')), false],
  untapAllYours: [NONE], sacrificeSelf: [down('creatures', 'ai'), true], destroy: [any(down('creatures', 'me'), down('creatures', 'ai')), true],
  destroyPermanent: [lessAny, true], destroyArtEnch: [lessMine, true], destroyOpp: [lessMine, true], destroyTyped: [lessAny, true],
  wrath: [all(down('creatures', 'me'), down('creatures', 'ai')), true], destroyAllTyped: [lessAny, true], destroyN: [lessAny, true], destroyMv: [lessAny, true],
  edict: [down('creatures', 'me'), true], sacrificeEach: [all(down('creatures', 'me'), down('creatures', 'ai')), true],
  exile: [any(down('creatures', 'me'), down('creatures', 'ai')), true], exileOpp: [lessMine, true], exileTyped: [lessAny, true], exileAllTyped: [lessAny, true],
  exileN: [lessAny, true], exileMv: [lessAny, true], bounce: [lessAny, true], bounceTyped: [lessAny, true], bounceOpp: [lessMine, true],
  bounceAllTyped: [lessAny, true], tuck: [lessAny, true], tuckTop: [lessAny, true], exileUntilLeaves: [lessAny, true], sacrificeAllYours: [down('perms', 'ai'), true],
  phaseOut: [changed, false], detain: [NONE], fight: [changed, true], fightTargets: [changed, true],
  counterSpell: [NONE], counterCreature: [NONE], counterNonCreature: [NONE], counterUnless: [NONE], counterAbility: [NONE],
  tap: [up('tapped', 'me'), false], tapOrUntap: [changed, false], exchangeControlSelf: [changed, true], untap: [NONE], tapAllOpp: [up('tapped', 'me'), true],
  cantBlockOpp: [NONE], threaten: [all(up('perms', 'ai'), down('perms', 'me')), true], gainControl: [all(up('perms', 'ai'), down('perms', 'me')), true], goad: [NONE],
  rampLand: [up('perms', 'ai'), true], rampTwo: [up('perms', 'ai'), true], landFromHand: [up('perms', 'ai'), false],
  damagePlayer: [any(down('life', 'me'), down('life', 'ai')), true], damageOpponent: [down('life', 'me'), true], targetLoseLife: [any(down('life', 'me'), down('life', 'ai')), true],
  drainTarget: [up('life', 'ai'), true], targetGainLife: [any(up('life', 'ai'), up('life', 'me')), true], targetDraw: [any(up('hand', 'ai'), up('hand', 'me')), true],
  targetDiscard: [any(down('hand', 'me'), down('hand', 'ai')), true], targetMill: [any(up('gy', 'me'), up('gy', 'ai')), true],
  targetSacrifice: [any(down('creatures', 'me'), down('creatures', 'ai')), true], targetPoison: [any(up('poison', 'me'), up('poison', 'ai')), true],
  targetRadiation: [(b, a) => a.me.pcounters !== b.me.pcounters || a.ai.pcounters !== b.ai.pcounters, true], targetRevealHand: [NONE], lookHand: [NONE],
  targetDiscardHand: [any(down('hand', 'me'), down('hand', 'ai')), true], targetDiscardRandom: [any(down('hand', 'me'), down('hand', 'ai')), true],
  targetExileTop: [any(up('exile', 'me'), up('exile', 'ai')), true], targetSacrificeType: [lessAny, false],
  playerCreaturesDebuff: [any(down('creatures', 'me'), down('creatures', 'ai')), true], playerTapAll: [any(up('tapped', 'me'), up('tapped', 'ai')), true],
  playerDestroyAll: [any(down('creatures', 'me'), down('creatures', 'ai')), true], targetToken: [any(up('tokens', 'ai'), up('tokens', 'me')), true],
  targetMonarch: [NONE], targetSetLife: [any((b, a) => a.me.life !== b.me.life, (b, a) => a.ai.life !== b.ai.life), true], exchangeLife: [NONE],
  targetSkipTurn: [NONE], targetLoseGame: [lost, true], silence: [NONE], extraTurn: [NONE], extraCombat: [NONE], extraLandTurn: [NONE], endTurn: [NONE],
  flipCoin: [NONE], copySpell: [NONE], winGame: [lost, true], discover: [changed, false], explore: [changed, true],
  earthbend: [any(up('creatures', 'ai'), up('counters', 'ai')), true], airbend: [lessAny, false], connive: [changed, true], investigate: [up('tokens', 'ai'), true],
  incubate: [up('tokens', 'ai'), true], manifest: [up('creatures', 'ai'), true], transform: [NONE], prepareSelf: [NONE], suspectSelf: [NONE], suspectTarget: [NONE],
  cloak: [up('creatures', 'ai'), true], manifestDread: [up('creatures', 'ai'), true], amass: [any(up('tokens', 'ai'), up('counters', 'ai')), true],
  ringTempts: [NONE], monarch: [NONE], initiative: [NONE], venture: [NONE],
};

// ------------------------------------------------------------------ essais

const SKIP_WHEN = new Set(['blocksCreature', 'blocked', 'blocks', 'allyBlocked', 'activated', 'loyalty', 'spell']);
const list = EFFECTS.filter(e => !(e.only && e.only.every(w => w === 'static')) && !e.attach && !e.modal && !e.emblem && (!FILTER || FILTER.test(e.id)));
const ok = [];
const bad = [];
const soft = [];
const untested = [];
let n = 0;
for (const e of list) {
  const when = effectsFor('etb').some(x => x.id === e.id) ? 'etb' : (e.only || []).find(w => !SKIP_WHEN.has(w));
  if (!when) {
    untested.push(`${e.id} (seulement ${(e.only || []).join('/')})`);
    continue;
  }
  const name = `Essai Effet ${++n}`;
  const card = {name, cost: '{2}{G}', types: ['Creature'], subtypes: 'Elf', power: 2, toughness: 2, keywords: [], kwValues: {}, lang: 'fr',
    abilities: [{when, effect: e.id, n: 2, filter: {type: '', other: false}, token: 'w_1_1_soldier', keyword: 'Flying', mana: 'Any', counter: 'P1P1'}]};
  try {
    const script = buildScript(card);
    await req('customSave', {script, previous: name, art: null}).catch(() => req('customSave', {script, previous: '', art: null}));
    const {me, ai} = await newMatch();
    await send({type: 'cheat', op: 'addCard', player: ai, name, zone: 'battlefield'});
    if (when !== 'etb') {
      // Le déclencheur de l'effet : une autre créature de l'IA arrive (ou meurt, pour « quand une créature meurt »).
      await wait(600);
      await send({type: 'cheat', op: 'addCard', player: ai, name: /Dies$/.test(when) ? 'Memnite' : 'Grizzly Bears', zone: 'battlefield'});
    }
    await wait(900);
    await send({type: 'state'});
    await wait(500);
    const before = snapshot();
    const settled = await settle(25000);
    await send({type: 'state'});
    await wait(500);
    const after = snapshot();
    const [check, sure] = EXPECT[e.id] || [changed, false];
    const line = (state.log || []).find(l => /Essai Effet/.test(l.text) && !/déclenche/.test(l.text));
    const label = `${e.id} (${when})${settled ? '' : ' [partie bloquée]'} — ${line ? line.text.slice(0, 110) : 'pas de ligne au journal'}`;
    if (!check) {
      ok.push(`${label} [rien à mesurer]`);
    } else if (check(before, after)) {
      ok.push(label);
    } else if (sure) {
      bad.push(`${label}\n     avant ${JSON.stringify(before.me)} / ${JSON.stringify(before.ai)}\n     après ${JSON.stringify(after.me)} / ${JSON.stringify(after.ai)}`);
    } else {
      soft.push(label);
    }
    process.stdout.write(`${n}/${list.length} ${e.id} ${!check ? '·' : check(before, after) ? '✓' : sure ? '✗' : '?'}\n`);
  } catch (err) {
    bad.push(`${e.id} — erreur : ${err.message}`);
  }
  await req('customDelete', {name}).catch(() => {});
}
await send({type: 'leaveMatch'});
console.log(`\n${ok.length} effets font ce qu'ils disent, ${soft.length} à revoir (choix de l'IA ou tirage), ${bad.length} en échec, ${untested.length} non essayés.`);
if (soft.length) console.log('\nÀ revoir :\n  ' + soft.join('\n  '));
if (bad.length) console.log('\nÉchecs :\n  ' + bad.join('\n  '));
if (untested.length) console.log('\nNon essayés ici : ' + untested.join(', '));
process.exit(bad.length ? 1 : 0);
