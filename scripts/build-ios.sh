#!/usr/bin/env bash
# Construit l'application iPhone et iPad (fichier .ipa signé « ad hoc », à re-signer à l'installation : AltStore,
# SideStore, Sideloadly...). Sur macOS avec Xcode ; Forge et le pont doivent être installés dans le dépôt Maven
# local (scripts/build-forge.sh puis mvn install).
#
# Usage : scripts/build-ios.sh DOSSIER_FORGE DOSSIER_RESSOURCES VERSION FICHIER_IPA
#   DOSSIER_FORGE      : sources de Forge (forge-gui-ios/pipeline : outils et règles de conversion)
#   DOSSIER_RESSOURCES : sortie de scripts/package-res.sh (contient res/)
#
# MobiVM compile le Java en code natif, mais son environnement Java date de Java 7 (bibliothèque d'Android) :
# comme forge-gui-ios (le portage iOS de Forge), on convertit tous les jars en bytecode Java 8 (JvmDowngrader), puis
# on redirige ce qui manque encore (flux, java.time, java.nio.file...) vers des bibliothèques de remplacement
# (MobiVmBridge et ses règles). Les jars convertis vont dans une copie du dépôt Maven, que MobiVM utilise ensuite.
set -euo pipefail

FORGE="$(cd "$1" && pwd)"
ASSETS="$(cd "$2" && pwd)"
VERSION="$3"
mkdir -p "$(dirname "$4")"
OUT_IPA="$(cd "$(dirname "$4")" && pwd)/$(basename "$4")"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS="$ROOT/ios"
PIPE="$FORGE/forge-gui-ios/pipeline"
WORK="$IOS/build/pipeline"
CLONE="$IOS/build/m2"
M2="${M2_REPO:-$HOME/.m2/repository}"

JVMDG_VER=1.3.6
SS_VER=1.7.4
THREETEN_VER=1.7.1
ASM_VER=9.9.1
ROBOVM_VER=2.3.24

JVMDG_JAR="$WORK/jvmdowngrader-$JVMDG_VER-all.jar"
SS_JAR="$WORK/streamsupport-$SS_VER.jar"
SSCF_JAR="$WORK/streamsupport-cfuture-$SS_VER.jar"
THREETEN_JAR="$WORK/threetenbp-$THREETEN_VER.jar"
API8_JAR="$WORK/java-api-8.jar"
NIO_JAR="$WORK/java-nio-supply.jar"
FUNC_JAR="$WORK/java-function-stubs.jar"
ASM="$M2/org/ow2/asm/asm/$ASM_VER/asm-$ASM_VER.jar"
ASMC="$M2/org/ow2/asm/asm-commons/$ASM_VER/asm-commons-$ASM_VER.jar"
TOOLS_CP="$ASM:$ASMC:$WORK/tools"
RT="$M2/com/mobidevelop/robovm/robovm-rt/$ROBOVM_VER/robovm-rt-$ROBOVM_VER.jar"
OBJC="$M2/com/mobidevelop/robovm/robovm-objc/$ROBOVM_VER/robovm-objc-$ROBOVM_VER.jar"
CT="$M2/com/mobidevelop/robovm/robovm-cocoatouch/$ROBOVM_VER/robovm-cocoatouch-$ROBOVM_VER.jar"
MVN=(mvn -B -q)

mkdir -p "$WORK/tools"

