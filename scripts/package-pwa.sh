#!/usr/bin/env bash
# Assemble la version iPhone (PWA) : l'interface, le moteur (jars du pont et de Forge, lancés dans la page par
# CheerpJ) et les ressources de Forge (installées dans le navigateur au premier lancement). Musiques et
# bruitages font partie de l'interface (ui/snd).
#
# Usage : scripts/package-pwa.sh DOSSIER_RESSOURCES_FORGE DOSSIER_JARS_WEB VERSION DOSSIER_SORTIE
#   DOSSIER_RESSOURCES_FORGE : sortie de package-res.sh (contient res/)
#   DOSSIER_JARS_WEB         : web/target (web-*.jar et lib/)
set -euo pipefail

ASSETS="$(cd "$1" && pwd)"
JARS="$(cd "$2" && pwd)"
VERSION="$3"
OUT="$4"
HERE="$(cd "$(dirname "$0")" && pwd)"
UI="$HERE/../ui"

rm -rf "$OUT"
mkdir -p "$OUT"
cp -r "$UI"/. "$OUT"/
touch "$OUT/.nojekyll"

# Moteur : dossier propre à la version (le navigateur ne mélange jamais deux versions). Les bibliothèques
# restent dans lib/, là où le manifeste du jar web les annonce (CheerpJ les y cherche aussi).
ENGINE="engine-$VERSION"
mkdir -p "$OUT/$ENGINE/lib"
cp "$JARS"/web-*.jar "$OUT/$ENGINE/"
cp "$JARS"/lib/*.jar "$OUT/$ENGINE/lib/"

# Java 11 dans le navigateur : celle de CheerpJ est la plus aboutie (son Java 17 n'est qu'un aperçu, et Forge s'y
# plantait en créant les cartes). Les jars compilés pour Java 17 (Forge, le pont, ce module) sont convertis par
# JvmDowngrader ; ses classes de remplacement des API Java 12 à 17 vont dans lib/jvmdg-api.jar.
JVMDG_VERSION=2.0.1
JVMDG_SHA256=60a5bd57846fb4be1756fb93e6f63b3d9a63c2759a63e763c44553b086326107
JVMDG="${XDG_CACHE_HOME:-$HOME/.cache}/atclaude/jvmdowngrader-$JVMDG_VERSION-all.jar"
if [ ! -f "$JVMDG" ]; then
  mkdir -p "$(dirname "$JVMDG")"
  curl -fsSL -o "$JVMDG.part" \
    "https://repo1.maven.org/maven2/xyz/wagyourtail/jvmdowngrader/jvmdowngrader/$JVMDG_VERSION/jvmdowngrader-$JVMDG_VERSION-all.jar"
  echo "$JVMDG_SHA256  $JVMDG.part" | sha256sum -c --quiet -
  mv "$JVMDG.part" "$JVMDG"
fi
ENGINE_CP="$(ls "$OUT/$ENGINE"/web-*.jar "$OUT/$ENGINE"/lib/*.jar | tr '\n' ':')"
DOWN="$(mktemp -d)"
for jar in "$OUT/$ENGINE"/web-*.jar "$OUT/$ENGINE"/lib/*.jar; do
  # Classe la plus récente du jar (hors variantes Multi-Release, que Java 11 ne lit pas au-delà de 11).
  MAJOR="$(python3 - "$jar" <<'PY'
import sys, zipfile
best = 0
with zipfile.ZipFile(sys.argv[1]) as z:
    for n in z.namelist():
        if n.endswith('.class') and not n.startswith('META-INF/'):
            head = z.open(n).read(8)
            best = max(best, int.from_bytes(head[6:8], 'big'))
print(best)
PY
)"
  if [ "$MAJOR" -gt 55 ]; then
    java -jar "$JVMDG" --classVersion 55 downgrade --classpath "$ENGINE_CP" --target "$jar" "$DOWN/$(basename "$jar")"
    mv "$DOWN/$(basename "$jar")" "$jar"
  fi
done
rm -rf "$DOWN"
java -jar "$JVMDG" --classVersion 55 debug downgradeApi "$OUT/$ENGINE/lib/jvmdg-api.jar"

# Ressources de Forge.
TMP="$(mktemp -d)"
cp -r "$ASSETS/res" "$TMP/res"
rm -rf "$TMP/res/forge.profile.properties"
# Empreinte du contenu (pas de l'archive) : une nouvelle version ne réinstalle les cartes que si elles ont changé.
RES_HASH="$(cd "$TMP" && find res -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -c1-16)"
mkdir -p "$OUT/forge-$RES_HASH"
(cd "$TMP" && zip -q -r -9 -n .zip "$OUT/forge-$RES_HASH/res.zip" res)
RES_SIZE="$(stat -c %s "$OUT/forge-$RES_HASH/res.zip")"
rm -rf "$TMP"


# Page : CheerpJ (servi par Leaning Technologies) puis le démarrage du moteur, avant l'interface.
python3 - "$OUT/index.html" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
tags = ('<script src="https://cjrtnc.leaningtech.com/4.3/loader.js"></script>\n'
        '  <script src="js/pwa.js"></script>')
s, n = re.subn(r'<!--pwa:[^>]*-->', tags, s)
if n != 1:
    sys.exit('marqueur <!--pwa: ...--> introuvable dans index.html')
open(p, 'w', encoding='utf-8').write(s)
PY
sed -i "s/^const VERSION = 'dev';/const VERSION = '$VERSION';/" "$OUT/sw.js"
grep -q "const VERSION = '$VERSION';" "$OUT/sw.js"

# Fichiers de l'interface gardés par le service worker à l'installation (pas le moteur, les ressources ni les
# musiques, gardées une fois écoutées).
(cd "$OUT" && python3 - "$VERSION" <<'PY'
import json, os, sys
files = ['./']
for root, dirs, names in os.walk('.'):
    dirs[:] = [d for d in dirs if not d.startswith(('engine-', 'forge-')) and os.path.join(root, d) != './snd/music']
    for n in names:
        rel = os.path.join(root, n)[2:]
        if rel in ('sw.js', 'precache.json', 'engine.json', '.nojekyll'):
            continue
        files.append(rel)
json.dump(sorted(files), open('precache.json', 'w'))
PY
)

JARS_JSON="$(cd "$OUT/$ENGINE" && ls web-*.jar; ls lib | sort | sed 's|^|lib/|')"
python3 - "$OUT/engine.json" "$VERSION" "$ENGINE" "forge-$RES_HASH/res.zip" "$RES_HASH" "$RES_SIZE" <<PY
import json, sys
out, version, engine, res, res_hash, res_size = sys.argv[1:7]
jars = """$JARS_JSON""".split()
json.dump({'version': version, 'java': 11, 'engine': engine, 'jars': jars, 'res': res, 'resHash': res_hash,
           'resSize': int(res_size)},
          open(out, 'w'), indent=1)
PY

echo "Version iPhone prête dans $OUT : $(du -sh "$OUT" | cut -f1) (moteur $ENGINE, ressources forge-$RES_HASH, $(stat -c %s "$OUT/forge-$RES_HASH/res.zip") octets)"
