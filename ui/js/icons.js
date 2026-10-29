// Icônes de l'interface, dessinées au trait (style gravure médiévale) : elles prennent la couleur du texte.
// icon('hand') renvoie le SVG en texte, à insérer dans un gabarit HTML.

const PATHS = {
  // Main : gantelet.
  hand: '<path d="M7.2 18.6c-1.1-1.1-3.3-3.9-3.9-4.8-.7-1 .5-2.3 1.6-1.6L8 14.2V5.4a1.4 1.4 0 0 1 2.8 0V11V4a1.4 1.4 0 0 1 2.8 0v7-6a1.4 1.4 0 0 1 2.8 0v6.2-3.6a1.4 1.4 0 0 1 2.8 0v6.6c0 2.7-1.4 4.4-3 5.4"/><path d="M6.3 18.4h10.6v3.1H6.3z"/><path d="M8.2 9.6h2.6M13.6 9.6h2.8"/>',
  // Recherche : loupe.
  search: '<circle cx="10.4" cy="10.4" r="6.4"/><path d="m15.2 15.2 5.4 5.4"/><path d="M7.4 8.8a3.6 3.6 0 0 1 2.8-2.4" opacity=".55"/>',
  // Bibliothèque : grimoire fermé à fermoir.
  library: '<path d="M5 4.6A1.6 1.6 0 0 1 6.6 3H19v15.2H6.6A1.6 1.6 0 0 0 5 19.8z"/><path d="M5 19.8A1.6 1.6 0 0 0 6.6 21.4H19v-3.2"/><path d="M8.4 3v15.2"/><path d="M11.4 7.4h4.6M11.4 10.4h3.2"/><path d="M19 11h1.6v3.4H19"/>',
  // Cimetière : pierre tombale.
  graveyard: '<path d="M6 21V10.2a6 6 0 0 1 12 0V21"/><path d="M3.6 21.2h16.8"/><path d="M12 7.6v6.8M9.4 10.2h5.2"/><path d="M8.4 17.8h7.2" opacity=".55"/>',
  // Exil : tourbillon du néant.
  exile: '<path d="M12.2 12.4c.1-1 1.4-1.3 2-.4.8 1.3-.6 2.9-2.2 2.7-2.3-.3-3.1-3-1.9-4.8 1.7-2.4 5.3-2.1 6.7.4 1.9 3.2-.5 7.1-4.1 7.4-4.3.3-7.4-3.7-6.6-7.8.9-4.6 6.2-7 10.4-5"/>',
  // Zone de commandement, monarque : couronne.
  crown: '<path d="M3.6 17.6 2.8 7.8l5.1 4.1L12 4.6l4.1 7.3 5.1-4.1-.8 9.8z"/><path d="M3.6 20.6h16.8"/><circle class="f" cx="12" cy="4.2" r="1.1"/><circle class="f" cx="2.8" cy="7.4" r="1"/><circle class="f" cx="21.2" cy="7.4" r="1"/>',
  // Poison : fiole.
  poison: '<path d="M9.6 3h4.8M10.4 3v4.6L6.5 13.7A5 5 0 0 0 10.8 21h2.4a5 5 0 0 0 4.3-7.3l-3.9-6.1V3"/><path d="M7.4 14.2h9.2"/><circle class="f" cx="10.8" cy="17.4" r=".9"/><circle class="f" cx="13.6" cy="16" r=".65"/>',
  // Crâne : joueur éliminé, menace.
  skull: '<path d="M12 3a7 7 0 0 0-7 7c0 2.4 1.2 4.2 3 5.3V19h8v-3.7c1.8-1.1 3-2.9 3-5.3a7 7 0 0 0-7-7z"/><circle class="f" cx="9.2" cy="10.6" r="1.6"/><circle class="f" cx="14.8" cy="10.6" r="1.6"/><path d="M10.6 19v2.2M13.4 19v2.2M11.3 14.2l.7-1.2.7 1.2"/>',
  // Énergie : éclair runique dans un cercle.
  energy: '<circle cx="12" cy="12" r="9"/><path d="M13.2 5.4 8.6 13.1h3.6l-1.1 5.5 4.6-7.6h-3.6z"/>',
  // Expérience : étoile.
  experience: '<path d="m12 2.8 2.3 6.3 6.7.3-5.3 4.1 1.9 6.5L12 16.2l-5.6 3.8 1.9-6.5L3 9.4l6.7-.3z"/>',
  // Radiation : sceau à trois lobes.
  rad: '<circle cx="12" cy="12" r="9.2"/><circle class="f" cx="12" cy="12" r="1.5"/><path class="f" d="M12 9.6 9.3 4.9a8 8 0 0 1 5.4 0z"/><path class="f" d="M12 9.6 9.3 4.9a8 8 0 0 1 5.4 0z" transform="rotate(120 12 12)"/><path class="f" d="M12 9.6 9.3 4.9a8 8 0 0 1 5.4 0z" transform="rotate(240 12 12)"/>',
  // Tickets : billet dentelé.
  ticket: '<path d="M3.5 7h17v3.2a1.9 1.9 0 0 0 0 3.6V17h-17v-3.2a1.9 1.9 0 0 0 0-3.6z"/><path d="M9 7.4v9.2" stroke-dasharray="1.4 1.6"/>',
  // Marqueur quelconque : jeton.
  token: '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="5"/>',
  // Blessures de commandant : épées croisées.
  swords: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6M16 16l4 4M19 21l2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4M7 17l-3 3M3 19l2 2"/>',
  // Taxe de commandant : bourse.
  purse: '<path d="M9 4.4h6l-1.6 3.2h-2.8z"/><path d="M10.6 7.6C6.2 9.2 4 12.6 4 15.8A5.2 5.2 0 0 0 9.2 21h5.6a5.2 5.2 0 0 0 5.2-5.2c0-3.2-2.2-6.6-6.6-8.2"/><path d="M9.6 7.6h4.8"/><circle class="f" cx="12" cy="15.2" r="1.3"/>',
  // Triche : baguette magique.
  wand: '<path d="m4 20 11-11"/><path d="m13.6 7.6 2.8 2.8"/><path d="M17.6 2.8v3.4M15.9 4.5h3.4M20.6 8.8v2.4M19.4 10h2.4M10.6 3.4v2.2M9.5 4.5h2.2"/>',
  // Journal : parchemin.
  scroll: '<path d="M8 3.2h10.2a2 2 0 0 1 2 2v1.4h-4"/><path d="M16.2 4.9V17a3 3 0 0 1-3 3H6.6"/><path d="M8 3.2a2 2 0 0 0-2 2V16"/><path d="M3.8 16.2h9.4V17a3 3 0 0 0 3 3"/><path d="M9.2 7.8h4.4M9.2 10.6h4.4M9.2 13.4h2.8"/>',
  // Menu.
  menu: '<path d="M5.5 6.5h13M5.5 12h13M5.5 17.5h13"/><path class="f" d="m3.2 6.5 1-1 1 1-1 1zM3.2 12l1-1 1 1-1 1zM3.2 17.5l1-1 1 1-1 1z"/>',
  // Contrôle d'un adversaire : marionnette.
  puppet: '<path d="M4.5 4h15M12 4v4.4M7 4v7.4M17 4v7.4"/><circle cx="12" cy="10.6" r="2.2"/><path d="M12 12.8v5.2M9 21.2l3-3.2 3 3.2M7.2 11.4l4.8 3.2 4.8-3.2"/>',
  // Défaire.
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  // Trophées : calice.
  chalice: '<path d="M7 3h10v5a5 5 0 0 1-10 0z"/><path d="M7 5H4.6a2.6 2.6 0 0 0 2.9 4.1M17 5h2.4a2.6 2.6 0 0 1-2.9 4.1"/><path d="M12 13v3.6M8.2 21h7.6M9.6 16.6h4.8l.6 4.4H9z"/>',
  // Partie sauvegardée : sablier.
  hourglass: '<path d="M6 3h12M6 21h12"/><path d="M7.2 3v2.6c0 2.2 4.8 4.2 4.8 6.4s-4.8 4.2-4.8 6.4V21M16.8 3v2.6c0 2.2-4.8 4.2-4.8 6.4s4.8 4.2 4.8 6.4V21"/><path class="f" d="M9.4 19.6c.6-1.5 1.7-2.3 2.6-2.8.9.5 2 1.3 2.6 2.8z"/>',
  // Accueil : château.
  castle: '<path d="M4 21V10.4h2.2V7.6h2.1v2.8h1.8V4.2h3.8v6.2h1.8V7.6h2.1v2.8H20V21z"/><path d="M10.2 21v-3.8a1.8 1.8 0 0 1 3.6 0V21"/><path d="M12 4.2V2.4l2.4.8L12 4"/>',
  // Jouer : épées croisées (voir swords) ; Decks : cartes.
  cards: '<rect x="8.4" y="3" width="10.6" height="14.6" rx="1.6" transform="rotate(9 13.7 10.3)"/><rect x="4.4" y="5.6" width="10.6" height="14.6" rx="1.6" transform="rotate(-7 9.7 12.9)"/>',
  // Cartes (navigateur) : livre ouvert.
  book: '<path d="M12 6.6C10 5 7 4.4 3 5v13.2c4-.6 7 0 9 1.6 2-1.6 5-2.2 9-1.6V5c-4-.6-7 0-9 1.6z"/><path d="M12 6.6v13.2"/>',
  // Statistiques : bannière.
  banner: '<path d="M6 21V3"/><path d="M6 4h12l-2.6 3.6L18 11.2H6"/><circle class="f" cx="6" cy="2.6" r="1"/>',
  // Réglages : roue dentée.
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M5.4 18.6l1.8-1.8M16.8 7.2l1.8-1.8"/><circle cx="12" cy="12" r="6.6"/>',
  // Deck aléatoire : dé.
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.2"/><circle class="f" cx="8.4" cy="8.4" r="1.3"/><circle class="f" cx="15.6" cy="8.4" r="1.3"/><circle class="f" cx="12" cy="12" r="1.3"/><circle class="f" cx="8.4" cy="15.6" r="1.3"/><circle class="f" cx="15.6" cy="15.6" r="1.3"/>',
  // Verrou (apparence à débloquer).
  lock: '<rect x="5" y="10.6" width="14" height="10.4" rx="2"/><path d="M8 10.6V7.4a4 4 0 0 1 8 0v3.2"/><path d="M12 14.6v2.6"/>',
  // Voir le plateau.
  eye: '<path d="M2.5 12S6 5.6 12 5.6 21.5 12 21.5 12 18 18.4 12 18.4 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  // Initiative, donjon : torche.
  torch: '<path d="M10.2 21.2 9 11.6h6l-1.2 9.6z"/><path d="M8.4 11.6h7.2"/><path d="M12 2.8c2.2 2 3.2 3.6 3.2 5.2a3.2 3.2 0 0 1-6.4 0c0-1.1.5-2 1.4-3 .1 1 .5 1.6 1.1 1.6 0-1.5.1-2.6.7-3.8z"/>',
  // Bénédiction de la cité : soleil.
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M5.4 18.6l1.8-1.8M16.8 7.2l1.8-1.8"/>',
  // L'Anneau : anneau à gemme.
  ring: '<circle cx="12" cy="14.2" r="6.2"/><path d="M9.2 6.4 12 3.4l2.8 3-2.8 2z"/>',
  // Protection, mots-clés de joueur : bouclier.
  shield: '<path d="M12 3 4.6 5.8v5.4c0 4.6 3.1 8.4 7.4 9.8 4.3-1.4 7.4-5.2 7.4-9.8V5.8z"/><path d="M12 3v18" opacity=".55"/>',
  // Photo de profil : portrait encadré.
  portrait: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="3.2"/><path d="M7 18.8c.8-2.8 2.8-4.2 5-4.2s4.2 1.4 5 4.2"/>',
  // Apparence : palette.
  palette: '<path d="M12 3a9 9 0 0 0 0 18c1.2 0 1.9-1 1.4-2-.6-1.3.3-2.3 1.6-2.3H17a4 4 0 0 0 4-4C21 7.4 17 3 12 3z"/><circle class="f" cx="7.6" cy="11" r="1.3"/><circle class="f" cx="10" cy="7" r="1.3"/><circle class="f" cx="14.6" cy="7" r="1.3"/>',
  // Illustration d'une carte : pinceau.
  brush: '<path d="M20.5 3.5c-3.6 1.8-8 6-10.2 9.4l1.8 1.8c3.4-2.2 7.6-6.6 9.4-10.2-.3-.4-.6-.7-1-1z"/><path d="M9.6 13.6c-2.2.2-3.6 1.6-3.8 3.6-.1 1.2-.8 2.2-2.3 2.8 2.6 1 5.6.6 7.1-.9 1-1 1.2-2.4.8-3.6"/>',
  // Points de vie : cœur.
  heart: '<path d="M12 20.5s-7.6-4.6-8.9-9.6C2.2 7.4 4.4 4.6 7.4 4.6c2 0 3.6 1.2 4.6 2.8 1-1.6 2.6-2.8 4.6-2.8 3 0 5.2 2.8 4.3 6.3-1.3 5-8.9 9.6-8.9 9.6z"/>',
  // Terrain : montagnes.
  mountain: '<path d="M2.5 19.5 9 8l3.6 6.2L15 10.4l6.5 9.1z"/><path d="M7.4 10.8 9 12.3l1.6-1.5" opacity=".7"/>',
  // Mana : gemme taillée.
  gem: '<path d="M6.2 4.5h11.6l3.7 5L12 20.5 2.5 9.5z"/><path d="M2.5 9.5h19M9 4.5l-2 5 5 11 5-11-2-5" opacity=".7"/>',
  // Filtres de recherche : entonnoir.
  filter: '<path d="M3.6 4.6h16.8l-6.4 7.6v5.6l-4 2v-7.6z"/>',
  // Bibliothèque à défiler, divers : flèches.
  chevronLeft: '<path d="m15 5-7 7 7 7"/>',
  chevronRight: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  // Mode Planeswalker : mana (la monnaie), booster, étincelle ; mode Sandbox : coffre.
  mana: '<path d="M12 2.6c3.2 4.4 6.2 7.9 6.2 11.4a6.2 6.2 0 0 1-12.4 0c0-3.5 3-7 6.2-11.4z"/><path d="M9.3 14.4a2.9 2.9 0 0 0 2.7 3" opacity=".7"/>',
  booster: '<path d="M6.2 2.8h11.6l-.7 1.6.7 1.6v12l-.7 1.6.7 1.6H6.2l.7-1.6-.7-1.6V6l.7-1.6z"/><path d="M6.2 6h11.6M6.2 18H17.8" opacity=".55"/><path d="m12 8.6 1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 14.6l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z"/>',
  spark: '<path d="M12 2.5v19M5.5 6.6 8.7 18.2M18.5 6.6l-3.2 11.6"/><path d="M3.4 11.4 7 16.6M20.6 11.4 17 16.6"/><path d="M6 20.2c1.8.9 3.8 1.3 6 1.3s4.2-.4 6-1.3"/>',
  chest: '<path d="M3.6 10.2h16.8v9.4H3.6z"/><path d="M3.6 10.2A3.6 3.6 0 0 1 7.2 6.6h9.6a3.6 3.6 0 0 1 3.6 3.6"/><path d="M10.4 10.2v3.4h3.2v-3.4"/><path d="M7.6 6.6v13M16.4 6.6v13" opacity=".5"/>',
  // États des cartes en jeu (petites pastilles) : mal d'invocation, capacités.
  sleep: '<path d="M4 6.5h6l-6 7h6"/><path d="M13 11h4.5L13 16.5h4.5"/><path d="M17.5 3.5h3l-3 3.6h3" opacity=".75"/>',
  wing: '<path d="M3 18.5c3.6-.4 6.8-2 9.4-4.7C15.6 10.5 18 6.6 21 3.5c-.3 4.6-1.8 8.5-4.6 11.3-3.3 3.3-8 4.2-13.4 3.7z"/><path d="M7.6 17.2c1.3-1.9 2.6-3.3 4-4.4M11.5 15.4c1.4-2 2.8-3.6 4.4-4.9M15.2 12.4c1.1-1.6 2.2-2.9 3.5-4" opacity=".7"/>',
  sword: '<path d="M19.5 3.5 9.8 13.2M19.5 3.5l-.4 3.6M19.5 3.5l-3.6.4"/><path d="m7.2 11.4 5.4 5.4M8.4 15.6l-4.4 4.4M5.2 17.4l1.4 1.4"/>',
  sword2: '<path d="M14.5 2.5 6.6 10.4M14.5 2.5l-.3 3M14.5 2.5l-3 .3M4.8 8.6l4.4 4.4M5.6 12l-3.1 3.1"/><path d="M21.5 9.5l-7.9 7.9M21.5 9.5l-.3 3M21.5 9.5l-3 .3M11.8 15.6l4.4 4.4M12.6 19l-3.1 3.1"/>',
  bolt: '<path d="M13.6 2.5 5.6 13.4h5.6L9.8 21.5l8.6-11.4h-5.6z"/>',
  hoof: '<path d="M4.5 19.5c0-6.6 3.4-14 7.5-14s7.5 7.4 7.5 14h-5.2l-.4-4.2h-3.8l-.4 4.2z"/><path d="M9 11.6c1.8-.8 4.2-.8 6 0" opacity=".6"/>',
  gem2: '<path d="M7 3.5h10l4 5.2-9 11.8-9-11.8z"/><path d="M3 8.7h18M9.6 3.5 8 8.7l4 11.8 4-11.8-1.6-5.2" opacity=".6"/>',
  horns: '<path d="M7.4 12.6a4.6 4.6 0 1 0 9.2 0 4.6 4.6 0 1 0-9.2 0z"/><path d="M8 9.8C5.6 8.6 4 6.2 3.8 3.4c2.2 1 4 2.4 5.6 4.4M16 9.8c2.4-1.2 4-3.6 4.2-6.4-2.2 1-4 2.4-5.6 4.4"/><circle class="f" cx="10.4" cy="12.4" r=".9"/><circle class="f" cx="13.6" cy="12.4" r=".9"/>',
  net: '<path d="M12 3c-4 3-6 6.2-6 9.6 0 4 2.7 7.1 6 8.4 3.3-1.3 6-4.4 6-8.4C18 9.2 16 6 12 3z"/><path d="M12 3v18M6.3 10.4h11.4M6.8 15h10.4" opacity=".6"/>',
  wall: '<path d="M3.5 20.5V8.5h3V6h3v2.5h5V6h3v2.5h3v12z"/><path d="M3.5 13h17M8.5 13v7.5M15.5 13v7.5M12 8.5V13" opacity=".6"/>',
  ward: '<circle cx="12" cy="12" r="8.6"/><path d="M12 6.4 16.6 9v6L12 17.6 7.4 15V9z"/>',
  ghost: '<path d="M5.6 20.5V11a6.4 6.4 0 0 1 12.8 0v9.5l-2.1-1.6-2.1 1.6-2.2-1.6-2.1 1.6-2.2-1.6z"/><circle class="f" cx="9.8" cy="11" r="1.1"/><circle class="f" cx="14.2" cy="11" r="1.1"/>',
};

/** SVG d'une icône (vide si le nom est inconnu). */
export function icon(name, cls = '') {
  const paths = PATHS[name];
  return paths ? `<svg class="ic ic-${name}${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>` : '';
}

export const ICON_NAMES = Object.keys(PATHS);
