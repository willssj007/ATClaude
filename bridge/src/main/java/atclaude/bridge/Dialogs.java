package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import forge.game.GameEntityView;
import forge.game.GameView;
import forge.game.card.CardView;
import forge.game.player.PlayerView;
import forge.game.spellability.SpellAbilityView;
import forge.item.PaperCard;
import forge.util.FSerializableFunction;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Dialogues bloquants : chaque méthode envoie une question à l'interface et attend sa réponse.
 *
 * Les options sont envoyées comme une liste d'éléments ({@code label}, et la carte ou le joueur
 * quand il y en a un) ; l'interface répond par des indices dans cette liste.
 */
final class Dialogs {

    private final Bridge bridge;
    private final Supplier<BridgeGuiGame> gui;

    Dialogs(final Bridge bridge, final Supplier<BridgeGuiGame> gui) {
        this.bridge = bridge;
        this.gui = gui;
    }

    // ------------------------------------------------------------------ encodage

    private <T> JsonArray items(final Collection<T> choices, final FSerializableFunction<T, String> display) {
        final JsonArray list = new JsonArray();
        if (choices == null) {
            return list;
        }
        final BridgeGuiGame g = gui.get();
        final GameView gv = g == null ? null : g.getGameView();
        for (final T choice : choices) {
            final JsonObject item = new JsonObject();
            item.addProperty("label", Texts.clean(label(choice, display)));
            if (choice instanceof CardView card && g != null) {
                item.add("card", new GameSerializer(g).card(card, gv));
            } else if (choice instanceof PlayerView player) {
                item.addProperty("player", player.getId());
            } else if (choice instanceof SpellAbilityView sa && sa.getHostCard() != null && g != null) {
                item.add("card", new GameSerializer(g).card(sa.getHostCard(), gv));
            } else if (choice instanceof PaperCard paper) {
                item.add("paper", Catalog.paperJson(paper));
            }
            list.add(item);
        }
        return list;
    }

    private static <T> String label(final T choice, final FSerializableFunction<T, String> display) {
        if (choice == null) {
            return "";
        }
        if (display != null) {
            return display.apply(choice);
        }
        if (choice instanceof CardView card && card.getCurrentState() != null) {
            return GameSerializer.translatedName(card.getCurrentState());
        }
        if (choice instanceof PlayerView player) {
            return player.getLobbyPlayerName();
        }
        return choice.toString();
    }

    private static List<Integer> indices(final JsonElement answer) {
        final List<Integer> list = new ArrayList<>();
        if (answer != null && answer.isJsonArray()) {
            for (final JsonElement e : answer.getAsJsonArray()) {
                list.add(e.getAsInt());
            }
        }
        return list;
    }

    private static <T> List<T> pick(final List<T> source, final List<Integer> indices) {
        final List<T> picked = new ArrayList<>();
        for (final int i : indices) {
            if (i >= 0 && i < source.size() && !picked.contains(source.get(i))) {
                picked.add(source.get(i));
            }
        }
        return picked;
    }

    private static JsonObject dialog(final String title, final String message) {
        final JsonObject d = new JsonObject();
        d.addProperty("title", Texts.clean(title));
        d.addProperty("message", Texts.clean(message));
        return d;
    }

    // ------------------------------------------------------------------ dialogues

    /** Choisir entre {@code min} et {@code max} éléments. */
    <T> List<T> choose(final String title, final int min, final int max, final Collection<T> choices,
                       final Collection<T> selected, final FSerializableFunction<T, String> display) {
        return choose(title, min, max, choices, selected, display, null, null);
    }

    /**
     * Comme {@link #choose}, avec en plus des cartes montrées sans pouvoir être choisies (le reste de la
     * bibliothèque pendant une recherche), repliées sous un bouton.
     */
    <T> List<T> choose(final String title, final int min, final int max, final Collection<T> choices,
                       final Collection<T> selected, final FSerializableFunction<T, String> display,
                       final Collection<CardView> others, final String othersTitle) {
        final List<T> source = choices == null ? new ArrayList<>() : new ArrayList<>(choices);
        if (source.isEmpty()) {
            if (others != null && !others.isEmpty()) {
                // Rien à choisir (aucune carte valide) : on montre quand même ce qu'il y avait.
                reveal(othersTitle == null ? title : othersTitle, new ArrayList<>(others));
            }
            return new ArrayList<>();
        }
        final JsonObject d = dialog(title, "");
        if (others != null && !others.isEmpty()) {
            final List<CardView> rest = new ArrayList<>();
            for (final CardView c : others) {
                if (!source.contains(c)) {
                    rest.add(c);
                }
            }
            if (!rest.isEmpty()) {
                d.add("others", items(rest, null));
                d.addProperty("othersTitle", Texts.clean(othersTitle == null ? "" : othersTitle));
            }
        }
        d.addProperty("min", min);
        d.addProperty("max", max);
        d.add("items", items(source, display));
        final JsonArray preselected = new JsonArray();
        if (selected != null) {
            for (final T s : selected) {
                final int i = source.indexOf(s);
                if (i >= 0) {
                    preselected.add(i);
                }
            }
        }
        d.add("selected", preselected);
        final JsonElement answer = bridge.ask("choose", d);
        List<T> picked = pick(source, indices(answer));
        if (picked.size() < min) {
            // Partie abandonnée ou réponse invalide : on complète pour ne pas bloquer Forge.
            picked = new ArrayList<>(picked);
            for (final T item : source) {
                if (picked.size() >= min) {
                    break;
                }
                if (!picked.contains(item)) {
                    picked.add(item);
                }
            }
        }
        if (max >= 0 && picked.size() > max) {
            picked = picked.subList(0, max);
        }
        return picked;
    }

