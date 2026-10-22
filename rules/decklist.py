"""Lecture d'une liste de deck au format texte (export Moxfield, Archidekt ou équivalent).

Exemple :

    Commander
    1 Atraxa, Praetors' Voice (ONE) 208

    Deck
    4 Sol Ring (C21) 263
    1x Forest *F*

Les lignes non reconnues ne sont pas ignorées en silence : elles sont renvoyées comme avertissements.
"""

import re

from rules.models import DeckLine

_SECTIONS = {
    "commander": "commander", "commanders": "commander",
    "commandant": "commander", "commandants": "commander",
    "deck": "main", "mainboard": "main", "main": "main", "maindeck": "main",
    "main deck": "main", "deck principal": "main",
    "sideboard": "side", "side": "side", "maybeboard": "side",
    "réserve": "side", "reserve": "side",
}
# Quantité, « x » facultatif (minuscule seulement, pour ne pas confondre avec « X Marks the Spot »), nom.
_LINE = re.compile(r"^(\d+)\s*x?\s+(.+)$")
_COMMANDER_TAG = re.compile(r"\*CMDR\*", re.IGNORECASE)
_TRAILING_TAG = re.compile(r"\s+\*[^*]*\*\s*$")
_HEADER_COUNT = re.compile(r"\s*\(\d+\)\s*$")


def _card_name(text):
    """« Sol Ring (C21) 263 *F* » devient « Sol Ring »."""
    return _TRAILING_TAG.sub("", text.split(" (", 1)[0]).strip()


def parse_decklist(text):
    """Retourne (lignes, avertissements) pour un texte de liste de deck."""
    lines, warnings = [], []
    section = "main"
    for number, raw in enumerate(text.splitlines(), start=1):
        stripped = raw.strip()
        if not stripped or stripped.startswith(("#", "//")):
            continue
        header = _HEADER_COUNT.sub("", stripped.rstrip(":")).strip().lower()
        if header in _SECTIONS:
            section = _SECTIONS[header]
            continue
        match = _LINE.match(stripped)
        name = _card_name(match.group(2)) if match else ""
        if not name:
            warnings.append(f"Ligne {number} non reconnue : {stripped}")
            continue
        line_section = "commander" if _COMMANDER_TAG.search(stripped) else section
        lines.append(DeckLine(quantity=int(match.group(1)), name=name, section=line_section))
    return lines, warnings
