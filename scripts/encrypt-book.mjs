// Criptografa o livro (private/livro.md -> content/livro.enc.json).
// O texto em claro nunca vai para o repositório: private/ está no .gitignore.
//
// Uso:  BOOK_PASSWORD="sua-senha" npm run encrypt
//       (ou apenas `npm run encrypt` para digitar a senha)
//
// Esquema: PBKDF2-SHA256 (ITERATIONS) -> chave AES-256-GCM. O navegador repete o
// mesmo processo com a Web Crypto API para decifrar.
import { webcrypto as crypto } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';

const SOURCE = 'private/livro.md';
const OUTPUT = 'content/livro.enc.json';
const ITERATIONS = 600000;

const b64 = (buf) => Buffer.from(buf).toString('base64');

function askPassword() {
    return new Promise((resolve) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        const write = rl._writeToOutput;
        rl.question('Senha do livro: ', (answer) => {
            rl._writeToOutput = write;
            rl.close();
            process.stdout.write('\n');
            resolve(answer);
        });
        rl._writeToOutput = (text) => { if (text.includes('Senha')) write.call(rl, text); };
    });
}

const password = process.env.BOOK_PASSWORD || (await askPassword());
if (!password) {
    console.error('Senha vazia. Abortado.');
    process.exit(1);
}

const plain = await readFile(SOURCE, 'utf8').catch(() => {
    console.error(`Não encontrei ${SOURCE}. Coloque o markdown do livro lá (a pasta private/ não é versionada).`);
    process.exit(1);
});

const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
);
const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain));

await writeFile(OUTPUT, JSON.stringify({ v: 1, kdf: 'PBKDF2-SHA256', iter: ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(data) }) + '\n');
console.log(`Livro criptografado em ${OUTPUT} (${plain.length} caracteres de texto).`);
