/* Página inicial: céu estrelado de fundo + mini galáxia em espiral */
(function () {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---- Céu de fundo ----
    const sky = document.getElementById('sky');
    const sctx = sky.getContext('2d');
    let stars = [];

    function resizeSky() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        sky.width = innerWidth * dpr;
        sky.height = innerHeight * dpr;
        sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const count = Math.round((innerWidth * innerHeight) / 9000);
        stars = Array.from({ length: count }, () => ({
            x: Math.random() * innerWidth,
            y: Math.random() * innerHeight,
            r: Math.random() * 1.2 + 0.3,
            p: Math.random() * Math.PI * 2,
            s: Math.random() * 1.5 + 0.5,
        }));
    }

    function drawSky(t) {
        sctx.clearRect(0, 0, innerWidth, innerHeight);
        for (const st of stars) {
            const a = 0.45 + 0.45 * Math.sin(t / 1000 * st.s + st.p);
            sctx.fillStyle = `rgba(255, 244, 220, ${a})`;
            sctx.beginPath();
            sctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
            sctx.fill();
        }
    }

    // ---- Mini galáxia ----
    const mg = document.getElementById('mini-galaxy');
    const gctx = mg.getContext('2d');
    const W = mg.width, C = W / 2;
    const ARMS = 3;
    const dots = [];
    for (let i = 0; i < 1400; i++) {
        const dist = Math.pow(Math.random(), 0.7);
        const arm = Math.floor(Math.random() * ARMS);
        const angle = dist * 5.2 + (arm / ARMS) * Math.PI * 2 + (Math.random() - 0.5) * (0.9 - dist * 0.5);
        const hue = dist < 0.25 ? 40 : dist < 0.6 ? 270 : 205;
        dots.push({ angle, dist, size: Math.random() * 1.8 + 0.5, hue, light: 70 + Math.random() * 25 });
    }

    function drawGalaxy(t) {
        gctx.clearRect(0, 0, W, W);
        const bg = gctx.createRadialGradient(C, C, 0, C, C, C);
        bg.addColorStop(0, 'rgba(255, 214, 140, 0.9)');
        bg.addColorStop(0.12, 'rgba(255, 190, 110, 0.45)');
        bg.addColorStop(0.45, 'rgba(120, 80, 200, 0.18)');
        bg.addColorStop(1, 'rgba(5, 4, 12, 0)');
        gctx.fillStyle = bg;
        gctx.fillRect(0, 0, W, W);
        const rot = t / 9000;
        gctx.save();
        gctx.translate(C, C);
        gctx.scale(1, 0.62);
        gctx.rotate(-0.5);
        for (const d of dots) {
            const a = d.angle + rot * (1.2 - d.dist);
            const r = d.dist * C * 0.92;
            gctx.fillStyle = `hsla(${d.hue}, 90%, ${d.light}%, ${0.9 - d.dist * 0.35})`;
            gctx.beginPath();
            gctx.arc(Math.cos(a) * r, Math.sin(a) * r, d.size, 0, Math.PI * 2);
            gctx.fill();
        }
        gctx.restore();
    }

    function frame(t) {
        drawSky(t);
        drawGalaxy(t);
        if (!reduceMotion) requestAnimationFrame(frame);
    }

    resizeSky();
    addEventListener('resize', () => { resizeSky(); if (reduceMotion) frame(0); });
    requestAnimationFrame(frame);
})();
