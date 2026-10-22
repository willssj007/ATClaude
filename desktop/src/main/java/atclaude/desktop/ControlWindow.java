package atclaude.desktop;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import javax.swing.WindowConstants;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.FlowLayout;
import java.awt.Font;
import java.util.function.Consumer;

/**
 * Petite fenêtre affichée tant que l'application tourne : l'interface est dans le navigateur,
 * et fermer l'onglet n'arrête pas Forge. Ici, on peut rouvrir l'interface ou tout quitter.
 */
final class ControlWindow {

    private ControlWindow() { }

    static void show(final String url, final Consumer<String> browse) {
        SwingUtilities.invokeLater(() -> {
            final JFrame frame = new JFrame("Arcane Table");
            frame.setDefaultCloseOperation(WindowConstants.EXIT_ON_CLOSE);
            final JPanel panel = new JPanel(new BorderLayout(0, 12));
            panel.setBackground(new Color(0x0D0F1A));
            panel.setBorder(BorderFactory.createEmptyBorder(18, 22, 18, 22));
            final JLabel title = new JLabel("Arcane Table est lancé");
            title.setForeground(new Color(0xF6D78F));
            title.setFont(title.getFont().deriveFont(Font.BOLD, 18f));
            final JLabel text = new JLabel("<html>L'interface s'ouvre dans votre navigateur :<br>" + url
                    + "<br><br>Fermer cette fenêtre arrête le moteur et la partie en cours.</html>");
            text.setForeground(new Color(0xD8D4EA));
            final JPanel buttons = new JPanel(new FlowLayout(FlowLayout.RIGHT, 8, 0));
            buttons.setOpaque(false);
            final JButton open = new JButton("Ouvrir l'interface");
            open.addActionListener(e -> browse.accept(url));
            final JButton quit = new JButton("Quitter");
            quit.addActionListener(e -> System.exit(0));
            buttons.add(quit);
            buttons.add(open);
            panel.add(title, BorderLayout.NORTH);
            panel.add(text, BorderLayout.CENTER);
            panel.add(buttons, BorderLayout.SOUTH);
            frame.setContentPane(panel);
            frame.pack();
            frame.setLocationRelativeTo(null);
            frame.setVisible(true);
        });
    }
}
