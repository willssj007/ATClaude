// Atelier : du formulaire au script de Forge. Chaque capacité du formulaire (un déclencheur ou un coût, un effet, un
// filtre de créatures, un nombre) devient une ligne T:/A:/S: et son SVar, avec son texte en français, sur le modèle des
// cartes de Forge (Flametongue Kavu, Elvish Visionary, Biomathematician...). Forge vérifie ensuite le script.

export const CARD_TYPES = [
  ['Creature', 'Créature'], ['Artifact', 'Artefact'], ['Enchantment', 'Enchantement'], ['Land', 'Terrain'],
  ['Planeswalker', 'Planeswalker'], ['Instant', 'Éphémère'], ['Sorcery', 'Rituel'],
  // « De clan » (autrefois « tribal ») : une carte non-créature qui a des types de créature (« Éphémère de clan : elfe »).
  ['Kindred', 'De clan'],
];

/**
 * Mots-clés : [clé de Forge, nom français, nom anglais, groupe, valeur, « ont … » pour les donner à d'autres créatures,
 * valeur par défaut, options]. Les noms français sont ceux des cartes imprimées (tirés des traductions de Forge).
 * valeur : 'n' (un nombre : Annihilateur 2), 'gen' (un coût générique : Parade {2}), 'cost' (un coût de mana :
 * Recyclage {1}{U}), 'ncost' (un nombre et un coût : Suspension 3 — {1}{U}), 'sel' (une option de KW_OPTIONS :
 * Affinité pour les artefacts), 'text' (un nom de carte), 'type' (un type de créature : Appui d'elfe).
 * options : line (la ligne de Forge, avec {n}, {cost}, {opt}, {type}), fr / en (le texte sur la carte, avec {n}, {nw},
 * {sym}, {optFr}, {optEn}, {deType}, {aType}, {Type}), sub (le sous-type qu'il demande : Aura, Équipement, Véhicule…),
 * base (le type de carte qui va avec), pt (il faut une force et une endurance : véhicule).
 * Sans phrase « ont … », le mot-clé ne se donne pas à d'autres créatures.
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
  ['Trample:Planeswalker', 'Piétinement au-dessus des planeswalkers', 'Trample over planeswalkers', 'combat', null, 'ont le piétinement au-dessus des planeswalkers'],
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
  ['Banding', 'Regroupement', 'Banding', 'combat', null, 'ont le regroupement'],
  ['Landwalk:Plains', 'Traversée des plaines', 'Plainswalk', 'combat', null, 'ont la traversée des plaines'],
  ['Landwalk:Island', 'Traversée des îles', 'Islandwalk', 'combat', null, 'ont la traversée des îles'],
  ['Landwalk:Swamp', 'Traversée des marais', 'Swampwalk', 'combat', null, 'ont la traversée des marais'],
  ['Landwalk:Mountain', 'Traversée des montagnes', 'Mountainwalk', 'combat', null, 'ont la traversée des montagnes'],
  ['Landwalk:Forest', 'Traversée des forêts', 'Forestwalk', 'combat', null, 'ont la traversée des forêts'],
  ['Landwalk:Land.Legendary:Legendary land', 'Traversée des terrains légendaires', 'Legendary landwalk', 'combat', null, 'ont la traversée des terrains légendaires'],
  ['Afflict', 'Affliction', 'Afflict', 'combat', 'n', null, 2],
  ['Provoke', 'Provocation', 'Provoke', 'combat', null],
  ['Enlist', 'Enrôlement', 'Enlist', 'combat', null],
  ['Hexproof', 'Défense talismanique', 'Hexproof', 'protect', null, 'ont la défense talismanique'],
  ['Hexproof:White', 'Défense talismanique contre le blanc', 'Hexproof from white', 'protect', null, 'ont la défense talismanique contre le blanc'],
  ['Hexproof:Blue', 'Défense talismanique contre le bleu', 'Hexproof from blue', 'protect', null, 'ont la défense talismanique contre le bleu'],
  ['Hexproof:Black', 'Défense talismanique contre le noir', 'Hexproof from black', 'protect', null, 'ont la défense talismanique contre le noir'],
  ['Hexproof:Red', 'Défense talismanique contre le rouge', 'Hexproof from red', 'protect', null, 'ont la défense talismanique contre le rouge'],
  ['Hexproof:Green', 'Défense talismanique contre le vert', 'Hexproof from green', 'protect', null, 'ont la défense talismanique contre le vert'],
  ['Hexproof:Card.MonoColor:monocolored', 'Défense talismanique contre le monochrome', 'Hexproof from monocolored', 'protect', null, 'ont la défense talismanique contre le monochrome'],
  ['Hexproof:Artifact', 'Défense talismanique contre les artefacts', 'Hexproof from artifacts', 'protect', null, 'ont la défense talismanique contre les artefacts'],
  ['Shroud', 'Linceul', 'Shroud', 'protect', null, 'ont le linceul'],
  ['Indestructible', 'Indestructible', 'Indestructible', 'protect', null, 'sont indestructibles'],
  ['Protection from white', 'Protection contre le blanc', 'Protection from white', 'protect', null, 'ont la protection contre le blanc'],
  ['Protection from blue', 'Protection contre le bleu', 'Protection from blue', 'protect', null, 'ont la protection contre le bleu'],
  ['Protection from black', 'Protection contre le noir', 'Protection from black', 'protect', null, 'ont la protection contre le noir'],
  ['Protection from red', 'Protection contre le rouge', 'Protection from red', 'protect', null, 'ont la protection contre le rouge'],
  ['Protection from green', 'Protection contre le vert', 'Protection from green', 'protect', null, 'ont la protection contre le vert'],
  ['Protection:Creature:creatures', 'Protection contre les créatures', 'Protection from creatures', 'protect', null, 'ont la protection contre les créatures'],
  ['Protection:Artifact:artifacts', 'Protection contre les artefacts', 'Protection from artifacts', 'protect', null, 'ont la protection contre les artefacts'],
  ['Protection:Card.MultiColor:multicolored', 'Protection contre le multicolore', 'Protection from multicolored', 'protect', null, 'ont la protection contre le multicolore'],
  ['Protection:Instant:instants', 'Protection contre les éphémères', 'Protection from instants', 'protect', null, 'ont la protection contre les éphémères'],
  ['Protection from everything', 'Protection contre tout', 'Protection from everything', 'protect', null, 'ont la protection contre tout'],
  ['Ward', 'Parade', 'Ward', 'protect', 'gen', null, 2],
  ['Ward:PayLife', 'Parade — payer des points de vie', 'Ward—Pay life', 'protect', 'n', null, 2,
    {line: 'K:Ward:PayLife<{n}>', fr: 'Parade — Payez {n} points de vie.', en: 'Ward—Pay {n} life.'}],
  ['Ward:Discard', 'Parade — se défausser d\'une carte', 'Ward—Discard a card', 'protect', null, null, null,
    {line: 'K:Ward:Discard<1/Card>', fr: 'Parade — Défaussez-vous d\'une carte.', en: 'Ward—Discard a card.'}],
  ['Phasing', 'Déphasage', 'Phasing', 'protect', null, 'ont le déphasage'],
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
  ['Dethrone', 'Détrôner', 'Dethrone', 'ability', null, 'ont détrôner'],
  ['Melee', 'Mêlée', 'Melee', 'ability', null, 'ont la mêlée'],
  ['Battle cry', 'Cri de guerre', 'Battle cry', 'ability', null],
  ['Myriad', 'Myriade', 'Myriad', 'ability', null],
  ['Evolve', 'Évolution', 'Evolve', 'ability', null],
  ['Extort', 'Extorsion', 'Extort', 'ability', null],
  ['Unleash', 'Emportement', 'Unleash', 'ability', null],
  ['Decayed', 'Décomposition', 'Decayed', 'ability', null],
  ['Ascend', 'Ascension', 'Ascend', 'ability', null],
  ['Devoid', 'Carence', 'Devoid', 'ability', null],
  ['Exploit', 'Exploitation', 'Exploit', 'ability', null],
  ['Ingest', 'Ingestion', 'Ingest', 'ability', null, 'ont l\'ingestion'],
  ['Soulbond', 'Association d\'âmes', 'Soulbond', 'ability', null],
  ['Sunburst', 'Solarisation', 'Sunburst', 'ability', null],
  ['Increment', 'Incrémentation', 'Increment', 'ability', null],
  ['Compleated', 'Parachevé', 'Compleated', 'ability', null],
  ['Read ahead', 'Lecture rapide', 'Read ahead', 'ability', null],
  ['Outlast', 'Résilience', 'Outlast', 'ability', 'cost', null, '{1}'],
  ['Champion', 'Appui', 'Champion', 'ability', 'type', null, 'Creature', {fr: 'Appui {deType}', en: 'Champion {aType}'}],
  ['Annihilator', 'Annihilateur', 'Annihilator', 'number', 'n', null, 2],
  ['Bushido', 'Bushido', 'Bushido', 'number', 'n', null, 1],
  ['Hideaway', 'Cachette', 'Hideaway', 'number', 'n', null, 4],
  ['Toxic', 'Toxique', 'Toxic', 'number', 'n', null, 1],
  ['Firebending', 'Maîtrise du Feu', 'Firebending', 'number', 'n', null, 1],
  ['Afterlife', 'Au-delà', 'Afterlife', 'number', 'n', null, 1],
  ['Fabricate', 'Fabrication', 'Fabricate', 'number', 'n', null, 1],
  ['Rampage', 'Sauvagerie', 'Rampage', 'number', 'n', null, 1],
  ['Modular', 'Modularité', 'Modular', 'number', 'n', null, 1],
  ['Renown', 'Réputation', 'Renown', 'number', 'n', null, 1],
  ['Bloodthirst', 'Soif de sang', 'Bloodthirst', 'number', 'n', null, 1],
  ['Dredge', 'Dragage', 'Dredge', 'number', 'n', null, 2],
  ['Fading', 'Évanescence', 'Fading', 'number', 'n', null, 3],
  ['Vanishing', 'Disparition', 'Vanishing', 'number', 'n', null, 3],
  ['Amplify', 'Amplification', 'Amplify', 'number', 'n', null, 1],
  ['Devour', 'Dévorement', 'Devour', 'number', 'n', null, 1],
  ['Devour Food', 'Dévorement de nourriture', 'Devour Food', 'number', 'n', null, 1,
    {line: 'K:Devour:{n}:Food', fr: 'Dévorement de nourriture {n}', en: 'Devour Food {n}'}],
  ['Devour Artifact', 'Dévorement d\'artefacts', 'Devour artifact', 'number', 'n', null, 1,
    {line: 'K:Devour:{n}:Artifact', fr: 'Dévorement d\'artefacts {n}', en: 'Devour artifact {n}'}],
  ['Devour Land', 'Dévorement de terrains', 'Devour land', 'number', 'n', null, 1,
    {line: 'K:Devour:{n}:Land', fr: 'Dévorement de terrains {n}', en: 'Devour land {n}'}],
  ['Graft', 'Greffe', 'Graft', 'number', 'n', null, 2],
  ['Soulshift', 'Transmigration', 'Soulshift', 'number', 'n', null, 3],
  ['Mobilize', 'Mobilisation', 'Mobilize', 'number', 'n', null, 1],
  ['Firebending', 'Maîtrise du Feu', 'Firebending', 'number', 'n', null, 1],
  ['Equip', 'Équipement', 'Equip', 'equip', 'cost', null, '{2}', {sub: 'Equipment', base: 'Artifact'}],
  ['Enchant', 'Enchanter', 'Enchant', 'equip', 'sel', null, 'Creature', {fr: 'Enchanter : {optFr}', en: 'Enchant {optEn}', sub: 'Aura', base: 'Enchantment'}],
  ['Bestow', 'Grâce', 'Bestow', 'equip', 'cost', null, '{3}{W}'],
  ['Crew', 'Pilotage', 'Crew', 'equip', 'n', null, 1, {sub: 'Vehicle', base: 'Artifact', pt: true}],
  ['Saddle', 'Seller', 'Saddle', 'equip', 'n', null, 1, {sub: 'Mount'}],
  ['Living Weapon', 'Arme vivante', 'Living weapon', 'equip', null, null, null, {sub: 'Equipment', base: 'Artifact'}],
  ['For Mirrodin', 'Pour Mirrodin !', 'For Mirrodin!', 'equip', null, null, null, {sub: 'Equipment', base: 'Artifact'}],
  ['Job select', 'Choix de job', 'Job select', 'equip', null, null, null, {sub: 'Equipment', base: 'Artifact'}],
  ['Reconfigure', 'Reconfiguration', 'Reconfigure', 'equip', 'cost', null, '{2}', {sub: 'Equipment', base: 'Artifact'}],
  ['Fortify', 'Fortification', 'Fortify', 'equip', 'cost', null, '{1}', {sub: 'Fortification', base: 'Artifact'}],
  // Station : le vaisseau spatial devient une créature-artefact à partir de N marqueurs charge (ligne « STATION N+ » écrite par buildScript).
  ['Station', 'Station', 'Station', 'equip', 'n', null, 6, {fr: 'Station', en: 'Station', sub: 'Spacecraft', base: 'Artifact', pt: true}],
  ['Umbra armor', 'Armure totémique', 'Umbra armor', 'equip', null, null, null, {sub: 'Aura', base: 'Enchantment'}],
  ['Living metal', 'Métal vivant', 'Living metal', 'equip', null],
  ['Kicker', 'Kick', 'Kicker', 'alt', 'cost', null, '{2}'],
  ['Multikicker', 'Multikick', 'Multikicker', 'alt', 'cost', null, '{1}'],
  ['Buyback', 'Rappel', 'Buyback', 'alt', 'cost', null, '{3}'],
  ['Ninjutsu', 'Ninjutsu', 'Ninjutsu', 'alt', 'cost', null, '{2}'],
  ['Dash', 'Précipitation', 'Dash', 'alt', 'cost', null, '{2}'],
  ['Blitz', 'Blitz', 'Blitz', 'alt', 'cost', null, '{2}'],
  ['Evoke', 'Évocation', 'Evoke', 'alt', 'cost', null, '{1}'],
  ['Madness', 'Folie', 'Madness', 'alt', 'cost', null, '{1}'],
  ['Morph', 'Mue', 'Morph', 'alt', 'cost', null, '{3}'],
  ['Megamorph', 'Mégamue', 'Megamorph', 'alt', 'cost', null, '{3}'],
  ['Disguise', 'Déguisement', 'Disguise', 'alt', 'cost', null, '{3}'],
  ['Echo', 'Écho', 'Echo', 'alt', 'cost', null, '{2}'],
  ['Cumulative upkeep', 'Entretien cumulatif', 'Cumulative upkeep', 'alt', 'cost', null, '{1}'],
  ['Entwine', 'Union', 'Entwine', 'alt', 'cost', null, '{2}'],
  ['Escalate', 'Intensification', 'Escalate', 'alt', 'cost', null, '{1}'],
  ['Foretell', 'Prédiction', 'Foretell', 'alt', 'cost', null, '{1}{U}'],
  ['Mutate', 'Mutation', 'Mutate', 'alt', 'cost', null, '{2}{G}'],
  ['Miracle', 'Miracle', 'Miracle', 'alt', 'cost', null, '{1}{W}'],
  ['Prowl', 'Incursion', 'Prowl', 'alt', 'cost', null, '{1}{B}'],
  ['Plot', 'Complot', 'Plot', 'alt', 'cost', null, '{2}{R}'],
  ['Offspring', 'Progéniture', 'Offspring', 'alt', 'cost', null, '{2}'],
  ['Overload', 'Surcharge', 'Overload', 'alt', 'cost', null, '{5}{U}'],
  ['Replicate', 'Duplication', 'Replicate', 'alt', 'cost', null, '{1}{U}'],
  ['Spectacle', 'Spectacle', 'Spectacle', 'alt', 'cost', null, '{1}{R}'],
  ['Squad', 'Escouade', 'Squad', 'alt', 'cost', null, '{2}'],
  ['Surge', 'Déferlement', 'Surge', 'alt', 'cost', null, '{1}{U}'],
  ['Emerge', 'Émergence', 'Emerge', 'alt', 'cost', null, '{5}{G}'],
  ['Freerunning', 'Course libre', 'Freerunning', 'alt', 'cost', null, '{1}{B}'],
  ['Strive', 'Obstination', 'Strive', 'alt', 'cost', null, '{1}{W}'],
  ['Sneak', 'Infiltration', 'Sneak', 'alt', 'cost', null, '{2}{B}'],
  ['Warp', 'Warp', 'Warp', 'alt', 'cost', null, '{1}{U}'],
  ['Web-slinging', 'Lanceur de toile', 'Web-slinging', 'alt', 'cost', null, '{1}{W}'],
  ['Transmute', 'Transmutation', 'Transmute', 'alt', 'cost', null, '{1}{U}{U}'],
  ['Transfigure', 'Transfiguration', 'Transfigure', 'alt', 'cost', null, '{1}{B}{B}'],
  ['Offering', 'Offrande', 'Offering', 'alt', 'type', null, 'Goblin', {fr: 'Offrande {deType}', en: '{Type} offering'}],
  ['Suspend', 'Suspension', 'Suspend', 'alt', 'ncost', null, {n: 3, cost: '{1}{U}'}, {line: 'K:Suspend:{n}:{cost}', fr: 'Suspension {n} — {sym}', en: 'Suspend {n}—{sym}'}],
  ['Awaken', 'Éveil', 'Awaken', 'alt', 'ncost', null, {n: 3, cost: '{4}{W}'}, {line: 'K:Awaken:{n}:{cost}', fr: 'Éveil {n} — {sym}', en: 'Awaken {n}—{sym}'}],
  ['Reinforce', 'Renfort', 'Reinforce', 'alt', 'ncost', null, {n: 1, cost: '{1}{G}'}, {line: 'K:Reinforce:{n}:{cost}', fr: 'Renfort {n} — {sym}', en: 'Reinforce {n}—{sym}'}],
  ['Impending', 'Imminence', 'Impending', 'alt', 'ncost', null, {n: 4, cost: '{2}{U}'}, {line: 'K:Impending:{n}:{cost}', fr: 'Imminence {n} — {sym}', en: 'Impending {n}—{sym}'}],
  ['Flashback', 'Flashback', 'Flashback', 'grave', 'cost', null, '{3}'],
  ['Unearth', 'Exhumation', 'Unearth', 'grave', 'cost', null, '{2}'],
  ['Embalm', 'Embaumement', 'Embalm', 'grave', 'cost', null, '{3}'],
  ['Eternalize', 'Éternalisation', 'Eternalize', 'grave', 'cost', null, '{4}'],
  ['Encore', 'Encore', 'Encore', 'grave', 'cost', null, '{5}'],
  ['Scavenge', 'Récupération', 'Scavenge', 'grave', 'cost', null, '{3}'],
  ['Harmonize', 'Harmonisation', 'Harmonize', 'grave', 'cost', null, '{4}{G}'],
  ['Mayhem', 'Désordre', 'Mayhem', 'grave', 'cost', null, '{1}{R}'],
  ['Recover', 'Recouvrement', 'Recover', 'grave', 'cost', null, '{2}{B}'],
  ['Retrace', 'Pistage', 'Retrace', 'grave', null],
  ['Jump-start', 'Relancez', 'Jump-start', 'grave', null],
  ['Escape', 'Échappée', 'Escape', 'grave', 'ncost', null, {n: 3, cost: '{2}{B}'}, {line: 'K:Escape:{cost} ExileFromGrave<{n}/Card.Other/other>',
    fr: 'Échappée — {sym}, exilez {nw} autres cartes de votre cimetière.', en: 'Escape—{sym}, Exile {nw} other cards from your graveyard.'}],
  ['Cycling', 'Recyclage', 'Cycling', 'cycling', 'cost', null, '{2}'],
  ['TypeCycling:Plains', 'Recyclage de plaine', 'Plainscycling', 'cycling', 'cost', null, '{2}'],
  ['TypeCycling:Island', 'Recyclage d\'île', 'Islandcycling', 'cycling', 'cost', null, '{2}'],
  ['TypeCycling:Swamp', 'Recyclage de marais', 'Swampcycling', 'cycling', 'cost', null, '{2}'],
  ['TypeCycling:Mountain', 'Recyclage de montagne', 'Mountaincycling', 'cycling', 'cost', null, '{2}'],
  ['TypeCycling:Forest', 'Recyclage de forêt', 'Forestcycling', 'cycling', 'cost', null, '{2}'],
  ['TypeCycling:Basic', 'Recyclage de terrain de base', 'Basic landcycling', 'cycling', 'cost', null, '{1}'],
  ['Affinity', 'Affinité', 'Affinity', 'spell', 'sel', null, 'Artifact', {fr: 'Affinité pour {optFr}', en: 'Affinity for {optEn}'}],
  ['Convoke', 'Convocation', 'Convoke', 'spell', null],
  ['Delve', 'Fouille', 'Delve', 'spell', null],
  ['Improvise', 'Improvisation', 'Improvise', 'spell', null],
  ['Storm', 'Déluge', 'Storm', 'spell', null],
  ['Gravestorm', 'Déluge de cimetière', 'Gravestorm', 'spell', null],
  ['Split second', 'Fraction de seconde', 'Split second', 'spell', null],
  ['Rebound', 'Rebond', 'Rebound', 'spell', null],
  ['Bargain', 'Négociation', 'Bargain', 'spell', null],
  ['Cipher', 'Cryptage', 'Cipher', 'spell', null],
  ['Conspire', 'Conspiration', 'Conspire', 'spell', null],
  ['Demonstrate', 'Démonstration', 'Demonstrate', 'spell', null],
  ['Epic', 'Épique', 'Epic', 'spell', null],
  ['Undaunted', 'Témérité', 'Undaunted', 'spell', null],
  ['Paradigm', 'Paradigme', 'Paradigm', 'spell', null],
  ['Casualty', 'Victime', 'Casualty', 'spell', 'n', null, 1],
  ['Ripple', 'Remous', 'Ripple', 'spell', 'n', null, 4],
  ['Splice:Arcane', 'Imprégnation d\'arcane', 'Splice onto Arcane', 'spell', 'cost', null, '{1}{U}'],
  ['Partner', 'Partenariat', 'Partner', 'multi', null],
  ['Partner with', 'Partenariat avec', 'Partner with', 'multi', 'text', null, ''],
  ['Choose a Background', 'Choisissez un passé', 'Choose a Background', 'multi', null],
  ['Doctor\'s companion', 'Compagnon du Docteur', 'Doctor\'s companion', 'multi', null],
  ['Partner:Character select', 'Partenariat — Sélection du personnage', 'Partner—Character select', 'multi', null],
  ['Assist', 'Assistance', 'Assist', 'multi', null],
];

/** Groupes des mots-clés dans le formulaire. */
export const KW_GROUPS = [
  ['combat', 'Combat et évasion'], ['protect', 'Protection'], ['ability', 'Capacités'],
  ['number', 'Avec un nombre (Annihilateur 2…)'], ['equip', 'Équipements, auras, véhicules, montures'],
  ['alt', 'Coûts alternatifs et supplémentaires (Kick, Surcharge, Suspension…)'], ['grave', 'Depuis le cimetière (Flashback, Échappée…)'],
  ['cycling', 'Recyclages'], ['spell', 'Sorts (Convocation, Déluge…)'], ['multi', 'Commander et multijoueur'],
];

const KW_BY = Object.fromEntries(KW_ALL.map(k => [k[0], k]));

/** Valeurs au choix d'un mot-clé (« Affinité pour les artefacts ») : [valeur pour Forge, français, anglais]. */
export const KW_OPTIONS = {
  Affinity: [['Artifact', 'les artefacts', 'artifacts'], ['Equipment', 'les équipements', 'Equipment'], ['Creature', 'les créatures', 'creatures'],
    ['Enchantment', 'les enchantements', 'enchantments'], ['Plains', 'les plaines', 'Plains'], ['Island', 'les îles', 'Islands'],
    ['Swamp', 'les marais', 'Swamps'], ['Mountain', 'les montagnes', 'Mountains'], ['Forest', 'les forêts', 'Forests']],
  Enchant: [['Creature', 'créature', 'creature'], ['Player', 'joueur', 'player'], ['Opponent', 'adversaire', 'opponent'], ['Creature.YouCtrl:creature you control', 'créature que vous contrôlez', 'creature you control'],
    ['Creature.OppCtrl:creature an opponent controls', 'créature qu\'un adversaire contrôle', 'creature an opponent controls'],
    ['Artifact', 'artefact', 'artifact'], ['Enchantment', 'enchantement', 'enchantment'], ['Land', 'terrain', 'land'],
    ['Land.YouCtrl:land you control', 'terrain que vous contrôlez', 'land you control'], ['Permanent', 'permanent', 'permanent'],
    ['Permanent.nonLand:nonland permanent', 'permanent non-terrain', 'nonland permanent'], ['Planeswalker', 'planeswalker', 'planeswalker'],
    ['Artifact,Creature:artifact or creature', 'artefact ou créature', 'artifact or creature']],
};

/** Mots-clés qu'on peut donner aux autres créatures (« les autres Elfes que vous contrôlez ont … »). */
export const KEYWORDS = KW_ALL.filter(k => k[5]).map(k => [k[0], k[1]]);

/** Valeur d'un mot-clé dans le formulaire (sinon sa valeur par défaut) ; un mot-clé « nombre et coût » donne son coût. */
export function keywordValue(f, k) {
  const def = KW_BY[k];
  const v = ((f && f.kwValues) || {})[k];
  if (!def || !def[4]) {
    return null;
  }
  if (def[4] === 'cost') {
    return v === undefined || v === null ? def[6] : String(v);
  }
  if (def[4] === 'ncost') {
    return v === undefined || v === null ? def[6].cost : String(v);
  }
  if (def[4] === 'sel') {
    return (KW_OPTIONS[k] || []).some(o => o[0] === v) ? v : def[6];
  }
  if (def[4] === 'text') {
    // Un nom de carte (« Partenariat avec … ») : sans ce qui casserait le script.
    return String(v || '').replace(/[|:\n]/g, ' ').trim();
  }
  if (def[4] === 'type') {
    const t = String(v ?? '').replace(/[|:\n]/g, ' ').trim();
    return t || def[6];
  }
  const n = Math.round(Number(v));
  return Number.isFinite(n) && v !== '' && v !== undefined && v !== null ? Math.max(def[4] === 'gen' ? 0 : 1, Math.min(20, n)) : def[6];
}

/** Le nombre d'un mot-clé « nombre et coût » (Suspension 3 — {1}{U}). */
export function keywordNumber(f, k) {
  const def = KW_BY[k];
  const v = ((f && f.kwValues) || {})[`${k}#n`];
  const n = Math.round(Number(v));
  return Number.isFinite(n) && v !== '' && v !== undefined && v !== null ? Math.max(1, Math.min(20, n)) : ((def && def[6] && def[6].n) || 1);
}

/** Les options d'un mot-clé : sous-type demandé, type de carte, force et endurance, ligne et texte. */
export function keywordOptions(k) {
  const def = KW_BY[k];
  return (def && def[7]) || {};
}

/**
 * Quand la capacité agit. kind : T (déclenchée), A (activée), S (statique), SP (effet du sort), CH (chapitre de saga).
 * filter : demande quelles créatures (« une de vos créatures », « un Elfe que vous contrôlez »).
 */
export const WHEN = [
  {id: 'etb', kind: 'T', label: 'Quand elle arrive sur le champ de bataille'},
  {id: 'ally', kind: 'T', label: 'Quand une de vos créatures arrive', filter: true},
  {id: 'attacks', kind: 'T', label: 'Quand elle attaque'},
  {id: 'blocks', kind: 'T', label: 'Quand elle bloque'},
  {id: 'blocked', kind: 'T', label: 'Quand elle devient bloquée'},
  {id: 'unblocked', kind: 'T', label: 'Quand elle attaque et n\'est pas bloquée'},
  {id: 'allyBlocked', kind: 'T', label: 'Quand une de vos créatures devient bloquée'},
  {id: 'unlockDoor', kind: 'T', label: 'Quand vous déverrouillez cette porte (pièce)'},
  {id: 'blocksCreature', kind: 'T', label: 'Quand elle devient bloquée par une créature (une fois par bloqueur)'},
  {id: 'becomesTarget', kind: 'T', label: 'Quand elle devient la cible d\'un sort ou d\'une capacité'},
  {id: 'becomesTargetOpp', kind: 'T', label: 'Quand elle devient la cible d\'un sort ou d\'une capacité qu\'un adversaire contrôle'},
  {id: 'untaps', kind: 'T', label: 'Quand elle se dégage'},
  {id: 'combatDamage', kind: 'T', label: 'Quand elle inflige des blessures de combat à un joueur'},
  {id: 'dealsDamage', kind: 'T', label: 'Quand elle inflige des blessures'},
  {id: 'enrage', kind: 'T', label: 'Quand elle subit des blessures (Rage)'},
  {id: 'dies', kind: 'T', label: 'Quand elle meurt'},
  {id: 'leaves', kind: 'T', label: 'Quand elle quitte le champ de bataille'},
  {id: 'tapped', kind: 'T', label: 'Quand elle s\'engage'},
  {id: 'heroic', kind: 'T', label: 'Quand vous lancez un sort qui la cible (Héroïque)'},
  {id: 'turnedUp', kind: 'T', label: 'Quand elle est retournée face visible (mue, déguisement)'},
  {id: 'castThis', kind: 'T', label: 'Quand vous lancez ce sort'},
  {id: 'attacksAlly', kind: 'T', label: 'Quand une de vos créatures attaque', filter: true},
  {id: 'youAttack', kind: 'T', label: 'Quand vous attaquez'},
  {id: 'combatDamageAlly', kind: 'T', label: 'Quand une de vos créatures inflige des blessures de combat à un joueur', filter: true},
  {id: 'combatDamageOnce', kind: 'T', label: 'Quand une ou plusieurs de vos créatures infligent des blessures de combat à un joueur'},
  {id: 'attacksYou', kind: 'T', label: 'Quand une créature vous attaque (vous ou un de vos planeswalkers)'},
  {id: 'anyEnters', kind: 'T', label: 'Quand une autre créature arrive (sous n\'importe quel contrôle)'},
  {id: 'tokenEnters', kind: 'T', label: 'Quand un jeton arrive sous votre contrôle'},
  {id: 'nontokenDies', kind: 'T', label: 'Quand une créature non-jeton que vous contrôlez meurt'},
  {id: 'artifactDies', kind: 'T', label: 'Quand un artefact que vous contrôlez est mis dans un cimetière depuis le champ de bataille'},
  {id: 'oppLandfall', kind: 'T', label: 'Quand un terrain arrive sous le contrôle d\'un adversaire'},
  {id: 'allyDies', kind: 'T', label: 'Quand une de vos créatures meurt', filter: true},
  {id: 'anyDies', kind: 'T', label: 'Quand une créature meurt (n\'importe laquelle)'},
  {id: 'oppCreatureDies', kind: 'T', label: 'Quand une créature d\'un adversaire meurt'},
  {id: 'oppCreatureEnters', kind: 'T', label: 'Quand une créature arrive sous le contrôle d\'un adversaire'},
  {id: 'landfall', kind: 'T', label: 'Quand un terrain arrive sous votre contrôle (Toucheterre)'},
  {id: 'constellation', kind: 'T', label: 'Quand un enchantement arrive sous votre contrôle (Constellation)'},
  {id: 'artifactEnters', kind: 'T', label: 'Quand un artefact arrive sous votre contrôle'},
  {id: 'entersPower', kind: 'T', label: 'Quand une créature de force X ou plus arrive sous votre contrôle', nLabel: 'Force au moins'},
  {id: 'entersMv', kind: 'T', label: 'Quand une créature, un artefact… de valeur de mana X ou plus arrive sous votre contrôle', kinds: 'perm', nLabel: 'Valeur de mana au moins'},
  {id: 'counterAdded', kind: 'T', label: 'Quand des marqueurs +1/+1 sont mis sur une de vos créatures'},
  {id: 'counterPutSelf', kind: 'T', label: 'Quand des marqueurs (d\'un type) sont mis sur elle', counterSel: true},
  {id: 'counterNth', kind: 'T', label: 'Quand le Nième marqueur (d\'un type) est mis sur elle (« le troisième marqueur « charge »… »)', counterSel: true, nth: true},
  {id: 'lastCounterRemoved', kind: 'T', label: 'Quand le dernier marqueur (d\'un type) est retiré d\'elle', counterSel: true},
  {id: 'castAny', kind: 'T', label: 'Quand vous lancez un sort'},
  {id: 'castNonCreature', kind: 'T', label: 'Quand vous lancez un sort non-créature'},
  {id: 'castCreature', kind: 'T', label: 'Quand vous lancez un sort de créature'},
  {id: 'castHistoric', kind: 'T', label: 'Quand vous lancez un sort historique (artefact, légendaire ou saga)'},
  {id: 'castKind', kind: 'T', label: 'Quand vous lancez un sort d\'un type (artefact, enchantement, légendaire, multicolore…)', kinds: 'cast'},
  {id: 'castMv', kind: 'T', label: 'Quand vous lancez un sort de valeur de mana X ou plus', nLabel: 'Valeur de mana au moins'},
  {id: 'youBend', kind: 'T', label: 'Quand vous maîtrisez l\'Eau, la Terre, le Feu ou l\'Air (ou un seul élément)', kinds: 'bend'},
  {id: 'magecraft', kind: 'T', label: 'Quand vous lancez ou copiez un éphémère ou un rituel (Sorcellerie)'},
  {id: 'secondSpell', kind: 'T', label: 'Quand vous lancez votre deuxième sort de chaque tour'},
  {id: 'oppCasts', kind: 'T', label: 'Quand un adversaire lance un sort'},
  {id: 'playerCasts', kind: 'T', label: 'Quand un joueur lance un sort'},
  {id: 'firstSpell', kind: 'T', label: 'Quand vous lancez votre premier sort de chaque tour'},
  {id: 'abilityCast', kind: 'T', label: 'Quand vous activez une capacité qui n\'est pas une capacité de mana'},
  {id: 'landPlayed', kind: 'T', label: 'Quand vous jouez un terrain'},
  {id: 'tapsForMana', kind: 'T', label: 'Quand un joueur engage un terrain pour du mana'},
  {id: 'oppDraws', kind: 'T', label: 'Quand un adversaire pioche une carte'},
  {id: 'youDiscard', kind: 'T', label: 'Quand vous vous défaussez d\'une carte'},
  {id: 'youScry', kind: 'T', label: 'Quand vous regardez (regard X)'},
  {id: 'youSurveil', kind: 'T', label: 'Quand vous surveillez'},
  {id: 'youLoseLife', kind: 'T', label: 'Quand vous perdez des points de vie'},
  {id: 'youSacCreature', kind: 'T', label: 'Quand vous sacrifiez une créature'},
  {id: 'drawCard', kind: 'T', label: 'Quand vous piochez une carte'},
  {id: 'cycle', kind: 'T', label: 'Quand vous recyclez une carte'},
  {id: 'sacrifice', kind: 'T', label: 'Quand vous sacrifiez un permanent'},
  {id: 'oppDiscards', kind: 'T', label: 'Quand un adversaire se défausse d\'une carte'},
  {id: 'lifeGain', kind: 'T', label: 'Quand vous gagnez des points de vie'},
  {id: 'oppLosesLife', kind: 'T', label: 'Quand un adversaire perd des points de vie'},
  {id: 'crime', kind: 'T', label: 'Quand vous commettez un crime'},
  {id: 'upkeep', kind: 'T', label: 'Au début de votre entretien'},
  {id: 'eachUpkeep', kind: 'T', label: 'Au début de chaque entretien'},
  {id: 'oppUpkeep', kind: 'T', label: 'Au début de l\'entretien de chaque adversaire'},
  {id: 'drawStep', kind: 'T', label: 'Au début de votre étape de pioche'},
  {id: 'main1', kind: 'T', label: 'Au début de votre phase principale précombat'},
  {id: 'beginCombat', kind: 'T', label: 'Au début du combat de votre tour'},
  {id: 'eachCombat', kind: 'T', label: 'Au début de chaque combat'},
  {id: 'main2', kind: 'T', label: 'Au début de votre phase principale postcombat'},
  {id: 'eachDraw', kind: 'T', label: 'Au début de l\'étape de pioche de chaque joueur'},
  {id: 'oppEnd', kind: 'T', label: 'Au début de l\'étape de fin de chaque adversaire'},
  {id: 'endCombat', kind: 'T', label: 'À la fin du combat de votre tour'},
  {id: 'end', kind: 'T', label: 'Au début de votre étape de fin'},
  {id: 'eachEnd', kind: 'T', label: 'Au début de chaque étape de fin'},
  // Équipements, auras, fortifications : la carte attachée (le libellé suit la carte, voir whenLabel).
  {id: 'attachedAttacks', kind: 'T', label: 'Quand la créature équipée ou enchantée attaque', attach: 'creature'},
  {id: 'attachedCombatDamage', kind: 'T', label: 'Quand la créature équipée ou enchantée inflige des blessures de combat à un joueur', attach: 'creature'},
  {id: 'attachedDies', kind: 'T', label: 'Quand la créature équipée ou enchantée meurt', attach: 'creature'},
  {id: 'becomesAttached', kind: 'T', label: 'Quand cet équipement ou cette aura devient attaché à une créature', attach: 'creature'},
  {id: 'attachedTapped', kind: 'T', label: 'Quand le permanent enchanté ou fortifié devient engagé', attach: 'permanent'},
  // Malédictions (aura qui enchante un joueur).
  {id: 'ePlayerUpkeep', kind: 'T', label: 'Au début de l\'entretien du joueur enchanté', attach: 'player'},
  {id: 'ePlayerEnd', kind: 'T', label: 'Au début de l\'étape de fin du joueur enchanté', attach: 'player'},
  {id: 'ePlayerAttacked', kind: 'T', label: 'Quand le joueur enchanté est attaqué', attach: 'player'},
  {id: 'ePlayerCasts', kind: 'T', label: 'Quand le joueur enchanté lance un sort', attach: 'player'},
  {id: 'ePlayerDraws', kind: 'T', label: 'Quand le joueur enchanté pioche une carte', attach: 'player'},
  {id: 'ePlayerCreature', kind: 'T', label: 'Quand une créature arrive sous le contrôle du joueur enchanté', attach: 'player'},
  {id: 'activated', kind: 'A', label: 'Capacité activée (coût : effet)', cost: true},
  {id: 'loyalty', kind: 'A', label: 'Capacité de loyauté (planeswalker)', loyalty: true},
  {id: 'spell', kind: 'SP', label: 'Effet du sort (éphémère, rituel)'},
  {id: 'chapter', kind: 'CH', label: 'Chapitre de saga (I, II, III…)'},
  {id: 'static', kind: 'S', label: 'Effet permanent (« les créatures que vous contrôlez ont… », « vous n\'avez pas de taille maximale de main »…)', filter: true},
];

/**
 * Types pour « quand vous lancez un sort d'un type » ('cast') et « quand un permanent de valeur de mana N ou plus arrive »
 * ('perm') : [id, libellé, type pour Forge, « un sort … » / « un … », en anglais].
 */
export const WHEN_KINDS = {
  cast: [
    ['artifact', 'Artefact', 'Artifact', 'un sort d\'artefact', 'an artifact spell'],
    ['enchantment', 'Enchantement', 'Enchantment', 'un sort d\'enchantement', 'an enchantment spell'],
    ['legendary', 'Légendaire', 'Card.Legendary', 'un sort légendaire', 'a legendary spell'],
    ['multicolor', 'Multicolore', 'Card.MultiColor', 'un sort multicolore', 'a multicolored spell'],
    ['colorless', 'Incolore', 'Card.Colorless', 'un sort incolore', 'a colorless spell'],
    ['instantSorcery', 'Éphémère ou rituel', 'Instant,Sorcery', 'un sort d\'éphémère ou de rituel', 'an instant or sorcery spell'],
    ['planeswalker', 'Planeswalker', 'Planeswalker', 'un sort de planeswalker', 'a planeswalker spell'],
    ['kindred', 'Tribal (de clan)', 'Kindred', 'un sort de clan', 'a kindred spell'],
  ],
  perm: [
    ['creature', 'Créature', 'Creature', 'une créature', 'a creature'],
    ['artifact', 'Artefact', 'Artifact', 'un artefact', 'an artifact'],
    ['enchantment', 'Enchantement', 'Enchantment', 'un enchantement', 'an enchantment'],
    ['planeswalker', 'Planeswalker', 'Planeswalker', 'un planeswalker', 'a planeswalker'],
    ['nonland', 'Permanent non-terrain', 'Permanent.nonLand', 'un permanent non-terrain', 'a nonland permanent'],
  ],
};

WHEN_KINDS.bend = [
  ['any', 'L\'Eau, la Terre, le Feu ou l\'Air', 'ElementalBend', 'l\'Eau, la Terre, le Feu ou l\'Air', 'waterbend, earthbend, firebend, or airbend'],
  ['water', 'L\'Eau', 'Waterbend', 'l\'Eau', 'waterbend'], ['earth', 'La Terre', 'Earthbend', 'la Terre', 'earthbend'],
  ['fire', 'Le Feu', 'Firebend', 'le Feu', 'firebend'], ['air', 'L\'Air', 'Airbend', 'l\'Air', 'airbend'],
];

/**
 * Ce que « deviennent des créatures N/N » touche : [id, libellé, type pour Forge, « les … » (pluriel), en anglais].
 * Artefacts et enchantements : seulement ceux qui ne sont pas déjà des créatures.
 */
export const ANIM_KINDS = [
  ['lands', 'Terrains', 'Land', 'les terrains', 'lands'],
  ['artifacts', 'Artefacts non-créatures', 'Artifact.nonCreature', 'les artefacts non-créatures', 'noncreature artifacts'],
  ['enchantments', 'Enchantements non-créatures', 'Enchantment.nonCreature', 'les enchantements non-créatures', 'noncreature enchantments'],
  ['noncreature', 'Permanents non-créatures', 'Permanent.nonCreature', 'les permanents non-créatures', 'noncreature permanents'],
];

/** « Explorer », « comploter », « endurer » : qui le fait. */
export const MECH_WHO = [['self', 'Elle (cette carte)'], ['target', 'Une créature ciblée que vous contrôlez'], ['two', 'Jusqu\'à deux créatures ciblées que vous contrôlez'],
  ['each', 'Chaque créature que vous contrôlez']];

/** Ce qui gagne « {T} : Ajoutez un mana de la couleur de votre choix » : [id, libellé, type pour Forge, « Les … », anglais]. */
export const MANA_KINDS = [['lands', 'Terrains', 'Land', 'Les terrains', 'Lands'], ['creatures', 'Créatures', 'Creature', 'Les créatures', 'Creatures'],
  ['artifacts', 'Artefacts', 'Artifact', 'Les artefacts', 'Artifacts'], ['nonland', 'Permanents non-terrain', 'Permanent.nonLand', 'Les permanents non-terrain', 'Nonland permanents']];

/** Pluriel ciblé et « chaque … » de chaque type de PERM_TYPES : [fr ciblés, en, chaque (fr), each (en)]. */
const PERM_PLURAL = {
  creature: ['créatures ciblées', 'target creatures', 'chaque créature', 'each creature'],
  oppCreature: ['créatures ciblées que vos adversaires contrôlent', 'target creatures your opponents control', 'chaque créature qu\'un adversaire contrôle',
    'each creature an opponent controls'],
  artifact: ['artefacts ciblés', 'target artifacts', 'chaque artefact', 'each artifact'],
  enchantment: ['enchantements ciblés', 'target enchantments', 'chaque enchantement', 'each enchantment'],
  artEnch: ['artefacts et enchantements ciblés', 'target artifacts and/or enchantments', 'chaque artefact et chaque enchantement', 'each artifact and each enchantment'],
  land: ['terrains ciblés', 'target lands', 'chaque terrain', 'each land'],
  nonbasicLand: ['terrains non-base ciblés', 'target nonbasic lands', 'chaque terrain non-base', 'each nonbasic land'],
  planeswalker: ['planeswalkers ciblés', 'target planeswalkers', 'chaque planeswalker', 'each planeswalker'],
  creaturePw: ['créatures et planeswalkers ciblés', 'target creatures and/or planeswalkers', 'chaque créature et chaque planeswalker', 'each creature and each planeswalker'],
  nonland: ['permanents non-terrain ciblés', 'target nonland permanents', 'chaque permanent non-terrain', 'each nonland permanent'],
  oppNonland: ['permanents non-terrain ciblés que vos adversaires contrôlent', 'target nonland permanents your opponents control',
    'chaque permanent non-terrain qu\'un adversaire contrôle', 'each nonland permanent an opponent controls'],
  permanent: ['permanents ciblés', 'target permanents', 'chaque permanent', 'each permanent'],
  token: ['jetons ciblés', 'target tokens', 'chaque jeton', 'each token'],
  oppPermanent: ['permanents ciblés que vos adversaires contrôlent', 'target permanents your opponents control', 'chaque permanent qu\'un adversaire contrôle',
    'each permanent an opponent controls'],
  oppArtifact: ['artefacts ciblés que vos adversaires contrôlent', 'target artifacts your opponents control', 'chaque artefact qu\'un adversaire contrôle',
    'each artifact an opponent controls'],
  oppEnchantment: ['enchantements ciblés que vos adversaires contrôlent', 'target enchantments your opponents control',
    'chaque enchantement qu\'un adversaire contrôle', 'each enchantment an opponent controls'],
  oppArtEnch: ['artefacts et enchantements ciblés que vos adversaires contrôlent', 'target artifacts and/or enchantments your opponents control',
    'chaque artefact et chaque enchantement qu\'un adversaire contrôle', 'each artifact and each enchantment an opponent controls'],
  oppLand: ['terrains ciblés que vos adversaires contrôlent', 'target lands your opponents control', 'chaque terrain qu\'un adversaire contrôle',
    'each land an opponent controls'],
  oppPlaneswalker: ['planeswalkers ciblés que vos adversaires contrôlent', 'target planeswalkers your opponents control',
    'chaque planeswalker qu\'un adversaire contrôle', 'each planeswalker an opponent controls'],
  oppToken: ['jetons ciblés que vos adversaires contrôlent', 'target tokens your opponents control', 'chaque jeton qu\'un adversaire contrôle',
    'each token an opponent controls'],
};

/** Un type de Forge (« Artifact,Enchantment ») avec une propriété en plus (« cmcLE3 ») sur chacune de ses parties. */
function withProp(valid, prop) {
  return valid.split(',').map(v => `${v}${v.includes('.') ? '+' : '.'}${prop}`).join(',');
}

/** Qui explore, complote ou endure : [paramètres de Forge, sujet fr, sujet en, pluriel]. */
function mechWhoOf(a) {
  const who = MECH_WHO.some(w => w[0] === a.mechWho) ? a.mechWho : a.when === 'spell' ? 'target' : 'self';
  const tgt = 'ValidTgts$ Creature.YouCtrl | TgtPrompt$ Choisissez une créature ciblée que vous contrôlez';
  switch (who) {
    case 'target': return [tgt, 'une créature ciblée que vous contrôlez', 'target creature you control', false];
    case 'two': return [`${tgt} | TargetMin$ 0 | TargetMax$ 2`, 'jusqu\'à deux créatures ciblées que vous contrôlez', 'up to two target creatures you control', true];
    case 'each': return ['Defined$ Valid Creature.YouCtrl', 'chaque créature que vous contrôlez', 'each creature you control', false];
    default: return ['Defined$ Self', 'CARDNAME', 'CARDNAME', false];
  }
}

/** « Maîtriser l'Air » : sur quoi. */
export const AIR_KINDS = [['creature', 'Créatures', 'Creature', 'créature ciblée', 'créatures ciblées', 'creature'],
  ['nonland', 'Permanents non-terrains', 'Permanent.nonLand', 'permanent non-terrain ciblé', 'permanents non-terrains ciblés', 'nonland permanent']];

/** Partie commune de « deviennent / sont des créatures N/N » : [Affected$ pour Forge, Types, sujet fr, sujet en, « Élémental », Elemental]. */
function animParts(a) {
  const k = ANIM_KINDS.find(x => x[0] === a.animKind) || ANIM_KINDS[0];
  const t = typeName(a.animType);
  const v = `${k[2]}${k[2].includes('.') ? '+' : '.'}YouCtrl`;
  return {v, t, fr: `${k[3]} que vous contrôlez`, en: `${k[4]} you control`, tFr: t ? ` ${frType(a.animType)}` : '', tEn: t ? ` ${t}` : ''};
}

/** Le type choisi pour un déclencheur à type (le premier par défaut). */
export function whenKindOf(w, id) {
  const list = WHEN_KINDS[w && w.kinds] || [];
  return list.find(k => k[0] === id) || list[0];
}

/** Groupes du choix « quand » dans le formulaire. */
export const WHEN_GROUPS = [['T', 'Déclenchée (quand…)'], ['A', 'Activée'], ['SP', 'Sort'], ['CH', 'Saga'], ['S', 'Permanente']];

/** Les chapitres d'une capacité de saga : du chapitre « chapter » jusqu'à « chapterTo » (« I, II — »). */
export function chaptersOf(a) {
  const k = Math.max(1, Math.min(6, Math.round(Number(a.chapter) || 1)));
  const to = Math.max(k, Math.min(6, Math.round(Number(a.chapterTo) || k)));
  return Array.from({length: to - k + 1}, (_, i) => k + i);
}

/** Chapitres d'une saga : I à VI. */
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

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
 * « quand » ; self : agit sur la carte elle-même (pas pour un sort) ; mana : demande une couleur de mana ; pt : demande
 * un type de permanent (PERM_TYPES) ; ct : un type de carte (CARD_KINDS) ; counter : un type de marqueur ; emblem : un
 * effet d'emblème ; scope : un effet permanent sur des créatures choisies (SCOPES) ; spellType : un type de sort ;
 * amountSel : un nombre X à choisir (force et endurance égales à X).
 */
export const EFFECTS = [
  {id: 'damageAny', group: 'life', label: 'Blessures à n\'importe quelle cible', n: true},
  {id: 'damageCreature', group: 'life', label: 'Blessures à une créature ciblée', n: true},
  {id: 'damageBlocker', group: 'life', label: 'Blessures à la créature qui la bloque ou qu\'elle bloque', n: true,
    only: ['blocksCreature', 'blocked', 'blocks', 'allyBlocked']},
  {id: 'damageOpponents', group: 'life', label: 'Blessures à chaque adversaire', n: true},
  {id: 'damageEachCreature', group: 'life', label: 'Blessures à chaque créature', n: true},
  {id: 'damageEachOppCreature', group: 'life', label: 'Blessures à chaque créature que vos adversaires contrôlent', n: true},
  {id: 'earthquake', group: 'life', label: 'Blessures à chaque créature sans le vol et à chaque joueur', n: true},
  {id: 'gainLife', group: 'life', label: 'Gagner des points de vie', n: true},
  {id: 'loseLifeYou', group: 'life', label: 'Vous perdez des points de vie', n: true},
  {id: 'drain', group: 'life', label: 'Chaque adversaire perd des PV, vous les gagnez', n: true},
  {id: 'fog', group: 'life', label: 'Prévenir toutes les blessures de combat ce tour-ci (brouillard)'},
  {id: 'preventDamage', group: 'life', label: 'Prévenir les X prochaines blessures infligées à une cible ce tour-ci', n: true},
  {id: 'poison', group: 'life', label: 'Chaque adversaire reçoit des marqueurs poison', n: true},
  {id: 'energy', group: 'life', label: 'Vous obtenez de l\'énergie ({E})', n: true},
  {id: 'experience', group: 'life', label: 'Vous gagnez des marqueurs « expérience »', n: true},
  {id: 'draw', group: 'cards', label: 'Piocher des cartes', n: true},
  {id: 'drawEach', group: 'cards', label: 'Chaque joueur pioche des cartes', n: true},
  {id: 'loot', group: 'cards', label: 'Piocher puis se défausser (autant)', n: true},
  {id: 'rummage', group: 'cards', label: 'Se défausser puis piocher (autant)', n: true},
  {id: 'wheel', group: 'cards', label: 'Chaque joueur se défausse de sa main puis pioche X cartes', n: true},
  {id: 'dig', group: 'cards', label: 'Regarder les X cartes du dessus, en garder une en main', n: true},
  {id: 'digTyped', group: 'cards', label: 'Révéler les X cartes du dessus, en garder une d\'un type en main', n: true, ct: true},
  {id: 'impulse', group: 'cards', label: 'Exiler les X cartes du dessus, les jouer jusqu\'à votre prochain tour', n: true},
  {id: 'scry', group: 'cards', label: 'Regard', n: true},
  {id: 'surveil', group: 'cards', label: 'Surveiller', n: true},
  {id: 'mill', group: 'cards', label: 'Meuler (vous)', n: true},
  {id: 'millOpponents', group: 'cards', label: 'Chaque adversaire meule', n: true},
  {id: 'discard', group: 'cards', label: 'Chaque adversaire se défausse de cartes', n: true},
  {id: 'thoughtseize', group: 'cards', label: 'Un joueur ciblé révèle sa main, vous choisissez une carte non-terrain qu\'il défausse'},
  {id: 'tutor', group: 'cards', label: 'Chercher une carte dans la bibliothèque (main)'},
  {id: 'tutorTyped', group: 'cards', label: 'Chercher une carte d\'un type dans la bibliothèque (main)', ct: true},
  {id: 'tutorBattlefield', group: 'cards', label: 'Chercher une carte d\'un type et la mettre sur le champ de bataille', ct: true},
  {id: 'regrowth', group: 'cards', label: 'Renvoyer une créature du cimetière en main'},
  {id: 'regrowthTyped', group: 'cards', label: 'Renvoyer une carte d\'un type du cimetière en main', ct: true},
  {id: 'putFromHand', group: 'cards', label: 'Mettre une carte d\'un type de votre main sur le champ de bataille (sans payer son coût)', ct: true},
  {id: 'castFree', group: 'cards', label: 'Lancer un sort de votre main de valeur de mana X ou moins sans payer son coût de mana', n: true},
  {id: 'reanimateTyped', group: 'cards', label: 'Renvoyer une carte d\'un type de votre cimetière sur le champ de bataille', ct: true},
  {id: 'playHideaway', group: 'cards', label: 'Jouer la carte exilée par Cachette sans payer son coût de mana'},
  {id: 'castFromGraveyard', group: 'cards', label: 'Lancer un éphémère ou un rituel ciblé de votre cimetière sans payer son coût'},
  {id: 'digUntil', group: 'cards', label: 'Révéler jusqu\'à une carte d\'un type, la mettre en main', ct: true},
  {id: 'reanimate', group: 'cards', label: 'Renvoyer une créature du cimetière sur le champ de bataille'},
  {id: 'shuffleGraveyard', group: 'cards', label: 'Mélanger votre cimetière dans votre bibliothèque'},
  {id: 'exileGraveyard', group: 'cards', label: 'Exiler le cimetière d\'un joueur ciblé'},
  {id: 'countersSelf', group: 'creatures', label: 'Marqueurs sur cette créature (+1/+1 ou autre)', n: true, counter: true},
  {id: 'countersEach', group: 'creatures', label: 'Marqueurs sur chaque créature choisie (chaque Elfe, chaque autre…)', n: true, filter: true, counter: true},
  {id: 'countersTarget', group: 'creatures', label: 'Marqueurs sur une créature ciblée (+1/+1, -1/-1, bouclier…)', n: true, counter: true},
  {id: 'countersAttached', group: 'creatures', label: 'Marqueurs sur la créature équipée ou enchantée (équipement, aura)', n: true, counter: true, attach: 'creature'},
  {id: 'countersPermTarget', group: 'creatures', label: 'Marqueurs sur un permanent ciblé d\'un type (artefact, terrain…)', n: true, counter: true, pt: true},
  {id: 'removeCountersSelf', group: 'creatures', label: 'Retirer des marqueurs de cette carte', n: true, counter: true},
  {id: 'removeCountersTarget', group: 'creatures', label: 'Retirer des marqueurs d\'un permanent ciblé', n: true, counter: true, pt: true},
  {id: 'proliferate', group: 'creatures', label: 'Proliférer'},
  {id: 'doubleCountersTarget', group: 'creatures', label: 'Doubler les marqueurs (d\'un type) sur une créature ciblée', counter: true},
  {id: 'moveCounters', group: 'creatures', label: 'Déplacer des marqueurs de cette carte sur une autre créature ciblée', n: true, counter: true},
  {id: 'removeAllCounters', group: 'creatures', label: 'Retirer tous les marqueurs (d\'un type) de toutes les créatures', counter: true},
  {id: 'animateSelf', group: 'creatures', label: 'Elle devient une créature X/X jusqu\'à la fin du tour (terrain, artefact…)', n: true},
  {id: 'animateTarget', group: 'creatures', label: 'Une créature ciblée a une force et une endurance de base X/X jusqu\'à la fin du tour', n: true},
  {id: 'animateLands', group: 'creatures', label: 'Les terrains que vous contrôlez deviennent des créatures X/X jusqu\'à la fin du tour', n: true},
  {id: 'animateAll', group: 'creatures', label: 'Vos terrains, artefacts, enchantements… deviennent des créatures X/X (d\'un type, au choix), jusqu\'à la fin du tour ou pour toujours', n: true, anim: true},
  {id: 'doubleCountersAll', group: 'creatures', label: 'Doubler les marqueurs (de chaque type, ou d\'un type) sur chaque créature', counterEach: true},
  {id: 'protectionTarget', group: 'creatures', label: 'Une créature ciblée que vous contrôlez acquiert la protection contre la couleur de votre choix'},
  {id: 'protectionAll', group: 'creatures', label: 'Les créatures que vous contrôlez acquièrent la protection contre la couleur de votre choix'},
  {id: 'debuffTarget', group: 'creatures', label: 'Une créature ciblée perd un mot-clé jusqu\'à la fin du tour (le vol…)', keyword: true},
  {id: 'regenerateTarget', group: 'creatures', label: 'Régénérer une créature ciblée'},
  {id: 'mustBlock', group: 'creatures', label: 'Une créature ciblée bloque cette créature ce tour-ci si elle le peut'},
  {id: 'removeFromCombat', group: 'creatures', label: 'Retirer du combat une créature attaquante ou bloqueuse ciblée'},
  {id: 'endure', group: 'creatures', label: 'Endurer X : elle, une ou deux créatures ciblées, ou chaque créature (marqueurs +1/+1 ou un jeton Esprit X/X)', n: true, mechWho: true},
  {id: 'sacrificeEndStep', group: 'creatures', label: 'La sacrifier au début de la prochaine étape de fin', self: true},
  {id: 'exileEndStep', group: 'creatures', label: 'L\'exiler au début de la prochaine étape de fin', self: true},
  {id: 'flicker', group: 'creatures', label: 'Exiler une créature ciblée que vous contrôlez, puis la renvoyer sur le champ de bataille'},
  {id: 'flickerEnd', group: 'creatures', label: 'Exiler une créature ciblée, la renvoyer au début de la prochaine étape de fin'},
  {id: 'attachSelf', group: 'creatures', label: 'Attacher cet équipement ou cette aura à une créature ciblée que vous contrôlez', attach: 'creature'},
  {id: 'pumpSelf', group: 'creatures', label: 'Elle gagne +X/+X jusqu\'à la fin du tour', n: true, self: true},
  {id: 'pumpTarget', group: 'creatures', label: '+X/+X à une créature ciblée jusqu\'à la fin du tour', n: true},
  {id: 'shrinkTarget', group: 'creatures', label: '-X/-X à une créature ciblée jusqu\'à la fin du tour', n: true},
  {id: 'pumpAll', group: 'creatures', label: 'Les créatures choisies gagnent +X/+X jusqu\'à la fin du tour', n: true, filter: true},
  {id: 'shrinkOpp', group: 'creatures', label: 'Les créatures adverses gagnent -X/-X jusqu\'à la fin du tour', n: true},
  {id: 'grantKeywordTurn', group: 'creatures', label: 'Les créatures choisies gagnent un mot-clé jusqu\'à la fin du tour', filter: true, keyword: true},
  {id: 'keywordTarget', group: 'creatures', label: 'Une créature ciblée gagne un mot-clé jusqu\'à la fin du tour', keyword: true},
  {id: 'unblockableTarget', group: 'creatures', label: 'Une créature ciblée ne peut pas être bloquée ce tour-ci'},
  {id: 'regenerate', group: 'creatures', label: 'Régénération (la régénérer)', self: true},
  {id: 'token', group: 'creatures', label: 'Créer des jetons', n: true, token: true},
  {id: 'cloneToken', group: 'creatures', label: 'Créer un jeton copie d\'une créature ciblée'},
  {id: 'populate', group: 'creatures', label: 'Peupler (copier un jeton de créature)'},
  {id: 'monstrosity', group: 'creatures', label: 'Monstruosité X', n: true, self: true},
  {id: 'adapt', group: 'creatures', label: 'Adapter X', n: true, self: true},
  {id: 'bolster', group: 'creatures', label: 'Renforcement X', n: true},
  {id: 'support', group: 'creatures', label: 'Soutenir X', n: true},
  {id: 'bite', group: 'creatures', label: 'Votre créature ciblée inflige des blessures égales à sa force à une créature ciblée'},
  {id: 'untapAllYours', group: 'creatures', label: 'Dégager toutes les créatures que vous contrôlez'},
  {id: 'sacrificeSelf', group: 'creatures', label: 'La sacrifier', self: true},
  {id: 'destroy', group: 'removal', label: 'Détruire une créature ciblée'},
  {id: 'destroyPermanent', group: 'removal', label: 'Détruire un permanent non-terrain ciblé'},
  {id: 'destroyArtEnch', group: 'removal', label: 'Détruire un artefact ou un enchantement ciblé'},
  {id: 'destroyOpp', group: 'removal', label: 'Détruire une créature (ou un permanent, un artefact…) ciblé qu\'un adversaire contrôle', pt: 'opp'},
  {id: 'destroyTyped', group: 'removal', label: 'Détruire un permanent ciblé d\'un type (artefact, terrain, planeswalker…)', pt: true},
  {id: 'wrath', group: 'removal', label: 'Détruire toutes les créatures'},
  {id: 'destroyAllTyped', group: 'removal', label: 'Détruire tous les permanents d\'un type (au choix)', pt: true},
  {id: 'destroyN', group: 'removal', label: 'Détruire X permanents ciblés d\'un type', n: true, pt: true},
  {id: 'destroyMv', group: 'removal', label: 'Détruire chaque permanent d\'un type de valeur de mana X ou moins', n: true, pt: true},
  {id: 'edict', group: 'removal', label: 'Chaque adversaire sacrifie une créature'},
  {id: 'sacrificeEach', group: 'removal', label: 'Chaque joueur sacrifie une créature'},
  {id: 'exile', group: 'removal', label: 'Exiler une créature ciblée'},
  {id: 'exileOpp', group: 'removal', label: 'Exiler une créature (ou un permanent, un artefact…) ciblé qu\'un adversaire contrôle', pt: 'opp'},
  {id: 'exileTyped', group: 'removal', label: 'Exiler un permanent ciblé d\'un type (au choix)', pt: true},
  {id: 'exileAllTyped', group: 'removal', label: 'Exiler tous les permanents d\'un type (au choix)', pt: true},
  {id: 'exileN', group: 'removal', label: 'Exiler X permanents ciblés d\'un type', n: true, pt: true},
  {id: 'exileMv', group: 'removal', label: 'Exiler chaque permanent d\'un type de valeur de mana X ou moins', n: true, pt: true},
  {id: 'bounce', group: 'removal', label: 'Renvoyer une créature ciblée dans la main'},
  {id: 'bounceTyped', group: 'removal', label: 'Renvoyer un permanent ciblé d\'un type dans la main', pt: true},
  {id: 'bounceOpp', group: 'removal', label: 'Renvoyer dans la main une créature (ou un permanent…) ciblé qu\'un adversaire contrôle', pt: 'opp'},
  {id: 'bounceAllTyped', group: 'removal', label: 'Renvoyer tous les permanents d\'un type dans la main', pt: true},
  {id: 'tuck', group: 'removal', label: 'Mettre un permanent ciblé au-dessous de la bibliothèque', pt: true},
  {id: 'tuckTop', group: 'removal', label: 'Mettre un permanent ciblé au-dessus de la bibliothèque de son propriétaire', pt: true},
  {id: 'exileUntilLeaves', group: 'removal', label: 'Exiler un permanent ciblé jusqu\'à ce que cette carte quitte le champ de bataille', pt: true},
  {id: 'sacrificeAllYours', group: 'removal', label: 'Sacrifier tous les permanents d\'un type que vous contrôlez', pt: true},
  {id: 'phaseOut', group: 'removal', label: 'Une créature ciblée passe hors phase'},
  {id: 'detain', group: 'removal', label: 'Détenir un permanent non-terrain ciblé qu\'un adversaire contrôle'},
  {id: 'fight', group: 'removal', label: 'Se battre contre une créature adverse ciblée', self: true},
  {id: 'fightTargets', group: 'removal', label: 'Une créature ciblée que vous contrôlez se bat contre une créature ciblée que vous ne contrôlez pas'},
  {id: 'counterSpell', group: 'removal', label: 'Contrecarrer un sort ciblé'},
  {id: 'counterCreature', group: 'removal', label: 'Contrecarrer un sort de créature ciblé'},
  {id: 'counterNonCreature', group: 'removal', label: 'Contrecarrer un sort non-créature ciblé'},
  {id: 'counterUnless', group: 'removal', label: 'Contrecarrer un sort ciblé à moins que son contrôleur ne paie {X}', n: true},
  {id: 'counterAbility', group: 'removal', label: 'Contrecarrer une capacité activée ou déclenchée ciblée'},
  {id: 'tap', group: 'control', label: 'Engager une créature ciblée'},
  {id: 'tapOrUntap', group: 'control', label: 'Engager ou dégager un permanent ciblé'},
  {id: 'exchangeControlSelf', group: 'control', label: 'Échanger le contrôle de cette carte contre celui d\'une créature ciblée qu\'un adversaire contrôle'},
  {id: 'untap', group: 'control', label: 'Dégager un permanent ciblé'},
  {id: 'tapAllOpp', group: 'control', label: 'Engager toutes les créatures que vos adversaires contrôlent'},
  {id: 'cantBlockOpp', group: 'control', label: 'Les créatures adverses ne peuvent pas bloquer ce tour-ci'},
  {id: 'threaten', group: 'control', label: 'Prendre le contrôle d\'une créature jusqu\'à la fin du tour'},
  {id: 'gainControl', group: 'control', label: 'Acquérir le contrôle d\'un permanent ciblé (pour toujours)', pt: true},
  {id: 'goad', group: 'control', label: 'Inciter une créature ciblée'},
  {id: 'addMana', group: 'mana', label: 'Ajouter du mana', n: true, mana: true, only: ['activated', 'loyalty', 'spell']},
  {id: 'rampLand', group: 'mana', label: 'Chercher un terrain de base, sur le champ de bataille engagé'},
  {id: 'rampTwo', group: 'mana', label: 'Chercher jusqu\'à deux terrains de base, sur le champ de bataille engagés'},
  {id: 'landFromHand', group: 'mana', label: 'Mettre une carte de terrain de votre main sur le champ de bataille'},
  {id: 'damagePlayer', group: 'players', label: 'Blessures à un joueur ou un planeswalker ciblé', n: true},
  {id: 'damageOpponent', group: 'players', label: 'Blessures à un adversaire ciblé', n: true},
  {id: 'targetLoseLife', group: 'players', label: 'Un joueur ciblé perd des points de vie', n: true},
  {id: 'drainTarget', group: 'players', label: 'Un joueur ciblé perd des PV, vous les gagnez', n: true},
  {id: 'targetGainLife', group: 'players', label: 'Un joueur ciblé gagne des points de vie', n: true},
  {id: 'targetDraw', group: 'players', label: 'Un joueur ciblé pioche des cartes', n: true},
  {id: 'targetDiscard', group: 'players', label: 'Un joueur ciblé se défausse de cartes', n: true},
  {id: 'targetMill', group: 'players', label: 'Un joueur ciblé meule des cartes', n: true},
  {id: 'targetSacrifice', group: 'players', label: 'Un joueur ciblé sacrifie une créature'},
  {id: 'targetPoison', group: 'players', label: 'Un joueur ciblé reçoit des marqueurs poison', n: true},
  {id: 'targetRadiation', group: 'players', label: 'Un joueur ciblé gagne des marqueurs « radiation »', n: true},
  {id: 'targetRevealHand', group: 'players', label: 'Un joueur ciblé révèle sa main'},
  {id: 'lookHand', group: 'players', label: 'Regarder la main d\'un joueur ciblé'},
  {id: 'targetDiscardHand', group: 'players', label: 'Un joueur ciblé se défausse de sa main'},
  {id: 'targetDiscardRandom', group: 'players', label: 'Un joueur ciblé se défausse de cartes au hasard', n: true},
  {id: 'targetExileTop', group: 'players', label: 'Exiler les X cartes du dessus de la bibliothèque d\'un joueur ciblé', n: true},
  {id: 'targetSacrificeType', group: 'players', label: 'Un joueur ciblé sacrifie un permanent d\'un type (artefact, enchantement, terrain…)', sacKind: true},
  {id: 'playerCreaturesDebuff', group: 'players', label: 'Les créatures que contrôle un joueur ciblé gagnent -X/-X jusqu\'à la fin du tour', n: true},
  {id: 'playerTapAll', group: 'players', label: 'Engager toutes les créatures que contrôle un joueur ciblé'},
  {id: 'playerDestroyAll', group: 'players', label: 'Détruire toutes les créatures que contrôle un joueur ciblé'},
  {id: 'targetToken', group: 'players', label: 'Un joueur ciblé crée des jetons (cadeau à un adversaire…)', n: true, token: true},
  {id: 'targetMonarch', group: 'players', label: 'Un joueur ciblé devient le monarque'},
  {id: 'targetSetLife', group: 'players', label: 'Le total de points de vie d\'un joueur ciblé devient X', n: true},
  {id: 'exchangeLife', group: 'players', label: 'Échanger votre total de points de vie contre celui d\'un adversaire ciblé'},
  {id: 'targetSkipTurn', group: 'players', label: 'Un joueur ciblé passe son prochain tour'},
  {id: 'targetLoseGame', group: 'players', label: 'Un joueur ciblé perd la partie'},
  {id: 'silence', group: 'players', label: 'Vos adversaires ne peuvent pas lancer de sorts ce tour-ci'},
  {id: 'extraTurn', group: 'turns', label: 'Jouer un tour supplémentaire après celui-ci'},
  {id: 'extraCombat', group: 'turns', label: 'Une phase de combat supplémentaire après cette phase principale'},
  {id: 'extraLandTurn', group: 'turns', label: 'Vous pouvez jouer un terrain supplémentaire ce tour-ci'},
  {id: 'endTurn', group: 'turns', label: 'Terminer le tour'},
  {id: 'flipCoin', group: 'turns', label: 'Jouer à pile ou face (si vous gagnez : le premier « Et puis », si vous perdez : le second)'},
  {id: 'copySpell', group: 'turns', label: 'Copier un sort d\'éphémère ou de rituel ciblé'},
  {id: 'emblem', group: 'turns', label: 'Obtenir un emblème (effet permanent pour toute la partie)', emblem: true},
  {id: 'winGame', group: 'turns', label: 'Gagner la partie'},
  {id: 'discover', group: 'mech', label: 'Découvrir X', n: true},
  {id: 'explore', group: 'mech', label: 'Explorer : elle, une ou deux créatures ciblées, ou chaque créature', mechWho: true},
  {id: 'earthbend', group: 'mech', label: 'Maîtriser la Terre X (un terrain que vous contrôlez devient une créature 0/0 avec la célérité et X marqueurs +1/+1)', n: true},
  {id: 'airbend', group: 'mech', label: 'Maîtriser l\'Air sur une créature (ou un permanent) ciblée : exilée, son propriétaire peut la relancer pour {2}', n: true, airKind: true},
  {id: 'connive', group: 'mech', label: 'Comploter : elle, une ou deux créatures ciblées, ou chaque créature', mechWho: true},
  {id: 'investigate', group: 'mech', label: 'Enquêter (jetons Indice)', n: true},
  {id: 'incubate', group: 'mech', label: 'Incuber X', n: true},
  {id: 'manifest', group: 'mech', label: 'Manifester la carte du dessus de votre bibliothèque'},
  {id: 'transform', group: 'mech', label: 'La transformer (carte recto verso : elle passe sur son autre face)', self: true},
  {id: 'prepareSelf', group: 'mech', label: 'La préparer (carte préparée : on peut lancer une copie de son sort)', self: true},
  {id: 'suspectSelf', group: 'mech', label: 'La suspecter (elle a la menace et ne peut pas bloquer)', self: true},
  {id: 'suspectTarget', group: 'mech', label: 'Suspecter une créature ciblée (menace, ne peut pas bloquer)'},
  {id: 'cloak', group: 'mech', label: 'Voiler la carte du dessus de votre bibliothèque (2/2 face cachée avec la défense talismanique)'},
  {id: 'manifestDread', group: 'mech', label: 'Manifester l\'effroi'},
  {id: 'amass', group: 'mech', label: 'Amasser des Orques', n: true},
  {id: 'ringTempts', group: 'mech', label: 'L\'Anneau vous tente'},
  {id: 'monarch', group: 'mech', label: 'Devenir le monarque'},
  {id: 'initiative', group: 'mech', label: 'Prendre l\'initiative (donjon)'},
  {id: 'venture', group: 'mech', label: 'S\'aventurer dans le donjon'},
  {id: 'modal', group: 'modal', label: 'Choix de modes (choisissez l\'un, deux, ou un ou plusieurs —)', modal: true},
  // Effets permanents (« Permanente ») : sur des créatures choisies, sur la carte, sur vous, ou des remplacements.
  {id: 'grantKeyword', group: 'stCreature', label: 'Elles ont un mot-clé (« les autres Elfes que vous contrôlez ont la vigilance »)', scope: true, keyword: true, only: ['static']},
  {id: 'anthem', group: 'stCreature', label: 'Elles gagnent +X/+X', n: true, scope: true, only: ['static']},
  {id: 'anthemPower', group: 'stCreature', label: 'Elles gagnent +X/+0', n: true, scope: true, only: ['static']},
  {id: 'anthemX', group: 'stCreature', label: 'Elles gagnent +X/+X (X : marqueurs sur elle, marqueurs « expérience », créatures…)', scope: true, amountSel: true, only: ['static']},
  {id: 'debuff', group: 'stCreature', label: 'Elles gagnent -X/-X', n: true, scope: true, only: ['static']},
  {id: 'cantBlock', group: 'stCreature', label: 'Elles ne peuvent pas bloquer', scope: true, only: ['static']},
  {id: 'cantAttack', group: 'stCreature', label: 'Elles ne peuvent pas attaquer', scope: true, only: ['static']},
  {id: 'cantAttackBlock', group: 'stCreature', label: 'Elles ne peuvent ni attaquer ni bloquer', scope: true, only: ['static']},
  {id: 'unblockable', group: 'stCreature', label: 'Elles ne peuvent pas être bloquées', scope: true, only: ['static']},
  {id: 'notBlockedByPower', group: 'stCreature', label: 'Les créatures de force X ou moins ne peuvent pas les bloquer', n: true, scope: true, only: ['static']},
  {id: 'mustAttack', group: 'stCreature', label: 'Elles attaquent à chaque combat si possible', scope: true, only: ['static']},
  {id: 'blockExtra', group: 'stCreature', label: 'Elles peuvent bloquer une créature supplémentaire', scope: true, only: ['static']},
  {id: 'maxOneBlocker', group: 'stCreature', label: 'Elles ne peuvent pas être bloquées par plus d\'une créature', scope: true, only: ['static']},
  {id: 'minBlockers', group: 'stCreature', label: 'Elles ne peuvent pas être bloquées excepté par X créatures ou plus', n: true, scope: true, only: ['static']},
  {id: 'canAttackDefender', group: 'stCreature', label: 'Elles peuvent attaquer comme si elles n\'avaient pas le défenseur', scope: true, only: ['static']},
  {id: 'damageToughness', group: 'stCreature', label: 'Elles infligent des blessures de combat égales à leur endurance plutôt qu\'à leur force', scope: true, only: ['static']},
  {id: 'noActivated', group: 'stCreature', label: 'Leurs capacités activées ne peuvent pas être activées', scope: true, only: ['static']},
  {id: 'doesntUntap', group: 'stCreature', label: 'Elles ne se dégagent pas pendant l\'étape de dégagement', scope: true, only: ['static']},
  {id: 'controlEnchanted', group: 'stCreature', label: 'Vous contrôlez la créature enchantée (aura)', only: ['static']},
  {id: 'cdaPT', group: 'stSelf', label: 'Sa force et son endurance sont égales à X (au choix)', amountSel: true, only: ['static']},
  {id: 'entersTapped', group: 'stSelf', label: 'Elle arrive sur le champ de bataille engagée', only: ['static']},
  {id: 'etbCounters', group: 'stSelf', label: 'Elle arrive avec X marqueurs (+1/+1 ou autre)', n: true, counter: true, only: ['static']},
  {id: 'uncounterable', group: 'stSelf', label: 'Ce sort ne peut pas être contrecarré', only: ['static']},
  {id: 'selfCostReduction', group: 'stSelf', label: 'Ce sort coûte {X} de moins à lancer (X au choix : créatures, artefacts, cartes au cimetière…)', amountSel: true, only: ['static']},
  {id: 'kwMustBeBlocked', group: 'stSelf', label: 'Elle doit être bloquée si possible', only: ['static']},
  {id: 'kwLure', group: 'stSelf', label: 'Toutes les créatures capables de la bloquer le font', only: ['static']},
  {id: 'kwCantAttackBlockAlone', group: 'stSelf', label: 'Elle ne peut pas attaquer ou bloquer seule', only: ['static']},
  {id: 'kwCantAttackAlone', group: 'stSelf', label: 'Elle ne peut pas attaquer seule', only: ['static']},
  {id: 'kwPreventAll', group: 'stSelf', label: 'Prévenez toutes les blessures qui devraient lui être infligées', only: ['static']},
  {id: 'kwPreventCombat', group: 'stSelf', label: 'Prévenez toutes les blessures de combat qui devraient lui être infligées', only: ['static']},
  {id: 'kwMayNotUntap', group: 'stSelf', label: 'Vous pouvez choisir de ne pas la dégager pendant votre étape de dégagement', only: ['static']},
  {id: 'kwCanBeCommander', group: 'stSelf', label: 'Elle peut être votre commandant (même si ce n\'est pas une créature légendaire)', only: ['static']},
  {id: 'kwAnyNumber', group: 'stSelf', label: 'Un deck peut contenir n\'importe quel nombre d\'exemplaires de cette carte', only: ['static']},
  {id: 'cloneEtb', group: 'stSelf', label: 'Elle peut arriver comme une copie de n\'importe quelle créature sur le champ de bataille', only: ['static']},
  {id: 'noMaxHand', group: 'stPlayer', label: 'Vous n\'avez pas de taille maximale de main', only: ['static']},
  {id: 'oppMaxHandMinus', group: 'stPlayer', label: 'La taille maximale de main de chaque adversaire est réduite de X', n: true, only: ['static']},
  {id: 'maxHandPlus', group: 'stPlayer', label: 'Votre taille maximale de main augmente de X', n: true, only: ['static']},
  {id: 'extraLand', group: 'stPlayer', label: 'Vous pouvez jouer X terrains supplémentaires à chacun de vos tours', n: true, only: ['static']},
  {id: 'reduceCost', group: 'stPlayer', label: 'Vos sorts (d\'un type) coûtent {X} de moins', n: true, spellType: true, only: ['static']},
  {id: 'raiseCostOpp', group: 'stPlayer', label: 'Les sorts (d\'un type) de vos adversaires coûtent {X} de plus', n: true, spellType: true, only: ['static']},
  {id: 'raiseCostAll', group: 'stPlayer', label: 'Les sorts (d\'un type) de tout le monde coûtent {X} de plus', n: true, spellType: true, only: ['static']},
  {id: 'flashSpells', group: 'stPlayer', label: 'Vous pouvez lancer vos sorts (d\'un type) comme s\'ils avaient le flash', spellType: true, only: ['static']},
  {id: 'playerHexproof', group: 'stPlayer', label: 'Vous avez la défense talismanique', only: ['static']},
  {id: 'cantLose', group: 'stPlayer', label: 'Vous ne pouvez pas perdre la partie (et vos adversaires ne peuvent pas la gagner)', only: ['static']},
  {id: 'oppCantGainLife', group: 'stPlayer', label: 'Vos adversaires ne peuvent pas gagner de points de vie', only: ['static']},
  {id: 'lookTop', group: 'stPlayer', label: 'Vous pouvez regarder la carte du dessus de votre bibliothèque à tout moment', only: ['static']},
  {id: 'playTop', group: 'stPlayer', label: 'Vous pouvez jouer la carte du dessus de votre bibliothèque', only: ['static']},
  {id: 'untapOthers', group: 'stPlayer', label: 'Vos permanents se dégagent aussi pendant l\'étape de dégagement des autres', only: ['static']},
  {id: 'ignoreLegend', group: 'stPlayer', label: 'La règle des légendes ne s\'applique pas à vos permanents', only: ['static']},
  {id: 'propaganda', group: 'stPlayer', label: 'Les créatures ne peuvent pas vous attaquer à moins que leur contrôleur ne paie {X} chacune', n: true, only: ['static']},
  {id: 'panharmonicon', group: 'stPlayer', label: 'Les capacités qui se déclenchent à l\'arrivée d\'une créature ou d\'un artefact se déclenchent une fois de plus', only: ['static']},
  {id: 'oppEnterTapped', group: 'stPlayer', label: 'Les créatures de vos adversaires arrivent engagées', only: ['static']},
  {id: 'oppCantCastYourTurn', group: 'stPlayer', label: 'Vos adversaires ne peuvent pas lancer de sorts pendant votre tour', only: ['static']},
  {id: 'oneSpellEach', group: 'stPlayer', label: 'Chaque joueur ne peut pas lancer plus d\'un sort par tour', only: ['static']},
  {id: 'oppOneSpell', group: 'stPlayer', label: 'Chaque adversaire ne peut pas lancer plus d\'un sort par tour', only: ['static']},
  {id: 'oppDrawLimit', group: 'stPlayer', label: 'Chaque adversaire ne peut pas piocher plus d\'une carte par tour', only: ['static']},
  {id: 'playersCantGainLife', group: 'stPlayer', label: 'Les joueurs ne peuvent pas gagner de points de vie', only: ['static']},
  {id: 'cantPreventDamage', group: 'stPlayer', label: 'Les blessures ne peuvent pas être prévenues', only: ['static']},
  {id: 'playLandsGraveyard', group: 'stPlayer', label: 'Vous pouvez jouer des terrains depuis votre cimetière', only: ['static']},
  {id: 'grantManaAny', group: 'stPlayer', label: 'Vos terrains (ou créatures, artefacts…) ont « {T} : Ajoutez un mana de la couleur de votre choix »', manaKind: true, only: ['static']},
  {id: 'animateStatic', group: 'stPlayer', label: 'Vos terrains, artefacts, enchantements… sont des créatures X/X (d\'un type, au choix) en plus de leurs autres types', n: true, anim: 'static', only: ['static']},
  {id: 'doubleTokens', group: 'stRepl', label: 'Vos effets créent deux fois plus de jetons', only: ['static']},
  {id: 'doubleCounters', group: 'stRepl', label: 'Deux fois plus de marqueurs +1/+1 sur vos créatures', only: ['static']},
  {id: 'plusOneCounter', group: 'stRepl', label: 'Un marqueur +1/+1 de plus sur vos créatures', only: ['static']},
  {id: 'doubleDamage', group: 'stRepl', label: 'Vos sources infligent le double de blessures aux adversaires et à leurs permanents', only: ['static']},
  {id: 'damagePlus', group: 'stRepl', label: 'Vos sources infligent X blessures de plus aux adversaires et à leurs permanents', n: true, only: ['static']},
  {id: 'doubleLife', group: 'stRepl', label: 'Vous gagnez deux fois plus de points de vie', only: ['static']},
  {id: 'graveyardHate', group: 'stRepl', label: 'Si une carte devait aller dans le cimetière d\'un adversaire, elle est exilée à la place', only: ['static']},
  {id: 'creaturesDieExile', group: 'stRepl', label: 'Si une créature devait mourir, elle est exilée à la place', only: ['static']},
  {id: 'manaDouble', group: 'stRepl', label: 'Si vous engagez un permanent pour du mana, il produit deux fois plus de mana', only: ['static']},
  {id: 'labManiac', group: 'stRepl', label: 'Si vous deviez piocher avec une bibliothèque vide, vous gagnez la partie à la place', only: ['static']},
];

/** Groupes des effets dans le formulaire. */
export const EFFECT_GROUPS = [
  ['life', 'Blessures, points de vie, poison, énergie'], ['cards', 'Cartes (pioche, bibliothèque, cimetière)'], ['creatures', 'Créatures et marqueurs'],
  ['players', 'Un joueur (ciblé, défenseur, ce joueur…)'], ['removal', 'Détruire, exiler, contrer'], ['control', 'Engager, contrôler'], ['mana', 'Mana et terrains'],
  ['turns', 'Tours, combats, copies, emblèmes'], ['mech', 'Mécaniques (explorer, l\'Anneau, monarque…)'], ['modal', 'Au choix'],
  ['stCreature', 'Effet permanent sur des créatures'], ['stSelf', 'Effet permanent de cette carte'], ['stPlayer', 'Effet permanent sur vous et les sorts'],
  ['stRepl', 'Remplacements (doubler les jetons, les blessures…)'],
];

/** Effets permanents écrits par un remplacement (« R: ») : leur condition ne peut pas être « votre tour ». */
export const STATIC_REPLACEMENTS = new Set(['doesntUntap', 'entersTapped', 'etbCounters', 'uncounterable', 'cantLose', 'oppEnterTapped', 'doubleTokens',
  'graveyardHate', 'creaturesDieExile', 'manaDouble', 'labManiac', 'cloneEtb', 'kwMustBeBlocked', 'kwLure', 'kwCantAttackBlockAlone', 'kwCantAttackAlone',
  'kwPreventAll', 'kwPreventCombat', 'kwMayNotUntap', 'kwCanBeCommander', 'kwAnyNumber',
  'doubleCounters', 'plusOneCounter', 'doubleDamage', 'damagePlus', 'doubleLife']);

/** Qui un effet permanent touche : [id, libellé]. */
export const SCOPES = [
  ['you', 'Les créatures que vous contrôlez'], ['opp', 'Les créatures que vos adversaires contrôlent'], ['all', 'Toutes les créatures'],
  ['self', 'Cette carte (elle-même)'], ['enchanted', 'La créature enchantée (aura)'], ['equipped', 'La créature équipée (équipement)'],
  ['tokens', 'Les jetons de créature que vous contrôlez'], ['attacking', 'Les créatures attaquantes que vous contrôlez'],
  ['fortified', 'Le terrain fortifié (fortification)'], ['commanders', 'Les créatures Commandant que vous possédez (passé)'],
];

/** Types de permanents ciblés : [id, pour Forge, « un … ciblé », « target … », « tous les … », « all … »]. */
export const PERM_TYPES = [
  ['creature', 'Creature', 'une créature ciblée', 'target creature', 'toutes les créatures', 'all creatures'],
  ['oppCreature', 'Creature.OppCtrl', 'une créature ciblée qu\'un adversaire contrôle', 'target creature an opponent controls',
    'toutes les créatures que vos adversaires contrôlent', 'all creatures your opponents control'],
  ['artifact', 'Artifact', 'un artefact ciblé', 'target artifact', 'tous les artefacts', 'all artifacts'],
  ['enchantment', 'Enchantment', 'un enchantement ciblé', 'target enchantment', 'tous les enchantements', 'all enchantments'],
  ['artEnch', 'Artifact,Enchantment', 'un artefact ou un enchantement ciblé', 'target artifact or enchantment',
    'tous les artefacts et tous les enchantements', 'all artifacts and enchantments'],
  ['land', 'Land', 'un terrain ciblé', 'target land', 'tous les terrains', 'all lands'],
  ['nonbasicLand', 'Land.nonBasic', 'un terrain non-base ciblé', 'target nonbasic land', 'tous les terrains non-base', 'all nonbasic lands'],
  ['planeswalker', 'Planeswalker', 'un planeswalker ciblé', 'target planeswalker', 'tous les planeswalkers', 'all planeswalkers'],
  ['creaturePw', 'Creature,Planeswalker', 'une créature ou un planeswalker ciblé', 'target creature or planeswalker',
    'toutes les créatures et tous les planeswalkers', 'all creatures and planeswalkers'],
  ['nonland', 'Permanent.nonLand', 'un permanent non-terrain ciblé', 'target nonland permanent', 'tous les permanents non-terrain', 'all nonland permanents'],
  ['oppNonland', 'Permanent.nonLand+OppCtrl', 'un permanent non-terrain ciblé qu\'un adversaire contrôle', 'target nonland permanent an opponent controls',
    'tous les permanents non-terrain que vos adversaires contrôlent', 'all nonland permanents your opponents control'],
  ['permanent', 'Permanent', 'un permanent ciblé', 'target permanent', 'tous les permanents', 'all permanents'],
  ['token', 'Card.token', 'un jeton ciblé', 'target token', 'tous les jetons', 'all tokens'],
  // Ce qu'un adversaire contrôle.
  ['oppPermanent', 'Permanent.OppCtrl', 'un permanent ciblé qu\'un adversaire contrôle', 'target permanent an opponent controls',
    'tous les permanents que vos adversaires contrôlent', 'all permanents your opponents control'],
  ['oppArtifact', 'Artifact.OppCtrl', 'un artefact ciblé qu\'un adversaire contrôle', 'target artifact an opponent controls',
    'tous les artefacts que vos adversaires contrôlent', 'all artifacts your opponents control'],
  ['oppEnchantment', 'Enchantment.OppCtrl', 'un enchantement ciblé qu\'un adversaire contrôle', 'target enchantment an opponent controls',
    'tous les enchantements que vos adversaires contrôlent', 'all enchantments your opponents control'],
  ['oppArtEnch', 'Artifact.OppCtrl,Enchantment.OppCtrl', 'un artefact ou un enchantement ciblé qu\'un adversaire contrôle',
    'target artifact or enchantment an opponent controls', 'tous les artefacts et enchantements que vos adversaires contrôlent',
    'all artifacts and enchantments your opponents control'],
  ['oppLand', 'Land.OppCtrl', 'un terrain ciblé qu\'un adversaire contrôle', 'target land an opponent controls',
    'tous les terrains que vos adversaires contrôlent', 'all lands your opponents control'],
  ['oppPlaneswalker', 'Planeswalker.OppCtrl', 'un planeswalker ciblé qu\'un adversaire contrôle', 'target planeswalker an opponent controls',
    'tous les planeswalkers que vos adversaires contrôlent', 'all planeswalkers your opponents control'],
  ['oppToken', 'Card.token+OppCtrl', 'un jeton ciblé qu\'un adversaire contrôle', 'target token an opponent controls',
    'tous les jetons que vos adversaires contrôlent', 'all tokens your opponents control'],
];

/** Les types « qu'un adversaire contrôle » (effets « Détruire / exiler / renvoyer … qu'un adversaire contrôle »). */
export const OPP_PERM_TYPES = PERM_TYPES.filter(t => /OppCtrl/.test(t[1]));

/** Types de cartes cherchées : [id, pour Forge, « une carte de … », « a … card »]. */
export const CARD_KINDS = [
  ['card', 'Card', 'une carte', 'a card'], ['creature', 'Creature', 'une carte de créature', 'a creature card'],
  ['permanent', 'Permanent', 'une carte de permanent', 'a permanent card'],
  ['land', 'Land', 'une carte de terrain', 'a land card'], ['basic', 'Land.Basic', 'une carte de terrain de base', 'a basic land card'],
  ['instantSorcery', 'Instant,Sorcery', 'une carte d\'éphémère ou de rituel', 'an instant or sorcery card'],
  ['artifact', 'Artifact', 'une carte d\'artefact', 'an artifact card'], ['enchantment', 'Enchantment', 'une carte d\'enchantement', 'an enchantment card'],
  ['planeswalker', 'Planeswalker', 'une carte de planeswalker', 'a planeswalker card'], ['legendary', 'Card.Legendary', 'une carte légendaire', 'a legendary card'],
  ['equipment', 'Equipment', 'une carte d\'équipement', 'an Equipment card'], ['aura', 'Aura', 'une carte d\'aura', 'an Aura card'],
];

/**
 * Marqueurs sur un permanent : [pour Forge, « un marqueur +1/+1 » (après « marqueur »), en anglais]. Les noms français
 * sont ceux des cartes imprimées (« pétrole », « sapience », « temps »…). Les marqueurs de mot-clé donnent leur
 * capacité, « bouclier » et « étourdissement » ont leur règle ; les autres servent aux capacités de la carte (coût
 * « retirez… », nombre X, condition, déclencheur « quand le troisième marqueur… »).
 */
export const COUNTER_TYPES = [
  ['P1P1', '+1/+1', '+1/+1'], ['M1M1', '-1/-1', '-1/-1'], ['SHIELD', '« bouclier »', 'shield'], ['STUN', '« étourdissement »', 'stun'],
  ['Indestructible', '« indestructible »', 'indestructible'], ['Flying', '« vol »', 'flying'], ['Deathtouch', '« contact mortel »', 'deathtouch'],
  ['Lifelink', '« lien de vie »', 'lifelink'], ['Trample', '« piétinement »', 'trample'], ['Vigilance', '« vigilance »', 'vigilance'],
  ['Menace', '« menace »', 'menace'], ['Reach', '« portée »', 'reach'], ['Hexproof', '« défense talismanique »', 'hexproof'],
  ['First Strike', '« initiative »', 'first strike'],
  ['CHARGE', '« charge »', 'charge'], ['TIME', '« temps »', 'time'], ['LORE', '« sapience »', 'lore'], ['OIL', '« pétrole »', 'oil'],
  ['QUEST', '« quête »', 'quest'], ['DOOM', '« fatalité »', 'doom'], ['AGE', '« âge »', 'age'], ['LEVEL', '« niveau »', 'level'],
  ['SPORE', '« spore »', 'spore'], ['DIVINITY', '« divinité »', 'divinity'], ['SOUL', '« âme »', 'soul'], ['STORAGE', '« stock »', 'storage'],
  ['ICE', '« glace »', 'ice'], ['FLOOD', '« inondation »', 'flood'], ['KI', '« ki »', 'ki'], ['BOUNTY', '« prime »', 'bounty'],
  ['BLOOD', '« sang »', 'blood'], ['BRICK', '« brique »', 'brick'], ['VERSE', '« verset »', 'verse'], ['FATE', '« destin »', 'fate'],
  ['STUDY', '« étude »', 'study'], ['OMEN', '« présage »', 'omen'], ['PLAGUE', '« peste »', 'plague'], ['FUSE', '« mèche »', 'fuse'],
  ['GROWTH', '« croissance »', 'growth'], ['WISH', '« souhait »', 'wish'], ['HOUR', '« heure »', 'hour'], ['PAGE', '« page »', 'page'],
  ['GOLD', '« or »', 'gold'], ['FEATHER', '« plume »', 'feather'],
];

/** Le type de marqueur de cet identifiant (COUNTER_TYPES), sinon « def ». */
function counterById(id, def = 'P1P1') {
  return COUNTER_TYPES.find(c => c[0] === id) || COUNTER_TYPES.find(c => c[0] === def);
}

/** « premier », « troisième » ; « first », « third ». */
function ordinal(n, lang) {
  const fr = ['premier', 'deuxième', 'troisième', 'quatrième', 'cinquième', 'sixième', 'septième', 'huitième', 'neuvième', 'dixième'];
  const en = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
  return (lang === 'en' ? en : fr)[n - 1] || (lang === 'en' ? `${n}th` : `${n}e`);
}

/** Ce qu'un joueur sacrifie : [id, pour Forge, « une créature », « a creature »]. */
export const SAC_KINDS = [
  ['creature', 'Creature', 'une créature', 'a creature'], ['artifact', 'Artifact', 'un artefact', 'an artifact'],
  ['enchantment', 'Enchantment', 'un enchantement', 'an enchantment'], ['land', 'Land', 'un terrain', 'a land'],
  ['nonland', 'Permanent.nonLand', 'un permanent non-terrain', 'a nonland permanent'], ['planeswalker', 'Planeswalker', 'un planeswalker', 'a planeswalker'],
  ['artEnch', 'Artifact,Enchantment', 'un artefact ou un enchantement', 'an artifact or enchantment'], ['permanent', 'Permanent', 'un permanent', 'a permanent'],
  ['nontokenCreature', 'Creature.nonToken', 'une créature non-jeton', 'a nontoken creature'],
];

/** Types de sorts (coûts réduits, flash…) : [id, pour Forge, « les sorts … », « … spells »]. */
export const SPELL_TYPES = [
  ['all', 'Card', 'les sorts', 'spells'], ['creature', 'Creature', 'les sorts de créature', 'creature spells'],
  ['noncreature', 'Card.nonCreature', 'les sorts non-créature', 'noncreature spells'], ['instantSorcery', 'Instant,Sorcery', 'les sorts d\'éphémère et de rituel', 'instant and sorcery spells'],
  ['artifact', 'Artifact', 'les sorts d\'artefact', 'artifact spells'], ['enchantment', 'Enchantment', 'les sorts d\'enchantement', 'enchantment spells'],
  ['legendary', 'Card.Legendary', 'les sorts légendaires', 'legendary spells'], ['type', 'Card', 'les sorts d\'un type de créature', 'spells of a creature type'],
];

/** Effets d'un emblème (« vous obtenez un emblème avec … »). */
export const EMBLEMS = [
  ['anthem', 'Les créatures que vous contrôlez gagnent +X/+X'], ['grantKeyword', 'Les créatures que vous contrôlez ont un mot-clé'],
  ['noMaxHand', 'Vous n\'avez pas de taille maximale de main'], ['extraLand', 'Vous pouvez jouer X terrains supplémentaires'],
  ['reduceCost', 'Vos sorts coûtent {X} de moins'], ['playerHexproof', 'Vous avez la défense talismanique'], ['oppCantGainLife', 'Vos adversaires ne peuvent pas gagner de points de vie'],
  ['flashSpells', 'Vous pouvez lancer vos sorts comme s\'ils avaient le flash'],
];

/** Combien de modes on choisit : l'un, deux (avec trois modes), un ou plusieurs. */
export const PICKS = [['one', 'Choisissez l\'un —'], ['two', 'Choisissez deux — (trois modes)'], ['oneOrMore', 'Choisissez un ou plusieurs —']];

/** Effets possibles pour un mode de « Choisissez l'un — » (pas un autre choix de modes). */
export function modeEffectsFor(when, card = null) {
  return effectsFor(when, card).filter(e => !e.modal);
}

/** Nombre d'un effet : celui indiqué, ou X calculé pendant la partie. */
export const AMOUNTS = [
  ['fixed', 'Le nombre indiqué'],
  ['xPaid', 'X = la valeur de X payée (coût avec {X})'],
  ['creatures', 'X = le nombre de créatures que vous contrôlez'],
  ['typeCount', 'X = le nombre de créatures d\'un type que vous contrôlez'],
  ['lands', 'X = le nombre de terrains que vous contrôlez'],
  ['artifacts', 'X = le nombre d\'artefacts que vous contrôlez'],
  ['enchantments', 'X = le nombre d\'enchantements que vous contrôlez'],
  ['permanents', 'X = le nombre de permanents que vous contrôlez'],
  ['tokens', 'X = le nombre de jetons que vous contrôlez'],
  ['artifactTokens', 'X = le nombre de jetons artefact que vous contrôlez'],
  ['oppCreatures', 'X = le nombre de créatures que vos adversaires contrôlent'],
  ['hand', 'X = le nombre de cartes dans votre main'],
  ['life', 'X = votre total de points de vie'],
  ['graveyard', 'X = le nombre de cartes de créature dans votre cimetière'],
  ['graveyardCards', 'X = le nombre de cartes dans votre cimetière'],
  ['allGraveyards', 'X = le nombre de cartes de créature dans tous les cimetières'],
  ['domain', 'X = le nombre de types de terrains de base parmi vos terrains (Domaine)'],
  ['spellsTurn', 'X = le nombre de sorts que vous avez lancés ce tour-ci'],
  ['lifeGainedTurn', 'X = les points de vie que vous avez gagnés ce tour-ci'],
  ['lifeLostOpp', 'X = les points de vie perdus par vos adversaires ce tour-ci'],
  ['lifeLostYou', 'X = les points de vie que vous avez perdus ce tour-ci'],
  ['opponents', 'X = le nombre d\'adversaires'],
  ['power', 'X = la force de cette carte'],
  ['toughness', 'X = l\'endurance de cette carte'],
  ['counters', 'X = le nombre de marqueurs (d\'un type, au choix) sur cette carte'],
  ['experience', 'X = le nombre de marqueurs « expérience » que vous avez'],
  ['energy', 'X = la quantité d\'énergie ({E}) que vous avez'],
  ['tapped', 'X = le nombre de permanents engagés pour le coût'],
];

/** Coût « engager X … dégagés que vous contrôlez » : ce qu'on engage. */
export const TAP_WHAT = [['token', 'jetons'], ['creature', 'créatures'], ['artifact', 'artefacts'], ['type', 'créatures d\'un type'],
  ['permanent', 'permanents'], ['land', 'terrains'], ['enchantment', 'enchantements']];

/** Combien le coût « engager … » en demande : [valeur, libellé]. X au choix en jouant (au moins un), ou un nombre fixe. */
export const TAP_COUNTS = [['X', 'X (au choix, au moins 1)'], ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => [String(n), String(n)])];

/** Le nombre fixe du coût « engager … » (« Engagez deux créatures… »), ou null pour X au choix. */
export function tapCount(a) {
  const n = Math.round(Number(a && a.tapXN));
  return a && a.tapX && a.tapXN && a.tapXN !== 'X' && n >= 1 ? Math.min(n, 10) : null;
}

/** Ce qu'engage le coût : [type pour Forge, pluriel, singulier, accord (« dégagés »/« dégagées »), en anglais]. */
function tapWhat(a) {
  const t = typeName(a.tapXType);
  switch (a.tapXWhat) {
    case 'creature': return ['Creature', 'créatures', 'créature', 'es', 'creatures'];
    case 'artifact': return ['Artifact', 'artefacts', 'artefact', 's', 'artifacts'];
    case 'permanent': return ['Permanent', 'permanents', 'permanent', 's', 'permanents'];
    case 'land': return ['Land', 'terrains', 'terrain', 's', 'lands'];
    case 'enchantment': return ['Enchantment', 'enchantements', 'enchantement', 's', 'enchantments'];
    case 'type': return t ? [`Creature.${t}`, `créatures de type ${frType(a.tapXType)}`, `créature de type ${frType(a.tapXType)}`, 'es', `${t} creatures`] : ['Creature', 'créatures', 'créature', 'es', 'creatures'];
    default: return ['Card.token', 'jetons', 'jeton', 's', 'tokens'];
  }
}

/** Conditions d'une capacité : elle n'agit que si… (pour un effet permanent : tant que…). */
export const CONDITIONS = [
  ['none', 'Toujours'],
  ['control', 'Si vous contrôlez au moins X créatures (d\'un type, au choix)'],
  ['lifeAtLeast', 'Si vous avez au moins X points de vie'],
  ['lifeAtMost', 'Si vous avez X points de vie ou moins'],
  ['handAtLeast', 'Si vous avez au moins X cartes en main'],
  ['graveyardAtLeast', 'S\'il y a au moins X cartes de créature dans votre cimetière'],
  ['yourTurn', 'Si c\'est votre tour'],
  ['notYourTurn', 'Si ce n\'est pas votre tour'],
  ['threshold', 'Seuil : au moins sept cartes dans votre cimetière'],
  ['delirium', 'Délire : au moins quatre types de cartes dans votre cimetière'],
  ['morbid', 'Morbidité : si une créature est morte ce tour-ci'],
  ['raid', 'Saccage : si vous avez attaqué ce tour-ci'],
  ['revolt', 'Révolte : si un de vos permanents a quitté le champ de bataille ce tour-ci'],
  ['metalcraft', 'Art des métaux : si vous contrôlez au moins trois artefacts'],
  ['ferocious', 'Férocité : si vous contrôlez une créature de force 4 ou plus'],
  ['hellbent', 'Acharnement : si vous n\'avez pas de carte en main'],
  ['coven', 'Congrégation : trois créatures de forces différentes'],
  ['blessing', 'Si vous avez l\'agrément de la cité (Ascension)'],
  ['monarch', 'Si vous êtes le monarque'],
  ['kicked', 'Si le kick a été payé (mot-clé Kick)'],
  ['lifeGained', 'Si vous avez gagné des points de vie ce tour-ci'],
  ['oppLostLife', 'Si un adversaire a perdu des points de vie ce tour-ci'],
  ['oppLostLifeN', 'Si vos adversaires ont perdu au moins X points de vie ce tour-ci'],
  ['youLostLife', 'Si vous avez perdu des points de vie ce tour-ci'],
  ['spells2', 'Si vous avez lancé au moins deux sorts ce tour-ci'],
  ['tappedAtLeast', 'Si vous en avez engagé au moins X (coût « engager X »)'],
  ['countersAtLeast', 'Si elle a au moins X marqueurs (d\'un type, au choix)'],
  ['experienceAtLeast', 'Si vous avez au moins X marqueurs « expérience »'],
  ['energyAtLeast', 'Si vous avez au moins X {E} (énergie)'],
];

/** Conditions qui demandent un nombre N. */
export const CONDITIONS_N = ['control', 'oppLostLifeN', 'lifeAtLeast', 'lifeAtMost', 'handAtLeast', 'graveyardAtLeast', 'tappedAtLeast', 'countersAtLeast',
  'experienceAtLeast', 'energyAtLeast'];

/** Types de créature, en français et en anglais (posés par l'Atelier d'après la liste du pont). */
const typesByName = new Map();
const typeFr = new Map();
const plainType = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** La liste des types : [{en: 'God', fr: 'Dieu'}, …]. */
export function setTypeNames(list) {
  typesByName.clear();
  typeFr.clear();
  creatureTypes.clear();
  for (const t of list || []) {
    typesByName.set(plainType(t.en), t.en);
    creatureTypes.add(t.en);
    if (t.fr && t.fr !== t.en) {
      typesByName.set(plainType(t.fr), t.en);
      typeFr.set(t.en, t.fr);
    }
  }
  registerSubtypes();
}

/** Les types de créature connus (liste du pont), pour reconnaître un type de créature sur une carte non-créature. */
const creatureTypes = new Set();

/**
 * Sous-types qui ne sont pas des types de créature (et Monture) : [type de Forge, nom sur les cartes françaises, types
 * de carte qui le portent, mécanique]. La mécanique dit ce que le sous-type demande pour marcher comme dans le jeu :
 * kw (les mots-clés qui le font marcher ; le premier est ajouté s'il n'y en a aucun), aura (la cible de l'aura :
 * « Enchanter : joueur » pour une malédiction), ability (la capacité des jetons du même nom, voir SUBTYPE_ABILITIES),
 * mana (type de terrain de base : « {T} : Ajoutez {G} »), legendary (un passé est légendaire), saga, levels (classe),
 * solve (affaire), commanders (passé), no (pas encore possible dans l'Atelier : la raison).
 */
export const SUBTYPES = [
  ['Equipment', 'Équipement', ['Artifact'], {kw: ['Equip', 'Reconfigure', 'Living Weapon', 'For Mirrodin', 'Job select'],
    note: 'S\'attache à une créature avec le mot-clé Équipement. « Qui » propose « La créature équipée ».'}],
  ['Fortification', 'Fortification', ['Artifact'], {kw: ['Fortify'], note: 'S\'attache à un terrain avec le mot-clé Fortification. « Qui » propose « Le terrain fortifié ».'}],
  ['Vehicle', 'Véhicule', ['Artifact'], {kw: ['Crew'], note: 'Devient une créature-artefact quand on le pilote (mot-clé Pilotage) : il a une force et une endurance.'}],
  ['Spacecraft', 'Vaisseau spatial', ['Artifact'], {kw: ['Station'], note: 'Devient une créature-artefact à partir de X marqueurs charge (mot-clé Station).'}],
  ['Food', 'Nourriture', ['Artifact'], {ability: true}],
  ['Clue', 'Indice', ['Artifact'], {ability: true}],
  ['Treasure', 'Trésor', ['Artifact'], {ability: true}],
  ['Blood', 'Sang', ['Artifact'], {ability: true}],
  ['Gold', 'Or', ['Artifact'], {ability: true}],
  ['Map', 'Carte', ['Artifact'], {ability: true}],
  ['Powerstone', 'Lithoforce', ['Artifact'], {ability: true}],
  ['Junk', 'Bric-à-brac', ['Artifact'], {ability: true}],
  ['Lander', 'Atterrisseur', ['Artifact'], {ability: true}],
  ['Mutagen', 'Mutagène', ['Artifact'], {ability: true}],
  ['Incubator', 'Incubateur', ['Artifact'], {no: 'Un incubateur se transforme en créature : c\'est une carte à deux faces, que l\'Atelier ne fait pas encore. Le sous-type reste sans sa mécanique.'}],
  ['Attraction', 'Attraction', ['Artifact'], {no: 'Les attractions se jouent depuis un paquet d\'attractions à part, absent de ces parties. Le sous-type reste sans sa mécanique.'}],
  ['Bobblehead', 'Figurine', ['Artifact'], {}], ['Book', 'Livre', ['Artifact'], {}], ['Communicator', 'Communicateur', ['Artifact'], {}],
  ['Heartwood', 'Heartwood', ['Artifact'], {}], ['Infinity', 'Infinité', ['Artifact'], {}], ['Stone', 'Pierre', ['Artifact'], {}],
  ['Vibranium', 'Vibranium', ['Artifact'], {}],
  ['Aura', 'Aura', ['Enchantment'], {kw: ['Enchant'], note: 'S\'attache avec « Enchanter : … ». « Qui » propose ce qu\'elle enchante.'}],
  ['Curse', 'Malédiction', ['Enchantment'], {aura: 'Player', note: 'Une aura qui enchante un joueur (« Enchanter : joueur ») : déclencheurs et effets « du joueur enchanté ».'}],
  ['Role', 'Rôle', ['Enchantment'], {aura: 'Creature', note: 'Une aura qui enchante une créature ; une créature n\'a qu\'un seul rôle de chaque joueur.'}],
  ['Cartouche', 'Cartouche', ['Enchantment'], {aura: 'Creature.YouCtrl:creature you control', note: 'Une aura qui enchante une créature que vous contrôlez.'}],
  ['Rune', 'Rune', ['Enchantment'], {aura: 'Permanent', note: 'Une aura qui enchante un permanent.'}],
  ['Saga', 'Saga', ['Enchantment'], {saga: true, note: 'Ses capacités sont des chapitres (I, II, III…) : un marqueur de chapitre par tour, puis elle est sacrifiée.'}],
  ['Class', 'Classe', ['Enchantment'], {levels: true, note: 'Ses capacités ont un niveau : on paie le coût du niveau 2, puis du niveau 3, pour les ajouter.'}],
  ['Case', 'Affaire', ['Enchantment'], {solve: true, note: 'À résoudre — une condition vérifiée à votre étape de fin ; ensuite ses capacités « Résolue — » marchent.'}],
  ['Background', 'Passé', ['Enchantment'], {legendary: true, note: 'Un enchantement légendaire pour le commandant (« Choisissez un passé ») : « Qui » propose « Les créatures Commandant que vous possédez ».'}],
  ['Shard', 'Éclat', ['Enchantment'], {ability: true}],
  ['Shrine', 'Reliquaire', ['Enchantment'], {}], ['Plan', 'Plan', ['Enchantment'], {}],
  ['Room', 'Pièce', ['Enchantment'], {note: 'Une pièce a deux portes : choisis « Pièce » dans les faces de la carte (en haut du formulaire), chaque porte a son coût et ses capacités.'}],
  ['Plains', 'Plaine', ['Land'], {mana: 'W'}], ['Island', 'Île', ['Land'], {mana: 'U'}], ['Swamp', 'Marais', ['Land'], {mana: 'B'}],
  ['Mountain', 'Montagne', ['Land'], {mana: 'R'}], ['Forest', 'Forêt', ['Land'], {mana: 'G'}],
  ['Cave', 'Caverne', ['Land'], {}], ['Desert', 'Désert', ['Land'], {}], ['Gate', 'Porte', ['Land'], {}], ['Lair', 'Repaire', ['Land'], {}],
  ['Locus', 'Site', ['Land'], {}], ['Sphere', 'Sphère', ['Land'], {}], ['Town', 'Ville', ['Land'], {}], ['Planet', 'Planète', ['Land'], {kw: ['Station'],
    note: 'Un terrain avec Station : ses capacités « seulement à STATION X+ » marchent à partir de X marqueurs charge.'}],
  ['Urza\'s', 'd\'Urza', ['Land'], {}], ['Mine', 'Mine', ['Land'], {}], ['Power-Plant', 'Centrale', ['Land'], {}], ['Tower', 'Tour', ['Land'], {}],
  ['Arcane', 'Arcane', ['Instant', 'Sorcery'], {note: 'Les sorts d\'arcane reçoivent l\'Imprégnation d\'arcane.'}],
  ['Lesson', 'Leçon', ['Instant', 'Sorcery'], {note: 'Une leçon se cherche hors de la partie (réserve) avec Apprentissage.'}],
  ['Trap', 'Piège', ['Instant', 'Sorcery'], {}], ['Chorus', 'Chorus', ['Instant', 'Sorcery'], {}],
  ['Adventure', 'Aventure', ['Instant', 'Sorcery'], {note: 'Une aventure est la seconde moitié d\'une carte de créature : choisis « Aventure » dans les faces de la carte (en haut du formulaire), le verso est le sort d\'aventure.'}],
  ['Omen', 'Présage', ['Instant', 'Sorcery'], {note: 'Un présage est la seconde moitié d\'une carte : choisis « Présage » dans les faces de la carte (en haut du formulaire), le verso est le sort du présage.'}],
  ['Mount', 'Monture', ['Creature'], {kw: ['Saddle'], note: 'Une monture se selle (mot-clé Seller) : elle est « sellée » jusqu\'à la fin du tour.'}],
];
const SUB_BY = new Map(SUBTYPES.map(s => [s[0], s]));

/** Les noms des sous-types (« Équipement », « Nourriture »…) reconnus en français comme en anglais. */
function registerSubtypes() {
  for (const [en, fr] of SUBTYPES) {
    typesByName.set(plainType(en), en);
    typesByName.set(plainType(fr), en);
    typeFr.set(en, fr);
  }
}
registerSubtypes();

/** Le nom d'un type dans une langue : « Elf » → « Elfe » en français ; un type sans traduction reste tel quel. */
export function typeLabel(en, lang = 'fr') {
  return lang === 'en' ? en : typeFr.get(en) || en;
}

/** Un sous-type de la table (« Food ») : [type, nom français, types de carte, mécanique], ou null. */
export function subtypeInfo(en) {
  return SUB_BY.get(en) || null;
}

/** Les sous-types de la carte en types de Forge : ceux tapés, puis ceux qu'imposent ses mots-clés et ses chapitres. */
export function cardSubtypes(f) {
  const sub = forgeSubtypes(f.subtypes);
  for (const t of autoSubtypes(f)) {
    if (!sub.includes(t)) {
      sub.push(t);
    }
  }
  // « Enchantement : aura et malédiction » : l'aura d'abord, comme sur les cartes.
  return sub.includes('Aura') ? ['Aura', ...sub.filter(t => t !== 'Aura')] : sub;
}

/** Le mot-clé qui fait marcher un sous-type (Équipement : Équipement, ou Reconfiguration sur une créature). */
function linkKeyword(m, f) {
  if (m.kw[0] === 'Equip' && (f.types || []).includes('Creature')) {
    return 'Reconfigure';
  }
  return m.kw[0];
}

/**
 * Relie chaque sous-type à sa mécanique, comme dans le jeu : le type de carte qu'il demande (un équipement est un
 * artefact), le mot-clé qui le fait marcher (Équipement, Enchanter, Pilotage, Fortification, Station, Seller), la cible
 * d'une malédiction (un joueur), un passé légendaire. Change la carte (f) et renvoie ce qui a été ajouté, en français.
 */
export function linkSubtypes(f, {keepTypes = false} = {}) {
  const added = [];
  f.types = f.types || [];
  f.keywords = f.keywords || [];
  f.kwValues = f.kwValues || {};
  for (const en of forgeSubtypes(f.subtypes)) {
    const s = SUB_BY.get(en);
    if (!s || s[3].no) {
      continue;
    }
    const [, fr, allowed, m] = s;
    // Le type de carte : une seule possibilité (un équipement est un artefact, une forêt un terrain).
    if (allowed.length === 1 && !f.types.includes(allowed[0])) {
      if (!keepTypes) {
        // Un sort n'a pas de sous-type de permanent ; la créature d'une nouvelle carte devient l'artefact, l'aura, le
        // terrain demandé (on peut remettre « Créature » ensuite : créature-artefact équipement, créature-terrain forêt).
        if (allowed[0] !== 'Creature') {
          f.types = f.types.filter(t => t !== 'Instant' && t !== 'Sorcery');
        }
        if (allowed[0] !== 'Creature' && (f.types.length === 1 && f.types[0] === 'Creature' || allowed[0] === 'Enchantment')) {
          f.types = f.types.filter(t => t !== 'Creature');
        }
      }
      f.types.push(allowed[0]);
      added.push(`${fr} : la carte est ${typeArticle(allowed[0])}`);
    }
    if (m.kw && !m.kw.some(k => f.keywords.includes(k))) {
      const k = linkKeyword(m, f);
      f.keywords.push(k);
      added.push(`${fr} : mot-clé ${keywordText(f, k, 'fr')} ajouté`);
    }
    if (m.aura) {
      if (!f.keywords.includes('Enchant')) {
        f.keywords.push('Enchant');
      }
      const cur = f.kwValues.Enchant;
      if (!cur || cur === 'Creature' || (m.aura === 'Player' && !/^(Player|Opponent)/.test(cur))) {
        if (cur !== m.aura) {
          f.kwValues = {...f.kwValues, Enchant: m.aura};
          added.push(`${fr} : ${keywordText(f, 'Enchant', 'fr')}`);
        }
      }
    }
    if (m.legendary && !f.legendary) {
      f.legendary = true;
      added.push(`${fr} : la carte est légendaire`);
    }
  }
  return added;
}

/** « un artefact », « un enchantement »… : le type de carte avec son article, pour les messages. */
function typeArticle(t) {
  return {Artifact: 'un artefact', Enchantment: 'un enchantement', Land: 'un terrain', Creature: 'une créature',
    Instant: 'un éphémère', Sorcery: 'un rituel', Planeswalker: 'un planeswalker'}[t] || t;
}

/** Ce qui ne va pas avec les sous-types de la carte, comme le jeu le verrait : des phrases à montrer dans l'Atelier. */
export function subtypeIssues(f) {
  const out = [];
  const types = f.types || [];
  const subs = forgeSubtypes(f.subtypes);
  for (const en of subs) {
    const s = SUB_BY.get(en);
    if (s) {
      if (s[3].no) {
        out.push(`${s[1]} : ${s[3].no}`);
      } else if (!s[2].some(t => types.includes(t))) {
        out.push(`${s[1]} ne va que sur ${s[2].map(typeArticle).join(' ou ')}.`);
      }
      continue;
    }
    if (creatureTypes.has(en) && !types.includes('Creature') && !types.includes('Kindred')) {
      out.push(`${frType(en)} est un type de créature : sur une carte qui n'est pas une créature, il faut le type « De clan ».`);
    }
  }
  if (subs.includes('Saga') && !(f.abilities || []).some(a => a.when === 'chapter')) {
    out.push('Une saga a besoin d\'au moins un chapitre (capacité « Chapitre de saga ») : sans chapitre, elle est sacrifiée dès son arrivée.');
  }
  if (subs.includes('Class') && !(f.abilities || []).some(a => Number(a.level) >= 2)) {
    out.push('Une classe a des capacités de niveau 2 ou 3 : choisis le niveau de chaque capacité.');
  }
  if (subs.includes('Case') && !f.caseCond) {
    out.push('Une affaire a une condition « À résoudre — » : choisis-la sous les sous-types.');
  }
  const at = attachOf(f);
  if (at && at.kind !== 'creature' && (f.abilities || []).some(a => a.when === 'static' && ['enchanted', 'equipped', 'fortified'].includes(a.scope)
    && ['anthem', 'anthemPower', 'debuff'].includes(a.effect))) {
    out.push(`${capitalize(at.fr)} n'a pas de force ni d'endurance : un bonus +N/+N ne lui fait rien.`);
  }
  return out;
}

/**
 * Ce à quoi la carte s'attache, d'après ses mots-clés et ses sous-types : {kind (creature, land, player, permanent),
 * scope (la portée « Qui » qui la désigne), v (pour Forge), fr, en, fem (féminin)}. null si elle ne s'attache à rien.
 */
export function attachOf(card) {
  if (!card) {
    return null;
  }
  const kws = card.keywords || [];
  const subs = forgeSubtypes(card.subtypes);
  if (kws.includes('Fortify') || subs.includes('Fortification')) {
    return {kind: 'land', scope: 'fortified', v: 'Land.FortifiedBy', fr: 'le terrain fortifié', en: 'fortified land', fem: false};
  }
  if (kws.includes('Enchant') || subs.includes('Aura') || subs.some(t => (SUB_BY.get(t) || [])[3]?.aura)) {
    const raw = keywordValue({...card, keywords: kws}, 'Enchant') || 'Creature';
    const e = raw.split(':')[0];
    if (/^(Player|Opponent)/.test(e)) {
      return {kind: 'player', scope: 'enchanted', v: 'Player.EnchantedBy', fr: 'le joueur enchanté', en: 'enchanted player', fem: false};
    }
    const t = (e.split('.')[0] || 'Creature').split(',');
    if (t.length === 1 && t[0] === 'Creature') {
      return {kind: 'creature', scope: 'enchanted', v: 'Creature.EnchantedBy', fr: 'la créature enchantée', en: 'enchanted creature', fem: true};
    }
    const one = t.length === 1 ? t[0] : 'Permanent';
    const words = {Artifact: ['l\'artefact enchanté', 'enchanted artifact'], Enchantment: ['l\'enchantement enchanté', 'enchanted enchantment'],
      Land: ['le terrain enchanté', 'enchanted land'], Planeswalker: ['le planeswalker enchanté', 'enchanted planeswalker'],
      Permanent: ['le permanent enchanté', 'enchanted permanent']}[one] || ['le permanent enchanté', 'enchanted permanent'];
    return {kind: one === 'Land' ? 'land' : 'permanent', scope: 'enchanted', v: `${one === 'Permanent' ? 'Card' : one}.EnchantedBy`,
      fr: words[0], en: words[1], fem: false};
  }
  if (kws.includes('Bestow')) {
    return {kind: 'creature', scope: 'enchanted', v: 'Creature.EnchantedBy', fr: 'la créature enchantée', en: 'enchanted creature', fem: true};
  }
  if (subs.includes('Equipment') || kws.some(k => ['Equip', 'Reconfigure', 'Living Weapon', 'For Mirrodin', 'Job select'].includes(k))) {
    return {kind: 'creature', scope: 'equipped', v: 'Creature.EquippedBy', fr: 'la créature équipée', en: 'equipped creature', fem: true};
  }
  return null;
}

/** Le libellé d'un déclencheur dans l'Atelier, avec ce que la carte équipe ou enchante (« Quand la créature équipée attaque »). */
export function whenLabel(w, card) {
  if (!w.attach || w.attach === 'player') {
    return w.label;
  }
  const at = attachOf(card);
  if (!at) {
    return w.label;
  }
  if (w.id === 'becomesAttached') {
    return at.scope === 'enchanted' ? 'Quand cette aura devient attachée à une créature' : 'Quand cet équipement devient attaché à une créature';
  }
  return w.label.replace('la créature équipée ou enchantée', at.fr).replace('le permanent enchanté ou fortifié', at.fr)
    .replace(/engagé$/, at.fem ? 'engagée' : 'engagé');
}

/** Le déclencheur va-t-il avec ce à quoi la carte s'attache (« quand la créature équipée attaque » : un équipement) ? */
export function whenFits(w, card) {
  if (!w.attach) {
    return true;
  }
  const at = attachOf(card);
  if (!at) {
    return false;
  }
  return w.attach === 'creature' ? at.kind === 'creature' : w.attach === 'player' ? at.kind === 'player' : at.kind === 'land' || at.kind === 'permanent';
}

/** Les portées « Qui » qui vont avec la carte : la créature équipée pour un équipement, le joueur enchanté pour une malédiction… */
export function scopesFor(card, current) {
  const at = attachOf(card);
  const subs = card ? cardSubtypes(card) : [];
  return SCOPES.filter(([id]) => {
    if (id === current) {
      return true;
    }
    if (id === 'enchanted' || id === 'equipped' || id === 'fortified') {
      return !!at && at.scope === id;
    }
    if (id === 'commanders') {
      return subs.includes('Background');
    }
    return true;
  }).map(([id, label]) => {
    if (at && at.scope === id) {
      return [id, at.kind === 'player' ? 'Les créatures que contrôle le joueur enchanté (malédiction)' : capitalize(at.fr)];
    }
    return [id, label];
  });
}

/**
 * Capacités des sous-types qui en ont une, écrites comme sur les jetons du même nom : [coût de Forge, coût en
 * français, coût en anglais, effet de Forge (« {id} » : le nom de la capacité), effet en français, en anglais, lignes en plus].
 */
const SUBTYPE_ABILITIES = {
  Food: ['2 T Sac<1/CARDNAME>', '{2}, {T}, sacrifiez CARDNAME', '{2}, {T}, Sacrifice CARDNAME', 'GainLife | Defined$ You | LifeAmount$ 3',
    'Vous gagnez 3 points de vie.', 'You gain 3 life.'],
  Clue: ['2 Sac<1/CARDNAME>', '{2}, sacrifiez CARDNAME', '{2}, Sacrifice CARDNAME', 'Draw | Defined$ You | NumCards$ 1', 'Piochez une carte.', 'Draw a card.'],
  Treasure: ['T Sac<1/CARDNAME>', '{T}, sacrifiez CARDNAME', '{T}, Sacrifice CARDNAME', 'Mana | Produced$ Any | Amount$ 1',
    'Ajoutez un mana de la couleur de votre choix.', 'Add one mana of any color.'],
  Blood: ['1 T Discard<1/Card> Sac<1/CARDNAME>', '{1}, {T}, défaussez-vous d\'une carte, sacrifiez CARDNAME', '{1}, {T}, Discard a card, Sacrifice CARDNAME',
    'Draw | Defined$ You | NumCards$ 1', 'Piochez une carte.', 'Draw a card.'],
  Gold: ['Sac<1/CARDNAME>', 'Sacrifiez CARDNAME', 'Sacrifice CARDNAME', 'Mana | Produced$ Any | Amount$ 1',
    'Ajoutez un mana de la couleur de votre choix.', 'Add one mana of any color.'],
  Map: ['1 T Sac<1/CARDNAME>', '{1}, {T}, sacrifiez CARDNAME', '{1}, {T}, Sacrifice CARDNAME',
    'Explore | ValidTgts$ Creature.YouCtrl | TgtPrompt$ Choisissez une créature ciblée que vous contrôlez | SorcerySpeed$ True',
    'Une créature ciblée que vous contrôlez explore. N\'activez que lorsque vous pourriez lancer un rituel.',
    'Target creature you control explores. Activate only as a sorcery.'],
  Powerstone: ['T', '{T}', '{T}', 'Mana | Produced$ C | RestrictValid$ CantCastNonArtifactSpells',
    'Ajoutez {C}. Ce mana ne peut pas être dépensé pour lancer un sort non-artefact.', 'Add {C}. This mana can\'t be spent to cast a nonartifact spell.'],
  Junk: ['T Sac<1/CARDNAME>', '{T}, sacrifiez CARDNAME', '{T}, Sacrifice CARDNAME',
    'Dig | SorcerySpeed$ True | Defined$ You | DigNum$ 1 | ChangeNum$ All | DestinationZone$ Exile | RememberChanged$ True | SubAbility$ {id}E',
    'Exilez la carte du dessus de votre bibliothèque. Vous pouvez jouer cette carte ce tour-ci. N\'activez que lorsque vous pourriez lancer un rituel.',
    'Exile the top card of your library. You may play that card this turn. Activate only as a sorcery.',
    ['SVar:{id}E:DB$ Effect | StaticAbilities$ {id}P | RememberObjects$ Remembered | ForgetOnMoved$ Exile | SubAbility$ {id}C',
      'SVar:{id}P:Mode$ Continuous | MayPlay$ True | Affected$ Card.IsRemembered | AffectedZone$ Exile | Description$ Vous pouvez jouer cette carte ce tour-ci.',
      'SVar:{id}C:DB$ Cleanup | ClearRemembered$ True']],
  Lander: ['2 T Sac<1/CARDNAME>', '{2}, {T}, sacrifiez CARDNAME', '{2}, {T}, Sacrifice CARDNAME',
    'ChangeZone | Origin$ Library | Destination$ Battlefield | Tapped$ True | ChangeType$ Land.Basic | ChangeNum$ 1',
    'Cherchez dans votre bibliothèque une carte de terrain de base, mettez-la sur le champ de bataille engagée, puis mélangez.',
    'Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.'],
  Mutagen: ['1 T Sac<1/CARDNAME>', '{1}, {T}, sacrifiez CARDNAME', '{1}, {T}, Sacrifice CARDNAME',
    'PutCounter | ValidTgts$ Creature | TgtPrompt$ Choisissez une créature ciblée | CounterType$ P1P1 | CounterNum$ 1 | SorcerySpeed$ True',
    'Mettez un marqueur +1/+1 sur une créature ciblée. N\'activez que lorsque vous pourriez lancer un rituel.',
    'Put a +1/+1 counter on target creature. Activate only as a sorcery.'],
  Shard: ['2 Sac<1/CARDNAME>', '{2}, sacrifiez CARDNAME', '{2}, Sacrifice CARDNAME', 'Scry | ScryNum$ 1 | SubAbility$ {id}D',
    'Regard 1, puis piochez une carte.', 'Scry 1, then draw a card.', ['SVar:{id}D:DB$ Draw | Defined$ You | NumCards$ 1']],
};

/** La capacité d'un sous-type (« {2}, {T}, sacrifiez CARDNAME : Vous gagnez 3 points de vie. ») dans la langue de la carte, ou null. */
export function subtypeAbilityText(en, lang = 'fr') {
  const s = SUBTYPE_ABILITIES[en];
  return s ? (lang === 'en' ? `${s[2]}: ${s[5]}` : `${s[1]} : ${s[4]}`) : null;
}

/** Lignes du script et texte de la capacité d'un sous-type ; id : le nom de la capacité. */
function subtypeAbilityLines(en, id, lang) {
  const s = SUBTYPE_ABILITIES[en];
  const head = lang === 'en' ? `${s[2]}:` : `${s[1]} :`;
  const desc = lang === 'en' ? s[5] : s[4];
  const sub = (l) => l.replace(/\{id\}/g, id);
  return {lines: [`A:AB$ ${sub(s[3])} | Cost$ ${s[0]} | CostDesc$ ${head} | SpellDescription$ ${desc}`, ...(s[6] || []).map(sub)], text: `${head} ${desc}`};
}

/** Le texte des types de terrain de base de la carte : « ({T} : Ajoutez {G} ou {U}.) », comme sur les terrains doubles. */
function basicManaText(subs, lang) {
  const syms = subs.map(t => (SUB_BY.get(t) || [])[3]).filter(m => m && m.mana).map(m => `{${m.mana}}`);
  if (!syms.length) {
    return '';
  }
  const list = lang === 'en' ? (syms.length < 3 ? syms.join(' or ') : `${syms.slice(0, -1).join(', ')}, or ${syms[syms.length - 1]}`)
    : (syms.length < 2 ? syms[0] : `${syms.slice(0, -1).join(', ')} ou ${syms[syms.length - 1]}`);
  return lang === 'en' ? `({T}: Add ${list}.)` : `({T} : Ajoutez ${list}.)`;
}

/** Le type de Forge d'un type tapé en français ou en anglais (« Dieu », « God ») ; un type inconnu reste tel quel. */
function typeName(t) {
  return typesByName.get(plainType(t)) || String(t || '').trim().replace(/[^\p{L}\p{N}-]/gu, '');
}

/** Le type tel qu'il s'écrit sur une carte française (« Dieu ») ; un type sans traduction reste en anglais. */
function frType(t) {
  const en = typeName(t);
  return typeFr.get(en) || String(t || '').trim() || en;
}

/** « Elfe » → « Elfes », « Dieu » → « Dieux », « Animal » → « Animaux ». */
function frPlural(w) {
  if (/[sxz]$/i.test(w)) {
    return w;
  }
  if (/al$/i.test(w)) {
    return w.slice(0, -2) + 'aux';
  }
  return /(eu|au)$/i.test(w) ? w + 'x' : w + 's';
}

/** Les sous-types tapés (« Dieu Peuple fée », « Elf Druid ») en types de Forge ; les noms de plusieurs mots d'abord. */
export function forgeSubtypes(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < words.length;) {
    let found = 0;
    for (let n = Math.min(3, words.length - i); n >= 2 && !found; n--) {
      const en = typesByName.get(plainType(words.slice(i, i + n).join(' ')));
      if (en) {
        out.push(en);
        found = n;
      }
    }
    if (!found) {
      out.push(typeName(words[i]));
      found = 1;
    }
    i += found;
  }
  return out.filter(Boolean);
}

/** X d'une capacité : [compte pour Forge, « X étant … », « where X is … »], ou null pour un nombre fixe. */
function amountOf(a) {
  const t = typeName(a.amountType);
  switch (a.amount) {
    case 'xPaid': return ['Count$xPaid', '', ''];
    case 'creatures': return ['Count$Valid Creature.YouCtrl', 'le nombre de créatures que vous contrôlez', 'the number of creatures you control'];
    case 'typeCount': return t ? [`Count$Valid Creature.${t}+YouCtrl`, `le nombre de créatures de type ${frType(a.amountType)} que vous contrôlez`, `the number of ${t} creatures you control`]
      : ['Count$Valid Creature.YouCtrl', 'le nombre de créatures que vous contrôlez', 'the number of creatures you control'];
    case 'lands': return ['Count$Valid Land.YouCtrl', 'le nombre de terrains que vous contrôlez', 'the number of lands you control'];
    case 'artifacts': return ['Count$Valid Artifact.YouCtrl', 'le nombre d\'artefacts que vous contrôlez', 'the number of artifacts you control'];
    case 'enchantments': return ['Count$Valid Enchantment.YouCtrl', 'le nombre d\'enchantements que vous contrôlez', 'the number of enchantments you control'];
    case 'permanents': return ['Count$Valid Permanent.YouCtrl', 'le nombre de permanents que vous contrôlez', 'the number of permanents you control'];
    case 'artifactTokens': return ['Count$Valid Artifact.token+YouCtrl', 'le nombre de jetons artefact que vous contrôlez', 'the number of artifact tokens you control'];
    case 'tokens': return ['Count$Valid Card.token+YouCtrl', 'le nombre de jetons que vous contrôlez', 'the number of tokens you control'];
    case 'oppCreatures': return ['Count$Valid Creature.OppCtrl', 'le nombre de créatures que vos adversaires contrôlent', 'the number of creatures your opponents control'];
    case 'hand': return ['Count$CardsInYourHand', 'le nombre de cartes dans votre main', 'the number of cards in your hand'];
    case 'life': return ['Count$YourLifeTotal', 'votre total de points de vie', 'your life total'];
    case 'graveyard': return ['Count$ValidGraveyard Creature.YouOwn', 'le nombre de cartes de créature dans votre cimetière', 'the number of creature cards in your graveyard'];
    case 'graveyardCards': return ['Count$ValidGraveyard Card.YouOwn', 'le nombre de cartes dans votre cimetière', 'the number of cards in your graveyard'];
    case 'allGraveyards': return ['Count$ValidGraveyard Creature', 'le nombre de cartes de créature dans tous les cimetières', 'the number of creature cards in all graveyards'];
    case 'domain': return ['Count$Domain', 'le nombre de types de terrains de base parmi les terrains que vous contrôlez',
      'the number of basic land types among lands you control'];
    case 'spellsTurn': return ['Count$ThisTurnCast_Card.YouCtrl', 'le nombre de sorts que vous avez lancés ce tour-ci', 'the number of spells you\'ve cast this turn'];
    case 'lifeGainedTurn': return ['Count$LifeYouGainedThisTurn', 'le nombre de points de vie que vous avez gagnés ce tour-ci', 'the amount of life you gained this turn'];
    case 'lifeLostOpp': return ['Count$LifeOppsLostThisTurn', 'le nombre total de points de vie que vos adversaires ont perdus ce tour-ci',
      'the total amount of life your opponents lost this turn'];
    case 'lifeLostYou': return ['Count$LifeYouLostThisTurn', 'le nombre de points de vie que vous avez perdus ce tour-ci', 'the amount of life you lost this turn'];
    case 'opponents': return ['PlayerCountOpponents$Amount', 'le nombre d\'adversaires que vous avez', 'the number of opponents you have'];
    case 'power': return ['Count$CardPower', 'la force de CARDNAME', 'CARDNAME\'s power'];
    case 'toughness': return ['Count$CardToughness', 'l\'endurance de CARDNAME', 'CARDNAME\'s toughness'];
    case 'counters': {
      const ct = counterById(a.amountCounter);
      return [`Count$CardCounters.${ct[0]}`, `le nombre de marqueurs ${ct[1]} sur CARDNAME`, `the number of ${ct[2]} counters on CARDNAME`];
    }
    case 'experience': return ['Count$YourCountersExperience', 'le nombre de marqueurs « expérience » que vous avez', 'the number of experience counters you have'];
    case 'energy': return ['Count$YourCountersEnergy', 'la quantité de {E} que vous avez', 'the amount of {E} you have'];
    case 'tapped': {
      const w = tapWhat(a);
      return ['Count$xPaid', `le nombre ${/^[aeiouéèh]/i.test(w[1]) ? 'd\'' : 'de '}${w[1]} engagé${w[3]} ainsi`, `the number of ${w[4]} tapped this way`];
    }
    default: return null;
  }
}

/**
 * Condition d'une capacité : {count, cmp} (un compte de Forge et sa comparaison) ou {turn} (votre tour ou pas), avec
 * « si … » / « if … » et le mot d'aptitude de la carte (« Seuil — »). null : toujours.
 */
function conditionOf(a) {
  const n = Math.max(0, Math.round(Number(a.condN ?? 3) || 0));
  const t = typeName(a.condType);
  const many = (one, more) => (n === 1 ? one : more);
  const c = (count, cmp, fr, en, aw) => ({count, cmp, fr, en, aw});
  switch (a.cond) {
    case 'control': return c(t ? `Count$Valid Creature.${t}+YouCtrl` : 'Count$Valid Creature.YouCtrl', `GE${n}`,
      `si vous contrôlez au moins ${many('une', word(n, 'fr'))} ${many('créature', 'créatures')}${t ? ' de type ' + frType(a.condType) : ''}`,
      `if you control ${word(n, 'en')} or more ${t ? t + ' ' : ''}${many('creature', 'creatures')}`);
    case 'lifeAtLeast': return c('Count$YourLifeTotal', `GE${n}`, `si vous avez au moins ${n} points de vie`, `if you have ${n} or more life`);
    case 'lifeAtMost': return c('Count$YourLifeTotal', `LE${n}`, `si vous avez ${n} ${plural(n, 'point', 'points')} de vie ou moins`, `if you have ${n} or less life`);
    case 'handAtLeast': return c('Count$CardsInYourHand', `GE${n}`, `si vous avez au moins ${many('une carte', word(n, 'fr') + ' cartes')} en main`,
      `if you have ${word(n, 'en')} or more ${many('card', 'cards')} in hand`);
    case 'graveyardAtLeast': return c('Count$ValidGraveyard Creature.YouOwn', `GE${n}`,
      `s'il y a au moins ${many('une carte', word(n, 'fr') + ' cartes')} de créature dans votre cimetière`,
      `if there are ${word(n, 'en')} or more creature ${many('card', 'cards')} in your graveyard`);
    case 'yourTurn': return {turn: 'your', fr: 'si c\'est votre tour', en: 'if it\'s your turn'};
    case 'notYourTurn': return {turn: 'notYour', fr: 'si ce n\'est pas votre tour', en: 'if it\'s not your turn'};
    case 'threshold': return c('Count$ValidGraveyard Card.YouOwn', 'GE7', 's\'il y a au moins sept cartes dans votre cimetière',
      'if seven or more cards are in your graveyard', ['Seuil', 'Threshold']);
    case 'delirium': return c('Count$Delirium.1.0', 'GE1', 's\'il y a au moins quatre types de cartes parmi les cartes de votre cimetière',
      'if there are four or more card types among cards in your graveyard', ['Délire', 'Delirium']);
    case 'morbid': return c('Count$Morbid.1.0', 'GE1', 'si une créature est morte ce tour-ci', 'if a creature died this turn', ['Morbidité', 'Morbid']);
    case 'raid': return c('Count$AttackersDeclared', 'GE1', 'si vous avez attaqué ce tour-ci', 'if you attacked this turn', ['Saccage', 'Raid']);
    case 'revolt': return c('Count$Revolt.1.0', 'GE1', 'si un permanent que vous contrôliez a quitté le champ de bataille ce tour-ci',
      'if a permanent you controlled left the battlefield this turn', ['Révolte', 'Revolt']);
    case 'metalcraft': return c('Count$Valid Artifact.YouCtrl', 'GE3', 'si vous contrôlez au moins trois artefacts', 'if you control three or more artifacts',
      ['Art des métaux', 'Metalcraft']);
    case 'ferocious': return c('Count$Valid Creature.YouCtrl+powerGE4', 'GE1', 'si vous contrôlez une créature avec une force supérieure ou égale à 4',
      'if you control a creature with power 4 or greater', ['Férocité', 'Ferocious']);
    case 'hellbent': return c('Count$CardsInYourHand', 'EQ0', 'si vous n\'avez pas de carte en main', 'if you have no cards in hand', ['Acharnement', 'Hellbent']);
    case 'coven': return c('Count$Valid Creature.YouCtrl$DifferentCardPower', 'GE3', 'si vous contrôlez au moins trois créatures de forces différentes',
      'if you control three or more creatures with different powers', ['Congrégation', 'Coven']);
    case 'blessing': return c('Count$Blessing.1.0', 'GE1', 'si vous avez l\'agrément de la cité', 'if you have the city\'s blessing');
    case 'monarch': return c('Count$Monarch.1.0', 'GE1', 'si vous êtes le monarque', 'if you\'re the monarch');
    case 'kicked': return c('Count$Kicked.1.0', 'GE1', 'si le kick a été payé', 'if it was kicked');
    case 'lifeGained': return c('Count$LifeYouGainedThisTurn', 'GE1', 'si vous avez gagné des points de vie ce tour-ci', 'if you gained life this turn');
    case 'oppLostLife': return c('Count$LifeOppsLostThisTurn', 'GE1', 'si un adversaire a perdu des points de vie ce tour-ci',
      'if an opponent lost life this turn');
    case 'oppLostLifeN': return c('Count$LifeOppsLostThisTurn', `GE${n}`, `si vos adversaires ont perdu au moins ${n} ${plural(n, 'point', 'points')} de vie ce tour-ci`,
      `if your opponents lost ${n} or more life this turn`);
    case 'youLostLife': return c('Count$LifeYouLostThisTurn', 'GE1', 'si vous avez perdu des points de vie ce tour-ci', 'if you lost life this turn');
    case 'spells2': return c('Count$ThisTurnCast_Card.YouCtrl', 'GE2', 'si vous avez lancé au moins deux sorts ce tour-ci', 'if you\'ve cast two or more spells this turn');
    case 'countersAtLeast': {
      const ct = counterById(a.condCounter, 'CHARGE');
      return c(`Count$CardCounters.${ct[0]}`, `GE${n}`, `si CARDNAME a au moins ${n === 1 ? 'un marqueur' : word(n, 'fr') + ' marqueurs'} ${ct[1]}`,
        `if CARDNAME has ${word(n, 'en')} or more ${ct[2]} ${n === 1 ? 'counter' : 'counters'} on it`);
    }
    case 'experienceAtLeast': return c('Count$YourCountersExperience', `GE${n}`,
      `si vous avez au moins ${n === 1 ? 'un marqueur' : word(n, 'fr') + ' marqueurs'} « expérience »`,
      `if you have ${word(n, 'en')} or more experience ${n === 1 ? 'counter' : 'counters'}`);
    case 'energyAtLeast': {
      const e = '{E}'.repeat(Math.max(1, Math.min(n, 10)));
      return c('Count$YourCountersEnergy', `GE${n}`, `si vous avez au moins ${e}`, `if you have ${e} or more`);
    }
    case 'tappedAtLeast': {
      const w = tapWhat(a);
      const fem = w[3] === 'es';
      return c('Count$xPaid', `GE${n}`, n === 1 ? `si au moins ${fem ? 'une' : 'un'} ${w[2]} a été engagé${fem ? 'e' : ''} ainsi`
        : `si au moins ${word(n, 'fr')} ${w[1]} ont été engagé${w[3]} ainsi`, `if ${word(n, 'en')} or more ${w[4]} were tapped this way`);
    }
    default: return null;
  }
}

/** La vérification d'une condition sur une capacité (« ConditionCheckSVar$ … »), svar : le nom de son compte. */
function conditionCheck(c, svar) {
  if (c.turn) {
    return ` | ConditionPlayerTurn$ ${c.turn === 'your' ? 'True' : 'False'}`;
  }
  return ` | ConditionCheckSVar$ ${svar} | ConditionSVarCompare$ ${c.cmp}`;
}

/** La même vérification sur un effet permanent (« CheckSVar$ … », « Condition$ PlayerTurn »). */
function staticCheck(c, svar) {
  if (c.turn) {
    return ` | Condition$ ${c.turn === 'your' ? 'PlayerTurn' : 'NotPlayerTurn'}`;
  }
  return ` | CheckSVar$ ${svar} | SVarCompare$ ${c.cmp}`;
}

/** « si … » devient « tant que … » pour un effet permanent. */
function asLongAs(c, lang) {
  return lang === 'en' ? c.en.replace(/^if /, 'as long as ') : c.fr.replace(/^si /, 'tant que ').replace(/^s'il /, 'tant qu\'il ');
}

/** Repère du nombre X pendant la construction du texte (remplacé ensuite par X et par le compte de Forge). */
const X_MARK = 7777;

/**
 * Effet complet d'une capacité : son effet (avec X si le nombre est calculé), les effets enchaînés (« …, puis … ») et la
 * condition (« si … »), qui s'applique à chacun. Renvoie les paramètres de Forge du premier effet, les SVar qui suivent,
 * le texte et le mot d'aptitude de la condition (« Seuil »).
 * Un effet donne ses lignes DB$ enchaînées (extra : la condition s'y applique, la suite se raccroche à la dernière) et ses
 * autres lignes (aux : comptes, effet permanent d'un emblème…), laissées telles quelles.
 */
function chainOf(a, id, lang) {
  const en = lang === 'en';
  const def = EFFECTS.find(x => x.id === a.effect);
  const x = def && def.n && !def.mana ? amountOf(a) : null;
  const main = effect(x ? {...a, n: X_MARK} : a, id);
  if (!main) {
    return null;
  }
  const xName = `${id}X`;
  // Dans un type de Forge (« Creature.cmcLE… »), DestroyAll remplace chaque « X » par la valeur de la variable X : le
  // compte y porte un nom sans X (« Atelier1V »).
  const vName = `${id}V`;
  const toForge = (l) => (x ? l.replace(/cmc(LE|GE|EQ|LT|GT)7777(?!\d)/g, `cmc$1${vName}`).replace(/(?<!\d)7777(?!\d)/g, xName) : l);
  const toText = (l) => (x ? l.replace(/\b7777\b/g, 'X') : l);
  const suffix = x && x[1] ? (en ? `, where X is ${x[2]}` : `, X étant ${x[1]}`) : '';
  const items = [{head: toForge(main.p), extra: (main.extra || []).map(toForge), aux: (main.aux || []).map(toForge), text: toText(en ? main.en : main.fr) + suffix}];
  let remember = false;
  (a.then || []).slice(0, 2).forEach((m, k) => {
    const name = `${id}T${k + 1}`;
    // Un effet enchaîné a son propre nombre : fixe, le même X que l'effet principal, le nombre de permanents touchés
    // juste avant (« détruisez X créatures ciblées, puis créez autant de jetons »), ou un autre X calculé.
    const mdef = EFFECTS.find(z => z.id === m.effect);
    let mx = null;
    if (mdef && mdef.n && !mdef.mana && m.amount && m.amount !== 'fixed') {
      if (m.amount === 'same') {
        mx = a.amount && a.amount !== 'fixed' ? amountOf({...a}) : null;
      } else if (m.amount === 'prev') {
        const prev = k === 0 ? a.effect : (a.then[k - 1] || {}).effect || '';
        const done = /token|populate|amass|investigate|incubate/i.test(prev) ? ['jetons créés', 'tokens created']
          : /exile/i.test(prev) ? ['permanents exilés', 'permanents exiled'] : /sacrific|edict/i.test(prev) ? ['permanents sacrifiés', 'permanents sacrificed']
          : /bounce|tuck/i.test(prev) ? ['permanents renvoyés', 'permanents returned'] : /destroy|wrath/i.test(prev) ? ['permanents détruits', 'permanents destroyed']
          : ['permanents touchés', 'permanents affected'];
        mx = ['Count$RememberedSize', `le nombre de ${done[0]} ainsi`, `the number of ${done[1]} this way`];
        items[items.length - 1].remember = true;
        remember = true;
      } else {
        mx = amountOf({...m, tapXWhat: a.tapXWhat, tapXType: a.tapXType});
      }
    }
    const e = effect({...newMode(), ...m, ...(mx ? {n: X_MARK} : {}), when: a.when, attachTo: a.attachTo, attachWhen: a.attachWhen}, name);
    if (e) {
      const mxName = `${name}X`;
      const mvName = `${name}V`;
      const fx = (l) => (mx ? l.replace(/cmc(LE|GE|EQ|LT|GT)7777(?!\d)/g, `cmc$1${mvName}`).replace(/(?<!\d)7777(?!\d)/g, mxName) : l);
      const head = fx(e.p);
      const extra = (e.extra || []).map(fx);
      const aux = (e.aux || []).map(fx);
      if (mx) {
        aux.push(`SVar:${mxName}:${mx[0]}`);
        if ([head, ...extra].some(l => l.includes(mvName))) {
          aux.push(`SVar:${mvName}:${mx[0]}`);
        }
      }
      let text = en ? e.en : e.fr;
      if (mx) {
        text = text.replace(/\b7777\b/g, 'X');
        // « X étant … » une seule fois quand c'est le même X que l'effet principal.
        if (mx[1] && !(m.amount === 'same' && suffix)) {
          text += en ? `, where X is ${mx[2]}` : `, X étant ${mx[1]}`;
        }
      }
      // Un effet enchaîné peut avoir sa propre condition (paliers : « puis, si au moins trois ont été engagés, … »).
      const own = conditionOf({...m, tapXWhat: a.tapXWhat, tapXType: a.tapXType});
      items.push({name, head, extra, aux, text, own});
    }
  });
  // Le compte des permanents touchés : retenus par l'effet d'avant, oubliés à la fin.
  items.forEach((it) => {
    if (it.remember) {
      it.head += ' | RememberDestroyed$ True | RememberChanged$ True | RememberSacrificed$ True | RememberTokens$ True';
    }
  });
  if (remember) {
    items.push({name: `${id}CL`, head: 'Cleanup | ClearRemembered$ True', extra: [], aux: [], text: '', silent: true});
  }
  const cond = conditionOf(a);
  const isDb = (l) => /^SVar:[^:]+:DB\$ /.test(l);
  items.forEach((it, k) => {
    const c = it.own || cond;
    if (c) {
      const check = conditionCheck(c, it.own ? `${id}C${k}` : `${id}C`);
      it.head += check;
      it.extra = it.extra.map(l => (isDb(l) ? l + check : l));
    }
  });
  // Pile ou face : le premier « Et puis » si vous gagnez, le second si vous perdez.
  const coin = a.effect === 'flipCoin' && items.length > 1;
  if (coin) {
    items[0].head += ` | WinSubAbility$ ${items[1].name}${items[2] ? ` | LoseSubAbility$ ${items[2].name}` : ''}`;
  }
  for (let k = 0; k < (coin ? 0 : items.length - 1); k++) {
    const it = items[k];
    const link = ` | SubAbility$ ${items[k + 1].name}`;
    const last = it.extra.map(isDb).lastIndexOf(true);
    if (last >= 0) {
      it.extra[last] += link;
    } else {
      it.head += link;
    }
  }
  const svars = [...items[0].extra, ...items[0].aux];
  if (x) {
    svars.push(`SVar:${xName}:${x[0]}`);
    if ([items[0].head, ...items[0].extra].some(l => l.includes(vName))) {
      svars.push(`SVar:${vName}:${x[0]}`);
    }
  }
  if (cond && cond.count) {
    svars.push(`SVar:${id}C:${cond.count}`);
  }
  items.forEach((it, k) => {
    if (it.own && it.own.count) {
      svars.push(`SVar:${id}C${k}:${it.own.count}`);
    }
  });
  for (const it of items.slice(1)) {
    svars.push(`SVar:${it.name}:DB$ ${it.head}`, ...it.extra, ...it.aux);
  }
  let body = items[0].text;
  if (coin) {
    body += `. ${en ? 'If you win the flip,' : 'Si vous gagnez,'} ${items[1].text}`;
    if (items[2]) {
      body += `. ${en ? 'If you lose the flip,' : 'Si vous perdez,'} ${items[2].text}`;
    }
  }
  for (const it of coin ? [] : items.slice(1).filter(z => !z.silent)) {
    body += (en ? ', then' : ', puis') + (it.own ? `, ${en ? it.own.en : it.own.fr}, ` : ' ') + it.text;
  }
  if (cond) {
    body = `${en ? cond.en : cond.fr}, ${body}`;
  }
  const aw = cond && cond.aw ? cond.aw[en ? 1 : 0] : '';
  return {p: items[0].head, extra: svars, body, aw};
}

/** Un mode tout neuf (son effet et ses réglages, comme une capacité). */
export function newMode(effect = 'draw') {
  return {effect, n: 1, filter: {type: '', other: false}, token: TOKENS[0][0], keyword: 'Flying', mana: 'Any'};
}

/** Couleurs de mana d'« Ajouter du mana ». */
export const MANA_CHOICES = [['Symbols', 'Ces symboles (ex. {G}{U}, plusieurs couleurs d\'un coup)'], ['Any', 'Une couleur au choix'], ['W', 'Blanc'], ['U', 'Bleu'], ['B', 'Noir'], ['R', 'Rouge'], ['G', 'Vert'], ['C', 'Incolore']];

/**
 * Capacités toutes prêtes : une phrase complète, puis la capacité du formulaire qu'elle donne (le type et le mot-clé
 * restent à changer). type : le type de la carte proposé par défaut (« Elfe »...), ou "" pour toutes les créatures.
 */
/**
 * Phrases toutes prêtes pour ce que la carte équipe ou enchante : « La créature équipée a le contact mortel » (un par
 * mot-clé), « gagne +1/+1 », ses déclencheurs ; « Le terrain fortifié a… » ; les malédictions (« ce joueur perd… »).
 * Vide si la carte ne s'attache à rien.
 */
export function attachTemplates(card) {
  const at = attachOf(card);
  if (!at) {
    return [];
  }
  const base = {n: 1, filter: {type: '', other: false}, token: 'w_1_1_spirit_flying', keyword: 'Flying', cost: '{1}', tap: true, sac: false, loyalty: 1,
    counter: 'P1P1'};
  const S = capitalize(at.fr);
  const st = (x) => ({...base, when: 'static', scope: at.scope, ...x});
  if (at.kind === 'player') {
    return [
      {label: 'Au début de l\'entretien du joueur enchanté, ce joueur perd 1 point de vie', a: {...base, when: 'ePlayerUpkeep', effect: 'targetLoseLife'}},
      {label: 'Au début de l\'entretien du joueur enchanté, cette malédiction lui inflige 1 blessure', a: {...base, when: 'ePlayerUpkeep', effect: 'damagePlayer'}},
      {label: 'À chaque fois que le joueur enchanté est attaqué, piochez une carte', a: {...base, when: 'ePlayerAttacked', effect: 'draw', who: 'target'}},
      {label: 'À chaque fois que le joueur enchanté lance un sort, ce joueur perd 1 point de vie', a: {...base, when: 'ePlayerCasts', effect: 'targetLoseLife'}},
      {label: 'Les créatures que contrôle le joueur enchanté attaquent à chaque combat si possible', a: st({effect: 'mustAttack'})},
      {label: 'Les créatures que contrôle le joueur enchanté ne peuvent pas bloquer', a: st({effect: 'cantBlock'})},
    ];
  }
  const out = [];
  if (at.kind === 'creature') {
    out.push({label: `${S} gagne +1/+1`, a: st({effect: 'anthem'})}, {label: `${S} gagne +2/+0`, a: st({effect: 'anthemPower', n: 2})},
      {label: `${S} gagne -1/-1`, a: st({effect: 'debuff'})});
  }
  // Un mot-clé par phrase : on trouve « contact mortel » en le tapant dans la recherche.
  for (const [kw] of KEYWORDS) {
    out.push({label: `${S} ${hasKw(kw, false)}`, a: st({effect: 'grantKeyword', keyword: kw})});
  }
  if (at.kind === 'creature') {
    const aura = at.scope === 'enchanted';
    out.push(
      {label: `${S} ne peut pas bloquer`, a: st({effect: 'cantBlock'})},
      {label: `${S} ne peut ni attaquer ni bloquer`, a: st({effect: 'cantAttackBlock'})},
      {label: `${S} attaque à chaque combat si possible`, a: st({effect: 'mustAttack'})},
      {label: `${S} est imblocable`, a: st({effect: 'unblockable'})},
      {label: `À chaque fois que ${at.fr} attaque, mettez un marqueur +1/+1 sur elle`, a: {...base, when: 'attachedAttacks', effect: 'countersAttached'}},
      {label: `À chaque fois que ${aura ? 'cette aura devient attachée' : 'cet équipement devient attaché'} à une créature, mettez un marqueur +1/+1 sur cette créature`,
        a: {...base, when: 'becomesAttached', effect: 'countersAttached'}},
      {label: `À chaque fois que ${at.fr} inflige des blessures de combat à un joueur, piochez une carte`, a: {...base, when: 'attachedCombatDamage', effect: 'draw'}},
      {label: `${aura ? 'Quand' : 'À chaque fois que'} ${at.fr} meurt, piochez une carte`, a: {...base, when: 'attachedDies', effect: 'draw'}},
      {label: `{1}, {T} : mettez un marqueur +1/+1 sur ${at.fr}`, a: {...base, when: 'activated', effect: 'countersAttached'}},
    );
    if (aura) {
      out.push({label: 'Vous contrôlez la créature enchantée', a: st({effect: 'controlEnchanted'})});
    }
  } else {
    out.push({label: `À chaque fois que ${at.fr} devient engagé, vous gagnez 1 point de vie`, a: {...base, when: 'attachedTapped', effect: 'gainLife'}},
      {label: `${S} ne se dégage pas pendant l'étape de dégagement de son contrôleur`, a: st({effect: 'doesntUntap'})});
  }
  return out;
}

export function templates(type) {
  const t = type || '';
  const others = t ? `les autres ${t}` : 'les autres créatures';
  const base = {n: 1, filter: {type: t, other: true}, token: 'w_1_1_spirit_flying', keyword: 'Vigilance', cost: '{2}', tap: true, sac: false, loyalty: 1};
  // Une capacité sur elle seule (pas de filtre de créatures).
  const one = {...base, filter: {type: '', other: false}};
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
    {label: 'Quand elle arrive, piochez X cartes, X étant le nombre de créatures que vous contrôlez',
      a: {...base, when: 'etb', effect: 'draw', amount: 'creatures', filter: {type: '', other: false}}},
    {label: 'Quand elle arrive, piochez une carte, puis vous gagnez 2 points de vie',
      a: {...base, when: 'etb', effect: 'draw', then: [{...newMode('gainLife'), n: 2}], filter: {type: '', other: false}}},
    {label: `Au début de votre entretien, si vous contrôlez au moins trois ${t || 'créatures'}, piochez une carte`,
      a: {...base, when: 'upkeep', effect: 'draw', cond: 'control', condN: 3, condType: t, filter: {type: '', other: false}}},
    {label: 'Quand elle arrive, choisissez deux — piochez une carte ; vous gagnez 3 points de vie ; regard 2',
      a: {...base, when: 'etb', effect: 'modal', pick: 'two', modes: [newMode('draw'), {...newMode('gainLife'), n: 3}, {...newMode('scry'), n: 2}], filter: {type: '', other: false}}},
    {label: 'Engagez X jetons dégagés que vous contrôlez : piochez X cartes',
      a: {...base, when: 'activated', effect: 'draw', cost: '', tap: false, tapX: true, tapXWhat: 'token', amount: 'tapped', filter: {type: '', other: false}}},
    {label: 'Engagez X créatures dégagées que vous contrôlez : vous gagnez X points de vie, puis, si au moins trois ont été engagées, créez un jeton',
      a: {...base, when: 'activated', effect: 'gainLife', cost: '', tap: false, tapX: true, tapXWhat: 'creature', amount: 'tapped',
        then: [{...newMode('token'), n: 1, token: 'w_1_1_spirit_flying', cond: 'tappedAtLeast', condN: 3}], filter: {type: '', other: false}}},
    {label: 'Quand elle meurt, elle inflige X blessures à n\'importe quelle cible, X étant sa force',
      a: {...base, when: 'dies', effect: 'damageAny', amount: 'power', filter: {type: '', other: false}}},
    {label: 'Vous n\'avez pas de taille maximale de main', a: {...base, when: 'static', effect: 'noMaxHand', filter: {type: '', other: false}}},
    {label: 'Vous pouvez jouer un terrain supplémentaire pendant chacun de vos tours', a: {...base, when: 'static', effect: 'extraLand', filter: {type: '', other: false}}},
    {label: 'Les sorts de créature que vous lancez coûtent {1} de moins à lancer',
      a: {...base, when: 'static', effect: 'reduceCost', spellType: 'creature', filter: {type: '', other: false}}},
    {label: 'Les sorts non-créature coûtent {1} de plus à lancer', a: {...base, when: 'static', effect: 'raiseCostAll', spellType: 'noncreature', filter: {type: '', other: false}}},
    {label: 'Aura : la créature enchantée gagne +2/+2 et a le vol', a: {...base, n: 2, when: 'static', effect: 'anthem', scope: 'enchanted', filter: {type: '', other: false}}},
    {label: 'Aura : la créature enchantée ne peut ni attaquer ni bloquer', a: {...base, when: 'static', effect: 'cantAttackBlock', scope: 'enchanted', filter: {type: '', other: false}}},
    {label: 'Équipement : la créature équipée gagne +2/+0', a: {...base, n: 2, when: 'static', effect: 'anthemPower', scope: 'equipped', filter: {type: '', other: false}}},
    {label: 'Équipement : à chaque fois que la créature équipée attaque, mettez un marqueur +1/+1 sur elle',
      a: {...base, n: 1, when: 'attachedAttacks', effect: 'countersAttached', counter: 'P1P1'}},
    {label: 'Équipement : à chaque fois que cet équipement devient attaché à une créature, mettez un marqueur +1/+1 sur cette créature',
      a: {...base, n: 1, when: 'becomesAttached', effect: 'countersAttached', counter: 'P1P1'}},
    {label: 'Elle ne peut pas être bloquée', a: {...base, when: 'static', effect: 'unblockable', scope: 'self', filter: {type: '', other: false}}},
    {label: 'Elle arrive sur le champ de bataille avec deux marqueurs +1/+1', a: {...base, n: 2, when: 'static', effect: 'etbCounters', filter: {type: '', other: false}}},
    {label: 'Seuil — Tant qu\'il y a au moins sept cartes dans votre cimetière, elle gagne +2/+2',
      a: {...base, n: 2, when: 'static', effect: 'anthem', scope: 'self', cond: 'threshold', filter: {type: '', other: false}}},
    {label: 'Tant que c\'est votre tour, elle a l\'initiative', a: {...base, when: 'static', effect: 'grantKeyword', keyword: 'First Strike', scope: 'self', cond: 'yourTurn', filter: {type: '', other: false}}},
    {label: 'Les créatures que vos adversaires contrôlent gagnent -1/-1', a: {...base, when: 'static', effect: 'debuff', scope: 'opp', filter: {type: '', other: false}}},
    {label: 'Si un effet devait créer au moins un jeton sous votre contrôle, il crée deux fois ce nombre de jetons à la place',
      a: {...base, when: 'static', effect: 'doubleTokens', filter: {type: '', other: false}}},
    {label: 'Toucheterre — À chaque fois qu\'un terrain arrive sous votre contrôle, mettez un marqueur +1/+1 sur cette créature',
      a: {...base, when: 'landfall', effect: 'countersSelf', filter: {type: '', other: false}}},
    {label: 'Sorcellerie — À chaque fois que vous lancez ou copiez un éphémère ou un rituel, regard 1',
      a: {...base, when: 'magecraft', effect: 'scry', filter: {type: '', other: false}}},
    {label: 'À chaque fois que vous piochez une carte, chaque adversaire perd 1 point de vie', a: {...base, when: 'drawCard', effect: 'drain', filter: {type: '', other: false}}},
    {label: 'Morbidité — Au début de chaque étape de fin, si une créature est morte ce tour-ci, piochez une carte',
      a: {...base, when: 'eachEnd', effect: 'draw', cond: 'morbid', filter: {type: '', other: false}}},
    {label: '{T}, sacrifiez une autre créature : piochez deux cartes. N\'activez qu\'une seule fois par tour',
      a: {...base, n: 2, when: 'activated', effect: 'draw', cost: '', sacWhat: 'otherCreature', oncePerTurn: true, filter: {type: '', other: false}}},
    {label: '{2}{B}, exilez cette carte de votre cimetière : créez un jeton Zombie 2/2 (capacité depuis le cimetière)',
      a: {...base, when: 'activated', effect: 'token', token: 'b_2_2_zombie', cost: '{2}{B}', tap: false, zone: 'Graveyard', exileSelf: true, filter: {type: '', other: false}}},
    {label: 'Planeswalker [−7] : vous gagnez un emblème avec « Les créatures que vous contrôlez gagnent +2/+2 »',
      a: {...base, n: 2, when: 'loyalty', loyalty: -7, effect: 'emblem', emblem: 'anthem', filter: {type: '', other: false}}},
    {label: 'Saga, chapitre I : créez un jeton Soldat 1/1', a: {...base, when: 'chapter', chapter: 1, effect: 'token', token: 'w_1_1_soldier', filter: {type: '', other: false}}},
    {label: 'Sort : en tant que coût supplémentaire, sacrifiez une créature. Détruisez une créature ciblée',
      a: {...base, when: 'spell', effect: 'destroy', addCost: 'sacCreature', filter: {type: '', other: false}}},
    {label: 'Sort : jouez un tour supplémentaire après celui-ci', a: {...base, when: 'spell', effect: 'extraTurn', filter: {type: '', other: false}}},
    // Un joueur précis : le joueur défenseur, ce joueur (blessures de combat, sort d'un adversaire…), un adversaire ciblé.
    {label: 'Quand elle attaque, elle inflige 1 blessure au joueur défenseur', a: {...one, when: 'attacks', effect: 'damageOpponent', who: 'that'}},
    {label: 'Quand elle attaque, le joueur défenseur perd 1 point de vie et vous gagnez 1 point de vie',
      a: {...one, when: 'attacks', effect: 'drainTarget', who: 'that'}},
    {label: 'Quand elle attaque, le joueur défenseur sacrifie une créature', a: {...one, when: 'attacks', effect: 'targetSacrifice', who: 'that'}},
    {label: 'À chaque fois qu\'elle inflige des blessures de combat à un joueur, ce joueur se défausse d\'une carte',
      a: {...one, when: 'combatDamage', effect: 'targetDiscard', who: 'that'}},
    {label: 'À chaque fois qu\'elle inflige des blessures de combat à un joueur, ce joueur meule deux cartes',
      a: {...one, n: 2, when: 'combatDamage', effect: 'targetMill', who: 'that'}},
    {label: 'À chaque fois qu\'un adversaire lance un sort, ce joueur perd 1 point de vie', a: {...one, when: 'oppCasts', effect: 'targetLoseLife', who: 'that'}},
    {label: 'Au début de l\'entretien de chaque adversaire, elle inflige 1 blessure à ce joueur', a: {...one, when: 'oppUpkeep', effect: 'damageOpponent', who: 'that'}},
    {label: 'À chaque fois qu\'un adversaire se défausse d\'une carte, elle inflige 2 blessures à ce joueur',
      a: {...one, n: 2, when: 'oppDiscards', effect: 'damageOpponent', who: 'that'}},
    {label: 'Quand elle arrive, un adversaire ciblé perd 3 points de vie', a: {...one, n: 3, when: 'etb', effect: 'targetLoseLife', who: 'opponent'}},
    {label: 'Quand elle arrive, un adversaire ciblé reçoit deux marqueurs « poison »', a: {...one, n: 2, when: 'etb', effect: 'targetPoison', who: 'opponent'}},
    // Marqueurs : les poser, les retirer en coût, compter, réagir au troisième ou au dernier.
    {label: 'Au début de votre entretien, mettez un marqueur « charge » sur elle', a: {...one, when: 'upkeep', effect: 'countersSelf', counter: 'CHARGE'}},
    {label: '{T} : mettez un marqueur « charge » sur elle', a: {...one, when: 'activated', effect: 'countersSelf', counter: 'CHARGE', cost: '', tap: true}},
    {label: '{T}, retirez trois marqueurs « charge » de cette carte : piochez trois cartes',
      a: {...one, n: 3, when: 'activated', effect: 'draw', cost: '', tap: true, removeCounters: 3, removeCounterType: 'CHARGE'}},
    {label: '{1}, retirez un marqueur « charge » de cette carte : elle inflige 2 blessures à n\'importe quelle cible',
      a: {...one, n: 2, when: 'activated', effect: 'damageAny', cost: '{1}', tap: false, removeCounters: 1, removeCounterType: 'CHARGE'}},
    {label: 'Elle gagne +1/+1 pour chaque marqueur « charge » sur elle',
      a: {...one, when: 'static', effect: 'anthemX', scope: 'self', amount: 'counters', amountCounter: 'CHARGE'}},
    {label: 'Tant qu\'elle a au moins trois marqueurs « charge », elle a le vol',
      a: {...one, when: 'static', effect: 'grantKeyword', keyword: 'Flying', scope: 'self', cond: 'countersAtLeast', condN: 3, condCounter: 'CHARGE'}},
    {label: 'Quand le troisième marqueur « charge » est mis sur elle, sacrifiez-la, puis piochez trois cartes',
      a: {...one, when: 'counterNth', whenCounter: 'CHARGE', whenN: 3, effect: 'sacrificeSelf', then: [{...newMode('draw'), n: 3}]}},
    {label: 'Elle arrive sur le champ de bataille avec trois marqueurs « temps »', a: {...one, n: 3, when: 'static', effect: 'etbCounters', counter: 'TIME'}},
    {label: 'Au début de votre entretien, retirez un marqueur « temps » de cette carte', a: {...one, when: 'upkeep', effect: 'removeCountersSelf', counter: 'TIME'}},
    {label: 'Quand le dernier marqueur « temps » est retiré d\'elle, elle inflige 5 blessures à chaque adversaire',
      a: {...one, n: 5, when: 'lastCounterRemoved', whenCounter: 'TIME', effect: 'damageOpponents'}},
    {label: 'Quand elle arrive, retirez deux marqueurs +1/+1 d\'une créature ciblée',
      a: {...one, n: 2, when: 'etb', effect: 'removeCountersTarget', counter: 'P1P1', permType: 'creature'}},
    {label: '{T} : mettez un marqueur « charge » sur un artefact ciblé', a: {...one, when: 'activated', effect: 'countersPermTarget', counter: 'CHARGE', permType: 'artifact', cost: '', tap: true}},
    {label: 'Quand elle attaque, vous gagnez un marqueur « expérience »', a: {...one, when: 'attacks', effect: 'experience'}},
    {label: `${capitalize(others)} que vous contrôlez gagnent +1/+1 pour chaque marqueur « expérience » que vous avez`,
      a: {...base, when: 'static', effect: 'anthemX', scope: 'you', amount: 'experience'}},
    {label: 'Quand elle attaque, elle gagne +X/+X jusqu\'à la fin du tour, X étant le nombre de marqueurs « expérience » que vous avez',
      a: {...one, when: 'attacks', effect: 'pumpSelf', amount: 'experience'}},
    {label: 'Quand elle arrive, vous gagnez {E}{E}', a: {...one, n: 2, when: 'etb', effect: 'energy'}},
    {label: 'Payez {E}{E} : elle gagne +2/+2 jusqu\'à la fin du tour', a: {...one, n: 2, when: 'activated', effect: 'pumpSelf', cost: '', tap: false, payEnergy: 2}},
    {label: 'Au début de votre étape de fin, si vous avez au moins cinq marqueurs « expérience », piochez une carte',
      a: {...one, when: 'end', effect: 'draw', cond: 'experienceAtLeast', condN: 5}},
    // Effets de base de beaucoup de cartes : prison, clignotement, animation, sorts adverses, cimetière…
    {label: 'Quand elle arrive, exilez un permanent non-terrain ciblé qu\'un adversaire contrôle jusqu\'à ce qu\'elle quitte le champ de bataille',
      a: {...one, when: 'etb', effect: 'exileUntilLeaves', permType: 'oppNonland'}},
    {label: 'Quand elle arrive, exilez une autre créature ciblée que vous contrôlez, puis renvoyez-la sur le champ de bataille',
      a: {...one, when: 'etb', effect: 'flicker'}},
    {label: '{1} : jusqu\'à la fin du tour, elle devient une créature 3/3 en plus de ses autres types (terrain, artefact)',
      a: {...one, n: 3, when: 'activated', effect: 'animateSelf', cost: '{1}', tap: false}},
    {label: 'Sacrifiez-la au début de la prochaine étape de fin (quand elle arrive)', a: {...one, when: 'etb', effect: 'sacrificeEndStep'}},
    {label: 'Quand elle attaque et n\'est pas bloquée, le joueur défenseur se défausse d\'une carte', a: {...one, when: 'unblocked', effect: 'targetDiscard', who: 'that'}},
    {label: 'Quand elle arrive, un adversaire ciblé révèle sa main et se défausse d\'une carte au hasard',
      a: {...one, when: 'etb', effect: 'targetRevealHand', who: 'opponent', then: [{...newMode('targetDiscardRandom'), n: 1, who: 'opponent'}]}},
    {label: 'Quand elle arrive, chaque adversaire sacrifie un artefact ou un enchantement', a: {...one, when: 'etb', effect: 'targetSacrificeType', who: 'eachOpp', sacKind: 'artEnch'}},
    {label: 'À chaque fois qu\'un adversaire pioche une carte, elle inflige 1 blessure à ce joueur', a: {...one, when: 'oppDraws', effect: 'damageOpponent', who: 'that'}},
    {label: 'Vos adversaires ne peuvent pas lancer de sorts pendant votre tour', a: {...one, when: 'static', effect: 'oppCantCastYourTurn'}},
    {label: 'La taille maximale de main de chaque adversaire est réduite de un', a: {...one, when: 'static', effect: 'oppMaxHandMinus'}},
    {label: 'Si une carte devait être mise dans le cimetière d\'un adversaire de n\'importe où, exilez-la à la place', a: {...one, when: 'static', effect: 'graveyardHate'}},
    {label: 'Ce sort coûte {X} de moins à lancer, X étant le nombre de cartes de créature dans votre cimetière',
      a: {...one, when: 'static', effect: 'selfCostReduction', amount: 'graveyard'}},
    {label: 'Elle peut arriver comme une copie de n\'importe quelle créature sur le champ de bataille', a: {...one, when: 'static', effect: 'cloneEtb'}},
    {label: 'Elle doit être bloquée si possible', a: {...one, when: 'static', effect: 'kwMustBeBlocked'}},
    {label: '{T} : vous pouvez lancer un éphémère ou un rituel ciblé de votre cimetière sans payer son coût de mana',
      a: {...one, when: 'activated', effect: 'castFromGraveyard', cost: '', tap: true, sorcery: true}},
    {label: 'Quand elle arrive, révélez des cartes jusqu\'à révéler une carte de terrain et mettez-la dans votre main',
      a: {...one, when: 'etb', effect: 'digUntil', cardKind: 'land'}},
    {label: 'Quand elle arrive, jouez à pile ou face : si vous gagnez, piochez deux cartes',
      a: {...one, when: 'etb', effect: 'flipCoin', then: [{...newMode('draw'), n: 2}]}},
  ];
}

/** Effets proposés pour un « quand » donné. */
export function effectsFor(when, card = null) {
  // Un effet sur la carte attachée (« la créature équipée ») : seulement pour un équipement ou une aura de créature.
  const at = card ? attachOf(card) : null;
  return EFFECTS.filter(e => (e.only ? e.only.includes(when) : when !== 'static') && !(e.self && when === 'spell')
    && !(e.attach && (when === 'spell' || (card && (!at || at.kind !== e.attach)))));
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

/** Un type de créature en minuscules dans une phrase (« créature », « elfe »). */
function typeWord(t) {
  const en = typeName(t);
  return en === 'Creature' || !en ? 'créature' : frType(t).toLowerCase();
}

/** « de créature », « d'elfe ». */
function deWord(w) {
  return /^[aeiouyhéèêàâîôûœ]/i.test(w) ? `d'${w}` : `de ${w}`;
}

/** Les valeurs d'un mot-clé pour ses gabarits ({n}, {sym}, {optFr}…). */
function keywordVars(f, k, lang) {
  const def = KW_BY[k];
  const v = keywordValue(f, k);
  const kind = def[4];
  const n = kind === 'ncost' ? keywordNumber(f, k) : kind === 'n' || kind === 'gen' ? v : null;
  const cost = kind === 'cost' || kind === 'ncost' ? forgeCost(v) : '';
  const o = kind === 'sel' ? (KW_OPTIONS[k] || []).find(x => x[0] === v) || [v, v, v] : null;
  const en = kind === 'type' ? typeName(v) || 'Creature' : '';
  return {
    n: n ?? '', nw: n === null ? '' : word(n, lang), cost: cost || '0', sym: costSymbols(cost) || '{0}', opt: o ? o[0] : '',
    optFr: o ? o[1] : '', optEn: o ? o[2] : '', type: en, Type: en, deType: kind === 'type' ? deWord(typeWord(v)) : '',
    aType: kind === 'type' ? `${article(en === 'Creature' ? 'creature' : en)} ${en === 'Creature' ? 'creature' : en}` : '',
  };
}

function fill(tpl, vars) {
  return String(tpl).replace(/\{(n|nw|cost|sym|opt|optFr|optEn|type|Type|deType|aType)\}/g, (m, k) => vars[k]);
}

/** Le mot-clé dans le texte de la carte, avec sa valeur (« Annihilateur 2 », « Recyclage {1}{U} », « Parade {2} »). */
function keywordText(f, k, lang) {
  const def = KW_BY[k];
  const name = keywordName(k, lang);
  if (!def) {
    return name;
  }
  const o = def[7] || {};
  const tpl = lang === 'en' ? o.en : o.fr;
  if (tpl) {
    return fill(tpl, keywordVars(f, k, lang));
  }
  if (!def[4]) {
    return name;
  }
  const v = keywordValue(f, k);
  if (def[4] === 'cost') {
    return `${name} ${costSymbols(forgeCost(v)) || '{0}'}`;
  }
  if (def[4] === 'sel') {
    const opt = (KW_OPTIONS[k] || []).find(x => x[0] === v) || [v, v, v];
    return lang === 'en' ? `${name} for ${opt[2]}` : `${name} pour ${opt[1]}`;
  }
  if (def[4] === 'text') {
    return v ? `${name} ${v}` : '';
  }
  return def[4] === 'gen' ? `${name} {${v}}` : `${name} ${v}`;
}

/** Un mot-clé qui tient sur la ligne des mots-clés simples (« Vol, piétinement ») : sans valeur ni phrase à lui. */
function simpleKeyword(k) {
  const def = KW_BY[k];
  return def && !def[4] && !(def[7] && def[7].fr);
}

/** La ligne « K: » de Forge d'un mot-clé (« K:Annihilator:2 », « K:Cycling:1 U »). */
function keywordLine(f, k) {
  const def = KW_BY[k];
  const o = (def && def[7]) || {};
  if (def && def[4] === 'text' && !keywordValue(f, k)) {
    return null; // « Partenariat avec » sans nom : rien
  }
  if (o.line) {
    return fill(o.line, keywordVars(f, k, 'en'));
  }
  if (!def || !def[4]) {
    return `K:${k}`;
  }
  const v = keywordValue(f, k);
  if (def[4] === 'type') {
    return `K:${k}:${typeName(v) || 'Creature'}`;
  }
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
  return f && f.type ? `Creature.${typeName(f.type)}+${props.join('+')}` : `Creature.${props.join('+')}`;
}

// Créatures filtrées, dans les deux langues : « un autre Elfe » / « another Elf ».
function oneFr(f) {
  if (f && f.type) {
    return f.other ? `un autre ${frType(f.type)}` : `un ${frType(f.type)}`;
  }
  return f && f.other ? 'une autre créature' : 'une créature';
}

function eachFr(f) {
  if (f && f.type) {
    return f.other ? `autre ${frType(f.type)}` : frType(f.type);
  }
  return f && f.other ? 'autre créature' : 'créature';
}

function allFr(f) {
  if (f && f.type) {
    return f.other ? `les autres ${frPlural(frType(f.type))}` : `les ${frPlural(frType(f.type))}`;
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
  const t = f && f.type ? typeName(f.type) : 'creature';
  return f && f.other ? `another ${t}` : `${article(t)} ${t}`;
}

function eachEn(f) {
  const t = f && f.type ? typeName(f.type) : 'creature';
  return f && f.other ? `other ${t}` : t;
}

function allEn(f) {
  const t = f && f.type ? `${typeName(f.type)} creatures` : 'creatures';
  return f && f.other ? `other ${t}` : t;
}

/** Le type de marqueur d'un effet : [pour Forge, nom français, nom anglais] (+1/+1 par défaut). */
function counterType(a) {
  return counterById(a.counter);
}

/** « un marqueur +1/+1 », « deux marqueurs « bouclier » », « a shield counter ». */
function counterWords(ct, k, lang) {
  if (lang === 'en') {
    return k === 1 ? `${article(ct[2])} ${ct[2]} counter` : `${word(k, 'en')} ${ct[2]} counters`;
  }
  return k === 1 ? `un marqueur ${ct[1]}` : `${word(k, 'fr')} marqueurs ${ct[1]}`;
}

/** Le type de permanent choisi pour un effet (PERM_TYPES), une créature par défaut. */
function permType(a) {
  return PERM_TYPES.find(t => t[0] === a.permType) || PERM_TYPES[0];
}

/** Le type de carte cherchée (CARD_KINDS), une carte par défaut. */
function cardKind(a) {
  return CARD_KINDS.find(t => t[0] === a.cardKind) || CARD_KINDS[0];
}

/** « Instant,Sorcery » → « Instant.YouOwn,Sorcery.YouOwn » : une carte à vous de ce type. */
function owned(v) {
  return v.split(',').map(t => (t.includes('.') ? `${t}+YouOwn` : `${t}.YouOwn`)).join(',');
}

/** « gagne le vol », « devient indestructible » (une créature) ou « gagnent … » (plusieurs). */
function gainsKw(kw, pl) {
  const has = KW_GRANT[kw] || 'ont ' + (KW_FR[kw] || kw).toLowerCase();
  if (has.startsWith('sont ')) {
    return pl ? 'deviennent ' + has.slice(5) : 'devient ' + has.slice(5).replace(/s$/, '');
  }
  return (pl ? 'gagnent ' : 'gagne ') + has.slice(4);
}

/** « ont le vol » (plusieurs) ou « a le vol » (une), « sont indestructibles » ou « est indestructible ». */
function hasKw(kw, pl) {
  const has = KW_GRANT[kw] || 'ont ' + (KW_FR[kw] || kw).toLowerCase();
  if (pl) {
    return has;
  }
  return has.startsWith('sont ') ? 'est ' + has.slice(5).replace(/s$/, '') : 'a ' + has.slice(4);
}

/** Paramètres de Forge et texte (français et anglais) d'un effet. id : préfixe des SVar de cette capacité. */
/** Effets qui visent un joueur : sur une malédiction, ils peuvent toucher le joueur enchanté au lieu d'un joueur ciblé. */
export const PLAYER_EFFECTS = new Set(['damagePlayer', 'damageOpponent', 'targetLoseLife', 'drainTarget', 'targetGainLife', 'targetDraw',
  'targetDiscard', 'targetMill', 'targetSacrifice', 'targetPoison']);

/**
 * Le joueur que chaque effet de joueur touche d'origine : any (un joueur ou un planeswalker ciblé), player (un joueur
 * ciblé), opponent (un adversaire ciblé), eachOpp (chaque adversaire). Le choix « Joueur » le change.
 */
const WHO_BASE = {damagePlayer: 'any', damageOpponent: 'opponent', targetLoseLife: 'player', drainTarget: 'player', targetGainLife: 'player',
  targetDraw: 'player', targetDiscard: 'player', targetMill: 'player', targetSacrifice: 'player', targetPoison: 'player', thoughtseize: 'player',
  exileGraveyard: 'player', damageOpponents: 'eachOpp', drain: 'eachOpp', poison: 'eachOpp', discard: 'eachOpp', millOpponents: 'eachOpp', edict: 'eachOpp',
  targetRadiation: 'player', targetRevealHand: 'player', lookHand: 'player', targetDiscardHand: 'player', targetDiscardRandom: 'player',
  targetExileTop: 'player', targetSacrificeType: 'player', playerCreaturesDebuff: 'player', playerTapAll: 'player', playerDestroyAll: 'player',
  targetToken: 'opponent', targetMonarch: 'player', targetSetLife: 'player', exchangeLife: 'opponent', targetSkipTurn: 'player', targetLoseGame: 'player'};
/** Effets dont le joueur peut changer (« Joueur : le joueur défenseur »). */
export const PLAYER_WHO = new Set(Object.keys(WHO_BASE));
/** Effets qui ne visent qu'un joueur à la fois (pas « chaque adversaire »). */
const WHO_ONE = new Set(['thoughtseize', 'exileGraveyard', 'lookHand', 'exchangeLife', 'targetMonarch']);
/** Effets qui ne marchent qu'avec un joueur ciblé (Forge lit la cible, pas « le joueur défenseur »). */
const WHO_TARGET_ONLY = new Set(['playerDestroyAll']);

/**
 * Le joueur dont parle un déclencheur : [pour Forge, en français, en anglais, libellé du choix]. « Quand elle attaque » :
 * le joueur défenseur ; « Quand elle inflige des blessures de combat à un joueur » : ce joueur ; « Quand un adversaire
 * lance un sort » : ce joueur…
 */
const THAT_PLAYER = (() => {
  const defending = ['TriggeredDefendingPlayer', 'le joueur défenseur', 'defending player', 'Le joueur défenseur (celui qu\'elle attaque)'];
  const damaged = ['TriggeredTarget', 'ce joueur', 'that player', 'Ce joueur (celui qui a subi les blessures)'];
  return {
    attacks: defending, attacksAlly: [...defending.slice(0, 3), 'Le joueur défenseur (celui que la créature attaque)'],
    attachedAttacks: [...defending.slice(0, 3), 'Le joueur défenseur (celui que la créature attaque)'],
    combatDamage: damaged, combatDamageAlly: damaged, attachedCombatDamage: damaged,
    oppCasts: ['TriggeredActivator', 'ce joueur', 'that player', 'Ce joueur (celui qui a lancé le sort)'],
    oppDiscards: ['TriggeredCardController', 'ce joueur', 'that player', 'Ce joueur (celui qui s\'est défaussé)'],
    oppLosesLife: ['TriggeredPlayer', 'ce joueur', 'that player', 'Ce joueur (celui qui a perdu des points de vie)'],
    oppUpkeep: ['TriggeredPlayer', 'ce joueur', 'that player', 'Ce joueur (celui dont c\'est l\'entretien)'],
    eachUpkeep: ['TriggeredPlayer', 'ce joueur', 'that player', 'Ce joueur (celui dont c\'est l\'entretien)'],
    eachEnd: ['TriggeredPlayer', 'ce joueur', 'that player', 'Ce joueur (celui dont c\'est le tour)'],
    oppCreatureEnters: ['TriggeredCardController', 'ce joueur', 'that player', 'Ce joueur (celui qui contrôle la créature)'],
    oppCreatureDies: ['TriggeredCardController', 'ce joueur', 'that player', 'Ce joueur (celui qui contrôlait la créature)'],
    anyDies: ['TriggeredCardController', 'le contrôleur de cette créature', 'its controller', 'Le contrôleur de la créature morte'],
    unblocked: defending,
    combatDamageOnce: damaged,
    attacksYou: ['TriggeredAttackerController', 'le contrôleur de cette créature', 'its controller', 'Le contrôleur de la créature qui attaque'],
    anyEnters: ['TriggeredCardController', 'le contrôleur de cette créature', 'its controller', 'Le contrôleur de la créature qui arrive'],
    oppLandfall: ['TriggeredCardController', 'ce joueur', 'that player', 'Ce joueur (celui qui contrôle le terrain)'],
    playerCasts: ['TriggeredActivator', 'ce joueur', 'that player', 'Ce joueur (celui qui a lancé le sort)'],
    tapsForMana: ['TriggeredActivator', 'ce joueur', 'that player', 'Ce joueur (celui qui a engagé le terrain)'],
    oppDraws: ['TriggeredPlayer', 'ce joueur', 'that player', 'Ce joueur (celui qui a pioché)'],
    eachDraw: ['TriggeredPlayer', 'ce joueur', 'that player', 'Ce joueur (celui dont c\'est l\'étape de pioche)'],
    oppEnd: ['TriggeredPlayer', 'ce joueur', 'that player', 'Ce joueur (celui dont c\'est le tour)'],
  };
})();

const WHO_LABELS = {any: 'un joueur ou un planeswalker ciblé', player: 'un joueur ciblé', opponent: 'un adversaire ciblé', eachOpp: 'chaque adversaire',
  each: 'chaque joueur'};

/**
 * Les joueurs proposés pour un effet de joueur, selon le déclencheur et la carte : [valeur, libellé]. « target » : le
 * joueur de l'effet tel qu'il est (le premier choix).
 */
export function whoChoices(effectId, when, card = null) {
  const base = WHO_BASE[effectId];
  if (!base) {
    return [];
  }
  const list = [['target', WHO_LABELS[base]]];
  for (const v of ['player', 'opponent', 'eachOpp', 'each']) {
    if (v !== base && !((WHO_ONE.has(effectId) || WHO_TARGET_ONLY.has(effectId)) && v.startsWith('each'))) {
      list.push([v, WHO_LABELS[v]]);
    }
  }
  if (WHO_TARGET_ONLY.has(effectId)) {
    return list;
  }
  const that = THAT_PLAYER[when];
  if (that) {
    list.push(['that', that[3]]);
  }
  if ((attachOf(card) || {}).kind === 'player') {
    list.push(['enchanted', 'le joueur enchanté (malédiction)']);
  }
  return list;
}

/** Ce que le choix « Joueur » met à la place du joueur de l'effet : {p (pour Forge), fr, en}, ou null (rien ne change). */
function whoTarget(a) {
  switch (a.who) {
    case 'player': return {p: 'ValidTgts$ Player | TgtPrompt$ Choisissez un joueur ciblé', fr: 'un joueur ciblé', en: 'target player'};
    case 'opponent': return {p: 'ValidTgts$ Opponent | TgtPrompt$ Choisissez un adversaire ciblé', fr: 'un adversaire ciblé', en: 'target opponent'};
    case 'eachOpp': return WHO_ONE.has(a.effect) || WHO_TARGET_ONLY.has(a.effect) ? null : {p: 'Defined$ Player.Opponent', fr: 'chaque adversaire', en: 'each opponent'};
    case 'each': return WHO_ONE.has(a.effect) || WHO_TARGET_ONLY.has(a.effect) ? null : {p: 'Defined$ Player', fr: 'chaque joueur', en: 'each player'};
    case 'that': {
      if (WHO_TARGET_ONLY.has(a.effect)) {
        return null;
      }
      const t = THAT_PLAYER[a.when];
      return t ? {p: `Defined$ ${t[0]}`, fr: t[1], en: t[2]} : null;
    }
    case 'enchanted': {
      if (WHO_TARGET_ONLY.has(a.effect)) {
        return null;
      }
      // « ce joueur » quand le déclencheur vient de lui (« Au début de l'entretien du joueur enchanté »).
      const that = (WHEN.find(x => x.id === a.when) || {}).attach === 'player';
      return {p: 'Defined$ EnchantedPlayer', fr: that ? 'ce joueur' : 'le joueur enchanté', en: that ? 'that player' : 'enchanted player'};
    }
    default: return null;
  }
}

/** Le joueur d'un effet dans ses paramètres de Forge et dans son texte (français, anglais). */
const WHO_SPEC = /ValidTgts\$ [^|]+\| TgtPrompt\$ [^|]*?(?=\s*\||\s*$)|Defined\$ Player(?:\.Opponent)?(?=\s*\||\s*$)/;
const WHO_FR = /(d')?(un joueur ou un planeswalker ciblé|un adversaire ciblé|un joueur ciblé|chaque adversaire)/;
const WHO_EN = /target player or planeswalker|target opponent|target player|each opponent/;

/**
 * Un effet : ses paramètres de Forge (p), ses lignes en plus, son texte. who : le joueur touché par un effet de joueur
 * (« le joueur défenseur », « ce joueur », « chaque adversaire », « le joueur enchanté » d'une malédiction…).
 */
function effect(a, id) {
  const r = effectBase(a, id);
  if (!r || !PLAYER_WHO.has(a.effect)) {
    return r;
  }
  const to = whoTarget(a);
  if (!to) {
    return r;
  }
  const fr = r.fr.replace(WHO_FR, (m, d) => (d ? 'de ' : '') + to.fr)
    .replace(/(^|\s)à le /g, '$1au ').replace(/\bde le /g, 'du ').replace(/\bde un /g, 'd\'un ');
  let p = r.p.replace(WHO_SPEC, to.p);
  // Des jetons créés par un autre joueur : « TokenOwner$ … » au lieu de « Defined$ … ».
  if (/TokenOwner\$ Targeted\b/.test(p) && to.p.startsWith('Defined$ ')) {
    p = p.replace(`${to.p} | `, '').replace(/TokenOwner\$ Targeted\b/, `TokenOwner$ ${to.p.slice(9)}`);
  }
  return {...r, p, fr, en: r.en.replace(WHO_EN, to.en)};
}

function effectBase(a, id) {
  const n = Math.max(0, Math.round(Number(a.n) || 0));
  const n1 = Math.max(1, n);
  const target = (what) => `ValidTgts$ ${what.v} | TgtPrompt$ ${what.prompt}`;
  const creature = {v: 'Creature', prompt: 'Choisissez une créature ciblée'};
  const ct = counterType(a);
  const countersFr = (k) => counterWords(ct, k, 'fr');
  const countersEn = (k) => counterWords(ct, k, 'en');
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
      return {p: `PutCounter | Defined$ Self | CounterType$ ${ct[0]} | CounterNum$ ${n}`, fr: `mettez ${countersFr(n)} sur CARDNAME`, en: `put ${countersEn(n)} on CARDNAME`};
    case 'countersEach':
      return {p: `PutCounterAll | ValidCards$ ${valid(a.filter)} | CounterType$ ${ct[0]} | CounterNum$ ${n}`,
        fr: `mettez ${countersFr(n)} sur chaque ${eachFr(a.filter)} que vous contrôlez`, en: `put ${countersEn(n)} on each ${eachEn(a.filter)} you control`};
    case 'countersAttached': {
      // « …sur la créature équipée » ; « sur elle » quand le déclencheur parle d'elle ; « cette créature » quand l'équipement s'y attache.
      const k = Math.max(1, n);
      const aura = a.attachTo === 'enchanted';
      const on = a.attachWhen === 'becomesAttached' ? ['TriggeredTarget', 'cette créature', 'that creature']
        : ['attachedAttacks', 'attachedCombatDamage'].includes(a.attachWhen) ? [aura ? 'Enchanted' : 'Equipped', 'elle', 'it']
          : [aura ? 'Enchanted' : 'Equipped', aura ? 'la créature enchantée' : 'la créature équipée', aura ? 'enchanted creature' : 'equipped creature'];
      return {p: `PutCounter | Defined$ ${on[0]} | CounterType$ ${ct[0]} | CounterNum$ ${k}`, fr: `mettez ${countersFr(k)} sur ${on[1]}`, en: `put ${countersEn(k)} on ${on[2]}`};
    }
    case 'countersTarget':
      return {p: `PutCounter | ${target(creature)} | CounterType$ ${ct[0]} | CounterNum$ ${n}${ct[0] === 'M1M1' ? ' | IsCurse$ True' : ''}`, fr: `mettez ${countersFr(n)} sur une créature ciblée`,
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
      const t = allTokens().find(x => x[0] === a.token) || (Array.isArray(a.tokenDef) && a.tokenDef[0] === a.token ? a.tokenDef : null) || TOKENS[0];
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
        fr: `chaque adversaire se défausse ${n1 === 1 ? 'd\'une carte' : 'de ' + word(n1, 'fr') + ' cartes'}`,
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
    case 'fightTargets':
      return {p: `Pump | ${target({v: 'Creature.YouCtrl', prompt: 'Choisissez une créature ciblée que vous contrôlez'})} | StackDescription$ None | SubAbility$ ${id}Fight`,
        extra: [`SVar:${id}Fight:DB$ Fight | Defined$ ParentTarget | ${target({v: 'Creature.YouDontCtrl', prompt: 'Choisissez une créature ciblée que vous ne contrôlez pas'})}`],
        fr: 'une créature ciblée que vous contrôlez se bat contre une créature ciblée que vous ne contrôlez pas',
        en: 'target creature you control fights target creature you don\'t control'};
    case 'damageBlocker': {
      const wounds = `${n} ${plural(n, 'blessure', 'blessures')}`;
      switch (a.when) {
        case 'blocks':
          return {p: `DealDamage | Defined$ TriggeredAttackers | NumDmg$ ${n}`, fr: `CARDNAME inflige ${wounds} à la créature qu'elle bloque`,
            en: `CARDNAME deals ${n} damage to the creature it blocks`};
        case 'blocked':
          return {p: `DealDamage | Defined$ TriggeredBlockers | NumDmg$ ${n}`, fr: `CARDNAME inflige ${wounds} à chaque créature qui la bloque`,
            en: `CARDNAME deals ${n} damage to each creature blocking it`};
        case 'allyBlocked':
          return {p: `DealDamage | Defined$ TriggeredBlockers | DamageSource$ TriggeredAttacker | NumDmg$ ${n}`,
            fr: `cette créature inflige ${wounds} à chaque créature qui la bloque`, en: `that creature deals ${n} damage to each creature blocking it`};
        default:
          return {p: `DealDamage | Defined$ TriggeredBlockerLKICopy | NumDmg$ ${n}`, fr: `CARDNAME inflige ${wounds} à cette créature`,
            en: `CARDNAME deals ${n} damage to that creature`};
      }
    }
    case 'putFromHand': {
      const k = cardKind(a);
      return {p: `ChangeZone | Origin$ Hand | Destination$ Battlefield | ChangeType$ ${owned(k[1])} | ChangeNum$ 1`,
        fr: `vous pouvez mettre sur le champ de bataille ${k[2]} de votre main`, en: `you may put ${k[3]} from your hand onto the battlefield`};
    }
    case 'castFree':
      return {p: `Play | Valid$ Card.nonLand+YouOwn+cmcLE${n} | ValidZone$ Hand | WithoutManaCost$ True | Optional$ True | Amount$ 1 | Controller$ You`,
        fr: `vous pouvez lancer un sort de valeur de mana inférieure ou égale à ${n} depuis votre main sans payer son coût de mana`,
        en: `you may cast a spell with mana value ${n} or less from your hand without paying its mana cost`};
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
      if (c === 'Symbols') {
        // « Ajoutez {G}{U} » : chaque symbole choisi (un nombre donne autant de mana incolore).
        const produced = [];
        for (const part of costParts(a.manaSymbols)) {
          if (/^\d+$/.test(part)) {
            produced.push(...Array(Math.min(10, Number(part))).fill('C'));
          } else if ('WUBRGC'.includes(part)) {
            produced.push(part);
          }
        }
        if (produced.length) {
          const sym = produced.map(x => `{${x}}`).join('');
          return {p: `Mana | Produced$ ${produced.join(' ')}`, fr: `ajoutez ${sym}`, en: `add ${sym}`};
        }
      }
      if (c === 'Any') {
        return {p: `Mana | Produced$ Any | Amount$ ${n1}`,
          fr: n1 === 1 ? 'ajoutez un mana de la couleur de votre choix' : `ajoutez ${word(n1, 'fr')} manas d'une même couleur de votre choix`,
          en: n1 === 1 ? 'add one mana of any color' : `add ${word(n1, 'en')} mana of any one color`};
      }
      if (c === 'Symbols') {
        return {p: 'Mana | Produced$ C', fr: 'ajoutez {C}', en: 'add {C}'};
      }
      const sym = `{${c}}`.repeat(Math.min(n1, 10));
      return {p: `Mana | Produced$ ${c} | Amount$ ${n1}`, fr: `ajoutez ${sym}`, en: `add ${sym}`};
    }
    case 'rampLand':
      return {p: 'ChangeZone | Origin$ Library | Destination$ Battlefield | ChangeType$ Land.Basic | ChangeNum$ 1 | Tapped$ True',
        fr: 'cherchez dans votre bibliothèque une carte de terrain de base, mettez-la sur le champ de bataille engagée, puis mélangez',
        en: 'search your library for a basic land card, put it onto the battlefield tapped, then shuffle'};
    case 'damagePlayer':
      return {p: `DealDamage | ${target({v: 'Player,Planeswalker', prompt: 'Choisissez un joueur ou un planeswalker ciblé'})} | NumDmg$ ${n}`,
        fr: `CARDNAME inflige ${n} ${plural(n, 'blessure', 'blessures')} à un joueur ou un planeswalker ciblé`, en: `CARDNAME deals ${n} damage to target player or planeswalker`};
    case 'damageOpponent':
      return {p: `DealDamage | ${target({v: 'Opponent', prompt: 'Choisissez un adversaire ciblé'})} | NumDmg$ ${n}`,
        fr: `CARDNAME inflige ${n} ${plural(n, 'blessure', 'blessures')} à un adversaire ciblé`, en: `CARDNAME deals ${n} damage to target opponent`};
    case 'targetLoseLife':
      return {p: `LoseLife | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | LifeAmount$ ${n}`,
        fr: `un joueur ciblé perd ${n} ${plural(n, 'point', 'points')} de vie`, en: `target player loses ${n} life`};
    case 'targetGainLife':
      return {p: `GainLife | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | LifeAmount$ ${n}`,
        fr: `un joueur ciblé gagne ${n} ${plural(n, 'point', 'points')} de vie`, en: `target player gains ${n} life`};
    case 'targetDraw':
      return {p: `Draw | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | NumCards$ ${n1}`,
        fr: `un joueur ciblé pioche ${n1 === 1 ? 'une carte' : word(n1, 'fr') + ' cartes'}`, en: `target player draws ${n1 === 1 ? 'a card' : word(n1, 'en') + ' cards'}`};
    case 'targetDiscard':
      return {p: `Discard | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | NumCards$ ${n1} | Mode$ TgtChoose`,
        fr: `un joueur ciblé se défausse ${n1 === 1 ? 'd\'une carte' : 'de ' + word(n1, 'fr') + ' cartes'}`, en: `target player discards ${n1 === 1 ? 'a card' : word(n1, 'en') + ' cards'}`};
    case 'targetMill':
      return {p: `Mill | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | NumCards$ ${n1}`,
        fr: `un joueur ciblé meule ${n1 === 1 ? 'une carte' : word(n1, 'fr') + ' cartes'}`, en: `target player mills ${n1 === 1 ? 'a card' : word(n1, 'en') + ' cards'}`};
    case 'targetSacrifice':
      return {p: `Sacrifice | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | SacValid$ Creature`,
        fr: 'un joueur ciblé sacrifie une créature', en: 'target player sacrifices a creature'};
    case 'doubleCountersTarget':
      return {p: `MultiplyCounter | ${target(creature)} | CounterType$ ${ct[0]}`, fr: `doublez le nombre de marqueurs ${ct[1]} sur une créature ciblée`,
        en: `double the number of ${ct[2]} counters on target creature`};
    case 'moveCounters':
      return {p: `MoveCounter | Source$ Self | ${target({v: 'Creature.Other', prompt: 'Choisissez une autre créature ciblée'})} | CounterType$ ${ct[0]} | CounterNum$ ${n1}`,
        fr: `déplacez ${countersFr(n1)} de CARDNAME sur une autre créature ciblée`, en: `move ${countersEn(n1)} from CARDNAME onto another target creature`};
    case 'removeAllCounters':
      return {p: `RemoveCounterAll | ValidCards$ Creature | CounterType$ ${ct[0]} | AllCounters$ True`, fr: `retirez tous les marqueurs ${ct[1]} de toutes les créatures`,
        en: `remove all ${ct[2]} counters from all creatures`};
    case 'animateSelf':
      return {p: `Animate | Defined$ Self | Power$ ${n} | Toughness$ ${n} | Types$ Creature`,
        fr: `jusqu'à la fin du tour, CARDNAME devient une créature ${n}/${n} en plus de ses autres types`,
        en: `until end of turn, CARDNAME becomes a ${n}/${n} creature in addition to its other types`};
    case 'animateTarget':
      return {p: `Animate | ${target(creature)} | Power$ ${n} | Toughness$ ${n}`, fr: `une créature ciblée a une force et une endurance de base de ${n}/${n} jusqu'à la fin du tour`,
        en: `target creature has base power and toughness ${n}/${n} until end of turn`};
    case 'animateLands':
      return {p: `AnimateAll | ValidCards$ Land.YouCtrl | Power$ ${n} | Toughness$ ${n} | Types$ Creature`,
        fr: `jusqu'à la fin du tour, les terrains que vous contrôlez deviennent des créatures ${n}/${n} qui sont toujours des terrains`,
        en: `until end of turn, lands you control become ${n}/${n} creatures that are still lands`};
    case 'animateAll': {
      const m = animParts(a);
      const perm = a.animDur === 'perm';
      return {p: `AnimateAll | ValidCards$ ${m.v} | Power$ ${n} | Toughness$ ${n} | Types$ Creature${m.t ? ',' + m.t : ''}${perm ? ' | Duration$ Permanent' : ''}`,
        fr: `${perm ? '' : 'jusqu\'à la fin du tour, '}${m.fr} deviennent des créatures ${n}/${n}${m.tFr} en plus de leurs autres types`,
        en: `${perm ? '' : 'until end of turn, '}${m.en} become ${n}/${n}${m.tEn} creatures in addition to their other types`};
    }
    case 'doubleCountersAll': {
      const each = !a.counter || a.counter === 'ALL';
      const all = a.dcWho === 'all';
      return {p: `MultiplyCounter | Defined$ Valid Creature${all ? '' : '.YouCtrl'}${each ? '' : ` | CounterType$ ${ct[0]}`}`,
        fr: `doublez le nombre ${each ? 'de chaque type de marqueur' : `de marqueurs ${ct[1]}`} sur chaque créature${all ? '' : ' que vous contrôlez'}`,
        en: `double the number of ${each ? 'each kind of counter' : `${ct[2]} counters`} on each creature${all ? '' : ' you control'}`};
    }
    case 'earthbend':
      return {p: `Earthbend | Num$ ${n1}`, fr: `maîtrisez la Terre ${n1}`, en: `earthbend ${n1}`};
    case 'airbend': {
      const k = AIR_KINDS.find(x => x[0] === a.airKind) || AIR_KINDS[0];
      const fem = k[0] === 'creature';
      return {p: `Airbend | ValidTgts$ ${k[2]} | TgtPrompt$ Choisissez ${fem ? 'une' : 'un'} ${k[3]}${n1 > 1 ? ` | TargetMin$ 0 | TargetMax$ ${n1}` : ''}`,
        fr: n1 > 1 ? `maîtrisez l'Air sur jusqu'à ${word(n1, 'fr')} ${k[4]}` : `maîtrisez l'Air sur ${fem ? 'une' : 'un'} ${k[3]}`,
        en: n1 > 1 ? `airbend up to ${word(n1, 'en')} target ${k[5]}s` : `airbend target ${k[5]}`};
    }
    case 'protectionTarget':
      return {p: `Protection | ${target({v: 'Creature.YouCtrl', prompt: 'Choisissez une créature ciblée que vous contrôlez'})} | Gains$ Choice | Choices$ AnyColor`,
        fr: 'une créature ciblée que vous contrôlez acquiert la protection contre la couleur de votre choix jusqu\'à la fin du tour',
        en: 'target creature you control gains protection from the color of your choice until end of turn'};
    case 'protectionAll':
      return {p: 'ProtectionAll | ValidCards$ Creature.YouCtrl | Gains$ Choice | Choices$ AnyColor',
        fr: 'les créatures que vous contrôlez acquièrent la protection contre la couleur de votre choix jusqu\'à la fin du tour',
        en: 'creatures you control gain protection from the color of your choice until end of turn'};
    case 'debuffTarget': {
      const kw = a.keyword || 'Flying';
      const has = KW_GRANT[kw] || 'ont ' + (KW_FR[kw] || kw).toLowerCase();
      const obj = has.startsWith('sont ') ? 'l\'indestructible' : has.slice(4);
      return {p: `Debuff | ${target(creature)} | Keywords$ ${kw}`, fr: `une créature ciblée perd ${obj} jusqu'à la fin du tour`,
        en: `target creature loses ${keywordLower(kw)} until end of turn`};
    }
    case 'regenerateTarget':
      return {p: `Regenerate | ${target(creature)}`, fr: 'régénérez une créature ciblée', en: 'regenerate target creature'};
    case 'mustBlock':
      return {p: `MustBlock | ${target(creature)}`, fr: 'une créature ciblée bloque CARDNAME ce tour-ci si elle le peut', en: 'target creature blocks CARDNAME this turn if able'};
    case 'removeFromCombat':
      return {p: `RemoveFromCombat | ${target({v: 'Creature.attacking,Creature.blocking', prompt: 'Choisissez une créature attaquante ou bloqueuse ciblée'})}`,
        fr: 'retirez du combat une créature attaquante ou bloqueuse ciblée', en: 'remove target attacking or blocking creature from combat'};
    case 'endure': {
      const w = mechWhoOf(a);
      return {p: `Endure | ${w[0]} | Num$ ${n1}`, fr: `${w[1]} ${w[3] ? 'endurent' : 'endure'} ${n1}`, en: w[3] ? `${w[2]} each endure ${n1}` : `${w[2]} endures ${n1}`};
    }
    case 'sacrificeEndStep':
      return {p: `DelayedTrigger | Mode$ Phase | Phase$ End of Turn | Execute$ ${id}Sac | TriggerDescription$ Sacrifiez CARDNAME.`,
        aux: [`SVar:${id}Sac:DB$ Sacrifice | SacValid$ Self`], fr: 'sacrifiez CARDNAME au début de la prochaine étape de fin',
        en: 'sacrifice CARDNAME at the beginning of the next end step'};
    case 'exileEndStep':
      return {p: `DelayedTrigger | Mode$ Phase | Phase$ End of Turn | Execute$ ${id}Exi | TriggerDescription$ Exilez CARDNAME.`,
        aux: [`SVar:${id}Exi:DB$ ChangeZone | Defined$ Self | Origin$ Battlefield | Destination$ Exile`], fr: 'exilez CARDNAME au début de la prochaine étape de fin',
        en: 'exile CARDNAME at the beginning of the next end step'};
    case 'flicker':
      return {p: `ChangeZone | ${target({v: 'Creature.YouCtrl', prompt: 'Choisissez une créature ciblée que vous contrôlez'})} | Origin$ Battlefield | Destination$ Exile | RememberTargets$ True | SubAbility$ ${id}Ret`,
        extra: [`SVar:${id}Ret:DB$ ChangeZone | Defined$ Remembered | Origin$ All | Destination$ Battlefield | GainControl$ True | SubAbility$ ${id}Clr`,
          `SVar:${id}Clr:DB$ Cleanup | ClearRemembered$ True`],
        fr: 'exilez une créature ciblée que vous contrôlez, puis renvoyez cette carte sur le champ de bataille sous le contrôle de son propriétaire',
        en: 'exile target creature you control, then return that card to the battlefield under its owner\'s control'};
    case 'flickerEnd':
      return {p: `ChangeZone | ${target(creature)} | Origin$ Battlefield | Destination$ Exile | RememberChanged$ True | SubAbility$ ${id}Del`,
        extra: [`SVar:${id}Del:DB$ DelayedTrigger | Mode$ Phase | Phase$ End of Turn | Execute$ ${id}Ret | RememberObjects$ Remembered | SubAbility$ ${id}Clr | TriggerDescription$ Renvoyez la carte exilée sur le champ de bataille.`,
          `SVar:${id}Clr:DB$ Cleanup | ClearRemembered$ True`],
        aux: [`SVar:${id}Ret:DB$ ChangeZone | Defined$ DelayTriggerRememberedLKI | Origin$ Exile | Destination$ Battlefield`],
        fr: 'exilez une créature ciblée. Renvoyez cette carte sur le champ de bataille sous le contrôle de son propriétaire au début de la prochaine étape de fin',
        en: 'exile target creature. Return that card to the battlefield under its owner\'s control at the beginning of the next end step'};
    case 'attachSelf':
      return {p: `Attach | ${target({v: 'Creature.YouCtrl', prompt: 'Choisissez une créature ciblée que vous contrôlez'})}`,
        fr: 'attachez CARDNAME à une créature ciblée que vous contrôlez', en: 'attach CARDNAME to target creature you control'};
    case 'tuckTop': {
      const pt = permType(a);
      return {p: `ChangeZone | ${target({v: pt[1], prompt: 'Choisissez ' + pt[2]})} | Origin$ Battlefield | Destination$ Library | LibraryPosition$ 0`,
        fr: `mettez ${pt[2]} au-dessus de la bibliothèque de son propriétaire`, en: `put ${pt[3]} on top of its owner's library`};
    }
    case 'exileUntilLeaves': {
      const pt = permType(a);
      return {p: `ChangeZone | ${target({v: pt[1], prompt: 'Choisissez ' + pt[2]})} | Origin$ Battlefield | Destination$ Exile | Duration$ UntilHostLeavesPlay`,
        fr: `exilez ${pt[2]} jusqu'à ce que CARDNAME quitte le champ de bataille`, en: `exile ${pt[3]} until CARDNAME leaves the battlefield`};
    }
    case 'sacrificeAllYours': {
      const pt = permType(a);
      return {p: `SacrificeAll | ValidCards$ ${owned(pt[1]).replace(/YouOwn/g, 'YouCtrl')}`, fr: `sacrifiez ${pt[4]} que vous contrôlez`, en: `sacrifice ${pt[5]} you control`};
    }
    case 'phaseOut':
      return {p: `Phases | ${target(creature)}`, fr: 'une créature ciblée passe hors phase', en: 'target creature phases out'};
    case 'detain':
      return {p: `Detain | ${target({v: 'Permanent.nonLand+OppCtrl', prompt: 'Choisissez un permanent non-terrain ciblé qu\'un adversaire contrôle'})}`,
        fr: 'détenez un permanent non-terrain ciblé qu\'un adversaire contrôle', en: 'detain target nonland permanent an opponent controls'};
    case 'tapOrUntap':
      return {p: `TapOrUntap | ${target({v: 'Permanent', prompt: 'Choisissez un permanent ciblé'})}`, fr: 'engagez ou dégagez un permanent ciblé', en: 'tap or untap target permanent'};
    case 'exchangeControlSelf':
      return {p: `ExchangeControl | Defined$ Self | ${target({v: 'Creature.OppCtrl', prompt: 'Choisissez une créature ciblée qu\'un adversaire contrôle'})}`,
        fr: 'échangez le contrôle de CARDNAME contre celui d\'une créature ciblée qu\'un adversaire contrôle',
        en: 'exchange control of CARDNAME and target creature an opponent controls'};
    case 'reanimateTyped': {
      // Sur le champ de bataille : une carte de permanent (pas un éphémère ni un rituel).
      const k = ['card', 'instantSorcery'].includes(a.cardKind || 'card') ? CARD_KINDS.find(x => x[0] === 'permanent') : cardKind(a);
      return {p: `ChangeZone | Origin$ Graveyard | Destination$ Battlefield | ${target({v: owned(k[1]), prompt: 'Choisissez ' + k[2] + ' de votre cimetière'})} | TgtZone$ Graveyard`,
        fr: `renvoyez ${k[2]} ciblée de votre cimetière sur le champ de bataille`.replace(/(un|une) carte(.*) ciblée/, '$1 carte$2 ciblée'),
        en: `return target ${k[3].replace(/^an? /, '')} from your graveyard to the battlefield`};
    }
    case 'playHideaway':
      return {p: 'Play | Defined$ ExiledWith | Amount$ All | Controller$ You | WithoutManaCost$ True | Optional$ True',
        fr: 'vous pouvez jouer la carte exilée sans payer son coût de mana', en: 'you may play the exiled card without paying its mana cost'};
    case 'castFromGraveyard':
      return {p: `Play | ${target({v: 'Instant.YouOwn,Sorcery.YouOwn', prompt: 'Choisissez un éphémère ou un rituel de votre cimetière'})} | TgtZone$ Graveyard | ValidSA$ Spell | WithoutManaCost$ True | ReplaceGraveyard$ Exile | Optional$ True`,
        fr: 'vous pouvez lancer une carte d\'éphémère ou de rituel ciblée de votre cimetière sans payer son coût de mana. Si cette carte devait être mise dans votre cimetière, exilez-la à la place',
        en: 'you may cast target instant or sorcery card from your graveyard without paying its mana cost. If that card would be put into your graveyard, exile it instead'};
    case 'digUntil': {
      const k = cardKind(a);
      return {p: `DigUntil | Valid$ ${k[1]} | ValidDescription$ ${k[3].replace(/^an? /, '')} | FoundDestination$ Hand | RevealedDestination$ Library | RevealedLibraryPosition$ -1 | RevealRandomOrder$ True`,
        fr: `révélez des cartes du dessus de votre bibliothèque jusqu'à révéler ${k[2]}. Mettez-la dans votre main et le reste au-dessous de votre bibliothèque dans un ordre aléatoire`,
        en: `reveal cards from the top of your library until you reveal ${k[3]}. Put that card into your hand and the rest on the bottom of your library in a random order`};
    }
    case 'preventDamage':
      return {p: `PreventDamage | ValidTgts$ Any | TgtPrompt$ Choisissez une cible | Amount$ ${n1}`,
        fr: `prévenez les ${n1} prochaines blessures qui devraient être infligées à n'importe quelle cible ce tour-ci`.replace('les 1 prochaines blessures qui devraient', 'la prochaine blessure qui devrait'),
        en: `prevent the next ${n1} damage that would be dealt to any target this turn`};
    case 'extraLandTurn':
      return {p: `Effect | StaticAbilities$ ${id}Land`, aux: [`SVar:${id}Land:Mode$ Continuous | Affected$ You | AdjustLandPlays$ 1 | Description$ Vous pouvez jouer un terrain supplémentaire ce tour-ci.`],
        fr: 'vous pouvez jouer un terrain supplémentaire ce tour-ci', en: 'you may play an additional land this turn'};
    case 'endTurn':
      return {p: 'EndTurn', fr: 'terminez le tour', en: 'end the turn'};
    case 'flipCoin':
      return {p: 'FlipCoin', fr: 'jouez à pile ou face', en: 'flip a coin'};
    case 'targetRadiation':
      return {p: `Radiation | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | Num$ ${n1}`,
        fr: `un joueur ciblé gagne ${n1 === 1 ? 'un marqueur' : word(n1, 'fr') + ' marqueurs'} « radiation »`,
        en: `target player gets ${n1 === 1 ? 'a rad counter' : word(n1, 'en') + ' rad counters'}`};
    case 'targetRevealHand':
      return {p: `RevealHand | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})}`, fr: 'un joueur ciblé révèle sa main', en: 'target player reveals their hand'};
    case 'lookHand':
      return {p: `RevealHand | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | Look$ True`, fr: 'regardez la main d\'un joueur ciblé',
        en: 'look at target player\'s hand'};
    case 'targetDiscardHand':
      return {p: `Discard | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | Mode$ Hand`, fr: 'un joueur ciblé se défausse de sa main',
        en: 'target player discards their hand'};
    case 'targetDiscardRandom':
      return {p: `Discard | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | NumCards$ ${n1} | Mode$ Random`,
        fr: `un joueur ciblé se défausse ${n1 === 1 ? 'd\'une carte' : 'de ' + word(n1, 'fr') + ' cartes'} au hasard`,
        en: `target player discards ${n1 === 1 ? 'a card' : word(n1, 'en') + ' cards'} at random`};
    case 'targetExileTop':
      return {p: `Mill | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | NumCards$ ${n1} | Destination$ Exile`,
        fr: `exilez ${n1 === 1 ? 'la carte' : 'les ' + word(n1, 'fr') + ' cartes'} du dessus de la bibliothèque d'un joueur ciblé`,
        en: `exile the top ${n1 === 1 ? 'card' : word(n1, 'en') + ' cards'} of target player's library`};
    case 'targetSacrificeType': {
      const k = SAC_KINDS.find(x => x[0] === a.sacKind) || SAC_KINDS[0];
      return {p: `Sacrifice | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | SacValid$ ${k[1]} | SacMessage$ ${k[3].replace(/^an? /, '')}`,
        fr: `un joueur ciblé sacrifie ${k[2]}`, en: `target player sacrifices ${k[3]}`};
    }
    case 'playerCreaturesDebuff':
      return {p: `PumpAll | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | ValidCards$ Creature | NumAtt$ -${n} | NumDef$ -${n} | IsCurse$ True`,
        fr: `les créatures que contrôle un joueur ciblé gagnent -${n}/-${n} jusqu'à la fin du tour`,
        en: `creatures target player controls get -${n}/-${n} until end of turn`};
    case 'playerTapAll':
      return {p: `TapAll | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | ValidCards$ Creature`, fr: 'engagez toutes les créatures que contrôle un joueur ciblé',
        en: 'tap all creatures target player controls'};
    case 'playerDestroyAll':
      return {p: `DestroyAll | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | ValidCards$ Creature`, fr: 'détruisez toutes les créatures que contrôle un joueur ciblé',
        en: 'destroy all creatures target player controls'};
    case 'targetToken': {
      const t = allTokens().find(x => x[0] === a.token) || (Array.isArray(a.tokenDef) && a.tokenDef[0] === a.token ? a.tokenDef : null) || TOKENS[0];
      const enT = `${n1 === 1 ? article(t[3]) : word(n1, 'en')} ${t[3]} ${plural(n1, 'token', 'tokens')}${t[4] ? ' with ' + t[4] : ''}`;
      return {p: `Token | ${target({v: 'Opponent', prompt: 'Choisissez un adversaire ciblé'})} | TokenAmount$ ${n1} | TokenScript$ ${t[0]} | TokenOwner$ Targeted`,
        fr: `un adversaire ciblé crée ${n1 === 1 ? 'un jeton' : word(n1, 'fr') + ' jetons'} ${t[2]}`, en: `target opponent creates ${enT}`};
    }
    case 'targetMonarch':
      return {p: `BecomeMonarch | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})}`, fr: 'un joueur ciblé devient le monarque', en: 'target player becomes the monarch'};
    case 'targetSetLife':
      return {p: `SetLife | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | LifeAmount$ ${n}`,
        fr: `le total de points de vie d'un joueur ciblé devient ${n}`, en: `target player's life total becomes ${n}`};
    case 'exchangeLife':
      return {p: `ExchangeLife | ${target({v: 'Opponent', prompt: 'Choisissez un adversaire ciblé'})}`,
        fr: 'échangez votre total de points de vie contre celui d\'un adversaire ciblé', en: 'exchange life totals with target opponent'};
    case 'targetSkipTurn':
      return {p: `SkipTurn | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | NumTurns$ 1`, fr: 'un joueur ciblé passe son prochain tour',
        en: 'target player skips their next turn'};
    case 'targetLoseGame':
      return {p: `LosesGame | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})}`, fr: 'un joueur ciblé perd la partie', en: 'target player loses the game'};
    case 'silence':
      return {p: `Effect | StaticAbilities$ ${id}Silence`, aux: [`SVar:${id}Silence:Mode$ CantBeCast | ValidCard$ Card | Caster$ Opponent | Description$ Vos adversaires ne peuvent pas lancer de sorts.`],
        fr: 'vos adversaires ne peuvent pas lancer de sorts ce tour-ci', en: 'your opponents can\'t cast spells this turn'};
    case 'targetPoison':
      return {p: `Poison | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | Num$ ${n1}`,
        fr: `un joueur ciblé gagne ${n1 === 1 ? 'un marqueur' : word(n1, 'fr') + ' marqueurs'} « poison »`,
        en: `target player gets ${n1 === 1 ? 'a poison counter' : word(n1, 'en') + ' poison counters'}`};
    case 'discover':
      return {p: `Discover | Num$ ${n1}`, fr: `découvrez ${n1}`, en: `discover ${n1}`};
    case 'explore': {
      const w = mechWhoOf(a);
      return {p: `Explore | ${w[0]}`, fr: `${w[1]} ${w[3] ? 'explorent' : 'explore'}`, en: w[3] ? `${w[2]} each explore` : `${w[2]} explores`};
    }
    case 'connive': {
      const w = mechWhoOf(a);
      return {p: `Connive | ${w[0]}`, fr: `${w[1]} ${w[3] ? 'complotent' : 'complote'}`, en: w[3] ? `${w[2]} each connive` : `${w[2]} connives`};
    }
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
    case 'damageEachCreature':
      return {p: `DamageAll | ValidCards$ Creature | NumDmg$ ${n}`, fr: `CARDNAME inflige ${n} ${plural(n, 'blessure', 'blessures')} à chaque créature`,
        en: `CARDNAME deals ${n} damage to each creature`};
    case 'damageEachOppCreature':
      return {p: `DamageAll | ValidCards$ Creature.OppCtrl | NumDmg$ ${n}`,
        fr: `CARDNAME inflige ${n} ${plural(n, 'blessure', 'blessures')} à chaque créature que vos adversaires contrôlent`,
        en: `CARDNAME deals ${n} damage to each creature your opponents control`};
    case 'earthquake':
      return {p: `DamageAll | ValidCards$ Creature.withoutFlying | ValidPlayers$ Player | NumDmg$ ${n}`,
        fr: `CARDNAME inflige ${n} ${plural(n, 'blessure', 'blessures')} à chaque créature sans le vol et à chaque joueur`,
        en: `CARDNAME deals ${n} damage to each creature without flying and each player`};
    case 'loseLifeYou':
      return {p: `LoseLife | Defined$ You | LifeAmount$ ${n}`, fr: `vous perdez ${n} ${plural(n, 'point', 'points')} de vie`, en: `you lose ${n} life`};
    case 'fog':
      return {p: 'Fog', fr: 'prévenez toutes les blessures de combat qui devraient être infligées ce tour-ci',
        en: 'prevent all combat damage that would be dealt this turn'};
    case 'poison':
      return {p: `Poison | Defined$ Player.Opponent | Num$ ${n1}`,
        fr: `chaque adversaire gagne ${n1 === 1 ? 'un marqueur' : word(n1, 'fr') + ' marqueurs'} « poison »`,
        en: `each opponent gets ${n1 === 1 ? 'a poison counter' : word(n1, 'en') + ' poison counters'}`};
    case 'energy': {
      const e = '{E}'.repeat(Math.min(n1, 10));
      return {p: `PutCounter | Defined$ You | CounterType$ ENERGY | CounterNum$ ${n1}`, fr: `vous gagnez ${e}`, en: `you get ${e}`};
    }
    case 'experience':
      return {p: `PutCounter | Defined$ You | CounterType$ EXPERIENCE | CounterNum$ ${n1}`,
        fr: `vous gagnez ${n1 === 1 ? 'un marqueur' : word(n1, 'fr') + ' marqueurs'} « expérience »`,
        en: n1 === 1 ? 'you get an experience counter' : `you get ${word(n1, 'en')} experience counters`};
    case 'countersPermTarget': {
      const pt = permType(a);
      return {p: `PutCounter | ${target({v: pt[1], prompt: 'Choisissez ' + pt[2]})} | CounterType$ ${ct[0]} | CounterNum$ ${n1}${ct[0] === 'M1M1' ? ' | IsCurse$ True' : ''}`,
        fr: `mettez ${countersFr(n1)} sur ${pt[2]}`, en: `put ${countersEn(n1)} on ${pt[3]}`};
    }
    case 'removeCountersSelf':
      return {p: `RemoveCounter | Defined$ Self | CounterType$ ${ct[0]} | CounterNum$ ${n1}`, fr: `retirez ${countersFr(n1)} de CARDNAME`,
        en: `remove ${countersEn(n1)} from CARDNAME`};
    case 'removeCountersTarget': {
      const pt = permType(a);
      return {p: `RemoveCounter | ${target({v: pt[1], prompt: 'Choisissez ' + pt[2]})} | CounterType$ ${ct[0]} | CounterNum$ ${n1}`,
        fr: `retirez ${countersFr(n1)} ${deWord(pt[2])}`, en: `remove ${countersEn(n1)} from ${pt[3]}`};
    }
    case 'drawEach':
      return {p: `Draw | Defined$ Player | NumCards$ ${n1}`, fr: `chaque joueur pioche ${n1 === 1 ? 'une carte' : word(n1, 'fr') + ' cartes'}`,
        en: `each player draws ${n1 === 1 ? 'a card' : word(n1, 'en') + ' cards'}`};
    case 'rummage':
      return {p: `Discard | Defined$ You | NumCards$ ${n1} | Mode$ TgtChoose | SubAbility$ ${id}Rum`,
        extra: [`SVar:${id}Rum:DB$ Draw | Defined$ You | NumCards$ ${n1}`],
        fr: n1 === 1 ? 'défaussez-vous d\'une carte, puis piochez une carte' : `défaussez-vous de ${word(n1, 'fr')} cartes, puis piochez ${word(n1, 'fr')} cartes`,
        en: n1 === 1 ? 'discard a card, then draw a card' : `discard ${word(n1, 'en')} cards, then draw ${word(n1, 'en')} cards`};
    case 'wheel':
      return {p: `Discard | Mode$ Hand | Defined$ Player | SubAbility$ ${id}Whl`, extra: [`SVar:${id}Whl:DB$ Draw | Defined$ Player | NumCards$ ${n1}`],
        fr: `chaque joueur se défausse de sa main, puis pioche ${n1 === 1 ? 'une carte' : word(n1, 'fr') + ' cartes'}`,
        en: `each player discards their hand, then draws ${n1 === 1 ? 'a card' : word(n1, 'en') + ' cards'}`};
    case 'dig': {
      const k = Math.max(2, n1);
      return {p: `Dig | DigNum$ ${k} | ChangeNum$ 1 | NoReveal$ True`,
        fr: `regardez les ${word(k, 'fr')} cartes du dessus de votre bibliothèque. Mettez l'une d'elles dans votre main et le reste au-dessous de votre bibliothèque, dans l'ordre de votre choix`,
        en: `look at the top ${word(k, 'en')} cards of your library. Put one of them into your hand and the rest on the bottom of your library in any order`};
    }
    case 'digTyped': {
      const k = Math.max(1, n1);
      const c = cardKind(a);
      return {p: `Dig | DigNum$ ${k} | ChangeNum$ 1 | ChangeValid$ ${c[1]} | RestRandomOrder$ True`,
        fr: `révélez les ${word(k, 'fr')} cartes du dessus de votre bibliothèque. Vous pouvez mettre ${c[2]} parmi elles dans votre main. Mettez le reste au-dessous de votre bibliothèque dans un ordre aléatoire`,
        en: `reveal the top ${word(k, 'en')} cards of your library. You may put ${c[3]} from among them into your hand. Put the rest on the bottom of your library in a random order`};
    }
    case 'impulse':
      return {p: `Dig | Defined$ You | DigNum$ ${n1} | ChangeNum$ All | DestinationZone$ Exile | RememberChanged$ True | SubAbility$ ${id}Imp`,
        extra: [`SVar:${id}Imp:DB$ Effect | StaticAbilities$ ${id}May | Duration$ UntilTheEndOfYourNextTurn | RememberObjects$ Remembered | ForgetOnMoved$ Exile | SubAbility$ ${id}Cln`,
          `SVar:${id}Cln:DB$ Cleanup | ClearRemembered$ True`],
        aux: [`SVar:${id}May:Mode$ Continuous | Affected$ Card.IsRemembered | AffectedZone$ Exile | MayPlay$ True | Description$ Jusqu'à la fin de votre prochain tour, vous pouvez jouer ces cartes.`],
        fr: n1 === 1 ? 'exilez la carte du dessus de votre bibliothèque. Jusqu\'à la fin de votre prochain tour, vous pouvez la jouer'
          : `exilez les ${word(n1, 'fr')} cartes du dessus de votre bibliothèque. Jusqu'à la fin de votre prochain tour, vous pouvez jouer ces cartes`,
        en: n1 === 1 ? 'exile the top card of your library. Until the end of your next turn, you may play that card'
          : `exile the top ${word(n1, 'en')} cards of your library. Until the end of your next turn, you may play those cards`};
    case 'thoughtseize':
      return {p: `Discard | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | NumCards$ 1 | DiscardValid$ Card.nonLand | Mode$ RevealYouChoose`,
        fr: 'un joueur ciblé révèle sa main. Choisissez-y une carte non-terrain. Ce joueur se défausse de cette carte',
        en: 'target player reveals their hand. You choose a nonland card from it. That player discards that card'};
    case 'tutorTyped': {
      const c = cardKind(a);
      return {p: `ChangeZone | Origin$ Library | Destination$ Hand | ChangeType$ ${c[1]} | ChangeNum$ 1`,
        fr: `cherchez dans votre bibliothèque ${c[2]}, révélez-la, mettez-la dans votre main, puis mélangez`,
        en: `search your library for ${c[3]}, reveal it, put it into your hand, then shuffle`};
    }
    case 'tutorBattlefield': {
      const c = cardKind(a);
      return {p: `ChangeZone | Origin$ Library | Destination$ Battlefield | ChangeType$ ${c[1]} | ChangeNum$ 1`,
        fr: `cherchez dans votre bibliothèque ${c[2]}, mettez-la sur le champ de bataille, puis mélangez`,
        en: `search your library for ${c[3]}, put it onto the battlefield, then shuffle`};
    }
    case 'regrowthTyped': {
      const c = cardKind(a);
      return {p: `ChangeZone | Origin$ Graveyard | Destination$ Hand | ${target({v: owned(c[1]), prompt: 'Choisissez une carte dans votre cimetière'})}`,
        fr: `renvoyez ${c[2]} ciblée de votre cimetière dans votre main`, en: `return target ${c[3].replace(/^an? /, '')} from your graveyard to your hand`};
    }
    case 'shuffleGraveyard':
      return {p: 'ChangeZoneAll | ChangeType$ Card.YouOwn | Origin$ Graveyard | Destination$ Library | Shuffle$ True',
        fr: 'mélangez votre cimetière dans votre bibliothèque', en: 'shuffle your graveyard into your library'};
    case 'exileGraveyard':
      return {p: `ChangeZoneAll | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | Origin$ Graveyard | Destination$ Exile | ChangeType$ Card`,
        fr: 'exilez le cimetière d\'un joueur ciblé', en: 'exile target player\'s graveyard'};
    case 'shrinkTarget':
      return {p: `Pump | ${target(creature)} | NumAtt$ -${n} | NumDef$ -${n} | IsCurse$ True`, fr: `une créature ciblée gagne -${n}/-${n} jusqu'à la fin du tour`,
        en: `target creature gets -${n}/-${n} until end of turn`};
    case 'shrinkOpp':
      return {p: `PumpAll | ValidCards$ Creature.OppCtrl | NumAtt$ -${n} | NumDef$ -${n} | IsCurse$ True`,
        fr: `les créatures que vos adversaires contrôlent gagnent -${n}/-${n} jusqu'à la fin du tour`,
        en: `creatures your opponents control get -${n}/-${n} until end of turn`};
    case 'keywordTarget': {
      const kw = a.keyword || 'Flying';
      return {p: `Pump | ${target(creature)} | KW$ ${kw}`, fr: `une créature ciblée ${gainsKw(kw, false)} jusqu'à la fin du tour`,
        en: `target creature gains ${keywordLower(kw)} until end of turn`};
    }
    case 'unblockableTarget':
      return {p: `Pump | ${target(creature)} | KW$ HIDDEN Unblockable`, fr: 'une créature ciblée ne peut pas être bloquée ce tour-ci',
        en: 'target creature can\'t be blocked this turn'};
    case 'populate':
      return {p: 'CopyPermanent | Populate$ True', fr: 'peuplez', en: 'populate'};
    case 'monstrosity':
      return {p: `PutCounter | Monstrosity$ ${n1}`, fr: `monstruosité ${n1}`, en: `monstrosity ${n1}`};
    case 'adapt':
      return {p: `PutCounter | Adapt$ ${n1}`, fr: `adaptez ${n1}`, en: `adapt ${n1}`};
    case 'bolster':
      return {p: `PutCounter | Bolster$ ${n1}`, fr: `renforcement ${n1}`, en: `bolster ${n1}`};
    case 'support':
      return {p: `PutCounter | Support$ ${n1}`, fr: `soutenez ${n1}`, en: `support ${n1}`};
    case 'bite':
      return {p: `Pump | ${target({v: 'Creature.YouCtrl', prompt: 'Choisissez une créature ciblée que vous contrôlez'})} | AILogic$ PowerDmg | SubAbility$ ${id}Bite`,
        extra: [`SVar:${id}Bite:DB$ DealDamage | ${target({v: 'Creature.YouDontCtrl', prompt: 'Choisissez une créature ciblée que vous ne contrôlez pas'})} | AILogic$ PowerDmg | NumDmg$ ${id}Pow | DamageSource$ ParentTarget`],
        aux: [`SVar:${id}Pow:ParentTargeted$CardPower`],
        fr: 'une créature ciblée que vous contrôlez inflige des blessures égales à sa force à une créature ciblée que vous ne contrôlez pas',
        en: 'target creature you control deals damage equal to its power to target creature you don\'t control'};
    case 'untapAllYours':
      return {p: 'UntapAll | ValidCards$ Creature.YouCtrl', fr: 'dégagez toutes les créatures que vous contrôlez', en: 'untap all creatures you control'};
    case 'sacrificeSelf':
      return {p: 'Sacrifice | Defined$ Self', fr: 'sacrifiez CARDNAME', en: 'sacrifice CARDNAME'};
    case 'destroyOpp':
    case 'exileOpp':
    case 'bounceOpp': {
      // « … qu'un adversaire contrôle » : l'effet d'un type, avec un type de l'adversaire (une créature par défaut).
      const pt = OPP_PERM_TYPES.some(t => t[0] === a.permType) ? a.permType : 'oppCreature';
      const typed = {destroyOpp: 'destroyTyped', exileOpp: 'exileTyped', bounceOpp: 'bounceTyped'}[a.effect];
      return effectBase({...a, effect: typed, permType: pt}, id);
    }
    case 'destroyTyped': {
      const t = permType(a);
      return {p: `Destroy | ${target({v: t[1], prompt: `Choisissez ${t[2]}`})}`, fr: `détruisez ${t[2]}`, en: `destroy ${t[3]}`};
    }
    case 'destroyAllTyped': {
      const t = permType(a);
      return {p: `DestroyAll | ValidCards$ ${t[1]}`, fr: `détruisez ${t[4]}`, en: `destroy ${t[5]}`};
    }
    case 'sacrificeEach':
      return {p: 'Sacrifice | Defined$ Player | SacValid$ Creature', fr: 'chaque joueur sacrifie une créature', en: 'each player sacrifices a creature'};
    case 'exileTyped': {
      const t = permType(a);
      return {p: `ChangeZone | ${target({v: t[1], prompt: `Choisissez ${t[2]}`})} | Origin$ Battlefield | Destination$ Exile`, fr: `exilez ${t[2]}`, en: `exile ${t[3]}`};
    }
    case 'destroyN':
    case 'exileN': {
      // « Détruisez deux créatures ciblées », « Exilez X artefacts ciblés » (X payé en lançant le sort).
      const t = permType(a);
      const pl = PERM_PLURAL[t[0]] || PERM_PLURAL.permanent;
      const k = n1;
      const verb = a.effect === 'destroyN' ? ['Destroy', 'détruisez', 'destroy'] : ['ChangeZone | Origin$ Battlefield | Destination$ Exile', 'exilez', 'exile'];
      const num = (lang) => (k < 20 ? word(k, lang) : String(k));
      return {p: `${verb[0]} | ValidTgts$ ${t[1]} | TgtPrompt$ Choisissez les ${pl[0]} | TargetMin$ ${k} | TargetMax$ ${k}`,
        fr: k === 1 ? `${verb[1]} ${t[2]}` : `${verb[1]} ${num('fr')} ${pl[0]}`,
        en: k === 1 ? `${verb[2]} ${t[3]}` : `${verb[2]} ${num('en')} ${pl[1]}`};
    }
    case 'destroyMv':
    case 'exileMv': {
      // « Détruisez chaque artefact dont la valeur de mana est inférieure ou égale à X. »
      const t = permType(a);
      const pl = PERM_PLURAL[t[0]] || PERM_PLURAL.permanent;
      const valid = withProp(t[1], `cmcLE${n}`);
      const destroy = a.effect === 'destroyMv';
      return {p: destroy ? `DestroyAll | ValidCards$ ${valid}` : `ChangeZoneAll | ChangeType$ ${valid} | Origin$ Battlefield | Destination$ Exile`,
        fr: `${destroy ? 'détruisez' : 'exilez'} ${pl[2]} dont la valeur de mana est inférieure ou égale à ${n}`,
        en: `${destroy ? 'destroy' : 'exile'} ${pl[3]} with mana value ${n} or less`};
    }
    case 'exileAllTyped': {
      const t = permType(a);
      return {p: `ChangeZoneAll | ChangeType$ ${t[1]} | Origin$ Battlefield | Destination$ Exile`, fr: `exilez ${t[4]}`, en: `exile ${t[5]}`};
    }
    case 'bounceTyped': {
      const t = permType(a);
      return {p: `ChangeZone | ${target({v: t[1], prompt: `Choisissez ${t[2]}`})} | Origin$ Battlefield | Destination$ Hand`,
        fr: `renvoyez ${t[2]} dans la main de son propriétaire`, en: `return ${t[3]} to its owner's hand`};
    }
    case 'bounceAllTyped': {
      const t = permType(a);
      return {p: `ChangeZoneAll | ChangeType$ ${t[1]} | Origin$ Battlefield | Destination$ Hand`,
        fr: `renvoyez ${t[4]} dans les mains de leurs propriétaires`, en: `return ${t[5]} to their owners' hands`};
    }
    case 'tuck': {
      const t = permType(a);
      return {p: `ChangeZone | ${target({v: t[1], prompt: `Choisissez ${t[2]}`})} | Origin$ Battlefield | Destination$ Library | LibraryPosition$ -1`,
        fr: `mettez ${t[2]} au-dessous de la bibliothèque de son propriétaire`, en: `put ${t[3]} on the bottom of its owner's library`};
    }
    case 'counterCreature':
      return {p: 'Counter | TargetType$ Spell | ValidTgts$ Creature | TgtPrompt$ Choisissez un sort de créature ciblé', fr: 'contrecarrez un sort de créature ciblé',
        en: 'counter target creature spell'};
    case 'counterNonCreature':
      return {p: 'Counter | TargetType$ Spell | ValidTgts$ Card.nonCreature | TgtPrompt$ Choisissez un sort non-créature ciblé',
        fr: 'contrecarrez un sort non-créature ciblé', en: 'counter target noncreature spell'};
    case 'counterUnless':
      return {p: `Counter | TargetType$ Spell | ValidTgts$ Card | TgtPrompt$ Choisissez un sort ciblé | UnlessCost$ ${n1} | UnlessPayer$ TargetedController`,
        fr: `contrecarrez un sort ciblé à moins que son contrôleur ne paie {${n1}}`, en: `counter target spell unless its controller pays {${n1}}`};
    case 'counterAbility':
      return {p: 'Counter | TargetType$ Activated,Triggered | ValidTgts$ Card | TgtPrompt$ Choisissez une capacité activée ou déclenchée ciblée',
        fr: 'contrecarrez une capacité activée ou déclenchée ciblée', en: 'counter target activated or triggered ability'};
    case 'tapAllOpp':
      return {p: 'TapAll | ValidCards$ Creature.OppCtrl', fr: 'engagez toutes les créatures que vos adversaires contrôlent', en: 'tap all creatures your opponents control'};
    case 'cantBlockOpp':
      return {p: 'PumpAll | ValidCards$ Creature.OppCtrl | KW$ HIDDEN CARDNAME can\'t block. | IsCurse$ True',
        fr: 'les créatures que vos adversaires contrôlent ne peuvent pas bloquer ce tour-ci', en: 'creatures your opponents control can\'t block this turn'};
    case 'gainControl': {
      const t = permType(a);
      return {p: `GainControl | ${target({v: t[1], prompt: `Choisissez ${t[2]}`})}`, fr: `acquérez le contrôle ${deWord(t[2])}`, en: `gain control of ${t[3]}`};
    }
    case 'rampTwo':
      return {p: 'ChangeZone | Origin$ Library | Destination$ Battlefield | ChangeType$ Land.Basic | ChangeNum$ 2 | Tapped$ True',
        fr: 'cherchez dans votre bibliothèque jusqu\'à deux cartes de terrain de base, mettez-les sur le champ de bataille engagées, puis mélangez',
        en: 'search your library for up to two basic land cards, put them onto the battlefield tapped, then shuffle'};
    case 'landFromHand':
      return {p: 'ChangeZone | Origin$ Hand | Destination$ Battlefield | ChangeType$ Land | ChangeNum$ 1',
        fr: 'vous pouvez mettre sur le champ de bataille une carte de terrain de votre main', en: 'you may put a land card from your hand onto the battlefield'};
    case 'drainTarget':
      return {p: `LoseLife | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | LifeAmount$ ${n} | SubAbility$ ${id}Gain`,
        extra: [`SVar:${id}Gain:DB$ GainLife | Defined$ You | LifeAmount$ ${n}`],
        fr: `un joueur ciblé perd ${n} ${plural(n, 'point', 'points')} de vie et vous gagnez ${n} ${plural(n, 'point', 'points')} de vie`,
        en: `target player loses ${n} life and you gain ${n} life`};
    case 'extraTurn':
      return {p: 'AddTurn | Defined$ You | NumTurns$ 1', fr: 'jouez un tour supplémentaire après celui-ci', en: 'take an extra turn after this one'};
    case 'extraCombat':
      return {p: 'AddPhase | ExtraPhase$ Combat | FollowedBy$ Main2 | ConditionPhases$ Main1,Main2',
        fr: 'cette phase est suivie d\'une phase de combat supplémentaire, puis d\'une phase principale supplémentaire',
        en: 'after this main phase, there is an additional combat phase followed by an additional main phase'};
    case 'copySpell':
      return {p: 'CopySpellAbility | ValidTgts$ Instant,Sorcery | TargetType$ Spell | MayChooseTarget$ True | TgtPrompt$ Choisissez un sort d\'éphémère ou de rituel ciblé',
        fr: 'copiez un sort d\'éphémère ou de rituel ciblé. Vous pouvez choisir de nouvelles cibles pour la copie',
        en: 'copy target instant or sorcery spell. You may choose new targets for the copy'};
    case 'emblem': {
      const st = staticCore({...a, effect: a.emblem || 'anthem', scope: 'you', filter: {type: '', other: false}, cond: 'none'}, `${id}E`, 'fr');
      const stEn = staticCore({...a, effect: a.emblem || 'anthem', scope: 'you', filter: {type: '', other: false}, cond: 'none'}, `${id}E`, 'en');
      if (!st || !st.s) {
        return null;
      }
      return {p: `Effect | Name$ Emblème | StaticAbilities$ ${id}Emb | Duration$ Permanent | AILogic$ Always`,
        aux: [`SVar:${id}Emb:${st.s.replace(/ \| Description\$ .*$/, '')} | Description$ ${st.text}.`],
        fr: `vous gagnez un emblème avec « ${st.text}. »`, en: `you get an emblem with "${stEn.text}."`};
    }
    case 'winGame':
      return {p: 'WinsGame | Defined$ You', fr: 'vous gagnez la partie', en: 'you win the game'};
    case 'incubate':
      return {p: `Incubate | Amount$ ${n1}`, fr: `incubez ${n1}`, en: `incubate ${n1}`};
    case 'manifest':
      return {p: 'Manifest', fr: 'manifestez la carte du dessus de votre bibliothèque', en: 'manifest the top card of your library'};
    case 'transform':
      return {p: 'SetState | Defined$ Self | Mode$ Transform', fr: 'transformez CARDNAME', en: 'transform CARDNAME'};
    case 'prepareSelf':
      return {p: 'AlterAttribute | Defined$ Self | Attributes$ Prepared', fr: 'CARDNAME devient préparée', en: 'CARDNAME becomes prepared'};
    case 'suspectSelf':
      return {p: 'AlterAttribute | Defined$ Self | Attributes$ Suspected', fr: 'suspectez CARDNAME', en: 'suspect CARDNAME'};
    case 'suspectTarget':
      return {p: `AlterAttribute | ${target(creature)} | Attributes$ Suspected`, fr: 'suspectez une créature ciblée', en: 'suspect target creature'};
    case 'cloak':
      return {p: 'Cloak | Amount$ 1 | Defined$ TopOfLibrary', fr: 'voilez la carte du dessus de votre bibliothèque', en: 'cloak the top card of your library'};
    case 'manifestDread':
      return {p: 'ManifestDread', fr: 'manifestez l\'effroi', en: 'manifest dread'};
    default:
      return null;
  }
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Ce que touche un effet permanent : pour Forge, et le sujet de la phrase (et s'il est au pluriel). */
function scopeOf(a, card = null) {
  const s = SCOPES.some(x => x[0] === a.scope) ? a.scope : 'you';
  // La carte attachée suit ce que la carte équipe, fortifie ou enchante (« le terrain enchanté », « le joueur enchanté »).
  const at = ['enchanted', 'equipped', 'fortified'].includes(s) ? attachOf(card) : null;
  if (at && at.scope === s) {
    if (at.kind === 'player') {
      return {v: 'Creature.EnchantedPlayerCtrl', fr: 'les créatures que contrôle le joueur enchanté', en: 'creatures enchanted player controls', pl: true};
    }
    return {v: at.v, fr: at.fr, en: at.en, pl: false};
  }
  const f = a.filter || {type: '', other: false};
  const t = f.type ? typeName(f.type) : '';
  const other = !!f.other;
  switch (s) {
    case 'opp': return {v: t ? `Creature.${t}+OppCtrl` : 'Creature.OppCtrl', fr: `${allFr({type: f.type, other: false})} que vos adversaires contrôlent`,
      en: `${allEn({type: f.type, other: false})} your opponents control`, pl: true};
    case 'all': return {v: `Creature${t ? '.' + t : ''}${other ? (t ? '+' : '.') + 'Other' : ''}`,
      fr: t ? allFr(f) : other ? 'toutes les autres créatures' : 'toutes les créatures', en: `all ${allEn(f)}`, pl: true};
    case 'self': return {v: 'Card.Self', fr: 'CARDNAME', en: 'CARDNAME', pl: false, self: true};
    case 'enchanted': return {v: 'Creature.EnchantedBy', fr: 'la créature enchantée', en: 'enchanted creature', pl: false};
    case 'equipped': return {v: 'Creature.EquippedBy', fr: 'la créature équipée', en: 'equipped creature', pl: false};
    case 'fortified': return {v: 'Land.FortifiedBy', fr: 'le terrain fortifié', en: 'fortified land', pl: false};
    case 'commanders': return {v: 'Creature.IsCommander+YouOwn', fr: 'les créatures Commandant que vous possédez', en: 'commander creatures you own', pl: true};
    case 'tokens': return {v: t ? `Creature.${t}+token+YouCtrl` : 'Creature.token+YouCtrl',
      fr: t ? `les jetons ${frType(f.type)} que vous contrôlez` : 'les jetons de créature que vous contrôlez', en: `${t ? t + ' ' : ''}creature tokens you control`, pl: true};
    case 'attacking': return {v: 'Creature.attacking+YouCtrl', fr: 'les créatures attaquantes que vous contrôlez', en: 'attacking creatures you control', pl: true};
    default: return {v: valid(f), fr: `${allFr(f)} que vous contrôlez`, en: `${allEn(f)} you control`, pl: true};
  }
}

/** « le vol, la vigilance et l'initiative ». */
function joinFr(words) {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} et ${words[words.length - 1]}`;
}

/** « flying, vigilance, and first strike ». */
function joinEn(words) {
  if (words.length < 3) {
    return words.join(' and ');
  }
  return `${words.slice(0, -1).join(', ')}, and ${words[words.length - 1]}`;
}

/** « au nombre de… », « à votre total… », « à la force… » : « à » devant un groupe de mots. */
function aWord(w) {
  if (/^le /.test(w)) return 'au ' + w.slice(3);
  if (/^les /.test(w)) return 'aux ' + w.slice(4);
  return /^[aeiouyhéè]/i.test(w) && !/^l'/.test(w) ? `à ${w}` : `à ${w}`;
}

/** Une phrase terminée par un point, sauf si elle finit déjà par un point ou des guillemets (« … »). */
function endDot(t) {
  // « … marqueur « poison ». » : le point après le guillemet ; « avec « Les créatures… +2/+2. » » : déjà dedans.
  return /[."]$/.test(t) || /\.\s*»$/.test(t) ? t : t + '.';
}

/** « de la créature enchantée », « des créatures que… », « de CARDNAME ». */
function deS(subject) {
  if (/^les /.test(subject)) {
    return 'des ' + subject.slice(4);
  }
  if (/^le /.test(subject)) {
    return 'du ' + subject.slice(3);
  }
  return deWord(subject);
}

/** Les types de sorts d'un effet (« les sorts de créature ») : [pour Forge, français, anglais]. */
function spellTypeOf(a) {
  const st = SPELL_TYPES.find(x => x[0] === a.spellType) || SPELL_TYPES[0];
  if (st[0] === 'type') {
    const t = typeName(a.spellTypeName);
    return t ? [`Card.${t}`, `les sorts ${deWord(frType(a.spellTypeName))}`, `${t} spells`] : ['Card', 'les sorts', 'spells'];
  }
  return [st[1], st[2], st[3]];
}

/** « Ce terrain », « Cette créature » : la carte, avec le genre de son type (« arrive engagée »). */
function thisCard(card) {
  const types = (card && card.types) || [];
  if (types.includes('Creature')) return ['Cette créature', 'e'];
  if (types.includes('Land')) return ['Ce terrain', ''];
  if (types.includes('Artifact')) return ['Cet artefact', ''];
  if (types.includes('Enchantment')) return ['Cet enchantement', ''];
  if (types.includes('Planeswalker')) return ['Ce planeswalker', ''];
  return ['Ce permanent', ''];
}

/**
 * Un effet permanent : {s} (le corps d'une ligne « S: », sans condition), {lines} (ses lignes « R: » et « SVar: » quand ce
 * n'est pas une ligne « S: »), et son texte (sans point final), dans la langue de la carte.
 */
function staticCore(a, id, lang, card) {
  const en = lang === 'en';
  const n = Math.max(0, Math.round(Number(a.n) || 0));
  const sc = scopeOf(a, card);
  const S = en ? capitalize(sc.en) : capitalize(sc.fr);
  const pl = sc.pl;
  const v3 = (sg, plural) => (pl ? plural : sg);
  const sp = spellTypeOf(a);
  switch (a.effect) {
    case 'grantKeyword': {
      const kw = a.keyword || 'Flying';
      return {s: `Mode$ Continuous | Affected$ ${sc.v} | AddKeyword$ ${kw}`, text: en ? `${S} ${v3('has', 'have')} ${keywordLower(kw)}` : `${S} ${hasKw(kw, pl)}`};
    }
    case 'combo': {
      // Un bonus de force (au plus) et des mots-clés sur les mêmes créatures : une ligne, une phrase.
      const pt = a.parts.find(x => x.effect !== 'grantKeyword');
      const kws = [...new Set(a.parts.filter(x => x.effect === 'grantKeyword').map(x => x.keyword || 'Flying'))];
      let line = `Mode$ Continuous | Affected$ ${sc.v}`;
      const fr = [];
      const enParts = [];
      if (pt) {
        const k = Math.max(0, Math.round(Number(pt.n) || 0));
        const [p, t] = pt.effect === 'anthem' ? [k, k] : pt.effect === 'anthemPower' ? [k, 0] : [-k, -k];
        line += ` | AddPower$ ${p}${t ? ` | AddToughness$ ${t}` : ''}`;
        const sign = (v) => (v < 0 ? `-${-v}` : `+${v}`);
        const delta = `${sign(p)}/${pt.effect === 'debuff' ? sign(t) : sign(t)}`;
        fr.push(`${v3('gagne', 'gagnent')} ${delta}`);
        enParts.push(`${v3('gets', 'get')} ${delta}`);
      }
      if (kws.length) {
        line += ` | AddKeyword$ ${kws.join(' & ')}`;
        // « a le vol et l'initiative », « est indestructible » : les mots-clés regroupés par verbe.
        const byVerb = new Map();
        for (const kw of kws) {
          const h = hasKw(kw, pl);
          const verb = h.split(' ')[0];
          byVerb.set(verb, [...(byVerb.get(verb) || []), h.slice(verb.length + 1)]);
        }
        fr.push([...byVerb].map(([verb, objs]) => `${verb} ${joinFr(objs)}`).join(' et '));
        enParts.push(`${v3('has', 'have')} ${joinEn(kws.map(keywordLower))}`);
      }
      return {s: line, text: en ? `${S} ${enParts.join(' and ')}` : `${S} ${fr.join(' et ')}`};
    }
    case 'anthem':
      return {s: `Mode$ Continuous | Affected$ ${sc.v} | AddPower$ ${n} | AddToughness$ ${n}`, text: en ? `${S} ${v3('gets', 'get')} +${n}/+${n}` : `${S} ${v3('gagne', 'gagnent')} +${n}/+${n}`};
    case 'anthemPower':
      return {s: `Mode$ Continuous | Affected$ ${sc.v} | AddPower$ ${n}`, text: en ? `${S} ${v3('gets', 'get')} +${n}/+0` : `${S} ${v3('gagne', 'gagnent')} +${n}/+0`};
    case 'anthemX': {
      // +X/+X : « pour chaque marqueur « charge » sur elle », « pour chaque marqueur « expérience » que vous avez », ou « X étant… ».
      const x = amountOf({...a, amount: a.amount && !['fixed', 'tapped', 'xPaid'].includes(a.amount) ? a.amount : 'counters'});
      const s = `Mode$ Continuous | Affected$ ${sc.v} | AddPower$ ${id}X | AddToughness$ ${id}X`;
      const svars = [`SVar:${id}X:${x[0]}`];
      const each = a.amount === 'experience' ? ['pour chaque marqueur « expérience » que vous avez', 'for each experience counter you have']
        : (!a.amount || a.amount === 'counters') ? (() => {
          const ct = counterById(a.amountCounter);
          return [`pour chaque marqueur ${ct[1]} sur CARDNAME`, `for each ${ct[2]} counter on CARDNAME`];
        })() : null;
      if (each) {
        return {s, svars, text: en ? `${S} ${v3('gets', 'get')} +1/+1 ${each[1]}` : `${S} ${v3('gagne', 'gagnent')} +1/+1 ${each[0]}`};
      }
      return {s, svars, text: en ? `${S} ${v3('gets', 'get')} +X/+X, where X is ${x[2]}` : `${S} ${v3('gagne', 'gagnent')} +X/+X, X étant ${x[1]}`};
    }
    case 'debuff':
      return {s: `Mode$ Continuous | Affected$ ${sc.v} | AddPower$ -${n} | AddToughness$ -${n}`,
        text: en ? `${S} ${v3('gets', 'get')} -${n}/-${n}` : `${S} ${v3('gagne', 'gagnent')} -${n}/-${n}`};
    case 'cantBlock':
      return {s: `Mode$ CantBlock | ValidCard$ ${sc.v}`, text: en ? `${S} can't block` : `${S} ${v3('ne peut pas', 'ne peuvent pas')} bloquer`};
    case 'cantAttack':
      return {s: `Mode$ CantAttack | ValidCard$ ${sc.v}`, text: en ? `${S} can't attack` : `${S} ${v3('ne peut pas', 'ne peuvent pas')} attaquer`};
    case 'cantAttackBlock':
      return {s: `Mode$ CantAttack,CantBlock | ValidCard$ ${sc.v}`, text: en ? `${S} can't attack or block` : `${S} ${v3('ne peut', 'ne peuvent')} ni attaquer ni bloquer`};
    case 'unblockable':
      return {s: `Mode$ CantBlockBy | ValidAttacker$ ${sc.v}`, text: en ? `${S} can't be blocked` : `${S} ${v3('est imblocable', 'sont imblocables')}`};
    case 'notBlockedByPower':
      return {s: `Mode$ CantBlockBy | ValidAttacker$ ${sc.v} | ValidBlocker$ Creature.powerLE${n}`,
        text: en ? `${S} can't be blocked by creatures with power ${n} or less` : `Les créatures de force ${n} ou moins ne peuvent pas bloquer ${sc.fr}`};
    case 'mustAttack':
      return {s: `Mode$ MustAttack | ValidCreature$ ${sc.v}`, text: en ? `${S} ${v3('attacks', 'attack')} each combat if able` : `${S} ${v3('attaque', 'attaquent')} à chaque combat si possible`};
    case 'blockExtra':
      return {s: `Mode$ Continuous | Affected$ ${sc.v} | CanBlockAmount$ 1`,
        text: en ? `${S} can block an additional creature each combat` : `${S} ${v3('peut', 'peuvent')} bloquer une créature supplémentaire à chaque combat`};
    case 'noActivated':
      return {s: `Mode$ CantBeActivated | ValidCard$ ${sc.v}`,
        text: en ? `Activated abilities of ${sc.en} can't be activated` : `Les capacités activées ${deS(sc.fr)} ne peuvent pas être activées`};
    case 'doesntUntap':
      return {lines: [`R:Event$ Untap | ActiveZones$ Battlefield | ValidCard$ ${sc.v} | ValidStepTurnToController$ You | Layer$ CantHappen`],
        text: en ? `${S} ${v3('doesn\'t untap during its controller\'s untap step', 'don\'t untap during their controllers\' untap steps')}`
          : `${S} ${v3('ne se dégage pas pendant l\'étape de dégagement de son contrôleur', 'ne se dégagent pas pendant l\'étape de dégagement de leur contrôleur')}`};
    case 'controlEnchanted': {
      // « Vous contrôlez l'artefact enchanté » : ce que l'aura enchante (une créature par défaut).
      const at = attachOf(card);
      const w = at && at.kind !== 'player' && at.scope === 'enchanted' ? at : {fr: 'la créature enchantée', en: 'enchanted creature'};
      return {s: 'Mode$ Continuous | AffectedDefined$ Enchanted | GainControl$ You', text: en ? `You control ${w.en}` : `Vous contrôlez ${w.fr}`};
    }
    case 'cdaPT': {
      const x = amountOf({...a, amount: a.amount && a.amount !== 'fixed' && a.amount !== 'tapped' && a.amount !== 'xPaid' ? a.amount : 'creatures'});
      return {s: `Mode$ Continuous | CharacteristicDefining$ True | SetPower$ ${id}X | SetToughness$ ${id}X`, svars: [`SVar:${id}X:${x[0]}`],
        text: en ? `CARDNAME's power and toughness are each equal to ${x[2]}` : `La force et l'endurance de CARDNAME sont chacune égales ${aWord(x[1])}`};
    }
    case 'cloneEtb':
      return {lines: [`K:ETBReplacement:Copy:${id}Copy:Optional`,
        `SVar:${id}Copy:DB$ Clone | Choices$ Creature.Other | SpellDescription$ Vous pouvez faire arriver CARDNAME sur le champ de bataille comme une copie de n'importe quelle créature sur le champ de bataille.`],
        text: en ? 'You may have CARDNAME enter as a copy of any creature on the battlefield'
          : 'Vous pouvez faire arriver CARDNAME sur le champ de bataille comme une copie de n\'importe quelle créature sur le champ de bataille'};
    case 'entersTapped': {
      const t = thisCard(card);
      return {lines: [`R:Event$ Moved | ValidCard$ Card.Self | Destination$ Battlefield | ReplacementResult$ Updated | ReplaceWith$ ${id}Tap`,
        `SVar:${id}Tap:DB$ Tap | Defined$ Self | ETB$ True`], text: en ? 'CARDNAME enters tapped' : `${t[0]} arrive sur le champ de bataille engagé${t[1]}`};
    }
    case 'etbCounters': {
      const t = thisCard(card);
      const ct = counterType(a);
      const k = Math.max(1, n);
      return {lines: [`R:Event$ Moved | ValidCard$ Card.Self | Destination$ Battlefield | ReplacementResult$ Updated | ReplaceWith$ ${id}Ctr`,
        `SVar:${id}Ctr:DB$ PutCounter | Defined$ Self | ETB$ True | CounterType$ ${ct[0]} | CounterNum$ ${k}`],
        text: en ? `CARDNAME enters with ${counterWords(ct, k, 'en')} on it` : `${t[0]} arrive sur le champ de bataille avec ${counterWords(ct, k, 'fr')}`};
    }
    case 'uncounterable':
      return {lines: ['R:Event$ Counter | ValidCard$ Card.Self | ValidSA$ Spell | Layer$ CantHappen'], text: en ? 'This spell can\'t be countered' : 'Ce sort ne peut pas être contrecarré'};
    case 'oppCantCastYourTurn':
      return {s: 'Mode$ CantBeCast | ValidCard$ Card | Caster$ Opponent | Condition$ PlayerTurn',
        text: en ? 'Your opponents can\'t cast spells during your turn' : 'Vos adversaires ne peuvent pas lancer de sorts pendant votre tour'};
    case 'oneSpellEach':
      return {s: 'Mode$ CantBeCast | ValidCard$ Card | Caster$ Player | NumLimitEachTurn$ 1',
        text: en ? 'Each player can\'t cast more than one spell each turn' : 'Chaque joueur ne peut pas lancer plus d\'un sort par tour'};
    case 'oppOneSpell':
      return {s: 'Mode$ CantBeCast | ValidCard$ Card | Caster$ Opponent | NumLimitEachTurn$ 1',
        text: en ? 'Each opponent can\'t cast more than one spell each turn' : 'Chaque adversaire ne peut pas lancer plus d\'un sort par tour'};
    case 'oppDrawLimit':
      return {s: 'Mode$ CantDraw | ValidPlayer$ Opponent | DrawLimit$ 1',
        text: en ? 'Each opponent can\'t draw more than one card each turn' : 'Chaque adversaire ne peut pas piocher plus d\'une carte par tour'};
    case 'playersCantGainLife':
      return {s: 'Mode$ CantGainLife | ValidPlayer$ Player', text: en ? 'Players can\'t gain life' : 'Les joueurs ne peuvent pas gagner de points de vie'};
    case 'cantPreventDamage':
      return {s: 'Mode$ CantPreventDamage', text: en ? 'Damage can\'t be prevented' : 'Les blessures ne peuvent pas être prévenues'};
    case 'grantManaAny': {
      // Comme la Lanterne chromatique : « Les terrains que vous contrôlez ont « {T} : Ajoutez un mana de la couleur de votre choix. » »
      const k = MANA_KINDS.find(x => x[0] === a.manaKind) || MANA_KINDS[0];
      const ab = en ? 'Add one mana of any color.' : 'Ajoutez un mana de la couleur de votre choix.';
      return {s: `Mode$ Continuous | Affected$ ${k[2]}${k[2].includes('.') ? '+' : '.'}YouCtrl | AddAbility$ ${id}Mana`,
        svars: [`SVar:${id}Mana:AB$ Mana | Cost$ T | Produced$ Any | SpellDescription$ ${ab}`],
        text: en ? `${k[4]} you control have "{T}: ${ab}"` : `${k[3]} que vous contrôlez ont « {T} : ${ab} »`};
    }
    case 'animateStatic': {
      const m = animParts(a);
      return {s: `Mode$ Continuous | Affected$ ${m.v} | AddType$ Creature${m.t ? ' & ' + m.t : ''} | SetPower$ ${n} | SetToughness$ ${n}`,
        text: en ? `${capitalize(m.en)} are ${n}/${n}${m.tEn} creatures in addition to their other types`
          : `${capitalize(m.fr)} sont des créatures ${n}/${n}${m.tFr} en plus de leurs autres types`};
    }
    case 'playLandsGraveyard':
      return {s: 'Mode$ Continuous | Affected$ Land.YouOwn | MayPlay$ True | AffectedZone$ Graveyard',
        text: en ? 'You may play lands from your graveyard' : 'Vous pouvez jouer des terrains depuis votre cimetière'};
    case 'maxOneBlocker':
      return {s: `Mode$ MinMaxBlocker | ValidCard$ ${sc.v} | Max$ 1`,
        text: en ? `${S} can't be blocked by more than one creature` : `${S} ${v3('ne peut pas être bloquée', 'ne peuvent pas être bloquées')} par plus d'une créature`};
    case 'minBlockers': {
      const k = Math.max(2, n);
      return {s: `Mode$ MinMaxBlocker | ValidCard$ ${sc.v} | Min$ ${k}`,
        text: en ? `${S} can't be blocked except by ${word(k, 'en')} or more creatures`
          : `${S} ${v3('ne peut pas être bloquée', 'ne peuvent pas être bloquées')} excepté par ${word(k, 'fr')} créatures ou plus`};
    }
    case 'canAttackDefender':
      return {s: `Mode$ CanAttackDefender | ValidCard$ ${sc.v}`,
        text: en ? `${S} can attack as though ${v3('it', 'they')} didn't have defender` : `${S} ${v3('peut attaquer comme si elle n\'avait', 'peuvent attaquer comme si elles n\'avaient')} pas le défenseur`};
    case 'damageToughness':
      return {s: `Mode$ CombatDamageToughness | ValidCard$ ${sc.v}`,
        text: en ? `${S} ${v3('assigns', 'assign')} combat damage equal to ${v3('its', 'their')} toughness rather than ${v3('its', 'their')} power`
          : `${S} ${v3('inflige des blessures de combat égales à son endurance plutôt qu\'à sa force', 'infligent des blessures de combat égales à leur endurance plutôt qu\'à leur force')}`};
    case 'selfCostReduction': {
      const x = amountOf({...a, amount: a.amount && !['fixed', 'tapped', 'xPaid'].includes(a.amount) ? a.amount : 'creatures'});
      return {s: `Mode$ ReduceCost | ValidCard$ Card.Self | Type$ Spell | Amount$ ${id}X | EffectZone$ All`, svars: [`SVar:${id}X:${x[0]}`],
        text: en ? `This spell costs {X} less to cast, where X is ${x[2]}` : `Ce sort coûte {X} de moins à lancer, X étant ${x[1]}`};
    }
    case 'kwMustBeBlocked':
      return {lines: ['K:CARDNAME must be blocked if able.'], text: en ? 'CARDNAME must be blocked if able' : 'CARDNAME doit être bloquée si possible'};
    case 'kwLure':
      return {lines: ['K:All creatures able to block CARDNAME do so.'], text: en ? 'All creatures able to block CARDNAME do so' : 'Toutes les créatures capables de bloquer CARDNAME le font'};
    case 'kwCantAttackBlockAlone':
      return {lines: ['K:CARDNAME can\'t attack or block alone.'], text: en ? 'CARDNAME can\'t attack or block alone' : 'CARDNAME ne peut pas attaquer ou bloquer seule'};
    case 'kwCantAttackAlone':
      return {lines: ['K:CARDNAME can\'t attack alone.'], text: en ? 'CARDNAME can\'t attack alone' : 'CARDNAME ne peut pas attaquer seule'};
    case 'kwPreventAll':
      return {lines: ['K:Prevent all damage that would be dealt to CARDNAME.'],
        text: en ? 'Prevent all damage that would be dealt to CARDNAME' : 'Prévenez toutes les blessures qui devraient être infligées à CARDNAME'};
    case 'kwPreventCombat':
      return {lines: ['K:Prevent all combat damage that would be dealt to CARDNAME.'],
        text: en ? 'Prevent all combat damage that would be dealt to CARDNAME' : 'Prévenez toutes les blessures de combat qui devraient être infligées à CARDNAME'};
    case 'kwMayNotUntap':
      return {lines: ['K:You may choose not to untap CARDNAME during your untap step.'],
        text: en ? 'You may choose not to untap CARDNAME during your untap step' : 'Vous pouvez choisir de ne pas dégager CARDNAME pendant votre étape de dégagement'};
    case 'kwCanBeCommander':
      return {lines: ['K:CARDNAME can be your commander.'], text: en ? 'CARDNAME can be your commander' : 'CARDNAME peut être votre commandant'};
    case 'kwAnyNumber':
      return {lines: ['K:A deck can have any number of cards named CARDNAME.'],
        text: en ? 'A deck can have any number of cards named CARDNAME' : 'Un deck peut contenir n\'importe quel nombre de cartes appelées CARDNAME'};
    case 'graveyardHate':
      return {lines: [`R:Event$ Moved | ActiveZones$ Battlefield | Destination$ Graveyard | ValidCard$ Card.!token+OppOwn | ReplaceWith$ ${id}Exi`,
        `SVar:${id}Exi:DB$ ChangeZone | Hidden$ True | Origin$ All | Destination$ Exile | Defined$ ReplacedCard`],
        text: en ? 'If a card would be put into an opponent\'s graveyard from anywhere, exile it instead'
          : 'Si une carte devait être mise dans le cimetière d\'un adversaire de n\'importe où, exilez-la à la place'};
    case 'creaturesDieExile':
      return {lines: [`R:Event$ Moved | ActiveZones$ Battlefield | Origin$ Battlefield | Destination$ Graveyard | ValidLKI$ Creature | ReplaceWith$ ${id}Exi`,
        `SVar:${id}Exi:DB$ ChangeZone | Hidden$ True | Origin$ All | Destination$ Exile | Defined$ ReplacedCard`],
        text: en ? 'If a creature would die, exile it instead' : 'Si une créature devait mourir, exilez-la à la place'};
    case 'manaDouble':
      return {lines: [`R:Event$ ProduceMana | ActiveZones$ Battlefield | ValidActivator$ You | ValidCard$ Permanent | ReplaceWith$ ${id}Two`,
        `SVar:${id}Two:DB$ ReplaceMana | ReplaceAmount$ 2`],
        text: en ? 'If you tap a permanent for mana, it produces twice as much of that mana instead'
          : 'Si vous engagez un permanent pour du mana, il produit deux fois plus de ce mana à la place'};
    case 'labManiac':
      return {lines: [`R:Event$ Draw | ActiveZones$ Battlefield | ValidPlayer$ You | IsPresent$ Card.YouOwn | PresentZone$ Library | PresentCompare$ EQ0 | ReplaceWith$ ${id}Win`,
        `SVar:${id}Win:DB$ WinsGame | Defined$ You`],
        text: en ? 'If you would draw a card while your library has no cards in it, you win the game instead'
          : 'Si vous deviez piocher une carte alors que votre bibliothèque ne contient aucune carte, vous gagnez la partie à la place'};
    case 'oppMaxHandMinus': {
      const k = Math.max(1, n);
      return {s: `Mode$ Continuous | Affected$ Opponent | RaiseMaxHandSize$ -${k}`,
        text: en ? `Each opponent's maximum hand size is reduced by ${word(k, 'en')}` : `La taille maximale de main de chaque adversaire est réduite de ${word(k, 'fr')}`};
    }
    case 'noMaxHand':
      return {s: 'Mode$ Continuous | Affected$ You | SetMaxHandSize$ Unlimited', text: en ? 'You have no maximum hand size' : 'Vous n\'avez pas de taille maximale de main'};
    case 'maxHandPlus':
      return {s: `Mode$ Continuous | Affected$ You | RaiseMaxHandSize$ ${n}`, text: en ? `Your maximum hand size is increased by ${n}` : `Votre taille maximale de main est augmentée de ${n}`};
    case 'extraLand': {
      const k = Math.max(1, n);
      return {s: `Mode$ Continuous | Affected$ You | AdjustLandPlays$ ${k}`,
        text: en ? `You may play ${k === 1 ? 'an additional land' : word(k, 'en') + ' additional lands'} on each of your turns`
          : `Vous pouvez jouer ${k === 1 ? 'un terrain supplémentaire' : word(k, 'fr') + ' terrains supplémentaires'} pendant chacun de vos tours`};
    }
    case 'reduceCost': {
      const k = Math.max(1, n);
      return {s: `Mode$ ReduceCost | ValidCard$ ${sp[0]} | Type$ Spell | Activator$ You | Amount$ ${k}`,
        text: en ? `${capitalize(sp[2])} you cast cost {${k}} less to cast` : `${capitalize(sp[1])} que vous lancez coûtent {${k}} de moins à lancer`};
    }
    case 'raiseCostOpp': {
      const k = Math.max(1, n);
      return {s: `Mode$ RaiseCost | ValidCard$ ${sp[0]} | Type$ Spell | Activator$ Opponent | Amount$ ${k}`,
        text: en ? `${capitalize(sp[2])} your opponents cast cost {${k}} more to cast` : `${capitalize(sp[1])} que vos adversaires lancent coûtent {${k}} de plus à lancer`};
    }
    case 'raiseCostAll': {
      const k = Math.max(1, n);
      return {s: `Mode$ RaiseCost | ValidCard$ ${sp[0]} | Type$ Spell | Amount$ ${k}`,
        text: en ? `${capitalize(sp[2])} cost {${k}} more to cast` : `${capitalize(sp[1])} coûtent {${k}} de plus à lancer`};
    }
    case 'flashSpells':
      return {s: `Mode$ CastWithFlash | ValidCard$ ${sp[0]} | ValidSA$ Spell | Caster$ You`,
        text: en ? `You may cast ${sp[2]} as though they had flash` : `Vous pouvez lancer ${sp[1]} comme s'ils avaient le flash`};
    case 'playerHexproof':
      return {s: 'Mode$ Continuous | Affected$ You | AddKeyword$ Hexproof', text: en ? 'You have hexproof' : 'Vous avez la défense talismanique'};
    case 'cantLose':
      return {lines: ['R:Event$ GameLoss | ActiveZones$ Battlefield | ValidPlayer$ You | Layer$ CantHappen',
        'R:Event$ GameWin | ActiveZones$ Battlefield | ValidPlayer$ Opponent | Layer$ CantHappen | Secondary$ True'],
        text: en ? 'You can\'t lose the game and your opponents can\'t win the game' : 'Vous ne pouvez pas perdre la partie et vos adversaires ne peuvent pas la gagner'};
    case 'oppCantGainLife':
      return {s: 'Mode$ CantGainLife | ValidPlayer$ Player.Opponent', text: en ? 'Your opponents can\'t gain life' : 'Vos adversaires ne peuvent pas gagner de points de vie'};
    case 'lookTop':
      return {s: 'Mode$ Continuous | Affected$ Card.TopLibrary+YouCtrl | AffectedZone$ Library | MayLookAt$ You',
        text: en ? 'You may look at the top card of your library any time' : 'Vous pouvez regarder la carte du dessus de votre bibliothèque à tout moment'};
    case 'playTop':
      return {s: 'Mode$ Continuous | Affected$ Card.TopLibrary+YouCtrl | AffectedZone$ Library | MayLookAt$ Player | MayPlay$ True',
        text: en ? 'Play with the top card of your library revealed. You may play lands and cast spells from the top of your library'
          : 'Jouez avec la carte du dessus de votre bibliothèque révélée. Vous pouvez jouer des terrains et lancer des sorts depuis le dessus de votre bibliothèque'};
    case 'untapOthers':
      return {s: 'Mode$ UntapOtherPlayer | ValidCard$ Permanent.YouCtrl',
        text: en ? 'Untap all permanents you control during each other player\'s untap step' : 'Dégagez tous les permanents que vous contrôlez pendant l\'étape de dégagement de chaque autre joueur'};
    case 'ignoreLegend':
      return {s: 'Mode$ IgnoreLegendRule | ValidCard$ Permanent.YouCtrl',
        text: en ? 'The "legend rule" doesn\'t apply to permanents you control' : 'La « règle des légendes » ne s\'applique pas aux permanents que vous contrôlez'};
    case 'propaganda': {
      const k = Math.max(1, n);
      return {s: `Mode$ CantAttackUnless | ValidCard$ Creature | Target$ You | Cost$ ${k}`,
        text: en ? `Creatures can't attack you unless their controller pays {${k}} for each creature they control that's attacking you`
          : `Les créatures ne peuvent pas vous attaquer à moins que leur contrôleur ne paie {${k}} pour chaque créature qu'il contrôle qui vous attaque`};
    }
    case 'panharmonicon':
      return {s: 'Mode$ Panharmonicon | ValidMode$ ChangesZone,ChangesZoneAll | ValidCard$ Permanent.YouCtrl | ValidCause$ Artifact,Creature | Destination$ Battlefield',
        text: en ? 'If an artifact or creature entering causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time'
          : 'Si l\'arrivée d\'un artefact ou d\'une créature sur le champ de bataille fait se déclencher une capacité déclenchée d\'un permanent que vous contrôlez, cette capacité se déclenche une fois de plus'};
    case 'oppEnterTapped':
      return {lines: [`R:Event$ Moved | ValidCard$ Creature.OppCtrl | Destination$ Battlefield | ReplaceWith$ ${id}Tap | ReplacementResult$ Updated | ActiveZones$ Battlefield`,
        `SVar:${id}Tap:DB$ Tap | ETB$ True | Defined$ ReplacedCard`],
        text: en ? 'Creatures your opponents control enter tapped' : 'Les créatures que vos adversaires contrôlent arrivent sur le champ de bataille engagées'};
    case 'doubleTokens':
      return {lines: [`R:Event$ CreateToken | ActiveZones$ Battlefield | ValidToken$ Card.YouCtrl | ReplaceWith$ ${id}Dbl | EffectOnly$ True`,
        `SVar:${id}Dbl:DB$ ReplaceToken | Type$ Amount`],
        text: en ? 'If an effect would create one or more tokens under your control, it creates twice that many of those tokens instead'
          : 'Si un effet devait créer au moins un jeton sous votre contrôle, il crée deux fois ce nombre de jetons à la place'};
    case 'doubleCounters':
      return {lines: [`R:Event$ AddCounter | ActiveZones$ Battlefield | ValidCard$ Creature.YouCtrl+inZoneBattlefield | ValidCounterType$ P1P1 | ReplaceWith$ ${id}Dbl`,
        `SVar:${id}Dbl:DB$ ReplaceCounter | ValidCounterType$ P1P1 | ChooseCounter$ True | Amount$ ${id}Y`, `SVar:${id}Y:ReplaceCount$CounterNum/Twice`],
        text: en ? 'If one or more +1/+1 counters would be put on a creature you control, twice that many +1/+1 counters are put on it instead'
          : 'Si au moins un marqueur +1/+1 devait être mis sur une créature que vous contrôlez, deux fois ce nombre de marqueurs +1/+1 sont mis sur elle à la place'};
    case 'plusOneCounter':
      return {lines: [`R:Event$ AddCounter | ActiveZones$ Battlefield | ValidCard$ Creature.YouCtrl+inZoneBattlefield | ValidCounterType$ P1P1 | ReplaceWith$ ${id}One`,
        `SVar:${id}One:DB$ ReplaceCounter | ValidCounterType$ P1P1 | ChooseCounter$ True | Amount$ ${id}Y`, `SVar:${id}Y:ReplaceCount$CounterNum/Plus.1`],
        text: en ? 'If one or more +1/+1 counters would be put on a creature you control, that many plus one +1/+1 counters are put on it instead'
          : 'Si au moins un marqueur +1/+1 devait être mis sur une créature que vous contrôlez, autant de marqueurs +1/+1 plus un sont mis sur elle à la place'};
    case 'doubleDamage':
      return {lines: [`R:Event$ DamageDone | ActiveZones$ Battlefield | ValidSource$ Card.YouCtrl,Emblem.YouCtrl | ValidTarget$ Player.Opponent,Permanent.OppCtrl | ReplaceWith$ ${id}Dmg`,
        `SVar:${id}Dmg:DB$ ReplaceEffect | VarName$ DamageAmount | VarValue$ ${id}Y`, `SVar:${id}Y:ReplaceCount$DamageAmount/Twice`],
        text: en ? 'If a source you control would deal damage to an opponent or a permanent an opponent controls, it deals double that damage instead'
          : 'Si une source que vous contrôlez devait infliger des blessures à un adversaire ou à un permanent qu\'un adversaire contrôle, elle inflige le double de ces blessures à la place'};
    case 'damagePlus': {
      const k = Math.max(1, n);
      return {lines: [`R:Event$ DamageDone | ActiveZones$ Battlefield | ValidSource$ Card.YouCtrl,Emblem.YouCtrl | ValidTarget$ Player.Opponent,Permanent.OppCtrl | ReplaceWith$ ${id}Dmg`,
        `SVar:${id}Dmg:DB$ ReplaceEffect | VarName$ DamageAmount | VarValue$ ${id}Y`, `SVar:${id}Y:ReplaceCount$DamageAmount/Plus.${k}`],
        text: en ? `If a source you control would deal damage to an opponent or a permanent an opponent controls, it deals that much damage plus ${k} instead`
          : `Si une source que vous contrôlez devait infliger des blessures à un adversaire ou à un permanent qu'un adversaire contrôle, elle inflige autant de blessures plus ${k} à la place`};
    }
    case 'doubleLife':
      return {lines: [`R:Event$ GainLife | ActiveZones$ Battlefield | ValidPlayer$ You | ReplaceWith$ ${id}Life | AILogic$ DoubleLife`,
        `SVar:${id}Life:DB$ ReplaceEffect | VarName$ LifeGained | VarValue$ ${id}Y`, `SVar:${id}Y:ReplaceCount$LifeGained/Twice`],
        text: en ? 'If you would gain life, you gain twice that much life instead' : 'Si vous deviez gagner des points de vie, vous gagnez deux fois ce nombre de points de vie à la place'};
    default:
      return null;
  }
}

/** Lignes et texte d'un effet permanent, avec sa condition (« tant que … ») et l'Éminence. */
function staticLines(a, id, lang, card) {
  const en = lang === 'en';
  const core = staticCore(a, id, lang, card);
  if (!core) {
    return null;
  }
  const cond = conditionOf(a);
  let text = core.text;
  if (cond) {
    text = `${capitalize(asLongAs(cond, lang))}, ${text.charAt(0) === 'C' && text.startsWith('CARDNAME') ? text : text.charAt(0).toLowerCase() + text.slice(1)}`;
  }
  const words = [];
  if (a.eminence) {
    words.push(en ? 'Eminence' : 'Éminence');
  }
  if (cond && cond.aw) {
    words.push(cond.aw[en ? 1 : 0]);
  }
  text = endDot((words.length ? words.join(' — ') + ' — ' : '') + text);
  const svars = [...(core.svars || [])];
  if (cond && cond.count) {
    svars.push(`SVar:${id}C:${cond.count}`);
  }
  if (core.s) {
    const check = cond ? staticCheck(cond, `${id}C`) : '';
    const zone = a.eminence ? ' | EffectZone$ Battlefield,Command' : '';
    return {lines: [`S:${core.s}${check}${zone} | Description$ ${text}`, ...svars], text};
  }
  // Remplacements (« R: ») : la condition par un compte seulement ; la description sur la première ligne.
  const check = cond && cond.count ? ` | CheckSVar$ ${id}C | SVarCompare$ ${cond.cmp}` : '';
  const lines = core.lines.map((l, k) => {
    if (!l.startsWith('R:')) {
      return l;
    }
    let out = l + check;
    if (a.eminence) {
      out = out.includes('ActiveZones$') ? out.replace(/ActiveZones\$ Battlefield/, 'ActiveZones$ Battlefield,Command') : out + ' | ActiveZones$ Battlefield,Command';
    }
    return `${out} | Description$ ${text}`;
  });
  return {lines: [...lines, ...svars], text};
}

/** Ce qu'on peut sacrifier pour payer un coût : [id, pour Forge, « sacrifiez … », « sacrifice … »]. */
export const SAC_WHAT = [
  ['', '', '', ''], ['creature', 'Sac<1/Creature>', 'sacrifiez une créature', 'sacrifice a creature'],
  ['otherCreature', 'Sac<1/Creature.Other/another creature>', 'sacrifiez une autre créature', 'sacrifice another creature'],
  ['artifact', 'Sac<1/Artifact>', 'sacrifiez un artefact', 'sacrifice an artifact'], ['land', 'Sac<1/Land>', 'sacrifiez un terrain', 'sacrifice a land'],
  ['token', 'Sac<1/Permanent.token/token>', 'sacrifiez un jeton', 'sacrifice a token'],
  ['permanent', 'Sac<1/Permanent>', 'sacrifiez un permanent', 'sacrifice a permanent'],
];

/** D'où une capacité activée s'active : [id, pour Forge, libellé]. */
export const ACT_ZONES = [['', '', 'Depuis le champ de bataille'], ['Graveyard', 'Graveyard', 'Depuis votre cimetière'], ['Hand', 'Hand', 'Depuis votre main (canalisation)']];

/** Coût supplémentaire d'un sort : [id, pour Forge, « … », en anglais]. */
export const SPELL_COSTS = [
  ['', '', '', ''], ['sacCreature', 'Sac<1/Creature>', 'sacrifiez une créature', 'sacrifice a creature'],
  ['sacArtifact', 'Sac<1/Artifact>', 'sacrifiez un artefact', 'sacrifice an artifact'], ['sacLand', 'Sac<1/Land>', 'sacrifiez un terrain', 'sacrifice a land'],
  ['discard', 'Discard<1/Card>', 'défaussez-vous d\'une carte', 'discard a card'], ['payLife', 'PayLife<X>', 'payez X points de vie', 'pay X life'],
  ['exileGY', 'ExileFromGrave<1/Card>', 'exilez une carte de votre cimetière', 'exile a card from your graveyard'],
  ['tapCreature', 'tapXType<1/Creature>', 'engagez une créature dégagée que vous contrôlez', 'tap an untapped creature you control'],
  ['waterbend', 'Waterbend<X>', 'maîtrisez l\'Eau {X}', 'waterbend {X}'],
];

/** Coût d'une capacité activée : mana, {T}, {Q}, sacrifices, PV, défausse, exil, marqueurs, énergie. Renvoie le coût pour Forge et son texte. */
function activationCost(a, lang) {
  const en = lang === 'en';
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
  if (a.untapQ) {
    forge.push('Q');
    text.push('{Q}');
  }
  const life = Math.max(0, Math.round(Number(a.payLife) || 0));
  if (life) {
    forge.push(`PayLife<${life}>`);
    text.push(en ? `pay ${life} life` : `payez ${life} ${plural(life, 'point', 'points')} de vie`);
  }
  if (a.discardCost === 'card') {
    forge.push('Discard<1/Card>');
    text.push(en ? 'discard a card' : 'défaussez-vous d\'une carte');
  }
  if (a.zone === 'Hand') {
    forge.push('Discard<1/CARDNAME>');
    text.push(en ? 'discard CARDNAME' : 'défaussez-vous de CARDNAME');
  }
  if (a.sac) {
    forge.push('Sac<1/CARDNAME>');
    text.push(en ? 'sacrifice CARDNAME' : 'sacrifiez CARDNAME');
  }
  const sac = SAC_WHAT.find(s => s[0] && s[0] === a.sacWhat);
  if (sac) {
    forge.push(sac[1]);
    text.push(en ? sac[3] : sac[2]);
  }
  if (a.zone === 'Graveyard' && a.exileSelf) {
    forge.push('ExileFromGrave<1/CARDNAME>');
    text.push(en ? 'exile CARDNAME from your graveyard' : 'exilez CARDNAME de votre cimetière');
  }
  const exile = Math.max(0, Math.round(Number(a.exileGY) || 0));
  if (exile) {
    forge.push(`ExileFromGrave<${exile}/Card>`);
    text.push(en ? `exile ${exile === 1 ? 'a card' : word(exile, 'en') + ' cards'} from your graveyard`
      : `exilez ${exile === 1 ? 'une carte' : word(exile, 'fr') + ' cartes'} de votre cimetière`);
  }
  const ctr = Math.max(0, Math.round(Number(a.removeCounters) || 0));
  if (ctr) {
    // « Retirez trois marqueurs « charge » de CARDNAME » (+1/+1 par défaut).
    const ct = counterById(a.removeCounterType);
    forge.push(`SubCounter<${ctr}/${ct[0]}>`);
    text.push(en ? `remove ${counterWords(ct, ctr, 'en')} from CARDNAME` : `retirez ${counterWords(ct, ctr, 'fr')} de CARDNAME`);
  }
  const water = Math.max(0, Math.round(Number(a.waterbend) || 0));
  if (water) {
    // « Maîtrisez l'Eau {3} » : on peut engager ses artefacts et ses créatures pour payer, chacun paie {1}.
    forge.push(`Waterbend<${water}>`);
    text.push(en ? `waterbend {${water}}` : `maîtrisez l'Eau {${water}}`);
  }
  const energy = Math.max(0, Math.round(Number(a.payEnergy) || 0));
  if (energy) {
    forge.push(`PayEnergy<${energy}>`);
    text.push(en ? `pay ${'{E}'.repeat(Math.min(energy, 10))}` : `payez ${'{E}'.repeat(Math.min(energy, 10))}`);
  }
  if (a.tapX) {
    // « Engagez X jetons dégagés que vous contrôlez » : le joueur choisit X en payant, au moins un (XMin$ 1 sur la
    // capacité : avec X = 0, une capacité de mana ou de pioche serait gratuite, donc infinie), et le nombre engagé est lu
    // ensuite. Ou un nombre fixe : « Engagez deux créatures dégagées que vous contrôlez ».
    const w = tapWhat(a);
    const n = tapCount(a);
    forge.push(`tapXType<${n || 'X'}/${w[0]}/${w[4]}>`);
    const fem = w[3] === 'es';
    const one = (w[4].endsWith('s') ? w[4].slice(0, -1) : w[4]);
    text.push(!n ? (en ? `tap X untapped ${w[4]} you control` : `engagez X ${w[1]} dégagé${w[3]} que vous contrôlez`)
      : n === 1 ? (en ? `tap an untapped ${one} you control` : `engagez ${fem ? 'une' : 'un'} ${w[2]} dégagé${fem ? 'e' : ''} que vous contrôlez`)
        : (en ? `tap ${word(n, 'en')} untapped ${w[4]} you control` : `engagez ${word(n, 'fr')} ${w[1]} dégagé${w[3]} que vous contrôlez`));
  }
  return {forge: forge.join(' ') || '0', text: capitalize(text.join(', ')) || '{0}'};
}

/** Restrictions d'une capacité activée : paramètres de Forge et phrase ajoutée au texte. */
function activationLimits(a, lang) {
  const en = lang === 'en';
  const forge = [];
  const text = [];
  if (a.zone === 'Graveyard' || a.zone === 'Hand') {
    forge.push(`ActivationZone$ ${a.zone}`);
  }
  if (a.sorcery) {
    forge.push('SorcerySpeed$ True');
    text.push(en ? 'Activate only as a sorcery.' : 'N\'activez que lorsque vous pourriez lancer un rituel.');
  }
  if (a.yourTurnOnly && !a.sorcery) {
    forge.push('PlayerTurn$ True');
    text.push(en ? 'Activate only during your turn.' : 'N\'activez que pendant votre tour.');
  }
  if (a.tapX && !tapCount(a)) {
    forge.push('XMin$ 1');
  }
  if (a.oncePerTurn) {
    forge.push('ActivationLimit$ 1');
    text.push(en ? 'Activate only once each turn.' : 'N\'activez qu\'une seule fois par tour.');
  }
  return {forge: forge.map(p => ` | ${p}`).join(''), text: text.length ? ' ' + text.join(' ') : ''};
}

/** Coût d'un sort : son coût de mana et son coût supplémentaire ; et la phrase de ce coût supplémentaire. */
function spellCost(a, lang, card) {
  const mana = forgeCost(card && card.cost) || '0';
  const c = SPELL_COSTS.find(x => x[0] && x[0] === a.addCost);
  if (!c) {
    return {forge: '', text: ''};
  }
  const life = Math.max(1, Math.round(Number(a.addCostN) || 2));
  const forge = c[1].replace('X', life);
  const words = (lang === 'en' ? c[3] : c[2]).replace('X', life).replace('points de vie', `${plural(life, 'point', 'points')} de vie`);
  return {forge: ` | Cost$ ${mana} ${forge}`, text: lang === 'en' ? `As an additional cost to cast this spell, ${words}.\\n`
    : `En tant que coût supplémentaire pour lancer ce sort, ${words}.\\n`};
}

/** « Seuil — » devant le texte d'une capacité dont la condition a un mot d'aptitude. */
function withWord(aw, text) {
  return aw ? `${aw} — ${text}` : text;
}

/**
 * Lignes du script et texte (dans la langue de la carte) d'une capacité. i : son numéro (noms des SVar) ; card : la carte
 * (son coût pour un coût supplémentaire, ses types pour « Cette créature arrive engagée »). Un chapitre de saga donne
 * aussi chapter (son numéro) : la ligne « K:Chapter » est écrite par buildScript.
 */
export function abilityLines(a, i, lang = 'fr', card = null) {
  const en = lang === 'en';
  const id = `Atelier${i + 1}`;
  // « Engagez deux créatures… » (nombre fixe) : « X = le nombre engagé » vaut ce nombre, et « si au moins N ont été
  // engagées » est toujours vrai (N au plus ce nombre) ou jamais.
  const fixedTap = tapCount(a);
  if (fixedTap) {
    const fix = (m) => {
      const out = {...m};
      if (out.amount === 'tapped') {
        out.amount = 'fixed';
        out.n = fixedTap;
      }
      if (out.cond === 'tappedAtLeast' && Math.round(Number(out.condN ?? 3) || 0) <= fixedTap) {
        out.cond = 'none';
      }
      return out;
    };
    a = fix(a);
    if (Array.isArray(a.then)) {
      a.then = a.then.map(fix);
    }
    if (Array.isArray(a.modes)) {
      a.modes = a.modes.map(fix);
    }
  }
  // Sur une malédiction, un effet qui vise un joueur touche le joueur enchanté, sauf si la capacité dit « ciblé ».
  if (a.who === undefined && PLAYER_EFFECTS.has(a.effect) && (attachOf(card) || {}).kind === 'player') {
    a = {...a, who: 'enchanted'};
  }
  // Un équipement ou une aura de créature : « la créature équipée » (ou enchantée) pour les effets qui la touchent.
  const at = attachOf(card);
  if (at && at.kind === 'creature') {
    a = {...a, attachTo: at.scope, attachWhen: a.when};
  }
  const w = WHEN.find(x => x.id === a.when);
  if (!w) {
    return null;
  }
  if (a.when === 'static') {
    return staticLines(a, id, lang, card);
  }
  if (a.effect === 'modal') {
    return modalLines(a, id, w, lang, card);
  }
  const e = chainOf(a, id, lang);
  if (!e) {
    return null;
  }
  const body = e.body;
  const extra = e.extra;
  if (w.kind === 'CH') {
    const ks = chaptersOf(a);
    const text = withWord(e.aw, endDot(capitalize(body)));
    return {chapter: ks[0], chapters: ks, body: text, lines: [`SVar:${id}:DB$ ${e.p} | SpellDescription$ ${text}`, ...extra],
      text: `${ks.map(k => ROMAN[k - 1]).join(', ')} — ${text}`};
  }
  if (w.kind === 'SP') {
    const c = spellCost(a, lang, card);
    const text = c.text + withWord(e.aw, endDot(capitalize(body)));
    // Sur la pile et dans le journal : le texte de la carte (sinon Forge écrit le sien, en anglais : « Grizzlis explores »).
    return {lines: [`A:SP$ ${e.p}${c.forge} | SpellDescription$ ${withWord(e.aw, endDot(capitalize(body)))} | StackDescription$ SpellDescription`, ...extra], text};
  }
  if (w.kind === 'A') {
    if (a.when === 'loyalty') {
      const k = Math.round(Number(a.loyalty) || 0);
      const cost = k >= 0 ? `AddCounter<${k}/LOYALTY>` : `SubCounter<${-k}/LOYALTY>`;
      // Le coût est écrit par CostDesc$ (dans la langue de la carte) : Forge ne le répète pas en anglais devant l'effet.
      const head = en ? `${k > 0 ? '+' : k < 0 ? '−' : ''}${Math.abs(k)}:` : `[${k > 0 ? '+' : ''}${k}] :`;
      const text = `${head} ${endDot(withWord(e.aw, capitalize(body)))}`;
      // Sur la pile et dans le journal : le texte de la carte (sinon Forge écrit le sien, en anglais).
      return {lines: [`A:AB$ ${e.p} | Cost$ ${cost} | Planeswalker$ True | CostDesc$ ${head} | SpellDescription$ ${endDot(withWord(e.aw, capitalize(body)))} | StackDescription$ SpellDescription`, ...extra], text};
    }
    const c = activationCost(a, lang);
    const lim = activationLimits(a, lang);
    const head = en ? `${c.text}:` : `${c.text} :`;
    const desc = `${endDot(capitalize(body))}${lim.text}`;
    const text = withWord(e.aw, `${head} ${desc}`);
    return {lines: [`A:AB$ ${e.p} | Cost$ ${c.forge}${lim.forge} | CostDesc$ ${withWord(e.aw, head)} | SpellDescription$ ${desc} | StackDescription$ SpellDescription`, ...extra, ...(a.tapX && !tapCount(a) ? ['SVar:X:Count$xPaid'] : [])], text};
  }
  const head = triggerHead(a, card);
  const text = withWord(e.aw, endDot(`${head[en ? 2 : 1]}, ${body}`));
  return {lines: [`T:${head[0]} | Execute$ ${id} | TriggerDescription$ ${text}`, `SVar:${id}:DB$ ${e.p}`, ...extra], text};
}

/** Déclencheurs qui marchent depuis le champ de bataille et peuvent aussi marcher depuis la zone de commandement. */
export function eminenceOk(when) {
  if (when === 'static') {
    return true;
  }
  const h = triggerTable({when, filter: {type: '', other: false}});
  return !!h && h[0].includes('TriggerZones$ Battlefield');
}

/** Mots d'aptitude que la carte écrit devant un déclencheur (« Toucheterre — À chaque fois qu'un terrain… »). */
const TRIGGER_WORDS = {
  landfall: ['Toucheterre', 'Landfall'], magecraft: ['Sorcellerie', 'Magecraft'], constellation: ['Constellation', 'Constellation'],
  heroic: ['Héroïque', 'Heroic'], enrage: ['Rage', 'Enrage'],
};

/** Déclencheur d'une capacité, avec l'Éminence si demandée (aussi depuis la zone de commandement). */
function triggerHead(a, card = null) {
  const h = triggerTable(a, card);
  if (!h) {
    return h;
  }
  let [forge, fr, en] = h;
  const aw = TRIGGER_WORDS[a.when];
  if (aw) {
    fr = `${aw[0]} — ${fr}`;
    en = `${aw[1]} — ${en}`;
  }
  if (a.eminence && eminenceOk(a.when)) {
    forge = forge.replace('TriggerZones$ Battlefield', 'TriggerZones$ Battlefield,Command');
    fr = `Éminence — ${fr}`;
    en = `Eminence — ${en}`;
  }
  return [forge, fr, en];
}

/** Déclencheur d'une capacité : [condition pour Forge, début de phrase en français, en anglais]. */
function triggerTable(a, card = null) {
  const f = a.filter;
  // La carte attachée (équipement, aura, fortification) ; sans carte, une créature équipée.
  const at = attachOf(card) || {kind: 'creature', v: 'Creature.EquippedBy', fr: 'la créature équipée', en: 'equipped creature', fem: true, scope: 'equipped'};
  const aura = at.scope === 'enchanted';
  const enters = (v) => `Mode$ ChangesZone | Origin$ Any | Destination$ Battlefield | ValidCard$ ${v} | TriggerZones$ Battlefield`;
  const dies = (v) => `Mode$ ChangesZone | Origin$ Battlefield | Destination$ Graveyard | ValidCard$ ${v} | TriggerZones$ Battlefield`;
  const phase = (p, who) => `Mode$ Phase | Phase$ ${p}${who ? ` | ValidPlayer$ ${who}` : ''} | TriggerZones$ Battlefield`;
  // Déclencheurs de marqueurs : le type (« charge » par défaut) et, pour « le Nième marqueur », N.
  const wc = counterById(a.whenCounter, 'CHARGE');
  const wn = Math.max(1, Math.min(20, Math.round(Number(a.whenN) || 3)));
  // « Un sort d'artefact », « un artefact dont la valeur de mana… » : le type choisi (le premier par défaut).
  const ck = whenKindOf({kinds: 'cast'}, a.whenKind);
  const pk = whenKindOf({kinds: 'perm'}, a.whenKind);
  const bk = whenKindOf({kinds: 'bend'}, a.whenKind);
  return {
    etb: ['Mode$ ChangesZone | Origin$ Any | Destination$ Battlefield | ValidCard$ Card.Self', 'Quand CARDNAME arrive sur le champ de bataille', 'When CARDNAME enters'],
    ally: [enters(valid(f)), `Quand ${oneFr(f)} arrive sur le champ de bataille sous votre contrôle`, `Whenever ${oneEn(f)} you control enters`],
    attacks: ['Mode$ Attacks | ValidCard$ Card.Self', 'Quand CARDNAME attaque', 'Whenever CARDNAME attacks'],
    blocks: ['Mode$ Blocks | ValidCard$ Card.Self', 'À chaque fois que CARDNAME bloque', 'Whenever CARDNAME blocks'],
    blocked: ['Mode$ AttackerBlocked | ValidCard$ Card.Self', 'À chaque fois que cette créature devient bloquée', 'Whenever CARDNAME becomes blocked'],
    combatDamage: ['Mode$ DamageDone | ValidSource$ Card.Self | ValidTarget$ Player | CombatDamage$ True',
      'À chaque fois que CARDNAME inflige des blessures de combat à un joueur', 'Whenever CARDNAME deals combat damage to a player'],
    dealsDamage: ['Mode$ DamageDone | ValidSource$ Card.Self', 'À chaque fois que CARDNAME inflige des blessures', 'Whenever CARDNAME deals damage'],
    enrage: ['Mode$ DamageDoneOnce | ValidTarget$ Card.Self', 'À chaque fois que des blessures sont infligées à CARDNAME', 'Whenever CARDNAME is dealt damage'],
    dies: ['Mode$ ChangesZone | Origin$ Battlefield | Destination$ Graveyard | ValidCard$ Card.Self', 'Quand CARDNAME meurt', 'When CARDNAME dies'],
    leaves: ['Mode$ ChangesZone | Origin$ Battlefield | Destination$ Any | ValidCard$ Card.Self', 'Quand CARDNAME quitte le champ de bataille',
      'When CARDNAME leaves the battlefield'],
    tapped: ['Mode$ Taps | ValidCard$ Card.Self', 'À chaque fois que CARDNAME s\'engage', 'Whenever CARDNAME becomes tapped'],
    heroic: ['Mode$ SpellCast | ValidActivatingPlayer$ You | TargetsValid$ Card.Self | TriggerZones$ Battlefield',
      'À chaque fois que vous lancez un sort qui cible CARDNAME', 'Whenever you cast a spell that targets CARDNAME'],
    turnedUp: ['Mode$ TurnFaceUp | ValidCard$ Card.Self | TriggerZones$ Battlefield', 'Quand vous retournez CARDNAME face visible', 'When CARDNAME is turned face up'],
    castThis: ['Mode$ SpellCast | ValidCard$ Card.Self', 'Quand vous lancez ce sort', 'When you cast this spell'],
    attacksAlly: [`Mode$ Attacks | ValidCard$ ${valid(f)} | TriggerZones$ Battlefield`, `À chaque fois ${que(oneFr(f))} que vous contrôlez attaque`,
      `Whenever ${oneEn(f)} you control attacks`],
    youAttack: ['Mode$ AttackersDeclared | AttackingPlayer$ You | TriggerZones$ Battlefield', 'À chaque fois que vous attaquez', 'Whenever you attack'],
    combatDamageAlly: [`Mode$ DamageDone | ValidSource$ ${valid(f)} | ValidTarget$ Player | CombatDamage$ True | TriggerZones$ Battlefield`,
      `À chaque fois ${que(oneFr(f))} que vous contrôlez inflige des blessures de combat à un joueur`, `Whenever ${oneEn(f)} you control deals combat damage to a player`],
    allyDies: [dies(valid(f)), `À chaque fois ${que(oneFr(f))} que vous contrôlez meurt`, `Whenever ${oneEn(f)} you control dies`],
    anyDies: [dies('Creature'), 'À chaque fois qu\'une créature meurt', 'Whenever a creature dies'],
    oppCreatureDies: [dies('Creature.OppCtrl'), 'À chaque fois qu\'une créature qu\'un adversaire contrôle meurt', 'Whenever a creature an opponent controls dies'],
    oppCreatureEnters: [enters('Creature.OppCtrl'), 'À chaque fois qu\'une créature arrive sur le champ de bataille sous le contrôle d\'un adversaire',
      'Whenever a creature an opponent controls enters'],
    landfall: [enters('Land.YouCtrl'), 'À chaque fois qu\'un terrain arrive sur le champ de bataille sous votre contrôle', 'Whenever a land you control enters'],
    constellation: [enters('Enchantment.YouCtrl'), 'À chaque fois qu\'un enchantement arrive sur le champ de bataille sous votre contrôle',
      'Whenever an enchantment you control enters'],
    artifactEnters: [enters('Artifact.YouCtrl'), 'À chaque fois qu\'un artefact arrive sur le champ de bataille sous votre contrôle',
      'Whenever an artifact you control enters'],
    counterAdded: ['Mode$ CounterAddedOnce | ValidCard$ Creature.YouCtrl | CounterType$ P1P1 | TriggerZones$ Battlefield',
      'À chaque fois qu\'au moins un marqueur +1/+1 est mis sur une créature que vous contrôlez', 'Whenever one or more +1/+1 counters are put on a creature you control'],
    unblocked: ['Mode$ AttackerUnblocked | ValidCard$ Card.Self', 'À chaque fois que CARDNAME attaque et n\'est pas bloquée', 'Whenever CARDNAME attacks and isn\'t blocked'],
    allyBlocked: ['Mode$ AttackerBlocked | ValidCard$ Creature.YouCtrl | TriggerZones$ Battlefield', 'À chaque fois qu\'une créature que vous contrôlez devient bloquée',
      'Whenever a creature you control becomes blocked'],
    unlockDoor: ['Mode$ UnlockDoor | ValidPlayer$ You | ValidCard$ Card.Self | ThisDoor$ True', 'Quand vous déverrouillez cette porte', 'When you unlock this door'],
    blocksCreature: ['Mode$ AttackerBlockedByCreature | ValidCard$ Card.Self', 'À chaque fois que CARDNAME devient bloquée par une créature',
      'Whenever CARDNAME becomes blocked by a creature'],
    becomesTarget: ['Mode$ BecomesTarget | ValidTarget$ Card.Self | TriggerZones$ Battlefield', 'À chaque fois que CARDNAME devient la cible d\'un sort ou d\'une capacité',
      'Whenever CARDNAME becomes the target of a spell or ability'],
    becomesTargetOpp: ['Mode$ BecomesTarget | ValidTarget$ Card.Self | ValidSource$ Card.OppCtrl,Emblem.OppCtrl | TriggerZones$ Battlefield',
      'À chaque fois que CARDNAME devient la cible d\'un sort ou d\'une capacité qu\'un adversaire contrôle',
      'Whenever CARDNAME becomes the target of a spell or ability an opponent controls'],
    untaps: ['Mode$ Untaps | ValidCard$ Card.Self | TriggerZones$ Battlefield', 'À chaque fois que CARDNAME se dégage', 'Whenever CARDNAME becomes untapped'],
    combatDamageOnce: ['Mode$ DamageDoneOnce | ValidSource$ Creature.YouCtrl | ValidTarget$ Player | CombatDamage$ True | TriggerZones$ Battlefield',
      'À chaque fois qu\'une ou plusieurs créatures que vous contrôlez infligent des blessures de combat à un joueur',
      'Whenever one or more creatures you control deal combat damage to a player'],
    attacksYou: ['Mode$ Attacks | ValidCard$ Creature.OppCtrl | Attacked$ You,Planeswalker.YouCtrl | TriggerZones$ Battlefield',
      'À chaque fois qu\'une créature vous attaque ou attaque un planeswalker que vous contrôlez', 'Whenever a creature attacks you or a planeswalker you control'],
    anyEnters: [enters('Creature.Other'), 'À chaque fois qu\'une autre créature arrive sur le champ de bataille', 'Whenever another creature enters'],
    tokenEnters: [enters('Card.token+YouCtrl'), 'À chaque fois qu\'un jeton arrive sur le champ de bataille sous votre contrôle', 'Whenever a token you control enters'],
    nontokenDies: [dies('Creature.nonToken+YouCtrl'), 'À chaque fois qu\'une créature non-jeton que vous contrôlez meurt', 'Whenever a nontoken creature you control dies'],
    artifactDies: [dies('Artifact.YouCtrl'), 'À chaque fois qu\'un artefact que vous contrôlez est mis dans un cimetière depuis le champ de bataille',
      'Whenever an artifact you control is put into a graveyard from the battlefield'],
    oppLandfall: [enters('Land.OppCtrl'), 'À chaque fois qu\'un terrain arrive sur le champ de bataille sous le contrôle d\'un adversaire',
      'Whenever a land an opponent controls enters'],
    playerCasts: ['Mode$ SpellCast | ValidCard$ Card | ValidActivatingPlayer$ Player | TriggerZones$ Battlefield', 'À chaque fois qu\'un joueur lance un sort',
      'Whenever a player casts a spell'],
    firstSpell: ['Mode$ SpellCast | ValidCard$ Card | ValidActivatingPlayer$ You | ActivatorThisTurnCast$ EQ1 | TriggerZones$ Battlefield',
      'À chaque fois que vous lancez votre premier sort de chaque tour', 'Whenever you cast your first spell each turn'],
    abilityCast: ['Mode$ AbilityCast | ValidActivatingPlayer$ You | ValidSA$ Activated.nonManaAbility | TriggerZones$ Battlefield',
      'À chaque fois que vous activez une capacité qui n\'est pas une capacité de mana', 'Whenever you activate an ability that isn\'t a mana ability'],
    landPlayed: ['Mode$ LandPlayed | ValidCard$ Land.YouCtrl | TriggerZones$ Battlefield', 'À chaque fois que vous jouez un terrain', 'Whenever you play a land'],
    tapsForMana: ['Mode$ TapsForMana | ValidCard$ Land | TriggerZones$ Battlefield', 'À chaque fois qu\'un joueur engage un terrain pour du mana',
      'Whenever a player taps a land for mana'],
    oppDraws: ['Mode$ Drawn | ValidCard$ Card.OppOwn | TriggerZones$ Battlefield', 'À chaque fois qu\'un adversaire pioche une carte', 'Whenever an opponent draws a card'],
    youDiscard: ['Mode$ Discarded | ValidCard$ Card.YouOwn | TriggerZones$ Battlefield', 'À chaque fois que vous vous défaussez d\'une carte', 'Whenever you discard a card'],
    youScry: ['Mode$ Scry | ValidPlayer$ You | TriggerZones$ Battlefield', 'À chaque fois que vous regardez', 'Whenever you scry'],
    youSurveil: ['Mode$ Surveil | ValidPlayer$ You | TriggerZones$ Battlefield', 'À chaque fois que vous surveillez', 'Whenever you surveil'],
    youLoseLife: ['Mode$ LifeLost | ValidPlayer$ You | TriggerZones$ Battlefield', 'À chaque fois que vous perdez des points de vie', 'Whenever you lose life'],
    youSacCreature: ['Mode$ Sacrificed | ValidCard$ Creature.YouCtrl | ValidPlayer$ You | TriggerZones$ Battlefield', 'À chaque fois que vous sacrifiez une créature',
      'Whenever you sacrifice a creature'],
    eachCombat: [phase('BeginCombat'), 'Au début de chaque combat', 'At the beginning of each combat'],
    main2: [phase('Main2', 'You'), 'Au début de votre phase principale postcombat', 'At the beginning of your postcombat main phase'],
    eachDraw: [phase('Draw'), 'Au début de l\'étape de pioche de chaque joueur', 'At the beginning of each player\'s draw step'],
    oppEnd: [phase('End of Turn', 'Opponent'), 'Au début de l\'étape de fin de chaque adversaire', 'At the beginning of each opponent\'s end step'],
    counterPutSelf: [`Mode$ CounterAddedOnce | ValidCard$ Card.Self | CounterType$ ${wc[0]} | TriggerZones$ Battlefield`,
      `À chaque fois qu'au moins un marqueur ${wc[1]} est mis sur CARDNAME`, `Whenever one or more ${wc[2]} counters are put on CARDNAME`],
    counterNth: [`Mode$ CounterAdded | ValidCard$ Card.Self | CounterType$ ${wc[0]} | CounterAmount$ EQ${wn} | TriggerZones$ Battlefield`,
      `Quand le ${ordinal(wn, 'fr')} marqueur ${wc[1]} est mis sur CARDNAME`, `When the ${ordinal(wn, 'en')} ${wc[2]} counter is put on CARDNAME`],
    lastCounterRemoved: [`Mode$ CounterRemoved | ValidCard$ Card.Self | CounterType$ ${wc[0]} | NewCounterAmount$ 0 | TriggerZones$ Battlefield`,
      `Quand le dernier marqueur ${wc[1]} est retiré de CARDNAME`, `When the last ${wc[2]} counter is removed from CARDNAME`],
    castAny: ['Mode$ SpellCast | ValidCard$ Card | ValidActivatingPlayer$ You | TriggerZones$ Battlefield', 'À chaque fois que vous lancez un sort', 'Whenever you cast a spell'],
    youBend: [`Mode$ ${bk[2]} | ValidPlayer$ You | TriggerZones$ Battlefield`, `À chaque fois que vous maîtrisez ${bk[3]}`, `Whenever you ${bk[4]}`],
    castHistoric: ['Mode$ SpellCast | ValidCard$ Card.Historic | ValidActivatingPlayer$ You | TriggerZones$ Battlefield',
      'À chaque fois que vous lancez un sort historique', 'Whenever you cast a historic spell'],
    castKind: [`Mode$ SpellCast | ValidCard$ ${ck[2]} | ValidActivatingPlayer$ You | TriggerZones$ Battlefield`,
      `À chaque fois que vous lancez ${ck[3]}`, `Whenever you cast ${ck[4]}`],
    castMv: [`Mode$ SpellCast | ValidCard$ Card.cmcGE${wn} | ValidActivatingPlayer$ You | TriggerZones$ Battlefield`,
      `À chaque fois que vous lancez un sort dont la valeur de mana est supérieure ou égale à ${wn}`, `Whenever you cast a spell with mana value ${wn} or greater`],
    entersPower: [enters(`Creature.YouCtrl+powerGE${wn}`),
      `À chaque fois qu'une créature avec une force supérieure ou égale à ${wn} arrive sur le champ de bataille sous votre contrôle`,
      `Whenever a creature you control with power ${wn} or greater enters`],
    entersMv: [enters(`${pk[2].includes('.') ? pk[2] + '+' : pk[2] + '.'}YouCtrl+cmcGE${wn}`),
      `À chaque fois ${que(pk[3])} dont la valeur de mana est supérieure ou égale à ${wn} arrive sur le champ de bataille sous votre contrôle`,
      `Whenever ${pk[4]} you control with mana value ${wn} or greater enters`],
    castNonCreature: ['Mode$ SpellCast | ValidCard$ Card.nonCreature | ValidActivatingPlayer$ You | TriggerZones$ Battlefield',
      'À chaque fois que vous lancez un sort non-créature', 'Whenever you cast a noncreature spell'],
    castCreature: ['Mode$ SpellCast | ValidCard$ Creature | ValidActivatingPlayer$ You | TriggerZones$ Battlefield',
      'À chaque fois que vous lancez un sort de créature', 'Whenever you cast a creature spell'],
    magecraft: ['Mode$ SpellCastOrCopy | ValidCard$ Instant,Sorcery | ValidActivatingPlayer$ You | TriggerZones$ Battlefield',
      'À chaque fois que vous lancez ou copiez un sort d\'éphémère ou de rituel', 'Whenever you cast or copy an instant or sorcery spell'],
    secondSpell: ['Mode$ SpellCast | ValidCard$ Card | ValidActivatingPlayer$ You | ActivatorThisTurnCast$ EQ2 | TriggerZones$ Battlefield',
      'À chaque fois que vous lancez votre deuxième sort de chaque tour', 'Whenever you cast your second spell each turn'],
    oppCasts: ['Mode$ SpellCast | ValidCard$ Card | ValidActivatingPlayer$ Opponent | TriggerZones$ Battlefield',
      'À chaque fois qu\'un adversaire lance un sort', 'Whenever an opponent casts a spell'],
    drawCard: ['Mode$ Drawn | ValidCard$ Card.YouCtrl | TriggerZones$ Battlefield', 'À chaque fois que vous piochez une carte', 'Whenever you draw a card'],
    cycle: ['Mode$ Cycled | ValidCard$ Card.YouCtrl | TriggerZones$ Battlefield', 'À chaque fois que vous recyclez une carte', 'Whenever you cycle a card'],
    sacrifice: ['Mode$ Sacrificed | ValidCard$ Permanent.YouCtrl | ValidPlayer$ You | TriggerZones$ Battlefield', 'À chaque fois que vous sacrifiez un permanent',
      'Whenever you sacrifice a permanent'],
    oppDiscards: ['Mode$ Discarded | ValidCard$ Card.OppOwn | TriggerZones$ Battlefield', 'À chaque fois qu\'un adversaire se défausse d\'une carte',
      'Whenever an opponent discards a card'],
    lifeGain: ['Mode$ LifeGained | ValidPlayer$ You | TriggerZones$ Battlefield', 'À chaque fois que vous gagnez des points de vie', 'Whenever you gain life'],
    oppLosesLife: ['Mode$ LifeLost | ValidPlayer$ Opponent | TriggerZones$ Battlefield', 'À chaque fois qu\'un adversaire perd des points de vie',
      'Whenever an opponent loses life'],
    crime: ['Mode$ CommitCrime | ValidPlayer$ You | TriggerZones$ Battlefield', 'À chaque fois que vous commettez un crime', 'Whenever you commit a crime'],
    upkeep: [phase('Upkeep', 'You'), 'Au début de votre entretien', 'At the beginning of your upkeep'],
    eachUpkeep: [phase('Upkeep'), 'Au début de chaque entretien', 'At the beginning of each upkeep'],
    oppUpkeep: [phase('Upkeep', 'Opponent'), 'Au début de l\'entretien de chaque adversaire', 'At the beginning of each opponent\'s upkeep'],
    drawStep: [phase('Draw', 'You'), 'Au début de votre étape de pioche', 'At the beginning of your draw step'],
    main1: [phase('Main1', 'You'), 'Au début de votre phase principale précombat', 'At the beginning of your precombat main phase'],
    beginCombat: [phase('BeginCombat', 'You'), 'Au début du combat de votre tour', 'At the beginning of combat on your turn'],
    endCombat: [phase('EndCombat', 'You'), 'À la fin du combat de votre tour', 'At end of combat on your turn'],
    end: [phase('End of Turn', 'You'), 'Au début de votre étape de fin', 'At the beginning of your end step'],
    eachEnd: [phase('End of Turn'), 'Au début de chaque étape de fin', 'At the beginning of each end step'],
    attachedAttacks: [`Mode$ Attacks | ValidCard$ ${at.v}`, `À chaque fois que ${at.fr} attaque`, `Whenever ${at.en} attacks`],
    attachedCombatDamage: [`Mode$ DamageDone | ValidSource$ ${at.v} | ValidTarget$ Player | CombatDamage$ True | TriggerZones$ Battlefield`,
      `À chaque fois que ${at.fr} inflige des blessures de combat à un joueur`, `Whenever ${at.en} deals combat damage to a player`],
    // Une aura part au cimetière avec sa créature : « Quand » ; un équipement reste : « À chaque fois que ».
    attachedDies: [`Mode$ ChangesZone | Origin$ Battlefield | Destination$ Graveyard | ValidCard$ ${at.v}`,
      `${aura ? 'Quand' : 'À chaque fois que'} ${at.fr} meurt`, `${aura ? 'When' : 'Whenever'} ${at.en} dies`],
    becomesAttached: ['Mode$ Attached | ValidSource$ Card.Self | ValidTarget$ Creature | TriggerZones$ Battlefield',
      `À chaque fois que ${aura ? 'cette aura devient attachée' : 'cet équipement devient attaché'} à une créature`,
      `Whenever this ${aura ? 'Aura' : 'Equipment'} becomes attached to a creature`],
    attachedTapped: [`Mode$ Taps | ValidCard$ ${at.v}`, `À chaque fois que ${at.fr} devient engagé${at.fem ? 'e' : ''}`, `Whenever ${at.en} becomes tapped`],
    ePlayerUpkeep: ['Mode$ Phase | Phase$ Upkeep | ValidPlayer$ Player.EnchantedBy | TriggerZones$ Battlefield', 'Au début de l\'entretien du joueur enchanté',
      'At the beginning of enchanted player\'s upkeep'],
    ePlayerEnd: ['Mode$ Phase | Phase$ End of Turn | ValidPlayer$ Player.EnchantedBy | TriggerZones$ Battlefield', 'Au début de l\'étape de fin du joueur enchanté',
      'At the beginning of enchanted player\'s end step'],
    ePlayerAttacked: ['Mode$ AttackersDeclared | AttackedTarget$ Player.EnchantedBy | TriggerZones$ Battlefield', 'À chaque fois que le joueur enchanté est attaqué',
      'Whenever enchanted player is attacked'],
    ePlayerCasts: ['Mode$ SpellCast | ValidCard$ Card | ValidActivatingPlayer$ Player.EnchantedBy | TriggerZones$ Battlefield',
      'À chaque fois que le joueur enchanté lance un sort', 'Whenever enchanted player casts a spell'],
    ePlayerDraws: ['Mode$ Drawn | ValidCard$ Card.OwnedBy Player.EnchantedBy | TriggerZones$ Battlefield', 'À chaque fois que le joueur enchanté pioche une carte',
      'Whenever enchanted player draws a card'],
    ePlayerCreature: [enters('Creature.EnchantedPlayerCtrl'), 'À chaque fois qu\'une créature arrive sur le champ de bataille sous le contrôle du joueur enchanté',
      'Whenever a creature enters under enchanted player\'s control'],
  }[a.when];
}

/**
 * « Choisissez l'un — » : chaque mode est une capacité (une SVar) avec sa description dans la langue de la carte ; Forge
 * propose les modes au moment de jouer. Le texte suit la carte : « …, choisissez l'un —\n• A.\n• B. ».
 */
function modalLines(a, id, w, lang, card) {
  const en = lang === 'en';
  const parts = [];
  (a.modes || []).slice(0, 3).forEach((m, k) => {
    const mid = `${id}M${k + 1}`;
    const e = effect({...newMode(), ...m, when: a.when, attachTo: a.attachTo, attachWhen: a.attachWhen}, mid);
    if (e) {
      // Un mode peut avoir un nom, comme sur les cartes récentes (« • Souffle des marées — Piochez une carte. »).
      const label = cleanModeName(m.flavor);
      parts.push({mid, e, text: (label ? `${label} — ` : '') + capitalize(en ? e.en : e.fr) + '.'});
    }
  });
  if (parts.length < 2) {
    return null;
  }
  const modes = parts.flatMap(p => [`SVar:${p.mid}:DB$ ${p.e.p} | SpellDescription$ ${p.text}`, ...(p.e.extra || []), ...(p.e.aux || [])]);
  // Combien de modes : « choisissez deux » demande trois modes ; « un ou plusieurs », de un à tous.
  const pick = a.pick === 'two' && parts.length >= 3 ? 'two' : a.pick === 'oneOrMore' ? 'oneOrMore' : 'one';
  const num = pick === 'two' ? ' | CharmNum$ 2' : pick === 'oneOrMore' ? ` | CharmNum$ ${parts.length} | MinCharmNum$ 1` : '';
  const charm = `Charm | Choices$ ${parts.map(p => p.mid).join(',')}${num}`;
  const choose = {one: en ? 'choose one —' : 'choisissez l\'un —', two: en ? 'choose two —' : 'choisissez deux —',
    oneOrMore: en ? 'choose one or more —' : 'choisissez un ou plusieurs —'}[pick];
  const bullets = parts.map(p => `\\n• ${p.text}`).join('');
  if (w.kind === 'SP') {
    const c = spellCost(a, lang, card);
    return {lines: [`A:SP$ ${charm}${c.forge}`, ...modes], text: c.text + capitalize(choose) + bullets};
  }
  if (w.kind === 'CH') {
    const ks = chaptersOf(a);
    return {chapter: ks[0], chapters: ks, body: `${capitalize(choose)}${bullets}`, lines: [`SVar:${id}:DB$ ${charm}`, ...modes],
      text: `${ks.map(k => ROMAN[k - 1]).join(', ')} — ${capitalize(choose)}${bullets}`};
  }
  if (w.kind === 'A') {
    if (a.when === 'loyalty') {
      const k = Math.round(Number(a.loyalty) || 0);
      const cost = k >= 0 ? `AddCounter<${k}/LOYALTY>` : `SubCounter<${-k}/LOYALTY>`;
      const head = en ? `${k > 0 ? '+' : k < 0 ? '−' : ''}${Math.abs(k)}:` : `[${k > 0 ? '+' : ''}${k}] :`;
      return {lines: [`A:AB$ ${charm} | Cost$ ${cost} | Planeswalker$ True | CostDesc$ ${head}`, ...modes], text: `${head} ${capitalize(choose)}${bullets}`};
    }
    const c = activationCost(a, lang);
    const lim = activationLimits(a, lang);
    return {lines: [`A:AB$ ${charm} | Cost$ ${c.forge}${lim.forge} | CostDesc$ ${c.text}${en ? ':' : ' :'}`, ...modes, ...(a.tapX && !tapCount(a) ? ['SVar:X:Count$xPaid'] : [])],
      text: `${c.text}${en ? ':' : ' :'} ${capitalize(choose)}${bullets}${lim.text}`};
  }
  const head = triggerHead(a, card);
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
  // Sur la carte, seulement le texte d'ambiance (les capacités restent dans Forge et en partie).
  if (d.hideText) {
    out.push('SVar:AtelierHideText:1');
  }
  // Extension perso (son identifiant), rareté et artiste : en bas de la carte et à côté du type.
  if (/^[a-z0-9]{1,20}$/.test(d.set || '')) {
    out.push(`SVar:AtelierSet:${d.set}`);
  }
  if (RARITIES.some(r => r[0] === d.rarity && r[0])) {
    out.push(`SVar:AtelierRarity:${d.rarity}`);
  }
  if (cleanArtist(d.artist)) {
    out.push(`SVar:AtelierArtist:${cleanArtist(d.artist)}`);
  }
  return out;
}

/** Raretés d'une carte perso (la couleur du symbole d'extension et la lettre en bas de la carte). */
export const RARITIES = [['', 'Aucune'], ['C', 'Commune'], ['U', 'Peu commune'], ['R', 'Rare'], ['M', 'Mythique'], ['S', 'Spéciale']];

/** Le nom d'un artiste pour le script : une ligne, sans « | », 60 caractères au plus. */
export function cleanArtist(a) {
  return String(a || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

/** Un texte d'ambiance pour le script : sur une ligne (« \\n » pour aller à la ligne), sans « | », 240 caractères au plus. */
export function cleanFlavor(t) {
  return String(t || '').replace(/\r/g, '').trim().slice(0, 240).replace(/\|/g, '/').replace(/\n/g, '\\n');
}

/** Le nom d'un mode (« Souffle des marées — … ») : une ligne, sans « | » ni tiret long, 40 caractères au plus. */
export function cleanModeName(t) {
  return String(t || '').replace(/[|\r\n—]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
}

/** Réglages d'affichage écrits dans un script (lignes « SVar:Atelier… »). */
export function readDisplay(script) {
  const get = (k) => (String(script || '').match(new RegExp(`^SVar:${k}:(\\S+)`, 'm')) || [])[1];
  return {frame: get('AtelierFrame') || 'modern', frameColor: get('AtelierFrameColor') || 'auto', lang: get('AtelierLang') === 'en' ? 'en' : 'fr',
    frameText: get('AtelierFrameText') === 'light' ? 'light' : 'dark', fx: get('AtelierFx') || 'none', hideText: get('AtelierHideText') === '1',
    set: get('AtelierSet') || '', rarity: get('AtelierRarity') || '', artist: cleanArtist((String(script || '').match(/^SVar:AtelierArtist:(.*)$/m) || [])[1])};
}

/** Le script avec d'autres réglages d'affichage (pour le mode script). */
export function withDisplay(script, d) {
  const kept = String(script || '').split('\n').filter(l => !/^SVar:Atelier(Frame|FrameColor|FrameText|Lang|Fx|HideText|Set|Rarity|Artist):/.test(l));
  while (kept.length && !kept[kept.length - 1].trim()) {
    kept.pop();
  }
  return [...kept, ...displayLines(d)].join('\n');
}

/** Sous-types qu'impose la carte : ceux de ses mots-clés (Enchanter : Aura, Équipement…) et Saga avec des chapitres. */
export function autoSubtypes(f) {
  const types = f.types || [];
  const out = [];
  for (const k of f.keywords || []) {
    const o = keywordOptions(k);
    if (o.sub && (!o.base || types.includes(o.base)) && !out.includes(o.sub)) {
      out.push(o.sub);
    }
  }
  if ((f.abilities || []).some(a => a.when === 'chapter') && types.includes('Enchantment') && !out.includes('Saga')) {
    out.push('Saga');
  }
  return out;
}

/** La carte a-t-elle une force et une endurance : créature, véhicule (Pilotage) ou monture. */
export function needsPT(f) {
  const types = f.types || [];
  const subs = forgeSubtypes(f.subtypes);
  return types.includes('Creature') || (f.keywords || []).some(k => keywordOptions(k).pt && !(k === 'Station' && isPlanet(f)))
    || subs.includes('Vehicle') || subs.includes('Spacecraft');
}

/** Une planète : un terrain (pas un artefact) avec Station ; à STATION N+, il gagne des capacités, sans devenir une créature. */
export function isPlanet(f) {
  const types = f.types || [];
  return types.includes('Land') && !types.includes('Artifact') && !forgeSubtypes(f.subtypes).includes('Spacecraft');
}

/** L'IA d'une aura : la mettre sur ses créatures (Pump), sur celles de l'adversaire (Curse) ou en prendre le contrôle. */
function auraLogic(f) {
  const enchant = keywordValue(f, 'Enchant') || '';
  const statics = (f.abilities || []).filter(a => a.when === 'static' && (a.scope === 'enchanted' || a.effect === 'controlEnchanted'));
  if (statics.some(a => a.effect === 'controlEnchanted')) {
    return 'GainControl';
  }
  if (/OppCtrl|^(Player|Opponent)/.test(enchant) || statics.some(a => ['cantAttack', 'cantBlock', 'cantAttackBlock', 'debuff', 'noActivated', 'doesntUntap'].includes(a.effect))) {
    return 'Curse';
  }
  return 'Pump';
}

/** Le nom de la carte dans son texte : « de Ilona » devient « d'Ilona », « que Ilona » « qu'Ilona ». */
function named(text, name) {
  const vowel = /^[aeiouyhàâéèêîôûAEIOUYHÀÂÉÈÊÎÔÛ]/.test(name);
  return String(text).replace(/\b(de|que) CARDNAME/g, (m, w) => (vowel ? `${w === 'que' ? 'qu' : 'd'}'${name}` : `${w} ${name}`)).replace(/CARDNAME/g, name);
}

/** Mots-clés écrits après les capacités, comme sur les cartes imprimées (Équipement, Pilotage…). */
const TRAILING_KEYWORDS = new Set(['Equip', 'Reconfigure', 'Fortify', 'Crew', 'Saddle']);

/** Effets permanents qu'une carte imprimée écrit en une phrase : « gagne +2/+0 et a l'initiative ». */
const MERGEABLE = new Set(['anthem', 'anthemPower', 'debuff', 'grantKeyword']);

/**
 * Les capacités, avec leur numéro, après regroupement des effets permanents sur les mêmes créatures (même portée,
 * filtre, condition, Éminence) : un bonus de force et des mots-clés deviennent une seule capacité « combo ».
 */
function mergeStatics(abilities) {
  const out = [];
  const groups = new Map();
  abilities.forEach((a, i) => {
    if (a.when !== 'static' || !MERGEABLE.has(a.effect)) {
      out.push([a, i]);
      return;
    }
    const f = a.filter || {};
    const key = JSON.stringify([a.scope || 'you', f.type || '', !!f.other, a.cond || 'none', a.condN ?? 3, a.condType || '', !!a.eminence,
      Number(a.level) || 1, !!a.solved, cleanModeName(a.flavor)]);
    const g = groups.get(key);
    const pt = (x) => x.effect !== 'grantKeyword';
    if (g && !(pt(a) && g.parts.some(pt))) {
      g.parts.push(a);
      return;
    }
    const entry = {parts: [a], index: i};
    if (!g) {
      groups.set(key, entry);
    }
    out.push(entry);
  });
  return out.map(e => (Array.isArray(e) ? e : [e.parts.length > 1 ? {...e.parts[0], effect: 'combo', parts: e.parts} : e.parts[0], e.index]));
}

/**
 * Une capacité avec son nom, comme sur les cartes récentes (« Rugissement terrifiant — Quand… ») : dans le texte de la
 * carte et dans la description que Forge montre (déclencheur, capacité, effet permanent, chapitre de saga ; après la
 * loyauté pour un planeswalker).
 */
function withAbilityName(r, label) {
  if (!label) {
    return r;
  }
  const w = `${label} — `;
  let done = false;
  const lines = r.lines.map((l) => {
    if (done) {
      return l;
    }
    let out = l;
    if (/^T:/.test(l)) {
      out = l.replace('TriggerDescription$ ', `TriggerDescription$ ${w}`);
    } else if (/^(S|R):/.test(l)) {
      out = l.replace('| Description$ ', `| Description$ ${w}`);
    } else if (/^A:/.test(l)) {
      out = /Planeswalker\$ True/.test(l) || !l.includes('CostDesc$ ') ? l.replace('SpellDescription$ ', `SpellDescription$ ${w}`) : l.replace('CostDesc$ ', `CostDesc$ ${w}`);
    } else if (r.chapter && /^SVar:[^:]+:DB\$ /.test(l)) {
      out = l.replace('SpellDescription$ ', `SpellDescription$ ${w}`);
    }
    done = out !== l;
    return out;
  });
  let text = w + r.text;
  if (r.chapter) {
    text = r.text.replace(/^([IVX, ]+ — )/, `$1${w}`);
    return {...r, lines, text, body: r.body ? w + r.body : r.body};
  } else if (/^(\[[^\]]+\] :|[+−]?\d+:) /.test(r.text)) {
    text = r.text.replace(/^(\[[^\]]+\] :|[+−]?\d+:) /, `$1 ${w}`);
  }
  return {...r, lines, text};
}

/**
 * Cartes à deux faces : [id, libellé, « AlternateMode » de Forge, le verso a-t-il son propre coût, aide].
 * Transformable, jour/nuit et bataille : le verso n'a pas de coût (ses couleurs sont dites à part).
 */
export const DFC_MODES = [
  ['', 'Une seule face'],
  ['transform', 'Recto verso qui se transforme (créature ↔ enchantement…)', 'DoubleFaced', false,
    'Le recto se retourne avec l\'effet « La transformer » (dans une capacité), ou dans l\'autre sens depuis le verso.'],
  ['daynight', 'Jour et nuit (Diurne / Nocturne)', 'DoubleFaced', false,
    'Diurne au recto, Nocturne au verso : la carte se retourne quand le jour devient la nuit, et l\'inverse.'],
  ['battle', 'Bataille (siège) : vaincue, elle se retourne', 'DoubleFaced', false,
    'Le recto est une bataille avec sa défense ; vaincue, elle est exilée puis lancée retournée (le verso).'],
  ['modal', 'Recto verso modale (on joue la face de son choix)', 'Modal', true,
    'Chaque face a son coût : on lance (ou joue) celle qu\'on veut.'],
  ['adventure', 'Aventure (un éphémère ou un rituel dans la carte)', 'Adventure', true,
    'Le verso est le sort d\'aventure : lancé, la carte part en exil, puis on peut lancer le recto depuis l\'exil.'],
  ['prepare', 'Préparée (un sort qu\'on copie quand elle est préparée)', 'Prepare', true,
    'Le verso est le sort de la carte. Une capacité « La préparer » la rend préparée : on peut alors lancer une copie du sort.'],
  ['room', 'Pièce (un enchantement à deux portes)', 'Split', true,
    'Deux portes, chacune avec son coût : on lance l\'une ou l\'autre, qui arrive déverrouillée. Comme un rituel, payer le coût d\'une porte verrouillée la déverrouille. Déclencheur utile : « Quand vous déverrouillez cette porte ».'],
  ['omen', 'Présage (un sort qui retourne dans la bibliothèque)', 'Omen', true,
    'Le verso est le sort du présage : lancé, la carte est mélangée dans la bibliothèque au lieu d\'aller au cimetière. Le recto se lance normalement.'],
];

/** Un coût de Forge (« 2 B B », « W/U », « no cost ») dans le format du formulaire (« {2}{B}{B} »). */
function costToForm(cost) {
  const c = String(cost || '').trim();
  if (!c || /^no cost$/i.test(c)) {
    return '';
  }
  return c.split(/\s+/).map(p => `{${p.replace(/[{}]/g, '')}}`).join('');
}

/**
 * Script Forge → formulaire : nom, coût, supertypes, types, sous-types, force et endurance, loyauté, mots-clés connus
 * de l'Atelier. Les capacités écrites en script (A:, T:, S:, R:) et les mots-clés inconnus sont comptés dans skipped :
 * le formulaire ne sait pas les lire, ils sont à refaire avec « + Capacité ».
 */
export function scriptToForm(script) {
  const lines = String(script || '').split('\n').map(l => l.replace(/\r$/, ''));
  const alt = lines.findIndex(l => l.trim() === 'ALTERNATE');
  const main = alt >= 0 ? lines.slice(0, alt) : lines;
  const get = (k) => {
    const l = main.find(x => x.startsWith(k + ':'));
    return l ? l.slice(k.length + 1).trim() : '';
  };
  const form = {name: get('Name'), cost: costToForm(get('ManaCost')), types: [], legendary: false, world: false, subtypes: '',
    keywords: [], kwValues: {}, abilities: []};
  const subs = [];
  for (const w of get('Types').split(/\s+/).filter(Boolean)) {
    if (w === 'Legendary') {
      form.legendary = true;
    } else if (w === 'World') {
      form.world = true;
    } else if (CARD_TYPES.some(c => c[0] === w)) {
      form.types.push(w);
    } else if (!['Snow', 'Basic', 'Ongoing', 'Elite', 'Host', '-'].includes(w)) {
      subs.push(w);
    }
  }
  form.subtypes = subs.join(' ');
  const pt = /^(\d+)\/(\d+)$/.exec(get('PT'));
  if (pt) {
    form.power = Number(pt[1]);
    form.toughness = Number(pt[2]);
  }
  if (/^\d+$/.test(get('Loyalty'))) {
    form.loyaltyStart = Number(get('Loyalty'));
  }
  const skipped = [];
  for (const l of main) {
    if (l.startsWith('K:')) {
      const [id, ...rest] = l.slice(2).split(':');
      const def = KW_BY[id];
      if (def && !(def[7] && def[7].line)) {
        form.keywords.push(id);
        if (rest.length) {
          form.kwValues[id] = def[4] === 'cost' ? costToForm(rest.join(':')) : rest.join(':');
        }
      } else {
        skipped.push(l);
      }
    } else if (/^(A|T|S|R):/.test(l)) {
      skipped.push(l);
    }
  }
  if (alt >= 0) {
    skipped.push('ALTERNATE');
  }
  return {form, skipped};
}

/** Ce qui fait une face (le verso d'une carte) : tout sauf la présentation et les faces. */
export function facePart(f) {
  const out = {};
  for (const k of ['name', 'cost', 'colors', 'types', 'legendary', 'world', 'subtypes', 'power', 'toughness', 'loyaltyStart', 'keywords', 'kwValues',
    'abilities', 'flavor', 'classCosts', 'caseCond']) {
    if (f[k] !== undefined) {
      out[k] = f[k];
    }
  }
  return out;
}

/** Le script complet d'une carte du formulaire (avec son verso, pour une carte à deux faces). */
export function buildScript(form) {
  const mode = DFC_MODES.find(m => m[0] && m[0] === form.dfc);
  // Verso pas encore nommé : le recto seul, le temps de le remplir (l'enregistrement demande son nom).
  if (!mode || !form.back || form.token || !String(form.back.name || '').trim()) {
    return buildFace(form);
  }
  const en = form.lang === 'en';
  const front = {...form, back: null};
  const back = {...facePart(form.back), lang: form.lang, token: false, flavor: form.back.flavor || ''};
  back.types = [...(back.types || [])];
  if (mode[0] === 'room') {
    // Une pièce : deux portes, deux enchantements « Pièce » (sans force ni endurance).
    for (const face of [front, back]) {
      face.types = ['Enchantment'];
      face.subtypes = [...new Set([...forgeSubtypes(face.subtypes || '').filter(t => t !== 'Room'), 'Room'])].join(' ');
      face.power = undefined;
      face.toughness = undefined;
    }
  }
  if (mode[0] === 'adventure' || mode[0] === 'prepare' || mode[0] === 'omen') {
    // Le sort d'aventure (ou de la carte préparée) : un éphémère ou un rituel.
    if (!back.types.some(t => t === 'Instant' || t === 'Sorcery')) {
      back.types = ['Sorcery'];
    }
    back.power = undefined;
    back.toughness = undefined;
    if (mode[0] === 'adventure' || mode[0] === 'omen') {
      back.subtypes = [...new Set([...forgeSubtypes(back.subtypes || ''), mode[0] === 'omen' ? 'Omen' : 'Adventure'])].join(' ');
    }
  }
  const a = buildFace(front).split('\n');
  const b = buildFace(back).split('\n').filter(l => !/^SVar:Atelier(Frame|FrameColor|FrameText|Lang|Fx|HideText|Set|Rarity|Artist):/.test(l));
  const oracleA = a.findIndex(l => l.startsWith('Oracle:'));
  const addOracle = (lines, i, pre) => {
    if (i >= 0) {
      lines[i] = `Oracle:${pre}${lines[i].slice(7) ? '\\n' + lines[i].slice(7) : ''}`;
    } else {
      lines.push(`Oracle:${pre}`);
    }
  };
  if (mode[0] === 'battle') {
    // Une bataille : siège, avec sa défense (le nombre de marqueurs à lui retirer pour la vaincre).
    const t = a.findIndex(l => l.startsWith('Types:'));
    a[t] = 'Types:Battle Siege';
    a.splice(t + 1, 0, `Defense:${Math.max(1, Math.min(20, Math.round(Number(form.defense) || 5)))}`);
    a.splice(0, a.length, ...a.filter(l => !l.startsWith('PT:')));
    addOracle(a, a.findIndex(l => l.startsWith('Oracle:')), en ? '(As a Siege enters, choose an opponent to protect it. You and others can attack it. When it\'s defeated, exile it, then cast it transformed.)'
      : '(Au moment où un siège arrive sur le champ de bataille, choisissez un adversaire pour le protéger. Vous et d\'autres pouvez l\'attaquer. Quand il est vaincu, exilez-le, puis lancez-le transformé.)');
  }
  if (mode[0] === 'room') {
    const room = en ? '(You may cast either half. That door unlocks on the battlefield. As a sorcery, you may pay the mana cost of a locked door to unlock it.)'
      : '(Vous pouvez lancer l\'une ou l\'autre moitié. Cette porte se déverrouille sur le champ de bataille. Comme un rituel, vous pouvez payer le coût de mana d\'une porte verrouillée pour la déverrouiller.)';
    for (const lines of [a, b]) {
      const i = lines.findIndex(l => l.startsWith('Oracle:'));
      if (i >= 0) {
        lines[i] = `Oracle:${room}${lines[i].slice(7) ? '\\n' + lines[i].slice(7) : ''}`;
      } else {
        lines.push(`Oracle:${room}`);
      }
    }
  }
  if (mode[0] === 'daynight') {
    a.splice(Math.max(1, oracleA), 0, 'K:Daybound');
    b.push('K:Nightbound');
    addOracle(a, a.findIndex(l => l.startsWith('Oracle:')), en ? 'Daybound (If a player casts no spells during their own turn, it becomes night next turn.)'
      : 'Diurne (Si un joueur ne lance aucun sort pendant son propre tour, il devient la nuit au tour suivant.)');
    addOracle(b, b.findIndex(l => l.startsWith('Oracle:')), en ? 'Nightbound (If a player casts at least two spells during their own turn, it becomes day next turn.)'
      : 'Nocturne (Si un joueur lance au moins deux sorts pendant son propre tour, il devient le jour au tour suivant.)');
  }
  if (!mode[3]) {
    // Le verso d'une carte qui se transforme n'a pas de coût : ses couleurs (celles choisies, sinon celles du recto).
    const cols = (back.colors && back.colors.length ? back.colors : [...'WUBRG'].filter(c => forgeCost(form.cost).includes(c)));
    const words = [...'WUBRG'].filter(c => cols.includes(c)).map(c => COLOR_WORDS[c]);
    const m = b.findIndex(l => l.startsWith('ManaCost:'));
    b[m] = 'ManaCost:no cost';
    b.splice(m + 1, 0, `Colors:${words.join(',') || 'colorless'}`);
  }
  const at = a.findIndex(l => l.startsWith('Oracle:'));
  a.splice(at >= 0 ? at : a.length, 0, `AlternateMode:${mode[2]}`);
  return [...a, '', 'ALTERNATE', '', ...b].join('\n');
}

/** Le script d'une face (une carte à une face, ou le recto / le verso d'une carte à deux faces). */
function buildFace(form) {
  // Les sous-types marchent comme dans le jeu : le mot-clé qui les fait marcher, le type de carte qu'ils demandent.
  const f = {...form, types: [...(form.types || [])], keywords: [...(form.keywords || [])], kwValues: {...(form.kwValues || {})}};
  linkSubtypes(f, {keepTypes: true});
  const lang = f.lang === 'en' ? 'en' : 'fr';
  const en = lang === 'en';
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
  const sub = cardSubtypes(f);
  lines.push(`Types:${[f.legendary ? 'Legendary' : '', f.world ? 'World' : '', ...types, ...sub].filter(Boolean).join(' ')}`);
  const cda = (f.abilities || []).some(a => a.when === 'static' && a.effect === 'cdaPT');
  if (needsPT(f) || types.includes('Creature')) {
    lines.push(cda ? 'PT:*/*' : `PT:${Number(f.power) || 0}/${Number(f.toughness) || 0}`);
  }
  if (types.includes('Planeswalker')) {
    lines.push(`Loyalty:${Math.max(1, Number(f.loyaltyStart) || 3)}`);
  }
  const text = [];
  // Types de terrain de base : Forge donne la capacité de mana ; la carte l'écrit (« ({T} : Ajoutez {G} ou {U}.) »).
  const mana = types.includes('Land') ? basicManaText(sub, lang) : '';
  if (mana) {
    text.push(mana);
  }
  const kws = (f.keywords || []).filter(k => KW_FR[k]);
  let stationN = 0;
  for (const k of kws) {
    const line = keywordLine(f, k);
    if (line) {
      lines.push(line);
    }
  }
  if (kws.includes('Enchant')) {
    lines.push(`SVar:AttachAILogic:${auraLogic(f)}`);
  }
  // Les mots-clés simples sur une ligne (« Vol, piétinement »), ceux à nombre ou à coût chacun sur la sienne.
  const simple = kws.filter(simpleKeyword);
  if (simple.length) {
    text.push(simple.map((k, i) => i ? keywordName(k, lang).toLowerCase() : keywordName(k, lang)).join(', '));
  }
  for (const k of kws.filter(k => !simpleKeyword(k) && !TRAILING_KEYWORDS.has(k))) {
    const t = keywordText(f, k, lang);
    if (t) {
      text.push(t);
    }
    if (k === 'Station') {
      // « STATION 6+ » : écrit après les capacités (le vaisseau y devient une créature-artefact, la planète y gagne ses
      // capacités « à STATION N+ »).
      stationN = Math.max(1, Number(keywordValue(f, 'Station')) || 1);
    }
  }
  // Capacités « à STATION N+ » : ajoutées par un effet permanent à partir de N marqueurs charge.
  const station = {params: {}, lines: [], text: []};
  // Chapitres de saga : un par numéro (le premier compte), dans l'ordre ; « K:Chapter » les nomme tous.
  const chapters = new Map();
  // Classe : les capacités des niveaux 2 et 3 ; affaire : les capacités « Résolue — ».
  const isClass = sub.includes('Class');
  const isCase = sub.includes('Case');
  const levels = {2: {params: {}, lines: [], text: []}, 3: {params: {}, lines: [], text: []}};
  const solved = [];
  mergeStatics(f.abilities || []).forEach(([a, i]) => {
    const r = withAbilityName(abilityLines(a, i, lang, f), cleanModeName(a.flavor));
    if (!r) {
      return;
    }
    if (r.chapter) {
      // Un chapitre peut avoir plusieurs capacités (elles s'enchaînent), une capacité plusieurs chapitres (« I, II — »).
      const entry = {id: `Atelier${i + 1}`, r};
      for (const k of r.chapters || [r.chapter]) {
        chapters.set(k, [...(chapters.get(k) || []), entry]);
      }
      return;
    }
    const t = named(r.text, name);
    if (stationN && a.station) {
      // Une capacité « à STATION N+ » : une SVar que l'effet permanent de la station ajoute (AddAbility$, AddTrigger$…).
      r.lines.forEach((l, k) => {
        const m = /^(T|S|A):(.*)$/.exec(l);
        if (!m) {
          station.lines.push(l);
          return;
        }
        const id = `Atelier${i + 1}S${k}`;
        const param = {T: 'AddTrigger', S: 'AddStaticAbility', A: 'AddAbility'}[m[1]];
        station.lines.push(`SVar:${id}:${m[2]}${m[1] === 'A' ? '' : ' | Secondary$ True'}`);
        (station.params[param] = station.params[param] || []).push(id);
      });
      station.text.push(t);
      return;
    }
    const lvl = isClass ? Math.max(1, Math.min(3, Math.round(Number(a.level) || 1))) : 1;
    if (lvl > 1) {
      // Une capacité de niveau : une SVar que « K:Class » ajoute (AddTrigger$, AddStaticAbility$…).
      const L = levels[lvl];
      r.lines.forEach((l, k) => {
        const m = /^(T|S|R|A):(.*)$/.exec(l);
        if (!m) {
          L.lines.push(l);
          return;
        }
        const id = `Atelier${i + 1}L${k}`;
        const param = {T: 'AddTrigger', S: 'AddStaticAbility', R: 'AddReplacementEffect', A: 'AddAbility'}[m[1]];
        L.lines.push(`SVar:${id}:${m[2]}${m[1] === 'A' ? '' : ' | Secondary$ True'}`);
        (L.params[param] = L.params[param] || []).push(id);
      });
      L.text.push(t);
      return;
    }
    if (isCase && a.solved) {
      // « Résolue — » : la capacité ne marche qu'une fois l'affaire résolue.
      const word = `${en ? 'Solved' : 'Résolue'} — `;
      const desc = (l) => (/^A:/.test(l) ? l.replace(/\| CostDesc\$ /, `| CostDesc$ ${word}`) : l.replace(/\| (Trigger)?Description\$ /, (m) => m + word));
      solved.push({lines: r.lines.map(l => (/^(T|S|R|A):/.test(l) ? `${desc(l)} | IsPresent$ Card.Self+IsSolved` : l)), text: `${word}${t}`});
      return;
    }
    lines.push(...r.lines);
    text.push(t);
  });
  if (isClass) {
    for (const lvl of [2, 3]) {
      const L = levels[lvl];
      if (!L.text.length && !(lvl === 2 && levels[3].text.length)) {
        continue;
      }
      const lc = forgeCost(((f.classCosts || {})[lvl]) || '') || '0';
      let params = Object.entries(L.params).map(([k, v]) => `${k}$ ${v.join(' & ')}`).join(' | ');
      if (!params) {
        // Un niveau sans capacité (il faut le niveau 2 pour le niveau 3) : une capacité qui ne fait rien.
        lines.push(`SVar:AtelierLv${lvl}:Mode$ Continuous | Affected$ Card.Self | Secondary$ True | Description$ —`);
        params = `AddStaticAbility$ AtelierLv${lvl}`;
      }
      lines.push(`K:Class:${lvl}:${lc}:${params}`, ...L.lines);
      text.push(`${costSymbols(lc) || '{0}'}${en ? ':' : ' :'} ${en ? 'Level' : 'Niveau'} ${lvl}`, ...L.text);
    }
  }
  if (isCase) {
    // « À résoudre — » : vérifié au début de votre étape de fin ; l'affaire devient résolue.
    const c = f.caseCond ? conditionOf({cond: f.caseCond, condN: f.caseN, condType: f.caseType}) : null;
    if (c && c.count) {
      const what = en ? c.en.replace(/^if /, '') : c.fr.replace(/^si /, '').replace(/^s'il /, 'il ');
      const t = `${en ? 'To solve' : 'À résoudre'} — ${endDot(capitalize(what))}`;
      lines.push(`T:Mode$ Phase | Phase$ End of Turn | ValidPlayer$ You | TriggerZones$ Battlefield | IsPresent$ Card.Self+!IsSolved | CheckSVar$ AtelierSolveC | SVarCompare$ ${c.cmp} | Execute$ AtelierSolve | TriggerDescription$ ${t}`,
        'SVar:AtelierSolve:DB$ AlterAttribute | Defined$ Self | Attributes$ Solved', `SVar:AtelierSolveC:${c.count}`);
      text.push(t);
    }
    for (const s of solved) {
      lines.push(...s.lines);
      text.push(s.text);
    }
  }
  // Nourriture, indice, trésor… : la capacité des jetons du même nom (sauf si l'Atelier l'a retirée).
  for (const t of sub) {
    if (SUBTYPE_ABILITIES[t] && !(f.subOff || []).includes(t)) {
      const r = subtypeAbilityLines(t, `AtelierSub${t.replace(/\W/g, '')}`, lang);
      lines.push(...r.lines);
      text.push(named(r.text, name));
    }
  }
  // Comme sur les cartes imprimées : « Équipement {1} », « Pilotage 2 »… en dernier, après les capacités.
  for (const k of kws.filter(k => TRAILING_KEYWORDS.has(k))) {
    const t = keywordText(f, k, lang);
    if (t) {
      text.push(t);
    }
  }
  if (stationN) {
    // Vaisseau spatial : une créature-artefact à STATION N+ ; planète (un terrain) : seulement ses capacités.
    const planet = isPlanet(f);
    const head = `STATION ${stationN}+`;
    const parts = [...(planet ? [] : ['AddType$ Creature']), ...Object.entries(station.params).map(([k, v]) => `${k}$ ${v.join(' & ')}`)];
    const first = planet ? head : (en ? `${head} — It's an artifact creature.` : `${head} — C'est une créature-artefact.`);
    if (parts.length) {
      lines.push(`S:Mode$ Continuous | AffectedDefined$ Self | Affected$ Card.counters_GE${stationN}_CHARGE | ${parts.join(' | ')} | Description$ ${[first, ...station.text].join(' ')}`,
        ...station.lines);
    }
    text.push(first, ...station.text);
  }
  if (chapters.size) {
    const max = Math.max(...chapters.keys());
    const ids = [];
    const pushed = new Set();
    const isDb = (l) => /^SVar:[^:]+:DB\$ /.test(l);
    for (let k = 1; k <= max; k++) {
      const list = chapters.get(k) || [];
      if (!list.length) {
        // Chapitre sans capacité : rien ne se passe.
        ids.push(`AtelierCh${k}`);
        lines.push(`SVar:AtelierCh${k}:DB$ Cleanup | SpellDescription$ —`);
      } else if (list.length === 1) {
        ids.push(list[0].id);
        if (!pushed.has(list[0].id)) {
          pushed.add(list[0].id);
          lines.push(...list[0].r.lines);
        }
      } else {
        // Plusieurs capacités sur ce chapitre : une copie de chacune pour ce chapitre, enchaînées (SubAbility$).
        const copies = list.map((c) => {
          const re = new RegExp(`\\b${c.id}(?![0-9])`, 'g');
          return {id: `${c.id}c${k}`, lines: c.r.lines.map(l => l.replace(re, `${c.id}c${k}`))};
        });
        copies.forEach((c, j) => {
          if (j < copies.length - 1) {
            const last = c.lines.map(isDb).lastIndexOf(true);
            c.lines[last] += ` | SubAbility$ ${copies[j + 1].id}`;
          }
          lines.push(...c.lines);
        });
        ids.push(copies[0].id);
      }
    }
    lines.push(`K:Chapter:${max}:${ids.join(',')}`);
    // Le texte : les chapitres qui font la même chose ensemble (« I, II — … »), plusieurs capacités à la suite.
    const groups = [];
    for (let k = 1; k <= max; k++) {
      const list = chapters.get(k) || [];
      const key = list.map(c => c.id).join(',');
      const g = groups[groups.length - 1];
      if (g && g.key === key && key) {
        g.ks.push(k);
      } else {
        groups.push({key, ks: [k], list});
      }
    }
    for (const g of groups.filter(x => x.key)) {
      const body = g.list.map(c => named(c.r.body || c.r.text.replace(/^[IVX, ]+ — /, ''), name)).join(' ');
      text.push(`${g.ks.map(k => ROMAN[k - 1]).join(', ')} — ${body}`);
    }
  }
  if (text.length) {
    lines.push(`Oracle:${text.join('\\n')}`);
  }
  if (f.token) {
    lines.push('SVar:AtelierToken:True');
  }
  // Plusieurs capacités « Effet du sort » : un seul sort qui les fait toutes, l'une après l'autre (chacune avec sa propre
  // condition), et pas plusieurs façons de lancer la carte au choix.
  const spells = lines.map((l, i) => (l.startsWith('A:SP$ ') ? i : -1)).filter(i => i >= 0);
  if (spells.length > 1) {
    const at = (name) => lines.findIndex(l => l.startsWith(`SVar:${name}:`));
    const tail = (i) => {
      let k = i;
      for (let guard = 0; guard < 60; guard++) {
        const m = /\| SubAbility\$ (\S+)/.exec(lines[k]);
        const j = m ? at(m[1]) : -1;
        if (j < 0) {
          return k;
        }
        k = j;
      }
      return k;
    };
    for (let k = 1; k < spells.length; k++) {
      const name = `AtelierSpell${k + 1}`;
      const end = tail(spells[k - 1]);
      lines[spells[k]] = `SVar:${name}:DB$ ${lines[spells[k]].slice(6).replace(/ \| Cost\$ [^|]*/, '')}`;
      lines[end] += ` | SubAbility$ ${name}`;
    }
  }
  // Surcharge recopie le sort de la carte : Forge doit lire le sort (« A:SP$ ») avant le mot-clé.
  const over = lines.findIndex(l => l.startsWith('K:Overload'));
  if (over >= 0) {
    const [k] = lines.splice(over, 1);
    const lastSp = lines.reduce((m, l, i) => (l.startsWith('A:SP$') ? i : m), -1);
    lines.splice(lastSp >= 0 ? lastSp + 1 : lines.length, 0, k);
  }
  // Un sort avec {X} dans son coût, dont un effet vaut X (« Détruisez X créatures ciblées ») : Forge lit le X payé dans la
  // variable X de la carte ; sans elle, il paie X = 0 quel que soit le X annoncé.
  if (/\bX\b/.test(forgeCost(f.cost) || '') && lines.some(l => /Count\$xPaid/.test(l)) && !lines.some(l => l.startsWith('SVar:X:'))) {
    lines.push('SVar:X:Count$xPaid');
  }
  // Plusieurs capacités « engager X » : une seule définition de X.
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i] === 'SVar:X:Count$xPaid' && lines.indexOf(lines[i]) !== i) {
      lines.splice(i, 1);
    }
  }
  // Texte d'ambiance, en italique sous les capacités (Forge ne s'en sert pas).
  if (cleanFlavor(f.flavor)) {
    lines.push(`SVar:AtelierFlavor:${cleanFlavor(f.flavor)}`);
  }
  lines.push(...displayLines(f));
  return lines.join('\n');
}
