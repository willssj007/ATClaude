package atclaude.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import forge.game.GameType;
import forge.item.IPaperCard;
import forge.localinstance.achievements.Achievement;
import forge.localinstance.achievements.AchievementCollection;
import forge.localinstance.achievements.AltWinAchievements;
import forge.localinstance.achievements.CardActivationAchievements;
import forge.localinstance.achievements.ChallengeAchievements;
import forge.localinstance.achievements.PlaneswalkerAchievements;
import forge.model.FModel;

import java.util.List;

/**
 * Trophées : les succès de Forge (séries de victoires, victoires alternatives, ultimes de planeswalker,
 * défis...). Forge les met à jour à la fin de chaque partie sans triche et les enregistre lui-même.
 */
final class Trophies {

    private Trophies() { }

    static JsonObject all() {
        final JsonObject o = new JsonObject();
        final JsonArray collections = new JsonArray();
        int earned = 0;
        int total = 0;
        for (final AchievementCollection col : List.of(FModel.getAchievements(GameType.Constructed), ChallengeAchievements.instance,
                AltWinAchievements.instance, PlaneswalkerAchievements.instance, CardActivationAchievements.instance)) {
            final JsonObject c = new JsonObject();
            c.addProperty("name", col.toString());
            final JsonArray items = new JsonArray();
            for (final Achievement a : col) {
                final JsonObject i = new JsonObject();
                i.addProperty("key", a.getKey());
                i.addProperty("name", a.getDisplayName());
                i.addProperty("desc", a.getSharedDesc() == null ? "" : a.getSharedDesc());
                i.addProperty("special", a.isSpecial());
                final String level = a.isSpecial() ? (a.isActive() ? "special" : "")
                        : a.earnedMythic() ? "mythic" : a.earnedRare() ? "rare" : a.earnedUncommon() ? "uncommon" : a.earnedCommon() ? "common" : "";
                i.addProperty("level", level);
                if (!a.isSpecial()) {
                    final JsonArray tiers = new JsonArray();
                    tiers.add(tier("common", "Bronze", a.getCommonDesc(), a.earnedCommon()));
                    tiers.add(tier("uncommon", "Argent", a.getUncommonDesc(), a.earnedUncommon()));
                    tiers.add(tier("rare", "Or", a.getRareDesc(), a.earnedRare()));
                    tiers.add(tier("mythic", "Mythique", a.getMythicDesc(), a.earnedMythic()));
                    i.add("tiers", tiers);
                }
                final String sub = a.getSubTitle(true);
                if (sub != null) {
                    i.addProperty("best", sub);
                }
                final IPaperCard card = a.getPaperCard();
                if (card != null) {
                    i.addProperty("image", card.getImageKey(false));
                }
                total++;
                if (a.isActive()) {
                    earned++;
                }
                items.add(i);
            }
            c.add("items", items);
            collections.add(c);
        }
        o.add("collections", collections);
        o.addProperty("earned", earned);
        o.addProperty("total", total);
        return o;
    }

    private static JsonObject tier(final String key, final String label, final String desc, final boolean earned) {
        final JsonObject t = new JsonObject();
        t.addProperty("key", key);
        t.addProperty("label", label);
        t.addProperty("desc", desc == null ? "" : desc);
        t.addProperty("earned", earned);
        return t;
    }
}
