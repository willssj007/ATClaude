// Essai de la version iPhone (PWA) dans de vrais navigateurs : Chromium, et WebKit (le moteur de Safari) avec
// l'écran d'un iPhone. Le site est servi localement sous /ATClaude/, comme sur GitHub Pages (requêtes partielles
// comprises, dont CheerpJ a besoin pour lire les jars). On suit le démarrage de Forge dans la page, on lance une
// partie, puis on recharge la page (deuxième lancement, ressources déjà installées).
//
// Usage : node scripts/pwa-test.mjs DOSSIER_SITE DOSSIER_RÉSULTATS [chromium,webkit]
// Résultats : report.json, report.md, captures (*.png) et journaux de la console (*-console.txt).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {chromium, devices, webkit} from 'playwright';

const SITE = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3]);
const BROWSERS = (process.argv[4] || 'chromium,webkit').split(',');
const PREFIX = '/ATClaude/';
const PORT = 8080;
const BOOT_LIMIT = 30 * 60_000;
fs.mkdirSync(OUT, {recursive: true});

// ------------------------------------------------------------------ serveur statique (avec Range)

const TYPES = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
  json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', mp3: 'audio/mpeg',
  jar: 'application/java-archive', zip: 'application/zip', webmanifest: 'application/manifest+json',
  woff2: 'font/woff2', ico: 'image/x-icon',
};
const served = {requests: 0, bytes: 0, ranges: 0, missing: []};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(url.pathname);
  if (p === '/ATClaude') {
    res.writeHead(301, {Location: PREFIX}).end();
    return;
  }
  if (!p.startsWith(PREFIX)) {
    res.writeHead(404).end();
    return;
  }
  let file = path.join(SITE, p.slice(PREFIX.length));
  if (!file.startsWith(SITE)) {
    res.writeHead(403).end();
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    file = path.join(file, 'index.html');
  }
  if (!fs.existsSync(file)) {
    served.missing.push(p);
    res.writeHead(404).end();
    return;
  }
  served.requests++;
  const size = fs.statSync(file).size;
  const headers = {
    'Content-Type': TYPES[path.extname(file).slice(1)] || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache',
  };
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (range) {
    served.ranges++;
    let start = range[1] === '' ? size - Number(range[2]) : Number(range[1]);
    let end = range[1] === '' || range[2] === '' ? size - 1 : Math.min(Number(range[2]), size - 1);
    start = Math.max(0, start);
    if (start >= size) {
      res.writeHead(416, {'Content-Range': `bytes */${size}`}).end();
      return;
    }
    res.writeHead(206, {...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1});
    served.bytes += end - start + 1;
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(file, {start, end}).pipe(res);
    return;
  }
  res.writeHead(200, {...headers, 'Content-Length': size});
  served.bytes += size;
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
const SITE_URL = `http://127.0.0.1:${PORT}${PREFIX}`;

// ------------------------------------------------------------------ essai d'un navigateur