echo "=== [1/7] outils et bibliothèques de remplacement ==="
get() { # url fichier
  [ -f "$2" ] || curl -fsSL --retry 6 --retry-delay 10 --retry-all-errors -o "$2" "$1"
}
get "https://github.com/unimined/JvmDowngrader/releases/download/$JVMDG_VER/jvmdowngrader-$JVMDG_VER-all.jar" "$JVMDG_JAR"
get "https://repo1.maven.org/maven2/net/sourceforge/streamsupport/streamsupport/$SS_VER/streamsupport-$SS_VER.jar" "$SS_JAR"
get "https://repo1.maven.org/maven2/net/sourceforge/streamsupport/streamsupport-cfuture/$SS_VER/streamsupport-cfuture-$SS_VER.jar" "$SSCF_JAR"
get "https://repo1.maven.org/maven2/org/threeten/threetenbp/$THREETEN_VER/threetenbp-$THREETEN_VER.jar" "$THREETEN_JAR"
for a in org.ow2.asm:asm:$ASM_VER org.ow2.asm:asm-commons:$ASM_VER \
         com.mobidevelop.robovm:robovm-rt:$ROBOVM_VER com.mobidevelop.robovm:robovm-objc:$ROBOVM_VER \
         com.mobidevelop.robovm:robovm-cocoatouch:$ROBOVM_VER; do
  "${MVN[@]}" dependency:get -Dartifact="$a" -Dtransitive=false
done
# Classes de remplacement de JvmDowngrader (List.of, String.repeat, records...), déjà en Java 8.
[ -f "$API8_JAR" ] || java -jar "$JVMDG_JAR" -c 52 debug downgradeApi "$API8_JAR"
javac -nowarn -cp "$ASM:$ASMC" -d "$WORK/tools" "$PIPE/src/MobiVmBridge.java" "$PIPE/src/MobiVmLinkAudit.java"
# java.nio.file et UncheckedIOException minimaux, java.util.function (signatures attendues par MobiVM).
supply() { # dossier-sources jar
  rm -rf "$WORK/supply" && mkdir -p "$WORK/supply"
  (cd "$1" && javac -nowarn --patch-module java.base=. --release 17 -d "$WORK/supply" $(find . -name '*.java'))
  (cd "$WORK/supply" && jar cf "$2" .)
}
supply "$PIPE/java-supply/src" "$NIO_JAR"
supply "$PIPE/java-function-stubs/src" "$FUNC_JAR"
install_jar() { # dépôt groupId artifactId version fichier
  "${MVN[@]}" install:install-file -Dmaven.repo.local="$1" -Dpackaging=jar \
    -DgroupId="$2" -DartifactId="$3" -Dversion="$4" -Dfile="$5"
}
# Versions d'origine dans le dépôt habituel : le module ios se résout et se compile contre elles.
install_jar "$M2" net.sourceforge.streamsupport streamsupport "$SS_VER" "$SS_JAR"
install_jar "$M2" net.sourceforge.streamsupport streamsupport-cfuture "$SS_VER" "$SSCF_JAR"
install_jar "$M2" xyz.wagyourtail.jvmdowngrader jvmdowngrader-java-api "$JVMDG_VER-mobivm" "$API8_JAR"
install_jar "$M2" forge.stubs java-nio-supply 1.0 "$NIO_JAR"
install_jar "$M2" forge.stubs java-function-stubs 1.0 "$FUNC_JAR"
install_jar "$M2" forge.stubs java-time-supply 1.0 "$THREETEN_JAR"

echo "=== [2/7] sources de forge.compat (cibles de la réécriture) et ressources ==="
rm -rf "$IOS/build/forge-compat" "$IOS/build/forge"
mkdir -p "$IOS/build/forge-compat/forge" "$IOS/build/forge"
cp -R "$FORGE/forge-gui-ios/src/forge/compat" "$IOS/build/forge-compat/forge/"
cp -R "$ASSETS/res" "$IOS/build/forge/res"
sed -i.bak "s/^app\.version=.*/app.version=$VERSION/" "$IOS/robovm.properties" && rm -f "$IOS/robovm.properties.bak"

