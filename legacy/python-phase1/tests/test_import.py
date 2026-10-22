"""Tests de l'import Scryfall et des recherches, sans réseau (fichier d'essai dans tests/fixtures)."""

import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from data import repository  # noqa: E402
from data.import_scryfall import build  # noqa: E402

FIXTURE = ROOT / "tests" / "fixtures" / "sample_bulk.json"


class ImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.db_path = os.path.join(cls.tmp.name, "cards.sqlite")
        cls.count = build(str(FIXTURE), cls.db_path)
        cls.conn = repository.connect(cls.db_path)

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()
        cls.tmp.cleanup()

    def test_one_row_per_oracle_card(self):
        self.assertEqual(self.count, 10)

    def test_tokens_are_not_imported(self):
        self.assertIsNone(repository.find_by_name(self.conn, "Goblin"))

    def test_latest_french_printing_wins(self):
        # L'impression « Ancien anneau » (2019) est lue après « Anneau solaire » (2021) : elle est ignorée.
        card = repository.find_by_name(self.conn, "Sol Ring")
        self.assertEqual(card.name_fr, "Anneau solaire")

    def test_french_name_lookup_ignores_case(self):
        card = repository.find_by_name(self.conn, "anneau SOLAIRE")
        self.assertEqual(card.name, "Sol Ring")

    def test_card_without_french_printing(self):
        card = repository.find_by_name(self.conn, "Atraxa, Praetors' Voice")
        self.assertIsNone(card.name_fr)

    def test_multi_face_card_is_joined(self):
        card = repository.find_by_name(self.conn, "Fire // Ice")
        self.assertEqual(card.mana_cost, "{1}{R} // {1}{U}")
        self.assertIn("Draw a card", card.oracle_text)

    def test_banned_status_is_kept(self):
        card = repository.find_by_name(self.conn, "Black Lotus")
        self.assertEqual(card.commander_legality, "banned")

    def test_search_ignores_accents(self):
        names = [card.name for card in repository.search(self.conn, "foret")]
        self.assertIn("Forest", names)

    def test_search_matches_prefixes(self):
        names = [card.name for card in repository.search(self.conn, "light")]
        self.assertIn("Lightning Bolt", names)

    def test_commander_filter(self):
        self.assertEqual(repository.search(self.conn, "lotus", commander_legal=True), [])
        names = [card.name for card in repository.search(self.conn, "sol", commander_legal=True)]
        self.assertIn("Sol Ring", names)

    def test_pretty_printed_file_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            bad = os.path.join(tmp, "bad.json")
            with open(bad, "w", encoding="utf-8") as handle:
                handle.write('[\n  {\n    "object": "card"\n  }\n]\n')
            with self.assertRaises(ValueError):
                build(bad, os.path.join(tmp, "out.sqlite"))


if __name__ == "__main__":
    unittest.main()
