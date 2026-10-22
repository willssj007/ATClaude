"""Tests des règles Commander, sur des cartes construites à la main (sans base de données)."""

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from rules.commander import can_be_commander, copy_limit, validate_commander_deck  # noqa: E402
from rules.models import Card, DeckLine  # noqa: E402


def make_card(name, type_line, identity="", text="", legality="legal"):
    return Card(
        oracle_id=name.lower().replace(" ", "-"),
        name=name,
        name_fr=None,
        type_line=type_line,
        oracle_text=text,
        color_identity=identity,
        commander_legality=legality,
    )


ATRAXA = make_card(
    "Atraxa, Praetors' Voice", "Legendary Creature — Phyrexian Angel", "WUBG",
    "Flying, vigilance, deathtouch, lifelink\nAt the beginning of your end step, proliferate.",
)
PIR = make_card(
    "Pir, Imaginative Rascal", "Legendary Creature — Human", "G",
    "Partner with Toothy, Imaginary Friend (When this creature enters, ...)",
)
TOOTHY = make_card(
    "Toothy, Imaginary Friend", "Legendary Creature — Illusion", "U",
    "Partner with Pir, Imaginative Rascal (When this creature enters, ...)",
)
ELVES = make_card("Llanowar Elves", "Creature — Elf Druid", "G", "{T}: Add {G}.")
SOL_RING = make_card("Sol Ring", "Artifact", "", "{T}: Add {C}{C}.")
FOREST = make_card("Forest", "Basic Land — Forest", "", "({T}: Add {G}.)")
RATS = make_card(
    "Relentless Rats", "Creature — Rat", "B",
    "Relentless Rats gets +1/+1 for each other Rat you control.\n"
    "A deck can have any number of cards named Relentless Rats.",
)
DWARVES = make_card(
    "Seven Dwarves", "Creature — Dwarf", "",
    "A deck can have up to seven cards named Seven Dwarves.",
)
BOLT = make_card("Lightning Bolt", "Instant", "R", "Lightning Bolt deals 3 damage to any target.")
LOTUS = make_card(
    "Black Lotus", "Artifact", "", "Sacrifice Black Lotus: Add three mana of any one color.",
    legality="banned",
)

CARDS = [ATRAXA, PIR, TOOTHY, ELVES, SOL_RING, FOREST, RATS, DWARVES, BOLT, LOTUS]


def lookup(name):
    for card in CARDS:
        if card.name.lower() == name.lower():
            return card
    return None


def deck(commanders=(), main=(), side=()):
    lines = [DeckLine(quantity, name, "commander") for quantity, name in commanders]
    lines += [DeckLine(quantity, name, "main") for quantity, name in main]
    lines += [DeckLine(quantity, name, "side") for quantity, name in side]
    return lines


class CommanderRulesTests(unittest.TestCase):
    def test_valid_deck_has_no_problem(self):
        problems = validate_commander_deck(
            deck([(1, "Atraxa, Praetors' Voice")], [(1, "Sol Ring"), (98, "Forest")]), lookup)
        self.assertEqual(problems, [])

    def test_deck_must_have_100_cards(self):
        problems = validate_commander_deck(
            deck([(1, "Atraxa, Praetors' Voice")], [(1, "Sol Ring"), (97, "Forest")]), lookup)
        self.assertTrue(any("99 cartes" in problem for problem in problems))

    def test_singleton_rule(self):
        problems = validate_commander_deck(
            deck([(1, "Atraxa, Praetors' Voice")], [(2, "Sol Ring"), (97, "Forest")]), lookup)
        self.assertTrue(any("Sol Ring apparaît 2 fois" in problem for problem in problems))

    def test_any_number_cards_are_allowed(self):
        problems = validate_commander_deck(
            deck([(1, "Atraxa, Praetors' Voice")], [(10, "Relentless Rats"), (89, "Forest")]), lookup)
        self.assertEqual(problems, [])

    def test_up_to_n_limit(self):
        allowed = validate_commander_deck(
            deck([(1, "Atraxa, Praetors' Voice")], [(7, "Seven Dwarves"), (92, "Forest")]), lookup)
        too_many = validate_commander_deck(
            deck([(1, "Atraxa, Praetors' Voice")], [(8, "Seven Dwarves"), (91, "Forest")]), lookup)
        self.assertEqual(allowed, [])
        self.assertTrue(any("Seven Dwarves apparaît 8 fois" in problem for problem in too_many))

    def test_color_identity(self):
        problems = validate_commander_deck(
            deck([(1, "Atraxa, Praetors' Voice")], [(1, "Lightning Bolt"), (1, "Sol Ring"), (97, "Forest")]),
            lookup)
        self.assertTrue(any("Lightning Bolt sort de l'identité de couleur" in problem for problem in problems))

    def test_banned_card(self):
        problems = validate_commander_deck(
            deck([(1, "Atraxa, Praetors' Voice")], [(1, "Black Lotus"), (98, "Forest")]), lookup)
        self.assertIn("Black Lotus est interdite en Commander.", problems)

    def test_commander_must_be_legendary(self):
        problems = validate_commander_deck(
            deck([(1, "Llanowar Elves")], [(1, "Sol Ring"), (98, "Forest")]), lookup)
        self.assertTrue(any("ne peut pas être commandant" in problem for problem in problems))

    def test_partners_are_accepted(self):
        problems = validate_commander_deck(
            deck([(1, "Pir, Imaginative Rascal"), (1, "Toothy, Imaginary Friend")], [(98, "Forest")]),
            lookup)
        self.assertEqual(problems, [])

    def test_two_commanders_that_are_not_partners(self):
        problems = validate_commander_deck(
            deck([(1, "Atraxa, Praetors' Voice"), (1, "Pir, Imaginative Rascal")], [(98, "Forest")]),
            lookup)
        self.assertTrue(any("ne peuvent pas être associés" in problem for problem in problems))

    def test_unknown_card_is_reported(self):
        problems = validate_commander_deck(
            deck([(1, "Atraxa, Praetors' Voice")], [(1, "Carte Inexistante"), (98, "Forest")]), lookup)
        self.assertTrue(any("introuvables" in problem and "Carte Inexistante" in problem for problem in problems))

    def test_deck_without_commander(self):
        problems = validate_commander_deck(deck([], [(1, "Sol Ring"), (99, "Forest")]), lookup)
        self.assertEqual(len(problems), 1)
        self.assertIn("Aucun commandant", problems[0])

    def test_sideboard_is_ignored(self):
        problems = validate_commander_deck(
            deck([(1, "Atraxa, Praetors' Voice")], [(1, "Sol Ring"), (98, "Forest")], side=[(1, "Lightning Bolt")]),
            lookup)
        self.assertEqual(problems, [])

    def test_copy_limits(self):
        self.assertEqual(copy_limit(SOL_RING), 1)
        self.assertIsNone(copy_limit(FOREST))
        self.assertIsNone(copy_limit(RATS))
        self.assertEqual(copy_limit(DWARVES), 7)

    def test_commander_eligibility(self):
        self.assertTrue(can_be_commander(ATRAXA))
        self.assertFalse(can_be_commander(ELVES))


if __name__ == "__main__":
    unittest.main()
