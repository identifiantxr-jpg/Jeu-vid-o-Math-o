// ============================================================
//  build.js — fusionne index.html + tous tes .js en UN SEUL index.html
//  Usage :  node build.js
//  Résultat : dossier  dist/  contenant  index.html  (+ render.js s'il existe)
//  → c'est ce dossier dist/ que tu envoies sur Render.
// ============================================================
const fs = require('fs'), path = require('path');
const dir = __dirname, outDir = path.join(dir, 'dist');
const src = path.join(dir, process.argv[2] || 'index.html');
if (!fs.existsSync(src)) { console.error('✖ Introuvable : ' + src); process.exit(1); }

const isLocal = u => !/^(https?:)?\/\//i.test(u) && !u.startsWith('data:');
const read = u => {
  const f = path.join(dir, u.split('?')[0]);
  if (!fs.existsSync(f)) { console.error('✖ Fichier manquant : ' + u); process.exit(1); }
  return fs.readFileSync(f, 'utf8');
};
const inlined = [];
let html = fs.readFileSync(src, 'utf8');

// <script src="x.js"></script>  →  <script>…contenu…</script>
html = html.replace(/<script\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (m, a, u, b) => {
  if (!isLocal(u)) return m;                       // CDN (ex. three.js) : on laisse tel quel
  inlined.push(u);
  const code = read(u).replace(/<\/script/gi, '<\\/script');
  const attrs = (a + b).trim();
  return '<script' + (attrs ? ' ' + attrs : '') + '>\n' + code + '\n</script>';
});
// <link rel="stylesheet" href="x.css">  →  <style>…</style>
html = html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, m => {
  const h = /href=["']([^"']+)["']/i.exec(m);
  if (!h || !isLocal(h[1])) return m;
  inlined.push(h[1]);
  return '<style>\n' + read(h[1]) + '\n</style>';
});

// Vérifie que les mondes sont bien chargés AVANT game.js
const worlds = fs.readdirSync(dir).filter(f => /^world-.*\.js$/.test(f));
const gi = inlined.indexOf('game.js');
for (const w of worlds) {
  const wi = inlined.indexOf(w);
  if (wi < 0) console.warn('⚠ ' + w + " n'est pas dans index.html (ajoute <script src=\"" + w + '"></script> avant game.js)');
  else if (gi >= 0 && wi > gi) console.warn('⚠ ' + w + ' est chargé APRÈS game.js : déplace-le avant.');
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), html);
for (const f of ['render.js']) if (fs.existsSync(path.join(dir, f))) fs.copyFileSync(path.join(dir, f), path.join(outDir, f));
else console.warn('⚠ ' + f + ' absent : pense à le mettre dans dist/ pour Render.');
console.log('✔ dist/index.html créé (' + (html.length / 1024).toFixed(0) + ' Ko), ' + inlined.length + ' fichiers fusionnés :');
inlined.forEach(f => console.log('   · ' + f));
