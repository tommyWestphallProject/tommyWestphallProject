// Same drifting specks as architgoswami.com.
(function () {
    const canvas = document.getElementById('particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let dots = [];
    let width = 0;
    let height = 0;
    let running = true;

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const count = Math.max(28, Math.round((width * height) / 18000));
        dots = Array.from({ length: count }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            r: Math.random() * 1.15 + 0.35,
            o: Math.random() * 0.45 + 0.15,
            vy: Math.random() * 0.18 + 0.04
        }));
    }

    function frame() {
        if (!running) return;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        for (const dot of dots) {
            if (!reduceMotion) {
                dot.y -= dot.vy;
                if (dot.y < -2) dot.y = height + 2;
            }
            ctx.globalAlpha = dot.o;
            ctx.beginPath();
            ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        requestAnimationFrame(frame);
    }

    resize();
    frame();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => {
        running = !document.hidden;
        if (running) frame();
    });
})();
