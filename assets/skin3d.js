// JVRAS Launcher - animowana postać 3D ze skinem gracza (czyste CSS 3D, bez bibliotek).
// Użycie: const v = JvrasSkin.mount(el); v.setSkin({ skin, cape, slim }); v.setMode('idle'|'run'); v.play('wave'|'jump'|'spin'|'celebrate');
(function () {
  'use strict';

  // Zastępczy skin (gdy brak internetu): prosta postać w stylu Steve'a rysowana na canvasie.
  let steveUrl = null;
  function steve() {
    if (steveUrl) return steveUrl;
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    const fill = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    fill('#b4846c', 0, 0, 32, 16);                       // głowa
    fill('#3b2a1e', 0, 0, 32, 8); fill('#3b2a1e', 8, 8, 8, 2);  // włosy
    fill('#ffffff', 9, 12, 2, 1); fill('#ffffff', 13, 12, 2, 1);
    fill('#523d89', 10, 12, 1, 1); fill('#523d89', 13, 12, 1, 1);
    fill('#8a4c3d', 11, 14, 2, 1);
    fill('#00a8a8', 16, 16, 24, 16);                     // tułów
    fill('#b4846c', 40, 16, 16, 16); fill('#00a8a8', 40, 16, 16, 4); // ręka
    fill('#3c3c9e', 0, 16, 16, 16);                      // noga
    fill('#b4846c', 32, 48, 16, 16); fill('#00a8a8', 32, 48, 16, 4);
    fill('#3c3c9e', 16, 48, 16, 16);
    steveUrl = c.toDataURL('image/png');
    return steveUrl;
  }

  // [u, v, szerokość, wysokość, głębokość] w pikselach tekstury 64x64
  const PARTS = {
    head:     { base: [0, 0],   over: [32, 0],  size: [8, 8, 8] },
    body:     { base: [16, 16], over: [16, 32], size: [8, 12, 4] },
    armR:     { base: [40, 16], over: [40, 32], size: [4, 12, 4] },
    armL:     { base: [32, 48], over: [48, 48], size: [4, 12, 4], legacy: [40, 16] },
    legR:     { base: [0, 16],  over: [0, 32],  size: [4, 12, 4] },
    legL:     { base: [16, 48], over: [0, 48],  size: [4, 12, 4], legacy: [0, 16] }
  };

  function el(cls, parent) {
    const d = document.createElement('div');
    d.className = cls;
    if (parent) parent.appendChild(d);
    return d;
  }

  // Prostopadłościan z 6 ścian wyciętych z tekstury (układ jak w Minecrafcie).
  function box(parent, img, texW, texH, uv, w, h, d, S) {
    const b = el('sk-box', parent);
    b.style.width = w * S + 'px';
    b.style.height = h * S + 'px';
    const [u, v] = uv;
    const faces = [
      ['front',  u + d,         v + d, w, h, 'translateZ(' + (d * S / 2) + 'px)'],
      ['back',   u + d + w + d, v + d, w, h, 'rotateY(180deg) translateZ(' + (d * S / 2) + 'px)'],
      ['right',  u,             v + d, d, h, 'rotateY(-90deg) translateZ(' + (w * S / 2) + 'px)'],
      ['left',   u + d + w,     v + d, d, h, 'rotateY(90deg) translateZ(' + (w * S / 2) + 'px)'],
      ['top',    u + d,         v,     w, d, 'rotateX(90deg) translateZ(' + (h * S / 2) + 'px)'],
      ['bottom', u + d + w,     v,     w, d, 'rotateX(-90deg) translateZ(' + (h * S / 2) + 'px) scaleY(-1)']
    ];
    for (const [name, fu, fv, fw, fh, tr] of faces) {
      const f = el('sk-face sk-' + name, b);
      f.style.width = fw * S + 'px';
      f.style.height = fh * S + 'px';
      f.style.left = ((w - fw) * S / 2) + 'px';
      f.style.top = ((h - fh) * S / 2) + 'px';
      f.style.backgroundImage = 'url("' + img + '")';
      f.style.backgroundSize = (texW * S) + 'px ' + (texH * S) + 'px';
      f.style.backgroundPosition = (-fu * S) + 'px ' + (-fv * S) + 'px';
      f.style.transform = tr;
    }
    return b;
  }

  function loadImage(src) {
    return new Promise((res) => {
      if (!src) return res(null);
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => res(null);
      i.src = src;
    });
  }

  const DEG = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Rodzaje cząsteczek z kreatora: wygląd w podglądzie (s = kształt, c = kolor, px = rozmiar w px Minecrafta,
  // life = czas życia w s). tint = kolor z ustawień (tylko pył). Mod rysuje prawdziwe cząsteczki MC o tych nazwach.
  const FX_PARTICLES = {
    dust: { n: 'Kolorowy pył', s: 'sq', c: '#FFE600', px: 2.2, life: 1.2, tint: 1, shrink: 1 },
    spark: { n: 'Iskry', s: 'sq', c: '#bfe9ff', px: 1.4, life: 0.7, shrink: 1 },
    flame: { n: 'Płomień', s: 'flame', c: '#ff9a1f', px: 2.4, life: 1, shrink: 1 },
    soul: { n: 'Płomień dusz', s: 'flame', c: '#3fe0f0', px: 2.4, life: 1, shrink: 1 },
    heart: { n: 'Serduszka', s: 'heart', c: '#ff3b5c', px: 3.2, life: 1.3 },
    note: { n: 'Nuty', s: 'txt', c: '#7CFF6B', t: '♪♫', px: 4, life: 1.2 },
    star: { n: 'Gwiazdki', s: 'star', c: '#fff6c2', px: 3, life: 1.1, spin: 1, shrink: 1 },
    snow: { n: 'Śnieg', s: 'dot', c: '#ffffff', px: 1.6, life: 2.2 },
    end_rod: { n: 'Pałeczka Endu', s: 'glow', c: '#fffbe8', px: 1.6, life: 1.8, shrink: 1 },
    cherry: { n: 'Płatki wiśni', s: 'petal', c: '#ffb7d5', px: 2.6, life: 2.4, spin: 1 },
    enchant: { n: 'Runy', s: 'txt', c: '#d6ccff', t: 'ᔑʖᓵ↸ᒷ⎓⊣⍑╎ꖌꖎᒲリ𝙹ᑑ∷ᓭℸ⚍⍊∴', px: 3.4, life: 1.4 },
    totem: { n: 'Totem', s: 'sq', c: '#c9f24a', px: 1.8, life: 1.4, shrink: 1 },
    witch: { n: 'Magia', s: 'star', c: '#b65cff', px: 2.4, life: 1, spin: 1, shrink: 1 },
    happy: { n: 'Zielone iskierki', s: 'star', c: '#5dff7a', px: 2.2, life: 1, shrink: 1 },
    sculk: { n: 'Dusze sculku', s: 'glow', c: '#2fd6e8', px: 2.6, life: 1.6, shrink: 1 },
    portal: { n: 'Portal', s: 'dot', c: '#c04cff', px: 1.6, life: 1.2, shrink: 1 },
    cloud: { n: 'Chmurki', s: 'dot', c: '#f2f2f2', px: 3.6, life: 1.6 },
    firework: { n: 'Fajerwerki', s: 'glow', c: '#ffffff', px: 1.6, life: 1, shrink: 1 },
    spore: { n: 'Zarodniki', s: 'dot', c: '#e7a6ff', px: 1.4, life: 2.4 },
    crit: { n: 'Magiczne trafienie', s: 'star', c: '#7ad8ff', px: 2, life: 0.8, spin: 1, shrink: 1 }
  };
  const FX_MOTIONS = { rise: 'Unoszenie się', orbit: 'Orbita', spiral: 'Spirala', ring: 'Pierścień', rain: 'Deszcz z góry', burst: 'Wybuchy', trail: 'Ślad pod stopami' };
  (function fxStyles() {
    if (document.getElementById('sk-fx-css')) return;
    const st = document.createElement('style'); st.id = 'sk-fx-css';
    st.textContent = '.sk-q{position:absolute;display:block;width:var(--z);height:var(--z);margin:calc(var(--z)/-2);background:var(--c);pointer-events:none;will-change:transform,opacity}' +
      '.sk-q-sq{image-rendering:pixelated}' +
      '.sk-q-dot{border-radius:50%}' +
      '.sk-q-glow{border-radius:50%;box-shadow:0 0 calc(var(--z)*1.5) var(--c)}' +
      '.sk-q-flame{border-radius:50% 50% 50% 50%/60% 60% 40% 40%;box-shadow:0 0 calc(var(--z)) var(--c)}' +
      '.sk-q-star{clip-path:polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%);filter:drop-shadow(0 0 3px var(--c))}' +
      '.sk-q-heart{clip-path:polygon(50% 100%,8% 58%,0 30%,12% 8%,32% 4%,50% 22%,68% 4%,88% 8%,100% 30%,92% 58%)}' +
      '.sk-q-petal{border-radius:0 70% 0 70%}' +
      '.sk-q-txt{background:none;color:var(--c);font:700 var(--z)/1 system-ui,sans-serif;width:auto;height:auto;text-shadow:0 0 6px var(--c)}';
    document.head.appendChild(st);
  })();
  const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const easeInOut = (x) => { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

  const POSE_KEYS = ['headYaw', 'headPitch', 'headRoll', 'armRx', 'armRz', 'armLx', 'armLz', 'legRx', 'legLx',
    'lean', 'twist', 'roll', 'y', 'cape', 'yaw', 'spin', 'sx', 'sy'];
  function blank() {
    const p = {};
    for (const k of POSE_KEYS) p[k] = 0;
    p.sx = 1; p.sy = 1; p.cape = 8;
    return p;
  }

  // Animacje: każda zwraca pozę dla czasu t (sekundy od początku animacji) i T (czas globalny).
  // Przejścia między animacjami są płynnie mieszane, więc nic nie "przeskakuje".
  const ACTIONS = {
    idle: { dur: [3.5, 6], pose(t, T, S) {
      const p = blank(), br = Math.sin(T * 1.7);
      p.armRz = 4 + br * 2.2; p.armLz = -4 - br * 2.2;
      p.armRx = Math.sin(T * 0.8) * 4; p.armLx = -Math.sin(T * 0.8) * 4;
      p.y = br * S * 0.12; p.sy = 1 + br * 0.006;
      p.headPitch = Math.sin(T * 0.6) * 3; p.headYaw = Math.sin(T * 0.37) * 8;
      p.cape = 9 + Math.sin(T * 1.3) * 2;
      return p;
    } },
    walk: { dur: [4, 6.5], pose(t, T, S) {
      const p = blank(), ph = t * Math.PI * 2 * 1.45, s = Math.sin(ph), c = Math.cos(ph);
      p.legRx = s * 36; p.legLx = -s * 36;
      p.armRx = -s * 32; p.armLx = s * 32;
      p.armRz = 4 + Math.abs(s) * 2; p.armLz = -4 - Math.abs(s) * 2;
      p.y = -Math.abs(c) * S * 0.55; p.twist = s * 5; p.roll = c * 1.5; p.lean = 3;
      p.headYaw = -s * 3; p.headPitch = 2;
      p.cape = 20 + Math.abs(s) * 8; p.yaw = -38;
      return p;
    } },
    run: { dur: [99, 99], pose(t, T, S) {
      const p = blank(), ph = t * Math.PI * 2 * 2.4, s = Math.sin(ph), c = Math.cos(ph);
      p.legRx = s * 58; p.legLx = -s * 58;
      p.armRx = -s * 62; p.armLx = s * 62;
      p.armRz = 8; p.armLz = -8;
      p.y = -Math.abs(c) * S * 1.1; p.twist = s * 8; p.lean = 12;
      p.headPitch = -6; p.cape = 48 + Math.abs(s) * 10; p.yaw = -48;
      return p;
    } },
    wave: { dur: [2.2, 2.2], pose(t, T, S) {
      const p = ACTIONS.idle.pose(t, T, S), up = smooth(t / 0.35) * (1 - smooth((t - 1.85) / 0.35));
      p.armRz = 4 + up * (148 + Math.sin(t * 13) * 16);
      p.armRx = up * -8;
      p.headRoll = up * -6; p.headYaw = up * 14; p.roll = up * 2;
      p.yaw = up * 12;
      return p;
    } },
    look: { dur: [3, 3], pose(t, T, S) {
      const p = ACTIONS.idle.pose(t, T, S);
      const a = smooth(t / 0.6) - smooth((t - 1.3) / 0.6) * 2 + smooth((t - 2.4) / 0.6);
      p.headYaw = a * 52; p.headPitch = -4 + Math.sin(t * 2) * 2; p.twist = a * 6;
      p.armRz += Math.max(0, a) * 4;
      return p;
    } },
    jump: { dur: [1.25, 1.25], pose(t, T, S) {
      const p = ACTIONS.idle.pose(t, T, S);
      const squat = smooth(t / 0.22) * (1 - smooth((t - 0.22) / 0.08)) + smooth((t - 0.86) / 0.06) * (1 - smooth((t - 0.95) / 0.3));
      const air = t > 0.28 && t < 0.88 ? Math.sin((t - 0.28) / 0.6 * Math.PI) : 0;
      p.y += squat * S * 0.9 - air * S * 4.2;
      p.lean += squat * 14;
      p.sy = 1 - squat * 0.06 + air * 0.03; p.sx = 1 + squat * 0.04;
      const arms = smooth((t - 0.2) / 0.15) * (1 - smooth((t - 0.85) / 0.25));
      p.armRz = 4 + arms * 150; p.armLz = -4 - arms * 150;
      p.armRx = squat * -25; p.armLx = squat * -25;
      p.legRx = air * -14; p.legLx = air * 18;
      p.cape = 10 + air * 45 + squat * 10;
      p.headPitch = -air * 10;
      return p;
    } },
    spin: { dur: [1.6, 1.6], pose(t, T, S) {
      const p = ACTIONS.idle.pose(t, T, S);
      p.spin = (easeInOut(t / 1.5) * 360) % 360;
      const a = Math.sin(clamp(t / 1.5, 0, 1) * Math.PI);
      p.armRz = 4 + a * 70; p.armLz = -4 - a * 70;
      p.cape = 9 + a * 40; p.y -= a * S * 0.6;
      return p;
    } },
    celebrate: { dur: [2.6, 2.6], pose(t, T, S) {
      const p = blank(), b = Math.abs(Math.sin(t * 7));
      p.y = -b * S * 2.4; p.sy = 1 + b * 0.03;
      p.armRz = 155 + Math.sin(t * 14) * 12; p.armLz = -155 + Math.sin(t * 14) * 12;
      p.legRx = b * -10; p.legLx = b * 10;
      p.headPitch = -10; p.cape = 20 + b * 35; p.yaw = Math.sin(t * 3) * 25;
      return p;
    } }
  };
  // Losowanie kolejnej animacji w trybie spoczynku (wagi)
  const IDLE_PLAN = [['idle', 4], ['walk', 4], ['look', 2], ['wave', 1.4], ['jump', 1.4], ['spin', 0.8]];

  function mount(host) {
    const stage = el('sk-stage', null);
    host.appendChild(stage);
    const root = el('sk-root', stage);
    const parts = {};
    const reduce = false; // animacje postaci zawsze włączone
    let S = 9, buildId = 0, current = null;
    let mode = 'idle';
    let clock = 0, lastT = performance.now();
    let act = { name: 'idle', start: 0, until: 4 }, prev = null, fadeStart = -10, FADE = 0.55;
    let queued = null;
    let baseYaw = -24, yaw = -24, userYaw = null, userUntil = 0, dragging = false, dragX = 0, dragYaw = 0;
    let mouse = null, mouseAt = -10, headYawM = 0, headPitchM = 0;
    // rozmiar i widoczność zapamiętywane z obserwatora - pętla animacji nic nie mierzy (bez wymuszania układu co klatkę)
    let hostW = host.clientWidth || 220, hostVisible = host.offsetParent !== null, hostRect = null;
    if (window.ResizeObserver) new ResizeObserver((es) => { const r = es[0].contentRect; hostW = r.width || hostW; hostVisible = r.width > 0 && r.height > 0; hostRect = null; }).observe(host);
    let cos = {}, cosKey = '{}', mojangCape = null, capeAnim = null;
    let wingP = 0, wingF = 2.4, wingA = 7, wingT = 0; // faza, prędkość i siła machania skrzydeł (wygładzane)

    async function build(data) {
      const id = ++buildId;
      const skinImg = await loadImage(data && data.skin) || await loadImage(steve());
      const capeImg = await loadImage(data && data.cape);
      if (id !== buildId) return; // nowszy skin w drodze
      // zmiana skina (np. inne konto): stara postać płynnie znika, nowa się pojawia
      const swapping = host.classList.contains('sk-ready') && host.offsetParent !== null && !!stage.animate;
      if (swapping) {
        const out = stage.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(10px) scale(0.94)' }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
        await out.finished.catch(() => {});
        if (id !== buildId) return;
        out.cancel();
        stage.animate([{ opacity: 0, transform: 'translateY(14px) scale(0.92)' }, { opacity: 1, transform: 'none' }], { duration: 650, easing: 'cubic-bezier(0.22, 1.25, 0.36, 1)' });
      }
      const legacy = skinImg && skinImg.naturalHeight * 2 === skinImg.naturalWidth;
      const texH = legacy ? 32 : 64;
      const src = skinImg ? skinImg.src : steve();
      const slim = !!(data && data.slim);
      S = Math.max(5, Math.floor((host.clientHeight || 300) / 36));

      root.innerHTML = '';
      root.style.width = 16 * S + 'px';
      root.style.height = 32 * S + 'px';
      // górna część ciała obraca się wokół bioder: głowa, tułów, ręce i peleryna poruszają się razem
      const upper = el('sk-part sk-upper', root);
      upper.style.left = '0px'; upper.style.top = '0px';
      upper.style.width = 16 * S + 'px'; upper.style.height = 20 * S + 'px';
      upper.style.transformOrigin = '50% 100%';
      parts.upper = upper;

      const aw = slim ? 3 : 4;
      const layout = {
        head: { x: 4, y: 0, origin: '50% 100%', parent: upper },
        body: { x: 4, y: 8, origin: '50% 50%', parent: upper },
        armR: { x: 4 - aw, y: 8, origin: (aw === 3 ? '66%' : '75%') + ' ' + (2 * S) + 'px', w: aw, parent: upper },
        armL: { x: 12, y: 8, origin: (aw === 3 ? '33%' : '25%') + ' ' + (2 * S) + 'px', w: aw, parent: upper },
        legR: { x: 4, y: 20, origin: '50% 0', parent: root },
        legL: { x: 8, y: 20, origin: '50% 0', parent: root }
      };
      for (const key of Object.keys(PARTS)) {
        const p = PARTS[key], L = layout[key];
        const [bw, h, d] = p.size, w = L.w || bw;
        const part = el('sk-part sk-' + key, L.parent);
        part.style.left = L.x * S + 'px';
        part.style.top = L.y * S + 'px';
        part.style.width = w * S + 'px';
        part.style.height = h * S + 'px';
        part.style.transformOrigin = L.origin;
        const baseUv = legacy && p.legacy ? p.legacy : p.base;
        box(part, src, 64, texH, baseUv, w, h, d, S);
        if (!legacy || key === 'head') {
          const ov = box(part, src, 64, texH, p.over, w, h, d, S);
          ov.classList.add('sk-overlay');
          ov.style.transform = key === 'head' ? 'scale3d(1.125,1.125,1.125)' : 'scale3d(1.08,1.04,1.12)';
        }
        parts[key] = part;
      }

      mojangCape = capeImg ? capeImg.src : null;
      parts.cape = parts.wingA = parts.wingB = parts.halo = parts.crown = null;
      buildExtras();
      host.classList.add('sk-ready');
      apply(currentPose());
    }

    // --- sterowanie myszą: obrót przeciąganiem, klik = pomachanie, głowa patrzy na kursor ---
    function onDown(e) {
      dragging = true; dragX = e.clientX; dragYaw = userYaw == null ? yaw : userYaw;
      host.classList.add('sk-dragging');
      e.preventDefault();
    }
    function onMove(e) {
      mouse = { x: e.clientX, y: e.clientY }; mouseAt = clock;
      if (hostVisible) hostRect = host.getBoundingClientRect(); // pomiar w zdarzeniu, nie w klatce animacji
      if (!dragging) return;
      userYaw = dragYaw + (e.clientX - dragX) * 0.9;
      userUntil = clock + 4;
    }
    function onUp(e) {
      if (!dragging) return;
      dragging = false;
      host.classList.remove('sk-dragging');
      if (Math.abs(e.clientX - dragX) < 4) play(Math.random() < 0.5 ? 'wave' : 'jump');
    }
    host.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    function startAction(name) {
      const a = ACTIONS[name];
      prev = { name: act.name, start: act.start };
      fadeStart = clock;
      const [lo, hi] = a.dur;
      act = { name, start: clock, until: clock + lo + Math.random() * (hi - lo) };
    }
    function pickNext() {
      if (queued) { const q = queued; queued = null; return q; }
      if (mode === 'run') return 'run';
      if (reduce) return 'idle';
      let total = 0;
      const opts = IDLE_PLAN.filter(([n]) => n !== act.name || n === 'idle');
      for (const [, w] of opts) total += w;
      let r = Math.random() * total;
      for (const [n, w] of opts) { if ((r -= w) <= 0) return n; }
      return 'idle';
    }
    function play(name) {
      if (!ACTIONS[name]) return;
      if (act.name === name) return;
      startAction(name);
    }

    function poseOf(a) {
      return ACTIONS[a.name].pose(clock - a.start, clock, S);
    }
    function currentPose() {
      const cur = poseOf(act);
      const w = prev ? smooth((clock - fadeStart) / FADE) : 1;
      if (w >= 1 || !prev) { prev = null; return cur; }
      const old = poseOf(prev), out = {};
      for (const k of POSE_KEYS) out[k] = old[k] + (cur[k] - old[k]) * w;
      return out;
    }

    function apply(p) {
      if (!parts.head) return;
      // głowa: animacja + śledzenie kursora (gdy mysz się ruszała w ostatnich sekundach)
      const mw = smooth(1.5 - (clock - mouseAt) / 2) * (act.name === 'look' || act.name === 'spin' ? 0.2 : 1);
      const hy = p.headYaw * (1 - mw * 0.7) + headYawM * mw;
      const hp = p.headPitch * (1 - mw * 0.7) + headPitchM * mw;
      root.style.transform = 'translateY(' + p.y.toFixed(2) + 'px) rotateX(-6deg) rotateY(' + (yaw + p.spin).toFixed(2) + 'deg) rotateZ(' + p.roll.toFixed(2) + 'deg) scale(' + p.sx.toFixed(4) + ',' + p.sy.toFixed(4) + ')';
      parts.upper.style.transform = 'rotateX(' + (-p.lean).toFixed(2) + 'deg) rotateY(' + p.twist.toFixed(2) + 'deg)';
      parts.head.style.transform = 'rotateY(' + clamp(hy, -70, 70).toFixed(2) + 'deg) rotateX(' + (-clamp(hp, -35, 35)).toFixed(2) + 'deg) rotateZ(' + p.headRoll.toFixed(2) + 'deg)';
      parts.armR.style.transform = 'rotateX(' + p.armRx.toFixed(2) + 'deg) rotateZ(' + p.armRz.toFixed(2) + 'deg)';
      parts.armL.style.transform = 'rotateX(' + p.armLx.toFixed(2) + 'deg) rotateZ(' + p.armLz.toFixed(2) + 'deg)';
      parts.legR.style.transform = 'rotateX(' + p.legRx.toFixed(2) + 'deg)';
      parts.legL.style.transform = 'rotateX(' + p.legLx.toFixed(2) + 'deg)';
      parts.body.style.transform = '';
      if (parts.cape) parts.cape.style.transform = 'translateZ(' + (-2.55 * S).toFixed(2) + 'px) rotateX(' + (-Math.max(4, p.cape)).toFixed(2) + 'deg)';
      if (parts.wingA) {
        // skrzydła machają spokojnie w miejscu, szybciej w ruchu i przy skoku.
        // Faza narasta płynnie (prędkość i siła machania przechodzą łagodnie) - zmiana ruchu postaci
        // nie może przeskoczyć fazy, bo wtedy skrzydła szarpały / machały nagle bardzo szybko.
        const fast = act.name === 'run' || act.name === 'jump' || act.name === 'celebrate';
        const moving = fast || act.name === 'walk';
        const dt = Math.min(0.05, Math.max(0, clock - wingT)); wingT = clock;
        const k = 1 - Math.exp(-dt * 3);
        wingF += ((fast ? 11 : moving ? 6 : 2.4) - wingF) * k;
        wingA += ((fast ? 22 : moving ? 12 : 7) - wingA) * k;
        wingP += dt * wingF;
        const ang = 24 + p.cape * 0.25 + Math.sin(wingP) * wingA;
        const tr = 'translateZ(' + (-2.4 * S).toFixed(2) + 'px) rotateX(' + (-p.lean * 0.3 - 6).toFixed(2) + 'deg) rotateY(';
        parts.wingA.style.transform = tr + ang.toFixed(2) + 'deg)';
        parts.wingB.style.transform = tr + (-ang).toFixed(2) + 'deg)';
      }
      if (parts.halo) parts.halo.style.transform = 'translateY(' + (-5.6 * S + Math.sin(clock * 2.2) * S * 0.35).toFixed(2) + 'px) rotateX(80deg) rotateZ(' + ((clock * 50) % 360).toFixed(1) + 'deg)';
    }

    // --- kosmetyki JVRAS: peleryna z katalogu (ma pierwszeństwo przed peleryną Mojang), skrzydła, głowa ---
    function buildExtras() {
      if (!parts.upper) return;
      ['cape', 'wingA', 'wingB', 'halo', 'crown'].forEach(k => { if (parts[k]) { parts[k].remove(); parts[k] = null; } });
      const capeSrc = (cos.cape && cos.cape.tex) || mojangCape;
      if (capeSrc) {
        // peleryna 10x16x1 za plecami; obrócona, żeby wzór był widoczny od tyłu
        const wrap = el('sk-part sk-cape', parts.upper);
        wrap.style.left = 3 * S + 'px';
        wrap.style.top = 8 * S + 'px';
        wrap.style.width = 10 * S + 'px';
        wrap.style.height = 16 * S + 'px';
        wrap.style.transformOrigin = '50% 0 0';
        const inner = box(wrap, capeSrc, 64, 32, [0, 0], 10, 16, 1, S);
        inner.style.transform = 'rotateY(180deg)';
        parts.cape = wrap;
        const c = cos.cape;
        const urls = c && Array.isArray(c.frameUrls) && c.frameUrls.length > 1 ? c.frameUrls : c && c.frames > 1 ? Array.from({ length: c.frames }, (_, k) => c.tex.replace(/_0\.png$/, '_' + k + '.png')) : null;
        capeAnim = urls ? { urls, fps: c.fps || 6, cur: 0, faces: [...inner.querySelectorAll('.sk-face')], ready: false, imgs: [] } : null;
        if (capeAnim) {
          // klatki wczytane i zdekodowane z wyprzedzeniem i TRZYMANE w pamięci - przełączanie bez mrugania;
          // animacja rusza dopiero, gdy wszystkie są gotowe (klatki z serwera JVRAS też)
          const ca = capeAnim;
          ca.imgs = ca.urls.map(u => { const im = new Image(); im.decoding = 'async'; im.src = u; return im; });
          Promise.all(ca.imgs.map(im => (im.decode ? im.decode() : Promise.resolve()).catch(() => {}))).then(() => { ca.ready = true; });
        }
      } else capeAnim = null;
      if (cos.wings) {
        const w = cos.wings, shapes = {
          feather: 'polygon(0% 12%, 28% 0%, 66% 2%, 100% 14%, 90% 30%, 97% 44%, 84% 56%, 90% 70%, 70% 80%, 68% 95%, 44% 86%, 28% 100%, 14% 74%, 0% 46%)',
          bat: 'polygon(0% 10%, 100% 0%, 90% 38%, 76% 28%, 68% 66%, 52% 50%, 40% 90%, 26% 60%, 0% 56%)',
          energy: 'polygon(0% 14%, 30% 0%, 70% 4%, 100% 18%, 88% 40%, 96% 56%, 74% 66%, 70% 88%, 40% 76%, 22% 96%, 10% 66%, 0% 44%)'
        };
        const bg = w.shape === 'feather'
          ? `repeating-linear-gradient(160deg, rgba(0,0,0,0.08) 0 3px, transparent 3px 9px), linear-gradient(120deg, ${w.c1}, ${w.c2})`
          : w.shape === 'bat'
            ? `linear-gradient(200deg, transparent 47%, rgba(0,0,0,0.45) 48% 50%, transparent 51%), linear-gradient(150deg, transparent 47%, rgba(0,0,0,0.45) 48% 50%, transparent 51%), linear-gradient(120deg, ${w.c1}, ${w.c2})`
            : `repeating-linear-gradient(135deg, rgba(255,255,255,0.35) 0 2px, transparent 2px 7px), linear-gradient(120deg, ${w.c1}, ${w.c2})`;
        const mk = (side) => {
          const wing = el('sk-part sk-wing', parts.upper);
          const ww = 13 * S, wh = 14 * S;
          wing.style.width = ww + 'px'; wing.style.height = wh + 'px';
          wing.style.top = 7.5 * S + 'px';
          wing.style.left = (side > 0 ? 8 * S : 8 * S - ww) + 'px';
          wing.style.transformOrigin = (side > 0 ? '0%' : '100%') + ' 15%';
          const skin = el('sk-wing-skin', wing);
          if (w.tex) {
            skin.style.background = `url("${w.tex}") 0 0 / 100% 100% no-repeat`;
            skin.classList.add('sk-px');
          } else {
            skin.style.clipPath = shapes[w.shape] || shapes.feather;
            skin.style.background = bg;
          }
          if (side < 0) skin.style.transform = 'scaleX(-1)';
          if (w.shape === 'energy') skin.style.opacity = '0.92';
          return wing;
        };
        parts.wingA = mk(1); parts.wingB = mk(-1);
      }
      if (cos.head && cos.head.kind === 'halo') {
        const h = el('sk-halo', parts.head);
        h.style.width = h.style.height = 7 * S + 'px';
        h.style.left = h.style.top = 0.5 * S + 'px';
        h.style.borderWidth = Math.max(2, 0.7 * S) + 'px';
        h.style.setProperty('--c', cos.head.color || '#FFE600');
        if (cos.head.tex) { h.classList.add('sk-px', 'sk-halo-tex'); h.style.backgroundImage = `url("${cos.head.tex}")`; }
        parts.halo = h;
      }
      if (cos.head && cos.head.kind === 'crown') {
        const c = el('sk-crown', parts.head);
        const cw = 8.6 * S, ch = 3 * S;
        c.style.width = cw + 'px'; c.style.height = ch + 'px';
        c.style.left = -0.3 * S + 'px'; c.style.top = -2.4 * S + 'px';
        [['translateZ(', cw / 2, 'px)'], ['rotateY(180deg) translateZ(', cw / 2, 'px)'], ['rotateY(90deg) translateZ(', cw / 2, 'px)'], ['rotateY(-90deg) translateZ(', cw / 2, 'px)']]
          .forEach(([a, d, b]) => { const f = el('sk-crown-face', c); f.style.transform = a + d + b; f.style.setProperty('--c', cos.head.color || '#FBBF24'); if (cos.head.tex) { f.classList.add('sk-px', 'sk-crown-tex'); f.style.backgroundImage = `url("${cos.head.tex}")`; } });
        parts.crown = c;
      }
      if (cos.head && cos.head.kind === 'horns') {
        const c = el('sk-crown', parts.head);
        c.style.width = 8 * S + 'px'; c.style.height = 3.5 * S + 'px'; c.style.left = '0px'; c.style.top = -3.2 * S + 'px';
        [-1, 1].forEach(side => {
          const hn = el('sk-horn sk-px', c);
          hn.style.backgroundImage = `url("${cos.head.tex}")`;
          hn.style.width = hn.style.height = 3.5 * S + 'px';
          hn.style.left = (side < 0 ? 0 : 4.5 * S) + 'px';
          hn.style.transform = (side < 0 ? 'scaleX(-1) ' : '') + 'translateZ(' + (S * 0.5) + 'px)';
        });
        parts.crown = c;
      }
      if (cos.head && cos.head.kind === 'tophat') {
        const c = el('sk-crown', parts.head);
        const hw = 6 * S, hh = 4 * S;
        c.style.width = hw + 'px'; c.style.height = hh + 'px'; c.style.left = S + 'px'; c.style.top = -hh + 'px';
        [['translateZ(', hw / 2, 'px)'], ['rotateY(180deg) translateZ(', hw / 2, 'px)'], ['rotateY(90deg) translateZ(', hw / 2, 'px)'], ['rotateY(-90deg) translateZ(', hw / 2, 'px)']]
          .forEach(([a, d, b]) => { const f = el('sk-hat-side sk-px', c); f.style.backgroundImage = `url("${cos.head.tex}")`; f.style.transform = a + d + b; });
        const top = el('sk-hat-top', c); top.style.width = top.style.height = hw + 'px'; top.style.transform = 'translateY(' + (-hw / 2) + 'px) rotateX(90deg)';
        const brim = el('sk-hat-brim', c); brim.style.width = brim.style.height = 9 * S + 'px'; brim.style.left = brim.style.top = (-1.5 * S) + 'px'; brim.style.transform = 'translateY(' + (hh - 3 * S) + 'px) rotateX(90deg)';
        parts.crown = c;
      }
    }

    // --- cząsteczki: lekkie elementy 2D nad postacią (bez 3D, żeby było wydajnie) ---
    const fxLayer = el('sk-fx', host);
    let fxAcc = 0;
    // Cząsteczki z kreatora (fx.motion): ruch i wygląd jak w modzie (1 blok = 16 S, postać = 2 bloki)
    let fxClock = 0;
    function emitCustom(dt, fx) {
      const P = FX_PARTICLES[fx.particle] || FX_PARTICLES.dust;
      const rate = clamp(+fx.rate || 10, 1, 40), R = clamp(+fx.radius || 0.6, 0.1, 1.5), Hh = clamp(+fx.height || 1.8, 0.1, 2.5), sp = clamp(fx.speed == null ? 1 : +fx.speed, 0, 3);
      const size = clamp(+fx.size || 1, 0.3, 3), B = 16 * S, cx = hostW / 2, feet = 6 + 32 * S;
      const motion = fx.motion || 'rise';
      fxClock += dt;
      // burst: cała porcja naraz co ~1,2 s; reszta ruchów: równy strumień
      let n = 0;
      if (motion === 'burst') { fxAcc += dt; if (fxAcc >= 1.2 / Math.max(0.4, sp || 0.4)) { fxAcc = 0; n = Math.max(4, Math.round(rate * 0.8)); } }
      else { fxAcc += dt * rate; n = Math.floor(fxAcc); fxAcc -= n; }
      // rzut 3D -> 2D: x = cos, głębia spłaszczona (lekki widok z góry)
      const pt = (a, r, h) => [cx + Math.cos(a) * r * B, feet - h * B + Math.sin(a) * r * B * 0.28, Math.sin(a)];
      for (let k = 0; k < n; k++) {
        if (fxLayer.childElementCount > 90) return;
        const d = document.createElement('i'), c1 = fx.color || P.c, c2 = fx.color2 || c1;
        const col = P.tint ? c1 : P.c; // pył przechodzi z koloru 1 w kolor 2 (jak w grze)
        d.className = 'sk-p sk-q sk-q-' + P.s;
        if (P.s === 'txt') d.textContent = P.t[Math.floor(Math.random() * P.t.length)];
        const px = Math.max(3, Math.round(P.px * (P.tint ? size : 1) * S / 2.2));
        d.style.cssText = `--c:${col};--z:${px}px`;
        const life = P.life * (0.8 + Math.random() * 0.4) * 1000, a0 = Math.random() * Math.PI * 2;
        let pts;
        if (motion === 'orbit' || motion === 'ring') {
          const h = motion === 'ring' ? Hh : Math.random() * Hh, w = (sp || 0.2) * 2.2, a = fxClock * w + (motion === 'ring' ? a0 : 0);
          pts = Array.from({ length: 7 }, (_, i) => pt(a + i / 6 * w * life / 1000, R, h + (motion === 'orbit' ? i * 0.02 * sp : 0)));
        } else if (motion === 'spiral') {
          const a = fxClock * 3 * (sp || 0.3) + (k % 2) * Math.PI, h = (fxClock * 0.6 * (sp || 0.3)) % Hh;
          pts = Array.from({ length: 5 }, (_, i) => pt(a, R, h + i * 0.05));
        } else if (motion === 'rain') {
          const r = Math.sqrt(Math.random()) * R, h = Hh + 0.35;
          pts = Array.from({ length: 3 }, (_, i) => pt(a0, r, h - i / 2 * (0.4 + sp * 0.9)));
        } else if (motion === 'burst') {
          const el2 = (Math.random() - 0.5) * Math.PI, dist = R * (0.6 + sp * 0.5);
          const o = [cx, feet - 1.1 * B], tx = Math.cos(a0) * Math.cos(el2) * dist * B, ty = -Math.sin(el2) * dist * B;
          pts = [[o[0], o[1], 0], [o[0] + tx * 0.75, o[1] + ty * 0.75, 0], [o[0] + tx, o[1] + ty + 0.15 * B, 0]];
        } else if (motion === 'trail') {
          const r = Math.random() * R * 0.6, p0 = pt(a0, r, 0.05);
          pts = [p0, [p0[0], p0[1] - 0.15 * sp * B, p0[2]]];
        } else { // rise
          const r = Math.sqrt(Math.random()) * R, h = Math.random() * Hh;
          pts = Array.from({ length: 3 }, (_, i) => pt(a0, r, h + i / 2 * sp * 0.9 * life / 1000));
        }
        d.style.left = pts[0][0].toFixed(1) + 'px'; d.style.top = pts[0][1].toFixed(1) + 'px';
        d.style.zIndex = pts[0][2] > 0 ? 2 : 0;
        fxLayer.appendChild(d);
        const last = pts.length - 1;
        const kf = pts.map((p, i) => ({ transform: `translate(${(p[0] - pts[0][0]).toFixed(1)}px,${(p[1] - pts[0][1]).toFixed(1)}px) scale(${i === 0 ? 0.4 : i === last ? (P.shrink ? 0.2 : 0.8) : 1}) rotate(${P.spin ? i * 60 : 0}deg)`, opacity: i === 0 ? 0 : i === last ? 0 : 1, offset: i / last }));
        if (kf.length > 2) kf[1].opacity = 1;
        if (P.tint && c2 !== c1) { kf[0].backgroundColor = c1; kf[last].backgroundColor = c2; }
        d.animate(kf, { duration: life, easing: 'linear' }).onfinish = () => d.remove();
      }
    }

    function emitParticles(dt) {
      const fx = cos.particles;
      if (!fx) return;
      if (fx.motion) return emitCustom(dt, fx);
      const rate = fx.kind === 'sparks' ? 14 : fx.kind === 'aura' ? 7 : 5;
      fxAcc += dt * rate;
      while (fxAcc >= 1) {
        fxAcc -= 1;
        if (fxLayer.childElementCount > 60) return;
        const w = hostW, cx = w / 2, top = 6, H = 32 * S;
        const d = document.createElement('i');
        d.className = 'sk-p sk-p-' + fx.kind;
        d.style.setProperty('--c', fx.color || '#FFE600');
        let x, y, kf, dur;
        if (fx.kind === 'sparks') {
          x = cx + (Math.random() - 0.5) * 18 * S; y = top + (6 + Math.random() * 24) * S;
          const dx = (Math.random() - 0.5) * 3 * S, dy = -(2 + Math.random() * 4) * S;
          kf = [{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(0.3)`, opacity: 0 }];
          dur = 600 + Math.random() * 500;
        } else if (fx.kind === 'aura') {
          x = cx + (Math.random() - 0.5) * 14 * S; y = top + H - Math.random() * 3 * S;
          kf = [{ transform: 'translate(0,0) scale(0.6)', opacity: 0 }, { opacity: 0.55, offset: 0.3 }, { transform: `translate(${(Math.random() - 0.5) * 2 * S}px, ${-(14 + Math.random() * 10) * S}px) scale(1.2)`, opacity: 0 }];
          dur = 2200 + Math.random() * 1200;
        } else {
          const a = Math.random() * Math.PI * 2, r = (6 + Math.random() * 4) * S;
          x = cx + Math.cos(a) * r; y = top + (8 + Math.random() * 18) * S + Math.sin(a) * S;
          kf = [{ transform: 'translate(0,0) scale(0) rotate(0deg)', opacity: 0 }, { transform: 'translate(0,-6px) scale(1) rotate(90deg)', opacity: 1, offset: 0.4 }, { transform: `translate(${(Math.random() - 0.5) * 2 * S}px, ${-3 * S}px) scale(0) rotate(180deg)`, opacity: 0 }];
          dur = 1400 + Math.random() * 800;
        }
        d.style.left = x.toFixed(1) + 'px'; d.style.top = y.toFixed(1) + 'px';
        fxLayer.appendChild(d);
        d.animate(kf, { duration: dur, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' }).onfinish = () => d.remove();
      }
    }

    function step(dt) {
      clock += dt;
      if (clock >= act.until) startAction(pickNext());
      const p = currentPose();

      // obrót całej postaci: przeciąganie użytkownika > kierunek z animacji > spokojne kołysanie
      const sway = Math.sin(clock * 0.3) * 14;
      let targetYaw = baseYaw + sway + p.yaw;
      if (userYaw != null) {
        if (clock < userUntil || dragging) targetYaw = userYaw;
        else { baseYaw = -24; userYaw = null; }
      }
      const k = dragging ? 18 : 2.6;
      yaw += (targetYaw - yaw) * (1 - Math.exp(-dt * k));

      if (mouse && hostRect) {
        const r = hostRect;
        const cx = r.left + r.width / 2, cy = r.top + r.height * 0.18;
        const tyw = clamp((mouse.x - cx) / 5, -60, 60) - (yaw + 24) * 0.5;
        const tp = clamp((mouse.y - cy) / 7, -30, 30);
        const kk = 1 - Math.exp(-dt * 7);
        headYawM += (tyw - headYawM) * kk;
        headPitchM += (tp - headPitchM) * kk;
      }
      apply(p);
      emitParticles(dt);
      if (capeAnim && capeAnim.ready) {
        const k = Math.floor(clock * capeAnim.fps) % capeAnim.urls.length;
        if (k !== capeAnim.cur) { capeAnim.cur = k; const u = 'url("' + capeAnim.urls[k] + '")'; capeAnim.faces.forEach(f => { f.style.backgroundImage = u; }); }
      }
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      if (hostVisible) step(dt); // inna zakładka launchera - nie licz animacji
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    const api = {
      setSkin(data) {
        const key = data ? (data.skin || '').length + ':' + (data.cape || '').length + ':' + !!data.slim : 'none';
        if (key === current) return Promise.resolve();
        current = key;
        return build(data);
      },
      setMode(m) {
        const next = m === 'walk' ? 'idle' : m;
        if (next === mode) return;
        mode = next;
        if (mode === 'run') startAction('run');
        else if (act.name === 'run') { const q = queued; queued = null; startAction(q || 'idle'); }
      },
      play(name) {
        if (mode === 'run') { queued = name; return; }
        play(name);
      },
      // { cape: {tex}, wings: {shape, c1, c2}, head: {kind, color}, particles: {kind, color} } - brak klucza = nic
      setCosmetics(c, opts) {
        const next = c || {};
        const key = JSON.stringify(next);
        if (key === cosKey) return;
        cosKey = key;
        cos = next;
        if (!next.particles) fxLayer.innerHTML = '';
        buildExtras();
        apply(currentPose());
        // krótki "błysk" przy zmianie wyglądu
        if (!(opts && opts.quiet) && host.offsetParent !== null && stage.animate) stage.animate([{ transform: 'scale(0.96)', filter: 'brightness(1.6) drop-shadow(0 0 18px rgba(250,204,21,0.8))' }, { transform: 'none', filter: 'none' }], { duration: 520, easing: 'cubic-bezier(0.22, 1.25, 0.36, 1)' });
      },
      _step: step // do testów
    };
    build(null);
    return api;
  }

  window.JvrasSkin = { mount, FX_PARTICLES, FX_MOTIONS };
})();
