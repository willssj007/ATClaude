"""Tests de lecture des listes de deck au format texte."""

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from rules.decklist import parse_decklist  # noqa: E402
from rules.models import DeckLine  # noqa: E402


class DecklistTests(unittest.TestCase):
    def test_export_with_sections_and_tags(self):
        text = """Commander
1 Atraxa, Praetors' Voice (ONE) 208

Deck
1 Sol Ring (C21) 263 *F*
4x Forest
1 Fire // Ice (MH2) 123
"""
        lines, warnings = parse_decklist(text)
        self.assertEqual(warnings, [])
        self.assertEqual(lines[0], DeckLine(1, "Atraxa, Praetors' Voice", "commander"))
        self.assertEqual(lines[1], DeckLine(1, "Sol Ring", "main"))
        self.assertEqual(lines[2], DeckLine(4, "Forest", "main"))
        self.assertEqual(lines[3], DeckLine(1, "Fire // Ice", "main"))

    def test_commander_tag_without_header(self):
        lines, _ = parse_decklist("1 Pir, Imaginative Rascal (ZNR) 250 *CMDR*\n1 Sol Ring")
        self.assertEqual(lines[0].section, "commander")
        self.assertEqual(lines[1].section, "main")

    def test_headers_with_counts_and_sideboard(self):
        text = "Deck (99):\n1 Sol Ring\nSideboard (1)\n1 Lightning Bolt"
        lines, warnings = parse_decklist(text)
        self.assertEqual(warnings, [])
        self.assertEqual(lines[0].section, "main")
        self.assertEqual(lines[1].section, "side")

    def test_unknown_lines_are_reported_not_ignored(self):
        lines, warnings = parse_decklist("Sol Ring\n1 Forest\n???")
        self.assertEqual([line.name for line in lines], ["Forest"])
        self.assertEqual(len(warnings), 2)

    def test_card_name_starting_with_x(self):
        lines, _ = parse_decklist("1 X Marks the Spot")
        self.assertEqual(lines[0].name, "X Marks the Spot")
        self.assertEqual(lines[0].quantity, 1)


if __name__ == "__main__":
    unittest.main()
