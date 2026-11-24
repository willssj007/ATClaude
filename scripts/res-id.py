#!/usr/bin/env python3
"""Écrit res/atclaude-res.properties dans les ressources préparées par package-res.sh.

forge : le commit de Forge d'où viennent les ressources ; date : sa date ; id : l'empreinte du contenu (chemins et
octets de chaque fichier, et pour cardsfolder.zip le nom, la taille et le CRC de chaque script, sans les dates des
fichiers, qui changent à chaque construction). L'appli s'en sert pour savoir à quelle base de cartes s'appliquent les
mises à jour de données (voir DataUpdates.java et forge-data.py).

Usage : res-id.py DOSSIER_SORTIE COMMIT_FORGE [DATE_FORGE]
"""
import hashlib
import os
import sys
import zipfile

NAME = "atclaude-res.properties"


def content_id(res):
    h = hashlib.sha256()
    for top, dirs, files in os.walk(res):
        dirs.sort()
        for f in sorted(files):
            path = os.path.join(top, f)
            rel = os.path.relpath(path, res).replace(os.sep, "/")
            if rel == NAME:
                continue
            h.update(rel.encode("utf-8") + b"\0")
            if rel == "cardsfolder/cardsfolder.zip":
                with zipfile.ZipFile(path) as z:
                    for i in sorted(z.infolist(), key=lambda i: i.filename):
                        h.update(("%s %d %08x\n" % (i.filename, i.file_size, i.CRC)).encode("utf-8"))
            else:
                with open(path, "rb") as fh:
                    h.update(hashlib.sha256(fh.read()).digest())
    return h.hexdigest()


def main():
    out, commit = sys.argv[1], sys.argv[2].strip()
    date = sys.argv[3].strip() if len(sys.argv) > 3 else ""
    res = os.path.join(out, "res")
    ident = content_id(res)
    with open(os.path.join(res, NAME), "w", encoding="utf-8") as fh:
        fh.write("forge=%s\ndate=%s\nid=%s\n" % (commit, date, ident))
    print("Ressources : Forge %s, empreinte %s" % (commit[:12], ident[:12]))


if __name__ == "__main__":
    main()
