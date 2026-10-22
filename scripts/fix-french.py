#!/usr/bin/env python3
"""Répare les apostrophes de la traduction française de Forge.

Forge formate tous ses textes avec java.text.MessageFormat, pour qui une apostrophe simple
ouvre une citation : « d'une » devient « dune ». On remplace chaque apostrophe isolée par
l'apostrophe typographique (’), que MessageFormat laisse telle quelle. Les apostrophes doublées
(''), déjà correctes, ne sont pas touchées.

Usage : fix-french.py DOSSIER_RES
"""

import re
import sys
from pathlib import Path

LONE_APOSTROPHE = re.compile(r"(?<!')'(?!')")


def fix(res_dir):
    path = Path(res_dir) / "languages" / "fr-FR.properties"
    lines = path.read_text(encoding="utf-8").split("\n")
    changed = 0
    for i, line in enumerate(lines):
        if "=" not in line or line.lstrip().startswith("#"):
            continue
        key, value = line.split("=", 1)
        fixed = LONE_APOSTROPHE.sub("’", value)
        if fixed != value:
            lines[i] = key + "=" + fixed
            changed += 1
    path.write_text("\n".join(lines), encoding="utf-8")
    return changed


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    print(f"{fix(sys.argv[1])} lignes corrigées")
