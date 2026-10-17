/* A Galáxia do tempo.
   - A cada mês que passa, nasce uma estrela nova (formando uma constelação).
   - Quando o ano fecha (12 estrelas), elas se unem e viram um planeta.
   - A cada 5 anos, os 5 planetas entram em órbita de um sol e viram um sistema solar.
   - Só as estrelas do ano corrente e os planetas do ciclo atual ficam soltos; o
     resto vira sistemas pequenos, então a tela cresce em beleza sem ficar poluída. */
(function () {
    // ===== CONFIGURAÇÃO =====
    const START_YEAR = 2026;
    const START_MONTH = 4;          // abril de 2026 = primeira estrela
    const YEARS_PER_SYSTEM = 5;     // a cada 5 planetas (anos) nasce um sistema solar
    const FUTURE_MONTHS = 48;       // quanto o controle de tempo permite viajar adiante
    // ========================

    const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const TAU = Math.PI * 2;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    function rng(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6d2b79f5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const $ = (id) => document.getElementById(id);
    const canvas = $('sky');
    const ctx = canvas.getContext('2d');
    const panel = document.querySelector('.panel');
    const tip = $('tip');
    const slider = $('slider');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---------------------------------------------------------
    // Tempo
    // ---------------------------------------------------------
    function monthsSinceStart(date) {
        return (date.getFullYear() - START_YEAR) * 12 + (date.getMonth() + 1 - START_MONTH);
    }
    // ?hoje=AAAA-MM simula outra data (para pré-visualizar o futuro ou testar marcos)
    function currentDate() {
        const m = /^(\d{4})-(\d{1,2})$/.exec(new URLSearchParams(location.search).get('hoje') || '');
        return m ? new Date(+m[1], +m[2] - 1, 1) : new Date();
    }
    const NOW = Math.max(0, monthsSinceStart(currentDate()));
    const MAX = NOW + FUTURE_MONTHS;

    function monthLabel(idx) {
        const abs = START_MONTH - 1 + idx;
        return { name: MONTHS[abs % 12], short: SHORT[abs % 12], year: START_YEAR + Math.floor(abs / 12) };
    }

    const planetsAt = (m) => Math.floor(m / 12);
    const starsAt = (m) => (m % 12) + 1;
    const systemsAt = (m) => Math.floor(planetsAt(m) / YEARS_PER_SYSTEM);

    const state = {
        m: NOW,
        born: {},        // idx do mês -> instante em que a estrela nasceu (animação)
        merge: null,     // { t0, dur, cycle }
        playing: null,
        hover: null,
    };

    // ---------------------------------------------------------
    // Layout
    // ---------------------------------------------------------
    let W = 0, H = 0, dpr = 1, SKY_H = 0, U = 1;
    let bg = new Image();
    bg.src = '../assets/img/galaxy.jpg';
    let px = 0, py = 0, pxT = 0, pyT = 0;

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        SKY_H = Math.max(260, H - panel.getBoundingClientRect().height - 20);
        U = clamp(Math.min(W, SKY_H) / 650, 0.6, 1.25);
        planetSprites.clear();
        buildDust();
    }

    // ---------------------------------------------------------
    // Estrelas da constelação do ciclo
    // ---------------------------------------------------------
    const cycleCache = {};
    function cycleShape(c) {
        if (cycleCache[c]) return cycleCache[c];
        const r = rng(9001 + c * 131);
        const phase = r() * TAU;
        const amp = 0.7 + r() * 0.3;
        const pts = [];
        for (let k = 0; k < 12; k++) {
            const t = k / 11;
            pts.push({ t: t + (r() - 0.5) * 0.03, l: clamp(Math.sin(k * 0.95 + phase) * amp + (r() - 0.5) * 0.45, -1, 1), hue: 38 + r() * 24, sz: 0.85 + r() * 0.35 });
        }
        return (cycleCache[c] = pts);
    }

    function starPos(c, k) {
        const p = cycleShape(c)[k];
        if (W / SKY_H < 0.85) {
            // retrato: a constelação desce pela tela
            return { x: W * (0.5 + p.l * 0.34), y: SKY_H * (0.17 + p.t * 0.42), p };
        }
        return { x: W * (0.14 + p.t * 0.72), y: SKY_H * (0.38 + p.l * 0.15), p };
    }

    // ---------------------------------------------------------
    // Planetas
    // ---------------------------------------------------------
    const PALETTES = [
        { a: '#9fe0ff', b: '#1f5fa8', band: 'rgba(255,255,255,0.35)', ring: false, name: 'Aqua' },
        { a: '#ffb08a', b: '#8f2630', band: 'rgba(255,225,190,0.28)', ring: false, name: 'Rubi' },
        { a: '#ffe29a', b: '#a8651f', band: 'rgba(120,70,20,0.28)', ring: true, name: 'Âmbar' },
        { a: '#a8f0bf', b: '#1b6f4c', band: 'rgba(255,255,255,0.28)', ring: false, name: 'Esmeralda' },
        { a: '#dcb8ff', b: '#55299b', band: 'rgba(255,255,255,0.25)', ring: true, name: 'Violeta' },
        { a: '#eaf8ff', b: '#6d9bd0', band: 'rgba(90,130,190,0.3)', ring: false, name: 'Gelo' },
        { a: '#ffc0d3', b: '#a63c64', band: 'rgba(255,255,255,0.3)', ring: true, name: 'Coral' },
        { a: '#fff0b0', b: '#b8801a', band: 'rgba(130,80,10,0.3)', ring: false, name: 'Dourado' },
    ];

    const SLOTS = [
        [0.74, 0.74], [0.24, 0.8], [0.5, 0.68], [0.9, 0.9], [0.1, 0.62], [0.62, 0.9],
        [0.38, 0.9], [0.86, 0.62], [0.16, 0.92], [0.5, 0.9], [0.3, 0.66], [0.7, 0.6],
    ];

    function planetInfo(i) {
        const r = rng(4242 + i * 97);
        const pal = PALETTES[i % PALETTES.length];
        const slot = i % YEARS_PER_SYSTEM;
        const [sx, sy] = SLOTS[slot];
        const size = (0.7 + r() * 0.5) * (slot === 0 ? 1.1 : 1);
        return { i, pal, sx, sy, size, tilt: -0.5 + r() * 0.8, seed: 77 + i * 31, ring: pal.ring, phase: r() * TAU };
    }

    function planetPos(info) {
        const R = Math.min(W, SKY_H) * 0.075 * info.size * (W / SKY_H < 0.85 ? 1.15 : 1);
        const x = clamp(W * info.sx, R * 2, W - R * 2);
        const y = clamp(SKY_H * info.sy, SKY_H * 0.58, SKY_H - R * 1.2);
        return { x, y, R: Math.max(R, 16) };
    }

    const planetSprites = new Map();
    function planetSprite(info, R) {
        const key = `${info.i}:${Math.round(R)}:${dpr}`;
        if (planetSprites.has(key)) return planetSprites.get(key);
        const pad = Math.ceil(R * 0.9);
        const S = Math.ceil((R + pad) * 2);
        const c = document.createElement('canvas');
        c.width = S * dpr; c.height = S * dpr;
        const g = c.getContext('2d');
        g.scale(dpr, dpr);
        const cx = S / 2, cy = S / 2;
        const r = rng(info.seed);

        // atmosfera
        const halo = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.55);
        halo.addColorStop(0, hexA(info.pal.a, 0.4));
        halo.addColorStop(1, hexA(info.pal.a, 0));
        g.fillStyle = halo;
        g.fillRect(0, 0, S, S);

        const ring = (front) => {
            if (!info.ring) return;
            g.save();
            g.translate(cx, cy);
            g.rotate(info.tilt);
            g.scale(1, 0.28);
            g.lineCap = 'round';
            g.beginPath();
            g.arc(0, 0, R * 1.65, front ? 0 : Math.PI, front ? Math.PI : TAU);
            g.strokeStyle = hexA(info.pal.a, 0.75);
            g.lineWidth = R * 0.2;
            g.stroke();
            g.beginPath();
            g.arc(0, 0, R * 1.95, front ? 0 : Math.PI, front ? Math.PI : TAU);
            g.strokeStyle = hexA(info.pal.a, 0.35);
            g.lineWidth = R * 0.1;
            g.stroke();
            g.restore();
        };
        ring(false);

        // corpo
        g.save();
        g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
        const body = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R * 1.05);
        body.addColorStop(0, info.pal.a);
        body.addColorStop(1, info.pal.b);
        g.fillStyle = body;
        g.fillRect(cx - R, cy - R, R * 2, R * 2);
        // faixas / nuvens
        g.save();
        g.translate(cx, cy);
        g.rotate(info.tilt * 0.5);
        for (let k = 0; k < 7; k++) {
            const y = (r() * 2 - 1) * R;
            g.fillStyle = info.pal.band;
            g.fillRect(-R, y, R * 2, R * (0.05 + r() * 0.16));
        }
        for (let k = 0; k < 6; k++) {
            g.fillStyle = `rgba(255,255,255,${0.08 + r() * 0.1})`;
            g.beginPath();
            g.ellipse((r() * 2 - 1) * R * 0.6, (r() * 2 - 1) * R * 0.6, R * (0.1 + r() * 0.25), R * (0.04 + r() * 0.08), r() * 3, 0, TAU);
            g.fill();
        }
        g.restore();
        // sombra (terminador)
        const shade = g.createRadialGradient(cx - R * 0.5, cy - R * 0.5, R * 0.3, cx - R * 0.1, cy - R * 0.1, R * 1.25);
        shade.addColorStop(0, 'rgba(0,0,0,0)');
        shade.addColorStop(0.7, 'rgba(4,3,12,0.35)');
        shade.addColorStop(1, 'rgba(4,3,12,0.85)');
        g.fillStyle = shade;
        g.fillRect(cx - R, cy - R, R * 2, R * 2);
        g.restore();
        // brilho na borda
        g.beginPath(); g.arc(cx, cy, R - 0.5, 0, TAU);
        g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1; g.stroke();
        ring(true);

        const out = { c, S };
        planetSprites.set(key, out);
        return out;
    }

    function hexA(hex, a) {
        const n = parseInt(hex.slice(1), 16);
        return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    }

    function drawPlanet(info, now, alpha, scale, at) {
        const base = planetPos(info);
        const p = at ? { x: at.x, y: at.y, R: base.R } : base;
        const bob = at ? 0 : Math.sin(now / 2600 + info.phase) * 3 * U;
        const spr = planetSprite(info, p.R);
        const s = spr.S * (scale || 1);
        ctx.save();
        ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        ctx.drawImage(spr.c, p.x - s / 2, p.y + bob - s / 2, s, s);
        ctx.restore();
        return { x: p.x, y: p.y + bob, R: p.R };
    }

    // ---------------------------------------------------------
    // Sistemas solares (a cada 5 anos)
    // ---------------------------------------------------------
    const SUN_HUES = [42, 28, 200, 55, 330];

    function systemInfo(n) {
        const r = rng(8800 + n * 53);
        return { hue: SUN_HUES[n % SUN_HUES.length], tilt: -0.35 + r() * 0.7, phase: Array.from({ length: YEARS_PER_SYSTEM }, () => r() * TAU) };
    }

    function systemPos(n, count) {
        const col = n % 6, row = Math.floor(n / 6);
        const shrink = Math.max(0.6, 1 - 0.05 * (count - 1));
        const R = Math.max(28, Math.min(W, SKY_H) * 0.1 * shrink * (W / SKY_H < 0.85 ? 0.9 : 1));
        return { x: W * (0.91 - 0.82 * (col / 5)), y: SKY_H * (0.085 + row * 0.1), R };
    }

    function drawSystem(n, x, y, R, now, alpha, form) {
        const info = systemInfo(n);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);
        ctx.rotate(info.tilt);
        ctx.globalCompositeOperation = 'lighter';
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.9);
        glow.addColorStop(0, `hsla(${info.hue}, 100%, 70%, ${0.7 * form})`);
        glow.addColorStop(0.35, `hsla(${info.hue}, 100%, 60%, ${0.18 * form})`);
        glow.addColorStop(1, `hsla(${info.hue}, 100%, 55%, 0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(-R, -R, R * 2, R * 2);
        ctx.globalCompositeOperation = 'source-over';
        for (let j = 0; j < YEARS_PER_SYSTEM; j++) {
            const orbit = 0.45 + 0.14 * j;
            const a = R * orbit * form, b = a * 0.36;
            ctx.strokeStyle = `rgba(255, 244, 220, ${0.2 * form})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.ellipse(0, 0, a, b, 0, 0, TAU); ctx.stroke();
            const ang = info.phase[j] + (now / 1000) * 0.7 / Math.sqrt(orbit);
            const px = Math.cos(ang) * a, py = Math.sin(ang) * b;
            const pal = PALETTES[(n * YEARS_PER_SYSTEM + j) % PALETTES.length];
            const pr = Math.max(2.4, R * 0.075) * form;
            const g = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, 0, px, py, pr);
            g.addColorStop(0, pal.a); g.addColorStop(1, pal.b);
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
        }
        const cr = R * 0.2 * (0.4 + 0.6 * form);
        const core = ctx.createRadialGradient(0, 0, 0, 0, 0, cr);
        core.addColorStop(0, '#fffdf2');
        core.addColorStop(0.5, `hsl(${info.hue}, 100%, 72%)`);
        core.addColorStop(1, `hsla(${info.hue}, 100%, 60%, 0)`);
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.arc(0, 0, cr, 0, TAU); ctx.fill();
        ctx.restore();
    }

    // ---------------------------------------------------------
    // Fundo: poeira de estrelas, nebulosas, Via Láctea
    // ---------------------------------------------------------
    let dust = [];
    function buildDust() {
        const r = rng(555);
        const n = Math.round(clamp((W * H) / 5200, 90, 380));
        dust = Array.from({ length: n }, () => ({ x: r(), y: r(), z: 0.3 + r() * 0.7, s: 0.3 + r() * 1.1, p: r() * TAU, f: 0.4 + r() * 1.3 }));
    }

    const NEBULAE = Array.from({ length: 7 }, (_, i) => {
        const r = rng(31 + i * 17);
        return { x: 0.1 + r() * 0.8, y: 0.1 + r() * 0.55, r: 0.22 + r() * 0.25, hue: [265, 205, 320, 175, 285, 230, 340][i], p: r() * TAU };
    });

    function richness() { return clamp(state.m / 36, 0, 1); }

    function drawBackground(now) {
        ctx.fillStyle = '#04030b';
        ctx.fillRect(0, 0, W, H);

        // Via Láctea (foto), mais viva conforme o tempo passa
        const rich = richness();
        if (bg.complete && bg.naturalWidth) {
            const scale = Math.max((W * 1.08) / bg.naturalWidth, (H * 1.08) / bg.naturalHeight);
            const w = bg.naturalWidth * scale, h = bg.naturalHeight * scale;
            ctx.save();
            ctx.globalAlpha = 0.32 + 0.5 * rich;
            ctx.drawImage(bg, (W - w) / 2 + px * 14, (H - h) / 2 + py * 10, w, h);
            ctx.restore();
        }

        // nebulosas (aparecem aos poucos)
        const count = 1 + Math.floor(rich * 6);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < count; i++) {
            const n = NEBULAE[i];
            const a = (0.05 + 0.06 * rich) * (0.8 + 0.2 * Math.sin(now / 4000 + n.p));
            const x = W * n.x + px * 10 * (1 + i * 0.2), y = SKY_H * n.y + py * 8;
            const rad = Math.min(W, SKY_H) * n.r * 1.6;
            const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
            g.addColorStop(0, `hsla(${n.hue}, 85%, 62%, ${a})`);
            g.addColorStop(1, `hsla(${n.hue}, 85%, 45%, 0)`);
            ctx.fillStyle = g;
            ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
        }
        ctx.restore();

        // poeira de estrelas distantes
        for (const d of dust) {
            const a = (0.25 + 0.55 * Math.sin(now / 1000 * d.f + d.p) ** 2) * d.z;
            ctx.fillStyle = `rgba(255, 246, 225, ${a})`;
            ctx.beginPath();
            ctx.arc(d.x * W + px * 6 * d.z, d.y * H + py * 5 * d.z, d.s * d.z, 0, TAU);
            ctx.fill();
        }
    }

    // estrela cadente ocasional
    let shoot = null, nextShoot = 4000;
    function drawShooting(now, dt) {
        nextShoot -= dt;
        if (!shoot && nextShoot <= 0 && !reduceMotion) {
            shoot = { x: Math.random() * W * 0.7, y: Math.random() * SKY_H * 0.4, t: 0, a: 0.4 + Math.random() * 0.3 };
            nextShoot = 6000 + Math.random() * 9000;
        }
        if (!shoot) return;
        shoot.t += dt;
        const u = shoot.t / 900;
        if (u >= 1) { shoot = null; return; }
        const len = 140, ex = shoot.x + Math.cos(shoot.a) * 520 * u, ey = shoot.y + Math.sin(shoot.a) * 520 * u;
        const g = ctx.createLinearGradient(ex, ey, ex - Math.cos(shoot.a) * len, ey - Math.sin(shoot.a) * len);
        g.addColorStop(0, `rgba(255,255,255,${1 - u})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.cos(shoot.a) * len, ey - Math.sin(shoot.a) * len); ctx.stroke();
    }

    // ---------------------------------------------------------
    // Estrelas (sparkles)
    // ---------------------------------------------------------
    function drawStar(x, y, p, now, opts) {
        const age = opts.age === undefined ? 1 : opts.age;           // 0..1 nascimento
        const grow = age < 1 ? easeOut(age) * (1 + 0.5 * (1 - age)) : 1;
        const tw = 0.85 + 0.15 * Math.sin(now / 520 + p.hue);
        const r = (6 + 3 * p.sz) * U * grow * (opts.scale || 1);
        const hue = p.hue;
        const alpha = opts.alpha === undefined ? 1 : opts.alpha;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = 'lighter';
        const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 5.2);
        halo.addColorStop(0, `hsla(${hue}, 100%, 82%, ${0.55 * tw})`);
        halo.addColorStop(0.3, `hsla(${hue}, 100%, 65%, ${0.16 * tw})`);
        halo.addColorStop(1, `hsla(${hue}, 100%, 60%, 0)`);
        ctx.fillStyle = halo;
        ctx.fillRect(x - r * 5.2, y - r * 5.2, r * 10.4, r * 10.4);
        // raios em cruz
        const ray = r * 3.4 * tw;
        for (const [rot, k] of [[0, 1], [Math.PI / 2, 1], [Math.PI / 4, 0.55], [-Math.PI / 4, 0.55]]) {
            ctx.save();
            ctx.translate(x, y); ctx.rotate(rot);
            const g = ctx.createLinearGradient(-ray * k, 0, ray * k, 0);
            g.addColorStop(0, 'rgba(255,240,200,0)');
            g.addColorStop(0.5, `rgba(255,246,222,${0.9 * tw})`);
            g.addColorStop(1, 'rgba(255,240,200,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(0, 0, ray * k, r * 0.16, 0, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
        ctx.fillStyle = '#fffaf0';
        ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, TAU); ctx.fill();
        ctx.restore();

        if (opts.ring && age < 1) {
            ctx.save();
            ctx.strokeStyle = `rgba(255, 235, 180, ${(1 - age) * 0.8})`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(x, y, r * (1 + age * 5), 0, TAU); ctx.stroke();
            ctx.restore();
        }
    }

    // ---------------------------------------------------------
    // Cena
    // ---------------------------------------------------------
    let hitTargets = [];

    function drawScene(now) {
        hitTargets = [];
        const m = state.m;
        const planets = planetsAt(m);
        const systems = systemsAt(m);
        const merging = state.merge;
        const sysMerging = merging && merging.kind === 'system' ? merging.sys : -1;

        // sistemas solares já formados
        for (let n = 0; n < systems; n++) {
            if (n === sysMerging) continue;
            const sp = systemPos(n, systems);
            drawSystem(n, sp.x, sp.y, sp.R, now, 1, 1);
            const a = monthLabel(n * YEARS_PER_SYSTEM * 12), b = monthLabel((n + 1) * YEARS_PER_SYSTEM * 12 - 1);
            hitTargets.push({ x: sp.x, y: sp.y, r: sp.R * 1.1, label: `Sistema solar ${n + 1} · ${a.short}/${a.year} – ${b.short}/${b.year}` });
        }

        // planetas soltos do ciclo atual
        for (let i = systems * YEARS_PER_SYSTEM; i < planets; i++) {
            if (merging && i === merging.cycle) continue;
            const info = planetInfo(i);
            const pp = drawPlanet(info, now);
            const a = monthLabel(i * 12), b = monthLabel(i * 12 + 11);
            hitTargets.push({ x: pp.x, y: pp.y, r: pp.R * 1.2, label: `${info.pal.name} · ${a.short}/${a.year} – ${b.short}/${b.year}` });
        }

        if (merging) {
            drawMerge(now, merging);
            return;
        }

        // estrelas do ano corrente
        const cycle = planets;
        const count = starsAt(m);
        const pts = [];
        for (let k = 0; k < count; k++) pts.push(Object.assign(starPos(cycle, k), { k }));

        // linhas da constelação
        ctx.save();
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 7]);
        ctx.strokeStyle = 'rgba(255, 240, 200, 0.28)';
        ctx.beginPath();
        pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
        ctx.stroke();
        ctx.restore();

        pts.forEach((p, i) => {
            const idx = cycle * 12 + p.k;
            const bornAt = state.born[idx];
            const age = bornAt === undefined ? 1 : clamp((now - bornAt) / 1100, 0, 1);
            const isNewest = i === count - 1;
            drawStar(p.x, p.y, p.p, now, { age, ring: true, scale: isNewest ? 1.25 : 1 });
            const lb = monthLabel(idx);
            hitTargets.push({ x: p.x, y: p.y, r: 26, label: `${lb.name} de ${lb.year}` });
        });
    }

    // 12 estrelas giram e se fundem no planeta do ano (u de 0 a 1)
    function drawStarFusion(now, cycle, u) {
        const info = planetInfo(cycle);
        const pp = planetPos(info);
        const swirlE = easeInOut(clamp(u / 0.7, 0, 1));

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const glowR = pp.R * (1 + 3 * Math.sin(Math.PI * clamp(u * 1.1, 0, 1)));
        const gl = ctx.createRadialGradient(pp.x, pp.y, 0, pp.x, pp.y, glowR * 2.2);
        gl.addColorStop(0, `rgba(255, 238, 190, ${0.75 * Math.sin(Math.PI * u)})`);
        gl.addColorStop(1, 'rgba(255, 238, 190, 0)');
        ctx.fillStyle = gl;
        ctx.fillRect(pp.x - glowR * 2.2, pp.y - glowR * 2.2, glowR * 4.4, glowR * 4.4);
        ctx.restore();

        for (let k = 0; k < 12; k++) {
            const s = starPos(cycle, k);
            const dx = s.x - pp.x, dy = s.y - pp.y;
            const f = 1 - swirlE;
            const ang = swirlE * 3.2;
            const x = pp.x + (dx * Math.cos(ang) - dy * Math.sin(ang)) * f;
            const y = pp.y + (dx * Math.sin(ang) + dy * Math.cos(ang)) * f;
            drawStar(x, y, s.p, now, { alpha: 1 - clamp((u - 0.62) / 0.2, 0, 1), scale: 1 - 0.55 * swirlE });
        }

        const pu = clamp((u - 0.58) / 0.42, 0, 1);
        if (pu > 0) drawPlanet(info, now, easeOut(pu), 0.35 + 0.65 * easeOut(pu));
    }

    // 5 planetas giram em torno do centro e acendem um sol (u de 0 a 1)
    function drawSystemFormation(now, mg, u) {
        const c = systemPos(mg.sys, mg.sys + 1);
        const e = easeInOut(u);
        const ang = e * 3.6;
        for (let j = 0; j < YEARS_PER_SYSTEM; j++) {
            const info = planetInfo(mg.sys * YEARS_PER_SYSTEM + j);
            const start = planetPos(info);
            const dx = start.x - c.x, dy = start.y - c.y;
            const f = 1 - e;
            const at = { x: c.x + (dx * Math.cos(ang) - dy * Math.sin(ang)) * f, y: c.y + (dx * Math.sin(ang) + dy * Math.cos(ang)) * f };
            drawPlanet(info, now, 1 - clamp((u - 0.7) / 0.3, 0, 1), 1 - 0.85 * e, at);
        }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const gr = c.R * (0.8 + 2.4 * Math.sin(Math.PI * clamp(u * 1.05, 0, 1)));
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, gr);
        g.addColorStop(0, `rgba(255, 240, 200, ${0.85 * Math.sin(Math.PI * clamp(u * 0.95, 0, 1))})`);
        g.addColorStop(1, 'rgba(255, 240, 200, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(c.x - gr, c.y - gr, gr * 2, gr * 2);
        ctx.restore();
        const form = easeOut(clamp((u - 0.45) / 0.55, 0, 1));
        if (form > 0) drawSystem(mg.sys, c.x, c.y, c.R, now, form, form);
    }

    function drawMerge(now, mg) {
        const u = clamp((now - mg.t0) / mg.dur, 0, 1);
        if (mg.kind === 'system') {
            // fase 1: estrelas viram o 5º planeta; fase 2: os 5 planetas viram um sistema
            if (u < 0.5) {
                for (let j = 0; j < YEARS_PER_SYSTEM - 1; j++) drawPlanet(planetInfo(mg.sys * YEARS_PER_SYSTEM + j), now);
                drawStarFusion(now, mg.cycle, u / 0.42);
            } else drawSystemFormation(now, mg, (u - 0.5) / 0.5);
        } else {
            drawStarFusion(now, mg.cycle, u);
        }
        if (u >= 1) state.merge = null;
    }

    // ---------------------------------------------------------
    // Interface
    // ---------------------------------------------------------
    function updateHud(announce) {
        const m = state.m;
        const lb = monthLabel(m);
        const planets = planetsAt(m), stars = starsAt(m), systems = systemsAt(m);
        $('when').textContent = `${lb.name} de ${lb.year}`;
        const sp = (n, one, many) => `${n} ${n === 1 ? one : many}`;
        $('count').textContent = `${sp(stars, 'estrela', 'estrelas')} no ano · ${sp(planets, 'planeta', 'planetas')}`
            + (systems ? ` · ${sp(systems, 'sistema solar', 'sistemas solares')}` : '');
        slider.value = m;
        slider.style.setProperty('--fill', `${(m / MAX) * 100}%`);
        const hint = $('hint');
        const lastOfCycle = planets % YEARS_PER_SYSTEM === YEARS_PER_SYSTEM - 1;
        if (m > 0 && m % (12 * YEARS_PER_SYSTEM) === 0) hint.textContent = `Marco de ${YEARS_PER_SYSTEM} anos: os planetas viraram um sistema solar!`;
        else if (m > NOW) hint.textContent = 'Você está vendo o futuro da galáxia.';
        else if (stars === 12 && lastOfCycle) hint.textContent = 'No próximo mês, as 12 estrelas viram um planeta e os 5 planetas formam um sistema solar!';
        else if (stars === 12) hint.textContent = 'No próximo mês, as 12 estrelas vão se unir e virar um planeta.';
        else if (m === NOW) hint.textContent = 'Toque numa estrela ou planeta para ver sua data.';
        else hint.textContent = '';
        canvas.setAttribute('aria-label', `Céu em ${lb.name} de ${lb.year}: ${sp(stars, 'estrela', 'estrelas')} no ano, ${sp(planets, 'planeta formado', 'planetas formados')} e ${sp(systems, 'sistema solar', 'sistemas solares')}`);
    }

    function setMonth(m, animate) {
        const old = state.m;
        const next = clamp(Math.round(m), 0, MAX);
        if (next === old) return;
        state.m = next;
        const t = performance.now();
        if (animate && !reduceMotion && next === old + 1) {
            if (planetsAt(next) === planetsAt(old) + 1) {
                const isSystem = planetsAt(next) % YEARS_PER_SYSTEM === 0;
                state.merge = { t0: t, dur: isSystem ? 6400 : 2600, cycle: planetsAt(old), kind: isSystem ? 'system' : 'planet', sys: planetsAt(next) / YEARS_PER_SYSTEM - 1 };
            }
            else state.born[next] = t;
        } else {
            state.merge = null;
        }
        updateHud();
    }

    function stopPlaying() {
        if (state.playing) { clearTimeout(state.playing.timer); state.playing = null; $('play').innerHTML = '&#9654; Reviver a jornada'; }
    }

    function play() {
        if (state.playing) { stopPlaying(); return; }
        const target = state.m > 0 ? state.m : NOW;
        state.m = 0; state.merge = null; state.born = { 0: performance.now() };
        updateHud();
        $('play').innerHTML = '&#10074;&#10074; Pausar';
        state.playing = { timer: null };
        const step = () => {
            if (!state.playing) return;
            if (state.m >= target) { stopPlaying(); return; }
            const crossing = (state.m + 1) % 12 === 0;
            const milestone = (state.m + 1) % (12 * YEARS_PER_SYSTEM) === 0;
            setMonth(state.m + 1, true);
            state.playing.timer = setTimeout(step, milestone ? 7000 : crossing ? 3000 : 650);
        };
        state.playing.timer = setTimeout(step, 900);
    }

    slider.max = MAX;
    slider.addEventListener('input', () => { stopPlaying(); setMonth(+slider.value, +slider.value === state.m + 1); });
    $('today').addEventListener('click', () => { stopPlaying(); setMonth(NOW, false); updateHud(); });
    $('play').addEventListener('click', play);
    $('tick-start').textContent = `${monthLabel(0).short}/${monthLabel(0).year}`;
    $('tick-today').textContent = 'hoje';
    const todayTick = $('tick-today');
    todayTick.style.position = 'absolute';
    todayTick.style.left = `calc(12px + (100% - 24px) * ${NOW / MAX})`;
    todayTick.style.transform = 'translateX(-50%)';
    if (NOW / MAX < 0.2) todayTick.style.display = 'none';
    $('tick-end').textContent = `${monthLabel(MAX).short}/${monthLabel(MAX).year}`;

    // tooltip e paralaxe
    function pointerMove(e) {
        const x = e.clientX, y = e.clientY;
        pxT = (x / W - 0.5) * 2; pyT = (y / H - 0.5) * 2;
        let best = null, bd = 1e9;
        for (const t of hitTargets) {
            const d = Math.hypot(t.x - x, t.y - y);
            if (d < t.r && d < bd) { best = t; bd = d; }
        }
        canvas.style.cursor = best ? 'pointer' : 'default';
        if (best) {
            tip.textContent = best.label;
            tip.style.left = clamp(best.x, 80, W - 80) + 'px';
            tip.style.top = best.y + 'px';
            tip.classList.add('on');
        } else tip.classList.remove('on');
        return best;
    }
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerdown', (e) => {
        const hit = pointerMove(e);
        if (hit && e.pointerType !== 'mouse') setTimeout(() => tip.classList.remove('on'), 2200);
    });
    canvas.addEventListener('pointerleave', () => tip.classList.remove('on'));

    // ---------------------------------------------------------
    // Loop
    // ---------------------------------------------------------
    let last = 0;
    function frame(now) {
        const dt = Math.min(now - last, 60);
        last = now;
        px = lerp(px, pxT, 0.04); py = lerp(py, pyT, 0.04);
        drawBackground(now);
        drawShooting(now, dt);
        drawScene(now);
        requestAnimationFrame(frame);
    }

    bg.addEventListener('load', () => {});
    window.addEventListener('resize', resize);
    resize();
    updateHud();
    requestAnimationFrame((t) => { last = t; frame(t); });

    window.__galaxy = { state, setMonth, NOW, MAX };
})();
