#!/usr/bin/env bash
# Récupère Forge à la version testée, compile les modules utilisés par l'application
# (cœur, règles, IA, logique d'interface) et les installe dans le dépôt Maven local.
#
# Usage : scripts/build-forge.sh [dossier-forge]
set -euo pipefail

FORGE_REPO="https://github.com/Card-Forge/forge"
FORGE_COMMIT="$(cat "$(dirname "$0")/../forge.commit")"
FORGE_DIR="${1:-${FORGE_DIR:-$HOME/forge-src}}"

if [ ! -d "$FORGE_DIR/.git" ]; then
  git clone --filter=blob:none --no-checkout "$FORGE_REPO" "$FORGE_DIR"
fi
git -C "$FORGE_DIR" fetch --depth 1 origin "$FORGE_COMMIT"
git -C "$FORGE_DIR" checkout --force "$FORGE_COMMIT"

(cd "$FORGE_DIR" && mvn -B -q install -pl forge-core,forge-game,forge-ai,forge-gui -am -DskipTests -Dcheckstyle.skip)

# Forge publie des POM avec ${revision} non résolu (le « flatten » n'a lieu qu'au déploiement) :
# on remplace la variable pour que d'autres projets puissent dépendre de ces modules.
VERSION="$(cd "$FORGE_DIR" && mvn -B -q help:evaluate -Dexpression=project.version -DforceStdout 2>/dev/null || true)"
VERSION="${VERSION:-2.0.16-SNAPSHOT}"
for module in forge forge-core forge-game forge-ai forge-gui; do
  pom="$HOME/.m2/repository/forge/$module/$VERSION/$module-$VERSION.pom"
  # -i.bak : accepté par le sed GNU (Linux) comme par celui de macOS.
  [ -f "$pom" ] && sed -i.bak "s/\${revision}/$VERSION/g" "$pom" && rm -f "$pom.bak"
done
rm -rf "$HOME/.m2/repository/forge/forge/\${revision}"
echo "Forge $VERSION installé depuis $FORGE_DIR"
