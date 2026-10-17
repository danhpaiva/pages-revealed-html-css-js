# Pages Revealed

Site estático em **HTML, CSS e JavaScript puro** (sem frameworks) publicado no GitHub Pages. A página inicial oferece três experiências interativas, cada uma aberta ao clicar numa arte.

[![CI](https://github.com/danhpaiva/pages-revealed-html-css-js/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/danhpaiva/pages-revealed-html-css-js/actions/workflows/ci.yml)
[![Deploy](https://github.com/danhpaiva/pages-revealed-html-css-js/actions/workflows/deploy.yml/badge.svg)](https://github.com/danhpaiva/pages-revealed-html-css-js/actions/workflows/deploy.yml)
![License](https://img.shields.io/github/license/danhpaiva/pages-revealed-html-css-js)

**Demo:** https://danhpaiva.github.io/pages-revealed-html-css-js/

---

## Experiências

| Arte | Página | Descrição |
|------|--------|-----------|
| O Mago | [`pages/gandalf.html`](pages/gandalf.html) | O mago fica no centro da tela e afasta um dragão com rajadas de magia. O dragão cai num canto aleatório, fica tonto e volta a atacar, em ciclo infinito. Ele nunca morre. |
| O Livro | [`pages/livro.html`](pages/livro.html) | O conteúdo do livro (protegido por senha) em formato de livro, com paginação automática, índice, busca, ajuste de fonte e progresso salvo. Duas páginas no desktop e uma no celular. |
| A Galáxia | [`pages/galaxia.html`](pages/galaxia.html) | Uma estrela nova a cada mês a partir de 2026/04. Ao completar o ano, as 12 estrelas viram um planeta, a cada 5 anos os 5 planetas viram um sistema solar, e a cada 10 anos 2 sistemas viram uma galáxia. |

Detalhes de cada uma:

- **Mago:** canvas 2D com máquina de estados (`approach → knock → dizzy → takeoff`). O dragão é desenhado por código.
- **Livro:** o Markdown é convertido com [marked](https://marked.js.org/) e dividido em blocos. Os blocos são medidos no DOM para decidir o que cabe em cada página, e parágrafos e itens longos são divididos entre páginas. A paginação é refeita ao redimensionar a tela ou mudar a fonte.
- **Galáxia:** progressão em quatro níveis: 1 mês = estrela, 12 meses = planeta, 5 anos = sistema solar (os 5 planetas entram em órbita de um sol) e 10 anos = galáxia espiral (2 sistemas se fundem). Assim o céu cresce em beleza sem ficar poluído: no máximo 12 estrelas, 4 planetas e 1 sistema soltos, mais as galáxias já formadas, que ficam pequenas no topo. Há um controle de tempo e o botão "Reviver a jornada".

---

## Estrutura

```
.
├── index.html                  # página inicial (três artes)
├── pages/                      # uma página por experiência
│   ├── gandalf.html
│   ├── livro.html
│   └── galaxia.html
├── assets/
│   ├── css/                    # base.css (tokens e botão voltar) + um CSS por página
│   ├── js/                     # um módulo por página
│   └── img/                    # imagens otimizadas usadas pelo site
├── content/
│   └── livro.enc.json          # livro criptografado (AES-256-GCM)
├── private/                    # texto em claro do livro (no .gitignore, nunca vai ao repo)
├── scripts/
│   ├── encrypt-book.mjs        # criptografa private/livro.md -> content/livro.enc.json
│   ├── build.mjs               # gera dist/ só com os arquivos públicos
│   ├── check-site.mjs          # links quebrados e arquivos órfãos
│   └── serve.mjs               # servidor local sem dependências
├── .github/
│   ├── workflows/ci.yml        # integração contínua
│   ├── workflows/deploy.yml    # entrega contínua (GitHub Pages)
│   └── dependabot.yml
├── eslint.config.js  .stylelintrc.json  .htmlhintrc  .editorconfig
└── package.json                # só ferramentas de desenvolvimento
```

O site em si não tem build nem dependências de runtime. O Node é usado apenas para lint, verificações e para montar o artefato do deploy.

---

## Desenvolvimento local

Requer Node 20 ou superior.

```bash
npm install
npm run serve        # http://localhost:8000
```

O servidor local é necessário porque o livro carrega o Markdown com `fetch`, o que não funciona via `file://`.

| Comando | O que faz |
|---------|-----------|
| `npm run serve` | Servidor estático local (`PORT=3000 npm run serve` troca a porta) |
| `npm run lint` | HTMLHint, Stylelint e ESLint |
| `npm run check` | Falha se houver referência quebrada ou arquivo sem uso |
| `npm run encrypt` | Criptografa `private/livro.md` com a senha informada |
| `npm run build` | Gera `dist/` com o que vai para produção |
| `npm test` | `lint` + `check` (o mesmo que a CI executa) |

---

## Personalização

- **Texto do livro:** edite `private/livro.md` (títulos `#` e `##` viram capítulos, e `###` entra no índice) e gere a versão criptografada:

  ```bash
  BOOK_PASSWORD="sua-senha" npm run encrypt   # ou só `npm run encrypt` para digitar
  ```

  Depois faça commit de `content/livro.enc.json`. Para trocar a senha, rode o comando de novo com a nova senha.
- **Galáxia:** no topo de `assets/js/galaxia.js`, ajuste `START_YEAR`, `START_MONTH`, `YEARS_PER_SYSTEM` e `SYSTEMS_PER_GALAXY`. Para pré-visualizar outra data, use `pages/galaxia.html?hoje=2031-04`.
- **Cores e fontes:** variáveis CSS em `assets/css/base.css` (`:root`) e `assets/css/livro.css`.

---

## CI/CD

Os dois fluxos são separados. O deploy reaproveita a CI, então a validação existe em um só lugar.

```
Pull Request / push em develop            push em main (arquivos do site) ou manual
            │                                                │
            ▼                                                ▼
   ci.yml  (5 jobs em paralelo)               deploy.yml:  ci.yml ─▶ build ─▶ deploy
   Lint HTML │ Lint CSS │ Lint JS                            (reutilizada)  dist/   GitHub Pages
   Integridade │ Build
```

**CI** ([`ci.yml`](.github/workflows/ci.yml))
- Dispara em PRs para `main` e `develop` e em pushes na `develop`.
- Os cinco jobs rodam em paralelo (matriz), com `npm ci` e cache do npm.
- Um novo push no mesmo PR cancela a execução anterior (`concurrency`).
- Permissões mínimas (`contents: read`) e `timeout` por job.

**CD** ([`deploy.yml`](.github/workflows/deploy.yml))
- Dispara em push na `main` apenas quando algo do site muda (`paths`) ou manualmente (`workflow_dispatch`).
- Chama a CI como workflow reutilizável. Só publica se ela passar.
- O job `build` não instala dependências: `scripts/build.mjs` copia só os arquivos públicos para `dist/` (cerca de 1 MB). Repositório, configs e scripts não vão ao artefato.
- O job `deploy` é o único com `pages: write` e `id-token: write`.
- Execuções de deploy nunca se cancelam no meio (`cancel-in-progress: false`).

**Configuração única no GitHub:** em *Settings → Pages*, defina *Source* como **GitHub Actions**.

### Fluxo de branches

`develop` (trabalho diário) → Pull Request com CI → merge em `main` → deploy automático.

---

## Tecnologias

HTML5, CSS3 (Grid, Flexbox, custom properties), JavaScript ES2022, Canvas 2D, [marked](https://marked.js.org/) via CDN e Google Fonts (Cinzel, Lora e Inter). Ferramentas de desenvolvimento: ESLint, Stylelint e HTMLHint.

---

## Proteção do livro

O livro só existe no site de forma criptografada: AES-256-GCM, com chave derivada da senha por PBKDF2-SHA256 (600.000 iterações). A decifragem acontece no navegador, depois que a senha é digitada. A senha não está em nenhum arquivo do projeto.

- O texto em claro fica em `private/` (ignorado pelo git). O `npm run check` falha se aparecer qualquer `.md` ou `.txt` em `content/`.
- Como é um site estático, o arquivo criptografado é público e pode ser baixado. A segurança depende da **força da senha**: uma senha só de números (6 dígitos) tem apenas 1 milhão de combinações e pode ser quebrada por força bruta offline. Para proteção real, use uma frase longa.
- Quem já viu o repositório antes da criptografia pode ter o texto antigo no histórico do git.

---

## Acessibilidade e responsividade

- Layout testado de 320 px a telas largas, com versão para celular (uma página no livro, painéis compactos).
- Alvos de toque de pelo menos 44 px, navegação por teclado (`←` `→` no livro) e foco visível.
- Respeita `prefers-reduced-motion`.
- Texto sempre sobre fundos de alto contraste (papel claro com tinta escura no livro, painéis escuros sobre o céu).

---

## Licença

[MIT](LICENSE) © Daniel Paiva
