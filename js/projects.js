/* =====================================================================
   PROJECTS
   1) Live cards — hover (or, on phones, reach the middle of the screen)
      and the card scrolls through the whole website. Pure CSS transform,
      the tall screenshot is only downloaded on real hover intent.
   2) Shatter-open — click a card: it breaks into ~400 shards (a wave from
      the click point), they tumble through the air with gold backs and
      re-assemble into a full-screen preview. Closing plays it in reverse.
      One draw call, all motion in the vertex shader; the WebGL layer only
      exists while the 1-second transition is running.
   ===================================================================== */
const SHORT = {
  'dos-mebel': 'dos', 'perde.mariam': 'perde', 'tende.jalyuzi': 'tende', 'luxe-furnitura': 'luxe',
  'shtory_assel': 'assel', 'inteks-salonshtor': 'inteks', 'la_vida.kz': 'lavida', 'amanat_interior': 'amanat',
  'printspace-kz': 'print', 'luxe-barbershop-kentau': 'barber', 'qazaqstan-heritage': 'heritage', 'iq-alany': 'iq',
};
const WA = 'https://wa.me/77079840416';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
const cards = [...document.querySelectorAll('#pgrid .card')];
const slugOf = c => (c.getAttribute('href').match(/github\.io\/([^/]+)/) || [])[1];
const idOf = c => SHORT[slugOf(c)];

/* ---------------- 1) LIVE CARDS ---------------- */
function live(c) {
  const shot = c.querySelector('.shot');
  let box = shot.querySelector('.live');
  if (!box) {
    box = document.createElement('span'); box.className = 'live';
    const im = new Image(); im.decoding = 'async'; im.alt = '';
    // phones get a 480px-wide version: 4x less memory to decode than the desktop one
    im.src = `images/scroll/${fine ? 'd' : 't'}_${idOf(c)}.webp`;
    box.append(im); shot.append(box);
  }
  return box;
}
function play(c) {
  if (!idOf(c)) return;
  const box = live(c), im = box.firstChild;
  const go = () => {
    if (!c._want) return;
    const dist = im.offsetHeight - c.querySelector('.shot').clientHeight;
    c.classList.add('playing');
    if (dist > 4) {
      im.style.transition = `transform ${Math.max(3, dist / 170)}s cubic-bezier(.45,0,.55,1)`;
      im.style.transform = `translate3d(0,${-dist}px,0)`;
    }
  };
  im.complete && im.naturalHeight ? requestAnimationFrame(go) : im.addEventListener('load', go, { once: true });
}
function stop(c) {
  c._want = false;
  const box = c.querySelector('.live'); if (!box) return;
  const im = box.firstChild;
  im.style.transition = 'transform .9s cubic-bezier(.22,1,.36,1)'; im.style.transform = 'translate3d(0,0,0)';
  c.classList.remove('playing');
}
if (!reduce) {
  if (fine) {
    cards.forEach(c => {
      c.addEventListener('mouseenter', () => { c._want = true; c._t = setTimeout(() => play(c), 250); });
      c.addEventListener('mouseleave', () => { clearTimeout(c._t); stop(c); });
    });
  } else {
    // phones: the card crossing the middle band of the screen plays by itself
    const io = new IntersectionObserver(es => es.forEach(e => {
      const c = e.target;
      if (e.isIntersecting) { c._want = true; c._t = setTimeout(() => play(c), 350); }
      else { clearTimeout(c._t); stop(c); }
    }), { rootMargin: '-38% 0px -38% 0px' });
    cards.forEach(c => io.observe(c));
  }
}

/* ---------------- 2) PREVIEW MODAL ---------------- */
const pv = document.createElement('div');
pv.className = 'pv'; pv.setAttribute('role', 'dialog'); pv.setAttribute('aria-modal', 'true'); pv.setAttribute('aria-label', 'Жоба');
pv.innerHTML = `
  <div class="pv-bg"></div>
  <button class="pv-x" aria-label="Жабу">✕</button>
  <div class="pv-in">
    <div class="pv-stage">
      <div class="pv-browser"><div class="pv-bar"><i></i><i></i><i></i><span class="pv-url"></span></div>
        <div class="pv-view"><img class="pv-d" alt=""></div></div>
      <div class="pv-phone"><div class="pv-scr"><img class="pv-m" alt=""></div></div>
    </div>
    <div class="pv-info">
      <div class="eyebrow pv-n"></div>
      <h3 class="pv-name"></h3>
      <p class="pv-meta"></p>
      <div class="pv-cta">
        <a class="btn pv-wa" target="_blank" rel="noopener">Маған да осындай <span class="arr">→</span></a>
        <a class="btn line pv-open" target="_blank" rel="noopener">Сайтты ашу ↗</a>
      </div>
      <div class="pv-nav"><button class="pv-prev" aria-label="Алдыңғы">←</button><button class="pv-next" aria-label="Келесі">→</button></div>
    </div>
  </div>`;
