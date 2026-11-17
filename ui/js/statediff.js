/**
 * Photos différentielles de la partie (voir BridgeGuiGame.diffed) : une carte qui n'a pas changé depuis la photo
 * précédente arrive comme {"$": id} et reprend ici l'objet déjà reçu. Les photos sont numérotées (seq) et une photo
 * différentielle dit sur laquelle elle s'appuie (base) ; une photo complète n'a pas de base.
 */
let known = new Map();
let lastSeq = null;

/**
 * Remplace les cartes inchangées par celles déjà reçues. Renvoie null si c'est impossible (photo manquée, carte
 * inconnue) : il faut alors demander une photo complète.
 */
export function rehydrate(state) {
  if (state.seq === undefined) {
    // Moteur d'une version sans photos différentielles.
    return state;
  }
  const full = state.base === undefined;
  if (!full && state.base !== lastSeq) {
    return null;
  }
  const next = new Map();
  for (const p of state.players || []) {
    for (const [zone, cards] of Object.entries(p.zones || {})) {
      for (let i = 0; i < cards.length; i++) {
        let c = cards[i];
        if (c && c.$ !== undefined) {
          c = known.get(c.$);
          if (!c) {
            return null;
          }
          cards[i] = c;
        }
        if (c && c.id !== undefined) {
          next.set(c.id, c);
        }
      }
      p.zones[zone] = cards;
    }
  }
  known = next;
  lastSeq = state.seq;
  return state;
}

/** Nouvelle partie, ou interface qui repart de zéro : la prochaine photo doit être complète. */
export function resetStates() {
  known = new Map();
  lastSeq = null;
}
