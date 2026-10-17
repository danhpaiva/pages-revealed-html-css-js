// Verificações de integridade do site estático (sem dependências):
//  1. toda referência local (href/src/url()/fetch) aponta para um arquivo existente;
//  2. nenhum arquivo em assets/ ou content/ está órfão (sem uso);
//  3. toda página tem lang, viewport, title e description.
import { readdir, readFile, access } from 'node:fs/promises';
import { dirname, join, normalize, posix, sep } from 'node:path';

const toPosix = (p) => p.split(sep).join('/');

const PAGES = ['index.html', ...(await readdir('pages')).filter((f) => f.endsWith('.html')).map((f) => `pages/${f}`)];
const errors = [];
const used = new Set();

const exists = (p) => access(p).then(() => true, () => false);

async function walk(dir) {
    const out = [];
    for (const e of await readdir(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) out.push(...(await walk(p)));
        else out.push(toPosix(p));
    }
    return out;
}

async function checkRef(from, ref) {
    if (!ref || /^(https?:|\/\/|data:|#|mailto:)/.test(ref)) return;
    const clean = ref.split(/[?#]/)[0];
    const target = toPosix(normalize(posix.join(dirname(from), clean)));
    used.add(target);
    if (!(await exists(target))) errors.push(`${from}: referência quebrada -> ${ref}`);
}

const refsIn = (text, re) => [...text.matchAll(re)].map((m) => m[1]);

for (const page of PAGES) {
    const html = await readFile(page, 'utf8');
    used.add(page);
    if (!/<html[^>]+lang=/.test(html)) errors.push(`${page}: <html> sem atributo lang`);
    if (!/name="viewport"/.test(html)) errors.push(`${page}: sem meta viewport`);
    if (!/<title>[^<]+<\/title>/.test(html)) errors.push(`${page}: sem <title>`);
    if (!/name="description"/.test(html)) errors.push(`${page}: sem meta description`);
    for (const ref of refsIn(html, /(?:href|src)="([^"]+)"/g)) await checkRef(page, ref);
}

// CSS e JS: url(...) e caminhos de imagem/markdown
for (const file of (await walk('assets')).filter((f) => /\.(css|js)$/.test(f))) {
    const text = await readFile(file, 'utf8');
    const base = file.endsWith('.css') ? file : null;
    if (base) for (const ref of refsIn(text, /url\(['"]?([^'")]+)['"]?\)/g)) await checkRef(file, ref);
}
// Em JS, os caminhos são relativos à página que carrega o script (pages/ ou raiz).
for (const file of (await walk('assets/js')).filter((f) => f.endsWith('.js'))) {
    const text = await readFile(file, 'utf8');
    for (const ref of refsIn(text, /['"](\.\.\/(?:assets|content)\/[^'"]+)['"]/g)) await checkRef('pages/x.html', ref);
}

// Órfãos
for (const file of [...(await walk('assets')), ...(await walk('content'))]) {
    if (!used.has(file) && !file.endsWith('.css') && !file.endsWith('.js')) errors.push(`arquivo sem uso: ${file}`);
}
// CSS/JS carregados por alguma página
for (const file of (await walk('assets')).filter((f) => /\.(css|js)$/.test(f))) {
    if (!used.has(file)) errors.push(`arquivo sem uso: ${file}`);
}

// Proteção do livro: nenhum texto em claro em content/ e pacote criptografado válido
for (const file of await walk('content')) {
    if (/\.(md|txt)$/i.test(file)) errors.push(`texto em claro em pasta pública: ${file} (use private/ e npm run encrypt)`);
}
try {
    const pkg = JSON.parse(await readFile('content/livro.enc.json', 'utf8'));
    if (!(pkg.iter >= 600000) || !pkg.salt || !pkg.iv || !pkg.data) errors.push('content/livro.enc.json: pacote criptografado inválido ou com poucas iterações');
} catch {
    errors.push('content/livro.enc.json ausente ou ilegível (rode npm run encrypt)');
}

if (errors.length) {
    console.error(`\n${errors.length} problema(s):\n - ${errors.join('\n - ')}\n`);
    process.exit(1);
}
console.log(`OK: ${PAGES.length} páginas verificadas, nenhuma referência quebrada, nenhum arquivo órfão.`);