document.body.append(pv);
const q = s => pv.querySelector(s);
let cur = -1, busy = false;

function fill(i) {
  const c = cards[i], id = idOf(c), slug = slugOf(c);
  q('.pv-n').textContent = String(i + 1).padStart(2, '0') + ' / ' + cards.length;
  q('.pv-name').textContent = c.querySelector('h3').textContent;
  q('.pv-meta').textContent = c.querySelector('.info span').textContent;
  q('.pv-url').textContent = 'diyorbekashurbekov.github.io/' + slug;
  q('.pv-open').href = c.href;
  q('.pv-wa').href = WA + '?text=' + encodeURIComponent(`Сәлеметсіз бе, Диярбек! «${q('.pv-name').textContent}» сияқты сайт керек.`);
  const d = q('.pv-d'), m = q('.pv-m');
  d.src = `images/scroll/d_${id}.webp`; m.src = `images/scroll/m_${id}.webp`;
  [d, m].forEach(im => { im.style.animation = 'none'; });
  const arm = im => {           // slow auto-scroll inside the frames (transform only → 60fps)
    const box = im.parentElement, dist = im.offsetHeight - box.clientHeight;
    if (dist > 4 && !reduce) {
      im.style.setProperty('--d', -dist + 'px');
      im.style.animation = `pvscroll ${Math.max(6, dist / 60)}s 1.2s cubic-bezier(.45,0,.55,1) infinite alternate`;
    }
  };
  [d, m].forEach(im => im.complete && im.naturalHeight ? arm(im) : im.addEventListener('load', () => arm(im), { once: true }));
}
/* phones see the phone mock-up (mobile version of the site), desktops the browser window */
const mobileView = () => innerWidth < 900;
const target = () => mobileView() ? [q('.pv-scr'), q('.pv-m')] : [q('.pv-view'), q('.pv-d')];
const decode = im => (im.complete && im.naturalHeight) ? Promise.resolve() : new Promise(r => { im.onload = r; im.onerror = r; });

/* the transition can never lock the page: any error or a stall longer than 2.5 s just skips it */
const safe = p => Promise.race([p.catch(e => console.warn('shatter skipped:', e)), new Promise(r => setTimeout(r, 2500))]);

async function open(i, ev) {
  if (busy) return; busy = true; cur = i;
  const c = cards[i];
  fill(i);
  document.documentElement.classList.add('pv-lock');
  pv.classList.add('on');                       // measurable, content still invisible
  const [to, toImg] = target();
  const from = c.querySelector('.shot');
  try {
    if (!reduce) {
      const click = ev && ev.clientX != null ? [ev.clientX, ev.clientY] : null;
      from.style.visibility = 'hidden';
      // starts on this very tap — the big screenshot is swapped in mid-flight if it's still loading
      await safe(shatter(from, to, c.querySelector('.shot > img'), toImg, click, false));
    }
  } finally { pv.classList.add('open'); busy = false; }
}
async function close() {
  if (busy || cur < 0) return; busy = true;
  const c = cards[cur], from = c.querySelector('.shot');
  try {
    if (!reduce) {
      // bring the card into view under the modal so the shards have somewhere to land
      const r = from.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) c.scrollIntoView({ block: 'center', behavior: 'instant' });
      const [to, toImg] = target(); toImg.style.animation = 'none';
      pv.classList.remove('open');
      await safe(shatter(from, to, c.querySelector('.shot > img'), toImg, null, true));
    }
  } finally {
    pv.classList.remove('open', 'on'); document.documentElement.classList.remove('pv-lock');
    from.style.visibility = ''; busy = false; cur = -1;
  }
}

/* warm-up: big screenshots of cards the visitor is looking at, and Three.js itself, load ahead of the tap */
if (!reduce) {
  const pre = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    pre.unobserve(e.target);
    const id = idOf(e.target); if (!id) return;
    const im = new Image(); im.decoding = 'async'; im.fetchPriority = 'low';
    im.src = `images/scroll/${mobileView() ? 'm' : 'd'}_${id}.webp`;
  }), { rootMargin: '0px 0px 25% 0px' });
  const go = () => cards.forEach(c => pre.observe(c));
  document.readyState === 'complete' ? setTimeout(go, 1500) : addEventListener('load', () => setTimeout(go, 1500), { once: true });
  const warm = () => { getGL().catch(() => {}); };
  document.getElementById('projects').addEventListener('pointerover', warm, { once: true });
  document.getElementById('projects').addEventListener('touchstart', warm, { once: true, passive: true });
}
function step(dir) {
  if (busy || cur < 0) return;
  cards[cur].querySelector('.shot').style.visibility = '';
  let i = cur;
  do { i = (i + dir + cards.length) % cards.length; } while (cards[i].classList.contains('hide'));
  cur = i; cards[i].querySelector('.shot').style.visibility = 'hidden';
  q('.pv-in').classList.add('swap');
  setTimeout(() => { fill(i); q('.pv-in').classList.remove('swap'); }, 260);
}
cards.forEach((c, i) => c.addEventListener('click', e => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || !idOf(c)) return;   // let "open in new tab" work
  e.preventDefault(); stop(c); open(i, e);
}));
q('.pv-x').addEventListener('click', close);
q('.pv-bg').addEventListener('click', close);
q('.pv-prev').addEventListener('click', () => step(-1));
q('.pv-next').addEventListener('click', () => step(1));
addEventListener('keydown', e => {
  if (cur < 0) return;
  if (e.key === 'Escape') close();
  if (e.key === 'ArrowRight') step(1);
  if (e.key === 'ArrowLeft') step(-1);
});

