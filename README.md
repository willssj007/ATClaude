# Arcane Table

Magic: The Gathering contre l'IA, sur Android et Windows, avec le moteur **Forge** pour les règles et l'automatisation, une base de toutes les cartes en français et en anglais, et un deck builder pensé pour le Commander.

## Télécharger

Chaque push sur `main` construit l'application et la publie dans la release **[apk-latest](https://github.com/willssj007/ATClaude/releases/tag/apk-latest)** :

- **Android** : sur le téléphone, ouvrir ce lien, télécharger le fichier `.apk`, l'ouvrir et autoriser l'installation depuis cette source si Android le demande.
- **Windows** : télécharger le `.zip` (il arrive quelques minutes après l'APK), le décompresser dans un dossier de votre choix (pas dans « Program Files »), puis lancer `ArcaneTable.exe`. Java est inclus. Une petite fenêtre s'ouvre et l'interface s'affiche dans le navigateur ; fermer cette fenêtre arrête l'application.

Toutes les versions sont signées avec la même clé (`android/app/arcane-debug.keystore`) : une nouvelle version s'installe par-dessus l'ancienne sans perdre les decks.

Au premier lancement, l'application installe les cartes (une trentaine de secondes) puis Forge charge sa base (quelques dizaines de secondes selon le téléphone).

## Ce que fait l'application

- **Partie contre l'IA de Forge**, de 2 à 4 joueurs (vous + 1 à 3 IA), en Commander (40 PV, zone de commandement, taxe et blessures de commandant) ou en Construit. Toutes les règles sont appliquées par Forge.
- **Salon** : format, nombre de joueurs, deck et profil d'IA de chaque place. Decks possibles : les vôtres, les 180 préconstruits Commander fournis par Forge, ou un deck aléatoire généré par Forge.
- **Plateau animé** : cartes qui volent de la main à la pile puis au champ de bataille, flèches d'attaque, de blocage et de ciblage, bannière de tour, variations de points de vie, cartes jouables en surbrillance comme sur Arena.
- **Priorité** : bouton « Garder la priorité » (sinon vos sorts se résolvent sans s'arrêter, comme sur Arena), passage automatique quand vous ne pouvez rien faire, arrêts de phase réglables, « Fin du tour ».
- **Menu de triche** : ajouter du mana, se donner une carte (main, champ de bataille, bibliothèque, cimetière, exil), piocher, changer les points de vie, terminer le tour en cours, faire passer le prochain tour d'un adversaire, dégager ses permanents, voir les cartes cachées, terrains illimités, marqueurs, jetons, gagner la partie. Chaque action vise le joueur choisi.
- **Navigateur de cartes** : toutes les cartes de Forge, recherche par nom français ou anglais (accents ignorés) ou dans le texte, filtres de couleur, de type, de valeur de mana et de légalité Commander.
- **Deck builder** : commandant (et partenaire), recherche limitée à l'identité de couleur du commandant, courbe de mana, validation par les règles de Forge, import d'une liste texte (Moxfield, Arena, Archidekt) ou d'un lien Moxfield public, export en texte.

## Architecture

```
ui/          Interface (HTML, CSS, JavaScript sans dépendance), la même partout
bridge/      Pont Java : implémente l'interface graphique attendue par Forge et échange du JSON avec ui/
desktop/     Hôte ordinateur : Forge + serveur HTTP sur 127.0.0.1, l'interface s'ouvre dans le navigateur
android/     Application Android : Forge + WebView, l'interface est servie depuis l'APK
scripts/     Compilation de Forge, emballage des ressources, construction de l'APK
legacy/      Phase 1 en Python (base SQLite depuis Scryfall), remplacée par la base de Forge
```

Forge tourne dans l'application : aucun serveur n'est nécessaire. L'interface envoie les clics (carte, joueur, OK, Annuler, triche…) au pont, qui les transmet au contrôleur du joueur humain de Forge ; Forge renvoie l'état de la partie et ses questions (cibles, choix, ordre des déclencheurs, répartition des blessures), que l'interface affiche.

La version de Forge utilisée est fixée dans `forge.commit`.

## Lancer sur ordinateur (développement)

Il faut Java 17 ou plus et Maven.

```bash
scripts/build-forge.sh ~/forge-src            # récupère et compile Forge (une fois)
mvn -B install -DskipTests                    # compile le pont et l'hôte
scripts/package-res.sh ~/forge-src/forge-gui/res forge-assets
java -Xmx3g -jar desktop/target/desktop-0.1.0.jar --assets forge-assets --ui ui
```

L'interface s'ouvre sur http://127.0.0.1:8765/. Les decks et réglages sont dans `~/.atclaude`. L'option `--mobile` démarre Forge exactement comme sur Android, pour tester ce chemin sur ordinateur.

## Construire l'APK en local

Avec en plus Gradle 8.9 ou plus et le SDK Android (`ANDROID_HOME`) : `scripts/build-android.sh ~/forge-src`.

## Limites connues

- **Non testé sur un vrai téléphone** : l'APK est construit par GitHub Actions, mais l'environnement de développement n'avait ni SDK Android ni émulateur. Le code Android a été compilé contre l'API 35 ; le moteur et l'interface ont été testés ensemble sur ordinateur (parties à 2 et 4 joueurs, triche, deck builder, import).
- **Images des cartes** : téléchargées depuis Scryfall au premier affichage puis gardées en cache. Le téléchargement n'a pas pu être testé (Scryfall était bloqué dans l'environnement de développement) ; sans réseau, les cartes s'affichent avec un cadre dessiné.
- **Lien Moxfield** : Moxfield n'a pas d'API publique officielle. L'import par lien peut être refusé ; l'import par texte (Moxfield > Exporter > Copier en texte) marche toujours.
- **Traduction** : les cartes, les types et la plupart des invites sont en français (traductions de Forge). Certaines invites de Forge et le texte des sorts sur la pile restent en anglais.
- **Partie à 1 joueur** (bac à sable sans adversaire) : pas encore proposée.
- **Windows** : le paquet est construit par GitHub Actions mais n'a pas été essayé sur un vrai Windows ; l'interface s'ouvre dans le navigateur plutôt que dans une fenêtre dédiée.
- **Version web** (deck builder et navigateur de cartes, sans partie, puisque Forge ne tourne pas dans un navigateur) : pas encore faite.

## Licences

Forge est distribué sous licence GPL-3.0 ; l'application l'embarque, l'APK distribué est donc soumis à la GPL-3.0 (le code source de ce dépôt doit rester disponible). Images des cartes : Scryfall.

Arcane Table n'est ni produit ni approuvé par Wizards of the Coast. Magic: The Gathering est une marque de Wizards of the Coast LLC.
