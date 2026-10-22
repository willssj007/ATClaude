"""Types partagés entre la base de cartes et les règles."""

import re
from dataclasses import dataclass
from typing import Optional

# Tiret entre le type de devant et celui de derrière : « Legendary Creature — Elf Druid ».
_DASH = re.compile(r"\s[—-]\s")


@dataclass(frozen=True)
class Card:
    """Une carte Oracle : une seule entrée par carte, quel que soit son nombre d'impressions."""

    oracle_id: str
    name: str                  # nom anglais, référence pour les règles
    name_fr: Optional[str]     # nom français, None si la carte n'a jamais été imprimée en français
    type_line: str             # type anglais, ex. "Legendary Creature — Elf Druid"
    oracle_text: str           # texte anglais ; les faces sont séparées par un retour à la ligne
    color_identity: str        # lettres WUBRG, ex. "WU" ; "" pour une carte incolore
    commander_legality: str    # legal | banned | not_legal | restricted
    mana_cost: str = ""
    cmc: float = 0.0
    layout: str = "normal"

    def front_words(self):
        """Mots du type situés avant le tiret, en minuscules : {'legendary', 'creature'}."""
        front = _DASH.split(self.type_line, maxsplit=1)[0]
        return set(front.lower().split())

    @property
    def is_basic_land(self):
        words = self.front_words()
        return "basic" in words and "land" in words


@dataclass(frozen=True)
class DeckLine:
    """Une ligne de liste de deck : une quantité d'une carte, dans une section donnée."""

    quantity: int
    name: str
    section: str = "main"      # commander | main | side
