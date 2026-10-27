const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Mobile navigation toggle
document.addEventListener('DOMContentLoaded', function() {
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (navToggle && navMenu) {
        navToggle.setAttribute('aria-label', 'Open menu');
        navToggle.setAttribute('aria-expanded', 'false');

        const setOpen = open => {
            navMenu.classList.toggle('active', open);
            navToggle.classList.toggle('active', open);
            navToggle.setAttribute('aria-expanded', String(open));
            navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        };

        navToggle.addEventListener('click', () => setOpen(!navMenu.classList.contains('active')));
        navMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setOpen(false)));
    }
});

// Header shadow once the page scrolls
window.addEventListener('scroll', function() {
    const header = document.querySelector('.header');
    if (header) {
        header.classList.toggle('scrolled', window.scrollY > 24);
    }
}, { passive: true });

// Bathymetric contour field behind the hero and page headers.
// Marching squares over a slowly drifting wave field; every fourth line is an index contour.
function initContours(band) {
    const canvas = document.createElement('canvas');
    canvas.className = 'contour-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    band.prepend(canvas);

    const ctx = canvas.getContext('2d');
    const CELL = 12;
    const LEVELS = [];
    for (let v = -1.6; v <= 1.6001; v += 0.2) {
        LEVELS.push(v);
    }

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let field = new Float32Array(0);
    let visible = true;
    let lastFrame = 0;

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = band.clientWidth;
        height = band.clientHeight;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cols = Math.ceil(width / CELL) + 1;
        rows = Math.ceil(height / CELL) + 1;
        field = new Float32Array(cols * rows);
    }

    function sample(px, py, t) {
        const x = px / 190;
        const y = py / 190;
        return Math.sin(x * 0.9 + t) * Math.cos(y * 1.1 - t * 0.6)
            + 0.6 * Math.sin((x * 0.5 + y * 0.8) * 1.3 + t * 0.8)
            + 0.45 * Math.cos(Math.hypot(x - 4.5, y - 1.2) * 1.5 - t * 1.1);
    }

    function draw(t) {
        for (let j = 0; j < rows; j++) {
            for (let i = 0; i < cols; i++) {
                field[j * cols + i] = sample(i * CELL, j * CELL, t);
            }
        }

        ctx.clearRect(0, 0, width, height);

        LEVELS.forEach((level, k) => {
            const isIndex = k % 4 === 0;
            ctx.beginPath();
            ctx.strokeStyle = isIndex ? 'rgba(140, 236, 246, 0.36)' : 'rgba(140, 236, 246, 0.14)';
            ctx.lineWidth = isIndex ? 1.2 : 0.8;

            for (let j = 0; j < rows - 1; j++) {
                for (let i = 0; i < cols - 1; i++) {
                    const a = field[j * cols + i];
                    const b = field[j * cols + i + 1];
                    const c = field[(j + 1) * cols + i + 1];
                    const d = field[(j + 1) * cols + i];
                    const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
                    if (idx === 0 || idx === 15) continue;

                    const x = i * CELL;
                    const y = j * CELL;
                    const top = [x + CELL * (level - a) / (b - a), y];
                    const right = [x + CELL, y + CELL * (level - b) / (c - b)];
                    const bottom = [x + CELL * (level - d) / (c - d), y + CELL];
                    const left = [x, y + CELL * (level - a) / (d - a)];

                    const seg = (p, q) => {
                        ctx.moveTo(p[0], p[1]);
                        ctx.lineTo(q[0], q[1]);
                    };

                    switch (idx) {
                        case 1: case 14: seg(left, bottom); break;
                        case 2: case 13: seg(bottom, right); break;
                        case 3: case 12: seg(left, right); break;
                        case 4: case 11: seg(top, right); break;
                        case 5: seg(left, top); seg(bottom, right); break;
                        case 6: case 9: seg(top, bottom); break;
                        case 7: case 8: seg(left, top); break;
                        case 10: seg(left, bottom); seg(top, right); break;
                    }
                }
            }
            ctx.stroke();
        });
    }

    function loop(now) {
        if (visible && !document.hidden && now - lastFrame > 40) {
            lastFrame = now;
            draw(now * 0.00012);
        }
        requestAnimationFrame(loop);
    }

    resize();
    draw(0);

    window.addEventListener('resize', () => {
        resize();
        draw(lastFrame * 0.00012);
    });

    if (!prefersReducedMotion) {
        new IntersectionObserver(entries => {
            visible = entries[0].isIntersecting;
        }).observe(band);
        requestAnimationFrame(loop);
    }
}

// Team monograms in place of the generic person icon
function initMonograms() {
    document.querySelectorAll('.team-member-card').forEach(card => {
        const photo = card.querySelector('.member-photo');
        const name = card.querySelector('h3');
        if (!photo || !name || photo.querySelector('img')) return;

        const words = name.textContent.replace(/^Dr\.?\s+/i, '').trim().split(/\s+/);
        const initials = (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
        photo.innerHTML = '';
        const span = document.createElement('span');
        span.className = 'member-initials';
        span.textContent = initials;
        photo.append(span);
        photo.setAttribute('aria-hidden', 'true');
    });
}

// Count stat figures up from zero when they scroll into view
function countUp(el) {
    const target = parseInt(el.textContent, 10);
    if (Number.isNaN(target)) return;
    const start = performance.now();
    const duration = 1200;
    el.textContent = '0';

    function tick(now) {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

// Reveal cards as they enter the viewport. Anything already on screen at load stays as is.
function initReveal() {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) return;

    const selector = [
        '.overview-card', '.quick-link-card', '.objective-item', '.wp-card', '.timeline-year',
        '.timeline-item', '.stat-card', '.partner-detailed-card', '.team-member-card',
        '.publication-item', '.research-area-card', '.video-card'
    ].join(', ');

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('revealed');
            const stat = entry.target.querySelector('.stat-number');
            if (stat) countUp(stat);
            obs.unobserve(entry.target);
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll(selector).forEach(el => {
        if (el.getBoundingClientRect().top < window.innerHeight) return;
        const siblings = Array.from(el.parentElement.children);
        el.style.transitionDelay = `${(siblings.indexOf(el) % 4) * 70}ms`;
        el.classList.add('will-reveal');
        observer.observe(el);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.hero, .page-header').forEach(initContours);
    initMonograms();
    initReveal();
});

// Team member email copy to clipboard
document.querySelectorAll('.email-link').forEach(emailLink => {
    emailLink.addEventListener('click', function(e) {
        e.preventDefault();
        const email = this.textContent.trim();

        if (navigator.clipboard) {
            navigator.clipboard.writeText(email)
                .then(() => showToast(`Copied ${email}`))
                .catch(() => { window.location.href = this.href; });
        } else {
            window.location.href = this.href;
        }
    });
});

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2600);
}
