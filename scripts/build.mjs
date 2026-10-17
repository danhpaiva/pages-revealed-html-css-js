// Monta a pasta dist/ apenas com o que vai para o GitHub Pages
// (sem .git, node_modules, configs ou scripts), deixando o artefato enxuto.
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

const OUT = 'dist';
const PUBLIC = ['index.html', 'pages', 'assets', 'content'];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const entry of PUBLIC) await cp(entry, `${OUT}/${entry}`, { recursive: true });
await writeFile(`${OUT}/.nojekyll`, '');
console.log(`Build pronto em ${OUT}/ (${PUBLIC.join(', ')})`);
