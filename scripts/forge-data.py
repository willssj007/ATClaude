#!/usr/bin/env python3
"""Paquet de données de Forge pour l'appli (voir .github/workflows/forge-data.yml et DataUpdates.java).

  forge-data.py diff BASE LATEST BASE_CARDS LATEST_CARDS SORTIE
      BASE, LATEST : ressources préparées par package-res.sh (la base de l'appli, le dernier Forge).
      BASE_CARDS, LATEST_CARDS : les dossiers cardsfolder bruts des deux Forge.
      Écrit SORTIE/res/... (les fichiers à ajouter ou remplacer) et SORTIE/manifest.json.
  forge-data.py drop SORTIE RAPPORT.json
      Retire du paquet ce que la vérification (DataCheck) a refusé. Affiche le nombre de retraits.
  forge-data.py pack SORTIE PAQUET.zip FICHE.json
      Compresse le paquet (avec manifest.json) et écrit la fiche publiée à côté (empreinte, taille, résumé).

Ce qui change :
  - données (éditions, formats, boosters, listes, decks préconstruits, thèmes, traductions, classements, cubes) :
    fichiers nouveaux, modifiés ou retirés ;
  - scripts (cartes, jetons) : seulement les nouveaux. Un script modifié suit souvent un changement du moteur que
    l'appli n'a pas : la version de l'appli, faite pour son moteur, est gardée.
"""
import datetime
import hashlib
import json
import os
import shutil
import sys
import zipfile

DATA_DIRS = ["editions", "formats", "blockdata", "setlookup", "lists", "cube", "quest/commanderprecons",
             "quest/precons", "quest/themes", "languages", "draft/rankings"]
NEW_ONLY_DIRS = ["tokenscripts"]
# Textes de l'interface de Forge : liés à son code (une clé retirée manquerait au moteur de l'appli).
ENGINE_FILES = {"languages/en-US.properties", "languages/fr-FR.properties"}
DECK_DIRS = ["quest/commanderprecons/", "quest/precons/"]
PROPS = "atclaude-res.properties"


def files_under(root, sub):
    top = os.path.join(root, sub)
    out = {}
    if not os.path.isdir(top):
        return out
    for d, dirs, files in os.walk(top):
        dirs.sort()
        for f in sorted(files):
            p = os.path.join(d, f)
            out[os.path.relpath(p, root).replace(os.sep, "/")] = p
    return out


def root_files(root):
    return {f: os.path.join(root, f) for f in sorted(os.listdir(root)) if os.path.isfile(os.path.join(root, f)) and f != PROPS}


def same(a, b):
    if os.path.getsize(a) != os.path.getsize(b):
        return False
    with open(a, "rb") as x, open(b, "rb") as y:
        return x.read() == y.read()


def props(res):
    out = {}
    try:
        with open(os.path.join(res, PROPS), encoding="utf-8") as fh:
            for line in fh:
                if "=" in line:
                    k, v = line.rstrip("\n").split("=", 1)
                    out[k.strip()] = v.strip()
    except OSError:
        pass
    return out


def card_name(path):
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            for line in fh:
                if line.startswith("Name:"):
                    return line[5:].strip()
    except OSError:
        pass
    return None


def metadata(path):
    meta = {}
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            inside = False
            for line in fh:
                s = line.strip()
                if s.startswith("["):
                    if inside:
                        break
                    inside = s.lower() == "[metadata]"
                    continue
                if inside and "=" in s:
                    k, v = s.split("=", 1)
                    meta[k.strip()] = v.strip()
    except OSError:
        pass
    return meta


def diff(base, latest, base_cards, latest_cards, out):
    base_res, latest_res = os.path.join(base, "res"), os.path.join(latest, "res")
    bp, lp = props(base_res), props(latest_res)
    if os.path.exists(out):
        shutil.rmtree(out)
    os.makedirs(os.path.join(out, "res"))

    def put(rel, src):
        dst = os.path.join(out, "res", rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)

    changed, added, deleted = [], [], []
    for sub in DATA_DIRS:
        old, new = files_under(base_res, sub), files_under(latest_res, sub)
        for rel in ENGINE_FILES:
            old.pop(rel, None)
            new.pop(rel, None)
        for rel, p in new.items():
            if rel not in old:
                added.append(rel)
                put(rel, p)
            elif not same(old[rel], p):
                changed.append(rel)
                put(rel, p)
        deleted += [rel for rel in old if rel not in new]
    old, new = root_files(base_res), root_files(latest_res)
    for rel, p in new.items():
        if rel not in old:
            added.append(rel)
            put(rel, p)
        elif not same(old[rel], p):
            changed.append(rel)
            put(rel, p)

    tokens = []
    for sub in NEW_ONLY_DIRS:
        old, new = files_under(base_res, sub), files_under(latest_res, sub)
        for rel, p in new.items():
            if rel not in old:
                tokens.append(rel)
                put(rel, p)

    # Cartes : les nouveaux scripts dont le nom n'existe pas déjà (un fichier renommé garde la version de l'appli).
    base_files = files_under(base_cards, "")
    known = set()
    for p in base_files.values():
        n = card_name(p)
        if n:
            known.add(n.lower())
    cards = []
    for rel, p in files_under(latest_cards, "").items():
        if rel in base_files or not rel.endswith(".txt"):
            continue
        n = card_name(p)
        if not n or n.lower() in known:
            continue
        cards.append({"file": "cardsfolder/" + rel, "name": n})
        put("cardsfolder/" + rel, p)

    editions = []
    for rel in added:
        if rel.startswith("editions/"):
            m = metadata(os.path.join(latest_res, rel))
            if m.get("Code"):
                editions.append({"file": rel, "code": m["Code"], "name": m.get("Name", m["Code"]),
                                 "date": m.get("Date", ""), "type": m.get("Type", "")})
    precons = []
    for rel in added:
        if rel.startswith("quest/commanderprecons/"):
            m = metadata(os.path.join(latest_res, rel))
            precons.append({"file": rel, "name": m.get("Name", os.path.splitext(os.path.basename(rel))[0])})
    decks = [rel for rel in added + changed if any(rel.startswith(d) for d in DECK_DIRS)]

    manifest = {
        "format": 1,
        "base": bp.get("forge", ""), "baseDate": bp.get("date", ""), "baseId": bp.get("id", ""),
        "forge": lp.get("forge", ""), "forgeDate": lp.get("date", ""),
        "cards": cards, "tokens": tokens, "editions": editions, "precons": precons, "decks": decks,
        "added": added, "changed": changed, "deleted": deleted,
    }
    write_manifest(out, manifest)
    print("Paquet : %d cartes, %d jetons, %d éditions nouvelles, %d decks préconstruits nouveaux, "
          "%d fichiers de données ajoutés, %d modifiés, %d retirés"
          % (len(cards), len(tokens), len(editions), len(precons), len(added), len(changed), len(deleted)))