/* ---------------- shatter transition (WebGL, lives ~1s) ---------------- */
let THREE = null;
const VS = `
uniform vec4 uA; uniform vec4 uB;          // from/to rects in CSS px: x, y, w, h
uniform vec2 uView; uniform float uT; uniform vec2 uClick;
attribute vec2 aC; attribute vec4 aR;
varying vec2 vUv; varying float vFly; varying vec3 vN;
vec3 rotA(vec3 v, vec3 a, float t){ float c=cos(t), s=sin(t); return v*c + cross(a,v)*s + a*dot(a,v)*(1.-c); }
void main(){
  vUv = position.xy;
  vec2 cA = uA.xy + aC * uA.zw, cB = uB.xy + aC * uB.zw;
  float delay = clamp(distance(cA, uClick) / max(uView.x, uView.y), 0., 1.) * .32 + aR.w * .08;
  float t = clamp((uT - delay) / .6, 0., 1.);
  float e = t * t * (3. - 2. * t);
  float fly = sin(3.14159 * t); vFly = fly;
  vec2 lA = (position.xy - aC) * uA.zw, lB = (position.xy - aC) * uB.zw;
  vec3 local = vec3(mix(lA, lB, e), 0.);
  vec3 ax = normalize(aR.xyz + vec3(0., 0., .2));
  float ang = fly * (1.2 + aR.w * 2.6) * 3.14159;
  local = rotA(local, ax, ang);
  vN = rotA(vec3(0., 0., 1.), ax, ang);
  vec2 c = mix(cA, cB, e) + normalize(aR.xy + 1e-3) * fly * (90. + aR.w * 260.);
  vec3 p = vec3(c.x - uView.x * .5, uView.y * .5 - c.y, fly * (120. + aR.w * 380.)) + vec3(local.x, -local.y, local.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
}`;
const FS = `
uniform sampler2D uTexA; uniform sampler2D uTexB; uniform vec4 uCropA; uniform vec4 uCropB; uniform float uT;
varying vec2 vUv; varying float vFly; varying vec3 vN;
void main(){
  float light = .55 + .45 * abs(dot(normalize(vN), normalize(vec3(-.4, .6, .7))));
  if (!gl_FrontFacing) {                      // backs of the shards are gold
    vec3 g = mix(vec3(.55, .36, .14), vec3(1., .8, .45), light);
    gl_FragColor = vec4(g, 1.); return;
  }
  vec3 a = texture2D(uTexA, uCropA.xy + vUv * uCropA.zw).rgb;
  vec3 b = texture2D(uTexB, uCropB.xy + vUv * uCropB.zw).rgb;
  vec3 col = mix(a, b, smoothstep(.45, .75, uT));
  col *= mix(1., light * 1.15, vFly);
  col = mix(col, vec3(1., .78, .42), vFly * .18);
  gl_FragColor = vec4(col, 1.);
}`;

/* uv crop that reproduces CSS object-fit: cover (top-anchored when `top`) */
function cover(img, w, h, top) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (!iw || !ih || !w || !h) return [0, 0, 1, 1];
  const s = Math.max(w / iw, h / ih);
  const cw = w / s / iw, ch = h / s / ih;
  return [(1 - cw) / 2, top ? 0 : (1 - ch) / 2, cw, ch];
}

/* one WebGL layer, created once (first hover/touch on the section) and reused for every open/close:
   no context creation or shader compilation at tap time */
