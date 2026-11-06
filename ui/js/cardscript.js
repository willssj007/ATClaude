// Atelier : du formulaire au script de Forge. Chaque capacité du formulaire (un déclencheur ou un coût, un effet, un
// filtre de créatures, un nombre) devient une ligne T:/A:/S: et son SVar, avec son texte en français, sur le modèle des
// cartes de Forge (Flametongue Kavu, Elvish Visionary, Biomathematician...). Forge vérifie ensuite le script.

export const CARD_TYPES = [
  ['Creature', 'Créature'], ['Artifact', 'Artefact'], ['Enchantment', 'Enchantement'], ['Land', 'Terrain'],
  ['Planeswalker', 'Planeswalker'], ['Instant', 'Éphémère'], ['Sorcery', 'Rituel'],
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
  ['Toxic', 'Toxique', 'Toxic', 'number', 'n', null, 1],
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
  Enchant: [['Creature', 'créature', 'creature'], ['Creature.YouCtrl:creature you control', 'créature que vous contrôlez', 'creature you control'],
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
  {id: 'allyDies', kind: 'T', label: 'Quand une de vos créatures meurt', filter: true},
  {id: 'anyDies', kind: 'T', label: 'Quand une créature meurt (n\'importe laquelle)'},
  {id: 'oppCreatureDies', kind: 'T', label: 'Quand une créature d\'un adversaire meurt'},
  {id: 'oppCreatureEnters', kind: 'T', label: 'Quand une créature arrive sous le contrôle d\'un adversaire'},
  {id: 'landfall', kind: 'T', label: 'Quand un terrain arrive sous votre contrôle (Toucheterre)'},
  {id: 'constellation', kind: 'T', label: 'Quand un enchantement arrive sous votre contrôle (Constellation)'},
  {id: 'artifactEnters', kind: 'T', label: 'Quand un artefact arrive sous votre contrôle'},
  {id: 'counterAdded', kind: 'T', label: 'Quand des marqueurs +1/+1 sont mis sur une de vos créatures'},
  {id: 'castAny', kind: 'T', label: 'Quand vous lancez un sort'},
  {id: 'castNonCreature', kind: 'T', label: 'Quand vous lancez un sort non-créature'},
  {id: 'castCreature', kind: 'T', label: 'Quand vous lancez un sort de créature'},
  {id: 'magecraft', kind: 'T', label: 'Quand vous lancez ou copiez un éphémère ou un rituel (Sorcellerie)'},
  {id: 'secondSpell', kind: 'T', label: 'Quand vous lancez votre deuxième sort de chaque tour'},
  {id: 'oppCasts', kind: 'T', label: 'Quand un adversaire lance un sort'},
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
  {id: 'endCombat', kind: 'T', label: 'À la fin du combat de votre tour'},
  {id: 'end', kind: 'T', label: 'Au début de votre étape de fin'},
  {id: 'eachEnd', kind: 'T', label: 'Au début de chaque étape de fin'},
  {id: 'activated', kind: 'A', label: 'Capacité activée (coût : effet)', cost: true},
  {id: 'loyalty', kind: 'A', label: 'Capacité de loyauté (planeswalker)', loyalty: true},
  {id: 'spell', kind: 'SP', label: 'Effet du sort (éphémère, rituel)'},
  {id: 'chapter', kind: 'CH', label: 'Chapitre de saga (I, II, III…)'},
  {id: 'static', kind: 'S', label: 'Effet permanent (« les créatures que vous contrôlez ont… », « vous n\'avez pas de taille maximale de main »…)', filter: true},
];

/** Groupes du choix « quand » dans le formulaire. */
export const WHEN_GROUPS = [['T', 'Déclenchée (quand…)'], ['A', 'Activée'], ['SP', 'Sort'], ['CH', 'Saga'], ['S', 'Permanente']];

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
  {id: 'damageOpponents', group: 'life', label: 'Blessures à chaque adversaire', n: true},
  {id: 'damageEachCreature', group: 'life', label: 'Blessures à chaque créature', n: true},
  {id: 'damageEachOppCreature', group: 'life', label: 'Blessures à chaque créature que vos adversaires contrôlent', n: true},
  {id: 'earthquake', group: 'life', label: 'Blessures à chaque créature sans le vol et à chaque joueur', n: true},
  {id: 'gainLife', group: 'life', label: 'Gagner des points de vie', n: true},
  {id: 'loseLifeYou', group: 'life', label: 'Vous perdez des points de vie', n: true},
  {id: 'drain', group: 'life', label: 'Chaque adversaire perd des PV, vous les gagnez', n: true},
  {id: 'fog', group: 'life', label: 'Prévenir toutes les blessures de combat ce tour-ci (brouillard)'},
  {id: 'poison', group: 'life', label: 'Chaque adversaire reçoit des marqueurs poison', n: true},
  {id: 'energy', group: 'life', label: 'Vous obtenez de l\'énergie ({E})', n: true},
  {id: 'experience', group: 'life', label: 'Vous obtenez un marqueur expérience'},
  {id: 'draw', group: 'cards', label: 'Piocher des cartes', n: true},
  {id: 'drawEach', group: 'cards', label: 'Chaque joueur pioche des cartes', n: true},
  {id: 'loot', group: 'cards', label: 'Piocher puis se défausser (autant)', n: true},
  {id: 'rummage', group: 'cards', label: 'Se défausser puis piocher (autant)', n: true},
  {id: 'wheel', group: 'cards', label: 'Chaque joueur se défausse de sa main puis pioche N cartes', n: true},
  {id: 'dig', group: 'cards', label: 'Regarder les N cartes du dessus, en garder une en main', n: true},
  {id: 'digTyped', group: 'cards', label: 'Révéler les N cartes du dessus, en garder une d\'un type en main', n: true, ct: true},
  {id: 'impulse', group: 'cards', label: 'Exiler les N cartes du dessus, les jouer jusqu\'à votre prochain tour', n: true},
  {id: 'scry', group: 'cards', label: 'Regard', n: true},
  {id: 'surveil', group: 'cards', label: 'Surveiller', n: true},
  {id: 'mill', group: 'cards', label: 'Meuler (vous)', n: true},
  {id: 'millOpponents', group: 'cards', label: 'Chaque adversaire meule', n: true},
  {id: 'discard', group: 'cards', label: 'Chaque adversaire défausse des cartes', n: true},
  {id: 'thoughtseize', group: 'cards', label: 'Un joueur ciblé révèle sa main, vous choisissez une carte non-terrain qu\'il défausse'},
  {id: 'tutor', group: 'cards', label: 'Chercher une carte dans la bibliothèque (main)'},
  {id: 'tutorTyped', group: 'cards', label: 'Chercher une carte d\'un type dans la bibliothèque (main)', ct: true},
  {id: 'tutorBattlefield', group: 'cards', label: 'Chercher une carte d\'un type et la mettre sur le champ de bataille', ct: true},
  {id: 'regrowth', group: 'cards', label: 'Renvoyer une créature du cimetière en main'},
  {id: 'regrowthTyped', group: 'cards', label: 'Renvoyer une carte d\'un type du cimetière en main', ct: true},
  {id: 'reanimate', group: 'cards', label: 'Renvoyer une créature du cimetière sur le champ de bataille'},
  {id: 'shuffleGraveyard', group: 'cards', label: 'Mélanger votre cimetière dans votre bibliothèque'},
  {id: 'exileGraveyard', group: 'cards', label: 'Exiler le cimetière d\'un joueur ciblé'},
  {id: 'countersSelf', group: 'creatures', label: 'Marqueurs sur cette créature (+1/+1 ou autre)', n: true, counter: true},
  {id: 'countersEach', group: 'creatures', label: 'Marqueurs sur chaque créature choisie (chaque Elfe, chaque autre…)', n: true, filter: true, counter: true},
  {id: 'countersTarget', group: 'creatures', label: 'Marqueurs sur une créature ciblée (+1/+1, -1/-1, bouclier…)', n: true, counter: true},
  {id: 'proliferate', group: 'creatures', label: 'Proliférer'},
  {id: 'pumpSelf', group: 'creatures', label: 'Elle gagne +N/+N jusqu\'à la fin du tour', n: true, self: true},
  {id: 'pumpTarget', group: 'creatures', label: '+N/+N à une créature ciblée jusqu\'à la fin du tour', n: true},
  {id: 'shrinkTarget', group: 'creatures', label: '-N/-N à une créature ciblée jusqu\'à la fin du tour', n: true},
  {id: 'pumpAll', group: 'creatures', label: 'Les créatures choisies gagnent +N/+N jusqu\'à la fin du tour', n: true, filter: true},
  {id: 'shrinkOpp', group: 'creatures', label: 'Les créatures adverses gagnent -N/-N jusqu\'à la fin du tour', n: true},
  {id: 'grantKeywordTurn', group: 'creatures', label: 'Les créatures choisies gagnent un mot-clé jusqu\'à la fin du tour', filter: true, keyword: true},
  {id: 'keywordTarget', group: 'creatures', label: 'Une créature ciblée gagne un mot-clé jusqu\'à la fin du tour', keyword: true},
  {id: 'unblockableTarget', group: 'creatures', label: 'Une créature ciblée ne peut pas être bloquée ce tour-ci'},
  {id: 'regenerate', group: 'creatures', label: 'Régénération (la régénérer)', self: true},
  {id: 'token', group: 'creatures', label: 'Créer des jetons', n: true, token: true},
  {id: 'cloneToken', group: 'creatures', label: 'Créer un jeton copie d\'une créature ciblée'},
  {id: 'populate', group: 'creatures', label: 'Peupler (copier un jeton de créature)'},
  {id: 'monstrosity', group: 'creatures', label: 'Monstruosité N', n: true, self: true},
  {id: 'adapt', group: 'creatures', label: 'Adapter N', n: true, self: true},
  {id: 'bolster', group: 'creatures', label: 'Renforcement N', n: true},
  {id: 'support', group: 'creatures', label: 'Soutenir N', n: true},
  {id: 'bite', group: 'creatures', label: 'Votre créature ciblée inflige des blessures égales à sa force à une créature ciblée'},
  {id: 'untapAllYours', group: 'creatures', label: 'Dégager toutes les créatures que vous contrôlez'},
  {id: 'sacrificeSelf', group: 'creatures', label: 'La sacrifier', self: true},
  {id: 'destroy', group: 'removal', label: 'Détruire une créature ciblée'},
  {id: 'destroyPermanent', group: 'removal', label: 'Détruire un permanent non-terrain ciblé'},
  {id: 'destroyArtEnch', group: 'removal', label: 'Détruire un artefact ou un enchantement ciblé'},
  {id: 'destroyTyped', group: 'removal', label: 'Détruire un permanent ciblé d\'un type (artefact, terrain, planeswalker…)', pt: true},
  {id: 'wrath', group: 'removal', label: 'Détruire toutes les créatures'},
  {id: 'destroyAllTyped', group: 'removal', label: 'Détruire tous les permanents d\'un type (au choix)', pt: true},
  {id: 'edict', group: 'removal', label: 'Chaque adversaire sacrifie une créature'},
  {id: 'sacrificeEach', group: 'removal', label: 'Chaque joueur sacrifie une créature'},
  {id: 'exile', group: 'removal', label: 'Exiler une créature ciblée'},
  {id: 'exileTyped', group: 'removal', label: 'Exiler un permanent ciblé d\'un type (au choix)', pt: true},
  {id: 'exileAllTyped', group: 'removal', label: 'Exiler tous les permanents d\'un type (au choix)', pt: true},
  {id: 'bounce', group: 'removal', label: 'Renvoyer une créature ciblée dans la main'},
  {id: 'bounceTyped', group: 'removal', label: 'Renvoyer un permanent ciblé d\'un type dans la main', pt: true},
  {id: 'bounceAllTyped', group: 'removal', label: 'Renvoyer tous les permanents d\'un type dans la main', pt: true},
  {id: 'tuck', group: 'removal', label: 'Mettre un permanent ciblé au-dessous de la bibliothèque', pt: true},
  {id: 'fight', group: 'removal', label: 'Se battre contre une créature adverse ciblée', self: true},
  {id: 'counterSpell', group: 'removal', label: 'Contrecarrer un sort ciblé'},
  {id: 'counterCreature', group: 'removal', label: 'Contrecarrer un sort de créature ciblé'},
  {id: 'counterNonCreature', group: 'removal', label: 'Contrecarrer un sort non-créature ciblé'},
  {id: 'counterUnless', group: 'removal', label: 'Contrecarrer un sort ciblé à moins que son contrôleur ne paie {N}', n: true},
  {id: 'counterAbility', group: 'removal', label: 'Contrecarrer une capacité activée ou déclenchée ciblée'},
  {id: 'tap', group: 'control', label: 'Engager une créature ciblée'},
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
  {id: 'extraTurn', group: 'turns', label: 'Jouer un tour supplémentaire après celui-ci'},
  {id: 'extraCombat', group: 'turns', label: 'Une phase de combat supplémentaire après cette phase principale'},
  {id: 'copySpell', group: 'turns', label: 'Copier un sort d\'éphémère ou de rituel ciblé'},
  {id: 'emblem', group: 'turns', label: 'Obtenir un emblème (effet permanent pour toute la partie)', emblem: true},
  {id: 'winGame', group: 'turns', label: 'Gagner la partie'},
  {id: 'discover', group: 'mech', label: 'Découvrir N', n: true},
  {id: 'explore', group: 'mech', label: 'Explorer', self: true},
  {id: 'connive', group: 'mech', label: 'Comploter', self: true},
  {id: 'investigate', group: 'mech', label: 'Enquêter (jetons Indice)', n: true},
  {id: 'incubate', group: 'mech', label: 'Incuber N', n: true},
  {id: 'manifest', group: 'mech', label: 'Manifester la carte du dessus de votre bibliothèque'},
  {id: 'manifestDread', group: 'mech', label: 'Manifester l\'effroi'},
  {id: 'amass', group: 'mech', label: 'Amasser des Orques', n: true},
  {id: 'ringTempts', group: 'mech', label: 'L\'Anneau vous tente'},
  {id: 'monarch', group: 'mech', label: 'Devenir le monarque'},
  {id: 'initiative', group: 'mech', label: 'Prendre l\'initiative (donjon)'},
  {id: 'venture', group: 'mech', label: 'S\'aventurer dans le donjon'},
  {id: 'modal', group: 'modal', label: 'Choix de modes (choisissez l\'un, deux, ou un ou plusieurs —)', modal: true},
  // Effets permanents (« Permanente ») : sur des créatures choisies, sur la carte, sur vous, ou des remplacements.
  {id: 'grantKeyword', group: 'stCreature', label: 'Elles ont un mot-clé (« les autres Elfes que vous contrôlez ont la vigilance »)', scope: true, keyword: true, only: ['static']},
  {id: 'anthem', group: 'stCreature', label: 'Elles gagnent +N/+N', n: true, scope: true, only: ['static']},
  {id: 'anthemPower', group: 'stCreature', label: 'Elles gagnent +N/+0', n: true, scope: true, only: ['static']},
  {id: 'debuff', group: 'stCreature', label: 'Elles gagnent -N/-N', n: true, scope: true, only: ['static']},
  {id: 'cantBlock', group: 'stCreature', label: 'Elles ne peuvent pas bloquer', scope: true, only: ['static']},
  {id: 'cantAttack', group: 'stCreature', label: 'Elles ne peuvent pas attaquer', scope: true, only: ['static']},
  {id: 'cantAttackBlock', group: 'stCreature', label: 'Elles ne peuvent ni attaquer ni bloquer', scope: true, only: ['static']},
  {id: 'unblockable', group: 'stCreature', label: 'Elles ne peuvent pas être bloquées', scope: true, only: ['static']},
  {id: 'notBlockedByPower', group: 'stCreature', label: 'Les créatures de force N ou moins ne peuvent pas les bloquer', n: true, scope: true, only: ['static']},
  {id: 'mustAttack', group: 'stCreature', label: 'Elles attaquent à chaque combat si possible', scope: true, only: ['static']},
  {id: 'blockExtra', group: 'stCreature', label: 'Elles peuvent bloquer une créature supplémentaire', scope: true, only: ['static']},
  {id: 'noActivated', group: 'stCreature', label: 'Leurs capacités activées ne peuvent pas être activées', scope: true, only: ['static']},
  {id: 'doesntUntap', group: 'stCreature', label: 'Elles ne se dégagent pas pendant l\'étape de dégagement', scope: true, only: ['static']},
  {id: 'controlEnchanted', group: 'stCreature', label: 'Vous contrôlez la créature enchantée (aura)', only: ['static']},
  {id: 'cdaPT', group: 'stSelf', label: 'Sa force et son endurance sont égales à X (au choix)', amountSel: true, only: ['static']},
  {id: 'entersTapped', group: 'stSelf', label: 'Elle arrive sur le champ de bataille engagée', only: ['static']},
  {id: 'etbCounters', group: 'stSelf', label: 'Elle arrive avec N marqueurs (+1/+1 ou autre)', n: true, counter: true, only: ['static']},
  {id: 'uncounterable', group: 'stSelf', label: 'Ce sort ne peut pas être contrecarré', only: ['static']},
  {id: 'noMaxHand', group: 'stPlayer', label: 'Vous n\'avez pas de taille maximale de main', only: ['static']},
  {id: 'maxHandPlus', group: 'stPlayer', label: 'Votre taille maximale de main augmente de N', n: true, only: ['static']},
  {id: 'extraLand', group: 'stPlayer', label: 'Vous pouvez jouer N terrains supplémentaires à chacun de vos tours', n: true, only: ['static']},
  {id: 'reduceCost', group: 'stPlayer', label: 'Vos sorts (d\'un type) coûtent {N} de moins', n: true, spellType: true, only: ['static']},
  {id: 'raiseCostOpp', group: 'stPlayer', label: 'Les sorts (d\'un type) de vos adversaires coûtent {N} de plus', n: true, spellType: true, only: ['static']},
  {id: 'raiseCostAll', group: 'stPlayer', label: 'Les sorts (d\'un type) de tout le monde coûtent {N} de plus', n: true, spellType: true, only: ['static']},
  {id: 'flashSpells', group: 'stPlayer', label: 'Vous pouvez lancer vos sorts (d\'un type) comme s\'ils avaient le flash', spellType: true, only: ['static']},
  {id: 'playerHexproof', group: 'stPlayer', label: 'Vous avez la défense talismanique', only: ['static']},
  {id: 'cantLose', group: 'stPlayer', label: 'Vous ne pouvez pas perdre la partie (et vos adversaires ne peuvent pas la gagner)', only: ['static']},
  {id: 'oppCantGainLife', group: 'stPlayer', label: 'Vos adversaires ne peuvent pas gagner de points de vie', only: ['static']},
  {id: 'lookTop', group: 'stPlayer', label: 'Vous pouvez regarder la carte du dessus de votre bibliothèque à tout moment', only: ['static']},
  {id: 'playTop', group: 'stPlayer', label: 'Vous pouvez jouer la carte du dessus de votre bibliothèque', only: ['static']},
  {id: 'untapOthers', group: 'stPlayer', label: 'Vos permanents se dégagent aussi pendant l\'étape de dégagement des autres', only: ['static']},
  {id: 'ignoreLegend', group: 'stPlayer', label: 'La règle des légendes ne s\'applique pas à vos permanents', only: ['static']},
  {id: 'propaganda', group: 'stPlayer', label: 'Les créatures ne peuvent pas vous attaquer à moins que leur contrôleur ne paie {N} chacune', n: true, only: ['static']},
  {id: 'panharmonicon', group: 'stPlayer', label: 'Les capacités qui se déclenchent à l\'arrivée d\'une créature ou d\'un artefact se déclenchent une fois de plus', only: ['static']},
  {id: 'oppEnterTapped', group: 'stPlayer', label: 'Les créatures de vos adversaires arrivent engagées', only: ['static']},
  {id: 'doubleTokens', group: 'stRepl', label: 'Vos effets créent deux fois plus de jetons', only: ['static']},
  {id: 'doubleCounters', group: 'stRepl', label: 'Deux fois plus de marqueurs +1/+1 sur vos créatures', only: ['static']},
  {id: 'plusOneCounter', group: 'stRepl', label: 'Un marqueur +1/+1 de plus sur vos créatures', only: ['static']},
  {id: 'doubleDamage', group: 'stRepl', label: 'Vos sources infligent le double de blessures aux adversaires et à leurs permanents', only: ['static']},
  {id: 'damagePlus', group: 'stRepl', label: 'Vos sources infligent N blessures de plus aux adversaires et à leurs permanents', n: true, only: ['static']},
  {id: 'doubleLife', group: 'stRepl', label: 'Vous gagnez deux fois plus de points de vie', only: ['static']},
];