def write_manifest(out, manifest):
    with open(os.path.join(out, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)


def drop(out, report_path):
    with open(os.path.join(out, "manifest.json"), encoding="utf-8") as fh:
        manifest = json.load(fh)
    with open(report_path, encoding="utf-8") as fh:
        report = json.load(fh)
    if report.get("fatal"):
        sys.exit("Vérification impossible : " + report["fatal"])
    refused = {b["file"] for b in report.get("bad", [])}
    for rel in refused:
        p = os.path.join(out, "res", rel)
        if os.path.isfile(p):
            os.remove(p)
    removed_editions = {e["code"] for e in manifest["editions"] if e["file"] in refused}
    manifest["cards"] = [c for c in manifest["cards"] if c["file"] not in refused]
    manifest["tokens"] = [t for t in manifest["tokens"] if t not in refused]
    manifest["editions"] = [e for e in manifest["editions"] if e["code"] not in removed_editions]
    manifest["precons"] = [p for p in manifest["precons"] if p["file"] not in refused]
    manifest["decks"] = [d for d in manifest["decks"] if d not in refused]
    manifest["added"] = [a for a in manifest["added"] if a not in refused]
    # Un fichier de données modifié et refusé (deck préconstruit aux cartes inconnues) : la version de l'appli reste.
    manifest["changed"] = [c for c in manifest["changed"] if c not in refused]
    manifest.setdefault("refused", []).extend(report.get("bad", []))
    write_manifest(out, manifest)
    print(len(refused))


def pack(out, zip_path, fiche_path):
    with open(os.path.join(out, "manifest.json"), encoding="utf-8") as fh:
        manifest = json.load(fh)
    if os.path.exists(zip_path):
        os.remove(zip_path)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for d, dirs, files in os.walk(os.path.join(out, "res")):
            dirs.sort()
            for f in sorted(files):
                p = os.path.join(d, f)
                rel = os.path.relpath(p, out).replace(os.sep, "/")
                info = zipfile.ZipInfo(rel, date_time=(2020, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                with open(p, "rb") as fh:
                    z.writestr(info, fh.read(), compresslevel=9)
        z.writestr(zipfile.ZipInfo("manifest.json", date_time=(2020, 1, 1, 0, 0, 0)),
                   json.dumps(manifest, ensure_ascii=False, indent=1).encode("utf-8"), zipfile.ZIP_DEFLATED, 9)
    with open(zip_path, "rb") as fh:
        data = fh.read()
    fiche = {
        "format": manifest["format"],
        "base": manifest["base"], "baseDate": manifest["baseDate"],
        "forge": manifest["forge"], "forgeDate": manifest["forgeDate"],
        "built": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "zip": os.path.basename(zip_path), "size": len(data), "sha256": hashlib.sha256(data).hexdigest(),
        "deleted": manifest["deleted"],
        "summary": {
            "cards": len(manifest["cards"]), "tokens": len(manifest["tokens"]),
            "editions": len(manifest["editions"]), "precons": len(manifest["precons"]),
            "editionNames": [e["name"] for e in sorted(manifest["editions"], key=lambda e: e["date"], reverse=True)][:12],
            "preconNames": [p["name"] for p in manifest["precons"]][:24],
            "refused": len(manifest.get("refused", [])),
        },
    }
    with open(fiche_path, "w", encoding="utf-8") as fh:
        json.dump(fiche, fh, ensure_ascii=False, indent=1)
    print("%s : %d Ko, %d cartes" % (os.path.basename(zip_path), len(data) // 1024, len(manifest["cards"])))


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "diff" and len(sys.argv) == 7:
        diff(*sys.argv[2:7])
    elif cmd == "drop" and len(sys.argv) == 4:
        drop(*sys.argv[2:4])
    elif cmd == "pack" and len(sys.argv) == 5:
        pack(*sys.argv[2:5])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
