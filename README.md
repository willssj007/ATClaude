# MTG App : phase 1, données et règles

Application Magic: The Gathering (web, Windows, Android) pour un usage personnel et entre amis.

Cette phase pose les fondations qui ne dépendent ni de Forge ni de l'interface : la base de cartes FR/EN, la recherche, les règles Commander et la lecture des listes de deck.

## Décisions actuelles

- **Usage** : personnel ou entre amis.
- **Jouer partout** : le moteur tourne sur un serveur joignable depuis Internet, et les clients (web, Windows, Android) s'y connectent. Le téléphone ne fait pas tourner le moteur.
- **Forge** (GPL-3.0) reste sur le serveur et n'est pas embarqué dans les applications clientes.
- **Cartes** : export « All Cards » de Scryfall. C'est le seul export qui contient les impressions françaises.

## Structure

```
data/
  schema.sql             schéma de la base SQLite
  import_scryfall.py     import de l'export Scryfall, lu ligne par ligne
  repository.py          recherche par nom FR/EN, recherche plein texte, lookup pour les decks
rules/
  models.py              Card et DeckLine
  commander.py           règles de construction Commander
  decklist.py            lecture des listes de deck au format texte
tests/
  fixtures/sample_bulk.json   jeu d'essai de 14 entrées (pas un extrait officiel de Scryfall)
  test_*.py                   31 tests, sans réseau
```

## Utilisation

```bash
# 1. Télécharger « All Cards » (JSON) : https://scryfall.com/docs/api/bulk-data
# 2. Construire la base locale (plusieurs minutes sur un gros export)
python3 data/import_scryfall.py all-cards.json data/cards.sqlite
# 3. Lancer les tests
python3 -m unittest discover -s tests -v
```

Python 3.8 ou plus, sans dépendance externe.

## Règles Commander couvertes

- **Taille** : 100 cartes, commandant compris.
- **Singleton**, avec les exceptions : cartes de base, « any number of cards », « up to N cards ».
- **Légalité** : les cartes interdites ou non légales sont refusées.
- **Identité de couleur** : chaque carte doit tenir dans l'identité du commandant (union des deux pour un duo).
- **Commandant** : créature légendaire, ou texte « can be your commander ».
- **Partenaires** : « Partner » simple et « Partner with X ».

Non couverts pour l'instant : Background, Friends forever, Doctor's companion, Partner—Survivors et Partner—Father & Son.

## Limites connues

- L'import attend un objet JSON par ligne, comme les exports Scryfall. Ce format n'a pas été vérifié sur le vrai fichier, car l'environnement de développement n'a pas d'accès réseau. Le script signale toute ligne non conforme.
- Le format texte Moxfield est lu de façon tolérante (sections « Commander » et « Deck », tag `*CMDR*`), mais il n'a pas encore été validé sur un export réel.
- Une carte à deux faces s'écrit avec ses deux noms, « Avant // Arrière », comme dans les exports.
- Les comparaisons exactes de noms ignorent la casse, mais SQLite ne replie que les lettres ASCII : « É » et « é » ne sont pas considérés comme identiques dans ces comparaisons. La recherche plein texte, elle, ignore les accents.
- Cette phase ne couvre ni le jeu, ni le serveur, ni l'interface.

## Prochaines étapes

1. Tester l'import sur le vrai export « All Cards » et noter le temps de traitement et la taille de la base.
2. Valider la lecture d'un export Moxfield réel.
3. Serveur de partie : brancher Forge, exposer les parties, gérer les comptes et un accès sécurisé. Le serveur, sans doute en Java pour Forge, pourra lire la même base SQLite.
4. Interface web : navigateur de cartes, deck builder, plateau de jeu.
