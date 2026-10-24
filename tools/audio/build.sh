#!/usr/bin/env bash
# Rend les musiques et les bruitages d'Arcane Table, puis les encode en MP3 dans ui/snd/ :
#   ui/snd/music/*.mp3, ui/snd/fx/*.mp3, et ui/snd/music.json (morceaux des menus et des parties).
# Nécessite Python 3 avec numpy, scipy et numba, et ffmpeg (libmp3lame).
#
# Usage : tools/audio/build.sh [nom de morceau...]   (sans argument : tout)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../../ui/snd"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT/music" "$OUT/fx"

(cd "$HERE" && python3 music.py "$TMP/music" "$@")
for wav in "$TMP"/music/*.wav; do
  name="$(basename "$wav" .wav)"
  ffmpeg -loglevel error -y -i "$wav" -map_metadata -1 -codec:a libmp3lame -q:a 5 "$OUT/music/$name.mp3"
done

if [ $# -eq 0 ]; then
  (cd "$HERE" && python3 sfx.py "$TMP/fx")
  rm -f "$OUT"/fx/*.mp3
  for wav in "$TMP"/fx/*.wav; do
    name="$(basename "$wav" .wav)"
    ffmpeg -loglevel error -y -i "$wav" -map_metadata -1 -ac 1 -codec:a libmp3lame -q:a 4 "$OUT/fx/$name.mp3"
  done
fi

# Liste des morceaux, avec une empreinte de chaque fichier (le cache de la version iPhone suit les changements).
python3 - "$OUT" <<'PY'
import hashlib, json, os, sys
out = sys.argv[1]
MENUS = ['repos', 'clairiere', 'cloitre', 'fete']
MATCH = ['veillee', 'mages', 'brumes', 'marche']
TITLES = {'repos': 'Le Repos du Voyageur', 'clairiere': 'La Clairière aux Fées', 'cloitre': 'Le Cloître',
          'fete': 'La Fête du Village', 'veillee': "Veillée d'Armes", 'mages': 'Le Duel des Mages',
          'brumes': "Les Brumes d'Avalon", 'marche': 'La Marche des Bannières'}
def entry(n):
    p = os.path.join(out, 'music', n + '.mp3')
    h = hashlib.sha256(open(p, 'rb').read()).hexdigest()[:10]
    return {'path': f'music/{n}.mp3?v={h}', 'title': TITLES[n]}
json.dump({'menus': [entry(n) for n in MENUS], 'match': [entry(n) for n in MATCH]},
          open(os.path.join(out, 'music.json'), 'w'), ensure_ascii=False, indent=1)
PY
du -sh "$OUT"/music "$OUT"/fx
