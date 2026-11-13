// Image d'une carte dessinée (Atelier) : la carte telle qu'elle s'affiche, en PNG, pour la partager. La carte est
// recopiée dans une image SVG (foreignObject) avec les feuilles de style de l'appli et ses images intégrées, puis
// dessinée sur un canevas. Les polices sont celles du système : rien d'autre à intégrer.

const cache = new Map();

/** Une adresse (illustration, logo) en data: URL, pour que l'image SVG n'ait rien à charger. */
async function dataUrl(url) {
  if (!url || url.startsWith('data:')) {
    return url;
  }
  if (cache.has(url)) {
    return cache.get(url);
  }
  const p = fetch(url).then(r => (r.ok ? r.blob() : null)).then(blob => (blob ? new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  }) : '')).catch(() => '');
  cache.set(url, p);
  return p;
}

/** Les url(...) d'un texte CSS remplacées par leur contenu. */
async function inlineUrls(css, base) {
  const re = /url\((["']?)([^"')]+)\1\)/g;
  const found = new Set();
  for (const m of css.matchAll(re)) {
    if (!m[2].startsWith('data:') && !m[2].startsWith('#')) {
      found.add(m[2]);
    }
  }
  const map = new Map();
  await Promise.all([...found].map(async (u) => {
    const abs = new URL(u.replace(/&quot;/g, ''), base).href;
    map.set(u, await dataUrl(abs));
  }));
  return css.replace(re, (all, q, u) => (map.has(u) && map.get(u) ? `url("${map.get(u)}")` : all));
}

let sheetText = null;
/** Les feuilles de style de l'appli (cadres, symboles de mana), une seule fois. Les images de fond restent dehors. */
async function styles() {
  if (sheetText) {
    return sheetText;
  }
  const parts = [];
  for (const sheet of document.styleSheets) {
    try {
      parts.push([...sheet.cssRules].map(r => r.cssText).join('\n'));
    } catch (e) {
      // feuille d'une autre origine : sans elle
    }
  }
  // Les fonds d'écran et dos de cartes (url relatives à charger) n'ont rien à faire sur une carte : seuls les data:.
  sheetText = parts.join('\n').replace(/url\((["']?)(?!data:)[^"')]+\1\)/g, 'none');
  return sheetText;
}

/**
 * La carte (élément .mcard affiché) en PNG : renvoie le contenu en base64 (sans l'en-tête data:). width : largeur de
 * l'image en pixels (la hauteur suit).
 */
export async function cardPng(node, width = 744) {
  const rect = node.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    throw new Error('La carte n\'est pas affichée.');
  }
  const scale = width / rect.width;
  const clone = node.cloneNode(true);
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  clone.style.setProperty('--w', `${rect.width}px`);
  clone.style.margin = '0';
  clone.style.transform = 'none';
  // Images de la carte (illustration) et images de fond en ligne (logo d'extension, cadre importé).
  await Promise.all([...clone.querySelectorAll('img')].map(async (img) => {
    if (img.getAttribute('src')) {
      img.setAttribute('src', await dataUrl(img.src));
    }
    img.removeAttribute('loading');
    img.removeAttribute('srcset');
  }));
  const styled = [clone, ...clone.querySelectorAll('[style]')];
  await Promise.all(styled.map(async (n) => {
    const st = n.getAttribute('style');
    if (st && /url\(/.test(st)) {
      n.setAttribute('style', await inlineUrls(st, location.href));
    }
  }));
  const css = await styles();
  const root = document.documentElement;
  const vars = root.getAttribute('style') || '';
  const w = Math.ceil(rect.width);
  const h = Math.ceil(rect.height);
  const body = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w * scale)}" height="${Math.round(h * scale)}" viewBox="0 0 ${w} ${h}">
    <foreignObject x="0" y="0" width="${w}" height="${h}">
      <div xmlns="http://www.w3.org/1999/xhtml" style="${vars.replace(/&/g, '&amp;').replace(/"/g, '&quot;')};width:${w}px;height:${h}px;margin:0;background:transparent">
        <style><![CDATA[${css.replace(/\]\]>/g, '] ]>')}]]></style>${body}
      </div>
    </foreignObject></svg>`;
  const img = new Image();
  img.decoding = 'sync';
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  // Un navigateur qui refuse de relire un dessin fait d'une image SVG (Safari ancien) lève une erreur ici.
  return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
}
