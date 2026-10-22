"""Lecture de la base de cartes : recherche par nom (FR ou EN) et recherche plein texte."""

import re
import sqlite3

from rules.models import Card

_COLUMNS = (
    "oracle_id", "name_en", "name_fr", "type_line_en", "oracle_text_en",
    "color_identity", "commander_legality", "mana_cost", "cmc", "layout",
)
_SELECT = ", ".join(_COLUMNS)
_SELECT_CARDS = ", ".join("cards." + column for column in _COLUMNS)


def connect(path):
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def _to_card(row):
    return Card(
        oracle_id=row["oracle_id"],
        name=row["name_en"],
        name_fr=row["name_fr"],
        type_line=row["type_line_en"],
        oracle_text=row["oracle_text_en"],
        color_identity=row["color_identity"],
        commander_legality=row["commander_legality"],
        mana_cost=row["mana_cost"],
        cmc=row["cmc"],
        layout=row["layout"],
    )


def find_by_name(conn, name):
    """Carte dont le nom anglais ou français correspond (casse ignorée), ou None."""
    name = name.strip()
    if not name:
        return None
    row = conn.execute(f"SELECT {_SELECT} FROM cards WHERE name_en = ? COLLATE NOCASE", (name,)).fetchone()
    if row is None:
        row = conn.execute(f"SELECT {_SELECT} FROM cards WHERE name_fr = ? COLLATE NOCASE", (name,)).fetchone()
    return _to_card(row) if row is not None else None


def search(conn, text, limit=50, commander_legal=False):
    """Recherche dans les noms et les textes, FR et EN. Accents ignorés ; chaque mot est un préfixe."""
    expression = " ".join(f'"{word}"*' for word in re.findall(r"\w+", text))
    if not expression:
        return []
    sql = (
        f"SELECT {_SELECT_CARDS} FROM cards_fts "
        "JOIN cards ON cards.oracle_id = cards_fts.oracle_id "
        "WHERE cards_fts MATCH ?"
    )
    params = [expression]
    if commander_legal:
        sql += " AND cards.commander_legality = 'legal'"
    sql += " ORDER BY bm25(cards_fts), cards.name_en LIMIT ?"
    params.append(limit)
    return [_to_card(row) for row in conn.execute(sql, params)]


def make_lookup(conn):
    """Fonction nom -> Card, avec cache. Sert à résoudre les noms d'une liste de deck."""
    cache = {}

    def lookup(name):
        if name not in cache:
            cache[name] = find_by_name(conn, name)
        return cache[name]

    return lookup
