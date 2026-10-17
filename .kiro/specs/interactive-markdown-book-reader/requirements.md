# Requirements Document

## Introduction

Pages Revealed é uma aplicação web estática que renderiza conteúdo Markdown (README.md) como um livro digital interativo e navegável. O sistema oferece uma experiência de leitura intimista e elegante, com navegação por páginas, índice lateral, busca interna e persistência de progresso. Toda a implementação utiliza HTML5, CSS3 e JavaScript Vanilla puro, sem frameworks externos, com deploy automatizado via GitHub Actions para GitHub Pages.

## Glossary

- **Application**: A aplicação web estática Pages Revealed
- **Markdown_Parser**: Componente responsável por parsear o arquivo README.md usando marked.js via CDN
- **Page_Navigator**: Componente que gerencia a navegação entre capítulos/páginas do livro
- **Progress_Tracker**: Componente que salva e recupera o progresso de leitura do usuário
- **Search_Engine**: Componente que implementa busca de texto nos relatos
- **Table_of_Contents**: Menu lateral/retrátil com índice dos capítulos
- **UI_Renderer**: Componente que renderiza elementos visuais HTML/CSS
- **Storage_Manager**: Componente que gerencia localStorage para persistência
- **Keyboard_Handler**: Componente que processa atalhos de teclado
- **README_File**: Arquivo README.md na raiz do repositório contendo os relatos em Markdown
- **Chapter**: Seção de conteúdo delimitada por cabeçalho `##` no README.md
- **Cover_Page**: Página inicial do livro baseada no título principal `#` do README.md
- **Interactive_Checkbox**: Elemento checkbox renderizado a partir de `- [ ]` ou `- [x]` no Markdown
- **Blockquote**: Citação em destaque renderizada a partir de `>` no Markdown
- **Subsection**: Subdivisão de conteúdo delimitada por cabeçalho `###` no README.md

## Requirements

### Requirement 1: Fetch e Parse do Arquivo Markdown

**User Story:** Como desenvolvedor, eu quero que a aplicação carregue e parse o arquivo README.md dinamicamente, para que o conteúdo dos relatos seja renderizado sem hardcoding manual.

#### Acceptance Criteria

1. WHEN the Application loads, THE Markdown_Parser SHALL fetch the README_File from the repository root using the Fetch API
2. IF the README_File fetch fails, THEN THE Application SHALL display an error message to the user
3. WHEN the README_File is successfully fetched, THE Markdown_Parser SHALL parse the Markdown content using marked.js library loaded via CDN
4. THE Markdown_Parser SHALL identify the main title (heading level 1 `#`) as the Cover_Page content
5. THE Markdown_Parser SHALL identify each heading level 2 (`##`) as a Chapter boundary
6. THE Markdown_Parser SHALL group all content between two consecutive Chapter headings into a single Chapter object
7. THE Markdown_Parser SHALL preserve heading level 3 (`###`) markers as Subsection identifiers within each Chapter
8. THE Markdown_Parser SHALL preserve blockquote markers (`>`) for specialized rendering
9. THE Markdown_Parser SHALL preserve checkbox syntax (`- [ ]` and `- [x]`) for interactive rendering
10. FOR ALL valid Markdown content, parsing SHALL produce a structured array of Chapter objects containing HTML-rendered content

### Requirement 2: Renderização Visual de Elementos Especiais

**User Story:** Como leitor, eu quero que elementos especiais do Markdown sejam renderizados com estilos visuais diferenciados, para que a experiência de leitura seja rica e organizada.

#### Acceptance Criteria

1. WHEN the UI_Renderer processes a Blockquote, THE UI_Renderer SHALL render it with visual distinction (border-left in gold or accent color and italic typography)
2. WHEN the UI_Renderer processes an Interactive_Checkbox, THE UI_Renderer SHALL render it as a stylized HTML checkbox element
3. WHEN a user clicks an Interactive_Checkbox, THE UI_Renderer SHALL toggle its visual state (checked/unchecked)
4. WHEN the UI_Renderer processes a Subsection heading, THE UI_Renderer SHALL render it with secondary heading styling and subtle dividers
5. THE UI_Renderer SHALL apply serif typography (Lora or Merriweather via Google Fonts) to body text content
6. THE UI_Renderer SHALL apply sans-serif typography to navigation menus and UI controls
7. THE UI_Renderer SHALL maintain a sober and elegant visual theme (diary/dossier aesthetic with dark mode or sepia tones)

