/* O Mago e o Dragão: o dragão ataca, o mago o afasta com uma rajada, o dragão cai
   em um canto aleatório, fica tonto e volta a atacar. Nunca morre. */
(function () {
    const canvas = document.getElementById('stage');
    const ctx = canvas.getContext('2d');
    const captionEl = document.getElementById('caption');
    const blastsEl = document.getElementById('blasts');

    const TAU = Math.PI * 2;
    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    let W = 0, H = 0, dpr = 1, U = 1;
    const wizardImg = new Image();
    wizardImg.src = '../assets/img/gandalf.png';
    const bgImg = new Image();
    bgImg.src = '../assets/img/dusk.jpg';
    let bgCache = null;

    // ---------------------------------------------------------
    // Layout
    // ---------------------------------------------------------
    const wiz = { x: 0, y: 0, h: 0, w: 0, face: 1, faceTarget: 1, recoil: 0 };

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        U = clamp(Math.min(W, H) / 800, 0.55, 1.1);
        wiz.h = clamp(Math.min(H * 0.5, W * 0.95), 220, 520);
        wiz.w = wiz.h * (505 / 680);
        wiz.x = W / 2;
        wiz.y = H / 2;
        buildBackground();
    }

    function buildBackground() {
        bgCache = document.createElement('canvas');
        bgCache.width = canvas.width;
        bgCache.height = canvas.height;
        const b = bgCache.getContext('2d');
        b.scale(dpr, dpr);
        if (bgImg.complete && bgImg.naturalWidth) {
            const r = Math.max(W / bgImg.naturalWidth, H / bgImg.naturalHeight);
            const w = bgImg.naturalWidth * r, h = bgImg.naturalHeight * r;
            b.drawImage(bgImg, (W - w) / 2, (H - h) / 2, w, h);
        } else {
            b.fillStyle = '#1a1730';
            b.fillRect(0, 0, W, H);
        }
        // Escurece para o mago e o dragão sempre se destacarem
        const g = b.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, 'rgba(8, 6, 20, 0.62)');
        g.addColorStop(0.55, 'rgba(8, 6, 20, 0.5)');
        g.addColorStop(1, 'rgba(4, 3, 10, 0.8)');
        b.fillStyle = g;
        b.fillRect(0, 0, W, H);
    }

    // ---------------------------------------------------------
    // Estado do dragão
    // ---------------------------------------------------------
    const dragon = {
        x: 0, y: 0, rot: 0, dir: 1, state: 'approach',
        t0: 0, from: null, to: null, spin: 0, arc: 0, dur: 0,
        flap: 0, folded: 0, tail: 0, bob: 0,
    };
    const particles = [];
    const beams = [];
    const rings = [];
    let flash = 0;
    let blasts = 0;
    let charge = 0;

    const dragonScale = () => U * 1.3;

    function wizardTarget() {
        return { x: wiz.x, y: wiz.y - wiz.h * 0.05 };
    }

    function staffTip() {
        // Ponta do cajado na imagem (fração): à esquerda e no alto
        const fx = 0.045, fy = 0.17;
        return {
            x: wiz.x + wiz.face * (fx - 0.5) * wiz.w,
            y: wiz.y - wiz.h / 2 + fy * wiz.h + wiz.recoil * -2,
        };
    }

    function spawnDragonOffscreen() {
        const m = 150 * dragonScale();
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { dragon.x = rand(0, W); dragon.y = -m; }
        else if (side === 1) { dragon.x = W + m; dragon.y = rand(0, H); }
        else if (side === 2) { dragon.x = rand(0, W); dragon.y = H + m; }
        else { dragon.x = -m; dragon.y = rand(0, H); }
    }

    function setCaption(text, ms) {
        captionEl.textContent = text;
        captionEl.classList.add('show');
        clearTimeout(setCaption.timer);
        if (ms) setCaption.timer = setTimeout(() => captionEl.classList.remove('show'), ms);
    }

    function startApproach(now) {
        dragon.state = 'approach';
        dragon.t0 = now;
        dragon.folded = 0;
        dragon.rot = 0;
        setCaption('O dragão se aproxima...', 2200);
    }

    function pickLandingSpot() {
        const ds = dragonScale();
        const mx = Math.min(210 * ds, W * 0.32), top = 130 * ds, bottom = 80 * ds;
        const minDist = Math.min(W, H) * 0.42;
        for (let i = 0; i < 40; i++) {
            const side = Math.floor(Math.random() * 4);
            let x, y;
            if (side === 0) { x = rand(mx, W - mx); y = top; }
            else if (side === 1) { x = W - mx; y = rand(top, H - bottom); }
            else if (side === 2) { x = rand(mx, W - mx); y = H - bottom; }
            else { x = mx; y = rand(top, H - bottom); }
            if (Math.hypot(x - wiz.x, y - wiz.y) > minDist) return { x, y };
        }
        return { x: mx, y: top };
    }

    function startBlast(now) {
        dragon.state = 'knock';
        dragon.t0 = now;
        dragon.dur = 1250;
        dragon.from = { x: dragon.x, y: dragon.y };
        dragon.to = pickLandingSpot();
        dragon.arc = H * 0.14;
        dragon.spin = (Math.random() < 0.5 ? -1 : 1) * TAU * (1 + Math.floor(rand(1, 3)));
        dragon.rotStart = dragon.rot;
        wiz.faceTarget = dragon.x < wiz.x ? -1 : 1;
        wiz.recoil = 1;
        flash = 0.5;
        blasts++;
        blastsEl.textContent = blasts;
        setCaption('Você não passará!', 2000);

        const tip = staffTip();
        beams.push({ t0: now, dur: 420 });
        rings.push({ x: dragon.x, y: dragon.y, t0: now, dur: 650, r: 160 * dragonScale() });
        rings.push({ x: tip.x, y: tip.y, t0: now, dur: 450, r: 90 * dragonScale() });
        for (let i = 0; i < 70; i++) {
            const a = rand(0, TAU), s = rand(80, 520);
            particles.push({
                x: dragon.x, y: dragon.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                life: 0, max: rand(450, 1000), size: rand(1.5, 4.5),
                hue: rand(180, 215),
            });
        }
    }

    function startDizzy(now) {
        dragon.state = 'dizzy';
        dragon.t0 = now;
        dragon.dur = rand(2800, 4600);
        dragon.rot = 0;
        setCaption('O dragão está tonto...', dragon.dur - 400);
    }

    function startTakeoff(now) {
        dragon.state = 'takeoff';
        dragon.t0 = now;
        dragon.dur = 800;
        dragon.from = { x: dragon.x, y: dragon.y };
        setCaption('Ele vai tentar de novo!', 1800);
    }

    // ---------------------------------------------------------
    // Atualização
    // ---------------------------------------------------------
    function update(now, dt) {
        const ds = dragonScale();
        dragon.flap += dt * (dragon.state === 'dizzy' ? 0 : dragon.state === 'knock' ? 0.004 : 0.011);
        dragon.tail += dt * 0.006;
        dragon.bob += dt * 0.004;

        const tgt = wizardTarget();
        const range = wiz.h * 0.5 + 120 * ds;

        switch (dragon.state) {
            case 'approach': {
                const dx = tgt.x - dragon.x, dy = tgt.y - dragon.y;
                const d = Math.hypot(dx, dy);
                const speed = clamp(Math.min(W, H) * 0.5, 230, 480);
                dragon.dir = dx >= 0 ? 1 : -1;
                const wob = Math.sin(dragon.bob * 2) * 0.35 * speed * dt / 1000;
                dragon.x += (dx / d) * speed * dt / 1000 - (dy / d) * wob;
                dragon.y += (dy / d) * speed * dt / 1000 + (dx / d) * wob;
                dragon.rot = lerp(dragon.rot, Math.atan2(dy, Math.abs(dx)) * dragon.dir * 0.6, 0.1);
                dragon.folded = 0;
                wiz.faceTarget = dx >= 0 ? 1 : -1;
                charge = clamp((range * 2.1 - d) / (range * 1.0), 0, 1);
                if (d <= range) startBlast(now);
                break;
            }
            case 'knock': {
                const u = clamp((now - dragon.t0) / dragon.dur, 0, 1);
                const e = easeOut(u);
                dragon.x = lerp(dragon.from.x, dragon.to.x, e);
                dragon.y = lerp(dragon.from.y, dragon.to.y, e) - Math.sin(Math.PI * Math.min(1, u * 1.15)) * dragon.arc * (1 - u * 0.4);
                dragon.rot = dragon.rotStart * (1 - e) + dragon.spin * e;
                dragon.folded = clamp(u * 4, 0, 1);
                charge = 0;
                if (u >= 1) {
                    dragon.rot = 0;
                    dragon.dir = dragon.x < wiz.x ? 1 : -1; // olha na direção do mago
                    // pequena poeira ao cair
                    rings.push({ x: dragon.x, y: dragon.y + 30 * ds, t0: now, dur: 500, r: 110 * ds, dust: true });
                    startDizzy(now);
                }
                break;
            }
            case 'dizzy': {
                dragon.folded = 1;
                dragon.rot = Math.sin((now - dragon.t0) / 260) * 0.09;
                if (now - dragon.t0 >= dragon.dur) startTakeoff(now);
                break;
            }
            case 'takeoff': {
                const u = clamp((now - dragon.t0) / dragon.dur, 0, 1);
                dragon.folded = 1 - easeOut(u);
                dragon.flap += dt * 0.008;
                dragon.y = dragon.from.y - easeOut(u) * 40 * ds;
                dragon.rot = lerp(dragon.rot, 0, 0.1);
                if (u >= 1) startApproach(now);
                break;
            }
        }

        wiz.face = lerp(wiz.face, wiz.faceTarget, clamp(dt / 160, 0, 1));
        wiz.recoil = Math.max(0, wiz.recoil - dt / 500);
        flash = Math.max(0, flash - dt / 500);
        if (dragon.state !== 'approach') charge = Math.max(0, charge - dt / 300);

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life += dt;
            p.x += p.vx * dt / 1000;
            p.y += p.vy * dt / 1000;
            p.vx *= 0.97; p.vy *= 0.97;
            if (p.life >= p.max) particles.splice(i, 1);
        }

        // Faíscas contínuas na ponta do cajado
        if (Math.random() < 0.35 + charge * 0.6) {
            const tip = staffTip();
            particles.push({
                x: tip.x + rand(-6, 6), y: tip.y + rand(-6, 6),
                vx: rand(-25, 25), vy: rand(-70, -15), life: 0, max: rand(500, 900),
                size: rand(1, 2.6) + charge * 1.5, hue: rand(185, 205),
            });
        }
    }

    // ---------------------------------------------------------
    // Desenho: dragão (coordenadas locais, olhando para +x)
    // ---------------------------------------------------------
    const C = {
        body: '#9b2230', bodyLight: '#cf4a3e', belly: '#e8b565', dark: '#3a0f16',
        wing: '#6d1a2e', wingFar: '#4c1222', bone: '#2d0a12',
    };

    function drawWing(c, flapVal, folded, far) {
        const S = { x: far ? 6 : -4, y: -16 };
        const open = -Math.PI / 2 - 0.35 + flapVal * 0.9;
        const closed = -Math.PI - 0.25;
        const b = lerp(open, closed, folded);
        const L1 = 54;
        const E = { x: S.x + Math.cos(b) * L1, y: S.y + Math.sin(b) * L1 };
        const tip = (ang, len) => ({ x: E.x + Math.cos(b + ang) * len, y: E.y + Math.sin(b + ang) * len });
        const T1 = tip(0.2, 82), T2 = tip(-0.55, 76), T3 = tip(-1.2, 60);
        const B = { x: -36, y: 8 };
        const scallop = (p, q) => {
            const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
            c.quadraticCurveTo(lerp(mx, E.x, 0.28), lerp(my, E.y, 0.28), q.x, q.y);
        };
        c.fillStyle = far ? C.wingFar : C.wing;
        c.strokeStyle = C.bone;
        c.lineWidth = 2.5;
        c.lineJoin = 'round';
        c.beginPath();
        c.moveTo(S.x, S.y);
        c.lineTo(E.x, E.y);
        c.lineTo(T1.x, T1.y);
        scallop(T1, T2);
        scallop(T2, T3);
        scallop(T3, B);
        c.closePath();
        c.fill();
        c.stroke();
        c.lineWidth = 2;
        c.beginPath();
        for (const T of [T1, T2, T3]) { c.moveTo(E.x, E.y); c.lineTo(T.x, T.y); }
        c.stroke();
        c.lineWidth = 6;
        c.lineCap = 'round';
        c.beginPath(); c.moveTo(S.x, S.y); c.lineTo(E.x, E.y); c.stroke();
    }

    function drawDragon(c, d, now) {
        const flapA = Math.sin(d.flap);
        const flapB = Math.sin(d.flap - 0.5);
        const dizzy = d.state === 'dizzy';
        const bobY = dizzy ? 0 : Math.sin(d.bob) * 5;

        c.save();
        c.translate(d.x, d.y + bobY);
        c.rotate(d.rot);
        c.scale(dragonScale() * d.dir, dragonScale());
        c.lineCap = 'round';
        c.lineJoin = 'round';

        // asa de trás
        drawWing(c, flapB, d.folded, true);

        // cauda
        const N = 16;
        let px = -48, py = 4;
        const amp = dizzy ? 4 : 14;
        for (let i = 1; i <= N; i++) {
            const k = i / N;
            const x = -48 - k * 130;
            const y = 4 + (dizzy ? k * 24 : 0) + Math.sin(d.tail - i * 0.42) * amp * k;
            c.strokeStyle = C.dark;
            c.lineWidth = 24 * (1 - k) + 6;
            c.beginPath(); c.moveTo(px, py); c.lineTo(x, y); c.stroke();
            c.strokeStyle = i % 2 ? C.body : '#8b1d2b';
            c.lineWidth = 24 * (1 - k) + 2;
            c.beginPath(); c.moveTo(px, py); c.lineTo(x, y); c.stroke();
            px = x; py = y;
        }
        // ponta da cauda
        c.fillStyle = C.bone;
        c.beginPath();
        c.moveTo(px + 4, py - 9); c.lineTo(px - 26, py); c.lineTo(px + 4, py + 9);
        c.closePath(); c.fill();

        // patas de trás
        c.strokeStyle = C.dark; c.lineWidth = 15;
        c.beginPath(); c.moveTo(-26, 16); c.lineTo(-34, 40); c.stroke();
        c.strokeStyle = C.body; c.lineWidth = 11;
        c.beginPath(); c.moveTo(-26, 16); c.lineTo(-34, 40); c.stroke();
        c.strokeStyle = C.belly; c.lineWidth = 3;
        c.beginPath(); c.moveTo(-34, 40); c.lineTo(-24, 46); c.moveTo(-34, 40); c.lineTo(-38, 48); c.stroke();

        // espinhos nas costas
        c.fillStyle = C.bone;
        for (let i = 0; i < 6; i++) {
            const x = -44 + i * 15;
            c.beginPath();
            c.moveTo(x - 6, -22 + Math.abs(i - 2.5) * 0.8);
            c.lineTo(x + 1, -35 + Math.abs(i - 2.5) * 1.8);
            c.lineTo(x + 7, -22 + Math.abs(i - 2.5) * 0.8);
            c.closePath(); c.fill();
        }

        // pescoço
        const neck = () => {
            c.beginPath();
            c.moveTo(34, -2);
            c.bezierCurveTo(68, 4, 68, -32, 88, -38);
        };
        c.strokeStyle = C.dark; c.lineWidth = 27; neck(); c.stroke();
        c.strokeStyle = C.body; c.lineWidth = 22; neck(); c.stroke();
        c.strokeStyle = C.belly; c.lineWidth = 6; c.globalAlpha = 0.75;
        c.beginPath(); c.moveTo(36, 5); c.bezierCurveTo(66, 10, 66, -22, 88, -28); c.stroke();
        c.globalAlpha = 1;

        // corpo
        const bg = c.createLinearGradient(0, -30, 0, 30);
        bg.addColorStop(0, C.bodyLight);
        bg.addColorStop(0.55, C.body);
        bg.addColorStop(1, '#6e1624');
        c.fillStyle = bg;
        c.strokeStyle = C.dark; c.lineWidth = 3;
        c.beginPath(); c.ellipse(-4, 0, 66, 30, 0, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = C.belly; c.globalAlpha = 0.9;
        c.beginPath(); c.ellipse(2, 15, 52, 12, 0, 0, Math.PI); c.fill();
        c.globalAlpha = 1;
        c.strokeStyle = 'rgba(58, 15, 22, 0.55)'; c.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(-34 + i * 14, 8); c.lineTo(-34 + i * 14, 24); c.stroke(); }

        // pata da frente
        c.strokeStyle = C.dark; c.lineWidth = 14;
        c.beginPath(); c.moveTo(26, 18); c.lineTo(36, dizzy ? 36 : 34 + Math.sin(d.flap) * 3); c.stroke();
        c.strokeStyle = C.body; c.lineWidth = 10;
        c.beginPath(); c.moveTo(26, 18); c.lineTo(36, dizzy ? 36 : 34 + Math.sin(d.flap) * 3); c.stroke();
        c.strokeStyle = C.belly; c.lineWidth = 3;
        c.beginPath(); c.moveTo(36, 36); c.lineTo(46, 40); c.moveTo(36, 36); c.lineTo(34, 45); c.stroke();

        // asa da frente
        drawWing(c, flapA, d.folded, false);

        // cabeça
        c.save();
        c.translate(92, -40 + (dizzy ? 10 : 0));
        c.rotate(dizzy ? 0.35 : Math.sin(d.bob * 1.3) * 0.06);
        // chifres
        c.fillStyle = C.bone;
        c.beginPath(); c.moveTo(-6, -10); c.quadraticCurveTo(-24, -18, -36, -32); c.quadraticCurveTo(-18, -30, -2, -20); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(4, -12); c.quadraticCurveTo(-8, -26, -12, -40); c.quadraticCurveTo(2, -30, 12, -16); c.closePath(); c.fill();
        // crânio e focinho
        const hg = c.createLinearGradient(0, -16, 0, 14);
        hg.addColorStop(0, C.bodyLight); hg.addColorStop(1, C.body);
        c.fillStyle = hg; c.strokeStyle = C.dark; c.lineWidth = 3;
        c.beginPath();
        c.moveTo(-14, -6);
        c.quadraticCurveTo(-8, -17, 8, -15);
        c.quadraticCurveTo(26, -13, 44, -4);
        c.quadraticCurveTo(50, 0, 44, 6);
        c.quadraticCurveTo(26, 14, 4, 12);
        c.quadraticCurveTo(-14, 10, -14, -6);
        c.closePath(); c.fill(); c.stroke();
        // mandíbula / dentes
        c.strokeStyle = C.dark; c.lineWidth = 2;
        c.beginPath(); c.moveTo(4, 5); c.quadraticCurveTo(26, 8, 44, 3); c.stroke();
        c.fillStyle = '#f7ecd0';
        for (let i = 0; i < 4; i++) {
            const x = 12 + i * 8;
            c.beginPath(); c.moveTo(x, 6); c.lineTo(x + 3, 12); c.lineTo(x + 6, 6.5); c.closePath(); c.fill();
        }
        // narina
        c.fillStyle = C.dark;
        c.beginPath(); c.ellipse(41, -3, 2.5, 1.8, 0, 0, TAU); c.fill();
        // olho
        if (dizzy) {
            c.strokeStyle = '#fff3c8'; c.lineWidth = 2; c.fillStyle = '#2a0a10';
            c.beginPath(); c.arc(14, -5, 7, 0, TAU); c.fill(); c.stroke();
            c.beginPath();
            for (let a = 0; a < 12; a += 0.4) {
                const r = a * 0.5;
                const x = 14 + Math.cos(a + now / 150) * r, y = -5 + Math.sin(a + now / 150) * r;
                a === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
            }
            c.stroke();
        } else {
            c.fillStyle = '#ffd34d';
            c.beginPath(); c.ellipse(14, -5, 6.5, 5, 0.15, 0, TAU); c.fill();
            c.strokeStyle = C.dark; c.lineWidth = 1.5; c.stroke();
            c.fillStyle = '#1a0508';
            c.beginPath(); c.ellipse(15, -5, 1.8, 4.2, 0, 0, TAU); c.fill();
            // sobrancelha brava
            c.strokeStyle = C.dark; c.lineWidth = 3;
            c.beginPath(); c.moveTo(5, -13); c.lineTo(22, -8); c.stroke();
        }
        c.restore();
        c.restore();

        // Estrelinhas de tontura (em coordenadas do mundo)
        if (dizzy) {
            const hx = d.x + d.dir * 92 * dragonScale();
            const hy = d.y - 70 * dragonScale();
            for (let i = 0; i < 4; i++) {
                const a = now / 420 + (i / 4) * TAU;
                drawStar(c, hx + Math.cos(a) * 44 * dragonScale(), hy + Math.sin(a) * 13 * dragonScale(), 7 * dragonScale() + 2, i);
            }
        }
    }

    function drawStar(c, x, y, r, i) {
        c.save();
        c.translate(x, y);
        c.rotate(i);
        c.fillStyle = '#ffe27a';
        c.strokeStyle = '#8a5a00';
        c.lineWidth = 1.2;
        c.beginPath();
        for (let k = 0; k < 10; k++) {
            const rr = k % 2 ? r * 0.45 : r;
            const a = (k / 10) * TAU - Math.PI / 2;
            const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
            k === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
        }
        c.closePath(); c.fill(); c.stroke();
        c.restore();
    }

    // ---------------------------------------------------------
    // Desenho: mago, efeitos, cena
    // ---------------------------------------------------------
    // Sprite do mago com a base esmaecida (o busto some suavemente na névoa)
    let spriteCache = null, spriteKey = '';
    function wizardSprite() {
        const key = `${wiz.w}x${wiz.h}x${dpr}`;
        if (spriteCache && spriteKey === key) return spriteCache;
        const s = document.createElement('canvas');
        s.width = Math.round(wiz.w * dpr);
        s.height = Math.round(wiz.h * dpr);
        const x = s.getContext('2d');
        x.drawImage(wizardImg, 0, 0, s.width, s.height);
        x.globalCompositeOperation = 'destination-out';
        const g = x.createLinearGradient(0, s.height * 0.72, 0, s.height);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,1)');
        x.fillStyle = g;
        x.fillRect(0, 0, s.width, s.height);
        spriteCache = s; spriteKey = key;
        return s;
    }

    function drawWizard(c, now) {
        if (!wizardImg.complete) return;
        const breathe = Math.sin(now / 900) * 3;
        const shake = wiz.recoil > 0 ? Math.sin(now / 18) * 3 * wiz.recoil : 0;

        // aura no chão (elipse suave, sem bordas)
        const ar = wiz.w * 0.9;
        const aura = c.createRadialGradient(0, 0, 4, 0, 0, ar);
        aura.addColorStop(0, `rgba(127, 212, 255, ${0.28 + charge * 0.3})`);
        aura.addColorStop(1, 'rgba(127, 212, 255, 0)');
        c.save();
        c.translate(wiz.x, wiz.y + wiz.h * 0.46);
        c.scale(1, 0.32);
        c.fillStyle = aura;
        c.beginPath(); c.arc(0, 0, ar, 0, TAU); c.fill();
        c.restore();

        c.save();
        c.translate(wiz.x + shake, wiz.y + breathe);
        c.scale(wiz.face, 1);
        c.shadowColor = `rgba(127, 212, 255, ${0.35 + charge * 0.5 + wiz.recoil * 0.4})`;
        c.shadowBlur = 24 + charge * 26;
        c.drawImage(wizardSprite(), -wiz.w / 2, -wiz.h / 2, wiz.w, wiz.h);
        c.restore();

        // brilho no cajado
        const tip = staffTip();
        const r = (16 + charge * 34 + wiz.recoil * 26) * U;
        const g = c.createRadialGradient(tip.x, tip.y + breathe, 0, tip.x, tip.y + breathe, r);
        g.addColorStop(0, 'rgba(235, 250, 255, 0.95)');
        g.addColorStop(0.35, 'rgba(127, 212, 255, 0.55)');
        g.addColorStop(1, 'rgba(127, 212, 255, 0)');
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = g;
        c.fillRect(tip.x - r, tip.y + breathe - r, r * 2, r * 2);
        c.restore();
    }

    function drawBeams(c, now) {
        const tip = staffTip();
        for (let i = beams.length - 1; i >= 0; i--) {
            const b = beams[i];
            const u = (now - b.t0) / b.dur;
            if (u >= 1) { beams.splice(i, 1); continue; }
            const fade = 1 - u;
            // a ponta acompanha o dragão sendo arremessado
            const ex = dragon.x, ey = dragon.y;
            const dx = ex - tip.x, dy = ey - tip.y;
            const len = Math.hypot(dx, dy);
            const nx = -dy / len, ny = dx / len;
            c.save();
            c.globalCompositeOperation = 'lighter';
            c.lineCap = 'round';
            c.lineJoin = 'round';
            for (const [w, a, col] of [[30, 0.18, '90,170,255'], [14, 0.45, '140,220,255'], [5, 0.95, '245,252,255']]) {
                c.strokeStyle = `rgba(${col}, ${a * fade})`;
                c.lineWidth = w * fade * U + 1;
                c.beginPath();
                c.moveTo(tip.x, tip.y);
                const seg = 14;
                for (let s = 1; s <= seg; s++) {
                    const k = s / seg;
                    const jitter = (Math.random() - 0.5) * 22 * Math.sin(Math.PI * k) * (w > 10 ? 0.4 : 1);
                    c.lineTo(tip.x + dx * k + nx * jitter, tip.y + dy * k + ny * jitter);
                }
                c.stroke();
            }
            c.restore();
        }
    }

    function drawRings(c, now) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (let i = rings.length - 1; i >= 0; i--) {
            const r = rings[i];
            const u = (now - r.t0) / r.dur;
            if (u >= 1) { rings.splice(i, 1); continue; }
            c.strokeStyle = r.dust ? `rgba(220, 190, 150, ${0.5 * (1 - u)})` : `rgba(160, 225, 255, ${0.9 * (1 - u)})`;
            c.lineWidth = 8 * (1 - u) + 1;
            c.beginPath();
            if (r.dust) c.ellipse(r.x, r.y, r.r * easeOut(u), r.r * 0.3 * easeOut(u), 0, 0, TAU);
            else c.arc(r.x, r.y, r.r * easeOut(u), 0, TAU);
            c.stroke();
        }
        c.restore();
    }

    function drawParticles(c) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (const p of particles) {
            const k = 1 - p.life / p.max;
            c.fillStyle = `hsla(${p.hue}, 100%, ${65 + 25 * k}%, ${k})`;
            c.beginPath();
            c.arc(p.x, p.y, p.size * (0.4 + k * 0.6), 0, TAU);
            c.fill();
        }
        c.restore();
    }

    // vaga-lumes ambientes
    const motes = Array.from({ length: 36 }, () => ({ x: Math.random(), y: Math.random(), p: Math.random() * TAU, s: rand(0.3, 1) }));
    function drawMotes(c, now) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        for (const m of motes) {
            const x = (m.x * W + Math.sin(now / 3000 * m.s + m.p) * 30 + W) % W;
            const y = (m.y * H - (now / 40 * m.s) % H + H) % H;
            const a = 0.25 + 0.25 * Math.sin(now / 700 + m.p);
            c.fillStyle = `rgba(255, 224, 160, ${a})`;
            c.beginPath(); c.arc(x, y, 1.6, 0, TAU); c.fill();
        }
        c.restore();
    }

    function render(now) {
        ctx.clearRect(0, 0, W, H);
        if (bgCache) ctx.drawImage(bgCache, 0, 0, W, H);
        drawMotes(ctx, now);
        drawDragon(ctx, dragon, now);
        drawWizard(ctx, now);
        drawBeams(ctx, now);
        drawRings(ctx, now);
        drawParticles(ctx);
        if (flash > 0) {
            ctx.fillStyle = `rgba(190, 235, 255, ${flash * 0.45})`;
            ctx.fillRect(0, 0, W, H);
        }
    }

    // ---------------------------------------------------------
    // Loop
    // ---------------------------------------------------------
    let last = 0;
    function loop(now) {
        const dt = Math.min(now - last, 50);
        last = now;
        update(now, dt);
        render(now);
        requestAnimationFrame(loop);
    }

    function start() {
        resize();
        spawnDragonOffscreen();
        requestAnimationFrame((t) => {
            last = t;
            startApproach(t);
            loop(t);
        });
    }

    bgImg.addEventListener('load', buildBackground);
    window.addEventListener('resize', resize);
    start();

    // Para testes/inspeção
    window.__scene = { dragon, wiz };
})();
