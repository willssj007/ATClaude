#!/usr/bin/env bash
# Construit l'APK Android en local. Nécessite Java 17, Maven, Gradle 8.9+ et le SDK Android (ANDROID_HOME).
#
# Usage : scripts/build-android.sh [dossier-forge]
set -euo pipefail
cd "$(dirname "$0")/.."
FORGE_DIR="${1:-${FORGE_DIR:-$HOME/forge-src}}"

scripts/build-forge.sh "$FORGE_DIR"
mvn -B -q install -DskipTests
scripts/package-res.sh "$FORGE_DIR/forge-gui/res" "$(mktemp -d)/forge-assets" android/app/src/main/assets/res.zip
rm -rf android/app/src/main/assets/ui
cp -r ui android/app/src/main/assets/ui
(cd android && gradle assembleDebug)
echo "APK : android/app/build/outputs/apk/debug/app-debug.apk"