### Requirement 3: Navegação por Páginas

**User Story:** Como leitor, eu quero navegar entre capítulos usando botões e teclado, para que eu possa ler o dossiê de forma sequencial e intuitiva.

#### Acceptance Criteria

1. THE Page_Navigator SHALL display "Previous Page" and "Next Page" buttons on each Chapter view
2. WHEN a user clicks "Next Page" button AND there is a next Chapter, THE Page_Navigator SHALL display the next Chapter content
3. WHEN a user clicks "Previous Page" button AND there is a previous Chapter, THE Page_Navigator SHALL display the previous Chapter content
4. WHEN a user presses the Right Arrow key AND there is a next Chapter, THE Keyboard_Handler SHALL trigger navigation to the next Chapter
5. WHEN a user presses the Left Arrow key AND there is a previous Chapter, THE Keyboard_Handler SHALL trigger navigation to the previous Chapter
6. WHEN the user is on the first Chapter, THE Page_Navigator SHALL disable or hide the "Previous Page" button
7. WHEN the user is on the last Chapter, THE Page_Navigator SHALL disable or hide the "Next Page" button
8. WHEN navigating between Chapters, THE UI_Renderer SHALL apply a smooth fade transition effect

### Requirement 4: Indicador de Progresso

**User Story:** Como leitor, eu quero visualizar meu progresso de leitura, para que eu saiba quantas páginas já li e quantas faltam.

#### Acceptance Criteria

1. THE Progress_Tracker SHALL display a page indicator showing current page number and total page count (format: "Página X de Y")
2. THE Progress_Tracker SHALL display a visual progress bar representing percentage of completion
3. WHEN the user navigates to a different Chapter, THE Progress_Tracker SHALL update the page indicator and progress bar
4. THE Progress_Tracker SHALL position the progress indicator in a visible location (top or bottom of the page)

### Requirement 5: Índice / Sumário Navegável

**User Story:** Como leitor, eu quero acessar um sumário com todos os capítulos, para que eu possa navegar rapidamente para qualquer seção de interesse.

#### Acceptance Criteria

1. THE Table_of_Contents SHALL display a list of all Chapter titles extracted from heading level 2 (`##`) markers
2. THE Table_of_Contents SHALL be accessible via a toggle button or permanently visible in a sidebar
3. WHEN a user clicks a Chapter title in the Table_of_Contents, THE Page_Navigator SHALL navigate to that Chapter
4. THE Table_of_Contents SHALL highlight the current Chapter being viewed
5. WHERE the viewport width is below 768 pixels, THE Table_of_Contents SHALL render as a collapsible drawer menu

### Requirement 6: Persistência de Progresso de Leitura

**User Story:** Como leitor, eu quero que a aplicação lembre em qual página parei, para que eu possa continuar de onde parei na próxima visita.

#### Acceptance Criteria

1. WHEN a user navigates to a Chapter, THE Storage_Manager SHALL save the current Chapter index to localStorage
2. WHEN the Application loads, THE Storage_Manager SHALL retrieve the last saved Chapter index from localStorage
3. IF a saved Chapter index exists in localStorage, THEN THE Page_Navigator SHALL navigate to that Chapter automatically
4. IF no saved Chapter index exists in localStorage, THEN THE Page_Navigator SHALL display the Cover_Page or first Chapter

### Requirement 7: Busca Interna de Conteúdo

**User Story:** Como leitor, eu quero buscar palavras ou termos dentro dos relatos, para que eu possa localizar informações específicas rapidamente.

#### Acceptance Criteria

1. THE Search_Engine SHALL provide a search input field visible in the UI
2. WHEN a user types a search term AND presses Enter or clicks a search button, THE Search_Engine SHALL search across all Chapter content
3. THE Search_Engine SHALL display a list of Chapters containing the search term
4. WHEN a user clicks a search result, THE Page_Navigator SHALL navigate to that Chapter
5. THE Search_Engine SHALL highlight the search term within the Chapter content
6. WHEN the search term is not found in any Chapter, THE Search_Engine SHALL display a "No results found" message