    <T> T one(final String title, final List<T> choices, final FSerializableFunction<T, String> display, final boolean optional) {
        final List<T> picked = choose(title, optional ? 0 : 1, 1, choices, null, display);
        return picked.isEmpty() ? null : picked.get(0);
    }

    /** Renvoie l'indice de l'option choisie, ou -1 si le dialogue est fermé. */
    int option(final String title, final String message, final List<String> options, final int defaultOption, final CardView card) {
        final JsonObject d = dialog(title, message);
        final JsonArray list = new JsonArray();
        for (final String o : options) {
            list.add(Texts.clean(o));
        }
        d.add("options", list);
        d.addProperty("default", defaultOption);
        final BridgeGuiGame g = gui.get();
        if (card != null && g != null) {
            d.add("card", new GameSerializer(g).card(card, g.getGameView()));
        }
        final JsonElement answer = bridge.ask("option", d);
        if (answer == null || answer.isJsonNull()) {
            return defaultOption;
        }
        return answer.getAsInt();
    }

    boolean confirm(final String title, final String message, final String yes, final String no, final boolean defaultYes, final CardView card) {
        return option(title, message, List.of(yes, no), defaultYes ? 0 : 1, card) == 0;
    }

    String input(final String title, final String message, final String initial, final List<String> options, final boolean numeric) {
        final JsonObject d = dialog(title, message);
        d.addProperty("initial", initial == null ? "" : initial);
        d.addProperty("numeric", numeric);
        if (options != null && !options.isEmpty()) {
            final JsonArray list = new JsonArray();
            for (final String o : options) {
                list.add(o);
            }
            d.add("options", list);
        }
        final JsonElement answer = bridge.ask("input", d);
        if (answer == null || answer.isJsonNull()) {
            return null;
        }
        return answer.getAsString();
    }

