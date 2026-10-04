// JVRAS - strona www: intro, pikselowy świat, bloki 3D, postać ze skinem, przewijana opowieść, przymierzalnia.
(function () {
  'use strict';
  const REPO = 'jvrasek/jvras-launcher';
  const DOWNLOAD = `https://github.com/${REPO}/releases/latest/download/JVRAS-Launcher.exe`;
  const API = 'https://jvras-api.jurasoff1.workers.dev';
  // licznik pokazujemy dopiero od tylu graczy (małe liczby na stronie wyglądają słabo)
  const MIN_TOTAL = 25, MIN_ONLINE = 3;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const desktop = () => innerWidth > 960;
  const finePointer = matchMedia('(pointer: fine)').matches;

  // ---------------------------------------------------------------- pobieranie, wersja, licznik
  $$('[data-download]').forEach((a) => { a.href = DOWNLOAD; });
  fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((rel) => {
      if (!rel) return;
      const exe = (rel.assets || []).find((a) => /\.exe$/i.test(a.name));
      const v = String(rel.tag_name || '').replace(/^v/i, '');
      const mb = exe ? ' · ' + Math.round(exe.size / 1048576) + ' MB' : '';
      $$('[data-version]').forEach((el) => { el.textContent = 'Windows · v' + v + mb; });
    }).catch(() => {});

  const fmt = (n) => n.toLocaleString('pl-PL');
  function countUp(el, to, dur = 1300) {
    const t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / dur); el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  fetch(API + '/v1/presence').then((r) => (r.ok ? r.json() : null)).then((p) => {
    if (!p || !p.ok || !(p.total >= MIN_TOTAL)) return;
    const box = $('#stats');
    box.hidden = false;
    if ((p.online | 0) >= MIN_ONLINE) countUp(box.querySelector('[data-online]'), p.online | 0);
    else $$('.live, .sep', box).forEach((el) => el.remove());
    countUp(box.querySelector('[data-total]'), p.total | 0);
    box.querySelector('[data-total-word]').textContent = p.total === 1 ? 'gracz' : 'graczy';
  }).catch(() => {});

  // ---------------------------------------------------------------- napisy wjeżdżające spod maski
  $$('.split .ln').forEach((ln) => { ln.innerHTML = '<span>' + ln.innerHTML + '</span>'; });
  function revealSplit(el) {
    $$('.ln > span', el).forEach((s, i) => { s.style.transitionDelay = i * 110 + 'ms'; });
    el.classList.add('in');
  }

  // ---------------------------------------------------------------- intro (raz na sesję)
  const intro = $('#intro');
  let started = false;
  function startPage() {
    if (started) return;
    started = true;
    document.body.classList.remove('intro');
    document.body.classList.add('ready');
    revealSplit($('h1.split'));
    setTimeout(() => heroSkin && heroSkin.play('wave'), 900);
  }
  function runIntro() {
    let seen = false;
    try { seen = sessionStorage.getItem('jvras-intro') === '1'; sessionStorage.setItem('jvras-intro', '1'); } catch (e) {}
    if (seen) { intro.classList.add('gone'); startPage(); return; }
    intro.classList.add('go');
    // litery JVRAS "rozszyfrowują się"
    const CH = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789#$%&';
    $$('.intro-word span', intro).forEach((sp, i) => {
      const fin = sp.textContent;
      sp.style.animationDelay = 0.95 + i * 0.06 + 's';
      setTimeout(() => {
        sp.classList.add('lock');
        const iv = setInterval(() => { sp.textContent = CH[(Math.random() * CH.length) | 0]; }, 45);
        setTimeout(() => { clearInterval(iv); sp.textContent = fin; sp.classList.remove('lock'); }, 380 + i * 70);
      }, 950 + i * 60);
    });
    // ekran rozsypuje się na piksele jak niszczony blok
    setTimeout(() => pixelOut(), 2050);
  }
  function pixelOut() {
    const cv = $('#intro-px'), g = cv.getContext('2d');
    const W = cv.width = innerWidth, H = cv.height = innerHeight;
    const S = Math.max(28, Math.round(Math.min(W, H) / 18));
    const cells = [];
    for (let y = 0; y < H; y += S) for (let x = 0; x < W; x += S) cells.push([x, y, Math.hypot(x - W / 2, y - H / 2) + rnd(0, S * 6)]);
    cells.sort((a, b) => a[2] - b[2]); // od środka na zewnątrz, z losowym poszarpaniem
    g.fillStyle = '#070708'; g.fillRect(0, 0, W, H);
    intro.classList.add('out');
    startPage();
    const t0 = performance.now(), dur = 750;
    let done = 0, flash = [];
    (function tick(t) {
      const k = Math.min(1, (t - t0) / dur), target = Math.floor(cells.length * (k * k * (3 - 2 * k)));
      flash.forEach(([x, y]) => g.clearRect(x, y, S, S));
      flash = [];
      for (; done < target; done++) {
        const [x, y] = cells[done];
        g.clearRect(x, y, S, S);
        if (Math.random() < 0.35) { g.fillStyle = Math.random() < 0.5 ? 'rgba(250,204,21,.85)' : 'rgba(255,225,77,.5)'; g.fillRect(x + S * .2, y + S * .2, S * .6, S * .6); flash.push([x, y]); }
      }
      if (k < 1 || flash.length) requestAnimationFrame(tick);
      else intro.classList.add('gone');
    })(t0);
  }

  // ---------------------------------------------------------------- pikselowy świat w tle hero
  const world = $('#world');
  const PX = 6; // rozmiar "piksela" świata na ekranie
  let wg, ww, wh, stars = [], clouds = [], cols = [];
  function buildWorld() {
    ww = world.width = Math.ceil(world.clientWidth / PX);
    wh = world.height = Math.ceil(world.clientHeight / PX);
    wg = world.getContext('2d');
    stars = Array.from({ length: Math.round(ww * wh / 260) }, () => ({ x: (Math.random() * ww) | 0, y: (Math.random() * wh * 0.6) | 0, p: rnd(0, 6.28), s: rnd(0.6, 1.6) }));
    clouds = Array.from({ length: 6 }, (_, i) => makeCloud(rnd(-20, ww), rnd(4, wh * 0.35)));
    // teren z bloków: wzgórza z kilku fal + losowe stopnie, co kilka kolumn "ruda" mrugająca na żółto
    cols = [];
    let h = wh * 0.12;
    for (let x = 0; x < ww; x += 3) {
      const base = wh * (0.1 + 0.06 * Math.sin(x / 37) + 0.04 * Math.sin(x / 13 + 2) + 0.03 * Math.sin(x / 7));
      h += (base - h) * 0.5 + (Math.random() < 0.3 ? (Math.random() < 0.5 ? -3 : 3) : 0);
      cols.push({ x, h: Math.max(6, Math.round(h / 3) * 3), ore: Math.random() < 0.12 ? (Math.random() * 6) | 0 : -1, p: rnd(0, 6.28) });
    }
  }
  function makeCloud(x, y) {
    const w = (rnd(14, 34) / 3 | 0) * 3, parts = [];
    for (let i = 0; i < w; i += 3) parts.push([i, -((Math.random() * 2) | 0) * 3, 3 + (((Math.random() * 2) | 0) * 3)]);
    return { x, y: Math.round(y / 3) * 3, w, parts, v: rnd(0.6, 1.6) };
  }
  function drawWorld(t, scrollY) {
    if (!wg) return;
    wg.clearRect(0, 0, ww, wh);
    // gwiazdy
    for (const s of stars) {
      const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * s.s + s.p));
      wg.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
      wg.fillRect(s.x, s.y - ((scrollY * 0.02) | 0), 1, 1);
    }
    // chmury z bloków (wolno płyną w prawo)
    for (const c of clouds) {
      c.x += c.v * 0.03;
      if (c.x > ww + 4) Object.assign(c, makeCloud(-c.w - rnd(4, 40), rnd(4, wh * 0.35)));
      const cy = c.y - ((scrollY * 0.04) | 0);
      wg.fillStyle = 'rgba(255,255,255,.035)';
      for (const [px, py, ph] of c.parts) wg.fillRect((c.x + px) | 0, cy + py, 3, ph);
      wg.fillStyle = 'rgba(255,255,255,.025)';
      wg.fillRect(c.x | 0, cy + 3, c.w, 3);
    }
    // teren (lekki paralaksa przy przewijaniu)
    const lift = (scrollY * 0.08) | 0;
    for (const col of cols) {
      const top = wh - col.h + lift;
      wg.fillStyle = '#0e0e10'; wg.fillRect(col.x, top, 3, col.h);
      wg.fillStyle = '#1c1c20'; wg.fillRect(col.x, top, 3, 1);
      wg.fillStyle = 'rgba(250,204,21,.07)'; wg.fillRect(col.x, top, 3, 1);
      if (col.ore >= 0) {
        const a = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.4 + col.p));
        wg.fillStyle = `rgba(250,204,21,${a.toFixed(2)})`;
        wg.fillRect(col.x + 1, top + 4 + col.ore * 2, 1, 1);
      }
    }
  }

  // ---------------------------------------------------------------- bloki 3D z własnymi pikselowymi teksturami
  function tex(draw) {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const g = c.getContext('2d');
    draw(g, (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); });
    return c.toDataURL();
  }
  const noise = (p, pal) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p(x, y, pal[(Math.random() * pal.length) | 0]); };
  const BOLT = ['......XX', '.....XX.', '....XX..', '...XXXXX', '.....XX.', '....XX..', '...XX...', '..X.....'];
  const T = {};
  function textures() {
    T.jvrasSide = tex((g, p) => {
      noise(p, ['#141417', '#17171b', '#1b1b20', '#121215']);
      for (let i = 0; i < 16; i++) { p(i, 0, '#26262c'); p(0, i, '#26262c'); p(i, 15, '#0b0b0d'); p(15, i, '#0b0b0d'); }
      BOLT.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'X') p(x + 4, y + 4, y < 3 ? '#ffe14d' : '#facc15'); }));
    });
    T.ore = tex((g, p) => {
      noise(p, ['#3a3a40', '#42424a', '#4b4b53', '#35353b', '#505058']);
      for (let k = 0; k < 4; k++) { const cx = rnd(2, 13) | 0, cy = rnd(2, 13) | 0; [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0]].forEach(([dx, dy]) => { if (Math.random() < 0.85) p(cx + dx, cy + dy, Math.random() < 0.4 ? '#ffe14d' : '#eab308'); }); }
    });
    T.grassTop = tex((g, p) => noise(p, ['#3d6b2b', '#45772f', '#4f8636', '#38612a', '#56913b']));
    T.dirt = tex((g, p) => noise(p, ['#5b3d27', '#664530', '#704c33', '#523722', '#7a5538']));
    T.grassSide = tex((g, p) => {
      noise(p, ['#5b3d27', '#664530', '#704c33', '#523722']);
      for (let x = 0; x < 16; x++) { const d = 2 + ((Math.random() * 3) | 0); for (let y = 0; y < d; y++) p(x, y, ['#3d6b2b', '#45772f', '#4f8636'][(Math.random() * 3) | 0]); }
    });
    T.lamp = tex((g, p) => {
      noise(p, ['#facc15', '#fde047', '#eab308', '#ffe14d']);
      for (let i = 0; i < 16; i++) { p(i, 0, '#a16207'); p(0, i, '#a16207'); p(i, 15, '#854d0e'); p(15, i, '#854d0e'); }
      for (let i = 3; i < 13; i++) { p(i, 3, '#fff3b0'); p(3, i, '#fff3b0'); }
    });
    T.amethyst = tex((g, p) => {
      noise(p, ['#5b3f8f', '#6b4aa6', '#7c5cc0', '#4e3480', '#8b6fd1']);
      for (let k = 0; k < 6; k++) p(rnd(1, 15) | 0, rnd(1, 15) | 0, '#d8c8ff');
    });
    T.gold = tex((g, p) => {
      noise(p, ['#facc15', '#eab308', '#fde047', '#f5c518']);
      for (let i = 0; i < 16; i++) { p(i, 15, '#a16207'); p(15, i, '#a16207'); p(i, 0, '#fff3b0'); p(0, i, '#fff3b0'); }
      for (let k = 0; k < 5; k++) { const x = rnd(2, 12) | 0, y = rnd(2, 12) | 0; p(x, y, '#fff3b0'); p(x + 1, y + 1, '#ca8a04'); }
    });
    T.stone = tex((g, p) => noise(p, ['#3a3a40', '#42424a', '#4b4b53', '#35353b']));
    T.deepslate = tex((g, p) => {
      noise(p, ['#25262d', '#2b2c34', '#30313a', '#202127']);
      for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) if (Math.random() < 0.5) p(x, y, '#1a1b20');
    });
    T.magma = tex((g, p) => {
      noise(p, ['#3a1a10', '#4a2212', '#2e140c']);
      for (let k = 0; k < 7; k++) { const x = rnd(0, 15) | 0, y = rnd(0, 15) | 0; p(x, y, '#f97316'); p(x + 1, y, '#fbbf24'); p(x, y + 1, '#ea580c'); }
    });
    // pęknięcia przy kopaniu (5 etapów, jak w grze rosną od środka)
    let s = 7;
    const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const pts = [];
    for (let w = 0; w < 7; w++) {
      let x = 7.5, y = 7.5, a = rng() * 6.28;
      for (let i = 0; i < 9; i++) { a += (rng() - 0.5) * 1.2; x += Math.cos(a); y += Math.sin(a); pts.push([x | 0, y | 0, i]); }
    }
    pts.sort((a, b) => a[2] - b[2]);
    T.cracks = [0, 1, 2, 3, 4].map((st) => tex((g, p) => {
      pts.slice(0, Math.ceil(pts.length * (st + 1) / 5)).forEach(([x, y]) => { if (x >= 0 && y >= 0 && x < 16 && y < 16) p(x, y, 'rgba(0,0,0,.62)'); });
    }));
    // kursor-kilof (własny rysunek)
    const PICK = ['................', '....oooooo......', '..ooyyyyyyoo....', '.oyy......oyyo..', '.o.......h.oyo..', '........h...oyo.', '.......h.....oo.',
      '......h.......o.', '.....h..........', '....h...........', '...h............', '..h.............', '.h..............'];
    const pc = document.createElement('canvas'); pc.width = pc.height = 32;
    const pg = pc.getContext('2d');
    PICK.forEach((row, y) => [...row].forEach((ch, x) => {
      const col = { o: '#7c4a03', y: '#facc15', h: '#8a5a3a' }[ch];
      if (col) { pg.fillStyle = col; pg.fillRect(x * 2, y * 2, 2, 2); }
    }));
    T.pickCursor = `url(${pc.toDataURL()}) 2 26, pointer`;
  }
  const KINDS = {
    jvras: { side: 'jvrasSide', top: 'jvrasSide', bottom: 'jvrasSide' },
    ore: { side: 'ore', top: 'ore', bottom: 'ore' },
    grass: { side: 'grassSide', top: 'grassTop', bottom: 'dirt' },
    lamp: { side: 'lamp', top: 'lamp', bottom: 'lamp', glow: true },
    amethyst: { side: 'amethyst', top: 'amethyst', bottom: 'amethyst' },
    gold: { side: 'gold', top: 'gold', bottom: 'gold' },
    stone: { side: 'stone', top: 'stone', bottom: 'stone' },
    deepslate: { side: 'deepslate', top: 'deepslate', bottom: 'deepslate' },
    magma: { side: 'magma', top: 'magma', bottom: 'magma', glow: true },
  };
  // sześć ścian bloku; warstwa --crack pokazuje pęknięcia przy kopaniu
  function buildFaces(el, kind, S) {
    const k = KINDS[kind];
    const faces = [
      [k.side, `translateZ(${S / 2}px)`, 0], [k.side, `rotateY(180deg) translateZ(${S / 2}px)`, .35],
      [k.side, `rotateY(90deg) translateZ(${S / 2}px)`, .22], [k.side, `rotateY(-90deg) translateZ(${S / 2}px)`, .22],
      [k.top, `rotateX(90deg) translateZ(${S / 2}px)`, 0], [k.bottom, `rotateX(-90deg) translateZ(${S / 2}px)`, .45],
    ];
    for (const [t, tr, shade] of faces) {
      const f = document.createElement('i');
      f.style.backgroundImage = `var(--crack, none), url(${T[t]})`;
      f.style.transform = tr;
      if (shade && !k.glow) f.style.boxShadow = `inset 0 0 0 ${S}px rgba(0,0,0,${shade})`;
      el.appendChild(f);
    }
  }
  const cubeSets = [];
  function makeCubes(host, list) {
    if (!host) return;
    const set = { host, cubes: [], visible: true, hero: host.id === 'hero-cubes' };
    for (const c of list) {
      const k = KINDS[c.kind], S = c.size;
      const el = document.createElement('div');
      el.className = 'cube' + (k.glow ? ' glow' : '');
      el.style.width = el.style.height = S + 'px';
      el.style.left = c.x + '%'; el.style.top = c.y + '%';
      el.style.cursor = T.pickCursor;
      el.title = 'Przytrzymaj, żeby wykopać';
      buildFaces(el, c.kind, S);
      host.appendChild(el);
      const cube = { el, kind: c.kind, z: c.z || 0, rx: rnd(-30, 30), ry: rnd(0, 360), vx: rnd(4, 10) * (Math.random() < 0.5 ? -1 : 1), vy: rnd(8, 18), ph: rnd(0, 6.28), depth: c.depth || 1, dmg: 0, stage: -1, mining: false, broken: false };
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!cube.broken) { cube.mining = true; mining = cube; } });
      set.cubes.push(cube);
    }
    new IntersectionObserver(([e]) => { set.visible = e.isIntersecting; }).observe(host);
    cubeSets.push(set);
  }
  // kopanie: przytrzymanie rozbija blok, po chwili odrasta
  let mining = null;
  const stopMining = () => { if (mining) mining.mining = false; mining = null; };
  addEventListener('pointerup', stopMining);
  addEventListener('pointercancel', stopMining);
  function breakCube(c) {
    c.broken = true; c.mining = false; mining = null;
    c.dmg = 0; c.stage = -1; c.el.style.removeProperty('--crack');
    const r = c.el.getBoundingClientRect();
    spawnBits(r.left + r.width / 2, r.top + r.height / 2, KINDS[c.kind].side, 18);
    c.el.classList.add('broken');
    setTimeout(() => { c.broken = false; c.el.classList.remove('broken'); }, 4500);
  }
  const bits = [];
  function spawnBits(x, y, texKey, n) {
    for (let i = 0; i < n && bits.length < 90; i++) {
      const el = document.createElement('div');
      const s = rnd(6, 11);
      el.className = 'bit';
      el.style.width = el.style.height = s + 'px';
      el.style.backgroundImage = `url(${T[texKey]})`;
      el.style.backgroundPosition = `${(rnd(0, 4) | 0) * 33.3}% ${(rnd(0, 4) | 0) * 33.3}%`;
      document.body.appendChild(el);
      bits.push({ el, x: x + rnd(-14, 14), y: y + rnd(-14, 14), vx: rnd(-170, 170), vy: rnd(-330, -80), life: 0, max: rnd(0.7, 1.2) });
    }
  }
  function drawBits(dt) {
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.life += dt; b.vy += 1100 * dt; b.vx *= Math.exp(-dt * 1.5); b.x += b.vx * dt; b.y += b.vy * dt;
      const k = b.life / b.max;
      if (k >= 1) { b.el.remove(); bits.splice(i, 1); continue; }
      b.el.style.transform = `translate(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px)`;
      b.el.style.opacity = k > 0.7 ? ((1 - k) / 0.3).toFixed(2) : '1';
    }
  }
  let mouseX = 0, mouseY = 0;
  function drawCubes(t, dt, scrollY) {
    for (const set of cubeSets) {
      if (!set.visible) continue;
      // bloki w sekcjach przesuwają się wolniej niż treść (głębia)
      let rel = 0;
      if (!set.hero) { const r = set.host.getBoundingClientRect(); rel = r.top + r.height / 2 - innerHeight / 2; }
      for (const c of set.cubes) {
        if (c.mining) {
          c.dmg += dt * 6;
          const st = Math.min(4, Math.floor(c.dmg));
          if (st !== c.stage) { c.stage = st; c.el.style.setProperty('--crack', `url(${T.cracks[st]})`); }
          if (c.dmg >= 5) breakCube(c);
        } else if (c.dmg > 0) {
          c.dmg = 0; c.stage = -1; c.el.style.removeProperty('--crack');
        }
        c.rx += c.vx * dt * (c.mining ? 0.2 : 1); c.ry += c.vy * dt * (c.mining ? 0.2 : 1);
        const bob = Math.sin(t * 0.9 + c.ph) * 10;
        const shake = c.mining ? rnd(-1.5, 1.5) : 0;
        const px = mouseX * 26 * c.depth + shake;
        const py = mouseY * 18 * c.depth + (set.hero ? -scrollY * 0.12 * c.depth : -rel * 0.18 * c.depth) + shake;
        c.el.style.transform = `translate3d(${px.toFixed(1)}px, ${(bob + py).toFixed(1)}px, ${c.z}px) rotateX(${c.rx.toFixed(1)}deg) rotateY(${c.ry.toFixed(1)}deg)`;
      }
    }
  }

  // ---------------------------------------------------------------- jaskinia: schodzimy pod ziemię razem z przewijaniem
  const cave = $('#cave'), CP = 4, B = 4; // 1 piksel płótna = 4 px ekranu, blok = 4 piksele płótna (16 px)
  let cg = null, cw = 0, ch = 0, heroH = 0, docH = 0, wallL = null, wallR = null, backL = null, backR = null, bedrock = null, ores = [], dust = [], bats = [], nextBat = 6, narrow = false;
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const PAL = {
    dirt: ['#3b2a1d', '#45311f', '#4f3825', '#35261a'],
    stone: ['#2a2a2e', '#303035', '#36363b', '#26262a'],
    deep: ['#1d1e24', '#22232a', '#272830', '#1a1b20'],
    bedrock: ['#0d0d0e', '#2a2a2c', '#1b1b1d', '#3a3a3d', '#070708'],
  };
  const ORE = { gold: ['#facc15', '#eab308'], amethyst: ['#b69cff', '#8b6fd1'], magma: ['#fb923c', '#fbbf24'] };
  function wallWidth(r, seed, maxC) {
    const n = 0.5 + 0.25 * Math.sin(r / 9 + seed) + 0.15 * Math.sin(r / 3.7 + seed * 2) + 0.1 * Math.sin(r / 1.9 + seed * 3);
    return clamp(Math.round(1 + n * (maxC - 1) + (hash(r, seed * 31) < 0.15 ? 1 : 0)), 1, maxC);
  }
  function paintWall(rows, seed, maxC, side, withOres, depthRows) {
    const c = document.createElement('canvas');
    c.width = maxC * B; c.height = rows * B;
    const g = c.getContext('2d');
    for (let r = 0; r < rows; r++) {
      const w = wallWidth(r, seed, maxC), d = r / depthRows;
      const pal = r < 3 ? PAL.dirt : d > 0.58 ? PAL.deep : PAL.stone;
      for (let i = 0; i < w; i++) {
        const col = side < 0 ? i : maxC - 1 - i; // kolumna od krawędzi ekranu
        let ore = null;
        if (withOres && r > 3) {
          const h = hash(col * 7 + seed, r);
          if (d < 0.75 && h < 0.06) ore = 'gold';
          else if (d > 0.35 && d < 0.82 && h > 0.94) ore = 'amethyst';
          else if (d > 0.78 && h > 0.88 && h < 0.94) ore = 'magma';
        }
        for (let py = 0; py < B; py++) for (let px = 0; px < B; px++) {
          const hv = hash(col * B + px + seed * 97, r * B + py);
          g.fillStyle = pal[(hv * pal.length) | 0];
          g.fillRect(col * B + px, r * B + py, 1, 1);
        }
        // krawędź od strony treści jest ciemniejsza - daje głębię
        if (i === w - 1) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(side < 0 ? col * B + B - 1 : col * B, r * B, 1, B); }
        if (ore) {
          const n = 2 + ((hash(r, col) * 2) | 0);
          for (let k = 0; k < n; k++) {
            const ox = col * B + ((hash(k, r * 3 + col) * B) | 0), oy = r * B + ((hash(k + 5, r + col * 3) * B) | 0);
            ores.push({ side, x: ox, y: oy, c: ORE[ore][k % 2], ph: hash(ox, oy) * 6.28, sp: ore === 'magma' ? 3 : 1.2, glow: ore === 'magma' ? 0.55 : 0.3 });
          }
        }
      }
    }
    return c;
  }
  function buildCave() {
    narrow = innerWidth <= 960;
    cw = cave.width = Math.ceil(innerWidth / CP);
    ch = cave.height = Math.ceil(innerHeight / CP);
    cg = cave.getContext('2d');
    heroH = hero.offsetHeight;
    docH = document.documentElement.scrollHeight;
    const maxC = narrow ? 1 : clamp(Math.floor((innerWidth - 1180) / 2 / 16), 2, 10);
    const rows = Math.ceil((docH - heroH) / 16) + 2;
    ores = [];
    wallL = paintWall(rows, 1.3, maxC, -1, true, rows);
    wallR = paintWall(rows, 4.1, maxC, 1, true, rows);
    if (!narrow) {
      const maxS = docH - innerHeight, bRows = Math.ceil((innerHeight + 0.85 * maxS - heroH) / 16) + 2;
      backL = paintWall(bRows, 7.7, maxC + 3, -1, false, bRows);
      backR = paintWall(bRows, 9.2, maxC + 3, 1, false, bRows);
    } else backL = backR = null;
    bedrock = document.createElement('canvas');
    bedrock.width = cw; bedrock.height = 2 * B;
    const bg = bedrock.getContext('2d');
    for (let y = 0; y < 2 * B; y++) for (let x = 0; x < cw; x++) { bg.fillStyle = PAL.bedrock[(hash(x, y + 99) * 5) | 0]; bg.fillRect(x, y, 1, 1); }
    dust = Array.from({ length: narrow ? 18 : 40 }, () => ({ x: rnd(0, cw), y: rnd(0, ch), v: rnd(0.8, 2.2), ph: rnd(0, 6.28), a: rnd(0.15, 0.45) }));
  }
  const BAT = [['X.....X', 'XX.X.XX', '.XXXXX.', '...X...'], ['...X...', '.XXXXX.', 'XX.X.XX', 'X.....X']];
  function drawCave(t, dt, sy) {
    if (!cg) return;
    cg.clearRect(0, 0, cw, ch);
    const top = (heroH - sy) / CP; // gdzie zaczyna się jaskinia (pod trawą z hero)
    if (top >= ch) return;
    const maxS = Math.max(1, docH - innerHeight), p = clamp(sy / maxS, 0, 1);
    // dalsza ściana (wolniej, ciemniej)
    if (backL) {
      cg.globalAlpha = 0.38;
      const by = (heroH - sy * 0.85) / CP;
      cg.drawImage(backL, 0, Math.round(by));
      cg.drawImage(backR, cw - backR.width, Math.round(by));
      cg.globalAlpha = 1;
    }
    // bliższa ściana z rudami
    cg.globalAlpha = narrow ? 0.55 : 1;
    const ty = Math.round(top);
    cg.drawImage(wallL, 0, ty);
    cg.drawImage(wallR, cw - wallR.width, ty);
    for (const o of ores) {
      const y = ty + o.y;
      if (y < -2 || y > ch + 2) continue;
      const x = o.side < 0 ? o.x : cw - wallR.width + o.x;
      const a = 0.55 + 0.45 * Math.sin(t * o.sp + o.ph);
      cg.globalAlpha = (narrow ? 0.55 : 1) * o.glow * a;
      cg.fillStyle = o.c; cg.fillRect(x - 1, y - 1, 3, 3);
      cg.globalAlpha = narrow ? 0.55 : 1;
      cg.fillRect(x, y, 1, 1);
    }
    cg.globalAlpha = 1;
    // skała macierzysta na samym dole strony
    const bedY = Math.round((docH - 2 * 16 - sy) / CP);
    if (bedY < ch) cg.drawImage(bedrock, 0, bedY);
    // poświata magmy z dołu, gdy zbliżamy się do dna
    if (p > 0.7) {
      const gr = cg.createLinearGradient(0, ch, 0, ch * 0.55);
      gr.addColorStop(0, `rgba(249,115,22,${((p - 0.7) * 0.42).toFixed(3)})`);
      gr.addColorStop(1, 'rgba(249,115,22,0)');
      cg.fillStyle = gr; cg.fillRect(0, ch * 0.55, cw, ch * 0.45);
    }
    // unoszący się pył: biały u góry, fioletowy w geodzie, żar na dnie
    const dc = p < 0.45 ? '255,255,255' : p < 0.78 ? '182,156,255' : '251,146,60';
    for (const d of dust) {
      d.y -= d.v * dt * (p > 0.78 ? 2.4 : 1);
      d.x += Math.sin(t * 0.6 + d.ph) * dt * 0.8;
      if (d.y < 0) { d.y = ch; d.x = rnd(0, cw); }
      if (d.y < top) continue;
      cg.fillStyle = `rgba(${dc},${(d.a * (0.6 + 0.4 * Math.sin(t * 2 + d.ph))).toFixed(2)})`;
      cg.fillRect(d.x | 0, d.y | 0, 1, 1);
    }
    // nietoperze przelatujące przez jaskinię
    nextBat -= dt;
    if (nextBat <= 0 && sy > heroH * 0.7 && bats.length < 2) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      bats.push({ x: dir > 0 ? -10 : cw + 10, y: rnd(ch * 0.15, ch * 0.7), dir, v: rnd(26, 40), ph: rnd(0, 6.28), f: 0 });
      nextBat = rnd(7, 14);
    }
    for (let i = bats.length - 1; i >= 0; i--) {
      const b = bats[i];
      b.x += b.dir * b.v * dt; b.f += dt;
      const y = Math.round(b.y + Math.sin(b.x / 6 + b.ph) * 4);
      if (b.x < -14 || b.x > cw + 14) { bats.splice(i, 1); continue; }
      const fr = BAT[((b.f / 0.12) | 0) % 2];
      cg.fillStyle = '#4a3b30';
      fr.forEach((row, ry) => [...row].forEach((chr, rx) => { if (chr === 'X') cg.fillRect(Math.round(b.x) + rx, y + ry, 1, 1); }));
      cg.fillStyle = '#facc15'; cg.fillRect(Math.round(b.x) + 3, y + (fr === BAT[0] ? 2 : 1), 1, 1);
    }
  }
  // wskaźnik wysokości Y (jak w F3) - od powierzchni do skały macierzystej
  const ylvl = $('#ylvl'), ylB = ylvl && ylvl.querySelector('b'), ylS = ylvl && ylvl.querySelector('span');
  let lastY = null;
  function updateY(sy) {
    if (!ylvl) return;
    const p = clamp(sy / Math.max(1, docH - innerHeight), 0, 1);
    ylvl.classList.toggle('on', document.body.classList.contains('ready') && sy > 80);
    const y = Math.round(72 - 136 * p);
    if (y === lastY) return;
    lastY = y;
    ylB.textContent = 'Y ' + y;
    ylS.textContent = p < 0.1 ? 'Powierzchnia' : p < 0.4 ? 'Jaskinie' : p < 0.7 ? 'Geoda' : p < 0.95 ? 'Głębiny' : 'Skała macierzysta';
  }

  // ---------------------------------------------------------------- błyskawica JVRAS składana z bloków
  const voxWrap = $('#vox-wrap'), vox = $('#vox'), VS = 14;
  const voxels = [];
  function buildVox() {
    if (!vox) return;
    BOLT.forEach((row, r) => [...row].forEach((chr, c) => {
      if (chr !== 'X') return;
      const el = document.createElement('div');
      el.className = 'vx';
      el.style.left = c * VS + 'px'; el.style.top = r * VS + 'px';
      buildFaces(el, r < 3 ? 'lamp' : 'gold', VS);
      vox.appendChild(el);
      voxels.push(el);
    }));
    // spadają od dołu do góry, jak stawiane bloki
    voxels.forEach((el, i) => { el.style.transitionDelay = (voxels.length - i) * 55 + 'ms'; });
    new IntersectionObserver(([e], o) => { if (e.isIntersecting) { voxWrap.classList.add('built'); o.disconnect(); } }, { threshold: 0.5 }).observe(voxWrap);
    voxWrap.addEventListener('click', () => {
      const r = vox.getBoundingClientRect();
      spawnBits(r.left + r.width / 2, r.top + r.height / 2, 'gold', 22);
      voxels.forEach((el) => {
        el.style.transitionDelay = '0ms';
        el.style.transform = `translate3d(${rnd(-170, 170)}px, ${rnd(-170, 120)}px, ${rnd(-160, 160)}px) rotateX(${rnd(-180, 180)}deg) rotateY(${rnd(-180, 180)}deg)`;
      });
      setTimeout(() => voxels.forEach((el) => { el.style.transitionDelay = rnd(0, 260) + 'ms'; el.style.transform = ''; }), 520);
    });
  }
  let voxVisible = false;
  if (voxWrap) new IntersectionObserver(([e]) => { voxVisible = e.isIntersecting; }).observe(voxWrap);
  function drawVox(t) {
    if (!voxVisible) return;
    vox.style.transform = `rotateX(${(-10 + mouseY * 14).toFixed(1)}deg) rotateY(${(Math.sin(t * 0.8) * 26 + mouseX * 34).toFixed(1)}deg)`;
  }

  // ---------------------------------------------------------------- płynne przewijanie (kółko myszy i linki w menu)
  const smooth = finePointer;
  let sTarget = scrollY, sCur = scrollY, sActive = false;
  const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
  function scrollToY(y) {
    if (!smooth) { scrollTo({ top: y, behavior: 'smooth' }); return; }
    if (!sActive) sCur = scrollY;
    sTarget = clamp(y, 0, maxScroll());
    sActive = true;
  }
  if (smooth) {
    document.documentElement.classList.add('smooth');
    addEventListener('wheel', (e) => {
      if (e.ctrlKey || document.body.classList.contains('intro')) return;
      e.preventDefault();
      const d = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
      if (!sActive) { sCur = scrollY; sTarget = scrollY; }
      sTarget = clamp(sTarget + d, 0, maxScroll());
      sActive = true;
    }, { passive: false });
    // klawiatura i pasek przewijania działają normalnie - wtedy oddajemy sterowanie
    addEventListener('keydown', () => { sActive = false; });
    addEventListener('pointerdown', (e) => { if (e.clientX > document.documentElement.clientWidth) sActive = false; });
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const el = id === '#top' || id === '#' ? null : $(id);
    if (id !== '#top' && id !== '#' && !el) return;
    e.preventDefault();
    scrollToY(el ? el.getBoundingClientRect().top + scrollY : 0);
  });
  function stepScroll(dt) {
    if (!sActive) return;
    sCur += (sTarget - sCur) * (1 - Math.exp(-dt * 8.5));
    if (Math.abs(sTarget - sCur) < 0.5) { sCur = sTarget; sActive = false; }
    scrollTo(0, sCur);
  }

  // ---------------------------------------------------------------- iskry przy kursorze (w hero)
  const sparks = [];
  let lastSpark = 0;
  function spawnSparks(x, y) {
    for (let i = 0; i < 2 && sparks.length < 46; i++) {
      const el = document.createElement('div');
      el.className = 'spark';
      document.body.appendChild(el);
      sparks.push({ el, x, y, vx: rnd(-60, 60), vy: rnd(-120, -30), life: 0, max: rnd(0.5, 0.9), s: rnd(3, 6) });
    }
  }
  function drawSparks(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life += dt; s.vy += 420 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      const k = s.life / s.max;
      if (k >= 1) { s.el.remove(); sparks.splice(i, 1); continue; }
      s.el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
      s.el.style.opacity = (1 - k).toFixed(2);
      s.el.style.width = s.el.style.height = Math.max(2, s.s * (1 - k * 0.5)).toFixed(1) + 'px';
    }
  }

  // ---------------------------------------------------------------- pasek modułów (płynie, przyspiesza przy przewijaniu)
  const tracks = $$('.track').map((tr) => {
    tr.innerHTML += tr.innerHTML; // dwa razy ta sama treść = płynna pętla
    return { tr, dir: +tr.dataset.dir, x: 0 };
  });
  let scrollBoost = 0;
  function drawTicker(dt) {
    for (const t of tracks) {
      const half = t.tr.scrollWidth / 2;
      t.x -= t.dir * (40 + scrollBoost) * dt;
      if (t.x <= -half) t.x += half;
      if (t.x > 0) t.x -= half;
      t.tr.style.transform = `translateX(${t.x.toFixed(1)}px)`;
    }
    scrollBoost *= Math.exp(-dt * 3);
  }

  // ---------------------------------------------------------------- przewijana opowieść launchera
  const story = $('#launcher'), steps = $$('.step', story), imgs = $$('.stack img', story), dots = $$('.dots i', story);
  let storyIdx = 0, storyAuto = 0;
  function setStory(i) {
    if (i === storyIdx) return;
    steps.forEach((s, k) => { s.classList.toggle('on', k === i); s.classList.toggle('up', k < i); });
    imgs.forEach((im) => im.classList.toggle('on', im.dataset.shot === steps[i].dataset.shot));
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    storyIdx = i;
  }
  function updateStory(dt) {
    if (desktop()) {
      const r = story.getBoundingClientRect();
      const p = clamp(-r.top / (r.height - innerHeight), 0, 0.999);
      setStory(Math.floor(p * steps.length));
    } else {
      storyAuto += dt;
      if (storyAuto > 3.6) { storyAuto = 0; setStory((storyIdx + 1) % steps.length); }
    }
  }
  dots.forEach((d, k) => d.addEventListener('click', () => { storyAuto = 0; setStory(k); }));

  // ---------------------------------------------------------------- postaci 3D (silnik z launchera)
  let heroSkin = null, wrSkin = null;
  const SKIN = 'assets/skin-jvras.png';
  const COS = {
    cape: { cape_lightning: 'Błyskawica JVRAS', cape_neon: 'Neon', cape_frost: 'Szron', cape_galaxy: 'Galaktyka', cape_ember: 'Żar', cape_obsidian: 'Obsydian' },
    wings: { energy: { shape: 'energy', c1: '#FFE600', c2: 'rgba(245,158,11,0.15)', n: 'Skrzydła energii' }, angel: { shape: 'feather', c1: '#ffffff', c2: '#cbd5e1', n: 'Anielskie skrzydła' }, dragon: { shape: 'bat', c1: '#3b1d5e', c2: '#120a1f', n: 'Smocze skrzydła' } },
    head: { halo: { kind: 'halo', color: '#FFE600', n: 'Aureola' }, crown: { kind: 'crown', color: '#FBBF24', n: 'Korona' } },
    particles: { sparks: { kind: 'sparks', color: '#FFE600', n: 'Iskry' }, aura: { kind: 'aura', color: '#FACC15', n: 'Aura' }, stars: { kind: 'stars', color: '#ffffff', n: 'Gwiazdy' } },
  };
  const wrState = { cape: 'cape_lightning', wings: '', head: '', particles: 'sparks' };
  function wrCosmetics() {
    const out = {};
    if (wrState.cape) out.cape = { tex: 'assets/cosmetics/' + wrState.cape + '.png' };
    if (wrState.wings) { const { n, ...w } = COS.wings[wrState.wings]; out.wings = w; }
    if (wrState.head) { const { n, ...h } = COS.head[wrState.head]; out.head = h; }
    if (wrState.particles) { const { n, ...f } = COS.particles[wrState.particles]; out.particles = f; }
    return out;
  }
  function mountSkins() {
    if (!window.JvrasSkin) return;
    const h = $('#hero-skin');
    if (h) {
      heroSkin = window.JvrasSkin.mount(h);
      heroSkin.setSkin({ skin: SKIN });
      heroSkin.setCosmetics({ cape: { tex: 'assets/cosmetics/cape_lightning.png' }, wings: { shape: 'energy', c1: '#FFE600', c2: 'rgba(245,158,11,0.15)' }, particles: { kind: 'sparks', color: '#FFE600' } }, { quiet: true });
    }
    const w = $('#wr-skin');
    if (w) {
      // druga postać powstaje, gdy przymierzalnia zbliża się do ekranu (oszczędza moc na starcie)
      new IntersectionObserver(([e], io) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        wrSkin = window.JvrasSkin.mount(w);
        wrSkin.setSkin({ skin: SKIN });
        wrSkin.setCosmetics(wrCosmetics(), { quiet: true });
      }, { rootMargin: '300px' }).observe(w);
    }
  }
  $$('#wr-opts [data-slot]').forEach((group) => {
    const slot = group.dataset.slot;
    group.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.classList.contains('on')) return;
      $$('button', group).forEach((x) => x.classList.toggle('on', x === b));
      wrState[slot] = b.dataset.v;
      if (wrSkin) {
        wrSkin.setCosmetics(wrCosmetics());
        wrSkin.play(slot === 'cape' || slot === 'wings' ? 'spin' : slot === 'head' ? 'jump' : 'celebrate');
      }
      const name = $('#wr-name');
      const v = b.dataset.v;
      name.textContent = !v ? 'Bez dodatków' : slot === 'cape' ? COS.cape[v] : COS[slot][v].n;
      name.classList.remove('bump'); void name.offsetWidth; name.classList.add('bump');
      setTimeout(() => name.classList.remove('bump'), 400);
    });
  });

  // ---------------------------------------------------------------- wejście elementów przy przewijaniu
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      if (el.classList.contains('split')) revealSplit(el);
      // kaskada w obrębie jednej grupy (np. karty funkcji)
      const sibs = [...el.parentElement.children].filter((x) => x.classList.contains('rv'));
      el.style.transitionDelay = Math.min(sibs.indexOf(el), 6) * 80 + 'ms';
      el.classList.add('in');
      io.unobserve(el);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  $$('.rv').forEach((el) => io.observe(el));
  $$('.final .split').forEach((el) => io.observe(el));

  // ---------------------------------------------------------------- karty: pochylenie 3D i poświata za kursorem
  if (finePointer) {
    $$('.card').forEach((c) => {
      c.addEventListener('mousemove', (e) => {
        const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        c.style.setProperty('--mx', e.clientX - r.left + 'px');
        c.style.setProperty('--my', e.clientY - r.top + 'px');
        c.style.transform = `rotateX(${(-y * 10).toFixed(2)}deg) rotateY(${(x * 12).toFixed(2)}deg) translateZ(6px)`;
      });
      c.addEventListener('mouseleave', () => { c.style.transform = ''; });
    });
    const tilt = $('.shot.tilt');
    if (tilt) {
      tilt.addEventListener('mousemove', (e) => {
        const r = tilt.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        tilt.style.transform = `perspective(1400px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg)`;
      });
      tilt.addEventListener('mouseleave', () => { tilt.style.transform = ''; });
    }
  }

  // ---------------------------------------------------------------- nawigacja i pasek postępu
  const nav = $('#nav'), progress = $('#progress');
  const navLinks = $$('.links a');
  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  let lastScroll = scrollY;
  function onScroll() {
    const y = scrollY;
    nav.classList.toggle('scrolled', y > 20);
    progress.style.transform = `scaleX(${(y / Math.max(1, document.documentElement.scrollHeight - innerHeight)).toFixed(4)})`;
    scrollBoost = Math.min(500, scrollBoost + Math.abs(y - lastScroll) * 2);
    lastScroll = y;
    let cur = null;
    for (const s of sections) if (s.getBoundingClientRect().top < innerHeight * 0.4) cur = s;
    navLinks.forEach((a) => a.classList.toggle('on', cur && a.getAttribute('href') === '#' + cur.id));
  }
  addEventListener('scroll', onScroll, { passive: true });

  const hero = $('#hero');
  let heroVisible = true;
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero);
  addEventListener('mousemove', (e) => {
    mouseX = e.clientX / innerWidth - 0.5; mouseY = e.clientY / innerHeight - 0.5;
    const now = performance.now();
    if (finePointer && heroVisible && document.body.classList.contains('ready') && now - lastSpark > 40) { lastSpark = now; spawnSparks(e.clientX, e.clientY); }
  });

  // ---------------------------------------------------------------- jedna pętla animacji dla wszystkiego
  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000), t = now / 1000;
    lastT = now;
    stepScroll(dt);
    const sy = scrollY;
    if (heroVisible) drawWorld(t, sy);
    drawCave(t, dt, sy);
    updateY(sy);
    drawCubes(t, dt, sy);
    drawVox(t);
    drawSparks(dt);
    drawBits(dt);
    drawTicker(dt);
    updateStory(dt);
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- start
  textures();
  makeCubes($('#hero-cubes'), [
    // tylko wokół postaci i przy krawędziach - nie zasłaniają tekstu po lewej
    { kind: 'jvras', x: 84, y: 64, size: 66, depth: 1.4, z: 40 },
    { kind: 'ore', x: 47, y: 10, size: 34, depth: 0.6, z: -80 },
    { kind: 'grass', x: 52, y: 78, size: 44, depth: 1.1 },
    { kind: 'lamp', x: 92, y: 14, size: 46, depth: 1.2 },
    { kind: 'amethyst', x: 72, y: 6, size: 28, depth: 0.5, z: -120 },
    { kind: 'ore', x: 97, y: 88, size: 52, depth: 1.5, z: 30 },
  ]);
  // bloki w sekcjach (po bokach treści) - im niżej, tym "głębsze" rodzaje
  const SIDE = {
    funkcje: [{ kind: 'stone', x: -6, y: 12, size: 46 }, { kind: 'ore', x: 101, y: 30, size: 56, depth: 1.3 }, { kind: 'grass', x: -3, y: 78, size: 34, depth: 0.7 }],
    szafa: [{ kind: 'amethyst', x: -6, y: 20, size: 52, depth: 1.2 }, { kind: 'lamp', x: 101, y: 12, size: 40 }, { kind: 'amethyst', x: 100, y: 74, size: 32, depth: 0.7 }],
    client: [{ kind: 'deepslate', x: -5, y: 30, size: 48 }, { kind: 'jvras', x: 101, y: 64, size: 54, depth: 1.3 }],
    faq: [{ kind: 'gold', x: -6, y: 40, size: 44, depth: 1.2 }, { kind: 'magma', x: 101, y: 22, size: 40 }, { kind: 'deepslate', x: 100, y: 80, size: 30, depth: 0.7 }],
  };
  $$('[data-cubes]').forEach((h) => makeCubes(h, SIDE[h.dataset.cubes] || []));
  makeCubes($('#final-cubes'), [
    { kind: 'lamp', x: 8, y: 22, size: 50, depth: 1.2 },
    { kind: 'jvras', x: 86, y: 18, size: 56, depth: 1.3 },
    { kind: 'magma', x: 14, y: 70, size: 40, depth: 0.8 },
    { kind: 'gold', x: 82, y: 72, size: 44, depth: 1 },
  ]);
  buildVox();
  buildWorld();
  buildCave();
  // przebudowa jaskini, gdy zmienia się wysokość strony (obrazki, FAQ) albo okno
  let caveT = 0;
  const rebuildCave = () => { clearTimeout(caveT); caveT = setTimeout(buildCave, 150); };
  new ResizeObserver(() => { if (Math.abs(document.documentElement.scrollHeight - docH) > 40) rebuildCave(); }).observe(document.body);
  addEventListener('resize', () => { buildWorld(); rebuildCave(); });
  mountSkins();
  onScroll();
  requestAnimationFrame(frame);
  $('#year').textContent = new Date().getFullYear();
  // intro po wczytaniu czcionek (żeby napis JVRAS nie przeskakiwał)
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(runIntro);
  setTimeout(() => { if (!started) { intro.classList.add('gone'); startPage(); } }, 6000); // na wszelki wypadek
})();
