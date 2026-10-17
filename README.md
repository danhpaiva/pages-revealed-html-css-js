# 📖 Pages Revealed

**Pages Revealed** é uma aplicação web estática que renderiza conteúdo Markdown como um livro digital interativo e navegável. Desenvolvida com HTML5, CSS3 e JavaScript Vanilla puro, sem frameworks ou dependências externas.

![License](https://img.shields.io/github/license/danhpaiva/pages-revealed-html-css-js)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)

---

## 🎭 Conceito & Design

**Pages Revealed** oferece uma experiência de leitura intimista e elegante, inspirada em dossiês pessoais e diários de capa dura. O design combina:

- **Tema Dark Mode/Sépia**: Estética sóbria e confidencial
- **Tipografia Elegante**: Fontes serifadas (Lora/Merriweather) para o corpo de texto, misturadas com Sans-serif (Inter) para menus
- **Transições Suaves**: Efeitos de fade entre páginas e animações fluidas

---

## ✨ Funcionalidades

### 📄 Parser Dinâmico de Markdown
- Carrega e parseia automaticamente o arquivo `readme_history/README.md`
- Utiliza [marked.js](https://marked.js.org/) via CDN
- Estrutura o conteúdo em capítulos baseados em cabeçalhos de nível 2 (`##`)

### 📚 Navegação de Livro
- **Botões de navegação**: Anterior e Próxima página
- **Atalhos de teclado**: Setas ← e → para navegar
- **Indicador de progresso**: "Página X de Y" + barra de progresso visual

### 📑 Índice Interativo
- Menu lateral retrátil com lista de todos os capítulos
- Navegação rápida para qualquer seção
- Highlight do capítulo atual
- Responsivo: drawer em dispositivos móveis (<768px)

### 🔍 Busca Interna
- Campo de busca no header
- Pesquisa em todos os capítulos
- Highlight dos termos encontrados
- Modal com resultados clicáveis

### 💾 Persistência de Leitura
- Salva automaticamente o progresso no `localStorage`
- Retoma da última página lida ao reabrir

### 🎨 Elementos Especiais
- **Blockquotes**: Renderizados com borda dourada e estilo destacado
- **Checkboxes Interativos**: Caixas de seleção estilizadas para listas de tarefas
- **Subseções**: Títulos secundários com divisores sutis

### 📱 Design Responsivo
- Layout adaptativo de 320px a 1920px
- Tipografia otimizada para mobile
- Menu lateral colapsável em telas pequenas

### ♿ Acessibilidade
- Navegação completa por teclado
- Indicadores de foco visíveis
- ARIA labels para screen readers
- Contraste de cores conforme WCAG AA

---

## 🚀 Como Usar

### Localmente

1. **Clone o repositório**:
   ```bash
   git clone https://github.com/danhpaiva/pages-revealed-html-css-js.git
   cd pages-revealed-html-css-js
   ```

2. **Adicione seu conteúdo**:
   - Edite o arquivo `readme_history/README.md` com seus relatos
   - Use cabeçalhos `##` para delimitar capítulos

3. **Abra no navegador**:
   - **Importante**: Devido ao CORS, você precisa de um servidor local
   - Com Python 3: `python -m http.server 8000`
   - Com Node.js: `npx http-server`
   - Acesse: `http://localhost:8000`

### GitHub Pages

1. **Configure GitHub Pages**:
   - Vá em `Settings` > `Pages`
   - Source: `GitHub Actions`

2. **Push para a branch `main`**:
   ```bash
   git checkout main
   git add .
   git commit -m "Deploy initial version"
   git push origin main
   ```

3. **Aguarde o deploy**:
   - O workflow será executado automaticamente
   - Acesse: `https://danhpaiva.github.io/pages-revealed-html-css-js/`

---

## 📂 Estrutura de Arquivos

```
pages-revealed-html-css-js/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions workflow
├── assets/
│   ├── script.js               # Lógica JavaScript
│   └── style.css               # Estilos CSS
├── readme_history/
│   └── README.md               # Conteúdo dos relatos (fonte)
├── index.html                  # Estrutura HTML principal
├── LICENSE                     # Licença do projeto
└── README.md                   # Este arquivo
```

---

## 🛠️ Tecnologias

- **HTML5**: Estrutura semântica e acessível
- **CSS3**: Grid Layout, Flexbox, Animações, Media Queries
- **JavaScript Vanilla**: ES6+, Fetch API, LocalStorage, DOM Manipulation
- **Marked.js** (CDN): Parser Markdown → HTML
- **Google Fonts** (CDN): Lora, Inter

**Sem frameworks, sem build tools, sem Node.js!**

---

## ⚙️ Configuração

### Alterar o arquivo de origem

Edite `assets/script.js` na linha 10:

```javascript
const CONFIG = {
    MARKDOWN_FILE: './readme_history/README.md',  // Altere aqui
    // ...
};
```

### Personalizar cores

Edite `assets/style.css` nas variáveis CSS (`:root`):

```css
:root {
    --color-bg-primary: #1a1410;
    --color-accent-gold: #d4af37;
    /* ... */
}
```

---

## 🎯 Atalhos de Teclado

| Tecla | Ação |
|-------|------|
| `←` | Página anterior |
| `→` | Próxima página |
| `Esc` | Fechar sidebar/modal |
| `Enter` | Executar busca (quando no campo de busca) |

---

## 📜 Estrutura do Markdown

Para melhor aproveitamento, estruture seu `readme_history/README.md` assim:

```markdown
# Título Principal (Capa)

Descrição introdutória...

## Capítulo 1: Nome do Capítulo

Conteúdo do capítulo...

### Subseção

Conteúdo da subseção...

> Blockquote importante

* Lista de itens
* Outro item

## Capítulo 2: Outro Capítulo

- [ ] Checkbox não marcado
- [x] Checkbox marcado

...
```

---

## 🐛 Troubleshooting

### Erro ao carregar README.md

- **Causa**: CORS policy ao abrir `index.html` diretamente
- **Solução**: Use um servidor local (veja seção "Como Usar")

### Conteúdo não aparece

- **Verifique**: O arquivo está em `readme_history/README.md`?
- **Verifique**: O console do navegador mostra erros?

### Navegação não funciona

- **Verifique**: JavaScript está habilitado no navegador?
- **Verifique**: `marked.js` foi carregado? (inspecione Network tab)

---

## 📄 Licença

Este projeto está licenciado sob a [MIT License](LICENSE).

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou pull requests.

---

## 🌟 Créditos

Desenvolvido por [Daniel Paiva](https://github.com/danhpaiva)

**Bibliotecas**:
- [Marked.js](https://marked.js.org/) - Markdown parser
- [Google Fonts](https://fonts.google.com/) - Tipografia Lora e Inter

---

## 📞 Contato

- GitHub: [@danhpaiva](https://github.com/danhpaiva)
- Repositório: [pages-revealed-html-css-js](https://github.com/danhpaiva/pages-revealed-html-css-js)

---

**Pages Revealed** - *Transformando relatos em experiências de leitura imersivas* 📖✨
