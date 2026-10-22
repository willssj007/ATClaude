"""Règles de construction d'un deck Commander.

Couvert : taille du deck (100 cartes, commandant compris), singleton et exceptions
(cartes de base, « any number of cards », « up to N cards »), légalité et interdictions,
identité de couleur, commandant légal, duo de partenaires simples ou « Partner with ».

Non couvert : Background, Friends forever, Doctor's companion, et les variantes
« Partner — Survivors » et « Partner — Father & Son ».
"""

import re
from collections import Counter

DECK_SIZE = 100
WUBRG = "WUBRG"

_WORD_NUMBERS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
    "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13,
    "fourteen": 14, "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
    "nineteen": 19, "twenty": 20,
}
_ANY_NUMBER = re.compile(r"a deck can have any number of cards named", re.IGNORECASE)
_UP_TO = re.compile(r"a deck can have up to (\w+) cards named", re.IGNORECASE)
_PLAIN_PARTNER = re.compile(r"^partner\s*(\(|$)", re.IGNORECASE | re.MULTILINE)
_PARTNER_WITH = re.compile(r"^partner with ([^(\n]+)", re.IGNORECASE | re.MULTILINE)
_LEGALITY_LABELS = {"banned": "interdite", "restricted": "restreinte", "not_legal": "non légale"}


def copy_limit(card):
    """Nombre maximal d'exemplaires d'une carte dans un deck, ou None si le nombre est illimité."""
    if card.is_basic_land or _ANY_NUMBER.search(card.oracle_text):
        return None
    match = _UP_TO.search(card.oracle_text)
    if match:
        word = match.group(1).lower()
        return int(word) if word.isdigit() else _WORD_NUMBERS.get(word, 1)
    return 1


def can_be_commander(card):
    """Vrai si la carte peut être commandant : créature légendaire, ou texte « can be your commander »."""
    if {"legendary", "creature"} <= card.front_words():
        return True
    return "can be your commander" in card.oracle_text.lower()


def _partner_target(card):
    match = _PARTNER_WITH.search(card.oracle_text)
    return match.group(1).strip().lower() if match else None


def _has_plain_partner(card):
    return bool(_PLAIN_PARTNER.search(card.oracle_text))


def _can_partner(first, second):
    if _has_plain_partner(first) and _has_plain_partner(second):
        return True
    return (_partner_target(first) == second.name.lower()
            and _partner_target(second) == first.name.lower())


def _wubrg(letters):
    present = set(letters)
    return "".join(color for color in WUBRG if color in present)


def validate_commander_deck(lines, lookup):
    """Retourne la liste des problèmes du deck. Une liste vide signifie que le deck est valide.

    lines  : liste de DeckLine. La section "side" (réserve) n'est pas prise en compte.
    lookup : fonction nom -> Card, qui renvoie None si la carte est inconnue.
    """
    deck_lines = [line for line in lines if line.section in ("commander", "main")]
    problems = []

    resolved, missing = [], []
    for line in deck_lines:
        card = lookup(line.name)
        if card is None:
            missing.append(line.name)
        else:
            resolved.append((line, card))
    if missing:
        problems.append("Cartes introuvables : " + ", ".join(sorted(set(missing))) + ".")

    commanders = [card for line, card in resolved
                  if line.section == "commander" for _ in range(line.quantity)]
    if not commanders:
        problems.append("Aucun commandant : place-le dans la section « Commander ».")
        return problems

    if len(commanders) > 2:
        problems.append("Un deck Commander peut avoir deux commandants au maximum.")
    for card in commanders:
        if not can_be_commander(card):
            problems.append(f"{card.name} ne peut pas être commandant (il faut une créature légendaire).")
    if len(commanders) == 2 and not _can_partner(*commanders):
        problems.append(
            f"{commanders[0].name} et {commanders[1].name} ne peuvent pas être associés comme partenaires."
        )

    total = sum(line.quantity for line in deck_lines)
    if total != DECK_SIZE:
        problems.append(f"Le deck compte {total} cartes au lieu de {DECK_SIZE}.")

    copies, by_id = Counter(), {}
    for line, card in resolved:
        copies[card.oracle_id] += line.quantity
        by_id[card.oracle_id] = card
    for oracle_id, count in copies.items():
        card = by_id[oracle_id]
        limit = copy_limit(card)
        if limit is not None and count > limit:
            rule = "un seul exemplaire est autorisé" if limit == 1 else f"{limit} exemplaires sont autorisés"
            problems.append(f"{card.name} apparaît {count} fois ({rule}).")
        if card.commander_legality != "legal":
            label = _LEGALITY_LABELS.get(card.commander_legality, "non légale")
            problems.append(f"{card.name} est {label} en Commander.")

    identity = set()
    for card in commanders:
        identity.update(card.color_identity)
    identity_label = _wubrg(identity) or "incolore"
    for oracle_id in copies:
        card = by_id[oracle_id]
        if not set(card.color_identity) <= identity:
            problems.append(f"{card.name} sort de l'identité de couleur du commandant ({identity_label}).")

    return problems