/** Groupes des effets dans le formulaire. */
export const EFFECT_GROUPS = [
  ['life', 'Blessures, points de vie, poison, énergie'], ['cards', 'Cartes (pioche, bibliothèque, cimetière)'], ['creatures', 'Créatures et marqueurs'],
  ['players', 'Cibler un joueur'], ['removal', 'Détruire, exiler, contrer'], ['control', 'Engager, contrôler'], ['mana', 'Mana et terrains'],
  ['turns', 'Tours, combats, copies, emblèmes'], ['mech', 'Mécaniques (explorer, l\'Anneau, monarque…)'], ['modal', 'Au choix'],
  ['stCreature', 'Effet permanent sur des créatures'], ['stSelf', 'Effet permanent de cette carte'], ['stPlayer', 'Effet permanent sur vous et les sorts'],
  ['stRepl', 'Remplacements (doubler les jetons, les blessures…)'],
];

/** Effets permanents écrits par un remplacement (« R: ») : leur condition ne peut pas être « votre tour ». */
export const STATIC_REPLACEMENTS = new Set(['doesntUntap', 'entersTapped', 'etbCounters', 'uncounterable', 'cantLose', 'oppEnterTapped', 'doubleTokens',
  'doubleCounters', 'plusOneCounter', 'doubleDamage', 'damagePlus', 'doubleLife']);

