/**
 * Pages Revealed - Interactive Markdown Book Reader
 * Vanilla JavaScript implementation with no external dependencies
 */

// ============================================
// Constants & Configuration
// ============================================
const CONFIG = {
    MARKDOWN_FILE: './readme_history/README.md',
    STORAGE_KEY: 'pagesRevealed_lastPage',
    FETCH_TIMEOUT: 10000,
    TRANSITION_DURATION: 300,
};

// ============================================
// Global State
// ============================================
const state = {
    chapters: [],
    currentPageIndex: 0,
    markdownContent: '',
    searchTerm: '',
};

// ============================================
// DOM Elements
// ============================================
const elements = {
    loadingOverlay: null,
    errorMessage: null,
    errorText: null,
    retryButton: null,
    app: null,
    menuToggle: null,
    sidebar: null,
    sidebarOverlay: null,
    sidebarClose: null,
    tocNav: null,
    pageContent: null,
    prevButton: null,
    nextButton: null,
    progressFill: null,
    progressText: null,
    searchInput: null,
    searchButton: null,
    searchModal: null,
    searchResults: null,
    searchClose: null,
};

// ============================================
// Initialization
// ============================================
function init() {
    // Cache DOM elements
    cacheElements();

    // Attach event listeners
    attachEventListeners();

    // Load markdown content
    loadMarkdown();
}

function cacheElements() {
    elements.loadingOverlay = document.getElementById('loading-overlay');
    elements.errorMessage = document.getElementById('error-message');
    elements.errorText = document.getElementById('error-text');
    elements.retryButton = document.getElementById('retry-button');
    elements.app = document.getElementById('app');
    elements.menuToggle = document.getElementById('menu-toggle');
    elements.sidebar = document.getElementById('sidebar');
    elements.sidebarOverlay = document.getElementById('sidebar-overlay');
    elements.sidebarClose = document.getElementById('sidebar-close');
    elements.tocNav = document.getElementById('toc-nav');
    elements.pageContent = document.getElementById('page-content');
    elements.prevButton = document.getElementById('prev-page');
    elements.nextButton = document.getElementById('next-page');
    elements.progressFill = document.getElementById('progress-fill');
    elements.progressText = document.getElementById('progress-text');
    elements.searchInput = document.getElementById('search-input');
    elements.searchButton = document.getElementById('search-button');
    elements.searchModal = document.getElementById('search-modal');
    elements.searchResults = document.getElementById('search-results');
    elements.searchClose = document.getElementById('search-close');
}

function attachEventListeners() {
    // Navigation
    elements.prevButton.addEventListener('click', navigatePrevious);
    elements.nextButton.addEventListener('click', navigateNext);

    // Keyboard navigation
    document.addEventListener('keydown', handleKeyboardNavigation);

    // Sidebar/Menu
    elements.menuToggle.addEventListener('click', openSidebar);
    elements.sidebarClose.addEventListener('click', closeSidebar);
    elements.sidebarOverlay.addEventListener('click', closeSidebar);

    // Search
    elements.searchButton.addEventListener('click', performSearch);
    elements.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    elements.searchClose.addEventListener('click', closeSearchModal);

    // Retry button
    elements.retryButton.addEventListener('click', () => {
        hideError();
        loadMarkdown();
    });
}

