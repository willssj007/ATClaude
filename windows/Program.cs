using System;
using System.Threading;
using System.Windows.Forms;

namespace ArcaneTable
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            // Une seule fenêtre à la fois : deux moteurs Forge se disputeraient les mêmes fichiers (decks, sauvegardes).
            using (var mutex = new Mutex(true, "ArcaneTable-fenetre", out bool first))
            {
                if (!first)
                {
                    MessageBox.Show("Arcane Table est déjà ouvert.", "Arcane Table", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }
                Application.Run(new MainForm());
            }
        }
    }
}