echo "=== [3/7] classpath du module ios ==="
(cd "$IOS" && "${MVN[@]}" dependency:build-classpath -Dmdep.outputFile="$WORK/classpath.txt")
TRANSFORM=()
KEEP=()
while IFS= read -r j; do
  # Comme forge-gui-ios : MobiVM tel quel ; java.time remplacé plus bas ; tout le reste converti.
  case "$j" in
    */robovm-*) KEEP+=("$j") ;;
    */forge/stubs/java-time-supply/*) ;;
    *) TRANSFORM+=("$j") ;;
  esac
done < <(tr ':' '\n' < "$WORK/classpath.txt")
FULL_CP="$(tr -d '\n' < "$WORK/classpath.txt")"
echo "à convertir : ${#TRANSFORM[@]} jars, tels quels : ${#KEEP[@]}"

echo "=== [4/7] conversion en Java 8 puis pour MobiVM ==="
rm -rf "$WORK/dg" "$WORK/out" "$CLONE"
mkdir -p "$WORK/dg" "$WORK/out"
cp -R "$M2" "$CLONE"
for j in "${TRANSFORM[@]}"; do
  java -jar "$JVMDG_JAR" -q -c 52 downgrade -t "$j" "$WORK/dg/$(basename "$j")" -cp "$FULL_CP" 2>&1 | grep -v '^\[' || true
done
# ThreeTen (java.time pour Java 7) déplacé dans java.time.*, avec sa base de fuseaux horaires.
java -cp "$TOOLS_CP" MobiVmBridge --rules "$PIPE/relocate-time.cfg" --index "$RT" \
  --in "$THREETEN_JAR" --out "$WORK/java-time-supply.jar" | tail -1
(cd "$WORK" && unzip -oq java-time-supply.jar org/threeten/bp/TZDB.dat \
  && mkdir -p java/time && cp org/threeten/bp/TZDB.dat java/time/TZDB.dat \
  && jar -uf java-time-supply.jar java/time/TZDB.dat && rm -rf org java)
DG_JARS="$(ls "$WORK"/dg/*.jar | tr '\n' ',' | sed 's/,$//')"
KEEP_CS="$(IFS=,; echo "${KEEP[*]}")"
INDEX="$RT,$OBJC,$CT,$SS_JAR,$SSCF_JAR,$API8_JAR,$WORK/java-time-supply.jar,$NIO_JAR,$KEEP_CS,$DG_JARS"
BRIDGE_ARGS=()
for j in "$WORK"/dg/*.jar; do
  BRIDGE_ARGS+=(--in "$j" --out "$WORK/out/$(basename "$j")")
done
BRIDGE_ARGS+=(--in "$API8_JAR" --out "$WORK/out/jvmdg-java-api-mobivm.jar")
java -cp "$TOOLS_CP" MobiVmBridge --rules "$PIPE/bridge.cfg" --index "$INDEX" "${BRIDGE_ARGS[@]}" \
  > "$WORK/bridge-report.txt" 2>&1 || true
head -2 "$WORK/bridge-report.txt"
if grep -q 'BRIDGE-GATE-FAIL' "$WORK/bridge-report.txt"; then
  echo "Conversion incomplète (appel sans remplacement) :"
  grep -A50 'BRIDGE-GATE-FAIL' "$WORK/bridge-report.txt"
  exit 1
fi
# Classes d'exécution de JvmDowngrader appelées par ses remplacements (exc/*, util/*).
(cd "$WORK" && unzip -oq "$JVMDG_JAR" 'xyz/wagyourtail/jvmdg/exc/*' 'xyz/wagyourtail/jvmdg/util/*' \
  && jar -uf out/jvmdg-java-api-mobivm.jar xyz && rm -rf xyz)
for j in "${TRANSFORM[@]}"; do
  cp "$WORK/out/$(basename "$j")" "$CLONE/${j#"$M2"/}"
done
install_jar "$CLONE" net.sourceforge.streamsupport streamsupport "$SS_VER" "$SS_JAR"
install_jar "$CLONE" net.sourceforge.streamsupport streamsupport-cfuture "$SS_VER" "$SSCF_JAR"
install_jar "$CLONE" xyz.wagyourtail.jvmdowngrader jvmdowngrader-java-api "$JVMDG_VER-mobivm" "$WORK/out/jvmdg-java-api-mobivm.jar"
install_jar "$CLONE" forge.stubs java-time-supply 1.0 "$WORK/java-time-supply.jar"
install_jar "$CLONE" forge.stubs java-nio-supply 1.0 "$NIO_JAR"

echo "=== [5/7] module ios : compilation puis même conversion ==="
(cd "$IOS" && "${MVN[@]}" clean compile)
(cd "$IOS/target" && jar cf ios-raw.jar -C classes . \
  && java -jar "$JVMDG_JAR" -q -c 52 downgrade -t ios-raw.jar ios-dg.jar -cp "$FULL_CP:$SS_JAR:$SSCF_JAR:$NIO_JAR" 2>&1 | grep -v '^\[' || true)
OUT_JARS="$(ls "$WORK"/out/*.jar | tr '\n' ',' | sed 's/,$//')"
java -cp "$TOOLS_CP" MobiVmBridge --rules "$PIPE/bridge.cfg" \
  --index "$RT,$OBJC,$CT,$SS_JAR,$SSCF_JAR,$WORK/java-time-supply.jar,$NIO_JAR,$OUT_JARS,$IOS/target/ios-dg.jar" \
  --in "$IOS/target/ios-dg.jar" --out "$IOS/target/ios-bridged.jar" > "$WORK/ios-bridge-report.txt" 2>&1 || true
if grep -q 'BRIDGE-GATE-FAIL' "$WORK/ios-bridge-report.txt"; then
  echo "Conversion incomplète (module ios) :"
  grep -A50 'BRIDGE-GATE-FAIL' "$WORK/ios-bridge-report.txt"
  exit 1
fi
rm -rf "$IOS/target/classes" && mkdir -p "$IOS/target/classes"
(cd "$IOS/target/classes" && jar xf ../ios-bridged.jar && rm -rf META-INF)

echo "=== [6/7] liens manquants (rapport) ==="
java -cp "$TOOLS_CP" MobiVmLinkAudit \
  --rt "$RT,$OBJC,$CT,$SS_JAR,$SSCF_JAR,$WORK/out/jvmdg-java-api-mobivm.jar,$WORK/java-time-supply.jar,$NIO_JAR,$KEEP_CS,$OUT_JARS,$IOS/target/ios-bridged.jar" \
  --scan "$OUT_JARS,$IOS/target/ios-bridged.jar" > "$WORK/audit-report.txt" 2>&1 || true
head -3 "$WORK/audit-report.txt"

if [ -n "${IOS_SKIP_NATIVE:-}" ]; then
  echo "Conversion seule (IOS_SKIP_NATIVE) : rapports dans $WORK"
  exit 0
fi

echo "=== [7/7] compilation native et IPA ==="
# Les classes du module (déjà converties) sont prises telles quelles dans target/classes.
(cd "$IOS" && mvn -B robovm:create-ipa -Dmaven.repo.local="$CLONE" -Drobovm.iosSkipSigning=true)
IPA="$(find "$IOS/target" -name '*.ipa' -newer "$IOS/target/ios-bridged.jar" | head -1)"
[ -n "$IPA" ] || { echo "IPA introuvable"; exit 1; }

# Version du SDK inscrite dans l'exécutable : 26 au plus. Avec un SDK plus récent, iOS 27 exige le cycle de vie
# UIScene (comme forge-gui-ios), puis signature ad hoc renouvelée.
STAGE="$WORK/ipa"
rm -rf "$STAGE" && mkdir -p "$STAGE" && (cd "$STAGE" && unzip -q "$IPA")
APP="$(ls -d "$STAGE"/Payload/*.app | head -1)"
EXE="$APP/$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP/Info.plist")"
SDK_MAJOR="$(xcrun --sdk iphoneos --show-sdk-version | cut -d. -f1)"
if [ "$SDK_MAJOR" -gt 26 ]; then
  vtool -set-build-version 2 15.0 26.0 -replace -output "$EXE.tmp" "$EXE" && mv -f "$EXE.tmp" "$EXE"
  codesign --force --sign - --timestamp=none "$APP"
fi
rm -f "$OUT_IPA"
(cd "$STAGE" && zip -qry "$OUT_IPA" Payload)
echo "IPA prêt : $OUT_IPA ($(du -h "$OUT_IPA" | cut -f1))"
