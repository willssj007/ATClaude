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

# Dossiers lus par le moteur, l'IA et les decks préconstruits. Pas de deckgendecks : les matrices des decks générés
# « d'après les cartes » ne servent pas (DECKGEN_CARDBASED désactivé, voir ForgeRuntime).
for dir in ai blockdata cube defaults editions effects formats lists setlookup tokenscripts; do
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

# Pas de sons ni de musiques de Forge : ceux de l'application sont dans ui/snd (tools/audio). Le dossier reste,
# vide, pour Forge qui y cherche ses jeux de sons.
mkdir -p "$OUT/res/sound"

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
  # Empreinte du contenu, à côté de l'archive : Android ne réinstalle les ressources que si elle change (et non à
  # chaque mise à jour de l'application, dont la plupart ne touchent que l'interface ou le pont).
  if command -v sha256sum > /dev/null; then sha256sum "$ZIP_ABS"; else shasum -a 256 "$ZIP_ABS"; fi | cut -c1-64 > "$(dirname "$ZIP_ABS")/res.sha"
  echo "Ressources : $(du -sh "$ZIP_ABS" | cut -f1) dans $ZIP_ABS"
fi
echo "Ressources prêtes dans $OUT"
