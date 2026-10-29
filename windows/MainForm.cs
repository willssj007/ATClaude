using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace ArcaneTable
{
    /// <summary>
    /// Fenêtre principale : démarre le moteur (Forge, en Java) sur un port libre de 127.0.0.1,
    /// attend qu'il réponde, puis affiche l'interface dans WebView2. Fermer la fenêtre arrête le moteur.
    /// </summary>
    internal sealed class MainForm : Form
    {
        private static readonly Color Background = Color.FromArgb(13, 15, 26);
        private static readonly Color Gold = Color.FromArgb(246, 215, 143);

        private readonly WebView2 web = new WebView2 { Dock = DockStyle.Fill, Visible = false, DefaultBackgroundColor = Background };
        private readonly Label status = new Label
        {
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleCenter,
            ForeColor = Gold,
            BackColor = Background,
            Font = new Font("Segoe UI", 13f),
            Text = "Démarrage d'Arcane Table…",
        };

        private readonly string dataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ArcaneTable");
        private Process engine;
        private StreamWriter log;
        private string logPath;
        private string baseUrl;
        private bool closing;
        private bool running;
        private bool restarting;
        private int restarts;
        private DateTime firstRestart;
        private FormWindowState stateBeforeFullscreen;
        private FormBorderStyle borderBeforeFullscreen;

        public MainForm()
        {
            Text = "Arcane Table";
            BackColor = Background;
            MinimumSize = new Size(900, 560);
            Size = new Size(1280, 800);
            StartPosition = FormStartPosition.CenterScreen;
            WindowState = FormWindowState.Maximized;
            using (var icon = typeof(MainForm).Assembly.GetManifestResourceStream("ArcaneTable.ico"))
            {
                if (icon != null)
                {
                    Icon = new Icon(icon);
                }
            }
            Controls.Add(web);
            Controls.Add(status);
            Shown += async (s, e) => await StartAsync();
            FormClosing += (s, e) => StopEngine();
        }

        // ------------------------------------------------------------------ barre de titre sombre (Windows 10 20H1 et plus)

        [DllImport("dwmapi.dll")]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            var dark = 1;
            try
            {
                if (DwmSetWindowAttribute(Handle, 20, ref dark, sizeof(int)) != 0)
                {
                    DwmSetWindowAttribute(Handle, 19, ref dark, sizeof(int)); // anciennes versions de Windows 10
                }
            }
            catch (DllNotFoundException)
            {
                // pas de DWM : barre de titre claire
            }
        }

        // ------------------------------------------------------------------ démarrage

        private async Task StartAsync()
        {
            try
            {
                Directory.CreateDirectory(dataDir);
                var port = PickPort();
                baseUrl = "http://127.0.0.1:" + port + "/";
                StartEngine(port);
                await WaitForEngineAsync(TimeSpan.FromMinutes(2));
                running = true;
                await ShowInterfaceAsync();
            }
            catch (WebView2RuntimeNotFoundException)
            {
                // WebView2 est inclus dans Windows 10 et 11 à jour ; sinon, l'interface s'ouvre dans le navigateur.
                status.Text = "Le composant Microsoft Edge WebView2 manque : Arcane Table s'est ouvert dans le navigateur.\n"
                              + "Garde cette fenêtre ouverte pendant que tu joues (la fermer arrête le moteur).";
                var answer = MessageBox.Show(this,
                    "Arcane Table a besoin du composant Microsoft Edge WebView2, fourni avec Windows 10 et 11 à jour.\n\n"
                    + "Ouvrir la page de téléchargement de Microsoft ? En attendant, l'application s'ouvre dans le navigateur.",
                    "Arcane Table", MessageBoxButtons.YesNo, MessageBoxIcon.Information);
                if (answer == DialogResult.Yes)
                {
                    OpenExternal("https://go.microsoft.com/fwlink/p/?LinkId=2124703");
                }
                OpenExternal(baseUrl);
            }
            catch (Exception ex)
            {
                Fail("Arcane Table n'a pas pu démarrer : " + ex.Message);
            }
        }

        private void StartEngine(int port)
        {
            var dir = AppDomain.CurrentDomain.BaseDirectory;
            var exe = Path.Combine(dir, "moteur", "ArcaneTableMoteur.exe");
            if (!File.Exists(exe))
            {
                throw new FileNotFoundException("moteur introuvable (" + exe + "). Décompresse tout le dossier ArcaneTable avant de lancer l'application.");
            }
            logPath = Path.Combine(dataDir, "moteur.log");
            log?.Dispose();
            // Après un arrêt imprévu, le journal de la fois d'avant est gardé à côté (moteur-precedent.log).
            if (restarts > 0 && File.Exists(logPath))
            {
                try
                {
                    File.Copy(logPath, Path.Combine(dataDir, "moteur-precedent.log"), true);
                }
                catch (IOException)
                {
                    // journal verrouillé : on écrase
                }
            }
            log = new StreamWriter(logPath, false) { AutoFlush = true };
            var psi = new ProcessStartInfo(exe, "--port " + port + " --no-browser --no-window")
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                StandardOutputEncoding = System.Text.Encoding.UTF8,
                StandardErrorEncoding = System.Text.Encoding.UTF8,
                WorkingDirectory = Path.GetDirectoryName(exe),
            };
            engine = new Process { StartInfo = psi, EnableRaisingEvents = true };
            engine.OutputDataReceived += (s, e) => Log(e.Data);
            engine.ErrorDataReceived += (s, e) => Log(e.Data);
            var process = engine;
            engine.Exited += (s, e) =>
            {
                if (!closing && running && !restarting && process == engine)
                {
                    BeginInvoke((Action)(async () => await RestartAsync()));
                }
            };
            engine.Start();
            engine.BeginOutputReadLine();
            engine.BeginErrorReadLine();
        }

        /// <summary>
        /// Arrêt imprévu du moteur (mémoire épuisée, plantage de Java) : on le relance et on recharge l'interface,
        /// qui reprend la partie sauvegardée. Au-delà de trois arrêts en dix minutes, on s'arrête là avec un message.
        /// </summary>
        private async Task RestartAsync()
        {
            if (closing)
            {
                return;
            }
            var code = SafeExitCode();
            if (restarts == 0 || DateTime.UtcNow - firstRestart > TimeSpan.FromMinutes(10))
            {
                restarts = 0;
                firstRestart = DateTime.UtcNow;
            }
            if (++restarts > 3)
            {
                Fail("Le moteur s'est arrêté plusieurs fois (code " + code + "). Relance Arcane Table ; si cela recommence, "
                     + "envoie le journal du moteur (moteur.log et moteur-precedent.log, dans le même dossier).");
                return;
            }
            restarting = true;
            web.Visible = false;
            status.Visible = true;
            status.Text = "Le moteur s'est arrêté (code " + code + ") : redémarrage…\nLa partie en cours reprendra là où elle a été sauvegardée.";
            try
            {
                var port = PickPort();
                baseUrl = "http://127.0.0.1:" + port + "/";
                StartEngine(port);
                await WaitForEngineAsync(TimeSpan.FromMinutes(2));
                if (web.CoreWebView2 != null)
                {
                    web.CoreWebView2.Navigate(baseUrl);
                    web.Visible = true;
                    status.Visible = false;
                }
                else
                {
                    await ShowInterfaceAsync();
                }
            }
            catch (Exception ex)
            {
                Fail("Arcane Table n'a pas pu redémarrer le moteur : " + ex.Message);
            }
            finally
            {
                restarting = false;
            }
        }

        private async Task WaitForEngineAsync(TimeSpan timeout)
        {
            var until = DateTime.UtcNow + timeout;
            using (var http = new HttpClient(new HttpClientHandler { UseProxy = false }) { Timeout = TimeSpan.FromSeconds(2) })
            {
                while (DateTime.UtcNow < until)
                {
                    if (engine.HasExited)
                    {
                        throw new InvalidOperationException("le moteur s'est arrêté au démarrage (code " + SafeExitCode() + ").");
                    }
                    try
                    {
                        using (var response = await http.GetAsync(baseUrl))
                        {
                            if (response.StatusCode == HttpStatusCode.OK)
                            {
                                return;
                            }
                        }
                    }
                    catch (HttpRequestException)
                    {
                        // pas encore à l'écoute
                    }
                    catch (TaskCanceledException)
                    {
                        // réponse trop lente : on réessaie
                    }
                    await Task.Delay(300);
                }
            }
            throw new TimeoutException("le moteur ne répond pas.");
        }

        private async Task ShowInterfaceAsync()
        {
            var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(dataDir, "WebView2"));
            await web.EnsureCoreWebView2Async(env);
            var core = web.CoreWebView2;
            var devTools = Environment.GetEnvironmentVariable("ARCANETABLE_DEVTOOLS") == "1";
            core.Settings.AreDevToolsEnabled = devTools;
            core.Settings.AreBrowserAcceleratorKeysEnabled = devTools; // pas d'impression, de recherche ni de rechargement par erreur
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsGeneralAutofillEnabled = false;
            core.Settings.IsPasswordAutosaveEnabled = false;
            // Liens externes (Cardmarket, Scryfall, GitHub...) : dans le navigateur, pas dans la fenêtre du jeu.
            core.NewWindowRequested += (s, e) =>
            {
                e.Handled = true;
                OpenExternal(e.Uri);
            };
            core.NavigationStarting += (s, e) =>
            {
                if (!e.Uri.StartsWith(baseUrl, StringComparison.OrdinalIgnoreCase))
                {
                    e.Cancel = true;
                    OpenExternal(e.Uri);
                }
            };
            // Plein écran demandé par la page (touche F11 dans l'interface).
            core.ContainsFullScreenElementChanged += (s, e) => SetFullscreen(core.ContainsFullScreenElement);
            core.ProcessFailed += (s, e) =>
            {
                if (e.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessExited
                    || e.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessUnresponsive)
                {
                    core.Reload();
                }
            };
            core.Navigate(baseUrl);
            web.Visible = true;
            status.Visible = false;
            web.Focus();
        }

        // ------------------------------------------------------------------ fenêtre

        private void SetFullscreen(bool on)
        {
            if (on)
            {
                stateBeforeFullscreen = WindowState;
                borderBeforeFullscreen = FormBorderStyle;
                FormBorderStyle = FormBorderStyle.None;
                WindowState = FormWindowState.Normal; // repasser par Normal : sinon la barre des tâches reste visible
                WindowState = FormWindowState.Maximized;
            }
            else
            {
                FormBorderStyle = borderBeforeFullscreen;
                WindowState = stateBeforeFullscreen;
            }
        }

        private void Fail(string message)
        {
            if (closing)
            {
                return;
            }
            web.Visible = false;
            status.Visible = true;
            status.Text = message + (logPath != null ? "\n\nJournal du moteur : " + logPath : "");
        }

        // ------------------------------------------------------------------ moteur

        private void Log(string line)
        {
            if (line == null || log == null)
            {
                return;
            }
            lock (log)
            {
                try
                {
                    log.WriteLine(line);
                }
                catch (IOException)
                {
                    // disque plein : tant pis pour le journal
                }
            }
        }

        private int SafeExitCode()
        {
            try
            {
                return engine.ExitCode;
            }
            catch (InvalidOperationException)
            {
                return -1;
            }
        }

        private void StopEngine()
        {
            closing = true;
            try
            {
                if (engine != null && !engine.HasExited)
                {
                    // Le moteur garde la partie à chaque moment calme et écrit ses fichiers en une fois : l'arrêter est sans risque.
                    engine.Kill();
                    engine.WaitForExit(3000);
                }
            }
            catch (InvalidOperationException)
            {
                // déjà arrêté
            }
            catch (System.ComponentModel.Win32Exception)
            {
                // arrêt refusé : il s'arrêtera avec la session
            }
            log?.Dispose();
        }

        /// <summary>
        /// Toujours le même port quand il est libre : la page garde ses réglages (mode, images, musique, thèmes) par
        /// adresse, port compris. Le port choisi est noté pour les fois suivantes ; s'il est pris, un autre est noté.
        /// </summary>
        private int PickPort()
        {
            var file = Path.Combine(dataDir, "port.txt");
            var port = 47615;
            try
            {
                if (File.Exists(file) && int.TryParse(File.ReadAllText(file).Trim(), out var saved) && saved > 1024 && saved < 65536)
                {
                    port = saved;
                }
            }
            catch (IOException)
            {
                // fichier illisible : port par défaut
            }
            if (!IsFree(port))
            {
                port = FreePort();
            }
            try
            {
                File.WriteAllText(file, port.ToString());
            }
            catch (IOException)
            {
                // pas grave : on choisira de nouveau la prochaine fois
            }
            return port;
        }

        private static bool IsFree(int port)
        {
            try
            {
                var listener = new TcpListener(IPAddress.Loopback, port);
                listener.Start();
                listener.Stop();
                return true;
            }
            catch (SocketException)
            {
                return false;
            }
        }

        private static int FreePort()
        {
            var listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            var port = ((IPEndPoint)listener.LocalEndpoint).Port;
            listener.Stop();
            return port;
        }

        private static void OpenExternal(string url)
        {
            try
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch (Exception)
            {
                // pas de navigateur par défaut
            }
        }
    }
}
