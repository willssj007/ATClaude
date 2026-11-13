// Tests de l'Atelier par le vrai moteur : chaque effet (sur un déclencheur, une capacité activée ou un sort selon ce
// qu'il permet), chaque déclencheur, chaque effet permanent (chaque portée), chaque effet de joueur avec chaque choix
// « Joueur », chaque mot-clé, les cartes à deux faces, les sagas, le supertype Monde : le script généré par l'Atelier
// doit être accepté par Forge. Lancé par le CI (build de test) contre l'hôte ordinateur démarré à part :
//   java -jar desktop/target/desktop-*.jar --assets <forge>/forge-gui --data <dossier> --ui ui --no-browser &
//   node tests/atelier-forge.mjs [http://127.0.0.1:8765]
// Sortie en erreur (code 1) si Forge refuse un seul script.
import {buildScript, EFFECTS, WHEN, effectsFor, whoChoices, PLAYER_WHO, newMode, KEYWORDS, DFC_MODES} from '../ui/js/cardscript.js';
const BASE = process.argv[2] || 'http://127.0.0.1:8765';
const res = await fetch(BASE + '/api/events');
const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = '';
const responses = {};
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
      } catch (e) {}
    }
  }
})();
let rid = 70000 + Math.floor(Math.random() * 900) * 10;
async function req(type, body = {}) {
  const r = ++rid;
  await fetch(BASE + '/api/send', {method: 'POST', body: JSON.stringify({type, rid: r, ...body})});
  for (let k = 0; k < 400 && !responses[r]; k++) await new Promise(x => setTimeout(x, 50));
  const m = responses[r];
  if (!m) throw new Error('pas de réponse ' + type);
  if (m.error) throw new Error(m.error);
  return m.data;
}
let ok = 0;
let ko = 0;
let n = 0;
const card = (a, lang, x = {}) => ({name: `Essai total ${++n}`, cost: '{2}{B}', types: ['Creature'], subtypes: 'Elf', power: 2, toughness: 2, keywords: [], kwValues: {},
  lang, abilities: [a], ...x});
const ab = (x) => ({n: 2, cost: '{1}', tap: true, filter: {type: '', other: false}, token: 'w_1_1_soldier', keyword: 'Flying', mana: 'Any', counter: 'CHARGE', ...x});
async function check(label, f) {
  try {
    await req('customValidate', {script: buildScript(f)});
    ok++;
  } catch (e) {
    ko++;
    console.log('✗', label, f.lang, '→', e.message.slice(0, 200));
  }
}
for (const lang of ['fr', 'en']) {
  // Effets : déclencheur, capacité activée, sort.
  for (const e of EFFECTS.filter(x => !(x.only && x.only.includes('static') && x.only.length === 1) && !x.modal && !x.emblem)) {
    for (const when of ['etb', 'activated', 'spell']) {
      if (!effectsFor(when).some(x => x.id === e.id)) continue;
      const types = when === 'spell' ? ['Sorcery'] : e.attach ? ['Artifact'] : ['Creature'];
      const x = e.attach ? {subtypes: 'Equipment', kwValues: {Equip: '{1}'}, keywords: ['Equip']} : {};
      await check(`${e.id}@${when}`, card(ab({when, effect: e.id}), lang, {types, ...x}));
    }
  }
  // Effets permanents, chaque portée s'ils en ont une.
  for (const e of EFFECTS.filter(x => x.only && x.only.includes('static'))) {
    for (const scope of e.scope ? ['you', 'self', 'opp'] : ['you']) {
      await check(`${e.id}/${scope}`, card(ab({when: 'static', effect: e.id, scope, amount: e.amountSel ? 'creatures' : undefined}), lang));
    }
  }
  // Chaque déclencheur.
  for (const w of WHEN.filter(x => x.kind === 'T' && !x.attach)) {
    await check(`quand ${w.id}`, card(ab({when: w.id, effect: 'draw', n: 1, whenCounter: 'CHARGE', whenN: 2}), lang));
  }
  // Effets de joueur × choix « Joueur » × déclencheurs qui ont « ce joueur ».
  for (const effect of PLAYER_WHO) {
    for (const when of ['etb', 'attacks', 'combatDamage', 'oppCasts', 'oppDraws', 'attacksYou', 'unblocked', 'eachDraw', 'oppEnd', 'tapsForMana']) {
      for (const [who] of whoChoices(effect, when)) {
        await check(`${effect}/${when}/${who}`, card(ab({when, effect, who, n: 2, sacKind: 'artifact'}), lang));
      }
    }
  }
  // Chaque mot-clé (avec sa valeur s'il en a une).
  for (const k of KEYWORDS) {
    const key = k[0];
    await check(`mot-clé ${key}`, card({}, lang, {abilities: [], keywords: [key], kwValues: {}}));
  }
  // Cartes à deux faces : chaque sorte, avec un verso simple.
  for (const [mode] of DFC_MODES.filter(x => x[0])) {
    const back = {name: `Verso ${n + 1}`, cost: mode === 'transform' || mode === 'daynight' ? '' : '{1}{B}', types: ['Creature'], subtypes: 'Elf', power: 3, toughness: 3, keywords: [], kwValues: {}, abilities: []};
    await check(`deux faces ${mode}`, card({}, lang, {abilities: [], dfc: mode, back}));
  }
  // Saga à trois chapitres, enchantement Monde.
  await check('saga', card({}, lang, {types: ['Enchantment'], subtypes: 'Saga', abilities: [ab({when: 'chapter', chapter: 1, chapterTo: 2, effect: 'draw'}), ab({when: 'chapter', chapter: 3, effect: 'token'})]}));
  await check('monde', card({}, lang, {types: ['Enchantment'], world: true, abilities: []}));
  // Pile ou face avec ses deux issues.
  await check('pile ou face', card(ab({when: 'etb', effect: 'flipCoin', then: [{...newMode('draw'), n: 2}, {...newMode('loseLifeYou'), n: 2}]}), lang));
}
console.log(`\n${ok} scripts acceptés par Forge, ${ko} refusés`);
process.exit(ko ? 1 : 0);
