# Arcane Table Android wrapper — v0.6

WebView Android shell for Arcane Table, with Scryfall card search, deck building, Moxfield text/list import and Forge `.dck` deck exchange.

## Build APK
Open this folder in Android Studio with JDK 17 and Android SDK API 35, then use **Build > Build APK(s)**. Or upload the folder contents to a GitHub repository and run **Actions > Build Android APK**. No APK has been compiled in this environment.

## New in v0.6
- Opponent has a separately shuffled library and a hidden opening hand (currently seeded from the currently selected deck; import/build another deck first to use it as the current deck).
- Basic mana-cost payment for ordinary coloured, colourless and generic costs; unsupported or ambiguous costs (X, hybrid, Phyrexian and other special symbols) are rejected rather than silently treated as free.
- Basic land-play limit: one land per turn, during a main phase.
- Simple spell stack with manual top-of-stack resolution and a manual counter test.
- Automatic draw step for the local player's later turns and untap of the active player's permanents at turn start.

## Important rules limits
This is a deliberately limited rules MVP, **not** a rules-complete Magic engine. It does not yet implement all priority windows, target legality, triggered/static/activated abilities, replacement effects, layers, state-based actions, damage assignment and combat damage, alternate/additional costs, hybrid/Phyrexian mana, or complete multiplayer/Commander rules. Nonpermanent spell effects are not executed; resolving them currently moves them to the graveyard. The UI still lets users manipulate some zones manually, so do not treat it as a sanctioned-rules judge.

## Forge integration status
Forge is still **not embedded as Arcane Table's native rules engine**. The current project keeps `.dck` import/export and download links. A real integration requires adding and building compatible Forge modules, resolving dependency/licensing and Android packaging, then routing game actions through Forge's game state rather than this prototype state. No such native integration or APK build is claimed in this release. Forge project: https://github.com/Card-Forge/forge