/** Qui un effet permanent touche : [id, libellé]. */
export const SCOPES = [
  ['you', 'Les créatures que vous contrôlez'], ['opp', 'Les créatures que vos adversaires contrôlent'], ['all', 'Toutes les créatures'],
  ['self', 'Cette carte (elle-même)'], ['enchanted', 'La créature enchantée (aura)'], ['equipped', 'La créature équipée (équipement)'],
  ['tokens', 'Les jetons de créature que vous contrôlez'], ['attacking', 'Les créatures attaquantes que vous contrôlez'],
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
];

/** Types de cartes cherchées : [id, pour Forge, « une carte de … », « a … card »]. */
export const CARD_KINDS = [
  ['card', 'Card', 'une carte', 'a card'], ['creature', 'Creature', 'une carte de créature', 'a creature card'],
  ['land', 'Land', 'une carte de terrain', 'a land card'], ['basic', 'Land.Basic', 'une carte de terrain de base', 'a basic land card'],
  ['instantSorcery', 'Instant,Sorcery', 'une carte d\'éphémère ou de rituel', 'an instant or sorcery card'],
  ['artifact', 'Artifact', 'une carte d\'artefact', 'an artifact card'], ['enchantment', 'Enchantment', 'une carte d\'enchantement', 'an enchantment card'],
  ['planeswalker', 'Planeswalker', 'une carte de planeswalker', 'a planeswalker card'], ['legendary', 'Card.Legendary', 'une carte légendaire', 'a legendary card'],
  ['equipment', 'Equipment', 'une carte d\'équipement', 'an Equipment card'], ['aura', 'Aura', 'une carte d\'aura', 'an Aura card'],
];

