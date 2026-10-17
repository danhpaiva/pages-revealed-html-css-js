/* O Livro: lê o markdown e o divide em várias páginas que cabem na tela,
   exibidas como um livro aberto (duas páginas no desktop, uma no celular). */
(function () {
    const ENCRYPTED_FILE = '../content/livro.enc.json';
    const STORAGE_KEY = 'pagesRevealed_book_v2';
    const SPREAD_MIN_WIDTH = 821;

    const $ = (id) => document.getElementById(id);
    const el = {
        book: $('book'), closed: $('closed-book'), controls: $('controls'), loading: $('loading'),
        error: $('error'), errorText: $('error-text'), retry: $('retry'),
        left: $('inner-left'), right: $('inner-right'), pageLeft: $('page-left'),
        numLeft: $('num-left'), numRight: $('num-right'), headRight: $('head-right'),
        prev: $('prev'), next: $('next'), statusText: $('status-text'), barFill: $('bar-fill'),
        pages: document.querySelector('.pages'),
        drawer: $('drawer'), scrim: $('scrim'), drawerBody: $('drawer-body'),
        searchForm: $('search-form'), searchInput: $('search-input'),
        lock: $('lock'), lockInput: $('lock-input'), lockButton: $('lock-button'), lockMsg: $('lock-msg'),
    };

    const S = {
        source: [],     // blocos originais do markdown
        blocks: [],     // blocos paginados (itens longos podem ser divididos em dois)
        pages: [],      // { start, end, chapter }
        toc: [],        // { level, text, page }
        current: 0,     // índice da página (esquerda / única)
        perView: 2,
        fontScale: 1,
        highlight: '',
        opened: false,
    };

    // ---------------------------------------------------------
    // Armazenamento
    // ---------------------------------------------------------
    function store(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
    }
    function load(key, fallback) {
        try {
            const v = localStorage.getItem(key);
            return v === null ? fallback : JSON.parse(v);
        } catch { return fallback; }
    }

    // ---------------------------------------------------------
    // Markdown -> blocos
    // ---------------------------------------------------------
    function buildBlocks(md) {
        const tpl = document.createElement('div');
        tpl.innerHTML = marked.parse(md);
        const blocks = [];
        let chapter = '';

        const push = (node, extra) => {
            const tag = node.tagName.toLowerCase();
            blocks.push(Object.assign({ html: node.outerHTML, tag, text: node.textContent.replace(/\s+/g, ' ').trim(), chapter, src: blocks.length }, extra));
        };

        for (const node of Array.from(tpl.children)) {
            const tag = node.tagName.toLowerCase();
            if (tag === 'h1' || tag === 'h2') chapter = node.textContent.trim();
            if (tag === 'ul' || tag === 'ol') {
                // Cada item vira um bloco para poder quebrar listas longas entre páginas
                const start = tag === 'ol' ? parseInt(node.getAttribute('start') || '1', 10) : 0;
                Array.from(node.children).forEach((li, i) => {
                    const wrap = document.createElement(tag);
                    wrap.className = 'split';
                    if (tag === 'ol') wrap.setAttribute('start', String(start + i));
                    wrap.appendChild(li.cloneNode(true));
                    push(wrap);
                });
            } else {
                push(node, { breakBefore: tag === 'h2' });
            }
        }
        return blocks;
    }

    // ---------------------------------------------------------
    // Paginação por medição
    // ---------------------------------------------------------
    function htmlText(html) {
        const t = document.createElement('div');
        t.innerHTML = html;
        return t.textContent.replace(/\s+/g, ' ').trim();
    }

    // Divide um parágrafo/item no ponto de palavra em que a página fica cheia
    function splitBlock(html, fits) {
        const VOID = /^<(br|img|input|hr)[\s>/]/i;
        const toks = html.split(/(<[^>]+>)/).filter(Boolean)
            .flatMap((t) => (t[0] === '<' ? [t] : t.split(/(\s+)/).filter(Boolean)));
        const cuts = [];
        toks.forEach((t, i) => { if (t[0] !== '<' && /^\s+$/.test(t)) cuts.push(i); });
        if (cuts.length < 6) return null;

        const build = (at) => {
            const stack = [];
            for (let k = 0; k < at; k++) {
                const t = toks[k];
                if (t[0] !== '<' || VOID.test(t)) continue;
                if (t[1] === '/') stack.pop(); else stack.push(t);
            }
            const closers = stack.slice().reverse().map((t) => `</${t.match(/^<([a-z0-9]+)/i)[1]}>`).join('');
            let tail = stack.join('') + toks.slice(at + 1).join('');
            tail = tail.replace('<li', '<li class="cont"');
            return { head: toks.slice(0, at).join('') + closers, tail };
        };

        let lo = 0, hi = cuts.length - 1, best = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (fits(build(cuts[mid]).head)) { best = mid; lo = mid + 1; } else hi = mid - 1;
        }
        if (best < 0) return null;
        const res = build(cuts[best]);
        if (htmlText(res.head).length < 50 || htmlText(res.tail).length < 25) return null;
        return res;
    }

    function paginate() {
        const inner = el.left;
        const rect = inner.getBoundingClientRect();
        const measure = document.createElement('div');
        measure.className = 'page-inner measuring';
        measure.style.width = rect.width + 'px';
        measure.style.height = rect.height + 'px';
        measure.setAttribute('aria-hidden', 'true');
        inner.parentElement.appendChild(measure);

        S.blocks = S.source.slice();
        const overflows = () => measure.scrollHeight > measure.clientHeight + 1;
        const fits = (html) => {
            measure.insertAdjacentHTML('beforeend', html);
            const ok = !overflows();
            measure.lastElementChild.remove();
            return ok;
        };
        const pages = [];
        let start = 0, count = 0, lastTag = '';

        const closePage = (end) => {
            pages.push({ start, end, chapter: S.blocks[start] ? S.blocks[start].chapter : '' });
            start = end;
            count = 0;
            lastTag = '';
            measure.innerHTML = '';
        };

        for (let i = 0; i < S.blocks.length; i++) {
            const b = S.blocks[i];
            if (count === 0 && b.tag === 'hr') { start = i + 1; continue; }
            if (b.breakBefore && count > 0) closePage(i);

            measure.insertAdjacentHTML('beforeend', b.html);
            if (overflows() && count > 0) {
                measure.lastElementChild.remove();
                const parts = (b.tag === 'p' || b.tag === 'ul' || b.tag === 'ol') ? splitBlock(b.html, fits) : null;
                if (parts) {
                    const mk = (html) => Object.assign({}, b, { html, text: htmlText(html), breakBefore: false });
                    S.blocks.splice(i, 1, mk(parts.head), mk(parts.tail));
                    closePage(i + 1);
                    continue;
                }
                let cut = i;
                if (/^h[1-6]$/.test(lastTag) && count > 1) cut = i - 1; // título nunca fica sozinho no fim
                closePage(cut);
                i = cut - 1;
                continue;
            }
            count++;
            lastTag = b.tag;
        }
        if (count > 0 || start < S.blocks.length) closePage(S.blocks.length);

        measure.remove();
        S.pages = pages.filter((p) => p.end > p.start);

        // Índice
        S.toc = [];
        S.pages.forEach((p, pi) => {
            for (let i = p.start; i < p.end; i++) {
                const t = S.blocks[i].tag;
                if (t === 'h1' || t === 'h2' || t === 'h3') {
                    S.toc.push({ level: t === 'h3' ? 3 : 2, text: S.blocks[i].text, page: pi });
                }
            }
        });
    }

    // ---------------------------------------------------------
    // Renderização
    // ---------------------------------------------------------
    function pageHtml(i) {
        const p = S.pages[i];
        if (!p) return '';
        let html = '';
        for (let k = p.start; k < p.end; k++) html += S.blocks[k].html;
        return html;
    }

    function snapCurrent() {
        if (S.perView === 2) S.current -= S.current % 2;
        S.current = Math.max(0, Math.min(S.current, S.pages.length - 1));
        if (S.perView === 2) S.current -= S.current % 2;
    }

    function render(direction) {
        snapCurrent();
        const l = S.current, r = S.current + 1;
        el.left.innerHTML = pageHtml(l);
        el.right.innerHTML = S.perView === 2 ? pageHtml(r) : '';
        el.left.scrollTop = 0;
        el.numLeft.textContent = l + 1;
        el.numRight.textContent = S.perView === 2 && S.pages[r] ? r + 1 : '';
        el.headRight.textContent = S.perView === 2 && S.pages[r] ? S.pages[r].chapter.replace(/^\p{Extended_Pictographic}️?\s*/u, '') : '';
        el.pageLeft.querySelector('.runhead').textContent = S.perView === 1 && S.pages[l]
            ? S.pages[l].chapter.replace(/^\p{Extended_Pictographic}️?\s*/u, '') : 'Pages Revealed';

        const total = S.pages.length;
        const shownEnd = S.perView === 2 && S.pages[r] ? r + 1 : l + 1;
        el.statusText.textContent = S.perView === 2 && shownEnd !== l + 1
            ? `Páginas ${l + 1}–${shownEnd} de ${total}` : `Página ${l + 1} de ${total}`;
        el.barFill.style.width = `${(shownEnd / total) * 100}%`;
        el.prev.disabled = l <= 0;
        el.next.disabled = S.current + S.perView >= total;

        if (S.highlight) applyHighlight(S.highlight);

        if (direction) {
            el.pages.classList.remove('turn-next', 'turn-prev');
            void el.pages.offsetWidth;
            el.pages.classList.add(direction > 0 ? 'turn-next' : 'turn-prev');
        }

        // Páginas que ainda excedem (parágrafo gigante) ganham rolagem
        [el.left, el.right].forEach((n) => n.classList.toggle('scroll', n.scrollHeight > n.clientHeight + 2));

        updateTocActive();
        if (S.pages[S.current]) store(STORAGE_KEY, { block: S.blocks[S.pages[S.current].start].src, font: S.fontScale });
    }

    function applyHighlight(term) {
        const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        [el.left, el.right].forEach((root) => {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            const nodes = [];
            while (walker.nextNode()) nodes.push(walker.currentNode);
            nodes.forEach((n) => {
                if (!re.test(n.nodeValue)) return;
                re.lastIndex = 0;
                const span = document.createElement('span');
                span.innerHTML = n.nodeValue.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(re, (m) => `<mark>${m}</mark>`);
                n.replaceWith(...span.childNodes);
            });
        });
    }

    // ---------------------------------------------------------
    // Navegação
    // ---------------------------------------------------------
    function go(delta) {
        const target = S.current + delta * S.perView;
        if (target < 0 || target >= S.pages.length) return;
        S.current = target;
        S.highlight = '';
        render(delta);
    }

    function goToPage(i) {
        const dir = i >= S.current ? 1 : -1;
        S.current = i;
        render(dir);
    }

    // ---------------------------------------------------------
    // Índice e busca
    // ---------------------------------------------------------
    function buildToc() {
        el.drawerBody.innerHTML = '';
        S.toc.forEach((t) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'toc-item' + (t.level === 3 ? ' sub' : '');
            b.dataset.page = t.page;
            b.innerHTML = `<span class="pg">${t.page + 1}</span>`;
            b.appendChild(document.createTextNode(t.text));
            b.addEventListener('click', () => { closeDrawer(); goToPage(t.page); });
            el.drawerBody.appendChild(b);
        });
    }

    function updateTocActive() {
        const items = el.drawerBody.querySelectorAll('.toc-item');
        if (!items.length) return;
        const range = [S.current, S.current + S.perView - 1];
        let active = null;
        items.forEach((it) => { if (+it.dataset.page <= range[1]) active = it; it.classList.remove('active'); });
        if (active && !el.drawerBody.querySelector('.result')) active.classList.add('active');
    }

    function search(term) {
        const q = term.trim();
        if (!q) { buildToc(); updateTocActive(); return; }
        const low = q.toLowerCase();
        el.drawerBody.innerHTML = '';
        let found = 0;
        S.pages.forEach((p, pi) => {
            let text = '';
            for (let k = p.start; k < p.end; k++) text += S.blocks[k].text + ' ';
            const pos = text.toLowerCase().indexOf(low);
            if (pos < 0) return;
            found++;
            const from = Math.max(0, pos - 50), to = Math.min(text.length, pos + q.length + 70);
            const snippet = (from > 0 ? '…' : '') + text.slice(from, to) + (to < text.length ? '…' : '');
            const safe = snippet.replace(/&/g, '&amp;').replace(/</g, '&lt;');
            const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'result';
            b.innerHTML = `<span class="pg">p. ${pi + 1}</span>${p.chapter.replace(/&/g, '&amp;').replace(/</g, '&lt;')}<small>${safe.replace(re, (m) => `<mark>${m}</mark>`)}</small>`;
            b.addEventListener('click', () => { closeDrawer(); S.highlight = q; goToPage(pi); });
            el.drawerBody.appendChild(b);
        });
        if (!found) el.drawerBody.innerHTML = `<p class="drawer-note">Nada encontrado para “${q.replace(/&/g, '&amp;').replace(/</g, '&lt;')}”.</p>`;
    }

    function openDrawer() {
        el.drawer.classList.add('open');
        el.scrim.classList.add('on');
        el.drawer.setAttribute('aria-hidden', 'false');
        const active = el.drawerBody.querySelector('.toc-item.active');
        if (active) active.scrollIntoView({ block: 'center' });
    }
    function closeDrawer() {
        el.drawer.classList.remove('open');
        el.scrim.classList.remove('on');
        el.drawer.setAttribute('aria-hidden', 'true');
    }

    // ---------------------------------------------------------
    // Layout / repaginação
    // ---------------------------------------------------------
    function applyFont() {
        const base = window.innerWidth < SPREAD_MIN_WIDTH ? 16 : 17;
        document.documentElement.style.setProperty('--font-size', `${(base * S.fontScale).toFixed(1)}px`);
    }

    function relayout() {
        if (!S.blocks.length) return;
        const anchor = S.pages[S.current] ? S.blocks[S.pages[S.current].start].src : load(STORAGE_KEY, {}).block || 0;
        S.perView = window.innerWidth >= SPREAD_MIN_WIDTH ? 2 : 1;
        el.book.classList.toggle('single', S.perView === 1);
        applyFont();
        paginate();
        const idx = S.pages.findIndex((p) => S.blocks[p.end - 1].src >= anchor);
        S.current = idx < 0 ? 0 : idx;
        buildToc();
        render();
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { if (S.opened) relayout(); }, 180);
    });

    function changeFont(delta) {
        S.fontScale = Math.max(0.85, Math.min(1.5, +(S.fontScale + delta).toFixed(2)));
        relayout();
    }

    // ---------------------------------------------------------
    // Abertura
    // ---------------------------------------------------------
    function showBook() {
        S.opened = true;
        el.closed.classList.add('hidden');
        el.book.classList.remove('hidden');
        el.controls.classList.remove('hidden');
        relayout();
    }

    function openCover() {
        if (S.opened) return;
        el.closed.classList.add('opening');
        setTimeout(showBook, 850);
    }

    // ---------------------------------------------------------
    // Senha: o livro fica criptografado (AES-GCM, chave via PBKDF2) e só é
    // decifrado aqui no navegador. Sem a senha o conteúdo não existe no site.
    // ---------------------------------------------------------
    const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const SESSION_KEY = 'pagesRevealed_session';

    async function decryptBook(pkg, password) {
        const enc = new TextEncoder();
        const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
        const key = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: fromB64(pkg.salt), iterations: pkg.iter, hash: 'SHA-256' },
            base,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt'],
        );
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(pkg.iv) }, key, fromB64(pkg.data));
        return new TextDecoder().decode(plain);
    }

    function showError(message) {
        el.loading.classList.add('hidden');
        el.lock.classList.add('hidden');
        el.closed.classList.add('hidden');
        document.body.classList.add('locked');
        el.errorText.textContent = message;
        el.error.classList.remove('hidden');
    }

    async function startBook(md, saved) {
        if (typeof marked === 'undefined') throw new Error('Não foi possível carregar o leitor de Markdown (sem internet?).');
        if (!md.trim()) throw new Error('O livro está vazio.');
        S.source = buildBlocks(md);
        S.blocks = S.source.slice();
        // O título só aparece depois da senha: vem do primeiro # do texto decifrado
        const h1 = S.source.find((b) => b.tag === 'h1');
        $('closed-title').textContent = h1 ? h1.text.replace(/^\p{Extended_Pictographic}️?\s*/u, '') : '';
        if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
        el.loading.classList.add('hidden');
        el.lock.classList.add('hidden');
        document.body.classList.remove('locked');
        if (saved.block > 0) {
            // quem já estava lendo volta direto à página
            el.book.classList.remove('hidden');
            el.controls.classList.remove('hidden');
            S.opened = true;
            relayout();
        } else {
            el.closed.classList.remove('hidden');
        }
    }

    async function init() {
        const saved = load(STORAGE_KEY, {});
        if (saved.font) S.fontScale = saved.font;

        let pkg;
        try {
            if (!window.crypto || !crypto.subtle) throw new Error('Este navegador não permite abrir o livro (é preciso HTTPS).');
            const res = await fetch(ENCRYPTED_FILE);
            if (!res.ok) throw new Error(`Erro ao carregar o livro (${res.status}).`);
            pkg = await res.json();
        } catch (err) {
            showError(err.message);
            console.error(err);
            return;
        }

        const tryUnlock = async (password) => {
            const md = await decryptBook(pkg, password);
            try { sessionStorage.setItem(SESSION_KEY, password); } catch { /* ignore */ }
            await startBook(md, saved);
        };

        // Mesma aba: não pede a senha de novo ao recarregar
        let remembered = null;
        try { remembered = sessionStorage.getItem(SESSION_KEY); } catch { /* ignore */ }
        if (remembered) {
            el.loading.classList.remove('hidden');
            try { await tryUnlock(remembered); return; } catch { el.loading.classList.add('hidden'); }
        }

        el.lock.classList.remove('hidden');
        el.lockInput.focus();
        let failures = 0;
        el.lock.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = el.lockInput.value;
            if (!password || el.lockButton.disabled) return;
            el.lockButton.disabled = true;
            el.lockMsg.textContent = 'Abrindo...';
            el.lock.classList.remove('shake');
            try {
                await tryUnlock(password);
            } catch (err) {
                if (err instanceof SyntaxError || (err && err.name !== 'OperationError')) { console.error(err); }
                failures++;
                el.lockMsg.textContent = 'Senha incorreta.';
                el.lockInput.value = '';
                el.lockInput.focus();
                void el.lock.offsetWidth;
                el.lock.classList.add('shake');
                // pequena espera crescente entre tentativas
                setTimeout(() => { el.lockButton.disabled = false; }, Math.min(1000 * failures, 8000));
            }
        });
    }

    // ---------------------------------------------------------
    // Eventos
    // ---------------------------------------------------------
    el.closed.addEventListener('click', openCover);
    el.prev.addEventListener('click', () => go(-1));
    el.next.addEventListener('click', () => go(1));
    $('font-up').addEventListener('click', () => changeFont(0.1));
    $('font-down').addEventListener('click', () => changeFont(-0.1));
    $('open-index').addEventListener('click', openDrawer);
    $('close-index').addEventListener('click', closeDrawer);
    el.scrim.addEventListener('click', closeDrawer);
    el.retry.addEventListener('click', () => location.reload());
    el.searchForm.addEventListener('submit', (e) => { e.preventDefault(); search(el.searchInput.value); });
    el.searchInput.addEventListener('input', () => { if (!el.searchInput.value) { buildToc(); updateTocActive(); } });

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') closeDrawer(); return; }
        if (e.key === 'Escape') closeDrawer();
        else if (!S.opened && (e.key === 'Enter' || e.key === ' ')) return;
        else if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1);
        else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1);
    });

    // gesto de deslizar no celular
    let tx = 0, ty = 0;
    el.book.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
    el.book.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
        if (Math.abs(dx) > 60 && Math.abs(dy) < 70) go(dx < 0 ? 1 : -1);
    }, { passive: true });

    init();
})();