// ============================================
// Markdown Loading & Parsing
// ============================================
async function loadMarkdown() {
    showLoading();

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT);

        const response = await fetch(CONFIG.MARKDOWN_FILE, {
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Erro ao carregar o arquivo: ${response.status} ${response.statusText}`);
        }

        const text = await response.text();

        if (!text || text.trim() === '') {
            throw new Error('O arquivo README.md está vazio.');
        }

        state.markdownContent = text;
        parseMarkdown(text);
        initializeApp();
    } catch (error) {
        let errorMsg = 'Erro desconhecido ao carregar o dossiê.';

        if (error.name === 'AbortError') {
            errorMsg = 'Tempo limite excedido ao carregar o arquivo.';
        } else if (error.message) {
            errorMsg = error.message;
        }

        showError(errorMsg);
        console.error('Load error:', error);
    }
}

function parseMarkdown(markdown) {
    // Split by level 2 headings to create chapters
    const lines = markdown.split('\n');
    const chapters = [];
    let currentChapter = null;
    let coverPage = { title: 'Capa', content: [], iscover: true };

    lines.forEach((line, index) => {
        // Check for H1 (Cover page)
        if (line.startsWith('# ') && !currentChapter) {
            coverPage.content.push(line);
        }
        // Check for H2 (Chapter boundary)
        else if (line.startsWith('## ')) {
            // Save previous chapter
            if (currentChapter) {
                chapters.push(currentChapter);
            }
            // Start new chapter
            currentChapter = {
                title: line.replace('## ', '').trim(),
                content: [line],
            };
        }
        // Add content to current chapter or cover
        else {
            if (currentChapter) {
                currentChapter.content.push(line);
            } else {
                coverPage.content.push(line);
            }
        }
    });

    // Push last chapter
    if (currentChapter) {
        chapters.push(currentChapter);
    }

    // Add cover page at the beginning
    if (coverPage.content.length > 0) {
        chapters.unshift(coverPage);
    }

    // Convert content arrays to markdown strings
    state.chapters = chapters.map((chapter) => ({
        ...chapter,
        content: chapter.content.join('\n'),
    }));
}

function initializeApp() {
    hideLoading();
    elements.app.classList.remove('hidden');

    // Build table of contents
    buildTableOfContents();

    // Load saved progress or start at first page
    const savedPage = loadProgress();
    if (savedPage >= 0 && savedPage < state.chapters.length) {
        state.currentPageIndex = savedPage;
    }

    // Render first page
    renderCurrentPage();
}

// ============================================
// Table of Contents
// ============================================
function buildTableOfContents() {
    elements.tocNav.innerHTML = '';

    state.chapters.forEach((chapter, index) => {
        const button = document.createElement('button');
        button.className = 'toc-item';
        button.textContent = chapter.title;
        button.setAttribute('aria-label', `Ir para ${chapter.title}`);
        button.addEventListener('click', () => {
            navigateToPage(index);
            closeSidebar();
        });

        elements.tocNav.appendChild(button);
    });
}

function updateTableOfContents() {
    const tocItems = elements.tocNav.querySelectorAll('.toc-item');
    tocItems.forEach((item, index) => {
        if (index === state.currentPageIndex) {
            item.classList.add('active');
            item.setAttribute('aria-current', 'page');
        } else {
            item.classList.remove('active');
            item.removeAttribute('aria-current');
        }
    });
}

// ============================================
// Page Rendering
// ============================================
function renderCurrentPage() {
    const chapter = state.chapters[state.currentPageIndex];

    if (!chapter) {
        elements.pageContent.innerHTML = '<p>Capítulo não encontrado.</p>';
        return;
    }

    // Parse markdown to HTML using marked.js
    let html = marked.parse(chapter.content);

    // Post-process: make checkboxes interactive
    html = html.replace(
        /<input type="checkbox"([^>]*)>/g,
        '<input type="checkbox" $1 onclick="return false;">'
    );

    elements.pageContent.innerHTML = html;

    // Update navigation buttons
    updateNavigationButtons();

    // Update progress indicator
    updateProgress();

    // Update table of contents
    updateTableOfContents();

    // Save progress
    saveProgress(state.currentPageIndex);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateNavigationButtons() {
    // Previous button
    if (state.currentPageIndex === 0) {
        elements.prevButton.disabled = true;
    } else {
        elements.prevButton.disabled = false;
    }

    // Next button
    if (state.currentPageIndex >= state.chapters.length - 1) {
        elements.nextButton.disabled = true;
    } else {
        elements.nextButton.disabled = false;
    }
}

function updateProgress() {
    const totalPages = state.chapters.length;
    const currentPage = state.currentPageIndex + 1;
    const percentage = (currentPage / totalPages) * 100;

    elements.progressFill.style.width = `${percentage}%`;
    elements.progressText.textContent = `Página ${currentPage} de ${totalPages}`;
}

// ============================================
// Navigation
// ============================================
function navigateToPage(index) {
    if (index < 0 || index >= state.chapters.length) return;

    state.currentPageIndex = index;
    renderCurrentPage();
}

function navigatePrevious() {
    if (state.currentPageIndex > 0) {
        navigateToPage(state.currentPageIndex - 1);
    }
}

function navigateNext() {
    if (state.currentPageIndex < state.chapters.length - 1) {
        navigateToPage(state.currentPageIndex + 1);
    }
}

function handleKeyboardNavigation(e) {
    // Ignore if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'ArrowLeft') {
        navigatePrevious();
    } else if (e.key === 'ArrowRight') {
        navigateNext();
    } else if (e.key === 'Escape') {
        closeSidebar();
        closeSearchModal();
    }
}

// ============================================
// Sidebar
// ============================================
function openSidebar() {
    elements.sidebar.classList.add('open');
    elements.sidebarOverlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    elements.sidebar.classList.remove('open');
    elements.sidebarOverlay.classList.remove('visible');
    document.body.style.overflow = '';
}

// ============================================
// Search
// ============================================
function performSearch() {
    const query = elements.searchInput.value.trim();

    if (!query) {
        return;
    }

    state.searchTerm = query.toLowerCase();

    const results = [];

    state.chapters.forEach((chapter, index) => {
        const contentLower = chapter.content.toLowerCase();
        if (contentLower.includes(state.searchTerm)) {
            // Extract a snippet with context
            const position = contentLower.indexOf(state.searchTerm);
            const start = Math.max(0, position - 60);
            const end = Math.min(chapter.content.length, position + state.searchTerm.length + 60);
            let snippet = chapter.content.substring(start, end);

            if (start > 0) snippet = '...' + snippet;
            if (end < chapter.content.length) snippet = snippet + '...';

            results.push({
                chapterIndex: index,
                title: chapter.title,
                snippet: snippet,
            });
        }
    });

    displaySearchResults(results);
}

function displaySearchResults(results) {
    elements.searchResults.innerHTML = '';

    if (results.length === 0) {
        elements.searchResults.innerHTML = `
            <div class="search-no-results">
                <p>Nenhum resultado encontrado para "${state.searchTerm}".</p>
            </div>
        `;
    } else {
        results.forEach((result) => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';

            // Highlight the search term in the snippet
            const highlightedSnippet = highlightTerm(result.snippet, state.searchTerm);

            resultItem.innerHTML = `
                <h3>${result.title}</h3>
                <p>${highlightedSnippet}</p>
            `;

            resultItem.addEventListener('click', () => {
                navigateToPage(result.chapterIndex);
                closeSearchModal();
                highlightSearchTerm();
            });

            elements.searchResults.appendChild(resultItem);
        });
    }

    openSearchModal();
}

function highlightTerm(text, term) {
    const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightSearchTerm() {
    if (!state.searchTerm) return;

    // Highlight in the current page
    const content = elements.pageContent.innerHTML;
    const highlighted = highlightTerm(content, state.searchTerm);
    elements.pageContent.innerHTML = highlighted;
}

function openSearchModal() {
    elements.searchModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeSearchModal() {
    elements.searchModal.classList.add('hidden');
    document.body.style.overflow = '';
    state.searchTerm = '';
}

// ============================================
// Local Storage (Progress Persistence)
// ============================================
function saveProgress(pageIndex) {
    try {
        localStorage.setItem(CONFIG.STORAGE_KEY, pageIndex.toString());
    } catch (error) {
        console.warn('LocalStorage not available:', error);
    }
}

function loadProgress() {
    try {
        const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
        return saved !== null ? parseInt(saved, 10) : 0;
    } catch (error) {
        console.warn('LocalStorage not available:', error);
        return 0;
    }
}

// ============================================
// UI State Management
// ============================================
function showLoading() {
    elements.loadingOverlay.classList.remove('hidden');
    elements.errorMessage.classList.add('hidden');
    elements.app.classList.add('hidden');
}

function hideLoading() {
    elements.loadingOverlay.classList.add('hidden');
}

function showError(message) {
    hideLoading();
    elements.errorText.textContent = message;
    elements.errorMessage.classList.remove('hidden');
    elements.app.classList.add('hidden');
}

function hideError() {
    elements.errorMessage.classList.add('hidden');
}

// ============================================
// Entry Point
// ============================================
// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