/** Marqueurs : [pour Forge, « un marqueur +1/+1 » (après « marqueur »), en anglais]. */
export const COUNTER_TYPES = [
  ['P1P1', '+1/+1', '+1/+1'], ['M1M1', '-1/-1', '-1/-1'], ['SHIELD', '« bouclier »', 'shield'], ['Indestructible', '« indestructible »', 'indestructible'],
  ['Flying', '« vol »', 'flying'], ['Deathtouch', '« contact mortel »', 'deathtouch'], ['Lifelink', '« lien de vie »', 'lifelink'], ['Trample', '« piétinement »', 'trample'],
  ['Vigilance', '« vigilance »', 'vigilance'], ['Menace', '« menace »', 'menace'], ['Reach', '« portée »', 'reach'], ['Hexproof', '« défense talismanique »', 'hexproof'],
  ['First Strike', '« initiative »', 'first strike'], ['CHARGE', '« charge »', 'charge'], ['STUN', '« étourdissement »', 'stun'], ['OIL', '« huile »', 'oil'],
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
  ['anthem', 'Les créatures que vous contrôlez gagnent +N/+N'], ['grantKeyword', 'Les créatures que vous contrôlez ont un mot-clé'],
  ['noMaxHand', 'Vous n\'avez pas de taille maximale de main'], ['extraLand', 'Vous pouvez jouer N terrains supplémentaires'],
  ['reduceCost', 'Vos sorts coûtent {N} de moins'], ['playerHexproof', 'Vous avez la défense talismanique'], ['oppCantGainLife', 'Vos adversaires ne peuvent pas gagner de points de vie'],
  ['flashSpells', 'Vous pouvez lancer vos sorts comme s\'ils avaient le flash'],
];

