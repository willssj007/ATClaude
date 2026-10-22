-- Base de cartes locale, générée par data/import_scryfall.py.
-- Une ligne par carte Oracle. Le nom, le texte et les légalités viennent de l'anglais ;
-- les champs *_fr sont remplis quand la carte a été imprimée en français.

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
    oracle_id          TEXT PRIMARY KEY,
    name_en            TEXT NOT NULL,
    name_fr            TEXT,
    type_line_en       TEXT NOT NULL,
    type_line_fr       TEXT,
    oracle_text_en     TEXT NOT NULL,
    oracle_text_fr     TEXT,
    mana_cost          TEXT NOT NULL,
    cmc                REAL NOT NULL,
    colors             TEXT NOT NULL,  -- couleurs de la carte, ordre WUBRG (ex. 'WU')
    color_identity     TEXT NOT NULL,  -- identité de couleur, ordre WUBRG ('' si incolore)
    layout             TEXT NOT NULL,
    commander_legality TEXT NOT NULL,  -- legal | banned | not_legal | restricted
    legalities_json    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS cards_name_en ON cards (name_en COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS cards_name_fr ON cards (name_fr COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS cards_commander ON cards (commander_legality, color_identity);

-- Index plein texte : noms et textes, FR et EN, accents ignorés.
CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5 (
    oracle_id UNINDEXED,
    name_en,
    name_fr,
    oracle_text_en,
    oracle_text_fr,
    tokenize = 'unicode61 remove_diacritics 2'
);