    Integer integer(final String title, final int min, final int max) {
        final JsonObject d = dialog(title, "");
        d.addProperty("min", min);
        d.addProperty("max", max);
        final JsonElement answer = bridge.ask("integer", d);
        if (answer == null || answer.isJsonNull()) {
            return null;
        }
        final int value = answer.getAsInt();
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Ordonner : l'utilisateur fait passer des éléments de la liste source vers la liste choisie,
     * dans l'ordre voulu. Entre {@code remainingMin} et {@code remainingMax} éléments peuvent rester
     * dans la source (0 et 0 : tout doit être ordonné).
     */
    <T> List<T> order(final String title, final String top, final int remainingMin, final int remainingMax,
                      final List<T> source, final List<T> dest) {
        final List<T> all = new ArrayList<>(source);
        if (dest != null) {
            all.addAll(dest);
        }
        final JsonObject d = dialog(title, top);
        d.add("items", items(all, null));
        d.addProperty("sourceCount", source.size());
        d.addProperty("remainingMin", remainingMin);
        d.addProperty("remainingMax", remainingMax);
        final JsonElement answer = bridge.ask("order", d);
        final List<Integer> order = indices(answer);
        if (order.isEmpty() && (answer == null || answer.isJsonNull())) {
            final List<T> fallback = new ArrayList<>(dest == null ? List.of() : dest);
            if (remainingMax <= 0) {
                fallback.addAll(source);
            }
            return fallback;
        }
        return pick(all, order);
    }

    /** Résultat du regard : cartes laissées dessus (la première sera piochée en premier) et cartes déplacées. */
    record Arrangement<T>(List<T> top, List<T> moved) { }

    /**
     * Regard ou surveillance façon Arena : les cartes se glissent entre « dessus de la bibliothèque » et
     * « dessous » (ou « cimetière »), dans l'ordre voulu.
     */
    <T> Arrangement<T> arrange(final String title, final List<T> cards, final boolean toGraveyard) {
        final JsonObject d = dialog(title, "");
        d.add("items", items(cards, null));
        d.addProperty("topLabel", "Dessus de la bibliothèque");
        d.addProperty("movedLabel", toGraveyard ? "Cimetière" : "Dessous de la bibliothèque");
        d.addProperty("graveyard", toGraveyard);
        final JsonElement answer = bridge.ask("arrange", d);
        final List<T> top = new ArrayList<>();
        final List<T> moved = new ArrayList<>();
        if (answer != null && answer.isJsonObject()) {
            final JsonObject a = answer.getAsJsonObject();
            top.addAll(pick(cards, indices(a.get("top"))));
            moved.addAll(pick(cards, indices(a.get("moved"))));
        }
        // Réponse incomplète (partie abandonnée...) : les cartes oubliées restent dessus, dans l'ordre.
        for (final T c : cards) {
            if (!top.contains(c) && !moved.contains(c)) {
                top.add(c);
            }
        }
        return new Arrangement<>(top, moved);
    }

    <T> void reveal(final String title, final List<T> items) {
        final JsonObject d = dialog(title, "");
        d.add("items", items(items, null));
        bridge.ask("reveal", d);
    }

    void message(final String title, final String message) {
        bridge.sendEvent("notice", m -> {
            m.addProperty("title", Texts.clean(title));
            m.addProperty("message", Texts.clean(message));
        });
    }

    /** Répartition des blessures d'un attaquant entre ses bloqueurs (et le défenseur s'il a le piétinement). */
    Map<CardView, Integer> assignCombatDamage(final CardView attacker, final List<CardView> blockers, final int damage,
                                              final GameEntityView defender, final boolean maySkip) {
        final BridgeGuiGame g = gui.get();
        final GameSerializer serializer = new GameSerializer(g);
        final JsonObject d = dialog("Répartir les blessures", "");
        d.add("attacker", serializer.card(attacker, g.getGameView()));
        // Le joueur défenseur ne reçoit des blessures que si l'attaquant a le piétinement.
        final boolean trample = attacker.getCurrentState() != null && attacker.getCurrentState().hasTrample();
        final JsonArray list = new JsonArray();
        for (final CardView b : blockers) {
            final JsonObject o = serializer.card(b, g.getGameView());
            o.addProperty("lethal", b.getLethalDamage());
            list.add(o);
        }
        d.add("blockers", list);
        d.addProperty("damage", damage);
        d.addProperty("maySkip", maySkip);
        if (defender != null && trample) {
            d.addProperty("defender", defender.getId());
            d.addProperty("defenderName", Texts.clean(defender.toString()));
        }
        final JsonElement answer = bridge.ask("assignDamage", d);
        final Map<CardView, Integer> result = new HashMap<>();
        if (answer == null || !answer.isJsonObject()) {
            // Répartition par défaut : blessures mortelles dans l'ordre, le reste au dernier bloqueur.
            int left = damage;
            for (int i = 0; i < blockers.size(); i++) {
                final CardView b = blockers.get(i);
                final int amount = i == blockers.size() - 1 ? left : Math.min(left, Math.max(0, b.getLethalDamage()));
                result.put(b, amount);
                left -= amount;
            }
            return result;
        }
        final JsonObject map = answer.getAsJsonObject();
        for (final CardView b : blockers) {
            final JsonElement v = map.get(String.valueOf(b.getId()));
            result.put(b, v == null ? 0 : v.getAsInt());
        }
        if (defender != null && trample && map.has("defender")) {
            // Forge attend la part du joueur défenseur sous la clé null.
            result.put(null, map.get("defender").getAsInt());
        }
        return result;
    }

    /** Répartir une quantité entre plusieurs cibles (blessures divisées, compteurs, mana). */
    Map<Object, Integer> assignGeneric(final String title, final Map<Object, Integer> targets, final int amount,
                                       final boolean atLeastOne, final String amountLabel) {
        final List<Object> keys = new ArrayList<>(targets.keySet());
        final JsonObject d = dialog(title, amountLabel);
        d.add("items", items(keys, null));
        d.addProperty("amount", amount);
        d.addProperty("atLeastOne", atLeastOne);
        final JsonArray max = new JsonArray();
        for (final Object k : keys) {
            max.add(targets.get(k) == null ? amount : targets.get(k));
        }
        d.add("max", max);
        final JsonElement answer = bridge.ask("assignGeneric", d);
        final Map<Object, Integer> result = new LinkedHashMap<>();
        if (answer == null || !answer.isJsonArray()) {
            int left = amount;
            for (int i = 0; i < keys.size(); i++) {
                final int share = i == keys.size() - 1 ? left : (atLeastOne ? 1 : 0);
                result.put(keys.get(i), share);
                left -= share;
            }
            return result;
        }
        final JsonArray values = answer.getAsJsonArray();
        for (int i = 0; i < keys.size(); i++) {
            result.put(keys.get(i), i < values.size() ? values.get(i).getAsInt() : 0);
        }
        return result;
    }
}