/** Combien de modes on choisit : l'un, deux (avec trois modes), un ou plusieurs. */
export const PICKS = [['one', 'Choisissez l\'un —'], ['two', 'Choisissez deux — (trois modes)'], ['oneOrMore', 'Choisissez un ou plusieurs —']];

/** Effets possibles pour un mode de « Choisissez l'un — » (pas un autre choix de modes). */
export function modeEffectsFor(when) {
  return effectsFor(when).filter(e => !e.modal);
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
  ['opponents', 'X = le nombre d\'adversaires'],
  ['power', 'X = la force de cette carte'],
  ['toughness', 'X = l\'endurance de cette carte'],
  ['counters', 'X = le nombre de marqueurs +1/+1 sur cette carte'],
  ['tapped', 'X = le nombre de permanents engagés pour le coût'],
];

/** Coût « engager X … dégagés que vous contrôlez » : ce qu'on engage. */
export const TAP_WHAT = [['token', 'jetons'], ['creature', 'créatures'], ['artifact', 'artefacts'], ['type', 'créatures d\'un type']];

/** Ce qu'engage le coût : [type pour Forge, pluriel, singulier, accord (« dégagés »/« dégagées »), en anglais]. */
function tapWhat(a) {
  const t = typeName(a.tapXType);
  switch (a.tapXWhat) {
    case 'creature': return ['Creature', 'créatures', 'créature', 'es', 'creatures'];
    case 'artifact': return ['Artifact', 'artefacts', 'artefact', 's', 'artifacts'];
    case 'type': return t ? [`Creature.${t}`, `créatures de type ${frType(a.tapXType)}`, `créature de type ${frType(a.tapXType)}`, 'es', `${t} creatures`] : ['Creature', 'créatures', 'créature', 'es', 'creatures'];
    default: return ['Card.token', 'jetons', 'jeton', 's', 'tokens'];
  }
}

