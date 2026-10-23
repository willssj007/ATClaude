#!/usr/bin/env bash
# Prépare les ressources Forge embarquées dans l'application (Android, Windows) :
# copie le strict nécessaire depuis forge-gui/res, compresse les scripts de cartes,
# répare la traduction française, puis produit res.zip.
#
# Usage : scripts/package-res.sh FORGE_RES_DIR DOSSIER_SORTIE [FICHIER_ZIP]
set -euo pipefail

SRC="$(cd "$1" && pwd)"
OUT="$2"
ZIP="${3:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"

rm -rf "$OUT"
mkdir -p "$OUT/res"

# Dossiers lus par le moteur, l'IA et les decks préconstruits.
for dir in ai blockdata cube defaults editions effects formats lists setlookup tokenscripts deckgendecks; do
  cp -r "$SRC/$dir" "$OUT/res/$dir"
done
mkdir -p "$OUT/res/quest"
for dir in commanderprecons precons themes; do
  cp -r "$SRC/quest/$dir" "$OUT/res/quest/$dir"
done
cp "$SRC/quest/booster-prices.txt" "$OUT/res/quest/" 2>/dev/null || true
for f in "$SRC"/*.txt; do
  cp "$f" "$OUT/res/"
done

# Effets sonores de Forge, et musiques douces de son mode Aventure (Vindsvept, Brandon et Derek Fiechter,
# Logan Epic Canto) : seulement les morceaux joués par l'application (liste dans bridge/.../Audio.java).
cp -r "$SRC/sound" "$OUT/res/sound"
for track in menus/menu1 menus/menu2 town/town1 town/town5 town/town6 town/town7 white/white1 white/white2 \
             green/green1 green/green2 colorless/waste1 colorless/waste2; do
  mkdir -p "$OUT/res/adventure/common/music/$(dirname "$track")"
  cp "$SRC/adventure/common/music/$track.mp3" "$OUT/res/adventure/common/music/$track.mp3"
done

# Langues : anglais (référence) et français.
mkdir -p "$OUT/res/languages"
cp "$SRC/languages/en-US.properties" "$SRC/languages/fr-FR.properties" "$SRC/languages/cardnames-fr-FR.txt" "$OUT/res/languages/"
python3 "$HERE/fix-french.py" "$OUT/res"

# Scripts de cartes : Forge sait les lire dans une archive cardsfolder.zip, bien plus rapide à installer
# que des dizaines de milliers de petits fichiers.
mkdir -p "$OUT/res/cardsfolder"
(cd "$SRC/cardsfolder" && zip -q -r -9 "$OUT/res/cardsfolder/cardsfolder.zip" . -x "cardsfolder.zip")

if [ -n "$ZIP" ]; then
  rm -f "$ZIP"
  mkdir -p "$(dirname "$ZIP")"
  ZIP_ABS="$(cd "$(dirname "$ZIP")" && pwd)/$(basename "$ZIP")"
  # Les fichiers déjà compressés sont stockés tels quels (-n .zip).
  (cd "$OUT" && zip -q -r -9 -n .zip "$ZIP_ABS" res)
  echo "Ressources : $(du -sh "$ZIP_ABS" | cut -f1) dans $ZIP_ABS"
fi
echo "Ressources prêtes dans $OUT"
