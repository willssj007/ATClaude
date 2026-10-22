#!/usr/bin/env python3
"""Construit la base de cartes locale à partir d'un export Scryfall « All Cards ».

Usage :
    python3 data/import_scryfall.py all-cards.json data/cards.sqlite

Le fichier est lu ligne par ligne (un objet JSON par carte, comme dans les exports Scryfall),
sans être chargé entièrement en mémoire. Les impressions sont regroupées par carte Oracle :
le nom, le texte et les légalités viennent de l'anglais ; le nom français est celui de
l'impression française la plus récente, s'il en existe une.
"""

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

SCHEMA_FILE = Path(__file__).with_name("schema.sql")
COLOR_ORDER = "WUBRG"
# Objets qui ne sont pas des cartes jouables : jetons, emblèmes, cartes d'art.
NON_PLAYABLE_LAYOUTS = {"token", "double_faced_token", "emblem", "art_series"}
COLUMNS = (
    "oracle_id", "name_en", "name_fr", "type_line_en", "type_line_fr",
    "oracle_text_en", "oracle_text_fr", "mana_cost", "cmc", "colors",
    "color_identity", "layout", "commander_legality", "legalities_json",
)


def iter_cards(path):
    """Produit chaque objet carte du fichier. Lève ValueError si le format n'est pas celui attendu."""
    with open(path, "r", encoding="utf-8-sig") as handle:
        for number, raw in enumerate(handle, start=1):
            line = raw.strip().rstrip(",")
            if not line or line in ("[", "]"):
                continue
            try:
                card = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(
                    f"Ligne {number} illisible ({error}). Ce script attend un objet JSON par ligne, "
                    "comme les exports Scryfall ou le format JSON Lines."
                ) from error
            if not isinstance(card, dict):
                raise ValueError(f"Ligne {number} : un objet JSON de carte est attendu.")
            yield card


def field(card, key, sep=" // "):
    """Valeur d'un champ. Si la carte ne le porte pas au niveau supérieur, concatène ses faces."""
    value = card.get(key)
    if value not in (None, ""):
        return value
    parts = [face.get(key) for face in card.get("card_faces") or [] if face.get(key) not in (None, "")]
    return sep.join(parts)


def color_string(values):
    """['W', 'U'] -> 'WU', dans l'ordre WUBRG."""
    present = {str(value).upper() for value in values or []}
    return "".join(color for color in COLOR_ORDER if color in present)


def new_record(card):
    """Crée l'enregistrement d'une carte Oracle à partir d'une de ses impressions."""
    legalities = card.get("legalities") or {}
    return {
        "oracle_id": card["oracle_id"],
        "name_en": card.get("name", ""),
        "name_fr": None,
        "type_line_en": field(card, "type_line"),
        "type_line_fr": None,
        "oracle_text_en": field(card, "oracle_text", sep="\n"),
        "oracle_text_fr": None,
        "mana_cost": field(card, "mana_cost"),
        "cmc": float(card.get("cmc") or 0),
        "colors": color_string(card.get("colors")),
        "color_identity": color_string(card.get("color_identity")),
        "layout": card.get("layout") or "normal",
        "commander_legality": legalities.get("commander", "not_legal"),
        "legalities_json": json.dumps(legalities, ensure_ascii=False, sort_keys=True),
        "fr_released_at": None,
    }


def add_french(record, card):
    """Retient le nom et le texte français de l'impression française la plus récente."""
    released = card.get("released_at") or ""
    if record["fr_released_at"] is not None and released < record["fr_released_at"]:
        return
    name_fr = field(card, "printed_name")
    if not name_fr:
        return
    record.update(
        name_fr=name_fr,
        type_line_fr=field(card, "printed_type_line") or None,
        oracle_text_fr=field(card, "printed_text", sep="\n") or None,
        fr_released_at=released,
    )


def write_database(records, source, target):
    """Écrit la base dans un fichier provisoire, puis le remplace : pas de base à moitié écrite."""
    partial = target + ".partial"
    if os.path.exists(partial):
        os.remove(partial)
    conn = sqlite3.connect(partial)
    try:
        conn.executescript(SCHEMA_FILE.read_text(encoding="utf-8"))
        placeholders = ", ".join("?" for _ in COLUMNS)
        conn.executemany(
            f"INSERT INTO cards ({', '.join(COLUMNS)}) VALUES ({placeholders})",
            [tuple(record[column] for column in COLUMNS) for record in records.values()],
        )
        conn.executemany(
            "INSERT INTO cards_fts (oracle_id, name_en, name_fr, oracle_text_en, oracle_text_fr) "
            "VALUES (?, ?, ?, ?, ?)",
            [
                (r["oracle_id"], r["name_en"], r["name_fr"], r["oracle_text_en"], r["oracle_text_fr"])
                for r in records.values()
            ],
        )
        conn.executemany(
            "INSERT INTO meta (key, value) VALUES (?, ?)",
            [
                ("source", os.path.basename(source)),
                ("card_count", str(len(records))),
                ("built_at", datetime.now(timezone.utc).isoformat(timespec="seconds")),
            ],
        )
        conn.commit()
    finally:
        conn.close()
    os.replace(partial, target)


def build(source, target):
    """Crée la base SQLite `target` à partir de l'export `source`. Retourne le nombre de cartes."""
    records = {}
    for card in iter_cards(source):
        oracle_id = card.get("oracle_id")
        if not oracle_id or card.get("layout") in NON_PLAYABLE_LAYOUTS:
            continue
        record = records.get(oracle_id)
        if record is None:
            record = records[oracle_id] = new_record(card)
        if card.get("lang") == "fr":
            add_french(record, card)
    write_database(records, source, target)
    return len(records)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Importe un export Scryfall dans une base SQLite.")
    parser.add_argument("source", help="export « All Cards » de Scryfall (JSON)")
    parser.add_argument("target", help="fichier SQLite à créer, ex. data/cards.sqlite")
    args = parser.parse_args(argv)
    count = build(args.source, args.target)
    print(f"{count} cartes écrites dans {args.target}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