### Requirement 8: Deploy Automatizado via GitHub Actions

**User Story:** Como desenvolvedor, eu quero que a aplicação seja publicada automaticamente no GitHub Pages, para que cada mudança na branch main seja refletida no site publicado.

#### Acceptance Criteria

1. THE Application repository SHALL contain a GitHub Actions workflow file at `.github/workflows/deploy.yml`
2. WHEN a commit is pushed to the `main` branch, THE GitHub Actions workflow SHALL execute automatically
3. THE GitHub Actions workflow SHALL publish the repository root directory contents to GitHub Pages
4. WHEN the workflow completes successfully, THE Application SHALL be accessible via the GitHub Pages URL

### Requirement 9: Parser com Pretty Printer e Round-Trip

**User Story:** Como desenvolvedor, eu quero garantir que o parser Markdown funcione corretamente, para que o conteúdo seja renderizado com fidelidade ao arquivo original.

#### Acceptance Criteria

1. WHEN the Markdown_Parser processes valid Markdown content, THE Markdown_Parser SHALL convert it to structured HTML
2. THE Application SHALL include a Pretty_Printer component that formats structured Chapter objects back to Markdown syntax
3. FOR ALL valid Chapter objects, parsing the original Markdown then pretty-printing then parsing again SHALL produce an equivalent Chapter structure (round-trip property)
4. THE Pretty_Printer SHALL preserve heading levels, blockquotes, checkboxes, lists, and paragraph formatting

### Requirement 10: Estrutura de Arquivos e Tecnologias

**User Story:** Como desenvolvedor, eu quero que a aplicação utilize apenas HTML5, CSS3 e JavaScript Vanilla, para que não haja dependências de frameworks ou build tools.

#### Acceptance Criteria

1. THE Application SHALL consist of a single `index.html` file in the repository root
2. THE Application SHALL load CSS styles from `assets/style.css` file
3. THE Application SHALL load JavaScript code from `assets/script.js` file
4. THE Application SHALL load the marked.js Markdown parser via CDN link in the HTML
5. THE Application SHALL load Google Fonts (Lora or Merriweather for body, sans-serif for UI) via CDN link in the HTML
6. THE Application SHALL NOT use any JavaScript frameworks (React, Vue, Angular) or build tools (Webpack, Vite)
7. THE Application SHALL implement all functionality using standard Web APIs (Fetch, localStorage, DOM manipulation)

### Requirement 11: Responsividade e Acessibilidade

**User Story:** Como leitor, eu quero que a aplicação funcione bem em dispositivos móveis e seja acessível, para que eu possa ler confortavelmente em qualquer dispositivo.

#### Acceptance Criteria

1. THE UI_Renderer SHALL apply responsive CSS layouts that adapt to viewport widths from 320px to 1920px
2. WHERE the viewport width is below 768 pixels, THE UI_Renderer SHALL adjust typography sizes for mobile readability
3. WHERE the viewport width is below 768 pixels, THE Table_of_Contents SHALL render as a collapsible drawer instead of a persistent sidebar
4. THE Application SHALL provide sufficient color contrast ratios for text readability (WCAG AA minimum)
5. THE Application SHALL support keyboard navigation for all interactive elements
6. THE Application SHALL provide focus indicators for interactive elements
7. THE Application SHALL include appropriate ARIA labels for screen reader accessibility

### Requirement 12: Tratamento de Erros e Estados

**User Story:** Como usuário, eu quero que a aplicação lide graciosamente com erros e estados de carregamento, para que eu entenda o que está acontecendo em caso de problemas.

#### Acceptance Criteria

1. WHILE the README_File is being fetched, THE UI_Renderer SHALL display a loading indicator
2. IF the README_File fetch fails due to network error, THEN THE Application SHALL display an error message with retry option
3. IF the Markdown_Parser encounters invalid Markdown syntax, THEN THE Markdown_Parser SHALL log a warning and render the content as plain text
4. IF localStorage is unavailable or disabled, THEN THE Storage_Manager SHALL gracefully degrade without crashing the Application
5. WHEN JavaScript is disabled in the browser, THE Application SHALL display a message indicating that JavaScript is required

