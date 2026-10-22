#!/usr/bin/env python3
"""Répare la traduction française de Forge.

1. Apostrophes : Forge formate tous ses textes avec java.text.MessageFormat, pour qui une
   apostrophe simple ouvre une citation : « d'une » devient « dune ». On remplace chaque apostrophe
   isolée par l'apostrophe typographique (’), que MessageFormat laisse telle quelle. Les apostrophes
   doublées (''), déjà correctes, ne sont pas touchées.
2. Espaces : certaines phrases sont suivies d'un nom de carte collé par le code (« Sélectionnez les
   créatures à bloquer » + nom). L'anglais se termine alors par une espace que le français a perdue :
   on la remet.
3. Traductions fautives vues en partie (« Tourner 3 », « Étape de dessin », « Moi cast Foudre ») :
   remplacées par les termes officiels de Magic en français.
4. Noms de cartes : un « œ » mal encodé (« Ranc½ur ») dans cardnames-fr-FR.txt.

Usage : fix-french.py DOSSIER_RES
"""

import re
import sys
from pathlib import Path

LONE_APOSTROPHE = re.compile(r"(?<!')'(?!')")

# Valeurs écrites telles quelles (apostrophe typographique, espaces finales voulues).
OVERRIDES = {
    "lblCast": "lance",
    "lblTriggered": "déclenche",
    "lblActivated": "active",
    "lblLogTurnNOwnerByPlayer": "Tour {0} ({1})",
    "lblStack": "Pile",
    "lblTap": "engager",
    "lblDrawStep": "Étape de pioche",
    "lblDrawOrder": "Ordre de pioche",
    "lblEndStep": "Étape de fin",
    "lblCombatBeginStep": "Étape de début de combat",
    "lblCombatFirstStrikeDamageStep": "Étape des dégâts de l’initiative",
    "lblCombatEndStep": "Étape de fin de combat",
    "lblPhasedOut": "Hors phase",
    "lblPhasedIn": "Intégré",
    "lblTurnFaceUp": "Retourner face visible",
    "lblLogPlayerAssignedBlockerToBlockAttacker": "{0} bloque {2} avec {1}.",
    "lblLogPlayerAssignedAttackerToAttackTarget": "{0} attaque {2} avec {1}.",
    "lblLogCardAbilityFizzles": "La capacité de {0} est contrecarrée (cibles illégales).",
    "lblSelectOneDifferentNameCardToDiscardAlreadyChosen":
        "Sélectionnez une des cartes avec un nom différent à défausser. Déjà choisies : ",
    "lblSelectOneOfCardsToTapAlreadyChosen": "Sélectionnez une des cartes à engager. Déjà choisies : ",
    "lblLogPlayerLifeChange": "Points de vie de {0} : {1} → {2}",
    "lblLogSourceDealsNDamageOfTypeToDest": "{0} inflige {1} blessure(s) ({2}) à {3}{4}.",
    "lblSourceDealsNDamageToDest": "{0} inflige {1} blessure(s){2} à {3}.",
    "lblLogZoneChange": "{0} : {2} → {1}.",
}


def read_values(path):
    values = {}
    for line in path.read_text(encoding="utf-8").split("\n"):
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            values[key.strip()] = value
    return values


def fix(res_dir):
    languages = Path(res_dir) / "languages"
    english = read_values(languages / "en-US.properties")
    path = languages / "fr-FR.properties"
    lines = path.read_text(encoding="utf-8").split("\n")
    changed = 0
    for i, line in enumerate(lines):
        if "=" not in line or line.lstrip().startswith("#"):
            continue
        key, value = line.split("=", 1)
        fixed = OVERRIDES.get(key.strip(), LONE_APOSTROPHE.sub("’", value))
        if english.get(key.strip(), "").endswith(" ") and fixed.strip() and not fixed.endswith(" "):
            fixed += " "
        if fixed != value:
            lines[i] = key + "=" + fixed
            changed += 1
    path.write_text("\n".join(lines), encoding="utf-8")

    names = languages / "cardnames-fr-FR.txt"
    text = names.read_text(encoding="utf-8")
    if "½" in text:
        changed += text.count("½")
        names.write_text(text.replace("½", "œ"), encoding="utf-8")
    return changed


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    print(f"{fix(sys.argv[1])} lignes corrigées")