/** Conditions d'une capacité : elle n'agit que si… (pour un effet permanent : tant que…). */
export const CONDITIONS = [
  ['none', 'Toujours'],
  ['control', 'Si vous contrôlez au moins N créatures (d\'un type, au choix)'],
  ['lifeAtLeast', 'Si vous avez au moins N points de vie'],
  ['lifeAtMost', 'Si vous avez N points de vie ou moins'],
  ['handAtLeast', 'Si vous avez au moins N cartes en main'],
  ['graveyardAtLeast', 'S\'il y a au moins N cartes de créature dans votre cimetière'],
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
  ['spells2', 'Si vous avez lancé au moins deux sorts ce tour-ci'],
  ['tappedAtLeast', 'Si vous en avez engagé au moins N (coût « engager X »)'],
];

/** Conditions qui demandent un nombre N. */
export const CONDITIONS_N = ['control', 'lifeAtLeast', 'lifeAtMost', 'handAtLeast', 'graveyardAtLeast', 'tappedAtLeast'];

/** Types de créature, en français et en anglais (posés par l'Atelier d'après la liste du pont). */
const typesByName = new Map();
const typeFr = new Map();
const plainType = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** La liste des types : [{en: 'God', fr: 'Dieu'}, …]. */
export function setTypeNames(list) {
  typesByName.clear();
  typeFr.clear();
  for (const t of list || []) {
    typesByName.set(plainType(t.en), t.en);
    if (t.fr && t.fr !== t.en) {
      typesByName.set(plainType(t.fr), t.en);
      typeFr.set(t.en, t.fr);
    }
  }
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
    case 'opponents': return ['PlayerCountOpponents$Amount', 'le nombre d\'adversaires que vous avez', 'the number of opponents you have'];
    case 'power': return ['Count$CardPower', 'la force de CARDNAME', 'CARDNAME\'s power'];
    case 'toughness': return ['Count$CardToughness', 'l\'endurance de CARDNAME', 'CARDNAME\'s toughness'];
    case 'counters': return ['Count$CardCounters.P1P1', 'le nombre de marqueurs +1/+1 sur CARDNAME', 'the number of +1/+1 counters on CARDNAME'];
    case 'tapped': {
      const w = tapWhat(a);
      return ['Count$xPaid', `le nombre de ${w[1]} engagé${w[3]} ainsi`, `the number of ${w[4]} tapped this way`];
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
    case 'spells2': return c('Count$ThisTurnCast_Card.YouCtrl', 'GE2', 'si vous avez lancé au moins deux sorts ce tour-ci', 'if you\'ve cast two or more spells this turn');
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
  const toForge = (l) => (x ? l.replace(/\b7777\b/g, xName) : l);
  const toText = (l) => (x ? l.replace(/\b7777\b/g, 'X') : l);
  const suffix = x && x[1] ? (en ? `, where X is ${x[2]}` : `, X étant ${x[1]}`) : '';
  const items = [{head: toForge(main.p), extra: (main.extra || []).map(toForge), aux: (main.aux || []).map(toForge), text: toText(en ? main.en : main.fr) + suffix}];
  (a.then || []).slice(0, 2).forEach((m, k) => {
    const name = `${id}T${k + 1}`;
    const e = effect({...newMode(), ...m}, name);
    if (e) {
      // Un effet enchaîné peut avoir sa propre condition (paliers : « puis, si au moins trois ont été engagés, … »).
      const own = conditionOf({...m, tapXWhat: a.tapXWhat, tapXType: a.tapXType});
      items.push({name, head: e.p, extra: e.extra || [], aux: e.aux || [], text: en ? e.en : e.fr, own});
    }
  });
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
  for (let k = 0; k < items.length - 1; k++) {
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
  for (const it of items.slice(1)) {
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
  return COUNTER_TYPES.find(c => c[0] === a.counter) || COUNTER_TYPES[0];
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
function effect(a, id) {
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
        fr: `un joueur ciblé se défausse de ${n1 === 1 ? 'une carte' : word(n1, 'fr') + ' cartes'}`, en: `target player discards ${n1 === 1 ? 'a card' : word(n1, 'en') + ' cards'}`};
    case 'targetMill':
      return {p: `Mill | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | NumCards$ ${n1}`,
        fr: `un joueur ciblé meule ${n1 === 1 ? 'une carte' : word(n1, 'fr') + ' cartes'}`, en: `target player mills ${n1 === 1 ? 'a card' : word(n1, 'en') + ' cards'}`};
    case 'targetSacrifice':
      return {p: `Sacrifice | ${target({v: 'Player', prompt: 'Choisissez un joueur ciblé'})} | SacValid$ Creature`,
        fr: 'un joueur ciblé sacrifie une créature', en: 'target player sacrifices a creature'};
    case 'discover':
      return {p: `Discover | Num$ ${n1}`, fr: `découvrez ${n1}`, en: `discover ${n1}`};
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
      return {p: 'PutCounter | Defined$ You | CounterType$ EXPERIENCE | CounterNum$ 1', fr: 'vous gagnez un marqueur « expérience »',
        en: 'you get an experience counter'};
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
function scopeOf(a) {
  const s = SCOPES.some(x => x[0] === a.scope) ? a.scope : 'you';
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
  return /[.»"]$/.test(t) ? t : t + '.';
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
  const sc = scopeOf(a);
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
    case 'controlEnchanted':
      return {s: 'Mode$ Continuous | AffectedDefined$ Enchanted | GainControl$ You', text: en ? 'You control enchanted creature' : 'Vous contrôlez la créature enchantée'};
    case 'cdaPT': {
      const x = amountOf({...a, amount: a.amount && a.amount !== 'fixed' && a.amount !== 'tapped' && a.amount !== 'xPaid' ? a.amount : 'creatures'});
      return {s: `Mode$ Continuous | CharacteristicDefining$ True | SetPower$ ${id}X | SetToughness$ ${id}X`, svars: [`SVar:${id}X:${x[0]}`],
        text: en ? `CARDNAME's power and toughness are each equal to ${x[2]}` : `La force et l'endurance de CARDNAME sont chacune égales ${aWord(x[1])}`};
    }
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
  text = (words.length ? words.join(' — ') + ' — ' : '') + text + '.';
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
  ['discard', 'Discard<1/Card>', 'défaussez-vous d\'une carte', 'discard a card'], ['payLife', 'PayLife<N>', 'payez N points de vie', 'pay N life'],
  ['exileGY', 'ExileFromGrave<1/Card>', 'exilez une carte de votre cimetière', 'exile a card from your graveyard'],
  ['tapCreature', 'tapXType<1/Creature>', 'engagez une créature dégagée que vous contrôlez', 'tap an untapped creature you control'],
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
    forge.push(`SubCounter<${ctr}/P1P1>`);
    text.push(en ? `remove ${ctr === 1 ? 'a +1/+1 counter' : word(ctr, 'en') + ' +1/+1 counters'} from CARDNAME`
      : `retirez ${ctr === 1 ? 'un marqueur' : word(ctr, 'fr') + ' marqueurs'} +1/+1 de CARDNAME`);
  }
  const energy = Math.max(0, Math.round(Number(a.payEnergy) || 0));
  if (energy) {
    forge.push(`PayEnergy<${energy}>`);
    text.push(en ? `pay ${'{E}'.repeat(Math.min(energy, 10))}` : `payez ${'{E}'.repeat(Math.min(energy, 10))}`);
  }
  if (a.tapX) {
    // « Engagez X jetons dégagés que vous contrôlez » : le joueur choisit X en payant (le nombre engagé est lu ensuite).
    const w = tapWhat(a);
    forge.push(`tapXType<X/${w[0]}/${w[4]}>`);
    text.push(en ? `tap X untapped ${w[4]} you control` : `engagez X ${w[1]} dégagé${w[3]} que vous contrôlez`);
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
  const forge = c[1].replace('N', life);
  const words = (lang === 'en' ? c[3] : c[2]).replace('N', life).replace('points de vie', `${plural(life, 'point', 'points')} de vie`);
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
    const k = Math.max(1, Math.min(6, Math.round(Number(a.chapter) || 1)));
    const text = withWord(e.aw, endDot(capitalize(body)));
    return {chapter: k, lines: [`SVar:${id}:DB$ ${e.p} | SpellDescription$ ${text}`, ...extra], text: `${ROMAN[k - 1]} — ${text}`};
  }
  if (w.kind === 'SP') {
    const c = spellCost(a, lang, card);
    const text = c.text + withWord(e.aw, endDot(capitalize(body)));
    return {lines: [`A:SP$ ${e.p}${c.forge} | SpellDescription$ ${withWord(e.aw, endDot(capitalize(body)))}`, ...extra], text};
  }
  if (w.kind === 'A') {
    if (a.when === 'loyalty') {
      const k = Math.round(Number(a.loyalty) || 0);
      const cost = k >= 0 ? `AddCounter<${k}/LOYALTY>` : `SubCounter<${-k}/LOYALTY>`;
      // Le coût est écrit par CostDesc$ (dans la langue de la carte) : Forge ne le répète pas en anglais devant l'effet.
      const head = en ? `${k > 0 ? '+' : k < 0 ? '−' : ''}${Math.abs(k)}:` : `[${k > 0 ? '+' : ''}${k}] :`;
      const text = `${head} ${endDot(withWord(e.aw, capitalize(body)))}`;
      return {lines: [`A:AB$ ${e.p} | Cost$ ${cost} | Planeswalker$ True | CostDesc$ ${head} | SpellDescription$ ${endDot(withWord(e.aw, capitalize(body)))}`, ...extra], text};
    }
    const c = activationCost(a, lang);
    const lim = activationLimits(a, lang);
    const head = en ? `${c.text}:` : `${c.text} :`;
    const desc = `${endDot(capitalize(body))}${lim.text}`;
    const text = withWord(e.aw, `${head} ${desc}`);
    return {lines: [`A:AB$ ${e.p} | Cost$ ${c.forge}${lim.forge} | CostDesc$ ${withWord(e.aw, head)} | SpellDescription$ ${desc}`, ...extra, ...(a.tapX ? ['SVar:X:Count$xPaid'] : [])], text};
  }
  const head = triggerHead(a);
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
function triggerHead(a) {
  const h = triggerTable(a);
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
function triggerTable(a) {
  const f = a.filter;
  const enters = (v) => `Mode$ ChangesZone | Origin$ Any | Destination$ Battlefield | ValidCard$ ${v} | TriggerZones$ Battlefield`;
  const dies = (v) => `Mode$ ChangesZone | Origin$ Battlefield | Destination$ Graveyard | ValidCard$ ${v} | TriggerZones$ Battlefield`;
  const phase = (p, who) => `Mode$ Phase | Phase$ ${p}${who ? ` | ValidPlayer$ ${who}` : ''} | TriggerZones$ Battlefield`;
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
    castAny: ['Mode$ SpellCast | ValidCard$ Card | ValidActivatingPlayer$ You | TriggerZones$ Battlefield', 'À chaque fois que vous lancez un sort', 'Whenever you cast a spell'],
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
    const e = effect({...newMode(), ...m}, mid);
    if (e) {
      parts.push({mid, e, text: capitalize(en ? e.en : e.fr) + '.'});
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
    const k = Math.max(1, Math.min(6, Math.round(Number(a.chapter) || 1)));
    return {chapter: k, lines: [`SVar:${id}:DB$ ${charm}`, ...modes], text: `${ROMAN[k - 1]} — ${capitalize(choose)}${bullets}`};
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
    return {lines: [`A:AB$ ${charm} | Cost$ ${c.forge}${lim.forge} | CostDesc$ ${c.text}${en ? ':' : ' :'}`, ...modes, ...(a.tapX ? ['SVar:X:Count$xPaid'] : [])],
      text: `${c.text}${en ? ':' : ' :'} ${capitalize(choose)}${bullets}${lim.text}`};
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
  const subs = String(f.subtypes || '').toLowerCase();
  return types.includes('Creature') || (f.keywords || []).includes('Crew') || /\b(vehicle|véhicule|spacecraft)\b/.test(subs);
}

/** L'IA d'une aura : la mettre sur ses créatures (Pump), sur celles de l'adversaire (Curse) ou en prendre le contrôle. */
function auraLogic(f) {
  const enchant = keywordValue(f, 'Enchant') || '';
  const statics = (f.abilities || []).filter(a => a.when === 'static' && (a.scope === 'enchanted' || a.effect === 'controlEnchanted'));
  if (statics.some(a => a.effect === 'controlEnchanted')) {
    return 'GainControl';
  }
  if (/OppCtrl/.test(enchant) || statics.some(a => ['cantAttack', 'cantBlock', 'cantAttackBlock', 'debuff', 'noActivated', 'doesntUntap'].includes(a.effect))) {
    return 'Curse';
  }
  return 'Pump';
}

/** Le nom de la carte dans son texte : « de Ilona » devient « d'Ilona », « que Ilona » « qu'Ilona ». */
function named(text, name) {
  const vowel = /^[aeiouyhàâéèêîôûAEIOUYHÀÂÉÈÊÎÔÛ]/.test(name);
  return String(text).replace(/\b(de|que) CARDNAME/g, (m, w) => (vowel ? `${w[0]}'${name}` : `${w} ${name}`)).replace(/CARDNAME/g, name);
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
    const key = JSON.stringify([a.scope || 'you', f.type || '', !!f.other, a.cond || 'none', a.condN ?? 3, a.condType || '', !!a.eminence]);
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
  const sub = forgeSubtypes(f.subtypes);
  for (const t of autoSubtypes(f)) {
    if (!sub.includes(t)) {
      sub.push(t);
    }
  }
  lines.push(`Types:${[f.legendary ? 'Legendary' : '', ...types, ...sub].filter(Boolean).join(' ')}`);
  const cda = (f.abilities || []).some(a => a.when === 'static' && a.effect === 'cdaPT');
  if (needsPT(f) || types.includes('Creature')) {
    lines.push(cda ? 'PT:*/*' : `PT:${Number(f.power) || 0}/${Number(f.toughness) || 0}`);
  }
  if (types.includes('Planeswalker')) {
    lines.push(`Loyalty:${Math.max(1, Number(f.loyaltyStart) || 3)}`);
  }
  const text = [];
  const kws = (f.keywords || []).filter(k => KW_FR[k]);
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
  }
  // Chapitres de saga : un par numéro (le premier compte), dans l'ordre ; « K:Chapter » les nomme tous.
  const chapters = new Map();
  mergeStatics(f.abilities || []).forEach(([a, i]) => {
    const r = abilityLines(a, i, lang, f);
    if (!r) {
      return;
    }
    if (r.chapter) {
      if (!chapters.has(r.chapter)) {
        chapters.set(r.chapter, {id: `Atelier${i + 1}`, r});
      }
      return;
    }
    lines.push(...r.lines);
    text.push(named(r.text, name));
  });
  // Comme sur les cartes imprimées : « Équipement {1} », « Pilotage 2 »… en dernier, après les capacités.
  for (const k of kws.filter(k => TRAILING_KEYWORDS.has(k))) {
    const t = keywordText(f, k, lang);
    if (t) {
      text.push(t);
    }
  }
  if (chapters.size) {
    const max = Math.max(...chapters.keys());
    const ids = [];
    for (let k = 1; k <= max; k++) {
      const c = chapters.get(k);
      if (c) {
        ids.push(c.id);
        lines.push(...c.r.lines);
        text.push(named(c.r.text, name));
      } else {
        // Chapitre sans capacité : rien ne se passe.
        ids.push(`AtelierCh${k}`);
        lines.push(`SVar:AtelierCh${k}:DB$ Cleanup | SpellDescription$ —`);
      }
    }
    lines.push(`K:Chapter:${max}:${ids.join(',')}`);
  }
  if (text.length) {
    lines.push(`Oracle:${text.join('\\n')}`);
  }
  if (f.token) {
    lines.push('SVar:AtelierToken:True');
  }
  // Plusieurs capacités « engager X » : une seule définition de X.
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i] === 'SVar:X:Count$xPaid' && lines.indexOf(lines[i]) !== i) {
      lines.splice(i, 1);
    }
  }
  lines.push(...displayLines(f));
  return lines.join('\n');
}
