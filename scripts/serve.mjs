// Servidor estático mínimo para desenvolvimento local (sem dependências).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

const PORT = Number(process.env.PORT) || 8000;
const TYPES = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png',
    '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
    try {
        const path = decodeURIComponent(new URL(req.url, 'http://x').pathname).split('/').filter((s) => s && s !== '..' && s !== '.').join('/');
        let file = join(process.cwd(), path);
        if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
        const body = await readFile(file);
        res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
        res.end(body);
    } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404');
    }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