let GL = null;
function getGL() {
  return GL = GL || (async () => {
    THREE = THREE || await import('three');
    const mobile = innerWidth < 700;
    const canvas = document.createElement('canvas'); canvas.className = 'pv-gl';
    document.body.append(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.5));
    const geo = shardGeometry(mobile);
    const U = {
      uA: { value: new THREE.Vector4() }, uB: { value: new THREE.Vector4() },
      uTexA: { value: null }, uTexB: { value: null },
      uCropA: { value: new THREE.Vector4(0, 0, 1, 1) }, uCropB: { value: new THREE.Vector4(0, 0, 1, 1) },
      uView: { value: new THREE.Vector2() }, uT: { value: 0 }, uClick: { value: new THREE.Vector2() },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
    const scene = new THREE.Scene(); scene.add(mesh);
    const cam = new THREE.PerspectiveCamera(30, 1, 10, 10000);
    // compile the shader now with a 1x1 placeholder so the first tap doesn't pay for it
    const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); blank.needsUpdate = true;
    U.uTexA.value = U.uTexB.value = blank; renderer.compile(scene, cam);
    return { renderer, canvas, U, scene, cam, mobile };
  })();
}
function shardGeometry(mobile) {
  /* jittered grid → two triangles per cell, each triangle is a shard */
  const cols = mobile ? 12 : 20, rows = mobile ? 9 : 13, V = [];
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) {
    const j = (x > 0 && x < cols && y > 0 && y < rows) ? .38 : 0;
    V.push([(x + (Math.random() - .5) * j) / cols, (y + (Math.random() - .5) * j) / rows]);
  }
  const P = [], C = [], R = [], at = (x, y) => V[y * (cols + 1) + x];
  const tri = (a, b, c) => {
    const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3;
    const r = [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random()];
    // grid is y-down, world is y-up → emit a,c,b so the picture side faces the camera
    for (const v of [a, c, b]) { P.push(v[0], v[1], 0); C.push(cx, cy); R.push(...r); }
  };
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const a = at(x, y), b = at(x + 1, y), c = at(x + 1, y + 1), d = at(x, y + 1);
    if (Math.random() < .5) { tri(a, b, c); tri(a, c, d); } else { tri(a, b, d); tri(b, c, d); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('aC', new THREE.Float32BufferAttribute(C, 2));
  geo.setAttribute('aR', new THREE.Float32BufferAttribute(R, 4));
  return geo;
}

const ready = im => im.complete && im.naturalWidth > 0;
async function shatter(fromEl, toEl, imgA, imgB, click, reverse) {
  const { renderer, canvas, U, scene, cam, mobile } = await getGL();
  const W = innerWidth, H = innerHeight;
  renderer.setSize(W, H, false);
  cam.aspect = W / H; cam.position.z = H / 2 / Math.tan(THREE.MathUtils.degToRad(15)); cam.updateProjectionMatrix();

  const rect = el => { const r = el.getBoundingClientRect(); return new THREE.Vector4(r.left, r.top, r.width, r.height); };
  const tex = im => { const t = new THREE.Texture(im); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.needsUpdate = true; return t; };
  const rA = rect(fromEl), rB = rect(toEl);
  // start side / end side (reverse = closing: modal → card)
  const sImg = reverse ? imgB : imgA, eImg = reverse ? imgA : imgB, sR = reverse ? rB : rA, eR = reverse ? rA : rB;
  const sTop = reverse, eTop = !reverse;
  // a card that just scrolled into view may still be loading its picture: give it 150 ms, never more
  if (!ready(sImg)) await Promise.race([new Promise(r => sImg.addEventListener('load', r, { once: true })), new Promise(r => setTimeout(r, 150))]);
  const texS = ready(sImg) ? tex(sImg) : null; let texE = null;
  U.uA.value.copy(sR); U.uB.value.copy(eR);
  U.uTexA.value = texS || U.uTexA.value; U.uCropA.value.set(...cover(sImg, sR.z, sR.w, sTop));
  const useEnd = () => { texE = tex(eImg); U.uTexB.value = texE; U.uCropB.value.set(...cover(eImg, eR.z, eR.w, eTop)); };
  if (ready(eImg)) useEnd();
  else { U.uTexB.value = U.uTexA.value; U.uCropB.value.copy(U.uCropA.value); eImg.addEventListener('load', useEnd, { once: true }); }
  U.uView.value.set(W, H);
  U.uClick.value.set(...(click || [sR.x + sR.z / 2, sR.y + sR.w / 2]));

  canvas.classList.add('run');
  const DUR = mobile ? 950 : 1150;
  await new Promise(done => {
    const t0 = performance.now();
    (function frame(now) {
      const t = Math.min(1, (now - t0) / DUR);
      U.uT.value = t; renderer.render(scene, cam);
      if (t < 1) requestAnimationFrame(frame); else done();
    })(t0);
  });
  eImg.removeEventListener('load', useEnd);
  // hand over to the DOM on the next frame, then hide the layer and free the two textures
  requestAnimationFrame(() => requestAnimationFrame(() => {
    canvas.classList.remove('run'); renderer.clear();
    texS && texS.dispose(); texE && texE.dispose();
  }));
}
