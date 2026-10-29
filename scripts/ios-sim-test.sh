#!/usr/bin/env bash
# Essai de l'application iPhone dans le simulateur (macOS, après scripts/build-ios.sh, qui a converti les classes) :
# compilation pour le simulateur, installation, lancement en mode essai (la page joue seule une partie, voir
# ui/js/autotest.js), captures d'écran régulières, puis le journal de l'application (app.log) et les rapports de
# plantage.
#
# Usage : scripts/ios-sim-test.sh DOSSIER_RÉSULTATS [DURÉE_EN_SECONDES]
#
# MobiVM 2.3.24 ne sait pas lancer les simulateurs arm64 (Mac Apple) : comme forge-gui-ios, on le laisse compiler
# (robovm:ipad-sim, arrêté dès que config.xml est écrit, après l'édition des liens), puis on assemble l'application
# avec son compilateur autonome et on la marque « simulateur iOS ».
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS="$ROOT/ios"
mkdir -p "$1"
OUT="$(cd "$1" && pwd)"
DURATION="${2:-480}"
CLONE="$IOS/build/m2"
TMPD="$IOS/target/robovm.tmp"
PROPS="$IOS/robovm.properties"
APP_ID="$(sed -n 's/^app\.id=//p' "$PROPS")"
APP_EXEC="$(sed -n 's/^app\.executable=//p' "$PROPS")"
MAIN="$(sed -n 's/^app\.mainclass=//p' "$PROPS")"
APP="$TMPD/sim/$APP_EXEC.app"

echo "=== compilation pour le simulateur (arm64) ==="
rm -f "$TMPD/config.xml"
mkdir -p "$TMPD"
set -m
(cd "$IOS" && mvn -B robovm:ipad-sim -Dmaven.repo.local="$CLONE" -Drobovm.arch=arm64-simulator > "$OUT/sim-build.log" 2>&1) &
MVN=$!
set +m
while kill -0 "$MVN" 2>/dev/null && [ ! -s "$TMPD/config.xml" ]; do sleep 5; done
sleep 3
kill -TERM -"$MVN" 2>/dev/null || true
wait "$MVN" 2>/dev/null || true
if [ ! -s "$TMPD/config.xml" ]; then
  echo "La compilation pour le simulateur a échoué :"
  tail -30 "$OUT/sim-build.log"
  exit 1
fi

echo "=== assemblage de l'application ==="
RVHOME="$(ls -d "$CLONE"/com/mobidevelop/robovm/robovm-dist/*/unpacked/robovm-* 2>/dev/null | sort | tail -1)"
CJ="$(ls "$CLONE"/com/mobidevelop/robovm/robovm-dist-compiler/*/robovm-dist-compiler-*.jar 2>/dev/null | sort | tail -1)"
sed -e "s/\${app.id}/$APP_ID/g" -e "s/\${app.executable}/$APP_EXEC/g" "$TMPD/config.xml" > "$TMPD/config-sim.xml"
rm -rf "$APP" && mkdir -p "$APP"
if ! ROBOVM_HOME="$RVHOME" java -cp "$CJ" org.robovm.compiler.AppCompiler -config "$TMPD/config-sim.xml" \
    -properties "$PROPS" -skipsign -d "$APP" "$MAIN" > "$OUT/sim-appcompiler.log" 2>&1; then
  echo "Assemblage impossible :"
  tail -20 "$OUT/sim-appcompiler.log"
  exit 1
fi
vtool -set-build-version 7 15.0 26.0 -replace -output "$APP/$APP_EXEC.sim" "$APP/$APP_EXEC" && mv -f "$APP/$APP_EXEC.sim" "$APP/$APP_EXEC"
codesign --force --sign - --timestamp=none "$APP" > /dev/null 2>&1
ls -la "$APP" | head -20 > "$OUT/sim-app.txt"

echo "=== simulateur ==="
UDID="$(xcrun simctl list devices available -j | python3 -c '
import json, sys
devs = json.load(sys.stdin)["devices"]
for rt in sorted(devs, reverse=True):
    if "iOS" in rt:
        for d in devs[rt]:
            if d["name"].startswith("iPhone"):
                print(d["udid"]); sys.exit()
')"
[ -n "$UDID" ] || { echo "Aucun simulateur d'iPhone"; exit 1; }
xcrun simctl list devices | grep "$UDID" | tee "$OUT/sim-device.txt"
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b > /dev/null
# Paysage : l'application ne s'affiche qu'en paysage hors des écrans des decks.
xcrun simctl ui "$UDID" appearance dark 2>/dev/null || true
xcrun simctl install "$UDID" "$APP"
START="$(date +%s)"
xcrun simctl launch "$UDID" "$APP_ID" -autotest | tee "$OUT/sim-launch.txt"
for t in 20 45 90 150 240 330 420 480 600; do
  [ "$t" -gt "$DURATION" ] && break
  now=$(( $(date +%s) - START ))
  [ "$t" -gt "$now" ] && sleep $(( t - now ))
  xcrun simctl io "$UDID" screenshot "$OUT/sim-$(printf '%03d' "$t")s.png" > /dev/null 2>&1 || true
  # Toujours en vie ?
  xcrun simctl spawn "$UDID" launchctl list 2>/dev/null | grep -q "$APP_ID" || { echo "L'application s'est arrêtée vers ${t} s"; break; }
done

echo "=== journaux ==="
DATA="$(xcrun simctl get_app_container "$UDID" "$APP_ID" data 2>/dev/null)"
cp "$DATA/Library/Application Support/atclaude/app.log" "$OUT/app.log" 2>/dev/null || echo "(pas de app.log)" > "$OUT/app.log"
xcrun simctl spawn "$UDID" log show --last 15m --style compact --predicate "process == \"$APP_EXEC\"" > "$OUT/sim-system.log" 2>/dev/null || true
cp ~/Library/Logs/DiagnosticReports/"$APP_EXEC"* "$OUT/" 2>/dev/null || true
# Le journal de l'application passe aussi par le journal système du simulateur (sorties standard).
grep -h 'autotest\|ÉCHEC\|erreur\|Exception' "$OUT/app.log" "$OUT/sim-system.log" | cut -c1-400 | head -120 > "$OUT/summary.txt" || true
cat "$OUT/summary.txt"