async function run(name) {
  const r = {browser: name, steps: {}, loading: [], errors: [], failed: [], memory: {}, dialogs: []};
  const t0 = Date.now();
  const ts = () => Math.round((Date.now() - t0) / 100) / 10;
  const consoleLines = [];
  const type = name === 'webkit' ? webkit : chromium;
  // PW_CHROMIUM : un Chromium déjà installé (essai local), sinon celui de Playwright.
  const browser = await type.launch(name === 'chromium' && process.env.PW_CHROMIUM ? {executablePath: process.env.PW_CHROMIUM} : {});
  const options = name === 'webkit' ? {...devices['iPhone 13']} : {viewport: {width: 1280, height: 800}};
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on('console', (m) => consoleLines.push(`[${ts()}] ${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => r.errors.push(`[${ts()}] ${e.message}`));
  page.on('requestfailed', (q) => r.failed.push(`[${ts()}] ${q.failure() && q.failure().errorText} ${q.url()}`));
  page.on('response', (q) => {
    if (q.status() >= 400) {
      r.failed.push(`[${ts()}] HTTP ${q.status()} ${q.url()}`);
    }
  });
  const shot = async (label) => {
    const file = `${name}-${label}.png`;
    await page.screenshot({path: path.join(OUT, file)}).catch(() => {});
    return file;
  };
  const memory = async (label) => {
    r.memory[label] = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null).catch(() => null);
  };

  /** Attend la fin de l'écran de chargement (ou une erreur), en notant chaque étape. */
  const boot = async (label) => {
    const start = Date.now();
    let last = '';
    let nextShot = Date.now() + 60_000;
    let k = 0;
    while (Date.now() - start < BOOT_LIMIT) {
      const st = await page.evaluate(() => ({
        text: (document.querySelector('#loading-text') || {}).textContent || '',
        hidden: !!document.querySelector('#loading.hidden'),
        bar: (document.querySelector('#loading-bar') || {style: {}}).style.width || '',
      })).catch(() => ({text: '?', hidden: false, bar: ''}));
      const line = `${st.text} ${st.bar}`.trim();
      if (line !== last) {
        r.loading.push(`[${ts()}] ${label} : ${line}`);
        last = line;
      }
      if (st.hidden) {
        return {ok: true, seconds: Math.round((Date.now() - start) / 1000)};
      }
      if (/Échec|n'a pas pu|s'est arrêté|injoignable|Erreur|ne répond pas/i.test(st.text)) {
        return {ok: false, seconds: Math.round((Date.now() - start) / 1000), error: st.text};
      }
      if (Date.now() > nextShot) {
        await shot(`${label}-${++k}`);
        nextShot = Date.now() + 180_000;
      }
      await page.waitForTimeout(1500);
    }
    return {ok: false, seconds: Math.round((Date.now() - start) / 1000), error: 'délai dépassé : ' + last};
  };

  try {
    await page.goto(SITE_URL, {waitUntil: 'domcontentloaded'});
    r.steps.firstLaunch = await boot('premier');
    await memory('ready');
    r.steps.firstLaunch.shot = await shot('accueil');
    if (r.steps.firstLaunch.ok) {
      // Une partie : Sandbox, salon, partie rapide à deux joueurs.
      const g0 = Date.now();
      try {
        await page.click('#nav [data-screen="lobby"]', {timeout: 20_000});
        await page.waitForSelector('.seat', {timeout: 60_000});
        await page.click('[data-start]');
        await page.waitForSelector('.table', {timeout: 10 * 60_000});
        r.steps.table = {seconds: Math.round((Date.now() - g0) / 1000)};
        await page.waitForFunction(() => (document.querySelector('.prompt') || {}).textContent, null, {timeout: 10 * 60_000});
        r.steps.table.prompt = (await page.textContent('.prompt')).replace(/\s+/g, ' ').trim().slice(0, 160);
        r.steps.table.promptAfter = Math.round((Date.now() - g0) / 1000);
        r.steps.table.shot = await shot('partie');
        // Garder sa main, jouer, passer : jusqu'à la phase principale (ou 4 minutes).
        const m0 = Date.now();
        while (Date.now() - m0 < 4 * 60_000) {
          const main = await page.evaluate(() => {
            const now = document.querySelector('.phases .ph.now');
            return !!now && /principale/i.test(now.title || '') && !document.querySelector('#dialogs .modal-back');
          });
          if (main) {
            r.steps.main = {seconds: Math.round((Date.now() - g0) / 1000)};
            break;
          }
          const gold = await page.$('#dialogs footer .btn.gold:not([disabled])');
          if (gold) {
            // Ce que dit la fenêtre (choix, mulligan... ou plantage de Forge) avant de la valider.
            const text = await page.evaluate(() => {
              const box = document.querySelector('#dialogs .modal-back:last-child') || document.querySelector('#dialogs');
              return (box ? box.textContent : '').replace(/\s+/g, ' ').trim().slice(0, 300);
            }).catch(() => '');
            if (text && r.dialogs[r.dialogs.length - 1] !== text) {
              r.dialogs.push(text);
            }
            await gold.click().catch(() => {});
          } else {
            const ok = await page.$('.ok-btn:not(.hidden):not([disabled])');
            if (ok) {
              await ok.click().catch(() => {});
            }
          }
          await page.waitForTimeout(1500);
        }
        if (!r.steps.main) {
          // Partie figée : où en est chaque fil Java.
          const threads = await Promise.race([
            page.evaluate(() => window.AT_WEB && window.AT_WEB.threads ? window.AT_WEB.threads() : 'AT_WEB.threads absent'),
            new Promise((resolve) => setTimeout(() => resolve('pas de réponse en 60 s'), 60_000)),
          ]).catch((e) => 'erreur : ' + e.message);
          fs.writeFileSync(path.join(OUT, `${name}-threads.txt`), String(threads));
          r.steps.threads = `${name}-threads.txt`;
        }
        await page.waitForTimeout(20_000);
        r.steps.images = await page.evaluate(() => ({
          cards: document.querySelectorAll('.table .mcard:not(.back)').length,
          withImage: document.querySelectorAll('.table .mcard.has-img').length,
          turn: ((document.querySelector('.table') || {}).textContent || '').match(/Tour\s*(\d+)/)?.[1] || '?',
        }));
        await memory('game');
        r.steps.gameShot = await shot('partie-2');
      } catch (e) {
        r.steps.gameError = String(e.message || e).split('\n')[0];
        await shot('partie-erreur');
      }
      // Deuxième lancement : les ressources sont déjà dans le navigateur.
      await page.reload({waitUntil: 'domcontentloaded'});
      r.steps.secondLaunch = await boot('second');
      r.steps.secondLaunch.shot = await shot('second');
    } else {
      await shot('echec');
    }
  } catch (e) {
    r.errors.push('essai interrompu : ' + String(e.message || e).split('\n')[0]);
  }
  fs.writeFileSync(path.join(OUT, `${name}-console.txt`), consoleLines.slice(-4000).join('\n'));
  r.consoleLines = consoleLines.length;
  r.errors = r.errors.slice(0, 50);
  r.failed = r.failed.slice(0, 80);
  await browser.close();
  return r;
}

// ------------------------------------------------------------------ rapport

const report = {date: new Date().toISOString(), site: fs.readFileSync(path.join(SITE, 'engine.json'), 'utf8'), results: []};
for (const name of BROWSERS) {
  console.log(`== ${name}`);
  const r = await run(name);
  report.results.push(r);
  console.log(JSON.stringify(r.steps, null, 1));
}
report.served = {...served, missing: served.missing.slice(0, 50)};
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));

const md = ['# Essai de la version iPhone (PWA)', '', `Date : ${report.date}`, ''];
for (const r of report.results) {
  const s = r.steps;
  md.push(`## ${r.browser}`, '');
  md.push(`- Premier lancement : ${s.firstLaunch ? (s.firstLaunch.ok ? `prêt en ${s.firstLaunch.seconds} s` : `échec après ${s.firstLaunch.seconds} s (${s.firstLaunch.error})`) : '?'}`);
  if (s.table) {
    md.push(`- Partie : plateau en ${s.table.seconds} s, première question en ${s.table.promptAfter} s (« ${s.table.prompt} »)`);
  }
  if (s.main) {
    md.push(`- Phase principale atteinte en ${s.main.seconds} s`);
  }
  if (s.images) {
    md.push(`- Tour ${s.images.turn} ; images : ${s.images.withImage} / ${s.images.cards} cartes affichées avec leur image`);
  }
  if (s.gameError) {
    md.push(`- Erreur pendant la partie : ${s.gameError}`);
  }
  if (s.secondLaunch) {
    md.push(`- Second lancement : ${s.secondLaunch.ok ? `prêt en ${s.secondLaunch.seconds} s` : `échec (${s.secondLaunch.error})`}`);
  }
  md.push(`- Mémoire JS : ${JSON.stringify(r.memory)}`, `- Erreurs de page : ${r.errors.length}, requêtes en échec : ${r.failed.length}`, '');
  if (r.dialogs.length) {
    md.push('Fenêtres validées pendant la partie :', '', ...r.dialogs.slice(0, 20).map(d => `- ${d}`), '');
  }
  md.push('Chargement :', '', '```', ...r.loading.slice(0, 80), '```', '');
}
fs.writeFileSync(path.join(OUT, 'report.md'), md.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.join('\n'));
}
server.close();
const anyReady = report.results.some(r => r.steps.firstLaunch && r.steps.firstLaunch.ok);
process.exit(anyReady ? 0 : 1);
