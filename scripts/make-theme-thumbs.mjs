#!/usr/bin/env node
// Vignettes des apparences (ui/img/themes/thumbs, ui/img/backs/thumbs : WebP) pour les listes des Réglages, de la
// boutique et des défis.
// Les décors sont des SVG (1600x900) pleins de flous : en afficher une trentaine d'un coup faisait ramer le défilement
// sur téléphone ; une petite image déjà calculée s'affiche instantanément. À relancer après make-themes.py ou
// make-mythic-themes.py. Il faut Playwright (Chromium) et Python avec Pillow.
// Usage : node scripts/make-theme-thumbs.mjs
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Décors (16:9, opaques) et dos de cartes avec leurs calques animés (63:88, transparents).
const SETS = [
  {dir: 'ui/img/themes', size: {width: 640, height: 360}, alpha: false, keep: (f) => !f.startsWith('fx-')},
  {dir: 'ui/img/backs', size: {width: 315, height: 440}, alpha: true, keep: () => true},
];
const browser = await chromium.launch(process.env.CHROMIUM ? {executablePath: process.env.CHROMIUM} : {});
const tmp = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || '/tmp'), 'thumbs-'));
let count = 0;
for (const set of SETS) {
  const dir = path.join(root, set.dir);
  const out = path.join(dir, 'thumbs');
  fs.mkdirSync(out, {recursive: true});
  const shots = path.join(tmp, path.basename(set.dir));
  fs.mkdirSync(shots);
  const page = await browser.newPage({viewport: set.size});
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.svg') && set.keep(f))) {
    await page.goto('file://' + path.join(dir, f));
    await page.waitForTimeout(100);
    await page.screenshot({path: path.join(shots, f.slice(0, -4) + '.png'), omitBackground: set.alpha});
    count++;
  }
  await page.close();
  execFileSync('python3', ['-I', '-c', `
import sys, os
from PIL import Image
src, dst, alpha = sys.argv[1], sys.argv[2], sys.argv[3] == '1'
for f in sorted(os.listdir(src)):
    im = Image.open(os.path.join(src, f)).convert('RGBA' if alpha else 'RGB')
    im.save(os.path.join(dst, f[:-4] + '.webp'), 'WEBP', quality=80, method=6)
`, shots, out, set.alpha ? '1' : '0']);
}
await browser.close();
fs.rmSync(tmp, {recursive: true, force: true});
console.log(count + ' vignettes');
